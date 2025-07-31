module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'services/**/*.js',
    'utils/**/*.js',
    '!services/llm.js', // Exclude LLM service from coverage
    '!**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
