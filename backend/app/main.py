from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import inspect, text

from app.database import Base, engine
from app.models import BitacoraCampo, MedicionCrecimiento, Parcela, Planta, Productor, Usuario  # noqa: F401
from app.routers import api, auth, sync


def _ensure_auth_schema() -> None:
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if "usuarios" not in tables:
        Usuario.__table__.create(bind=engine)
    if "productores" in tables:
        columns = {col["name"] for col in inspector.get_columns("productores")}
        if "usuario_id" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE productores ADD COLUMN usuario_id INTEGER"))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _ensure_auth_schema()
    yield


app = FastAPI(
    title="PencoLab API",
    description="API para gestión de cultivo de Penco con soporte offline-first",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(api.router)
app.include_router(sync.router)


@app.get("/")
def root():
    return {
        "app": "PencoLab API",
        "docs": "/docs",
        "health": "/api/v1/health",
    }
