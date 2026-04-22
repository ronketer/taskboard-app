const request = require('supertest');
const app = require('../app');
const { resetCache } = require('../controllers/quotes');

describe('GET /api/v1/quotes/today', () => {
  let originalFetch;

  beforeEach(() => {
    resetCache();
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should fetch from ZenQuotes and return quote + author', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve([{ q: 'Be present.', a: 'Zen Master' }]),
    });

    const res = await request(app).get('/api/v1/quotes/today');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ quote: 'Be present.', author: 'Zen Master' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('https://zenquotes.io/api/today');
  });

  it('should return cached quote without re-fetching', async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve([{ q: 'Be still.', a: 'Zen' }]),
    });

    await request(app).get('/api/v1/quotes/today');
    await request(app).get('/api/v1/quotes/today');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
