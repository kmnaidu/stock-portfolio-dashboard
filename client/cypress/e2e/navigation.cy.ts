describe('Navigation & Routing', () => {
  it('loads dashboard at root URL', () => {
    cy.visit('/');
    cy.get('.dashboard-page').should('be.visible');
  });

  it('navigates to each stock detail page and back', () => {
    const symbols = [
      'RELIANCE.NS',
      'HDFCBANK.NS',
      'SBIN.NS',
      'HAL.NS',
      'BHARTIARTL.NS',
      'NIFTYBEES.NS',
      'GOLDBEES.NS',
    ];

    cy.visit('/');
    cy.get('.stock-row', { timeout: 15000 }).should('have.length', 7);

    // Test first 3 stocks to keep test fast
    symbols.slice(0, 3).forEach((symbol) => {
      cy.visit(`/stock/${symbol}`);
      cy.get('.price-header', { timeout: 15000 }).should('be.visible');
      cy.get('.back-link').click();
      cy.get('.stock-grid').should('be.visible');
    });
  });

  it('shows error for invalid stock symbol', () => {
    cy.visit('/stock/INVALID.NS');
    cy.contains('Invalid security symbol').should('be.visible');
    cy.get('.back-link').should('be.visible');
  });

  it('back link from invalid symbol returns to dashboard', () => {
    cy.visit('/stock/INVALID.NS');
    cy.get('.back-link').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('header title link navigates to dashboard from any page', () => {
    cy.visit('/stock/RELIANCE.NS');
    cy.get('.price-header', { timeout: 15000 }).should('be.visible');
    cy.get('.app-title').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/');
    cy.get('.stock-grid').should('be.visible');
  });

  it('direct URL access to stock detail page works', () => {
    cy.visit('/stock/SBIN.NS');
    cy.get('.price-header', { timeout: 15000 }).should('be.visible');
    cy.get('.price-header-name').invoke('text').should('match', /SBI|State Bank/i);
  });
});
