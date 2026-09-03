from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import BitacoraCampo, MedicionCrecimiento, Parcela, Planta, Productor
from app.models.enums import RolUsuario, TipoCarbono
from app.routers.dashboard import PROTOCOLO_COCHINILLA
from app.security import productor_id_for_user, require_roles

router = APIRouter(prefix="/api/v1", tags=["Portales"])


@router.get("/empresa/dashboard")
def empresa_dashboard(
    _user=Depends(require_roles(RolUsuario.EMPRESA.value)),
    db: Session = Depends(get_db),
):
    def sum_carbon(tipo: str):
        kg = db.query(func.coalesce(func.sum(MedicionCrecimiento.carbono_acumulado_kg), 0)).filter(
            MedicionCrecimiento.tipo_carbono == tipo
        ).scalar()
        co2 = db.query(func.coalesce(func.sum(MedicionCrecimiento.co2_equivalente_kg), 0)).filter(
            MedicionCrecimiento.tipo_carbono == tipo
        ).scalar()
        return float(kg or 0), float(co2 or 0)

    est_c, est_co2 = sum_carbon(TipoCarbono.ESTIMADO.value)
    ver_c, ver_co2 = sum_carbon(TipoCarbono.VERIFICADO_IN_SITU.value)

    return {
        "productores": db.query(func.count(Productor.id)).scalar() or 0,
        "parcelas": db.query(func.count(Parcela.id)).scalar() or 0,
        "plantas": db.query(func.count(Planta.id)).scalar() or 0,
        "carbono_estimado_kg": est_c,
        "carbono_verificado_kg": ver_c,
        "co2_estimado_ton": est_co2 / 1000,
        "co2_verificado_ton": ver_co2 / 1000,
        "co2_total_ton": (est_co2 + ver_co2) / 1000,
    }


@router.get("/empresa/parcelas")
def empresa_parcelas(
    _user=Depends(require_roles(RolUsuario.EMPRESA.value)),
    db: Session = Depends(get_db),
):
    filas = []
    for parcela in db.query(Parcela).all():
        planta_ids = [p.id for p in parcela.plantas]
        carbono = Decimal("0")
        co2 = Decimal("0")
        if planta_ids:
            carbono = db.query(func.coalesce(func.sum(MedicionCrecimiento.carbono_acumulado_kg), 0)).filter(
                MedicionCrecimiento.planta_id.in_(planta_ids)
            ).scalar() or Decimal("0")
            co2 = db.query(func.coalesce(func.sum(MedicionCrecimiento.co2_equivalente_kg), 0)).filter(
                MedicionCrecimiento.planta_id.in_(planta_ids)
            ).scalar() or Decimal("0")
        area = float(parcela.area_hectareas) if parcela.area_hectareas is not None else 1.0
        area = area if area > 0 else 1.0
        lat = float(parcela.ubicacion_lat) if parcela.ubicacion_lat is not None else None
        lng = float(parcela.ubicacion_lng) if parcela.ubicacion_lng is not None else None
        delta = 0.004
        linderos = None
        if lat is not None and lng is not None:
            linderos = [
                [lat - delta, lng - delta],
                [lat - delta, lng + delta],
                [lat + delta, lng + delta],
                [lat + delta, lng - delta],
            ]
        filas.append(
            {
                "id": str(parcela.id),
                "nombre": parcela.nombre,
                "productor": parcela.productor.nombre if parcela.productor else None,
                "lat": lat,
                "lng": lng,
                "area_hectareas": float(parcela.area_hectareas) if parcela.area_hectareas is not None else None,
                "carbono_kg": float(carbono),
                "co2_kg": float(co2),
                "co2_kg_ha": float(co2) / area,
                "ph": float(parcela.ph) if parcela.ph is not None else None,
                "linderos": linderos,
            }
        )
    return filas


@router.get("/empresa/alertas")
def empresa_alertas(
    _user=Depends(require_roles(RolUsuario.EMPRESA.value)),
    db: Session = Depends(get_db),
):
    registros = (
        db.query(BitacoraCampo)
        .filter(BitacoraCampo.tipo.in_(["scouting_visual", "fitosanitario"]))
        .order_by(BitacoraCampo.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": str(r.id),
            "tipo": r.tipo if isinstance(r.tipo, str) else getattr(r.tipo, "value", r.tipo),
            "fecha": r.fecha_programada.isoformat() if r.fecha_programada else None,
            "notas": r.notas,
            "gps_lat": float(r.gps_lat) if r.gps_lat is not None else None,
            "gps_lng": float(r.gps_lng) if r.gps_lng is not None else None,
            "datos": r.datos or {},
            "clasificacion": (r.datos or {}).get("clasificacion"),
            "foto": (r.datos or {}).get("foto") if isinstance((r.datos or {}).get("foto"), str) else None,
            "parcela_id": str(r.parcela_id) if r.parcela_id else None,
            "productor": r.productor.nombre if r.productor else None,
            "protocolo_mitigacion": (
                PROTOCOLO_COCHINILLA
                if ((r.datos or {}).get("clasificacion") or "").lower() == "cochinilla"
                else None
            ),
        }
        for r in registros
    ]


@router.get("/me/alcance")
def mi_alcance(
    user=Depends(require_roles(RolUsuario.PRODUCTOR.value, RolUsuario.EMPRESA.value)),
    db: Session = Depends(get_db),
):
    pid = productor_id_for_user(db, user)
    return {
        "rol": user.rol.value if hasattr(user.rol, "value") else user.rol,
        "productor_id": str(pid) if pid else None,
    }
