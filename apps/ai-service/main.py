import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import math
import logging

try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False
    logging.warning("Prophet not available, falling back to moving averages.")

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set")

# Create SQLAlchemy engine for pandas read_sql
engine = create_engine(DATABASE_URL)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown
    engine.dispose()

app = FastAPI(title="DistroAI ML Service", lifespan=lifespan)

class ForecastRequest(BaseModel):
    org_id: str
    product_id: str
    horizon_days: int = 30

class ForecastResponse(BaseModel):
    dates: List[str]
    predicted: List[float]
    lower: List[float]
    upper: List[float]
    confidence: float
    reorder_point: float
    reorder_qty: float
    model_used: str

class PaymentScoreRequest(BaseModel):
    customer_id: str
    org_id: str

class PaymentScoreResponse(BaseModel):
    score: int
    factors: List[Dict[str, Any]]
    explanation: str

@app.get("/health")
def health_check():
    return {"status": "ok", "prophet_available": PROPHET_AVAILABLE}

@app.post("/forecast/run", response_model=ForecastResponse)
def run_forecast(req: ForecastRequest):
    # 1. Fetch sales data natively with pandas and SQLAlchemy
    query = text("""
        SELECT DATE(o.created_at) as sale_date, SUM(oi.quantity) as qty
        FROM "OrderItem" oi
        JOIN "Order" o ON oi.order_id = o.id
        WHERE o.org_id = :org_id AND oi.product_id = :product_id
        AND o.status IN ('DELIVERED', 'DISPATCHED')
        AND o.created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE(o.created_at)
        ORDER BY sale_date
    """)
    
    # Also fetch current inventory and lead time
    meta_query = text("""
        SELECT 
            (SELECT COALESCE(SUM(quantity), 0) FROM "Inventory" WHERE product_id = :product_id) as current_stock,
            (SELECT lead_time_days FROM "Product" WHERE id = :product_id LIMIT 1) as lead_time_days
    """)

    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"org_id": req.org_id, "product_id": req.product_id})
        meta_df = pd.read_sql(meta_query, conn, params={"product_id": req.product_id})
    
    current_stock = float(meta_df['current_stock'].iloc[0]) if not meta_df.empty else 0.0
    lead_time_days = float(meta_df['lead_time_days'].iloc[0]) if not meta_df.empty else 7.0
    
    if df.empty:
        # No data = return zero forecast
        future_dates = [(pd.Timestamp.now().normalize() + pd.Timedelta(days=i)).strftime("%Y-%m-%d") for i in range(1, req.horizon_days + 1)]
        return ForecastResponse(
            dates=future_dates,
            predicted=[0.0] * req.horizon_days,
            lower=[0.0] * req.horizon_days,
            upper=[0.0] * req.horizon_days,
            confidence=0.0,
            reorder_point=0.0,
            reorder_qty=0.0,
            model_used="none"
        )
        
    df['sale_date'] = pd.to_datetime(df['sale_date'])
    df.set_index('sale_date', inplace=True)
    
    # 2. Fill missing dates with 0
    full_idx = pd.date_range(start=df.index.min(), end=df.index.max(), freq='D')
    df = df.reindex(full_idx, fill_value=0.0).reset_index()
    df.columns = ['ds', 'y']
    
    total_days = len(df)
    
    # Calculate std dev and avg daily demand for safety stock
    std_dev = df['y'].std() if total_days > 1 else 0
    avg_daily_demand = df['y'].mean() if total_days > 0 else 0
    
    # Safety stock = 1.65 (Z-score for 95% service level) * std_dev * sqrt(lead_time_days)
    safety_stock = 1.65 * std_dev * math.sqrt(lead_time_days)
    reorder_point = (avg_daily_demand * lead_time_days) + safety_stock

    future_dates = [(pd.Timestamp.now().normalize() + pd.Timedelta(days=i)).strftime("%Y-%m-%d") for i in range(1, req.horizon_days + 1)]
    
    # Model Selection
    if total_days < 30 or not PROPHET_AVAILABLE:
        # 3. Simple Moving average baseline
        recent_y = df['y'].values[-14:] if total_days >= 14 else df['y'].values
        moving_avg = np.mean(recent_y) if len(recent_y) > 0 else 0.0
        
        predicted = [max(0.0, float(moving_avg))] * req.horizon_days
        lower = [max(0.0, p - std_dev) for p in predicted]
        upper = [p + std_dev for p in predicted]
        model_used = "moving_average"
        confidence = 0.5
    else:
        # 5. Facebook Prophet
        model = Prophet(weekly_seasonality=True, yearly_seasonality=(total_days >= 365), uncertainty_samples=100)
        
        # Indian Holiday Regressors (Proxy manual list for example)
        # In a real setup, we'd add `model.add_country_holidays(country_name='IN')` 
        # But Prophet's built-in doesn't have perfectly accurate Indian holidays always, so let's stick to built-in for simplicity
        model.add_country_holidays(country_name='IN')
        
        model.fit(df)
        
        future = model.make_future_dataframe(periods=req.horizon_days)
        forecast = model.predict(future)
        
        future_forecast = forecast.tail(req.horizon_days)
        
        predicted = [max(0.0, float(v)) for v in future_forecast['yhat'].values]
        lower = [max(0.0, float(v)) for v in future_forecast['yhat_lower'].values]
        upper = [max(0.0, float(v)) for v in future_forecast['yhat_upper'].values]
        model_used = "prophet"
        confidence = 0.85
        
    forecast_next_30 = sum(predicted)
    reorder_qty = max(0.0, forecast_next_30 - current_stock)
    
    return ForecastResponse(
        dates=future_dates,
        predicted=predicted,
        lower=lower,
        upper=upper,
        confidence=confidence,
        reorder_point=reorder_point,
        reorder_qty=reorder_qty,
        model_used=model_used
    )

