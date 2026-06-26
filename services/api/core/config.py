from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    GROQ_API_KEY: str
    GROQ_API_KEY_2: str = ""  # second Groq account for the Comparison/Decision agent;
                              # falls back to GROQ_API_KEY if unset
    OPENAI_API_KEY: str = ""
    UNSPLASH_ACCESS_KEY: str = ""
    GROQ_PRIMARY_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_FALLBACK_MODEL: str = "openai/gpt-oss-120b"
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    
    class Config:
        env_file = [".env", "../.env", "../../.env", "../../../.env"]
        extra = "ignore"

settings = Settings()
