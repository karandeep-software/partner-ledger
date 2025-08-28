import "./index.css";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";

// Firebase
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  addDoc,
  collection,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Progress ring
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

/* -------------------------------------
   Configurable bits
------------------------------------- */
const CURRENCY = "₹"; // change if you like
const MAX_UPLOAD_MB = 6;
const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

/* -------------------------------------
   Firebase
------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyDnZJH_5SHKH8BfBddebSbAfGreH4IfY1o",
  authDomain: "partner-expense-tracker-b625c.firebaseapp.com",
  projectId: "partner-expense-tracker-b625c",
  storageBucket: "partner-expense-tracker-b625c.appspot.com",
  messagingSenderId: "146838171648",
  appId: "1:146838171648:web:6cdf614666fc2cedd9e8e5",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

/* -------------------------------------
   Helpers
------------------------------------- */
const isTouch = () =>
  typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);

const fmtCurrency = (n) => `${CURRENCY}${Number(n || 0).toFixed(2)}`;

function useAnimatedNumber(value) {
  const ref = useRef(null);
  const mv = useMotionValue(0);
  useEffect(() => {
    const controls = animate(mv, Number(value || 0), { duration: 0.5 });
    return controls.stop;
  }, [value]);
  return [mv, ref];
}

/* -------------------------------------
   Toasts
------------------------------------- */
function Toast({ toasts, remove }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className={`px-4 py-3 rounded-xl shadow-xl border text-sm ${
              t.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/40 dark:border-rose-800 dark:text-rose-100"
                : "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <span>{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                className="ml-2 text-xs opacity-70 hover:opacity-100"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------
   App
------------------------------------- */
function App() {
  // 🔑 Auth state
  const [user, setUser] = useState(null);
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Data state
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Modal form state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [newExpense, setNewExpense] = useState({ amount: "", partner: "", note: "" });
  const [newIncome, setNewIncome] = useState({ amount: "", partner: "", note: "" });

  // UI state
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [showRoadmap, setShowRoadmap] = useState(false);

  // Filters
  const [expenseQuery, setExpenseQuery] = useState("");
  const [incomeQuery, setIncomeQuery] = useState("");

  // Confirm delete modal
  const [confirm, setConfirm] = useState({ open: false, type: null, id: null, name: "" });

  // Image lightbox
  const [lightbox, setLightbox] = useState({ open: false, url: "", meta: "" });

  // Toasts
  const [toasts, setToasts] = useState([]);
  const pushToast = (message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };
  const removeToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  // Derived totals
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalIncomes = incomes.reduce((sum, i) => sum + (i.amount || 0), 0);
  const balance = totalIncomes - totalExpenses;

  // Animated numbers
  const [mvExp] = useAnimatedNumber(totalExpenses);
  const [mvInc] = useAnimatedNumber(totalIncomes);
  const [mvBal] = useAnimatedNumber(balance);

  // Roadmap dates
  const now = new Date();
  const fmtDate = (d) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const oneMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const twoMonths = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate());
  const threeMonths = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());

  // 🌙 Theme (Dark Mode) ------------------------
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
    } else {
      // follow OS on first visit
      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // ✅ Listen for auth changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // ✅ Fetch expenses & incomes
  useEffect(() => {
    if (!user) {
      setExpenses([]);
      setIncomes([]);
      setDataLoading(false);
      return;
    }
    setDataLoading(true);
    const qExp = query(collection(db, "expenses"), orderBy("createdAt", "desc"));
    const qInc = query(collection(db, "incomes"), orderBy("createdAt", "desc"));
    const unsub1 = onSnapshot(
      qExp,
      (snap) => setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => pushToast(err.message, "error")
    );
    const unsub2 = onSnapshot(
      qInc,
      (snap) => setIncomes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => pushToast(err.message, "error")
    );
    const t = setTimeout(() => setDataLoading(false), 250);
    return () => {
      unsub1();
      unsub2();
      clearTimeout(t);
    };
  }, [user]);

  // Auth actions
  const handleAuth = async () => {
    if (!authForm.email || !authForm.password) {
      pushToast("Please enter email and password", "error");
      return;
    }
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
        pushToast("Account created. Welcome!");
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
        pushToast("Logged in successfully");
      }
    } catch (err) {
      pushToast(err.message, "error");
    }
  };
  const handleLogout = async () => {
    await signOut(auth);
    pushToast("Logged out");
  };

  // Validation
  const validateEntry = ({ amount, partner }) => {
    const n = Number(amount);
    if (!amount || Number.isNaN(n) || n <= 0) return "Enter a valid positive amount";
    if (!partner?.trim()) return "Partner is required";
    return null;
  };

  // Add expense / income
  const addExpense = async () => {
    const v = validateEntry(newExpense);
    if (v) return pushToast(v, "error");
    try {
      await addDoc(collection(db, "expenses"), {
        ...newExpense,
        amount: parseFloat(newExpense.amount),
        createdAt: serverTimestamp(),
        receiptUrl: null,
      });
      setNewExpense({ amount: "", partner: "", note: "" });
      setShowExpenseModal(false);
      pushToast("Expense added");
    } catch (e) {
      pushToast(e.message, "error");
    }
  };

  const addIncome = async () => {
    const v = validateEntry(newIncome);
    if (v) return pushToast(v, "error");
    try {
      await addDoc(collection(db, "incomes"), {
        ...newIncome,
        amount: parseFloat(newIncome.amount),
        createdAt: serverTimestamp(),
        receiptUrl: null,
      });
      setNewIncome({ amount: "", partner: "", note: "" });
      setShowIncomeModal(false);
      pushToast("Income added");
    } catch (e) {
      pushToast(e.message, "error");
    }
  };

  // Upload receipt with validation
  const uploadReceipt = async (id, type, file) => {
    if (!file) return;
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return pushToast("Only PNG, JPEG, WEBP or PDF allowed", "error");
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      return pushToast(`File too large. Max ${MAX_UPLOAD_MB} MB`, "error");
    }
    try {
      const storageRef = ref(storage, `${type}/${id}-${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, type, id), { receiptUrl: url });
      pushToast("Receipt uploaded");
    } catch (e) {
      pushToast(e.message, "error");
    }
  };

  // Delete handlers via confirm modal
  const askDelete = (type, id, name) => setConfirm({ open: true, type, id, name });
  const doDelete = async () => {
    try {
      if (confirm.type === "expenses") {
        await deleteDoc(doc(db, "expenses", confirm.id));
      } else if (confirm.type === "incomes") {
        await deleteDoc(doc(db, "incomes", confirm.id));
      }
      pushToast("Deleted");
    } catch (e) {
      pushToast(e.message, "error");
    } finally {
      setConfirm({ open: false, type: null, id: null, name: "" });
    }
  };

  /* -------------------------------
     Auth screen (with loading)
  ------------------------------- */
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden dark:bg-slate-950">
        <GradientNebula />
        <div className="animate-pulse bg-white/80 dark:bg-slate-800/80 border shadow-2xl rounded-2xl p-10 z-10">
          <div className="w-64 h-6 bg-gray-200 dark:bg-slate-700 rounded mb-3" />
          <div className="w-80 h-6 bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center dark:bg-slate-950">
        <GradientNebula />
        <div className="bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 backdrop-blur-md p-8 rounded-2xl shadow-2xl w-full max-w-md border dark:border-slate-700 z-10">
          <h1 className="text-3xl font-extrabold text-center mb-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            {isRegistering ? "Create an Account" : "Welcome Back"}
          </h1>
          <input
            type="email"
            className="w-full mb-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-purple-300/40 outline-none"
            placeholder="Email"
            value={authForm.email}
            onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
            inputMode="email"
            autoCapitalize="none"
          />
          <input
            type="password"
            className="w-full mb-4 px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-purple-300/40 outline-none"
            placeholder="Password"
            value={authForm.password}
            onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
          />
          <button
            onClick={handleAuth}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:brightness-110 transition shadow-lg"
          >
            {isRegistering ? "Sign Up" : "Login"}
          </button>
          <p
            className="mt-4 text-sm text-center text-gray-600 dark:text-slate-300 cursor-pointer hover:underline"
            onClick={() => setIsRegistering(!isRegistering)}
          >
            {isRegistering ? "Already have an account? Login" : "Don't have an account? Sign Up"}
          </p>
        </div>
      </div>
    );
  }

  /* -------------------------------
     Logged-in app
  ------------------------------- */
  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-gradient-to-br from-indigo-50 via-pink-50 to-amber-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 text-slate-900 dark:text-slate-100">
      <GradientNebula />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600/95 text-white shadow-lg backdrop-blur dark:from-slate-800 dark:via-slate-800 dark:to-slate-800">
        <div className="px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur" />
            <h1 className="text-lg md:text-xl font-bold tracking-wide">Partner Ledger</h1>
          </div>

          {/* desktop nav */}
          <nav className="hidden sm:flex gap-2">
            {["Dashboard", "Expenses", "Incomes", "Receipts"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  activeTab === tab ? "bg-white text-purple-700 shadow" : "hover:bg-white/15"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="rounded-full border border-white/50 bg-white/10 hover:bg-white/20 text-white px-3 py-2 text-xs md:text-sm"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>

            <span className="text-white/90 text-xs md:text-sm font-semibold hidden sm:block">
              {user?.email}
            </span>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/30 border border-white/40" />
            <button
              onClick={handleLogout}
              className="ml-1 md:ml-2 bg-white text-pink-600 px-3 md:px-4 py-2 rounded-full font-semibold hover:bg-pink-50 shadow"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 p-4 md:p-8 pb-28 md:pb-10 relative z-10">
        {dataLoading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white/80 dark:bg-slate-800/60 rounded-2xl p-6 shadow-lg">
                <div className="h-4 w-24 bg-gray-200 dark:bg-slate-700 rounded mb-3" />
                <div className="h-8 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
              </div>
            ))}
          </div>
        )}

        {!dataLoading && activeTab === "Dashboard" && (
          <>
            <h2 className="text-2xl font-bold mb-6">📑 Dashboard</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Expenses */}
              <StatCard label="Total Expenses" color="red" valueAnim={mvExp} />

              {/* Incomes */}
              <StatCard label="Total Incomes" color="green" valueAnim={mvInc} />

              {/* Balance */}
              <StatCard
                label="Balance"
                color={balance >= 0 ? "indigo" : "rose"}
                valueAnim={mvBal}
              />

              {/* Progress + Roadmap */}
              <div
                className="relative bg-white/90 dark:bg-slate-800/90 dark:border-slate-700 rounded-2xl p-6 shadow-lg flex flex-col items-center justify-center border border-white/70"
                onMouseEnter={() => !isTouch() && setShowRoadmap(true)}
                onMouseLeave={() => !isTouch() && setShowRoadmap(false)}
              >
                <div className="w-24 h-24">
                  <CircularProgressbar
                    value={42}
                    text={`42%`}
                    styles={buildStyles({
                      pathColor: theme === "dark" ? "#a78bfa" : "#8b5cf6",
                      textColor: theme === "dark" ? "#c7d2fe" : "#8b5cf6",
                      trailColor: theme === "dark" ? "#1f2937" : "#e5e7eb",
                    })}
                  />
                </div>
                <span className="mt-3 text-sm font-medium">App Progress</span>

                {/* Mobile button */}
                <button
                  onClick={() => setShowRoadmap((v) => !v)}
                  className="sm:hidden mt-3 text-xs px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800"
                >
                  {showRoadmap ? "Hide Roadmap" : "Show Roadmap"}
                </button>

                {/* Panel */}
                <AnimatePresence>
                  {showRoadmap && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 12 }}
                      transition={{ duration: 0.2 }}
                      className="mt-3 sm:mt-0 sm:absolute sm:top-full sm:mt-3 w-full sm:w-80 bg-white dark:bg-slate-800 dark:border-slate-700 rounded-xl shadow-2xl border p-4 text-left z-20"
                    >
                      <h3 className="text-lg font-semibold mb-2">📅 Roadmap</h3>
                      <ul className="space-y-2 text-sm">
                        <li>
                          <span className="font-medium text-purple-600 dark:text-purple-300">{fmtDate(twoWeeks)}:</span>{" "}
                          Error fixed in uploading receipts ✅
                        </li>
                        <li>
                          <span className="font-medium text-green-600 dark:text-green-300">{fmtDate(oneMonth)}:</span>{" "}
                          Export to Excel/PDF 📊
                        </li>
                        <li>
                          <span className="font-medium text-blue-600 dark:text-blue-300">{fmtDate(twoMonths)}:</span>{" "}
                          Mobile UI + Dark Mode 🌙
                        </li>
                        <li>
                          <span className="font-medium text-pink-600 dark:text-pink-300">{fmtDate(threeMonths)}:</span>{" "}
                          AI spending insights 🤖
                        </li>
                        <li>
                          <span className="font-medium text-amber-600 dark:text-amber-300">Future:</span>{" "}
                          Partner collaboration dashboard ❤️
                        </li>
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}

        {/* ---- Expenses ---- */}
        {!dataLoading && activeTab === "Expenses" && (
          <section className="bg-white/90 dark:bg-slate-800/90 dark:border-slate-700 backdrop-blur p-6 rounded-2xl shadow-lg mt-6 border">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <h2 className="text-xl font-semibold">💸 Expenses</h2>
              <div className="flex-1 min-w-[220px] max-w-xs">
                <input
                  value={expenseQuery}
                  onChange={(e) => setExpenseQuery(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-indigo-200/40 outline-none"
                  placeholder="Search by partner / note"
                />
              </div>
              <button
                onClick={() => setShowExpenseModal(true)}
                className="bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 text-white px-4 py-2 rounded-xl shadow hover:brightness-110"
              >
                + Add Expense
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border dark:border-slate-700">
              <table className="w-full border-collapse min-w-[680px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-900/50 text-gray-600 dark:text-slate-300">
                    <th className="text-left p-3 border-b dark:border-slate-700">Amount</th>
                    <th className="text-left p-3 border-b dark:border-slate-700">Partner</th>
                    <th className="text-left p-3 border-b dark:border-slate-700">Note</th>
                    <th className="text-left p-3 border-b dark:border-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses
                    .filter((exp) => {
                      if (!expenseQuery.trim()) return true;
                      const q = expenseQuery.toLowerCase();
                      return (
                        String(exp.partner || "").toLowerCase().includes(q) ||
                        String(exp.note || "").toLowerCase().includes(q)
                      );
                    })
                    .map((exp) => (
                      <tr key={exp.id} className="hover:bg-gray-50 dark:hover:bg-slate-900/40 transition">
                        <td className="p-3">{fmtCurrency(exp.amount)}</td>
                        <td className="p-3">{exp.partner}</td>
                        <td className="p-3">{exp.note}</td>
                        <td className="p-3 space-x-2 whitespace-nowrap">
                          <label className="cursor-pointer bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 inline-block">
                            Upload Receipt
                            <input
                              type="file"
                              accept={ALLOWED_FILE_TYPES.join(",")}
                              className="hidden"
                              onChange={(e) => uploadReceipt(exp.id, "expenses", e.target.files[0])}
                            />
                          </label>
                          {exp.receiptUrl && (
                            <>
                              <button
                                onClick={() =>
                                  setLightbox({
                                    open: true,
                                    url: exp.receiptUrl,
                                    meta: `${exp.partner || "—"} — ${fmtCurrency(exp.amount)}`,
                                  })
                                }
                                className="bg-green-500 text-white px-3 py-1 rounded-lg hover:bg-green-600 inline-block"
                              >
                                View
                              </button>
                              <a
                                href={exp.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-white dark:bg-slate-900 dark:text-slate-100 text-gray-700 px-3 py-1 rounded-lg border dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 inline-block"
                              >
                                Open
                              </a>
                            </>
                          )}
                          <button
                            className="bg-rose-500 text-white px-3 py-1 rounded-lg hover:bg-rose-600 inline-block"
                            onClick={() =>
                              askDelete("expenses", exp.id, exp.partner || fmtCurrency(exp.amount))
                            }
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td className="p-4 text-gray-500 dark:text-slate-400" colSpan={4}>
                        No expenses yet. Click “Add Expense” to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ---- Incomes ---- */}
        {!dataLoading && activeTab === "Incomes" && (
          <section className="bg-white/90 dark:bg-slate-800/90 dark:border-slate-700 backdrop-blur p-6 rounded-2xl shadow-lg mt-6 border">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <h2 className="text-xl font-semibold">💵 Incomes</h2>
              <div className="flex-1 min-w-[220px] max-w-xs">
                <input
                  value={incomeQuery}
                  onChange={(e) => setIncomeQuery(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-indigo-200/40 outline-none"
                  placeholder="Search by partner / note"
                />
              </div>
              <button
                onClick={() => setShowIncomeModal(true)}
                className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white px-4 py-2 rounded-xl shadow hover:brightness-110"
              >
                + Add Income
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border dark:border-slate-700">
              <table className="w-full border-collapse min-w-[680px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-900/50 text-gray-600 dark:text-slate-300">
                    <th className="text-left p-3 border-b dark:border-slate-700">Amount</th>
                    <th className="text-left p-3 border-b dark:border-slate-700">Partner</th>
                    <th className="text-left p-3 border-b dark:border-slate-700">Note</th>
                    <th className="text-left p-3 border-b dark:border-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {incomes
                    .filter((inc) => {
                      if (!incomeQuery.trim()) return true;
                      const q = incomeQuery.toLowerCase();
                      return (
                        String(inc.partner || "").toLowerCase().includes(q) ||
                        String(inc.note || "").toLowerCase().includes(q)
                      );
                    })
                    .map((inc) => (
                      <tr key={inc.id} className="hover:bg-gray-50 dark:hover:bg-slate-900/40 transition">
                        <td className="p-3">{fmtCurrency(inc.amount)}</td>
                        <td className="p-3">{inc.partner}</td>
                        <td className="p-3">{inc.note}</td>
                        <td className="p-3 space-x-2 whitespace-nowrap">
                          <label className="cursor-pointer bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 inline-block">
                            Upload Receipt
                            <input
                              type="file"
                              accept={ALLOWED_FILE_TYPES.join(",")}
                              className="hidden"
                              onChange={(e) => uploadReceipt(inc.id, "incomes", e.target.files[0])}
                            />
                          </label>
                          {inc.receiptUrl && (
                            <>
                              <button
                                onClick={() =>
                                  setLightbox({
                                    open: true,
                                    url: inc.receiptUrl,
                                    meta: `${inc.partner || "—"} — ${fmtCurrency(inc.amount)}`,
                                  })
                                }
                                className="bg-green-500 text-white px-3 py-1 rounded-lg hover:bg-green-600 inline-block"
                              >
                                View
                              </button>
                              <a
                                href={inc.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-white dark:bg-slate-900 dark:text-slate-100 text-gray-700 px-3 py-1 rounded-lg border dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 inline-block"
                              >
                                Open
                              </a>
                            </>
                          )}
                          <button
                            className="bg-rose-500 text-white px-3 py-1 rounded-lg hover:bg-rose-600 inline-block"
                            onClick={() =>
                              askDelete("incomes", inc.id, inc.partner || fmtCurrency(inc.amount))
                            }
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  {incomes.length === 0 && (
                    <tr>
                      <td className="p-4 text-gray-500 dark:text-slate-400" colSpan={4}>
                        No incomes yet. Click “Add Income” to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ---- Receipts ---- */}
        {!dataLoading && activeTab === "Receipts" && (
          <section className="bg-white dark:bg-slate-800 dark:border-slate-700 p-6 rounded-2xl shadow-lg mt-6 border">
            <h2 className="text-xl font-semibold mb-4">📷 Uploaded Receipts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {[...expenses, ...incomes]
                .filter((item) => item.receiptUrl)
                .map((item) => (
                  <motion.div
                    key={item.id}
                    whileHover={{ scale: 1.02 }}
                    className="p-4 border dark:border-slate-700 rounded-xl shadow-sm bg-gray-50 dark:bg-slate-900/40"
                  >
                    <img
                      src={item.receiptUrl}
                      alt="Receipt"
                      className="w-full h-48 object-cover rounded-lg mb-3 cursor-zoom-in"
                      onClick={() =>
                        setLightbox({
                          open: true,
                          url: item.receiptUrl,
                          meta: `${item.partner || "—"} — ${fmtCurrency(item.amount)}`,
                        })
                      }
                    />
                    <p className="font-medium">
                      {item.partner || "—"} — {fmtCurrency(item.amount)}
                    </p>
                    <a
                      href={item.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition"
                    >
                      Open Full
                    </a>
                  </motion.div>
                ))}
              {[...expenses, ...incomes].filter((i) => i.receiptUrl).length === 0 && (
                <p className="text-gray-500 dark:text-slate-400">No receipts uploaded yet.</p>
              )}
            </div>
          </section>
        )}
      </main>

      {/* 🔸 Bottom Tab Bar (mobile) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-800/95 backdrop-blur border-t dark:border-slate-700">
        <div className="grid grid-cols-4">
          {[
            { tab: "Dashboard", icon: "🏠" },
            { tab: "Expenses", icon: "💸" },
            { tab: "Incomes", icon: "💰" },
            { tab: "Receipts", icon: "🧾" },
          ].map(({ tab, icon }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 text-xs font-medium flex flex-col items-center ${
                activeTab === tab ? "text-indigo-600 dark:text-indigo-300" : "text-gray-600 dark:text-slate-300"
              }`}
            >
              <span className="text-lg leading-3">{icon}</span>
              <span className="mt-1">{tab}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* 🎯 Floating Action Button (mobile quick add) */}
      <div className="sm:hidden fixed right-4 bottom-20 z-40">
        <div className="relative">
          <button
            onClick={() => {
              const menu = document.getElementById("fab-menu");
              if (menu) menu.classList.toggle("hidden");
            }}
            className="w-14 h-14 rounded-full shadow-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-2xl flex items-center justify-center"
          >
            ＋
          </button>
          <div id="fab-menu" className="hidden absolute bottom-16 right-0 space-y-2">
            <button
              onClick={() => {
                setShowExpenseModal(true);
                document.getElementById("fab-menu")?.classList.add("hidden");
              }}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 shadow border dark:border-slate-700 text-sm"
            >
              ➕ Add Expense
            </button>
            <button
              onClick={() => {
                setShowIncomeModal(true);
                document.getElementById("fab-menu")?.classList.add("hidden");
              }}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 shadow border dark:border-slate-700 text-sm"
            >
              ➕ Add Income
            </button>
          </div>
        </div>
      </div>

      {/* ---- Expense Modal ---- */}
      <AnimatePresence>
        {showExpenseModal && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowExpenseModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 12, opacity: 0 }}
              className="relative z-50 w-full max-w-md bg-white dark:bg-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl overflow-hidden mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 text-white">
                <h3 className="text-lg font-semibold">Add Expense</h3>
              </div>
              <div className="p-6 space-y-3">
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-rose-200/40 outline-none"
                  placeholder="Amount"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  inputMode="decimal"
                />
                <input
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-rose-200/40 outline-none"
                  placeholder="Partner"
                  value={newExpense.partner}
                  onChange={(e) => setNewExpense({ ...newExpense, partner: e.target.value })}
                />
                <input
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-rose-200/40 outline-none"
                  placeholder="Note"
                  value={newExpense.note}
                  onChange={(e) => setNewExpense({ ...newExpense, note: e.target.value })}
                />
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setShowExpenseModal(false)}
                    className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addExpense}
                    className="px-4 py-2 rounded-xl text-white bg-gradient-to-r from-rose-500 to-pink-500 hover:brightness-110 shadow"
                  >
                    Save Expense
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Income Modal ---- */}
      <AnimatePresence>
        {showIncomeModal && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowIncomeModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 12, opacity: 0 }}
              className="relative z-50 w-full max-w-md bg-white dark:bg-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl overflow-hidden mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white">
                <h3 className="text-lg font-semibold">Add Income</h3>
              </div>
              <div className="p-6 space-y-3">
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-emerald-200/40 outline-none"
                  placeholder="Amount"
                  value={newIncome.amount}
                  onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })}
                  inputMode="decimal"
                />
                <input
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-emerald-200/40 outline-none"
                  placeholder="Partner"
                  value={newIncome.partner}
                  onChange={(e) => setNewIncome({ ...newIncome, partner: e.target.value })}
                />
                <input
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-emerald-200/40 outline-none"
                  placeholder="Note"
                  value={newIncome.note}
                  onChange={(e) => setNewIncome({ ...newIncome, note: e.target.value })}
                />
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setShowIncomeModal(false)}
                    className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addIncome}
                    className="px-4 py-2 rounded-xl text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 shadow"
                  >
                    Save Income
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Confirm Delete Modal ---- */}
      <AnimatePresence>
        {confirm.open && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setConfirm({ open: false, type: null, id: null, name: "" })}
            />
            <motion.div
              initial={{ scale: 0.95, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 12, opacity: 0 }}
              className="relative z-[70] bg-white dark:bg-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl p-6 mx-4 w-full max-w-sm"
            >
              <h4 className="text-lg font-semibold mb-2">Delete item?</h4>
              <p className="text-sm text-gray-600 dark:text-slate-300 mb-4">
                This will permanently remove <span className="font-medium">{confirm.name}</span>.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirm({ open: false, type: null, id: null, name: "" })}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                >
                  Cancel
                </button>
                <button
                  onClick={doDelete}
                  className="px-4 py-2 rounded-xl text-white bg-rose-500 hover:bg-rose-600 shadow"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Lightbox ---- */}
      <AnimatePresence>
        {lightbox.open && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox({ open: false, url: "", meta: "" })}
          >
            <motion.div
              initial={{ scale: 0.98, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, y: 10, opacity: 0 }}
              className="max-w-[90vw] max-h-[80vh] p-2 bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightbox.url}
                alt="Receipt"
                className="max-h-[70vh] object-contain rounded-lg"
              />
              <div className="mt-2 text-sm">{lightbox.meta}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toasts */}
      <Toast toasts={toasts} remove={removeToast} />
    </div>
  );
}

