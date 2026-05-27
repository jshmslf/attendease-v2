FROM python:3.11-slim

WORKDIR /app

# Install dlib-bin (pre-built binary - no cmake, no compilation, no RAM spike)
# Also install face-recognition's other deps that we skip below
RUN pip install --no-cache-dir \
    dlib-bin==19.24.6 \
    face-recognition-models==0.3.0 \
    Pillow \
    scipy

# Install face-recognition WITHOUT its dlib dependency
# (dlib-bin already provides the dlib module at runtime)
RUN pip install --no-cache-dir face-recognition==1.3.0 --no-deps

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
