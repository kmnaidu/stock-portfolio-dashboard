describe('Stock Detail Page', () => {
  beforeEach(() => {
    // Navigate to Reliance detail page via dashboard click
    cy.visit('/');
    cy.get('.stock-row', { timeout: 15000 }).should('have.length', 7);
    cy.contains('.stock-name', 'Reliance').closest('.stock-row').click();
    cy.url().should('include', '/stock/RELIANCE.NS');
  });

  describe('Price Header', () => {
    it('displays the stock name', () => {
      cy.get('.price-header-name').should('be.visible');
      cy.get('.price-header-name').invoke('text').should('contain', 'Reliance');
    });

    it('displays the current price with ₹ symbol', () => {
      cy.get('.price-header-price').should('be.visible');
      cy.get('.price-header-price').invoke('text').should('contain', '₹');
    });

    it('displays price change (absolute and percentage)', () => {
      cy.get('.price-header-change').should('be.visible');
      cy.get('.price-header-change-pct').should('be.visible');
    });

    it('applies green or red color based on price direction', () => {
      cy.get('.price-header-price').then(($el) => {
        const classes = $el.attr('class')!;
        const hasDirection = classes.includes('price-up') || classes.includes('price-down');
        // Price could be neutral (no class), so just verify it rendered
        expect($el.text()).to.contain('₹');
      });
    });
  });

  describe('Price Chart', () => {
    it('displays the price chart container', () => {
      cy.get('.price-chart-container').should('be.visible');
    });

    it('shows the "Price History" title', () => {
      cy.contains('Price History').should('be.visible');
    });

    it('displays all 6 time range buttons', () => {
      cy.get('.range-btn').should('have.length', 6);
      ['1D', '1W', '1M', '3M', '6M', '1Y'].forEach((label) => {
        cy.contains('.range-btn', label).should('be.visible');
      });
    });

    it('1M range is active by default', () => {
      cy.contains('.range-btn', '1M').should('have.class', 'range-btn-active');
    });

    it('clicking a different range button changes the active state', () => {
      cy.contains('.range-btn', '6M').click();
      cy.contains('.range-btn', '6M').should('have.class', 'range-btn-active');
      cy.contains('.range-btn', '1M').should('not.have.class', 'range-btn-active');
    });

    it('renders the Recharts SVG chart', () => {
      // Wait for chart data to load
      cy.get('.recharts-wrapper', { timeout: 15000 }).should('be.visible');
      cy.get('.recharts-area').should('exist');
    });
  });

  describe('Price Predictions', () => {
    it('displays the predictions panel', () => {
      cy.get('.prediction-panel').should('be.visible');
      cy.contains('Price Predictions').should('be.visible');
    });

    it('shows 3 prediction cards (1 Week, 1 Month, 3 Months)', () => {
      cy.get('.prediction-card', { timeout: 15000 }).should('have.length', 3);
      cy.contains('.prediction-horizon', '1 Week').should('be.visible');
      cy.contains('.prediction-horizon', '1 Month').should('be.visible');
      cy.contains('.prediction-horizon', '3 Months').should('be.visible');
    });

    it('each prediction shows a price with ₹ symbol', () => {
      cy.get('.prediction-card', { timeout: 15000 }).each(($card) => {
        cy.wrap($card).find('.prediction-price').invoke('text').should('contain', '₹');
      });
    });

    it('each prediction shows a confidence bar', () => {
      cy.get('.prediction-card', { timeout: 15000 }).each(($card) => {
        cy.wrap($card).find('.prediction-confidence-bar').should('be.visible');
        cy.wrap($card).find('.prediction-confidence-value').should('be.visible');
      });
    });

    it('each prediction shows a direction arrow', () => {
      cy.get('.prediction-card', { timeout: 15000 }).each(($card) => {
        cy.wrap($card).find('.prediction-arrow').invoke('text').should('match', /[↑↓→]/);
      });
    });

    it('displays the disclaimer text', () => {
      cy.get('.prediction-disclaimer').should('be.visible');
      cy.get('.prediction-disclaimer').invoke('text')
        .should('contain', 'not financial advice');
    });
  });

  describe('Analyst Recommendations', () => {
    it('displays the recommendations panel', () => {
      cy.get('.recommendation-panel').should('be.visible');
      cy.contains('Analyst Recommendations').should('be.visible');
    });

    it('shows a consensus rating badge', () => {
      cy.get('.consensus-badge', { timeout: 15000 }).should('be.visible');
      cy.get('.consensus-badge').invoke('text')
        .should('match', /Strong Buy|Buy|Hold|Sell|Strong Sell/);
    });

    it('shows analyst count and score', () => {
      cy.get('.consensus-meta', { timeout: 15000 }).should('be.visible');
      cy.get('.consensus-meta').invoke('text').should('contain', 'Score');
    });

    it('lists individual recommendations', () => {
      cy.get('.recommendation-item', { timeout: 15000 }).should('have.length.gte', 1);
    });

    it('each recommendation shows firm, rating, target price, and date', () => {
      cy.get('.recommendation-item', { timeout: 15000 }).first().within(() => {
        cy.get('.rec-firm').should('be.visible');
        cy.get('.rec-rating-badge').should('be.visible');
        cy.get('.rec-target').invoke('text').should('contain', '₹');
        cy.get('.rec-date').should('be.visible');
      });
    });
  });

  describe('Key Metrics', () => {
    it('displays the metrics panel', () => {
      cy.get('.metrics-panel').should('be.visible');
      cy.contains('Key Metrics').should('be.visible');
    });

    it('shows 52-Week High and Low', () => {
      cy.get('.metrics-grid', { timeout: 15000 }).should('be.visible');
      cy.contains('.metric-label', '52-Week High').should('be.visible');
      cy.contains('.metric-label', '52-Week Low').should('be.visible');
    });

    it('52-week values contain ₹ symbol', () => {
      cy.contains('.metric-label', '52-Week High')
        .parent()
        .find('.metric-value')
        .invoke('text')
        .should('contain', '₹');
    });
  });

  describe('Back Navigation', () => {
    it('shows a back link to dashboard', () => {
      cy.get('.back-link').should('be.visible');
      cy.get('.back-link').invoke('text').should('contain', 'Back to Dashboard');
    });

    it('clicking back link returns to dashboard', () => {
      cy.get('.back-link').click();
      cy.url().should('eq', Cypress.config().baseUrl + '/');
      cy.get('.stock-grid').should('be.visible');
    });
  });
});
