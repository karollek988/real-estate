# Stage 1: Build
FROM python:3.13-slim AS builder

WORKDIR /app

# Install system dependencies for building
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY pyproject.toml uv.lock README.md ./

# Create virtual environment and install dependencies
RUN uv venv /app/.venv && \
    uv sync --frozen --no-dev --no-install-project

# Stage 2: Production
FROM python:3.13-slim AS production

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libxml2 \
    libxslt1.1 \
    libpng-dev \
    libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r brfuser && useradd -r -g brfuser -d /app -s /sbin/nologin brfuser

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Add venv to PATH
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app/src"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Copy application code
COPY src/ ./src/
COPY configs/ ./configs/

# Create data directories
RUN mkdir -p data/pdfs data/exports && \
    chown -R brfuser:brfuser /app

# Switch to non-root user
USER brfuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health')" || exit 1

# Expose port
EXPOSE 8000

# Default command
ENTRYPOINT ["python", "-m", "brf_scraper"]
CMD ["serve"]
