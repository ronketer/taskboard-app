let cache = { quote: null, author: null, fetchedAt: 0 };

function resetCache() {
  cache = { quote: null, author: null, fetchedAt: 0 };
}

async function getTodayQuote(req, res) {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  if (cache.fetchedAt && now - cache.fetchedAt < oneDay) {
    return res.json({ quote: cache.quote, author: cache.author });
  }

  try {
    const response = await fetch('https://zenquotes.io/api/today');
    const [data] = await response.json();
    cache = { quote: data.q, author: data.a, fetchedAt: now };
    res.json({ quote: cache.quote, author: cache.author });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch quote' });
  }
}

module.exports = { getTodayQuote, resetCache };