/* -------------------------------------
   Pretty stat card
------------------------------------- */
function StatCard({ label, color, valueAnim }) {
  const colors = {
    red: "border-red-400 text-red-500 dark:text-red-300",
    green: "border-green-400 text-green-500 dark:text-green-300",
    indigo: "border-indigo-400 text-indigo-600 dark:text-indigo-300",
    rose: "border-rose-400 text-rose-600 dark:text-rose-300",
  };
  const cls = colors[color] || colors.indigo;

  return (
    <motion.div
      layout
      className={`bg-white/90 dark:bg-slate-800/90 dark:border-slate-700 rounded-2xl p-6 shadow-lg border-t-4 ${cls} border-opacity-70`}
      whileHover={{ y: -4 }}
    >
      <h3 className="text-sm text-gray-500 dark:text-slate-300 mb-2">{label}</h3>
      <motion.div className="text-3xl font-extrabold">
        {valueAnim && (
          <motion.span>
            {valueAnim
              .get()
              .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </motion.span>
        )}
      </motion.div>
    </motion.div>
  );
}

/* -------------------------------------
   Animated gradient blobs backdrop
------------------------------------- */
function GradientNebula() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute -top-10 -left-10 w-72 h-72 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle at center, #a78bfa55, transparent 70%)" }}
        animate={{ x: [0, 40, -20, 0], y: [0, 20, -30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/3 -right-10 w-80 h-80 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle at center, #fb718555, transparent 70%)" }}
        animate={{ x: [0, -30, 20, 0], y: [0, -20, 30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 w-96 h-96 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle at center, #60a5fa55, transparent 70%)" }}
        animate={{ x: [0, 30, -10, 0], y: [0, 20, -20, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/* ------------------------------------- */
export default App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
