from __future__ import annotations

try:
    from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

    http_requests_total = Counter(
        "http_requests_total",
        "Total HTTP requests",
        ["service", "method", "path", "status_code"],
    )

    http_request_duration_seconds = Histogram(
        "http_request_duration_seconds",
        "HTTP request duration in seconds",
        ["service", "method", "path"],
        buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
    )

    model_calls_total = Counter(
        "model_calls_total",
        "Total model gateway calls",
        ["modality", "task", "provider", "status"],
    )

    model_cost_usd_total = Counter(
        "model_cost_usd_total",
        "Total model cost in USD",
        ["modality", "provider"],
    )

    lead_funnel_total = Counter(
        "lead_funnel_total",
        "Lead funnel events",
        ["stage", "status"],
    )

    def add_metrics_endpoint(app, service_name: str) -> None:
        import time
        from fastapi import Response, Request

        @app.get("/metrics", include_in_schema=False)
        def metrics_endpoint():
            return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

        @app.middleware("http")
        async def track_requests(request: Request, call_next):
            start = time.perf_counter()
            response = await call_next(request)
            duration = time.perf_counter() - start
            path = request.url.path
            if path not in ("/metrics", "/healthz"):
                http_requests_total.labels(
                    service=service_name,
                    method=request.method,
                    path=path,
                    status_code=str(response.status_code),
                ).inc()
                http_request_duration_seconds.labels(
                    service=service_name,
                    method=request.method,
                    path=path,
                ).observe(duration)
            return response

except ImportError:
    def add_metrics_endpoint(app, service_name: str) -> None:
        pass
