from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import BitacoraCampo, CertificacionLote, MedicionCrecimiento, Parcela, Planta, Productor
from app.models.enums import RolUsuario, TipoCarbono
from app.security import require_roles

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard Corporativo"])

PROTOCOLO_COCHINILLA = (
    "Recomendación de tratamiento: Limpiar las pencas afectadas con un algodón "
    "empapado en alcohol o lavar con agua y jabón de forma inmediata"
)


def _sum_carbon(db: Session, tipo: str) -> tuple[float, float]:
    kg = (
        db.query(func.coalesce(func.sum(MedicionCrecimiento.carbono_acumulado_kg), 0))
        .filter(MedicionCrecimiento.tipo_carbono == tipo)
        .scalar()
    )
    co2 = (
        db.query(func.coalesce(func.sum(MedicionCrecimiento.co2_equivalente_kg), 0))
        .filter(MedicionCrecimiento.tipo_carbono == tipo)
        .scalar()
    )
    return float(kg or 0), float(co2 or 0)


def _sum_carbon_verified_flag(db: Session, verified: bool) -> tuple[float, float]:
    kg = (
        db.query(func.coalesce(func.sum(MedicionCrecimiento.carbono_acumulado_kg), 0))
        .filter(MedicionCrecimiento.carbono_verificado.is_(verified))
        .scalar()
    )
    co2 = (
        db.query(func.coalesce(func.sum(MedicionCrecimiento.co2_equivalente_kg), 0))
        .filter(MedicionCrecimiento.carbono_verificado.is_(verified))
        .scalar()
    )
    return float(kg or 0), float(co2 or 0)


def _parcela_payload(db: Session, parcela: Parcela) -> dict:
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
    # Aproximación de linderos alrededor del centro GPS
    delta = 0.004
    linderos = None
    if lat is not None and lng is not None:
        linderos = [
            [lat - delta, lng - delta],
            [lat - delta, lng + delta],
            [lat + delta, lng + delta],
            [lat + delta, lng - delta],
        ]
    return {
        "id": str(parcela.id),
        "nombre": parcela.nombre,
        "productor": parcela.productor.nombre if parcela.productor else None,
        "productor_id": str(parcela.productor_id) if parcela.productor_id else None,
        "lat": lat,
        "lng": lng,
        "area_hectareas": float(parcela.area_hectareas) if parcela.area_hectareas is not None else None,
        "carbono_kg": float(carbono),
        "co2_kg": float(co2),
        "co2_kg_ha": float(co2) / area,
        "ph": float(parcela.ph) if parcela.ph is not None else None,
        "linderos": linderos,
    }


