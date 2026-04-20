# Requirements Document

## Introduction

A real-time Indian stock market portfolio dashboard that provides live trading prices, future price predictions, and brokerage institution recommendations for a curated set of Indian equities and ETFs. The dashboard targets retail investors who want a consolidated view of their portfolio with actionable insights — covering Reliance, HDFC, SBI, HAL, Bharti Airtel, NiftyBees (ETF), and GoldBees (ETF).

## Glossary

- **Dashboard**: The primary user interface that displays portfolio data, predictions, and recommendations in a consolidated view
- **Stock_Ticker**: A unique identifier for a listed security on the Indian stock exchanges (e.g., RELIANCE.NS, HDFCBANK.NS)
- **Portfolio**: The collection of stocks and ETFs the user has configured for tracking
- **Real_Time_Price**: The current trading price of a security, updated at a frequency of no more than 15 seconds during market hours
- **Market_Hours**: The trading session of the National Stock Exchange (NSE) and Bombay Stock Exchange (BSE), typically 9:15 AM to 3:30 PM IST on business days
- **Prediction_Engine**: The component responsible for generating future price predictions based on historical data and analytical models
- **Recommendation_Aggregator**: The component that collects and displays analyst recommendations and target prices from brokerage institutions
- **Price_Feed**: The data source providing real-time and historical price information for Indian securities
- **Target_Price**: A price level that a brokerage analyst expects a stock to reach within a specified time horizon
- **Consensus_Rating**: An aggregated rating (e.g., Strong Buy, Buy, Hold, Sell, Strong Sell) derived from multiple brokerage recommendations
- **Supported_Securities**: The set of securities tracked by the Dashboard — Reliance, HDFC Bank, SBI, HAL, Bharti Airtel, NiftyBees, and GoldBees

## Requirements

### Requirement 1: Display Real-Time Stock Prices

**User Story:** As a retail investor, I want to see real-time trading prices for my portfolio stocks, so that I can monitor market movements as they happen.

#### Acceptance Criteria

1. WHEN the Dashboard is loaded during Market_Hours, THE Price_Feed SHALL retrieve and display the Real_Time_Price for each of the Supported_Securities within 5 seconds of page load.
2. WHILE Market_Hours are active, THE Price_Feed SHALL update the Real_Time_Price for each Supported_Security at intervals no greater than 15 seconds.
3. THE Dashboard SHALL display the following data points for each Supported_Security: current price, price change (absolute), price change (percentage), day high, day low, and volume.
4. WHEN the Real_Time_Price of a Supported_Security changes, THE Dashboard SHALL visually indicate the direction of change using green for price increase and red for price decrease.
5. WHEN the Dashboard is loaded outside Market_Hours, THE Price_Feed SHALL display the last closing price for each Supported_Security along with a label indicating the market is closed.
6. IF the Price_Feed fails to retrieve data for a Supported_Security, THEN THE Dashboard SHALL display a "Data Unavailable" indicator for that security and retry the fetch within 30 seconds.

### Requirement 2: Portfolio Overview and Summary

**User Story:** As a retail investor, I want to see an aggregated summary of my portfolio, so that I can quickly assess overall portfolio performance.

#### Acceptance Criteria

1. THE Dashboard SHALL display a portfolio summary section showing total portfolio value, total daily gain or loss (absolute and percentage), and the number of Supported_Securities being tracked.
2. WHEN the Real_Time_Price of any Supported_Security updates, THE Dashboard SHALL recalculate and refresh the portfolio summary within 2 seconds.
3. THE Dashboard SHALL display each Supported_Security in a sortable list that allows sorting by name, current price, daily change percentage, and volume.
4. WHEN the user selects a Supported_Security from the portfolio list, THE Dashboard SHALL navigate to a detailed view for that security.

### Requirement 3: Future Price Predictions

**User Story:** As a retail investor, I want to see future price predictions for my stocks, so that I can make informed decisions about buying, holding, or selling.

#### Acceptance Criteria

