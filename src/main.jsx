import "./index.css";
import { motion, AnimatePresence } from "framer-motion";
import React, { useState, useEffect } from "react";
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

// ✅ Firebase config
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

function App() {
  // 🔑 Auth state
  const [user, setUser] = useState(null);
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [isRegistering, setIsRegistering] = useState(false);

  // Data state
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);

  // Modal form state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [newExpense, setNewExpense] = useState({ amount: "", partner: "", note: "" });
  const [newIncome, setNewIncome] = useState({ amount: "", partner: "", note: "" });

  // UI state
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [showRoadmap, setShowRoadmap] = useState(false);

  // Derived totals
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalIncomes = incomes.reduce((sum, i) => sum + (i.amount || 0), 0);
  const balance = totalIncomes - totalExpenses;

  // Roadmap dates
  const now = new Date();
  const fmt = (d) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const oneMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const twoMonths = new Date(now.getFullYear(), now.getMonth() + 2, now.getDate());
  const threeMonths = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());

  // ✅ Listen for auth changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // ✅ Fetch expenses
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "expenses"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) =>
      setExpenses(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [user]);

  // ✅ Fetch incomes
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "incomes"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) =>
      setIncomes(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [user]);

  // Auth actions
  const handleAuth = async () => {
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
    } catch (err) {
      alert(err.message);
    }
  };
  const handleLogout = async () => {
    await signOut(auth);
  };

  // Add expense / income
  const addExpense = async () => {
    if (!newExpense.amount || !newExpense.partner) return;
    await addDoc(collection(db, "expenses"), {
      ...newExpense,
      amount: parseFloat(newExpense.amount),
      createdAt: serverTimestamp(),
      receiptUrl: null,
    });
    setNewExpense({ amount: "", partner: "", note: "" });
    setShowExpenseModal(false);
  };

  const addIncome = async () => {
    if (!newIncome.amount || !newIncome.partner) return;
    await addDoc(collection(db, "incomes"), {
      ...newIncome,
      amount: parseFloat(newIncome.amount),
      createdAt: serverTimestamp(),
      receiptUrl: null,
    });
    setNewIncome({ amount: "", partner: "", note: "" });
    setShowIncomeModal(false);
  };

  // Upload receipt
  const uploadReceipt = async (id, type, file) => {
    if (!file) return;
    const storageRef = ref(storage, `${type}/${id}-${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await updateDoc(doc(db, type, id), { receiptUrl: url });
    alert("✅ Receipt uploaded!");
  };

  const deleteExpense = async (id) => await deleteDoc(doc(db, "expenses", id));
  const deleteIncome = async (id) => await deleteDoc(doc(db, "incomes", id));

  // ✅ Not logged in → login/signup
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fuchsia-100 via-rose-100 to-amber-100 flex items-center justify-center">
        <div className="bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white">
          <h1 className="text-3xl font-extrabold text-center mb-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            {isRegistering ? "Create an Account" : "Welcome Back"}
          </h1>
          <input
            type="email"
            className="w-full mb-3 px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-purple-300 outline-none"
            placeholder="Email"
            value={authForm.email}
            onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
          />
          <input
            type="password"
            className="w-full mb-4 px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-purple-300 outline-none"
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
            className="mt-4 text-sm text-center text-gray-600 cursor-pointer hover:underline"
            onClick={() => setIsRegistering(!isRegistering)}
          >
            {isRegistering ? "Already have an account? Login" : "Don't have an account? Sign Up"}
          </p>
        </div>
      </div>
    );
  }

  // ✅ Logged in → dashboard
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-indigo-50 via-pink-50 to-amber-50">
      {/* 🔹 Navbar */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg">
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur" />
            <h1 className="text-xl font-bold tracking-wide">Partner Ledger</h1>
          </div>

          <nav className="flex gap-2">
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

          <div className="flex items-center gap-3">
            <span className="text-white/90 text-sm font-semibold hidden sm:block">{user?.email}</span>
            <div className="w-10 h-10 rounded-full bg-white/30 border border-white/40" />
            <button
              onClick={handleLogout}
              className="ml-2 bg-white text-pink-600 px-4 py-2 rounded-full font-semibold hover:bg-pink-50 shadow"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* 🔹 Main Content */}
      <main className="flex-1 p-8">
        {/* ---- Dashboard ---- */}
        {activeTab === "Dashboard" && (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">📑 Dashboard</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Total Expenses */}
              <motion.div
                layout
                className="bg-white rounded-2xl p-6 shadow-lg border-t-4 border-red-400"
                whileHover={{ y: -4 }}
              >
                <h3 className="text-sm text-gray-500 mb-2">Total Expenses</h3>
                <p className="text-3xl font-extrabold text-red-500">₹{totalExpenses.toFixed(2)}</p>
              </motion.div>

              {/* Total Incomes */}
              <motion.div
                layout
                className="bg-white rounded-2xl p-6 shadow-lg border-t-4 border-green-400"
                whileHover={{ y: -4 }}
              >
                <h3 className="text-sm text-gray-500 mb-2">Total Incomes</h3>
                <p className="text-3xl font-extrabold text-green-500">₹{totalIncomes.toFixed(2)}</p>
              </motion.div>

              {/* Balance */}
              <motion.div
                layout
                className="bg-white rounded-2xl p-6 shadow-lg border-t-4 border-indigo-400"
                whileHover={{ y: -4 }}
              >
                <h3 className="text-sm text-gray-500 mb-2">Balance</h3>
                <p className={`text-3xl font-extrabold ${balance >= 0 ? "text-indigo-600" : "text-rose-600"}`}>
                  ₹{balance.toFixed(2)}
                </p>
              </motion.div>

              {/* Progress + Roadmap */}
              <div
                className="relative bg-white rounded-2xl p-6 shadow-lg flex flex-col items-center justify-center"
                onMouseEnter={() => setShowRoadmap(true)}
                onMouseLeave={() => setShowRoadmap(false)}
              >
                <div className="w-20 h-20">
                  <CircularProgressbar
                    value={35}
                    text={`35%`}
                    styles={buildStyles({
                      pathColor: "#8b5cf6",
                      textColor: "#8b5cf6",
                      trailColor: "#e5e7eb",
                    })}
                  />
                </div>
                <span className="mt-2 text-sm font-medium text-gray-600">App Progress</span>

                {/* Hover Roadmap */}
                <AnimatePresence>
                  {showRoadmap && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 12 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full mt-3 w-80 bg-white rounded-xl shadow-2xl border p-4 text-left z-50"
                    >
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">📅 Roadmap</h3>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li>
                          <span className="font-medium text-purple-600">{fmt(twoWeeks)}:</span>{" "}
                          Error fixed in uploading receipts ✅
                        </li>
                        <li>
                          <span className="font-medium text-green-600">{fmt(oneMonth)}:</span>{" "}
                          Export to Excel/PDF 📊
                        </li>
                        <li>
                          <span className="font-medium text-blue-600">{fmt(twoMonths)}:</span>{" "}
                          Mobile UI + Dark Mode 🌙
                        </li>
                        <li>
                          <span className="font-medium text-pink-600">{fmt(threeMonths)}:</span>{" "}
                          AI spending insights 🤖
                        </li>
                        <li>
                          <span className="font-medium text-amber-600">Future:</span>{" "}
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
        {activeTab === "Expenses" && (
          <section className="bg-white/90 backdrop-blur p-6 rounded-2xl shadow-lg mt-8 border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">💸 Expenses</h2>
              <button
                onClick={() => setShowExpenseModal(true)}
                className="bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 text-white px-4 py-2 rounded-xl shadow hover:brightness-110"
              >
                + Add Expense
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="text-left p-3 border-b">Amount</th>
                    <th className="text-left p-3 border-b">Partner</th>
                    <th className="text-left p-3 border-b">Note</th>
                    <th className="text-left p-3 border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-gray-50 transition">
                      <td className="p-3">₹{Number(exp.amount).toFixed(2)}</td>
                      <td className="p-3">{exp.partner}</td>
                      <td className="p-3">{exp.note}</td>
                      <td className="p-3 space-x-2">
                        <label className="cursor-pointer bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg hover:bg-indigo-100 border border-indigo-200">
                          Upload Receipt
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => uploadReceipt(exp.id, "expenses", e.target.files[0])}
                          />
                        </label>
                        {exp.receiptUrl && (
                          <a
                            href={exp.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-green-500 text-white px-3 py-1 rounded-lg hover:bg-green-600"
                          >
                            View
                          </a>
                        )}
                        <button
                          className="bg-rose-500 text-white px-3 py-1 rounded-lg hover:bg-rose-600"
                          onClick={() => deleteExpense(exp.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td className="p-4 text-gray-500" colSpan={4}>
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
        {activeTab === "Incomes" && (
          <section className="bg-white/90 backdrop-blur p-6 rounded-2xl shadow-lg mt-8 border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">💵 Incomes</h2>
              <button
                onClick={() => setShowIncomeModal(true)}
                className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white px-4 py-2 rounded-xl shadow hover:brightness-110"
              >
                + Add Income
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="text-left p-3 border-b">Amount</th>
                    <th className="text-left p-3 border-b">Partner</th>
                    <th className="text-left p-3 border-b">Note</th>
                    <th className="text-left p-3 border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.map((inc) => (
                    <tr key={inc.id} className="hover:bg-gray-50 transition">
                      <td className="p-3">₹{Number(inc.amount).toFixed(2)}</td>
                      <td className="p-3">{inc.partner}</td>
                      <td className="p-3">{inc.note}</td>
                      <td className="p-3 space-x-2">
                        <label className="cursor-pointer bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg hover:bg-indigo-100 border border-indigo-200">
                          Upload Receipt
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => uploadReceipt(inc.id, "incomes", e.target.files[0])}
                          />
                        </label>
                        {inc.receiptUrl && (
                          <a
                            href={inc.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-green-500 text-white px-3 py-1 rounded-lg hover:bg-green-600"
                          >
                            View
                          </a>
                        )}
                        <button
                          className="bg-rose-500 text-white px-3 py-1 rounded-lg hover:bg-rose-600"
                          onClick={() => deleteIncome(inc.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {incomes.length === 0 && (
                    <tr>
                      <td className="p-4 text-gray-500" colSpan={4}>
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
        {activeTab === "Receipts" && (
          <section className="bg-white p-6 rounded-2xl shadow-lg mt-8 border">
            <h2 className="text-xl font-semibold mb-4">📷 Uploaded Receipts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {[...expenses, ...incomes]
                .filter((item) => item.receiptUrl)
                .map((item) => (
                  <motion.div
                    key={item.id}
                    whileHover={{ scale: 1.02 }}
                    className="p-4 border rounded-xl shadow-sm bg-gray-50"
                  >
                    <img
                      src={item.receiptUrl}
                      alt="Receipt"
                      className="w-full h-48 object-cover rounded-lg mb-3"
                    />
                    <p className="font-medium text-gray-800">
                      {item.partner} — ₹{Number(item.amount).toFixed(2)}
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
                <p className="text-gray-500">No receipts uploaded yet.</p>
              )}
            </div>
          </section>
        )}
      </main>

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
              className="relative z-50 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 text-white">
                <h3 className="text-lg font-semibold">Add Expense</h3>
              </div>
              <div className="p-6 space-y-3">
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-rose-200 outline-none"
                  placeholder="Amount"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                />
                <input
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-rose-200 outline-none"
                  placeholder="Partner"
                  value={newExpense.partner}
                  onChange={(e) => setNewExpense({ ...newExpense, partner: e.target.value })}
                />
                <input
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-rose-200 outline-none"
                  placeholder="Note"
                  value={newExpense.note}
                  onChange={(e) => setNewExpense({ ...newExpense, note: e.target.value })}
                />
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setShowExpenseModal(false)}
                    className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
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
              className="relative z-50 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white">
                <h3 className="text-lg font-semibold">Add Income</h3>
              </div>
              <div className="p-6 space-y-3">
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-emerald-200 outline-none"
                  placeholder="Amount"
                  value={newIncome.amount}
                  onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })}
                />
                <input
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-emerald-200 outline-none"
                  placeholder="Partner"
                  value={newIncome.partner}
                  onChange={(e) => setNewIncome({ ...newIncome, partner: e.target.value })}
                />
                <input
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-emerald-200 outline-none"
                  placeholder="Note"
                  value={newIncome.note}
                  onChange={(e) => setNewIncome({ ...newIncome, note: e.target.value })}
                />
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setShowIncomeModal(false)}
                    className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
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
    </div>
  );
}

export default App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
