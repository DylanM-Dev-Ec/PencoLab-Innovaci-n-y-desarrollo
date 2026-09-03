"""
Certificación de calidad de siembra — Método técnico de México.
"""

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CertificacionLote, Parcela
from app.schemas import CertificacionLoteCreate, CertificacionLoteRead
from app.services import utcnow

router = APIRouter(prefix="/api", tags=["Certificación Método Mexicano"])

UMBRAL_PAGO_PREFERENCIAL = Decimal("0.90")
ESTADO_APTO = "Apto para Pago Preferencial (Doble del precio de la leche)"
ESTADO_NO_APTO = "No apto — completar Guía de Siembra Método Mexicano"


def _calcular_puntuacion(
    hijuelos: bool,
    fuego: bool,
    cicatrizacion: bool,
    trazo: bool,
) -> Decimal:
    checks = [hijuelos, fuego, cicatrizacion, trazo]
    score = sum(1 for c in checks if c) / len(checks)
    return Decimal(str(round(score, 2)))


@router.post("/certificar", response_model=CertificacionLoteRead, status_code=status.HTTP_201_CREATED)
def certificar_lote(payload: CertificacionLoteCreate, db: Session = Depends(get_db)):
    """
    Recibe checklist del Método Mexicano desde la app móvil.
    Si puntuacion_calidad > 0.90, marca el lote como apto para pago preferencial
    (doble del precio de la leche por litro de chaguarmishky).
    """
    parcela = db.get(Parcela, payload.parcela_id)
    if not parcela:
        raise HTTPException(status_code=404, detail="Parcela no encontrada")

    score = payload.puntuacion_calidad
    if score is None:
        score = _calcular_puntuacion(
            payload.hijuelos_seleccionados_ok,
            payload.herramientas_desinfectadas,
            payload.cicatrizacion_sol_completa,
            payload.trazo_tres_metros_ok,
        )
    else:
        score = Decimal(str(score)).quantize(Decimal("0.01"))

    apto = score >= UMBRAL_PAGO_PREFERENCIAL
    estado = ESTADO_APTO if apto else ESTADO_NO_APTO
    mensaje = (
        "Lote certificado: califica para el pago preferencial del doble del precio de la leche "
        "por cada litro de chaguarmishky (aguamiel) entregado."
        if apto
        else (
            f"Cumplimiento {float(score) * 100:.0f}% (se requiere ≥90%). "
            "Verifica hijuelos 8–11 cm / 1.5–3 kg, desinfección al fuego, "
            "10 días de cicatrización y trazado a 3 m entre hileras."
        )
    )

    registro = CertificacionLote(
        parcela_id=payload.parcela_id,
        hijuelos_seleccionados_ok=payload.hijuelos_seleccionados_ok,
        herramientas_desinfectadas=payload.herramientas_desinfectadas,
        cicatrizacion_sol_completa=payload.cicatrizacion_sol_completa,
        trazo_tres_metros_ok=payload.trazo_tres_metros_ok,
        fecha_certificacion=utcnow(),
        puntuacion_calidad=score,
        apto_pago_preferencial=apto,
        estado=estado,
        notas=payload.notas,
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)

    return CertificacionLoteRead(
        id=registro.id,
        parcela_id=registro.parcela_id,
        hijuelos_seleccionados_ok=registro.hijuelos_seleccionados_ok,
        herramientas_desinfectadas=registro.herramientas_desinfectadas,
        cicatrizacion_sol_completa=registro.cicatrizacion_sol_completa,
        trazo_tres_metros_ok=registro.trazo_tres_metros_ok,
        fecha_certificacion=registro.fecha_certificacion,
        puntuacion_calidad=registro.puntuacion_calidad,
        apto_pago_preferencial=registro.apto_pago_preferencial,
        estado=registro.estado,
        notas=registro.notas,
        mensaje=mensaje,
        multiplicador_precio=2.0 if apto else 1.0,
    )


@router.get("/certificar/{parcela_id}", response_model=list[CertificacionLoteRead])
def listar_certificaciones(parcela_id: UUID, db: Session = Depends(get_db)):
    parcela = db.get(Parcela, parcela_id)
    if not parcela:
        raise HTTPException(status_code=404, detail="Parcela no encontrada")
    rows = (
        db.query(CertificacionLote)
        .filter(CertificacionLote.parcela_id == parcela_id)
        .order_by(CertificacionLote.fecha_certificacion.desc())
        .all()
    )
    return [
        CertificacionLoteRead(
            id=r.id,
            parcela_id=r.parcela_id,
            hijuelos_seleccionados_ok=r.hijuelos_seleccionados_ok,
            herramientas_desinfectadas=r.herramientas_desinfectadas,
            cicatrizacion_sol_completa=r.cicatrizacion_sol_completa,
            trazo_tres_metros_ok=r.trazo_tres_metros_ok,
            fecha_certificacion=r.fecha_certificacion,
            puntuacion_calidad=r.puntuacion_calidad,
            apto_pago_preferencial=r.apto_pago_preferencial,
            estado=r.estado,
            notas=r.notas,
            mensaje=ESTADO_APTO if r.apto_pago_preferencial else ESTADO_NO_APTO,
            multiplicador_precio=2.0 if r.apto_pago_preferencial else 1.0,
        )
        for r in rows
    ]
