from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    port: int = Field(8000, env="PORT")
    redis_url: str = Field("redis://localhost:6379", env="REDIS_URL")

    booksy_username_suc1: str = Field("", env="BOOKSY_USERNAME_SUC1")
    booksy_password_suc1: str = Field("", env="BOOKSY_PASSWORD_SUC1")
    booksy_location_id_suc1: str = Field("", env="BOOKSY_LOCATION_ID_SUC1")

    booksy_username_suc2: str = Field("", env="BOOKSY_USERNAME_SUC2")
    booksy_password_suc2: str = Field("", env="BOOKSY_PASSWORD_SUC2")
    booksy_location_id_suc2: str = Field("", env="BOOKSY_LOCATION_ID_SUC2")

    barbershop_timezone: str = Field("America/Mazatlan", env="BARBERSHOP_TIMEZONE")
    log_level: str = Field("INFO", env="LOG_LEVEL")

    # Playwright
    headless: bool = True
    storage_state_dir: str = "/app/storage_state/sessions"
    failure_snapshots_dir: str = "/app/storage_state/failures"

    # Circuit breaker
    cb_failure_threshold: int = 3
    cb_recovery_timeout: int = 300  # 5 minutos en segundos
    cb_window_seconds: int = 60

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
