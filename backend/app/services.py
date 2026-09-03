from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import BitacoraCampo, MedicionCrecimiento, Parcela, Planta, Productor
from app.schemas import (
    BitacoraCreate,
    BitacoraUpdate,
    MedicionCreate,
    MedicionUpdate,
    ParcelaCreate,
    ParcelaUpdate,
    PlantaCreate,
    PlantaUpdate,
    ProductorCreate,
    ProductorUpdate,
)
from app.models.enums import TipoCarbono
from app.utils.agronomia import hijuelo_es_apto, recomendacion_ph
from app.utils.carbono import calcular_carbono_in_situ, estimar_carbono_teorico


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_productor_or_404(db: Session, productor_id: UUID) -> Productor:
    productor = db.get(Productor, productor_id)
    if not productor:
        raise HTTPException(status_code=404, detail="Productor no encontrado")
    return productor


def get_parcela_or_404(db: Session, parcela_id: UUID) -> Parcela:
    parcela = db.get(Parcela, parcela_id)
    if not parcela:
        raise HTTPException(status_code=404, detail="Parcela no encontrada")
    return parcela


def get_planta_or_404(db: Session, planta_id: UUID) -> Planta:
    planta = db.get(Planta, planta_id)
    if not planta:
        raise HTTPException(status_code=404, detail="Planta no encontrada")
    return planta


def get_medicion_or_404(db: Session, medicion_id: UUID) -> MedicionCrecimiento:
    medicion = db.get(MedicionCrecimiento, medicion_id)
    if not medicion:
        raise HTTPException(status_code=404, detail="Medición no encontrada")
    return medicion


def get_bitacora_or_404(db: Session, bitacora_id: UUID) -> BitacoraCampo:
    bitacora = db.get(BitacoraCampo, bitacora_id)
    if not bitacora:
        raise HTTPException(status_code=404, detail="Registro de bitácora no encontrado")
    return bitacora


def create_productor(db: Session, payload: ProductorCreate) -> Productor:
    if payload.id:
        existing = db.get(Productor, payload.id)
        if existing:
            return existing
    existing_email = db.query(Productor).filter(Productor.email == payload.email).first()
    if existing_email:
        return existing_email
    productor = Productor(**payload.model_dump(exclude_none=True))
    db.add(productor)
    db.commit()
    db.refresh(productor)
    return productor


def update_productor(db: Session, productor: Productor, payload: ProductorUpdate) -> Productor:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(productor, field, value)
    db.commit()
    db.refresh(productor)
    return productor


def create_parcela(db: Session, payload: ParcelaCreate, *, mark_synced: bool = True) -> Parcela:
    get_productor_or_404(db, payload.productor_id)
    data = payload.model_dump()
    data["recomendacion_ph"] = recomendacion_ph(payload.ph)
    if mark_synced:
        data["synced_at"] = utcnow()
    parcela = Parcela(**data)
    db.add(parcela)
    db.commit()
    db.refresh(parcela)
    return parcela


def update_parcela(
    db: Session, parcela: Parcela, payload: ParcelaUpdate, *, mark_synced: bool = True, commit: bool = True
) -> Parcela:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(parcela, field, value)
    if "ph" in data:
        parcela.recomendacion_ph = recomendacion_ph(parcela.ph)
    if mark_synced:
        parcela.synced_at = utcnow()
    if commit:
        db.commit()
        db.refresh(parcela)
    else:
        db.flush()
    return parcela


def create_planta(db: Session, payload: PlantaCreate, *, mark_synced: bool = True) -> Planta:
    parcela = get_parcela_or_404(db, payload.parcela_id)
    data = payload.model_dump()
    data["hijuelo_apto"] = hijuelo_es_apto(
        data.get("peso_hijuelo_kg"),
        data.get("tamano_roseta_inicial_cm"),
        data.get("edad_planta_madre_anios"),
    )
    if mark_synced:
        data["synced_at"] = utcnow()
    planta = Planta(**data)
    db.add(planta)
    db.flush()
    from app.routers.planes_accion import activar_planes_por_siembra_georef

    activar_planes_por_siembra_georef(db, productor_id=parcela.productor_id, planta=planta)
    db.commit()
    db.refresh(planta)
    return planta


