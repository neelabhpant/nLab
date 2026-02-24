import math

import pytest

from app.services.normalize import min_max_normalize, z_score_normalize


class TestMinMaxNormalize:
    """Tests for min-max normalization."""

    def test_normal_case(self) -> None:
        result = min_max_normalize([10.0, 20.0, 30.0, 40.0, 50.0])
        assert result == pytest.approx([0.0, 0.25, 0.5, 0.75, 1.0])

    def test_two_values(self) -> None:
        result = min_max_normalize([100.0, 200.0])
        assert result == pytest.approx([0.0, 1.0])

    def test_already_normalized(self) -> None:
        result = min_max_normalize([0.0, 0.5, 1.0])
        assert result == pytest.approx([0.0, 0.5, 1.0])

    def test_negative_values(self) -> None:
        result = min_max_normalize([-10.0, 0.0, 10.0])
        assert result == pytest.approx([0.0, 0.5, 1.0])

    def test_empty_list(self) -> None:
        assert min_max_normalize([]) == []

    def test_single_value(self) -> None:
        assert min_max_normalize([42.0]) == [0.5]

    def test_all_identical(self) -> None:
        result = min_max_normalize([5.0, 5.0, 5.0, 5.0])
        assert result == [0.5, 0.5, 0.5, 0.5]

    def test_nan_replaced(self) -> None:
        result = min_max_normalize([0.0, float("nan"), 10.0])
        assert result == pytest.approx([0.0, 0.0, 1.0])

    def test_inf_replaced(self) -> None:
        result = min_max_normalize([0.0, float("inf"), 10.0])
        assert result == pytest.approx([0.0, 0.0, 1.0])

    def test_all_nan(self) -> None:
        result = min_max_normalize([float("nan"), float("nan")])
        assert result == [0.5, 0.5]

    def test_output_bounds(self) -> None:
        result = min_max_normalize([3.0, 1.0, 4.0, 1.0, 5.0, 9.0, 2.0, 6.0])
        assert all(0.0 <= v <= 1.0 for v in result)
        assert min(result) == pytest.approx(0.0)
        assert max(result) == pytest.approx(1.0)


class TestZScoreNormalize:
    """Tests for z-score normalization."""

    def test_normal_case(self) -> None:
        result = z_score_normalize([10.0, 20.0, 30.0])
        assert result[1] == pytest.approx(0.0)
        assert result[0] == pytest.approx(-result[2])

    def test_mean_is_zero(self) -> None:
        result = z_score_normalize([2.0, 4.0, 6.0, 8.0, 10.0])
        assert sum(result) / len(result) == pytest.approx(0.0, abs=1e-10)

    def test_std_is_one(self) -> None:
        values = [2.0, 4.0, 6.0, 8.0, 10.0]
        result = z_score_normalize(values)
        n = len(result)
        variance = sum(v ** 2 for v in result) / n
        assert variance ** 0.5 == pytest.approx(1.0, abs=1e-10)

    def test_negative_values(self) -> None:
        result = z_score_normalize([-10.0, 0.0, 10.0])
        assert result[1] == pytest.approx(0.0)

    def test_empty_list(self) -> None:
        assert z_score_normalize([]) == []

    def test_single_value(self) -> None:
        assert z_score_normalize([42.0]) == [0.0]

    def test_all_identical(self) -> None:
        result = z_score_normalize([7.0, 7.0, 7.0])
        assert result == [0.0, 0.0, 0.0]

    def test_nan_replaced(self) -> None:
        result = z_score_normalize([0.0, float("nan"), 10.0])
        assert not any(math.isnan(v) for v in result)
        assert len(result) == 3

    def test_inf_replaced(self) -> None:
        result = z_score_normalize([0.0, float("inf"), 10.0])
        assert not any(math.isinf(v) for v in result)

    def test_all_nan(self) -> None:
        result = z_score_normalize([float("nan"), float("nan")])
        assert result == [0.0, 0.0]

    def test_symmetry(self) -> None:
        result = z_score_normalize([1.0, 3.0])
        assert result[0] == pytest.approx(-result[1])
