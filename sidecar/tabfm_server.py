"""TabFM FastAPI sidecar — zero-shot classification of counterfactual outcomes."""

import logging
import os
import sys
from typing import Any
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

sys.path.insert(0, os.path.dirname(__file__))
import intent_examples  # supplies EXAMPLE_POOL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tabfm-sidecar")

try:
    from tabfm.src.pytorch.tabfm_v1_0_0 import load as _load_tabfm
    from tabfm import TabFMClassifier
    HAS_TABFM = True
except ImportError as e:
    logger.warning("TabFM not available: %s", e)
    HAS_TABFM = False

app = FastAPI(title="TabFM Sidecar", version="1.0.0")

model = None
classifier = None
CLASS_NAMES = []


class ClassifyRequest(BaseModel):
    rows: list[dict[str, float]]
    n_shots: int = 5


class ClassifyResponse(BaseModel):
    predictions: list[str]
    probabilities: list[dict[str, float]]
    classes: list[str]


@app.on_event("startup")
async def startup():
    global model, classifier, CLASS_NAMES
    if not HAS_TABFM:
        logger.warning("Running in mock mode — TabFM not installed")
        return
    logger.info("Loading TabFM model (this may download weights on first run)...")
    model = _load_tabfm(model_type="classification")
    classifier = TabFMClassifier(model=model, random_state=42, verbose=False)
    CLASS_NAMES = list(intent_examples.EXAMPLE_POOL.keys())
    logger.info("TabFM ready. %d intent classes loaded.", len(CLASS_NAMES))


def _build_training_data(n_shots: int):
    X, y = [], []
    for class_name, examples in intent_examples.EXAMPLE_POOL.items():
        shot = examples[:n_shots]
        for ex in shot:
            X.append(list(ex["features"].values()))
            y.append(class_name)
    return np.array(X, dtype=np.float64), np.array(y)


def _build_test_row(row: dict[str, float]):
    feature_keys = list(intent_examples.FEATURE_ORDER)
    return np.array([[row.get(k, 0.0) for k in feature_keys]], dtype=np.float64)


def _mock_predict(features: dict[str, float]):
    """Simple mock: classify based on GDP delta sign and magnitude."""
    gdp_delta = features.get("gdp_mean_delta", 0)
    if gdp_delta > 10:
        return "economic_recovery", 0.85
    elif -10 < gdp_delta < 0:
        return "economic_collapse", 0.80
    elif features.get("temperature_anomaly", 0) > 1:
        return "climate_drift", 0.75
    elif features.get("occupancy_rate", 0) > 0.05:
        return "hospital_pressure", 0.70
    elif abs(features.get("population_delta", 0)) > 1_000_000:
        return "population_shock", 0.65
    elif features.get("trade_volume_delta", 0) < -5:
        return "supply_chain_disruption", 0.60
    return "no_effect", 0.90


@app.post("/classify", response_model=ClassifyResponse)
async def classify(req: ClassifyRequest):
    if not HAS_TABFM or classifier is None:
        results = []
        probs_list = []
        for row in req.rows:
            label, conf = _mock_predict(row)
            results.append(label)
            probs = {c: 0.0 for c in CLASS_NAMES} if CLASS_NAMES else {"no_effect": 1.0}
            probs[label] = conf
            probs_list.append(probs)
        return ClassifyResponse(
            predictions=results,
            probabilities=probs_list,
            classes=CLASS_NAMES or ["no_effect"],
        )

    n = min(req.n_shots, max(len(v) for v in intent_examples.EXAMPLE_POOL.values()))
    X_train, y_train = _build_training_data(n)
    classifier.fit(X_train, y_train)

    results, probs_list = [], []
    for row in req.rows:
        X_test = _build_test_row(row)
        pred = classifier.predict(X_test)[0]
        proba = classifier.predict_proba(X_test)[0]
        results.append(str(pred))
        probs_list.append(
            {str(c): float(p) for c, p in zip(classifier.classes_, proba)}
        )

    return ClassifyResponse(
        predictions=results,
        probabilities=probs_list,
        classes=[str(c) for c in classifier.classes_],
    )


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "tabfm_loaded": HAS_TABFM and classifier is not None,
        "classes": CLASS_NAMES,
    }


if __name__ == "__main__":
    port = int(os.environ.get("TABFM_PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
