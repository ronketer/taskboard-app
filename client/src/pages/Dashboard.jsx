import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import TodoForm from "../components/TodoForm";
import TodoItem from "../components/TodoItem";

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
      await api.post("/todos", { title });
      fetchTodos(page);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to add todo");
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/todos/${id}`);
      fetchTodos(page);
    } catch {
      setError("Failed to delete todo");
    }
  }

  async function handleEdit(id, title, description) {
    try {
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
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">My Todos</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600"
          >
            Logout
          </button>
        </div>

        {error && <p className="mb-4 text-red-500 text-sm">{error}</p>}

        <TodoForm onAdd={handleAdd} />

        <div className="space-y-2">
          {loading ? (
            <p className="text-center text-gray-400 py-8">Loading...</p>
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
                <p className="text-center text-gray-400 py-8">
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
              className="px-4 py-2 rounded bg-white border hover:bg-gray-100 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-gray-600">
              Page {page} of {pageCount}
            </span>
            <button
              onClick={() => fetchTodos(page + 1)}
              disabled={page === pageCount}
              className="px-4 py-2 rounded bg-white border hover:bg-gray-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
