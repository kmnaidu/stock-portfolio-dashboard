describe('Dashboard Page', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  describe('Page Load', () => {
    it('displays the app header with title', () => {
      cy.get('.app-header').should('be.visible');
      cy.contains('Stock Portfolio Dashboard').should('be.visible');
    });

    it('displays the market status badge', () => {
      cy.get('.market-status-badge').should('be.visible');
      cy.get('.market-status-badge').invoke('text').should('match', /Market (Open|Closed)|Pre-Market|Post-Market/);
    });

    it('displays the IST clock', () => {
      cy.get('.ist-clock').should('be.visible');
      cy.get('.ist-clock').invoke('text').should('contain', 'IST');
    });

    it('displays the refresh button', () => {
      cy.get('.refresh-btn').should('be.visible');
    });

    it('displays the Last Updated timestamp', () => {
      cy.get('.last-updated', { timeout: 15000 }).should('be.visible');
      cy.get('.last-updated').invoke('text').should('contain', 'Updated');
    });
  });

  describe('Portfolio Summary', () => {
    it('displays the portfolio summary card with all metrics', () => {
      cy.get('.portfolio-summary-card', { timeout: 15000 }).should('be.visible');
      cy.contains('Portfolio Value').should('be.visible');
      cy.contains('Daily Change').should('be.visible');
      cy.contains('Securities').should('be.visible');
    });

    it('shows the securities count as 7', () => {
      cy.get('.portfolio-summary-card', { timeout: 15000 }).should('be.visible');
      cy.get('.summary-metric').contains('Securities')
        .parent()
        .find('.summary-value')
        .invoke('text')
        .should('eq', '7');
    });

    it('displays portfolio value with ₹ symbol', () => {
      cy.get('.portfolio-summary-card', { timeout: 15000 }).should('be.visible');
      cy.get('.summary-metric').contains('Portfolio Value')
        .parent()
        .find('.summary-value')
        .invoke('text')
        .should('contain', '₹');
    });
  });

  describe('Stock Grid', () => {
    it('displays all 7 supported securities', () => {
      cy.get('.stock-row', { timeout: 15000 }).should('have.length', 7);
    });

    it('shows all expected stock names', () => {
      const expectedStocks = [
        'Reliance',
        'HDFC',
        'SBI',
        'HAL',
        'Airtel',
        'Nifty',
        'Gold',
      ];
      cy.get('.stock-grid', { timeout: 15000 }).should('be.visible');
      expectedStocks.forEach((name) => {
        cy.get('.stock-grid').contains(name, { matchCase: false }).should('exist');
      });
    });

    it('displays price data for each stock', () => {
      cy.get('.stock-row', { timeout: 15000 }).first().within(() => {
        cy.get('.cell-price').should('be.visible');
        cy.get('.cell-price').invoke('text').should('contain', '₹');
      });
    });

    it('displays column headers', () => {
      cy.get('.stock-grid', { timeout: 15000 }).should('be.visible');
      cy.contains('.grid-header', 'Name').should('be.visible');
      cy.contains('.grid-header', 'Price').should('be.visible');
      cy.contains('.grid-header', 'Volume').should('be.visible');
    });
  });

  describe('Sorting', () => {
    it('sorts by price when clicking the Price header', () => {
      cy.get('.stock-row', { timeout: 15000 }).should('have.length', 7);

      // Click Price header to sort ascending
      cy.contains('.grid-header', 'Price').click();
      cy.get('.sort-indicator').should('be.visible');

      // Get all prices and verify they are in ascending order
      cy.get('.cell-price').then(($cells) => {
        const prices = [...$cells].map((el) =>
          parseFloat(el.textContent!.replace(/[₹,]/g, ''))
        );
        for (let i = 1; i < prices.length; i++) {
          expect(prices[i]).to.be.gte(prices[i - 1]);
        }
      });
    });

    it('toggles sort direction on second click', () => {
      cy.get('.stock-row', { timeout: 15000 }).should('have.length', 7);

      // Click Price header twice for descending
      cy.contains('.grid-header', 'Price').click();
      cy.contains('.grid-header', 'Price').click();

      cy.get('.cell-price').then(($cells) => {
        const prices = [...$cells].map((el) =>
          parseFloat(el.textContent!.replace(/[₹,]/g, ''))
        );
        for (let i = 1; i < prices.length; i++) {
          expect(prices[i]).to.be.lte(prices[i - 1]);
        }
      });
    });

    it('sorts by name when clicking the Name header', () => {
      cy.get('.stock-row', { timeout: 15000 }).should('have.length', 7);
      cy.contains('.grid-header', 'Name').click();

      cy.get('.stock-name').then(($names) => {
        const names = [...$names].map((el) => el.textContent!);
        const sorted = [...names].sort();
        expect(names).to.deep.equal(sorted);
      });
    });
  });

  describe('Navigation', () => {
    it('navigates to stock detail page when clicking a stock row', () => {
      cy.get('.stock-row', { timeout: 15000 }).first().click();
      cy.url().should('include', '/stock/');
      cy.get('.price-header').should('be.visible');
    });

    it('can navigate back to dashboard from detail page', () => {
      cy.get('.stock-row', { timeout: 15000 }).first().click();
      cy.get('.back-link').click();
      cy.url().should('eq', Cypress.config().baseUrl + '/');
      cy.get('.stock-grid').should('be.visible');
    });
  });

  describe('Refresh', () => {
    it('refresh button triggers data reload', () => {
      cy.get('.stock-row', { timeout: 15000 }).should('have.length', 7);

      // Note the current "Last Updated" time
      cy.get('.last-updated').invoke('text').then((beforeText) => {
        // Wait a moment then click refresh
        cy.wait(1500);
        cy.get('.refresh-btn').click();

        // Wait for data to reload
        cy.wait(3000);
        cy.get('.last-updated').invoke('text').should('not.eq', beforeText);
      });
    });
  });
});
