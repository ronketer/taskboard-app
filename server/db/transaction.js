const db = require('./pool');

const withTransaction = async (work) => {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    if (typeof client.release === 'function') {
      client.release();
    }
  }
};

module.exports = { withTransaction };
