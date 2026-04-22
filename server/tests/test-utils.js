/**
 * Test Utilities & Helpers
 * 
 * This file contains reusable test utilities and constants used across
 * the test suite. This demonstrates best practices in test organization.
 * 
 * QA Focus: Demonstrates test maintainability and code reusability.
 */

/**
 * Valid test data for successful operations
 * Used in positive test cases (happy path testing)
 */
const validUserData = {
  name: 'Test User',
  email: 'testuser@example.com',
  password: 'SecurePassword123!',
};

/**
 * Valid test data for todo creation
 * Used to test successful todo operations
 */
const validTodoData = {
  title: 'Sample Todo Task',
  description: 'This is a test todo item',
};

/**
 * Invalid email formats for testing validation
 * Used in negative test cases to ensure email validation works
 */
const invalidEmails = [
  'notanemail',
  'missing@domain',
  '@nodomain.com',
  'spaces in@email.com',
  '',
  'null',
];

/**
 * XSS (Cross-Site Scripting) attack payloads for security testing
 * Used to verify that the API properly sanitizes user input
 * and prevents script injection attacks
 */
const xssPayloads = [
  '<script>alert("xss")</script>',
  '"><script>alert(String.fromCharCode(88,83,83))</script>',
  'javascript:alert("xss")',
  '<img src=x onerror="alert(\'xss\')">',
  '<svg onload="alert(\'xss\')">',
];

/**
 * SQL Injection test payloads
 * Used to verify that the API safely handles SQL-like input
 * Note: Modern ORMs like Mongoose prevent this, but good to test
 */
const sqlInjectionPayloads = [
  "'; DROP TABLE users; --",
  "1' OR '1'='1",
  "admin'--",
  "1; DELETE FROM todos;",
];

/**
 * Test helper: Check if response contains error message
 * @param {Object} response - Supertest response object
 * @returns {boolean} True if response contains error
 */
const isErrorResponse = (response) => {
  return (
    response.statusCode >= 400 ||
    (response.body && response.body.error) ||
    (response.body && response.body.message)
  );
};

/**
 * Test helper: Check if response indicates successful creation
 * @param {Object} response - Supertest response object
 * @returns {boolean} True if response indicates success
 */
const isSuccessResponse = (response) => {
  return response.statusCode >= 200 && response.statusCode < 300;
};

/**
 * Test helper: Get valid JWT token (placeholder)
 * In real tests, this would register a user and get actual token
 * @returns {string} Mock JWT token
 */
const getValidToken = () => {
  return 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';
};

/**
 * Test helper: Validate response structure
 * Used to ensure API responses follow expected format
 * @param {Object} response - Supertest response object
 * @returns {boolean} True if response has expected structure
 */
const hasValidResponseStructure = (response) => {
  return (
    response.body &&
    (response.body.success !== undefined ||
      response.body.data !== undefined ||
      response.body.error !== undefined)
  );
};

module.exports = {
  validUserData,
  validTodoData,
  invalidEmails,
  xssPayloads,
  sqlInjectionPayloads,
  isErrorResponse,
  isSuccessResponse,
  getValidToken,
  hasValidResponseStructure,
};