@app.post("/score/payment", response_model=PaymentScoreResponse)
def compute_payment_score(req: PaymentScoreRequest):
    # Compute the customer payment score using native SQL
    # This replaces the TypeScript batch processing
    query = text("""
        SELECT status, due_date, paid_at, total_amount, paid_amount
        FROM "Invoice"
        WHERE customer_id = :customer_id AND org_id = :org_id
        AND status != 'DRAFT'
    """)
    
    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"customer_id": req.customer_id, "org_id": req.org_id})
        
    if df.empty:
        return PaymentScoreResponse(score=100, factors=[{"type": "info", "message": "No invoice history"}], explanation="New customer")
        
    df['due_date'] = pd.to_datetime(df['due_date'])
    df['paid_at'] = pd.to_datetime(df['paid_at'])
    
    score = 100.0
    factors = []
    
    # Factor 1: Unpaid Overdue (severe penalty)
    unpaid_overdue = df[(df['status'].isin(['SENT', 'PARTIAL', 'OVERDUE'])) & (df['due_date'] < pd.Timestamp.now())]
    if not unpaid_overdue.empty:
        penalty = min(50, len(unpaid_overdue) * 10)
        score -= penalty
        factors.append({"type": "negative", "message": f"{len(unpaid_overdue)} current overdue invoices", "impact": -penalty})
        
    # Factor 2: Late Payment History (moderate penalty)
    paid_late = df[(df['status'] == 'PAID') & (df['paid_at'] > df['due_date'])]
    if not paid_late.empty:
        avg_days_late = (paid_late['paid_at'] - paid_late['due_date']).dt.days.mean()
        penalty = min(30, int(avg_days_late * 0.5))
        score -= penalty
        factors.append({"type": "negative", "message": f"Historical late payments (avg {int(avg_days_late)} days)", "impact": -penalty})
        
    # Factor 3: Early Payment Bonus (positive)
    paid_early = df[(df['status'] == 'PAID') & (df['paid_at'] <= df['due_date'])]
    if not paid_early.empty and not unpaid_overdue.empty == False:
        bonus = min(15, len(paid_early) * 2)
        score += bonus
        factors.append({"type": "positive", "message": f"{len(paid_early)} on-time/early payments", "impact": bonus})
        
    final_score = max(0, min(100, int(score)))
    
    if final_score >= 80:
        exp = "Excellent payment behavior"
    elif final_score >= 50:
        exp = "Average payment history, watch for late payments"
    else:
        exp = "High risk! Consistent late payments or defaults"
        
    return PaymentScoreResponse(score=final_score, factors=factors, explanation=exp)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
