from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Capital One Nessie — http://api.nessieisreal.com
    nessie_api_key: str = ""
    nessie_base_url: str = "http://api.nessieisreal.com"

    # SerpApi — https://serpapi.com/manage-api-key
    serpapi_api_key: str = ""

    # Google Gemini — https://aistudio.google.com/apikey
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # Tiger Data (Timescale Postgres) — connection string from the Tiger Cloud console
    tiger_database_url: str = ""

    # Snowflake Cortex REST (optional) — account URL + programmatic access token
    snowflake_account_url: str = ""  # e.g. https://abc12345.us-east-1.snowflakecomputing.com
    snowflake_pat: str = ""
    snowflake_model: str = "llama3.1-70b"

    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
