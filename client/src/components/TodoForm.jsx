import { useState } from "react";
import { TextInput, Button, Group } from "@mantine/core";

export default function TodoForm({ onAdd }) {
  const [title, setTitle] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (title.trim().length < 3) return;
    await onAdd(title.trim());
    setTitle("");
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <Group gap="md" grow>
        <TextInput
          placeholder="What needs to be done? (min 3 characters)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          minLength={3}
          maxLength={50}
          required
        />
        <Button type="submit">
          Add
        </Button>
      </Group>
    </form>
  );
}
