import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TextInput, PasswordInput, Button, Card, Title, Text, Alert, Container, Stack } from "@mantine/core";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", form);
      login(data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.msg || "Registration failed");
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
        <Title order={2} ta="center" mb="lg">Register</Title>

        {error && (
          <Alert color="red" mb="md">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Name"
              placeholder="Enter your name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
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
              Register
            </Button>
          </Stack>
        </form>

        <Text ta="center" size="sm" mt="md">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-600 hover:text-indigo-800 font-medium">
            Login
          </Link>
        </Text>
      </Card>
    </Container>
  );
}