@router.get("/stats")
def dashboard_stats(
    _user=Depends(require_roles(RolUsuario.EMPRESA.value)),
    db: Session = Depends(get_db),
):
    est_c, est_co2 = _sum_carbon(db, TipoCarbono.ESTIMADO.value)
    ver_c, ver_co2 = _sum_carbon(db, TipoCarbono.VERIFICADO_IN_SITU.value)
    # Preferir flag carbono_verificado si hay datos inconsistentes de tipo
    flag_est_c, flag_est_co2 = _sum_carbon_verified_flag(db, False)
    flag_ver_c, flag_ver_co2 = _sum_carbon_verified_flag(db, True)
    if flag_ver_c > 0 or flag_est_c > 0:
        if ver_c == 0 and flag_ver_c > 0:
            ver_c, ver_co2 = flag_ver_c, flag_ver_co2
        if est_c == 0 and flag_est_c > 0:
            est_c, est_co2 = flag_est_c, flag_est_co2

    parcelas = [_parcela_payload(db, p) for p in db.query(Parcela).all()]

    # Serie mensual última (últimas 6 mediciones agrupadas por tipo)
    serie = []
    for offset in range(5, -1, -1):
        mes_ref = date.today().replace(day=1) - timedelta(days=30 * offset)
        label = mes_ref.strftime("%Y-%m")
        serie.append(
            {
                "periodo": label,
                "carbono_estimado_kg": round(est_c / 6 * (6 - offset) / 6 + est_c * 0.15, 2),
                "carbono_verificado_kg": round(ver_c / 6 * (6 - offset) / 6 + ver_c * 0.1, 2),
            }
        )
    # Si hay mediciones reales, sobrescribir con agregados por mes
    rows = (
        db.query(
            MedicionCrecimiento.fecha_medicion,
            MedicionCrecimiento.tipo_carbono,
            MedicionCrecimiento.carbono_verificado,
            MedicionCrecimiento.carbono_acumulado_kg,
        )
        .order_by(MedicionCrecimiento.fecha_medicion.asc())
        .all()
    )
    if rows:
        by_month: dict[str, dict[str, float]] = {}
        for fecha, tipo, verified, kg in rows:
            key = fecha.strftime("%Y-%m") if fecha else "s/d"
            bucket = by_month.setdefault(key, {"carbono_estimado_kg": 0.0, "carbono_verificado_kg": 0.0})
            val = float(kg or 0)
            tipo_val = tipo.value if hasattr(tipo, "value") else tipo
            if verified or tipo_val == TipoCarbono.VERIFICADO_IN_SITU.value:
                bucket["carbono_verificado_kg"] += val
            else:
                bucket["carbono_estimado_kg"] += val
        serie = [{"periodo": k, **v} for k, v in sorted(by_month.items())]

    return {
        "productores": db.query(func.count(Productor.id)).scalar() or 0,
        "parcelas": db.query(func.count(Parcela.id)).scalar() or 0,
        "plantas": db.query(func.count(Planta.id)).scalar() or 0,
        "carbono_estimado_kg": est_c,
        "carbono_verificado_kg": ver_c,
        "co2_estimado_ton": est_co2 / 1000,
        "co2_verificado_ton": ver_co2 / 1000,
        "co2_total_ton": (est_co2 + ver_co2) / 1000,
        "serie_carbono": serie,
        "parcelas_geo": parcelas,
        "comparativo": [
            {"tipo": "Estimado", "carbono_kg": est_c, "co2_ton": est_co2 / 1000},
            {"tipo": "Verificado", "carbono_kg": ver_c, "co2_ton": ver_co2 / 1000},
        ],
    }


@router.get("/crecimiento")
def dashboard_crecimiento(
    productor_id: UUID | None = Query(None),
    planta_id: UUID | None = Query(None),
    _user=Depends(require_roles(RolUsuario.EMPRESA.value)),
    db: Session = Depends(get_db),
):
    productores = [
        {"id": str(p.id), "nombre": p.nombre}
        for p in db.query(Productor).order_by(Productor.nombre).all()
    ]

    plantas_q = db.query(Planta).join(Parcela)
    if productor_id:
        plantas_q = plantas_q.filter(Parcela.productor_id == productor_id)
    plantas = [
        {
            "id": str(pl.id),
            "codigo": pl.codigo or str(pl.id)[:8],
            "parcela_id": str(pl.parcela_id),
            "productor_id": str(pl.parcela.productor_id) if pl.parcela else None,
        }
        for pl in plantas_q.limit(200).all()
    ]

    serie = []
    if planta_id:
        mediciones = (
            db.query(MedicionCrecimiento)
            .filter(MedicionCrecimiento.planta_id == planta_id)
            .order_by(MedicionCrecimiento.fecha_medicion.asc())
            .all()
        )
        serie = [
            {
                "fecha": m.fecha_medicion.isoformat(),
                "altura_roseta_cm": float(m.altura_roseta_cm),
                "diametro_roseta_cm": float(m.diametro_roseta_cm),
                "numero_hojas": m.numero_hojas,
                "carbono_verificado": bool(m.carbono_verificado),
            }
            for m in mediciones
        ]

    return {"productores": productores, "plantas": plantas, "serie": serie}


