"""Skeleton integrity: the package imports and the shared probability
engine is usable from this project with real-estate label sets. This is
the contract the repository restructure exists to provide; if it breaks,
the project cannot be developed."""

from __future__ import annotations

import numpy as np
import pandas as pd
from probability_engine.model_registry import create_model

import real_estate

VALUATION_LABELS = ("underpriced", "fair", "overpriced")


def test_package_imports() -> None:
    assert real_estate.__version__


def test_shared_engine_accepts_valuation_labels() -> None:
    rng = np.random.default_rng(11)
    signal = rng.normal(size=60)
    features = pd.DataFrame({"price_per_sqm_vs_area_median": signal})
    labels = pd.Series(
        [
            VALUATION_LABELS[0] if v < -0.5 else VALUATION_LABELS[2] if v > 0.5 else "fair"
            for v in signal
        ]
    )

    model = create_model("softmax", labels=VALUATION_LABELS)
    model.train(features, labels)
    probs = model.predict_proba(features)

    assert probs.shape == (60, 3)
    np.testing.assert_allclose(probs.sum(axis=1), 1.0, atol=1e-9)
