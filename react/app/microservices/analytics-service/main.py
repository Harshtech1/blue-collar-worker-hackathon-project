from datetime import datetime
from functools import lru_cache
from time import perf_counter
from typing import Dict, List, Literal

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor


app = FastAPI(title="RAHI Intelligence Engine", version="2.0.0")


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


DensityCluster = Literal["low_density", "balanced_density", "high_density", "surge_density"]


class SimulationBookingRequest(BaseModel):
    lat: float
    lng: float
    serviceType: str
    timestamp: datetime
    estimatedValue: float = Field(gt=0)
    areaSector: str
    marketingEffort: float = Field(default=0, ge=0)
    activeWorkersHint: int = Field(default=1, ge=1)
    historicalTraffic: float = Field(default=1.0, ge=0)
    acquisitionCost: float = Field(default=0, ge=0)
    churnRisk: float = Field(default=0.12, ge=0, le=1)
    isEmergency: bool = False


class SimulationBatchRequest(BaseModel):
    batch_id: int = Field(ge=1)
    total_batches: int = Field(ge=1)
    total_points: int = Field(ge=1)
    bookings: List[SimulationBookingRequest]


class SimulationSectorSummary(BaseModel):
    area_sector: str
    batch_orders: int
    projected_orders: int
    active_workers: int
    density_score: float
    density_cluster: DensityCluster
    salaried_ratio: float
    freelancer_ratio: float
    recommended_shift: int
    confidence_score: float
    traditional_cost: float
    optimized_cost: float
    projected_revenue: float
    burn_risk: float
    churn_risk: float
    centroid_lat: float
    centroid_lng: float


class SimulationBatchResponse(BaseModel):
    batch_id: int
    total_batches: int
    points_received: int
    processing_ms: float
    cluster_distribution: Dict[str, int]
    sector_summaries: List[SimulationSectorSummary]
    model_version: str


FEATURE_COLUMNS = [
    "orders",
    "marketing_spend",
    "active_workers",
    "day_of_week",
    "is_weekend",
    "emergency_orders",
]

SIMULATION_FEATURE_COLUMNS = [
    "orders_count",
    "active_workers",
    "avg_value",
    "marketing_effort",
    "emergency_share",
    "weekend_share",
    "historical_traction",
    "acquisition_cost",
    "service_diversity",
    "peak_hour_share",
]

CLUSTER_CODE_TO_LABEL: Dict[int, DensityCluster] = {
    0: "low_density",
    1: "balanced_density",
    2: "high_density",
    3: "surge_density",
}

WORKFORCE_BOUNDS = {
    "low_density": (0.1, 0.24, 0.95),
    "balanced_density": (0.3, 0.48, 1.2),
    "high_density": (0.65, 0.82, 1.6),
    "surge_density": (0.82, 0.92, 1.95),
}


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


def _cluster_from_density(density: float) -> int:
    if density < 0.9:
        return 0
    if density < 1.45:
        return 1
    if density < 2.15:
        return 2
    return 3


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