1. THE Prediction_Engine SHALL generate price predictions for each Supported_Security for the following time horizons: 1 week, 1 month, and 3 months.
2. THE Prediction_Engine SHALL display each prediction with a confidence level expressed as a percentage between 0 and 100.
3. WHEN the user views a Supported_Security detail page, THE Dashboard SHALL display the predicted prices alongside a historical price chart covering the last 6 months.
4. THE Prediction_Engine SHALL update predictions once per trading day, after Market_Hours close.
5. THE Dashboard SHALL clearly label all predictions with a disclaimer stating that predictions are model-generated estimates and not financial advice.
6. IF the Prediction_Engine fails to generate a prediction for a Supported_Security, THEN THE Dashboard SHALL display "Prediction Unavailable" for that security and log the failure for review.

### Requirement 4: Brokerage Recommendations and Analyst Ratings

**User Story:** As a retail investor, I want to see recommendations and target prices from brokerage institutions, so that I can consider expert opinions alongside my own analysis.

#### Acceptance Criteria

1. THE Recommendation_Aggregator SHALL collect and display analyst recommendations for each Supported_Security from at least 3 brokerage institutions.
2. THE Dashboard SHALL display each recommendation with the following details: brokerage name, recommendation type (Buy, Hold, Sell), Target_Price, and date of recommendation.
3. THE Recommendation_Aggregator SHALL compute and display a Consensus_Rating for each Supported_Security based on all available recommendations.
4. WHEN the user views a Supported_Security detail page, THE Dashboard SHALL display all available brokerage recommendations sorted by date in descending order.
5. THE Recommendation_Aggregator SHALL update brokerage recommendations at least once per trading day.
6. IF no recommendations are available for a Supported_Security, THEN THE Dashboard SHALL display "No Analyst Recommendations Available" for that security.

### Requirement 5: Stock Detail View

**User Story:** As a retail investor, I want a detailed view for each stock, so that I can analyze price history, predictions, and recommendations in one place.

#### Acceptance Criteria

1. WHEN the user selects a Supported_Security, THE Dashboard SHALL display a detail view containing: real-time price data, an interactive historical price chart, future predictions, and brokerage recommendations.
2. THE Dashboard SHALL render an interactive price chart that supports time range selection for 1 day, 1 week, 1 month, 3 months, 6 months, and 1 year.
3. THE Dashboard SHALL display key financial metrics for the selected security: 52-week high, 52-week low, market capitalization, P/E ratio, and dividend yield.
4. WHEN the user hovers over a data point on the price chart, THE Dashboard SHALL display a tooltip showing the exact price and date for that data point.

### Requirement 6: Market Status Indicator

**User Story:** As a retail investor, I want to know whether the market is currently open or closed, so that I understand the context of the prices being displayed.

#### Acceptance Criteria

1. THE Dashboard SHALL display a market status indicator showing whether the NSE is currently open, closed, or in a pre-market or post-market session.
2. WHEN Market_Hours begin, THE Dashboard SHALL automatically transition the market status indicator to "Open" within 30 seconds.
3. WHEN Market_Hours end, THE Dashboard SHALL automatically transition the market status indicator to "Closed" within 30 seconds.
4. THE Dashboard SHALL display the current time in IST alongside the market status indicator.

### Requirement 7: Data Refresh and Connectivity Handling

**User Story:** As a retail investor, I want the dashboard to handle connectivity issues gracefully, so that I am always aware of the data freshness.

#### Acceptance Criteria

1. THE Dashboard SHALL display a "Last Updated" timestamp for each Supported_Security showing when the price was last successfully fetched.
2. IF the Dashboard loses network connectivity, THEN THE Dashboard SHALL display a "Connection Lost" banner and retain the last known prices with a stale data indicator.
3. WHEN network connectivity is restored, THE Dashboard SHALL automatically resume real-time price updates within 10 seconds and remove the "Connection Lost" banner.
4. WHEN the user manually triggers a refresh, THE Dashboard SHALL fetch the latest data for all Supported_Securities and update the display within 5 seconds.

### Requirement 8: Responsive Layout

**User Story:** As a retail investor, I want to access the dashboard from my phone and desktop, so that I can monitor my portfolio from any device.

#### Acceptance Criteria

1. THE Dashboard SHALL render a responsive layout that adapts to screen widths of 320px (mobile), 768px (tablet), and 1024px or greater (desktop).
2. WHILE the Dashboard is displayed on a screen width below 768px, THE Dashboard SHALL collapse the portfolio list into a card-based layout with swipe navigation.
3. THE Dashboard SHALL maintain full functionality on the latest version of Google Chrome browser.
