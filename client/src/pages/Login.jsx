import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TextInput, PasswordInput, Button, Card, Title, Text, Alert, Container, Stack } from "@mantine/core";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", form);
      login(data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.msg || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container size="sm" py="xl">
      <Card withBorder shadow="md" p="xl" radius="lg">
        <div className="text-center mb-6">
          <Text size="lg" fw={700} c="indigo">✓ Todo</Text>
        </div>
        <Title order={2} ta="center" mb="lg">Login</Title>

        {error && (
          <Alert color="red" mb="md">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Email"
              placeholder="Enter your email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <Button type="submit" fullWidth loading={loading}>
              Login
            </Button>
          </Stack>
        </form>

        <Text ta="center" size="sm" mt="md">
          No account?{" "}
          <Link to="/register" className="text-indigo-600 hover:text-indigo-800 font-medium">
            Register
          </Link>
        </Text>
      </Card>
    </Container>
  );
}
