from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Capital One Nessie — https://api.nessieisreal.com
    nessie_api_key: str = ""
    nessie_base_url: str = "https://api.nessieisreal.com"

    # SerpApi — https://serpapi.com/manage-api-key
    serpapi_api_key: str = ""

    # Google Gemini — see .env.example for how to get a key
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    gemini_contract_model: str = ""  # reads contracts; empty = gemini_model (see evals/contract_eval.py)
    gemini_thinking_level: str = "low"  # "", "low" or "high"; "" uses the model default
    gemini_vertex: bool = False  # true for Vertex AI express-mode keys (restricted to aiplatform)

    # Tiger Data (Timescale Postgres) — connection string from the Tiger Cloud console
    tiger_database_url: str = ""

    # Snowflake Cortex REST (optional) — account URL + programmatic access token
    snowflake_account_url: str = ""  # e.g. https://abc12345.us-east-1.snowflakecomputing.com
    snowflake_pat: str = ""
    snowflake_model: str = "llama3.1-70b"

    # Resend (recall alert emails) — https://resend.com/api-keys
    resend_api_key: str = ""
    # onboarding@resend.dev only delivers to your own Resend account email; verify a domain to email anyone.
    alerts_from_email: str = "CarPlan <alerts@carplan.tech>"
    public_app_url: str = "http://localhost:3000"  # used in email links

    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
