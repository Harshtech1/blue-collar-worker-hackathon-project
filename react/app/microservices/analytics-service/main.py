from datetime import datetime
from typing import List, Literal

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestRegressor


app = FastAPI(title="RAHI Intelligence Engine", version="1.0.0")


class HistoricalAreaSignal(BaseModel):
    orders: int = Field(ge=0)
    marketing_spend: float = Field(ge=0)
    active_workers: int = Field(ge=0)
    day_of_week: int = Field(ge=0, le=6)
    is_weekend: int = Field(ge=0, le=1)
    emergency_orders: int = Field(ge=0)
    actual_demand: int = Field(ge=0)


class DensityRequest(BaseModel):
    area_id: str
    current_orders: int = Field(ge=0)
    current_spend: float = Field(ge=0)
    current_workers: int = Field(ge=0)
    day_of_week: int = Field(ge=0, le=6)
    is_weekend: int = Field(ge=0, le=1)
    emergency_orders: int = Field(ge=0)
    history: List[HistoricalAreaSignal]


class DensityResponse(BaseModel):
    area_id: str
    predicted_demand: float
    density_score: float
    price_multiplier: float
    allocation_strategy: Literal["salaried_core", "hybrid", "freelancer_pool"]
    salaried_ratio: float
    freelancer_ratio: float
    confidence_score: float
    reasoning: str
    generated_at: str


FEATURE_COLUMNS = [
    "orders",
    "marketing_spend",
    "active_workers",
    "day_of_week",
    "is_weekend",
    "emergency_orders",
]


def _allocation_from_density(density: float) -> tuple[str, float, float, str]:
    if density >= 1.8:
        return (
            "salaried_core",
            0.8,
            0.2,
            "High demand per active worker. Keep salaried core staff ready to protect fulfillment quality.",
        )

    if density >= 1.2:
        return (
            "hybrid",
            0.45,
            0.55,
            "Moderate density. Use a salaried base for reliability and freelancers for demand spikes.",
        )

    return (
        "freelancer_pool",
        0.15,
        0.85,
        "Low density. Keep fixed salary burn low and rely mostly on verified freelancers.",
    )


def _price_multiplier_from_density(density: float) -> float:
    raw_multiplier = 1 + (0.25 * (density - 1.2))
    return round(max(0.85, min(1.5, raw_multiplier)), 2)


@app.get("/health")
def health():
    return {"status": "ok", "service": "rahi-analytics"}


@app.post("/predict-density", response_model=DensityResponse)
def predict_density(payload: DensityRequest):
    if len(payload.history) < 8:
        raise HTTPException(
            status_code=400,
            detail="At least 8 historical records are required for a meaningful Random Forest forecast.",
        )

    try:
        df = pd.DataFrame([item.model_dump() for item in payload.history])
        x_train = df[FEATURE_COLUMNS]
        y_train = df["actual_demand"]

        model = RandomForestRegressor(
            n_estimators=160,
            min_samples_leaf=2,
            random_state=42,
        )
        model.fit(x_train, y_train)

        current_features = np.array([[
            payload.current_orders,
            payload.current_spend,
            payload.current_workers,
            payload.day_of_week,
            payload.is_weekend,
            payload.emergency_orders,
        ]])

        predicted_demand = max(0.0, float(model.predict(current_features)[0]))
        density_score = predicted_demand / payload.current_workers if payload.current_workers > 0 else predicted_demand
        strategy, salaried_ratio, freelancer_ratio, reasoning = _allocation_from_density(density_score)

        train_predictions = model.predict(x_train)
        mae = float(np.mean(np.abs(train_predictions - y_train)))
        mean_demand = float(max(1, np.mean(y_train)))
        confidence_score = max(0.5, min(0.95, 1 - (mae / (mean_demand * 2))))

        return DensityResponse(
            area_id=payload.area_id,
            predicted_demand=round(predicted_demand, 2),
            density_score=round(density_score, 2),
            price_multiplier=_price_multiplier_from_density(density_score),
            allocation_strategy=strategy,
            salaried_ratio=salaried_ratio,
            freelancer_ratio=freelancer_ratio,
            confidence_score=round(confidence_score, 2),
            reasoning=reasoning,
            generated_at=datetime.utcnow().isoformat() + "Z",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
