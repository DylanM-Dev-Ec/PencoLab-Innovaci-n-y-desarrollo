from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./pencolab.db"
    debug: bool = False
    jwt_secret: str = "pencolab-dev-secret-cambiar-en-produccion"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480
    # Orígenes permitidos para CORS (coma-separados). "*" = todos (demo/hackathon).
    cors_origins: str = "*"

    def cors_origin_list(self) -> list[str]:
        raw = (self.cors_origins or "*").strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]


settings = Settings()
