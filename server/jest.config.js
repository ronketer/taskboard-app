module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/tests/**/*.test.js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // THE FIX: Only measure coverage in these specific folders!
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'models/**/*.js',
    'routes/**/*.js'
  ],
  
  forceExit: true,
  detectOpenHandles: true,
  testTimeout: 30000,
  verbose: true,
  bail: false,
  
  // Our 80% enforcement
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};