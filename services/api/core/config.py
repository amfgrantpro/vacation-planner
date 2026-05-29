from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    GROQ_API_KEY: str
    OPENAI_API_KEY: str = ""
    UNSPLASH_ACCESS_KEY: str = ""
    GROQ_PRIMARY_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_FALLBACK_MODEL: str = "qwen/qwen3-32b"
    
    class Config:
        env_file = [".env", "../.env", "../../.env", "../../../.env"]
        extra = "ignore"

settings = Settings()