@lru_cache(maxsize=1)
def get_simulation_models():
    rng = np.random.default_rng(42)
    training_rows = []

    for _ in range(4800):
        orders_count = int(rng.integers(20, 540))
        active_workers = int(rng.integers(6, 135))
        avg_value = float(rng.uniform(380, 4200))
        marketing_effort = float(rng.uniform(3200, 22000))
        emergency_share = float(rng.uniform(0.02, 0.28))
        weekend_share = float(rng.uniform(0.12, 0.52))
        historical_traction = float(rng.uniform(0.74, 1.65))
        acquisition_cost = float(rng.uniform(65, 220))
        service_diversity = int(rng.integers(2, 8))
        peak_hour_share = float(rng.uniform(0.18, 0.62))

        demand_pressure = (
            orders_count
            * (1 + (marketing_effort / 85000))
            * (1 + (emergency_share * 0.32))
            * (1 + (weekend_share * 0.18))
            * (1 + ((historical_traction - 1) * 0.24))
        )
        density_score = demand_pressure / max(1, active_workers)
        projected_orders = int(round(demand_pressure))
        cluster_code = _cluster_from_density(density_score)

        if cluster_code == 0:
            salaried_ratio = float(rng.uniform(0.1, 0.24))
        elif cluster_code == 1:
            salaried_ratio = float(rng.uniform(0.32, 0.48))
        elif cluster_code == 2:
            salaried_ratio = float(rng.uniform(0.65, 0.82))
        else:
            salaried_ratio = float(rng.uniform(0.82, 0.92))

        training_rows.append({
            "orders_count": orders_count,
            "active_workers": active_workers,
            "avg_value": avg_value,
            "marketing_effort": marketing_effort,
            "emergency_share": emergency_share,
            "weekend_share": weekend_share,
            "historical_traction": historical_traction,
            "acquisition_cost": acquisition_cost,
            "service_diversity": service_diversity,
            "peak_hour_share": peak_hour_share,
            "projected_orders": projected_orders,
            "cluster_code": cluster_code,
            "salaried_ratio": salaried_ratio,
        })

    training_df = pd.DataFrame(training_rows)
    x_train = training_df[SIMULATION_FEATURE_COLUMNS]

    cluster_model = RandomForestClassifier(
        n_estimators=180,
        max_depth=12,
        min_samples_leaf=2,
        random_state=42,
    )
    cluster_model.fit(x_train, training_df["cluster_code"])

    demand_model = RandomForestRegressor(
        n_estimators=200,
        max_depth=14,
        min_samples_leaf=2,
        random_state=42,
    )
    demand_model.fit(x_train, training_df["projected_orders"])

    salary_ratio_model = RandomForestRegressor(
        n_estimators=160,
        max_depth=10,
        min_samples_leaf=2,
        random_state=42,
    )
    salary_ratio_model.fit(x_train, training_df["salaried_ratio"])

    return cluster_model, demand_model, salary_ratio_model


def _cost_profile(
    projected_orders: int,
    active_workers: int,
    avg_value: float,
    acquisition_cost: float,
    density_score: float,
    salaried_ratio: float,
) -> tuple[float, float, float]:
    projected_revenue = projected_orders * avg_value * 1.06
    traditional_cost = (
        projected_orders * ((avg_value * 0.57) + (acquisition_cost * 0.74))
        + (active_workers * 930)
        + max(0, 1.12 - density_score) * active_workers * 280
    )
    optimized_cost = (
        projected_orders * ((avg_value * 0.49) + (acquisition_cost * 0.48))
        + (active_workers * ((salaried_ratio * 860) + ((1 - salaried_ratio) * 260)))
        + max(0, density_score - 2.1) * 170
    )
    burn_risk = _clamp((traditional_cost / max(projected_revenue, 1)) - 0.36, 0.08, 0.98)
    return projected_revenue, traditional_cost, optimized_cost, burn_risk


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


