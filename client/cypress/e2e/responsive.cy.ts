describe('Responsive Layout', () => {
  describe('Mobile (320px)', () => {
    beforeEach(() => {
      cy.viewport(320, 568);
      cy.visit('/');
      cy.get('.portfolio-summary-card', { timeout: 15000 }).should('be.visible');
    });

    it('header is visible and readable', () => {
      cy.get('.app-header').should('be.visible');
      cy.contains('Stock Portfolio Dashboard').should('be.visible');
    });

    it('portfolio summary stacks vertically', () => {
      cy.get('.portfolio-summary-card').should('be.visible');
      // On mobile, flex-direction is column
      cy.get('.portfolio-summary-card').should('have.css', 'flex-direction', 'column');
    });

    it('stock grid hides the table header (card layout)', () => {
      cy.get('.stock-grid thead').should('not.be.visible');
    });

    it('stock rows are displayed as cards', () => {
      cy.get('.stock-row').first().should('be.visible');
      // Cards should have border-radius on mobile
      cy.get('.stock-row').first().should('have.css', 'border-radius', '8px');
    });

    it('navigates to detail page on card tap', () => {
      cy.get('.stock-row').first().click();
      cy.url().should('include', '/stock/');
      cy.get('.price-header').should('be.visible');
    });

    it('detail page prediction cards stack to single column', () => {
      cy.get('.stock-row').first().click();
      cy.get('.prediction-cards', { timeout: 15000 }).should('be.visible');
      cy.get('.prediction-cards').should('have.css', 'grid-template-columns', '320px');
    });
  });

  describe('Tablet (768px)', () => {
    beforeEach(() => {
      cy.viewport(768, 1024);
      cy.visit('/');
      cy.get('.stock-row', { timeout: 15000 }).should('have.length', 7);
    });

    it('header displays normally', () => {
      cy.get('.app-header').should('be.visible');
      cy.get('.market-status-badge').should('be.visible');
    });

    it('stock grid shows as a table', () => {
      cy.get('.stock-grid thead').should('be.visible');
    });

    it('hides Day High, Day Low, and Last Updated columns', () => {
      // These columns are hidden on tablet via CSS
      cy.get('.stock-row').first().within(() => {
        cy.get('.cell-high').should('not.be.visible');
        cy.get('.cell-low').should('not.be.visible');
        cy.get('.cell-updated').should('not.be.visible');
      });
    });
  });

  describe('Desktop (1280px)', () => {
    beforeEach(() => {
      cy.viewport(1280, 720);
      cy.visit('/');
      cy.get('.stock-row', { timeout: 15000 }).should('have.length', 7);
    });

    it('shows full table with all columns', () => {
      cy.get('.stock-grid thead').should('be.visible');
      cy.get('.stock-row').first().within(() => {
        cy.get('.cell-price').should('be.visible');
        cy.get('.cell-change').should('be.visible');
        cy.get('.cell-volume').should('be.visible');
      });
    });

    it('metrics panel shows 5-column grid on detail page', () => {
      cy.get('.stock-row').first().click();
      cy.get('.metrics-grid', { timeout: 15000 }).should('be.visible');
    });
  });
});
