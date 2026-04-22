import { Card, Text, Group, Badge, Anchor } from "@mantine/core";
import useQuote from "../hooks/useQuote";

export default function QuoteCard() {
  const { quote, loading } = useQuote();

  if (loading || !quote) return null;

  return (
    <Card withBorder shadow="sm" radius="md" mb="lg" p="lg" bg="indigo.0">
      <Text size="lg" fw={500} mb="md" c="indigo.9" style={{ fontStyle: "italic", lineHeight: 1.6 }}>
        "{quote.quote}"
      </Text>
      <Group justify="space-between" align="flex-end">
        <Text size="sm" fw={600} c="indigo.7">
          — {quote.author}
        </Text>
        <Badge size="sm" variant="light">
          Daily Quote
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" mt="md">
        Inspirational quotes provided by{" "}
        <Anchor href="https://zenquotes.io/" target="_blank" rel="noreferrer" size="xs">
          ZenQuotes API
        </Anchor>
      </Text>
    </Card>
  );
}
