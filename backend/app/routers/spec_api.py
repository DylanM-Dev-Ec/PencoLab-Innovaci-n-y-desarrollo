from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import BitacoraCampo, MedicionCrecimiento, Parcela, Planta
from app.models.enums import EstadoPlanta, TipoCarbono
from app.schemas import (
    IncentivoResponse,
    MedicionCreate,
    MedicionRead,
    SyncBitacoraBatchResponse,
    SyncBitacoraItem,
)
from app.services import get_planta_or_404, get_productor_or_404, utcnow
from app.utils.carbono import calcular_carbono_in_situ

router = APIRouter(prefix="/api", tags=["API Spec"])


@router.post("/sync", response_model=SyncBitacoraBatchResponse)
def sync_bitacora_offline(
    actividades: list[SyncBitacoraItem],
    db: Session = Depends(get_db),
):
    """
    Sincronización offline inteligente de bitácora_campo.
    Idempotencia estricta por UUID del dispositivo: si ya existe, se omite;
    si no, se inserta y se marca synced_at con la hora del servidor.
    """
    now = utcnow()
    insertados = 0
    omitidos = 0

    for item in actividades:
        existing = db.get(BitacoraCampo, item.id)
        if existing is not None:
            omitidos += 1
            continue

        db.add(
            BitacoraCampo(
                id=item.id,
                synced_at=now,
                **item.model_dump(exclude={"id"}),
            )
        )
        insertados += 1

    db.commit()
    return SyncBitacoraBatchResponse(
        sincronizado_en=now,
        recibidos=len(actividades),
        insertados=insertados,
        omitidos=omitidos,
    )


@router.post("/mediciones", response_model=MedicionRead, status_code=status.HTTP_201_CREATED)
def crear_medicion_in_situ(payload: MedicionCreate, db: Session = Depends(get_db)):
    """
    Medición física de campo con modelo alométrico de trazabilidad ambiental.
    Almacena carbono_verificado=TRUE (medición real in situ).
    """
    get_planta_or_404(db, payload.planta_id)
    now = utcnow()
    carbono = calcular_carbono_in_situ(payload.altura_roseta_cm, payload.numero_hojas)

    medicion = MedicionCrecimiento(
        planta_id=payload.planta_id,
        fecha_medicion=payload.fecha_medicion,
        altura_roseta_cm=payload.altura_roseta_cm,
        diametro_roseta_cm=payload.diametro_roseta_cm,
        numero_hojas=payload.numero_hojas,
        estado_general=payload.estado_general,
        tipo_carbono=TipoCarbono.VERIFICADO_IN_SITU.value,
        carbono_verificado=True,
        edad_planta_meses=payload.edad_planta_meses,
        biomasa_kg=carbono["biomasa_kg"],
        carbono_acumulado_kg=carbono["carbono_acumulado_kg"],
        co2_equivalente_kg=carbono["co2_equivalente_kg"],
        algoritmo_version="alometrico_v1",
        notas=payload.notas,
        synced_at=now,
    )
    db.add(medicion)
    db.commit()
    db.refresh(medicion)
    return medicion


@router.get("/productores/{productor_id}/incentivo", response_model=IncentivoResponse)
def incentivo_pacto_socioeconomico(productor_id: UUID, db: Session = Depends(get_db)):
    """
    Pacto socioeconómico: ≥1 penco sembrado en el último año
    por cada planta cosechada o chawada → pago preferencial
    (doble del precio de la leche por litro de chaguarmishky).
    """
    get_productor_or_404(db, productor_id)

    parcela_ids = [
        pid
        for (pid,) in db.query(Parcela.id).filter(Parcela.productor_id == productor_id).all()
    ]
    if not parcela_ids:
        return IncentivoResponse(
            productor_id=productor_id,
            cumple_pacto_social=True,
            plantas_sembradas_ultimo_anio=0,
            plantas_cosechadas_o_chawadas=0,
            califica_pago_preferencial=True,
            multiplicador_precio=2.0,
            mensaje=(
                "Sin cosechas registradas: el productor califica para el pago preferencial "
                "del doble del precio de la leche por cada litro de chaguarmishky (aguamiel) entregado."
            ),
            detalle_incentivo={
                "producto": "chaguarmishky",
                "unidad": "litro",
                "base": "precio_leche",
                "factor": 2.0,
            },
        )

    hace_un_anio = date.today() - timedelta(days=365)
    sembradas = (
        db.query(Planta)
        .filter(Planta.parcela_id.in_(parcela_ids), Planta.fecha_siembra >= hace_un_anio)
        .count()
    )
    cosechadas_chawadas = (
        db.query(Planta)
        .filter(
            Planta.parcela_id.in_(parcela_ids),
            Planta.estado.in_([EstadoPlanta.COSECHADA.value, EstadoPlanta.CHAWADA.value]),
        )
        .count()
    )

    cumple = sembradas >= cosechadas_chawadas
    if cumple:
        mensaje = (
            "Cumple el pacto social: califica para el pago preferencial del doble del precio "
            "de la leche por cada litro de chaguarmishky (aguamiel) entregado."
        )
    else:
        faltantes = cosechadas_chawadas - sembradas
        mensaje = (
            f"No cumple el pacto social: faltan {faltantes} planta(s) sembrada(s) en el último año "
            f"respecto a las {cosechadas_chawadas} cosechada(s)/chawada(s)."
        )

    return IncentivoResponse(
        productor_id=productor_id,
        cumple_pacto_social=cumple,
        plantas_sembradas_ultimo_anio=sembradas,
        plantas_cosechadas_o_chawadas=cosechadas_chawadas,
        califica_pago_preferencial=cumple,
        multiplicador_precio=2.0 if cumple else 1.0,
        mensaje=mensaje,
        detalle_incentivo={
            "producto": "chaguarmishky",
            "unidad": "litro",
            "base": "precio_leche",
            "factor": 2.0 if cumple else 1.0,
        },
    )
