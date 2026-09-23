import pytest


@pytest.fixture(autouse=True)
def offline_by_default(monkeypatch):
    """Never make paid/network model calls from tests, even with a developer's .env."""
    monkeypatch.setenv("AI_PROVIDER", "mock")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
