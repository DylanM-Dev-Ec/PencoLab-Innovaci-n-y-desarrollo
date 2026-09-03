from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import BitacoraCampo, MedicionCrecimiento, Parcela, Planta, Productor
from app.schemas import (
    BitacoraCreate,
    BitacoraRead,
    BitacoraUpdate,
    MedicionCreate,
    MedicionRead,
    MedicionUpdate,
    ParcelaCreate,
    ParcelaRead,
    ParcelaUpdate,
    PlantaCreate,
    PlantaRead,
    PlantaUpdate,
    ProductorCreate,
    ProductorRead,
    ProductorUpdate,
)
from app.services import (
    create_bitacora,
    create_medicion,
    create_parcela,
    create_planta,
    create_productor,
    get_bitacora_or_404,
    get_medicion_or_404,
    get_parcela_or_404,
    get_planta_or_404,
    get_productor_or_404,
    update_bitacora,
    update_medicion,
    update_parcela,
    update_planta,
    update_productor,
)

router = APIRouter(prefix="/api/v1", tags=["PencoLab"])


@router.get("/health")
def health_check():
    return {"status": "ok", "app": "PencoLab API"}


# --- Productores ---


@router.post("/productores", response_model=ProductorRead, status_code=status.HTTP_201_CREATED)
def crear_productor(payload: ProductorCreate, db: Session = Depends(get_db)):
    return create_productor(db, payload)


@router.post("/productores/ensure", response_model=ProductorRead)
def asegurar_productor(payload: ProductorCreate, db: Session = Depends(get_db)):
    return create_productor(db, payload)


@router.get("/productores", response_model=list[ProductorRead])
def listar_productores(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Productor).offset(skip).limit(limit).all()


@router.get("/productores/{productor_id}", response_model=ProductorRead)
def obtener_productor(productor_id: UUID, db: Session = Depends(get_db)):
    return get_productor_or_404(db, productor_id)


@router.patch("/productores/{productor_id}", response_model=ProductorRead)
def editar_productor(productor_id: UUID, payload: ProductorUpdate, db: Session = Depends(get_db)):
    productor = get_productor_or_404(db, productor_id)
    return update_productor(db, productor, payload)