@app.post("/simulate-density-batch", response_model=SimulationBatchResponse)
def simulate_density_batch(payload: SimulationBatchRequest):
    if not payload.bookings:
        raise HTTPException(status_code=400, detail="At least one booking request is required.")

    if len(payload.bookings) > 50_000:
        raise HTTPException(status_code=400, detail="Batch size is too large for this demo endpoint.")

    try:
        start = perf_counter()
        batch_df = pd.DataFrame([item.model_dump() for item in payload.bookings])
        batch_df["timestamp"] = pd.to_datetime(batch_df["timestamp"])

        grouped = batch_df.groupby("areaSector").agg(
            batch_orders=("areaSector", "size"),
            avg_value=("estimatedValue", "mean"),
            marketing_effort=("marketingEffort", "mean"),
            active_workers=("activeWorkersHint", "mean"),
            emergency_share=("isEmergency", "mean"),
            historical_traction=("historicalTraffic", "mean"),
            acquisition_cost=("acquisitionCost", "mean"),
            churn_risk=("churnRisk", "mean"),
            service_diversity=("serviceType", "nunique"),
            centroid_lat=("lat", "mean"),
            centroid_lng=("lng", "mean"),
            weekend_share=("timestamp", lambda values: float((values.dt.dayofweek >= 5).mean())),
            peak_hour_share=("timestamp", lambda values: float(values.dt.hour.between(17, 21).mean())),
        ).reset_index()

        grouped["active_workers"] = grouped["active_workers"].clip(lower=1)

        feature_frame = grouped[SIMULATION_FEATURE_COLUMNS].copy()
        cluster_model, demand_model, salary_ratio_model = get_simulation_models()

        cluster_codes = cluster_model.predict(feature_frame)
        cluster_probabilities = cluster_model.predict_proba(feature_frame)
        projected_orders = np.maximum(grouped["batch_orders"].to_numpy(), np.round(demand_model.predict(feature_frame)).astype(int))
        predicted_salary_ratio = salary_ratio_model.predict(feature_frame)

        sector_summaries: List[SimulationSectorSummary] = []
        cluster_distribution: Dict[str, int] = {
            "low_density": 0,
            "balanced_density": 0,
            "high_density": 0,
            "surge_density": 0,
        }

        for index, row in grouped.iterrows():
            cluster_label = CLUSTER_CODE_TO_LABEL[int(cluster_codes[index])]
            lower_ratio, upper_ratio, target_density = WORKFORCE_BOUNDS[cluster_label]
            active_workers = max(1, int(round(row["active_workers"])))
            density_score = float(projected_orders[index] / max(1, active_workers))
            salaried_ratio = float(_clamp(predicted_salary_ratio[index], lower_ratio, upper_ratio))
            freelancer_ratio = float(round(1 - salaried_ratio, 4))
            recommended_shift = max(0, int(np.ceil(projected_orders[index] / target_density) - active_workers))
            projected_revenue, traditional_cost, optimized_cost, burn_risk = _cost_profile(
                int(projected_orders[index]),
                active_workers,
                float(row["avg_value"]),
                float(row["acquisition_cost"]),
                density_score,
                salaried_ratio,
            )
            confidence_score = float(np.max(cluster_probabilities[index]))
            churn_risk = float(_clamp(
                float(row["churn_risk"]) + (0.08 if cluster_label in {"high_density", "surge_density"} else 0) + (float(row["emergency_share"]) * 0.16),
                0.08,
                0.48,
            ))

            cluster_distribution[cluster_label] += 1
            sector_summaries.append(SimulationSectorSummary(
                area_sector=str(row["areaSector"]),
                batch_orders=int(row["batch_orders"]),
                projected_orders=int(projected_orders[index]),
                active_workers=active_workers,
                density_score=round(density_score, 2),
                density_cluster=cluster_label,
                salaried_ratio=round(salaried_ratio, 4),
                freelancer_ratio=round(freelancer_ratio, 4),
                recommended_shift=recommended_shift,
                confidence_score=round(confidence_score, 4),
                traditional_cost=round(traditional_cost, 2),
                optimized_cost=round(optimized_cost, 2),
                projected_revenue=round(projected_revenue, 2),
                burn_risk=round(burn_risk, 4),
                churn_risk=round(churn_risk, 4),
                centroid_lat=round(float(row["centroid_lat"]), 5),
                centroid_lng=round(float(row["centroid_lng"]), 5),
            ))

        processing_ms = round((perf_counter() - start) * 1000, 2)
        return SimulationBatchResponse(
            batch_id=payload.batch_id,
            total_batches=payload.total_batches,
            points_received=len(payload.bookings),
            processing_ms=processing_ms,
            cluster_distribution=cluster_distribution,
            sector_summaries=sector_summaries,
            model_version="simulation-rf-v2",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
