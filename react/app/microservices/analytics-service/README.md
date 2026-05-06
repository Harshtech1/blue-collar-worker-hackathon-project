# RAHI Analytics Service

FastAPI microservice for the density-based workforce allocation POC.

## Run locally

```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API

`POST /predict-density`

The service trains a small Random Forest model on historical area signals, predicts near-term demand, then applies the RAHI density rule:

```text
density = predicted_demand / active_workers
```

The output recommends one of:

```text
salaried_core
hybrid
freelancer_pool
```
