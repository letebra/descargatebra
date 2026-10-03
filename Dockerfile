FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=8000
# Keep memory low on small instances: fewer malloc arenas and a capped Deno (V8) heap.
ENV MALLOC_ARENA_MAX=2 DENO_V8_FLAGS=--max-old-space-size=300
CMD uvicorn app:app --host 0.0.0.0 --port $PORT
