FROM python:3.13-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app
COPY pyproject.toml poetry.lock* ./
RUN uv venv /app/.venv && uv sync --frozen --no-dev --no-install-project

COPY src/market_intelligence /app/src/market_intelligence
RUN uv sync --frozen --no-dev

FROM python:3.13-slim AS production

RUN groupadd -r miuser && useradd -r -g miuser miuser

WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app/src"

USER miuser

ENTRYPOINT ["python", "-m", "market_intelligence"]
CMD ["--country", "SE"]
