# One image, reused by every service — they share a codebase and differ only by
# the uvicorn target (set per service in docker-compose.yml). ffmpeg is included
# because the studio's render/mix stages need it.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

# Default target is the gateway; compose overrides `command` for the others.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
