FROM python:3.13-slim

WORKDIR /app
COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgtk-3-0 libx11-xcb1 libasound2 libdbus-glib-1-2 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir -r api/requirements.txt
RUN python -m camoufox fetch

WORKDIR /app/api
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
