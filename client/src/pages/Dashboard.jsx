import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Pagination,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import TodoForm from "../components/TodoForm";
import TodoItem from "../components/TodoItem";
import QuoteCard from "../components/QuoteCard";

export default function Dashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [boards, setBoards] = useState([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [newBoardName, setNewBoardName] = useState("");
  const [boardsLoading, setBoardsLoading] = useState(true);
  const [creatingBoard, setCreatingBoard] = useState(false);

  const [todos, setTodos] = useState([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedBoard = useMemo(
    () => boards.find((board) => String(board.id) === selectedBoardId),
    [boards, selectedBoardId]
  );

  const boardOptions = useMemo(
    () =>
      boards.map((board) => ({
        value: String(board.id),
        label: board.isPersonal ? `${board.name} (Personal)` : board.name,
      })),
    [boards]
  );

  const fetchTodos = useCallback(async (boardId, p = 1) => {
    if (!boardId) return;

    setLoading(true);
    try {
      const { data } = await api.get(`/boards/${boardId}/todos?p=${p}`);
      setTodos(data.data);
      setPageCount(data.pageCount);
      setPage(data.page);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to load todos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function fetchBoards() {
      setBoardsLoading(true);
      setError("");

      try {
        const { data } = await api.get("/boards");
        const fetchedBoards = data.boards ?? [];
        setBoards(fetchedBoards);

        const defaultBoard =
          fetchedBoards.find((board) => board.isPersonal) ?? fetchedBoards[0];

        setSelectedBoardId(defaultBoard ? String(defaultBoard.id) : "");
      } catch (err) {
        setError(err.response?.data?.msg || "Failed to load boards");
      } finally {
        setBoardsLoading(false);
      }
    }

    fetchBoards();
  }, []);

  useEffect(() => {
    if (!selectedBoardId) {
      setTodos([]);
      setPage(1);
      setPageCount(1);
      return;
    }

    setTodos([]);
    setPage(1);
    setPageCount(1);
    setError("");
    fetchTodos(selectedBoardId, 1);
  }, [selectedBoardId, fetchTodos]);

  async function handleCreateBoard(e) {
    e.preventDefault();

    const name = newBoardName.trim();
    if (!name) return;

    setCreatingBoard(true);
    setError("");

    try {
      const { data: board } = await api.post("/boards", { name });
      setBoards((current) => [...current, board]);
      setNewBoardName("");
      setSelectedBoardId(String(board.id));
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to create board");
    } finally {
      setCreatingBoard(false);
    }
  }

  async function handleAdd(title) {
    if (!selectedBoardId) return;

    try {
      setError("");
      await api.post(`/boards/${selectedBoardId}/todos`, { title });
      await fetchTodos(selectedBoardId, page);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to add todo");
    }
  }

  async function handleDelete(id) {
    if (!selectedBoardId) return;

    try {
      setError("");
      await api.delete(`/boards/${selectedBoardId}/todos/${id}`);
      await fetchTodos(selectedBoardId, page);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to delete todo");
    }
  }

  async function handleEdit(id, title, description) {
    if (!selectedBoardId) return;

    try {
      setError("");
      const body = { title };
      if (description) body.description = description;
      await api.put(`/boards/${selectedBoardId}/todos/${id}`, body);
      await fetchTodos(selectedBoardId, page);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to update todo");
    }
  }

  async function handleToggleComplete(id, completed) {
    if (!selectedBoardId) return;

    try {
      setError("");
      await api.put(`/boards/${selectedBoardId}/todos/${id}`, { completed });
      await fetchTodos(selectedBoardId, page);
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to update todo");
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <Container size="md" py="xl">
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={1}>Taskboard</Title>
          {selectedBoard && (
            <Text size="sm" c="dimmed">
              {selectedBoard.name} · {selectedBoard.role}
            </Text>
          )}
        </div>
        <Button variant="light" color="red" onClick={handleLogout}>
          Logout
        </Button>
      </Group>

      <QuoteCard />

      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      <Stack gap="sm" mb="xl">
        {boardsLoading ? (
          <Center py="sm">
            <Loader size="sm" />
          </Center>
        ) : (
          <>
            <Select
              label="Board"
              placeholder="Select a board"
              data={boardOptions}
              value={selectedBoardId || null}
              onChange={(value) => setSelectedBoardId(value ?? "")}
              searchable
              allowDeselect={false}
            />

            <form onSubmit={handleCreateBoard}>
              <Group align="flex-end">
                <TextInput
                  label="Create another board"
                  placeholder="Board name"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  maxLength={80}
                  style={{ flex: 1 }}
                />
                <Button
                  type="submit"
                  loading={creatingBoard}
                  disabled={!newBoardName.trim()}
                >
                  Create board
                </Button>
              </Group>
            </form>
          </>
        )}
      </Stack>

      {selectedBoardId ? (
        <>
          <TodoForm onAdd={handleAdd} />

          {loading ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : (
            <Stack gap="md">
              {todos.length > 0 ? (
                todos.map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onToggleComplete={handleToggleComplete}
                  />
                ))
              ) : (
                <Center py="xl">
                  <Text c="dimmed">
                    No todos on this board yet. Add one above!
                  </Text>
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
                <Pagination
                  value={page}
                  onChange={(nextPage) =>
                    fetchTodos(selectedBoardId, nextPage)
                  }
                  total={pageCount}
                />
              </Group>
            </Center>
          )}
        </>
      ) : (
        !boardsLoading && (
          <Center py="xl">
            <Text c="dimmed">Create a board to start adding todos.</Text>
          </Center>
        )
      )}
    </Container>
  );
}
