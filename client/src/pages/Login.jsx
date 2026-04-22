import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/auth/login", form);
      login(data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.msg || "Login failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-xl shadow-xl ring-1 ring-black/5 w-full max-w-sm space-y-4"
      >
        <p className="text-2xl font-bold text-indigo-600 mb-6 text-center tracking-tight">✓ Todo</p>
        <h1 className="text-2xl font-bold text-center">Login</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition-colors duration-200 font-semibold"
        >
          Login
        </button>
        <p className="text-center text-sm">
          No account?{" "}
          <Link to="/register" className="text-indigo-600 hover:text-indigo-800">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
