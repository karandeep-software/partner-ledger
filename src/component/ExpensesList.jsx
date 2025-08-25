import React, { useState } from "react";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import EditExpenseModal from "./EditExpenseModal";

function ExpensesList({ expenses, refresh }) {
  const [editingExpense, setEditingExpense] = useState(null);

  const deleteExpense = async (id) => {
    await deleteDoc(doc(db, "expenses", id));
    refresh();
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Expenses</h2>
      <ul className="space-y-2">
        {expenses.map((expense) => (
          <li
            key={expense.id}
            className="flex justify-between items-center bg-white p-3 rounded shadow"
          >
            <div>
              <p>
                <strong>{expense.partner}</strong> - ${expense.amount}
              </p>
              <p className="text-sm text-gray-500">{expense.note}</p>
            </div>
            <div className="space-x-2">
              <button
                onClick={() => setEditingExpense(expense)}
                className="bg-yellow-500 text-white px-2 py-1 rounded"
              >
                Edit
              </button>
              <button
                onClick={() => deleteExpense(expense.id)}
                className="bg-red-500 text-white px-2 py-1 rounded"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          closeModal={() => setEditingExpense(null)}
          refresh={refresh}
        />
      )}
    </div>
  );
}

export default ExpensesList;
