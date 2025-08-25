import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

function EditExpenseModal({ expense, closeModal, refresh }) {
  const [partner, setPartner] = useState(expense.partner);
  const [amount, setAmount] = useState(expense.amount);
  const [note, setNote] = useState(expense.note);

  const updateExpense = async (e) => {
    e.preventDefault();
    const expenseRef = doc(db, "expenses", expense.id);
    await updateDoc(expenseRef, { partner, amount: Number(amount), note });
    closeModal();
    refresh();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded shadow w-96">
        <h2 className="text-xl mb-4">Edit Expense</h2>
        <form onSubmit={updateExpense} className="space-y-2">
          <input
            type="text"
            value={partner}
            onChange={(e) => setPartner(e.target.value)}
            className="border rounded px-2 py-1 w-full"
          />
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="border rounded px-2 py-1 w-full"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="border rounded px-2 py-1 w-full"
          />
          <div className="flex justify-end space-x-2">
            <button type="button" onClick={closeModal} className="px-3 py-1 rounded border">
              Cancel
            </button>
            <button type="submit" className="bg-blue-500 text-white px-3 py-1 rounded">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditExpenseModal;