def update_planta(
    db: Session, planta: Planta, payload: PlantaUpdate, *, mark_synced: bool = True, commit: bool = True
) -> Planta:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(planta, field, value)
    planta.hijuelo_apto = hijuelo_es_apto(
        planta.peso_hijuelo_kg,
        planta.tamano_roseta_inicial_cm,
        planta.edad_planta_madre_anios,
    )
    if mark_synced:
        planta.synced_at = utcnow()
    parcela = get_parcela_or_404(db, planta.parcela_id)
    from app.routers.planes_accion import activar_planes_por_siembra_georef

    activar_planes_por_siembra_georef(db, productor_id=parcela.productor_id, planta=planta)
    if commit:
        db.commit()
        db.refresh(planta)
    else:
        db.flush()
    return planta


def apply_carbono(medicion: MedicionCrecimiento, calcular: bool) -> None:
    if not calcular:
        return
    tipo = medicion.tipo_carbono
    tipo_val = tipo.value if hasattr(tipo, "value") else tipo
    if tipo_val == TipoCarbono.VERIFICADO_IN_SITU.value or medicion.carbono_verificado:
        carbono = calcular_carbono_in_situ(medicion.altura_roseta_cm, medicion.numero_hojas)
        medicion.carbono_verificado = True
        medicion.tipo_carbono = TipoCarbono.VERIFICADO_IN_SITU.value
        medicion.algoritmo_version = "alometrico_v1"
    else:
        carbono = estimar_carbono_teorico(
            medicion.altura_roseta_cm,
            medicion.diametro_roseta_cm,
            medicion.edad_planta_meses,
        )
        medicion.carbono_verificado = False
        medicion.algoritmo_version = "teorico_v1"
    medicion.biomasa_kg = carbono["biomasa_kg"]
    medicion.carbono_acumulado_kg = carbono["carbono_acumulado_kg"]
    medicion.co2_equivalente_kg = carbono["co2_equivalente_kg"]


def create_medicion(db: Session, payload: MedicionCreate, *, mark_synced: bool = True) -> MedicionCrecimiento:
    get_planta_or_404(db, payload.planta_id)
    data = payload.model_dump(exclude={"calcular_carbono"})
    if mark_synced:
        data["synced_at"] = utcnow()
    medicion = MedicionCrecimiento(**data)
    apply_carbono(medicion, payload.calcular_carbono)
    db.add(medicion)
    db.commit()
    db.refresh(medicion)
    return medicion


def update_medicion(
    db: Session,
    medicion: MedicionCrecimiento,
    payload: MedicionUpdate,
    *,
    mark_synced: bool = True,
    commit: bool = True,
) -> MedicionCrecimiento:
    data = payload.model_dump(exclude_unset=True, exclude={"calcular_carbono"})
    for field, value in data.items():
        setattr(medicion, field, value)
    apply_carbono(medicion, payload.calcular_carbono)
    if mark_synced:
        medicion.synced_at = utcnow()
    if commit:
        db.commit()
        db.refresh(medicion)
    else:
        db.flush()
    return medicion


def create_bitacora(db: Session, payload: BitacoraCreate, *, mark_synced: bool = True) -> BitacoraCampo:
    get_productor_or_404(db, payload.productor_id)
    parcela = get_parcela_or_404(db, payload.parcela_id)
    if parcela.productor_id != payload.productor_id:
        raise HTTPException(status_code=400, detail="La parcela no pertenece al productor")
    if payload.planta_id:
        planta = get_planta_or_404(db, payload.planta_id)
        if planta.parcela_id != payload.parcela_id:
            raise HTTPException(status_code=400, detail="La planta no pertenece a la parcela")
    data = payload.model_dump()
    if mark_synced:
        data["synced_at"] = utcnow()
    bitacora = BitacoraCampo(**data)
    db.add(bitacora)
    db.commit()
    db.refresh(bitacora)
    return bitacora


def update_bitacora(
    db: Session,
    bitacora: BitacoraCampo,
    payload: BitacoraUpdate,
    *,
    mark_synced: bool = True,
    commit: bool = True,
) -> BitacoraCampo:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(bitacora, field, value)
    if mark_synced:
        bitacora.synced_at = utcnow()
    if commit:
        db.commit()
        db.refresh(bitacora)
    else:
        db.flush()
    return bitacora
