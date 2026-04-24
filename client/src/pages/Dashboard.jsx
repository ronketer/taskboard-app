import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Title, Button, Alert, Group, Center, Loader, Pagination, Stack, Text } from "@mantine/core";
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
      setTodos(data.data);
      setPageCount(data.pageCount);
      setPage(data.page);
    } catch {
      setError("Failed to load todos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await fetchTodos(1);
    })();
  }, []);

  async function handleAdd(title) {
    try {
      setError("");
      await api.post("/todos", { title });
      await fetchTodos(page);
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

  async function handleToggleComplete(id, completed) {
    try {
      setError("");
      await api.put(`/todos/${id}`, { completed });
      fetchTodos(page);
    } catch {
      setError("Failed to update todo");
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <Container size="md" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={1}>My Todos</Title>
        <Button
          variant="light"
          color="red"
          onClick={handleLogout}
        >
          Logout
        </Button>
      </Group>

      <QuoteCard />

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      <TodoForm onAdd={handleAdd} />

      {loading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : (
        <Stack gap="md">
          {todos.length > 0 ? (
            <>
              {todos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onToggleComplete={handleToggleComplete}
                />
              ))}
            </>
          ) : (
            <Center py="xl">
              <Text c="dimmed">No todos yet. Add one above!</Text>
            </Center>
          )}
        </Stack>
      )}

      {pageCount > 1 && (
        <Center mt="xl">
          <Group>
            <Text size="sm" c="dimmed">
              Page {page} of {pageCount}
            </Text>
            <Pagination value={page} onChange={fetchTodos} total={pageCount} />
          </Group>
        </Center>
      )}
    </Container>
  );
}
