import { useState } from "react";

export default function TodoItem({ todo, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description ?? "");

  async function handleSave() {
    if (title.trim().length < 3) return;
    await onEdit(todo.id, title.trim(), description.trim());
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg bg-white">
      {editing ? (
        <>
          <div className="flex-1 flex flex-col gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
              minLength={3}
              maxLength={50}
              placeholder="Title (3–50 chars)"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              rows={2}
              placeholder="Description (optional)"
            />
          </div>
          <button
            onClick={handleSave}
            className="text-green-600 hover:text-green-800 text-sm font-medium"
          >
            Save
          </button>
          <button
            onClick={() => {
              setTitle(todo.title);
              setDescription(todo.description ?? "");
              setEditing(false);
            }}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <span className="flex-1">{todo.title}</span>
          {todo.description && (
            <span className="text-sm text-gray-400 truncate max-w-xs">
              {todo.description}
            </span>
          )}
          <button
            onClick={() => setEditing(true)}
            className="text-blue-500 hover:text-blue-700 text-sm font-medium"
          >
            Edit
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Delete "${todo.title}"?`)) {
                onDelete(todo.id);
              }
            }}
            className="text-red-500 hover:text-red-700 text-sm font-medium"
          >
            Delete
          </button>
        </>
      )}
    </div>
  );
}
