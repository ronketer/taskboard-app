import { useState, useEffect } from "react";
import api from "../api/axios";

export default function useQuote() {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/quotes/today")
      .then(({ data }) => setQuote(data))
      .catch(() => setQuote(null))
      .finally(() => setLoading(false));
  }, []);

  return { quote, loading };
}
