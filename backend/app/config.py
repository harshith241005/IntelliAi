from typing import List, Set
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./db.sqlite3",
        description="Database connection URL. Falls back to a local SQLite file."
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL."
    )
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    AUTH_DISABLED: bool = True
    API_KEYS: str = "key1,key2"
    MOCK_PIPELINE: bool = True
    MOCK_EVENT_INTERVAL_MS: int = 2000
    
    # Restricted zones matching database keys
    RESTRICTED_ZONES: str = "zone_restricted_loading,zone_restricted_safe"
    
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def api_key_list(self) -> List[str]:
        return [k.strip() for k in self.API_KEYS.split(",") if k.strip()]

    @property
    def restricted_zone_set(self) -> Set[str]:
        return {z.strip() for z in self.RESTRICTED_ZONES.split(",") if z.strip()}

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

settings = Settings()
