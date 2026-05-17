FROM python:3.11-slim

WORKDIR /app

# Install dlib-bin first (pre-built wheel — no compilation, no RAM spike)
RUN pip install --no-cache-dir dlib-bin==19.24.6

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