@router.delete("/productores/{productor_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_productor(productor_id: UUID, db: Session = Depends(get_db)):
    productor = get_productor_or_404(db, productor_id)
    db.delete(productor)
    db.commit()


# --- Parcelas ---


@router.post("/parcelas", response_model=ParcelaRead, status_code=status.HTTP_201_CREATED)
def crear_parcela(payload: ParcelaCreate, db: Session = Depends(get_db)):
    return create_parcela(db, payload)


@router.get("/parcelas", response_model=list[ParcelaRead])
def listar_parcelas(
    productor_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(Parcela)
    if productor_id:
        query = query.filter(Parcela.productor_id == productor_id)
    return query.offset(skip).limit(limit).all()


@router.get("/parcelas/{parcela_id}", response_model=ParcelaRead)
def obtener_parcela(parcela_id: UUID, db: Session = Depends(get_db)):
    return get_parcela_or_404(db, parcela_id)


@router.patch("/parcelas/{parcela_id}", response_model=ParcelaRead)
def editar_parcela(parcela_id: UUID, payload: ParcelaUpdate, db: Session = Depends(get_db)):
    parcela = get_parcela_or_404(db, parcela_id)
    return update_parcela(db, parcela, payload)


@router.delete("/parcelas/{parcela_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_parcela(parcela_id: UUID, db: Session = Depends(get_db)):
    parcela = get_parcela_or_404(db, parcela_id)
    db.delete(parcela)
    db.commit()


# --- Plantas ---


@router.post("/plantas", response_model=PlantaRead, status_code=status.HTTP_201_CREATED)
def crear_planta(payload: PlantaCreate, db: Session = Depends(get_db)):
    return create_planta(db, payload)


@router.get("/plantas", response_model=list[PlantaRead])
def listar_plantas(
    parcela_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(Planta)
    if parcela_id:
        query = query.filter(Planta.parcela_id == parcela_id)
    return query.offset(skip).limit(limit).all()


@router.get("/plantas/{planta_id}", response_model=PlantaRead)
def obtener_planta(planta_id: UUID, db: Session = Depends(get_db)):
    return get_planta_or_404(db, planta_id)


@router.patch("/plantas/{planta_id}", response_model=PlantaRead)
def editar_planta(planta_id: UUID, payload: PlantaUpdate, db: Session = Depends(get_db)):
    planta = get_planta_or_404(db, planta_id)
    return update_planta(db, planta, payload)


@router.delete("/plantas/{planta_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_planta(planta_id: UUID, db: Session = Depends(get_db)):
    planta = get_planta_or_404(db, planta_id)
    db.delete(planta)
    db.commit()


# --- Mediciones ---


@router.post("/mediciones", response_model=MedicionRead, status_code=status.HTTP_201_CREATED)
def crear_medicion(payload: MedicionCreate, db: Session = Depends(get_db)):
    return create_medicion(db, payload)


@router.get("/mediciones", response_model=list[MedicionRead])
def listar_mediciones(
    planta_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(MedicionCrecimiento)
    if planta_id:
        query = query.filter(MedicionCrecimiento.planta_id == planta_id)
    return query.order_by(MedicionCrecimiento.fecha_medicion.desc()).offset(skip).limit(limit).all()


@router.get("/mediciones/{medicion_id}", response_model=MedicionRead)
def obtener_medicion(medicion_id: UUID, db: Session = Depends(get_db)):
    return get_medicion_or_404(db, medicion_id)


@router.patch("/mediciones/{medicion_id}", response_model=MedicionRead)
def editar_medicion(medicion_id: UUID, payload: MedicionUpdate, db: Session = Depends(get_db)):
    medicion = get_medicion_or_404(db, medicion_id)
    return update_medicion(db, medicion, payload)


@router.delete("/mediciones/{medicion_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_medicion(medicion_id: UUID, db: Session = Depends(get_db)):
    medicion = get_medicion_or_404(db, medicion_id)
    db.delete(medicion)
    db.commit()


# --- Bitácora de campo ---


@router.post("/bitacora", response_model=BitacoraRead, status_code=status.HTTP_201_CREATED)
def crear_bitacora(payload: BitacoraCreate, db: Session = Depends(get_db)):
    return create_bitacora(db, payload)


@router.get("/bitacora", response_model=list[BitacoraRead])
def listar_bitacora(
    productor_id: UUID | None = None,
    parcela_id: UUID | None = None,
    planta_id: UUID | None = None,
    tipo: str | None = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(BitacoraCampo)
    if productor_id:
        query = query.filter(BitacoraCampo.productor_id == productor_id)
    if parcela_id:
        query = query.filter(BitacoraCampo.parcela_id == parcela_id)
    if planta_id:
        query = query.filter(BitacoraCampo.planta_id == planta_id)
    if tipo:
        query = query.filter(BitacoraCampo.tipo == tipo)
    return query.order_by(BitacoraCampo.fecha_programada.desc()).offset(skip).limit(limit).all()


@router.get("/bitacora/{bitacora_id}", response_model=BitacoraRead)
def obtener_bitacora(bitacora_id: UUID, db: Session = Depends(get_db)):
    return get_bitacora_or_404(db, bitacora_id)


@router.patch("/bitacora/{bitacora_id}", response_model=BitacoraRead)
def editar_bitacora(bitacora_id: UUID, payload: BitacoraUpdate, db: Session = Depends(get_db)):
    bitacora = get_bitacora_or_404(db, bitacora_id)
    return update_bitacora(db, bitacora, payload)


@router.delete("/bitacora/{bitacora_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_bitacora(bitacora_id: UUID, db: Session = Depends(get_db)):
    bitacora = get_bitacora_or_404(db, bitacora_id)
    db.delete(bitacora)
    db.commit()
