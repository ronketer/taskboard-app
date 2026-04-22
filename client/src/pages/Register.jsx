import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/auth/register", form);
      login(data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.msg || "Registration failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-xl shadow-xl ring-1 ring-black/5 w-full max-w-sm space-y-4"
      >
        <p className="text-2xl font-bold text-indigo-600 mb-6 text-center tracking-tight">✓ Todo</p>
        <h1 className="text-2xl font-bold text-center">Register</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input
          type="text"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
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
          Register
        </button>
        <p className="text-center text-sm">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-600 hover:text-indigo-800">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
