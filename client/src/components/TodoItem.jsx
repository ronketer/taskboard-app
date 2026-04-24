import { useState } from "react";
import { TextInput, Textarea, Button, Group, Card, Stack, Text, Checkbox } from "@mantine/core";

export default function TodoItem({ todo, onDelete, onEdit, onToggleComplete }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description ?? "");

  async function handleSave() {
    if (title.trim().length < 3) return;
    await onEdit(todo.id, title.trim(), description.trim());
    setEditing(false);
  }

  return (
    <Card withBorder p="md" radius="md" mb="sm">
      {editing ? (
        <Stack gap="md">
          <TextInput
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            minLength={3}
            maxLength={50}
            placeholder="Title (3–50 chars)"
          />
          <Textarea
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={2}
          />
          <Group justify="flex-end">
            <Button
              variant="light"
              onClick={() => {
                setTitle(todo.title);
                setDescription(todo.description ?? "");
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
            >
              Save
            </Button>
          </Group>
        </Stack>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <Checkbox
                mt={3}
                checked={todo.completed ?? false}
                onChange={() => onToggleComplete(todo.id, !todo.completed)}
              />
              <div>
                <Text
                  fw={600}
                  size="md"
                  td={todo.completed ? "line-through" : undefined}
                  c={todo.completed ? "dimmed" : undefined}
                >
                  {todo.title}
                </Text>
                {todo.description && (
                  <Text size="sm" c="dimmed" mt={4}>{todo.description}</Text>
                )}
              </div>
            </div>
            <Group gap="xs" ml="md">
              <Button
                variant="light"
                size="xs"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
              <Button
                variant="light"
                color="red"
                size="xs"
                onClick={() => {
                  if (window.confirm(`Delete "${todo.title}"?`)) {
                    onDelete(todo.id);
                  }
                }}
              >
                Delete
              </Button>
            </Group>
          </div>
        </>
      )}
    </Card>
  );
}
