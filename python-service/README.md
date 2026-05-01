# Python yfinance Microservice

Provides real analyst recommendations, target prices, and fundamentals by wrapping the `yfinance` Python library. The Node.js backend calls this service for data not available through Yahoo's authenticated v10 API.

## Setup

```bash
cd python-service
pip3 install -r requirements.txt
```

## Run

```bash
python3 app.py
```

Service runs on `http://localhost:5001`.

## Endpoints

- `GET /health` — service status
- `GET /analyst/:symbol` — returns analyst targets, recommendations, fundamentals for a symbol (e.g., `RELIANCE.NS`)
