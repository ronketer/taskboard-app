import { useState } from "react";

export default function TodoForm({ onAdd }) {
  const [title, setTitle] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (title.trim().length < 3) return;
    await onAdd(title.trim());
    setTitle("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to be done? (min 3 characters)"
        className="flex-1 border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        minLength={3}
        maxLength={50}
      />
      <button
        type="submit"
        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors duration-200 font-semibold"
      >
        Add
      </button>
    </form>
  );
}
