from __future__ import annotations
import logging
import os
import sys

try:
    import structlog

    def configure_logging() -> None:
        log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
        fmt = os.environ.get("LOG_FORMAT", "json")
        processors = [
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
        ]
        if fmt == "pretty":
            processors.append(structlog.dev.ConsoleRenderer())
        else:
            processors.append(structlog.processors.JSONRenderer())

        structlog.configure(
            processors=processors,
            wrapper_class=structlog.make_filtering_bound_logger(
                getattr(logging, log_level, logging.INFO)
            ),
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(sys.stdout),
            cache_logger_on_first_use=True,
        )

    get_logger = structlog.get_logger

except ImportError:
    def configure_logging() -> None:
        logging.basicConfig(
            stream=sys.stdout,
            level=os.environ.get("LOG_LEVEL", "INFO").upper(),
            format='{"ts":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
        )

    def get_logger(name: str = "app"):
        return logging.getLogger(name)
