class GatewayError(Exception):
    """Base error for the model gateway."""


class ProviderError(GatewayError):
    """A provider failed to produce a result (down, rate-limited, misconfigured).

    The router catches this and tries the next provider in the fallback chain.
    """


class NoEligibleProvider(GatewayError):
    """No registered provider satisfied the route + capability + cost policy."""
