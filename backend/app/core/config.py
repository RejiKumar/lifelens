"""Application configuration driven by environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings. No secret values are stored here; they are injected
    per environment by CI/CD and read from the environment.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "dev"
    app_name: str = "LifeLens API"
    debug: bool = False

    database_url: str = ""

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    cors_origins: list[str] = ["*"]

    storage_bucket: str = ""
    max_upload_bytes: int = 15 * 1024 * 1024
    max_input_dimension: int = 8192
    min_input_dimension: int = 200
    output_dimension: int = 2048
    output_quality: int = 85
    guest_ttl_days: int = 7
    signed_url_ttl_seconds: int = 300
    analysis_timeout_seconds: int = 45
    ai_provider: str = "gemini"
    google_ai_api_key: str = ""
    ai_model_gemini: str = "gemini-2.5-flash"
    ai_timeout_seconds: float = 30.0
    ai_temperature: float = 0.2
    ai_max_tokens: int = 2048
    ai_top_p: float = 0.95


@lru_cache
def get_settings() -> Settings:
    return Settings()
