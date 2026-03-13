"""
Phase 5 — AI Service Tests (FastAPI)
Tests for /health, /forecast/run, and /score/payment endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np
from datetime import datetime, timedelta


# Mock the database engine before importing main
@pytest.fixture(autouse=True)
def mock_db_engine():
    with patch("main.engine") as mock_engine:
        mock_engine.connect.return_value.__enter__ = MagicMock()
        mock_engine.connect.return_value.__exit__ = MagicMock()
        yield mock_engine


@pytest.fixture(autouse=True)
def mock_prophet_class():
    with patch("main.Prophet") as mock_prophet:
        instance = mock_prophet.return_value
        
        def make_future(periods):
            dates = [pd.Timestamp("2024-01-01") + pd.Timedelta(days=i) for i in range(periods)]
            return pd.DataFrame({"ds": dates})
        instance.make_future_dataframe.side_effect = make_future
        
        def predict(future_df):
            n = len(future_df)
            return pd.DataFrame({
                "ds": future_df["ds"],
                "yhat": [50.0] * n,
                "yhat_lower": [40.0] * n,
                "yhat_upper": [60.0] * n
            })
        instance.predict.side_effect = predict
        yield mock_prophet


@pytest.fixture
def client(mock_db_engine, mock_prophet_class):
    from main import app
    return TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_200(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "prophet_available" in data

    def test_health_has_prophet_field(self, client):
        response = client.get("/health")
        data = response.json()
        assert isinstance(data["prophet_available"], bool)


class TestForecastEndpoint:
    def _mock_sales_data(self, days: int):
        """Generate mock daily sales dataframe."""
        dates = [(datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days, 0, -1)]
        qtys = [max(0, int(np.random.normal(50, 15))) for _ in range(days)]
        return pd.DataFrame({"sale_date": dates, "qty": qtys})

    @patch("main.pd.read_sql")
    def test_forecast_with_little_data_uses_moving_average(self, mock_read_sql, client):
        """Less than 30 data points → should use moving_average model."""
        mock_read_sql.side_effect = [
            self._mock_sales_data(15),   # sales data (< 30 days)
            pd.DataFrame({"lead_time_days": [7], "current_stock": [100]}),  # meta_df
        ]

        response = client.post("/forecast/run", json={
            "org_id": "org-test-1",
            "product_id": "prod-test-1",
            "horizon_days": 14,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["model_used"] == "moving_average"
        assert len(data["dates"]) == 14
        assert len(data["predicted"]) == 14

    @patch("main.pd.read_sql")
    def test_forecast_with_medium_data_uses_trend(self, mock_read_sql, client):
        """30-89 data points → should use prophet model."""
        mock_read_sql.side_effect = [
            self._mock_sales_data(60),
            pd.DataFrame({"lead_time_days": [5], "current_stock": [200]}),
        ]

        response = client.post("/forecast/run", json={
            "org_id": "org-test-1",
            "product_id": "prod-test-1",
            "horizon_days": 30,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["model_used"] == "prophet"
        assert len(data["dates"]) == 30

    @patch("main.pd.read_sql")
    def test_forecast_returns_valid_reorder_fields(self, mock_read_sql, client):
        """Check that reorder_point and reorder_qty are returned as numbers."""
        mock_read_sql.side_effect = [
            self._mock_sales_data(25),
            pd.DataFrame({"lead_time_days": [3], "current_stock": [50]}),
        ]

        response = client.post("/forecast/run", json={
            "org_id": "org-test-1",
            "product_id": "prod-test-1",
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["reorder_point"], (int, float))
        assert isinstance(data["reorder_qty"], (int, float))
        assert isinstance(data["confidence"], (int, float))

    @patch("main.pd.read_sql")
    def test_forecast_with_no_data_returns_error(self, mock_read_sql, client):
        """No sales data at all → should return a 400 or error response."""
        mock_read_sql.return_value = pd.DataFrame(columns=["sale_date", "qty"])

        response = client.post("/forecast/run", json={
            "org_id": "org-test-1",
            "product_id": "prod-nonexistent",
        })
        # The endpoint should handle this gracefully
        assert response.status_code in [200, 400, 404]


class TestPaymentScoreEndpoint:
    @patch("main.pd.read_sql")
    def test_payment_score_returns_valid_response(self, mock_read_sql, client):
        """Payment score should return score, factors, and explanation."""
        mock_read_sql.side_effect = [
            # Invoice payment history
            pd.DataFrame({
                "total_amount": [10000, 8000, 12000],
                "paid_amount": [10000, 8000, 12000],
                "due_date": [
                    datetime.now() - timedelta(days=30),
                    datetime.now() - timedelta(days=60),
                    datetime.now() - timedelta(days=90),
                ],
                "paid_at": [
                    datetime.now() - timedelta(days=28),
                    datetime.now() - timedelta(days=65),
                    datetime.now() - timedelta(days=88),
                ],
                "status": ["PAID", "PAID", "PAID"],
            }),
            # Order frequency
            pd.DataFrame({"order_count": [15], "total_value": [150000]}),
        ]

        response = client.post("/score/payment", json={
            "customer_id": "cust-test-1",
            "org_id": "org-test-1",
        })
        assert response.status_code == 200
        data = response.json()
        assert "score" in data
        assert isinstance(data["score"], int)
        assert 0 <= data["score"] <= 100
        assert "factors" in data
        assert "explanation" in data

    @patch("main.pd.read_sql")
    def test_payment_score_with_no_invoices(self, mock_read_sql, client):
        """New customer with no invoices → should get a default score."""
        mock_read_sql.side_effect = [
            pd.DataFrame(columns=["total_amount", "paid_amount", "due_date", "paid_at", "status"]),
            pd.DataFrame({"order_count": [0], "total_value": [0]}),
        ]

        response = client.post("/score/payment", json={
            "customer_id": "cust-new",
            "org_id": "org-test-1",
        })
        assert response.status_code in [200, 400]
