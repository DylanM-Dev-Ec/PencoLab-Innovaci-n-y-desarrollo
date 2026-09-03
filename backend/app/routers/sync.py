from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import BitacoraCampo, MedicionCrecimiento, Parcela, Planta
from app.routers.planes_accion import activar_planes_por_siembra_georef
from app.schemas import (
    BitacoraRead,
    BitacoraUpdate,
    MedicionRead,
    MedicionUpdate,
    ParcelaRead,
    ParcelaUpdate,
    PlantaRead,
    PlantaUpdate,
    SyncPullResponse,
    SyncPushPayload,
    SyncPushResponse,
)
from app.services import (
    apply_carbono,
    get_productor_or_404,
    update_bitacora,
    update_medicion,
    update_parcela,
    update_planta,
    utcnow,
)
from app.utils.agronomia import hijuelo_es_apto, recomendacion_ph

router = APIRouter(prefix="/api/v1/sync", tags=["Sincronización Offline"])


@router.post("/push", response_model=SyncPushResponse)
def sync_push(payload: SyncPushPayload, db: Session = Depends(get_db)):
    """Recibe datos creados offline desde el móvil y los upserta en el servidor."""
    get_productor_or_404(db, payload.productor_id)
    now = utcnow()

    for item in payload.parcelas:
        if item.productor_id != payload.productor_id:
            continue
        parcela = db.get(Parcela, item.id)
        if parcela:
            update_parcela(
                db,
                parcela,
                ParcelaUpdate(**item.model_dump(exclude={"id", "productor_id"})),
                mark_synced=True,
                commit=False,
            )
        else:
            db.add(
                Parcela(
                    id=item.id,
                    productor_id=item.productor_id,
                    recomendacion_ph=recomendacion_ph(item.ph),
                    synced_at=now,
                    **item.model_dump(exclude={"id", "productor_id"}),
                )
            )

    for item in payload.plantas:
        planta = db.get(Planta, item.id)
        if planta:
            update_planta(
                db,
                planta,
                PlantaUpdate(**item.model_dump(exclude={"id", "parcela_id"})),
                mark_synced=True,
                commit=False,
            )
        else:
            data = item.model_dump(exclude={"id"})
            data["hijuelo_apto"] = hijuelo_es_apto(
                data.get("peso_hijuelo_kg"),
                data.get("tamano_roseta_inicial_cm"),
                data.get("edad_planta_madre_anios"),
            )
            data["synced_at"] = now
            planta_nueva = Planta(id=item.id, **data)
            db.add(planta_nueva)
            db.flush()
            activar_planes_por_siembra_georef(
                db, productor_id=payload.productor_id, planta=planta_nueva
            )

    for item in payload.mediciones:
        medicion = db.get(MedicionCrecimiento, item.id)
        if medicion:
            update_medicion(
                db,
                medicion,
                MedicionUpdate(
                    **item.model_dump(
                        exclude={"id", "planta_id", "calcular_carbono", "algoritmo_version"}
                    ),
                    calcular_carbono=item.calcular_carbono,
                ),
                mark_synced=True,
                commit=False,
            )
        else:
            data = item.model_dump(exclude={"id", "planta_id", "calcular_carbono"})
            medicion = MedicionCrecimiento(
                id=item.id,
                planta_id=item.planta_id,
                synced_at=now,
                **data,
            )
            apply_carbono(medicion, item.calcular_carbono)
            db.add(medicion)

    for item in payload.bitacora:
        if item.productor_id != payload.productor_id:
            continue
        bitacora = db.get(BitacoraCampo, item.id)
        if bitacora:
            update_bitacora(
                db,
                bitacora,
                BitacoraUpdate(**item.model_dump(exclude={"id", "productor_id", "parcela_id", "planta_id"})),
                mark_synced=True,
                commit=False,
            )
        else:
            db.add(
                BitacoraCampo(
                    id=item.id,
                    synced_at=now,
                    **item.model_dump(exclude={"id"}),
                )
            )

    db.commit()

    return SyncPushResponse(
        productor_id=payload.productor_id,
        sincronizado_en=now,
        parcelas_procesadas=len(payload.parcelas),
        plantas_procesadas=len(payload.plantas),
        mediciones_procesadas=len(payload.mediciones),
        bitacora_procesadas=len(payload.bitacora),
    )


@router.get("/pull", response_model=SyncPullResponse)
def sync_pull(
    productor_id: UUID,
    since: str | None = Query(None, description="ISO datetime; devuelve cambios posteriores"),
    db: Session = Depends(get_db),
):
    """Descarga datos del servidor hacia el dispositivo móvil."""
    from datetime import datetime

    from fastapi import HTTPException

    get_productor_or_404(db, productor_id)
    now = utcnow()
    since_dt = None
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"since inválido: {since}") from exc

    # Parcelas del productor (filtro since solo en esta tabla)
    parcelas_q = db.query(Parcela).filter(Parcela.productor_id == productor_id)
    if since_dt:
        parcelas_q = parcelas_q.filter(Parcela.updated_at >= since_dt)
    parcelas = parcelas_q.all()

    # Plantas: todas las del productor (vía join), no solo las de parcelas filtradas
    plantas_q = (
        db.query(Planta)
        .join(Parcela, Planta.parcela_id == Parcela.id)
        .filter(Parcela.productor_id == productor_id)
    )
    if since_dt:
        plantas_q = plantas_q.filter(Planta.updated_at >= since_dt)
    plantas = plantas_q.all()

    # Mediciones: vía plantas del productor
    mediciones_q = (
        db.query(MedicionCrecimiento)
        .join(Planta, MedicionCrecimiento.planta_id == Planta.id)
        .join(Parcela, Planta.parcela_id == Parcela.id)
        .filter(Parcela.productor_id == productor_id)
    )
    if since_dt:
        mediciones_q = mediciones_q.filter(MedicionCrecimiento.created_at >= since_dt)
    mediciones = mediciones_q.all()

    bitacora_q = db.query(BitacoraCampo).filter(BitacoraCampo.productor_id == productor_id)
    if since_dt:
        bitacora_q = bitacora_q.filter(BitacoraCampo.updated_at >= since_dt)
    bitacora = bitacora_q.all()

    return SyncPullResponse(
        productor_id=productor_id,
        sincronizado_en=now,
        parcelas=[ParcelaRead.model_validate(p) for p in parcelas],
        plantas=[PlantaRead.model_validate(p) for p in plantas],
        mediciones=[MedicionRead.model_validate(m) for m in mediciones],
        bitacora=[BitacoraRead.model_validate(b) for b in bitacora],
    )
