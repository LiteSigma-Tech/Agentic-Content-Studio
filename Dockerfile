# One image, reused by every service — they share a codebase and differ only by
# the uvicorn target (set per service in docker-compose.yml). ffmpeg is included
# because the studio's render/mix stages need it.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

# Create every runtime data directory that gets mounted as a Docker volume so
# the named volumes are initialised with appuser ownership on first boot.
# (Docker copies the image directory's permissions into a named volume on first
# creation; if the directory doesn't exist it defaults to root.)
RUN mkdir -p /tmp/video_studio /tmp/agent_runs /tmp/gateway_media \
    && chown -R appuser:appuser /app /tmp/video_studio /tmp/agent_runs /tmp/gateway_media

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
