import math


def _clean(values: list[float]) -> list[float]:
    """Replace NaN/inf with 0.0."""
    return [0.0 if (math.isnan(v) or math.isinf(v)) else v for v in values]


def min_max_normalize(values: list[float]) -> list[float]:
    """Normalize a series to [0, 1] using min-max scaling.

    Edge cases:
      - Empty list → empty list
      - Single value → [0.5]
      - All identical → [0.5, 0.5, ...]
      - NaN/inf values are replaced with 0.0 before normalizing
    """
    cleaned = _clean(values)
    if not cleaned:
        return []
    min_val = min(cleaned)
    max_val = max(cleaned)
    if max_val == min_val:
        return [0.5] * len(cleaned)
    spread = max_val - min_val
    return [(v - min_val) / spread for v in cleaned]


def z_score_normalize(values: list[float]) -> list[float]:
    """Normalize a series using z-score (mean=0, std=1).

    Edge cases:
      - Empty list → empty list
      - Single value → [0.0]
      - All identical (std=0) → [0.0, 0.0, ...]
      - NaN/inf values are replaced with 0.0 before normalizing
    """
    cleaned = _clean(values)
    if not cleaned:
        return []
    n = len(cleaned)
    mean = sum(cleaned) / n
    variance = sum((v - mean) ** 2 for v in cleaned) / n
    std = variance ** 0.5
    if std == 0:
        return [0.0] * n
    return [(v - mean) / std for v in cleaned]
