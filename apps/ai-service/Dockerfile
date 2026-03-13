FROM python:3.11-slim

WORKDIR /app

# Install build dependencies for Prophet/pandas (gcc, g++, build-essential)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose FastAPI port
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0", "--port", "8000", "--workers", "2"]
