// Cypress E2E support file
// Add custom commands or global hooks here

// Prevent uncaught exceptions from failing tests
// (Yahoo Finance API errors in the background shouldn't break UI tests)
Cypress.on('uncaught:exception', () => false);
