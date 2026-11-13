FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN groupadd --system app && useradd --system --gid app --home-dir /app app

COPY requirements.txt requirements-ml.txt ./
ARG INSTALL_ML_CLASSIFIER=false
RUN pip install --no-cache-dir -r requirements.txt \
    && if [ "$INSTALL_ML_CLASSIFIER" = "true" ]; then pip install --no-cache-dir -r requirements-ml.txt; fi

COPY --chown=app:app . .

USER app
EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && exec uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
