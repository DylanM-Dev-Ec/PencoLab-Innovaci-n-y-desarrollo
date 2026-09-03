"""POST /api/planes-accion — planificación de siembra certificada (FastAPI)."""
from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Parcela, PlanAccionSiembra, Planta
from app.models.enums import EstadoPlanAccion, TipoPropagacion
from app.schemas import PlanAccionCreate, PlanAccionRead
from app.security import get_current_user
from app.services import get_productor_or_404
from app.utils.plan_accion import (
    MAX_HA_POR_ASOCIADO,
    proyectar_carbono_biomasa,
    proyectar_financiero,
)

router = APIRouter(prefix="/api", tags=["Planes de acción"])


def _ha_ya_comprometidas(db: Session, productor_id: UUID, excluir_plan_id: UUID | None = None) -> Decimal:
    """Suma ha de planes activos/planificados + hectáreas ya establecidas en parcelas."""
    q = db.query(func.coalesce(func.sum(PlanAccionSiembra.hectareas_planificadas), 0)).filter(
        PlanAccionSiembra.productor_id == productor_id,
        PlanAccionSiembra.estado.in_(
            [EstadoPlanAccion.PLANIFICADO.value, EstadoPlanAccion.ACTIVO_EN_PROGRESO.value]
        ),
    )
    if excluir_plan_id:
        q = q.filter(PlanAccionSiembra.id != excluir_plan_id)
    planes_ha = Decimal(str(q.scalar() or 0))

    parcelas_ha = db.query(func.coalesce(func.sum(Parcela.area_hectareas), 0)).filter(
        Parcela.productor_id == productor_id
    ).scalar()
    return planes_ha + Decimal(str(parcelas_ha or 0))


def activar_planes_por_siembra_georef(
    db: Session,
    *,
    productor_id: UUID,
    planta: Planta,
) -> list[PlanAccionSiembra]:
    """
    Si se verifica la primera siembra física de hijuelos georreferenciada,
    los planes 'planificado' del productor pasan a 'activo_en_progreso'.
    """
    prop = planta.tipo_propagacion
    prop_val = prop.value if hasattr(prop, "value") else str(prop)
    if prop_val != TipoPropagacion.HIJUELO.value:
        return []
    if planta.ubicacion_lat is None or planta.ubicacion_lng is None:
        return []

    planes = (
        db.query(PlanAccionSiembra)
        .filter(
            PlanAccionSiembra.productor_id == productor_id,
            PlanAccionSiembra.estado == EstadoPlanAccion.PLANIFICADO.value,
        )
        .all()
    )
    if not planes:
        return []

    now = datetime.now(timezone.utc)
    for plan in planes:
        plan.estado = EstadoPlanAccion.ACTIVO_EN_PROGRESO.value
        plan.activado_en = now
        plan.planta_activadora_id = planta.id
    return planes


@router.post("/planes-accion", response_model=PlanAccionRead, status_code=status.HTTP_201_CREATED)
def crear_plan_accion(
    payload: PlanAccionCreate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """
    Guarda la planificación de siembra del agricultor.
    Valida meta ≤ 20 ha, calcula proyecciones y deja estado 'planificado'.
    """
    get_productor_or_404(db, payload.productor_id)

    ha = Decimal(str(payload.hectareas_planificadas))
    if ha <= 0 or ha > MAX_HA_POR_ASOCIADO:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"La meta de expansión no puede exceder {MAX_HA_POR_ASOCIADO} ha por asociado (límite sostenible).",
        )

    comprometidas = _ha_ya_comprometidas(db, payload.productor_id)
    if comprometidas + ha > MAX_HA_POR_ASOCIADO:
        restante = max(Decimal("0"), MAX_HA_POR_ASOCIADO - comprometidas)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Excede el límite sostenible de {MAX_HA_POR_ASOCIADO} ha. "
                f"Ya tienes {float(comprometidas)} ha comprometidas; "
                f"puedes planificar hasta {float(restante)} ha más."
            ),
        )

    dens = payload.densidad_plantas_ha or 1000
    intercalado = payload.cultivo_intercalado_elegido
    if hasattr(intercalado, "value"):
        intercalado = intercalado.value

    proy_fin = proyectar_financiero(ha, intercalado, dens)
    proy_co2 = proyectar_carbono_biomasa(ha, dens)

    plan = PlanAccionSiembra(
        id=payload.id or uuid4(),
        productor_id=payload.productor_id,
        hectareas_planificadas=ha,
        cultivo_intercalado_elegido=intercalado,
        latitud_inicial=payload.latitud_inicial,
        longitud_inicial=payload.longitud_inicial,
        fecha_inicio_plan=payload.fecha_inicio_plan or date.today(),
        densidad_plantas_ha=dens,
        estado=EstadoPlanAccion.PLANIFICADO.value,
        proyeccion_financiera=proy_fin,
        proyeccion_carbono=proy_co2,
        synced_at=datetime.now(timezone.utc),
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/planes-accion/{plan_id}", response_model=PlanAccionRead)
def obtener_plan(plan_id: UUID, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    plan = db.get(PlanAccionSiembra, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    return plan


@router.get("/planes-accion", response_model=list[PlanAccionRead])
def listar_planes(
    productor_id: UUID,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    get_productor_or_404(db, productor_id)
    return (
        db.query(PlanAccionSiembra)
        .filter(PlanAccionSiembra.productor_id == productor_id)
        .order_by(PlanAccionSiembra.created_at.desc())
        .all()
    )