@router.get("/alertas")
def dashboard_alertas(
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
    out = []
    for r in registros:
        datos = r.datos or {}
        clasificacion = (datos.get("clasificacion") or "").lower()
        foto = datos.get("foto") or datos.get("foto_base64")
        item = {
            "id": str(r.id),
            "tipo": r.tipo if isinstance(r.tipo, str) else getattr(r.tipo, "value", r.tipo),
            "fecha": r.fecha_programada.isoformat() if r.fecha_programada else None,
            "notas": r.notas,
            "gps_lat": float(r.gps_lat) if r.gps_lat is not None else None,
            "gps_lng": float(r.gps_lng) if r.gps_lng is not None else None,
            "datos": datos,
            "clasificacion": clasificacion or None,
            "foto": foto if isinstance(foto, str) else None,
            "parcela_id": str(r.parcela_id) if r.parcela_id else None,
            "productor": r.productor.nombre if r.productor else None,
            "protocolo_mitigacion": PROTOCOLO_COCHINILLA if clasificacion == "cochinilla" else None,
        }
        out.append(item)
    return out


# --- Eficiencia de campo Método México ---

MORTALIDAD_TRADICIONAL = 0.30
MORTALIDAD_CERTIFICADA = 0.04  # < 5%
USD_EUCALIPTO_POR_ARBOL_12A = 20.0
USD_PENCO_POR_PLANTA_CERT = 160.0
DENSIDAD_EUCALIPTO_HA = 1100
DENSIDAD_PENCO_HA = 2222  # 1.5 m × 3 m


@router.get("/eficiencia-mexico")
def dashboard_eficiencia_mexico(
    hectareas: float = Query(1.0, gt=0, le=1000),
    _user=Depends(require_roles(RolUsuario.EMPRESA.value)),
    db: Session = Depends(get_db),
):
    """
    Estadísticas operativas del modelo de eficiencia de campo de México:
    proyección de piñas (años 5/8/12), pérdidas fitosanitarias y ROI vs eucalipto.
    """
    hoy = date.today()
    plantas = db.query(Planta).all()
    total_plantas = len(plantas)

    # Proyección: cuántas piñas estarán listas al cumplir 5, 8 y 12 años desde siembra
    proyeccion = []
    por_calendario: dict[str, dict[str, int]] = {}
    for edad in (5, 8, 12):
        listas = 0
        for pl in plantas:
            if not pl.fecha_siembra:
                continue
            madurez = date(
                pl.fecha_siembra.year + edad,
                pl.fecha_siembra.month,
                min(pl.fecha_siembra.day, 28),
            )
            # Cuenta todas las plantas que alcanzarán ese hito (todas, si tienen fecha)
            listas += 1
            anio = str(madurez.year)
            bucket = por_calendario.setdefault(
                anio, {"anio": anio, "pinas_anio_5": 0, "pinas_anio_8": 0, "pinas_anio_12": 0}
            )
            bucket[f"pinas_anio_{edad}"] += 1
        # Aplicar supervivencia certificada vs bruta en la proyección
        sobrevivientes_cert = int(round(listas * (1 - MORTALIDAD_CERTIFICADA)))
        sobrevivientes_trad = int(round(listas * (1 - MORTALIDAD_TRADICIONAL)))
        proyeccion.append(
            {
                "hito": f"Año {edad}",
                "edad_anios": edad,
                "pinas_proyectadas": listas,
                "pinas_certificadas_vivas": sobrevivientes_cert,
                "pinas_tradicionales_vivas": sobrevivientes_trad,
                "descripcion": {
                    5: "Primera ventana de extracción de piña / chawada temprana",
                    8: "Pico productivo de corazones de penco",
                    12: "Madurez plena · máxima extracción acumulada",
                }[edad],
            }
        )

    serie_calendario = [por_calendario[k] for k in sorted(por_calendario.keys())]

    # Lotes certificados (método México: fuego + cicatrización o apto preferencial)
    certs = db.query(CertificacionLote).all()
    parcelas_cert = {
        c.parcela_id
        for c in certs
        if c.apto_pago_preferencial
        or (c.herramientas_desinfectadas and c.cicatrizacion_sol_completa)
    }
    plantas_cert = sum(1 for pl in plantas if pl.parcela_id in parcelas_cert)
    plantas_trad = max(0, total_plantas - plantas_cert)
    if total_plantas == 0:
        # Demo base para pitch
        plantas_cert, plantas_trad, total_plantas = 1480, 360, 1840
        proyeccion = [
            {
                "hito": "Año 5",
                "edad_anios": 5,
                "pinas_proyectadas": 1840,
                "pinas_certificadas_vivas": int(1840 * 0.96),
                "pinas_tradicionales_vivas": int(1840 * 0.70),
                "descripcion": "Primera ventana de extracción de piña / chawada temprana",
            },
            {
                "hito": "Año 8",
                "edad_anios": 8,
                "pinas_proyectadas": 1840,
                "pinas_certificadas_vivas": int(1840 * 0.96),
                "pinas_tradicionales_vivas": int(1840 * 0.70),
                "descripcion": "Pico productivo de corazones de penco",
            },
            {
                "hito": "Año 12",
                "edad_anios": 12,
                "pinas_proyectadas": 1840,
                "pinas_certificadas_vivas": int(1840 * 0.96),
                "pinas_tradicionales_vivas": int(1840 * 0.70),
                "descripcion": "Madurez plena · máxima extracción acumulada",
            },
        ]
        serie_calendario = []

    perdidas = [
        {
            "modelo": "Tradicional",
            "mortalidad_pct": MORTALIDAD_TRADICIONAL * 100,
            "supervivencia_pct": (1 - MORTALIDAD_TRADICIONAL) * 100,
            "plantas_base": plantas_trad or total_plantas,
            "plantas_perdidas": int(round((plantas_trad or total_plantas) * MORTALIDAD_TRADICIONAL)),
            "plantas_vivas": int(round((plantas_trad or total_plantas) * (1 - MORTALIDAD_TRADICIONAL))),
            "detalle": "Sin desinfección al fuego ni cicatrización de 10 días",
        },
        {
            "modelo": "Certificado México",
            "mortalidad_pct": MORTALIDAD_CERTIFICADA * 100,
            "supervivencia_pct": (1 - MORTALIDAD_CERTIFICADA) * 100,
            "plantas_base": plantas_cert or total_plantas,
            "plantas_perdidas": int(round((plantas_cert or total_plantas) * MORTALIDAD_CERTIFICADA)),
            "plantas_vivas": int(round((plantas_cert or total_plantas) * (1 - MORTALIDAD_CERTIFICADA))),
            "detalle": "Desinfección al fuego + cicatrización al sol 10 días",
        },
    ]

    ha = float(hectareas)
    euc_arboles = int(DENSIDAD_EUCALIPTO_HA * ha)
    penco_plantas = int(DENSIDAD_PENCO_HA * ha * 0.9)  # 90% área útil
    roi = {
        "hectareas": ha,
        "eucalipto": {
            "arboles": euc_arboles,
            "usd_por_arbol_12a": USD_EUCALIPTO_POR_ARBOL_12A,
            "ingreso_total_usd": euc_arboles * USD_EUCALIPTO_POR_ARBOL_12A,
            "densidad_ha": DENSIDAD_EUCALIPTO_HA,
            "horizonte_anios": 12,
        },
        "penco_certificado": {
            "plantas": penco_plantas,
            "usd_por_planta": USD_PENCO_POR_PLANTA_CERT,
            "ingreso_total_usd": penco_plantas * USD_PENCO_POR_PLANTA_CERT,
            "densidad_ha": DENSIDAD_PENCO_HA,
            "fuente": "Venta garantizada de chawarmishky (aguamiel)",
        },
        "multiplicador": round(
            (penco_plantas * USD_PENCO_POR_PLANTA_CERT)
            / max(euc_arboles * USD_EUCALIPTO_POR_ARBOL_12A, 1),
            1,
        ),
        "comparativo_grafico": [
            {"cultivo": "Eucalipto (12 a)", "usd_por_unidad": USD_EUCALIPTO_POR_ARBOL_12A, "ingreso_ha_usd": DENSIDAD_EUCALIPTO_HA * USD_EUCALIPTO_POR_ARBOL_12A},
            {"cultivo": "Penco certificado", "usd_por_unidad": USD_PENCO_POR_PLANTA_CERT, "ingreso_ha_usd": int(DENSIDAD_PENCO_HA * 0.9) * USD_PENCO_POR_PLANTA_CERT},
        ],
    }

    return {
        "modelo": "eficiencia_campo_mexico",
        "total_plantas": total_plantas,
        "plantas_certificadas": plantas_cert,
        "plantas_tradicionales": plantas_trad,
        "lotes_certificados": len(parcelas_cert),
        "proyeccion_cosecha": proyeccion,
        "serie_calendario": serie_calendario,
        "perdidas_fitosanitarias": perdidas,
        "roi": roi,
        "hoy": hoy.isoformat(),
    }
