from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import inspect, text

from app.config import settings
from app.database import Base, engine
from app.models import (  # noqa: F401
    BitacoraCampo,
    CertificacionLote,
    InventarioResiduo,
    MedicionCrecimiento,
    Parcela,
    PlanAccionSiembra,
    Planta,
    ProduccionMensual,
    Productor,
    RecoleccionJornada,
    Usuario,
    ViveroSemilla,
)
from app.routers import api, auth, certificacion, dashboard, empresa, planes_accion, spec_api, sync
from app.seed import seed_owner_accounts


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
    if "mediciones_crecimiento" in tables:
        columns = {col["name"] for col in inspector.get_columns("mediciones_crecimiento")}
        if "carbono_verificado" not in columns:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE mediciones_crecimiento "
                        "ADD COLUMN carbono_verificado BOOLEAN NOT NULL DEFAULT 0"
                    )
                )
    if "certificacion_lote" not in tables:
        CertificacionLote.__table__.create(bind=engine)

    # Agave Andino — economía circular / vivero / recolección / destilación
    if "parcelas" in tables:
        pcols = {col["name"] for col in inspector.get_columns("parcelas")}
        with engine.begin() as conn:
            if "tipo_trazado" not in pcols:
                conn.execute(text("ALTER TABLE parcelas ADD COLUMN tipo_trazado VARCHAR(20)"))
            if "metas_expansion_ha" not in pcols:
                conn.execute(
                    text(
                        "ALTER TABLE parcelas ADD COLUMN metas_expansion_ha "
                        "NUMERIC(8, 2) NOT NULL DEFAULT 20.0"
                    )
                )
            if "estado_lote" not in pcols:
                conn.execute(text("ALTER TABLE parcelas ADD COLUMN estado_lote VARCHAR(20)"))
    if "plantas" in tables:
        plcols = {col["name"] for col in inspector.get_columns("plantas")}
        if "tipo_propagacion" not in plcols:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE plantas ADD COLUMN tipo_propagacion "
                        "VARCHAR(20) NOT NULL DEFAULT 'hijuelo'"
                    )
                )

    for model in (ViveroSemilla, RecoleccionJornada, InventarioResiduo, ProduccionMensual, PlanAccionSiembra):
        if model.__tablename__ not in tables:
            model.__table__.create(bind=engine)
@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _ensure_auth_schema()
    seed_owner_accounts()
    yield


app = FastAPI(
    title="PencoLab API",
    description="API para gestión de cultivo de Penco con soporte offline-first",
    version="1.0.0",
    lifespan=lifespan,
)

_cors = settings.cors_origin_list()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(spec_api.router)
app.include_router(certificacion.router)
app.include_router(dashboard.router)
app.include_router(api.router)
app.include_router(empresa.router)
app.include_router(sync.router)
app.include_router(planes_accion.router)


@app.get("/")
def root():
    return {
        "app": "PencoLab API",
        "docs": "/docs",
        "health": "/api/v1/health",
    }
