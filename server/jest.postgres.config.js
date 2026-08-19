module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/boards.test.js',
    '<rootDir>/tests/board-todos.test.js',
    '<rootDir>/tests/postgres-db.test.js',
  ],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  setupFilesAfterEnv: ['./tests/postgres.setup.js'],
  testTimeout: 30000,
  verbose: true,
  bail: false,
  detectOpenHandles: true,
};
