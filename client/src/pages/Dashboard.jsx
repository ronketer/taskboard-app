import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import TodoForm from "../components/TodoForm";
import TodoItem from "../components/TodoItem";
import QuoteCard from "../components/QuoteCard";

export default function Dashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [todos, setTodos] = useState([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchTodos(p = 1) {
    setLoading(true);
    try {
      const { data } = await api.get(`/todos?p=${p}`);
      setTodos(data.data); // backend returns { data: [...] }
      setPageCount(data.pageCount);
      setPage(data.page);
    } catch {
      setError("Failed to load todos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTodos(1);
  }, []);

  async function handleAdd(title) {
    try {
      setError("");
      await api.post("/todos", { title });
      fetchTodos(page);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to add todo");
    }
  }

  async function handleDelete(id) {
    try {
      setError("");
      await api.delete(`/todos/${id}`);
      fetchTodos(page);
    } catch {
      setError("Failed to delete todo");
    }
  }

  async function handleEdit(id, title, description) {
    try {
      setError("");
      const body = { title };
      if (description) body.description = description;
      await api.put(`/todos/${id}`, body);
      fetchTodos(page);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to update todo");
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-bold">My Todos</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors duration-200"
          >
            Logout
          </button>
        </div>

        <QuoteCard />

        {error && <p className="mb-4 text-red-500 text-sm">{error}</p>}

        <TodoForm onAdd={handleAdd} />

        <div className="space-y-2">
          {loading ? (
            <p className="text-center text-slate-400 py-8">Loading...</p>
          ) : (
            <>
              {todos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              ))}
              {todos.length === 0 && (
                <p className="text-center text-slate-400 py-8">
                  No todos yet. Add one above!
                </p>
              )}
            </>
          )}
        </div>

        {pageCount > 1 && (
          <div className="flex justify-center items-center gap-4 mt-6">
            <button
              onClick={() => fetchTodos(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors duration-200 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-slate-600">
              Page {page} of {pageCount}
            </span>
            <button
              onClick={() => fetchTodos(page + 1)}
              disabled={page === pageCount}
              className="px-4 py-2 rounded-lg bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors duration-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
