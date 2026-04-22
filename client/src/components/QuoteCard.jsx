import useQuote from "../hooks/useQuote";

export default function QuoteCard() {
  const { quote, loading } = useQuote();

  if (loading || !quote) return null;

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
      <p className="text-slate-700 italic text-sm leading-relaxed">
        "{quote.quote}"
      </p>
      <p className="text-slate-500 text-xs mt-2 font-medium">
        — {quote.author}
      </p>
      <p className="text-slate-400 text-xs mt-3">
        Inspirational quotes provided by{" "}
        <a
          href="https://zenquotes.io/"
          target="_blank"
          rel="noreferrer"
          className="text-indigo-500 hover:text-indigo-700"
        >
          ZenQuotes API
        </a>
      </p>
    </div>
  );
}
