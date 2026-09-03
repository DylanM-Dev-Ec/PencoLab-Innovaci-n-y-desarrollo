"""Proyecciones de carbono, biomasa e ingreso para planes de acción."""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.utils.carbono import CARBON_FRACTION, CO2_CONVERSION_FACTOR, calcular_carbono_in_situ

# Meta sostenible regional (.cursorrules Agave Andino)
MAX_HA_POR_ASOCIADO = Decimal("20")
CO2_TON_POR_HA_MADUREZ = Decimal("5")  # meta comunitaria escalada por ha
USD_POR_PLANTA_MADUREZ = Decimal("160")
DENSIDAD_DEFAULT_HA = 1000

# Ingreso corto plazo USD/ha · 6 meses (calles de 3 m)
INGRESO_INTERCALADO_USD_HA = {
    "papa": Decimal("1200"),
    "quinoa": Decimal("950"),
    "chocho": Decimal("800"),
}

# Curva de crecimiento alométrica representativa por año del plan
CRECIMIENTO_POR_ANIO = {
    1: {"altura_cm": Decimal("15"), "hojas": 8},
    5: {"altura_cm": Decimal("35"), "hojas": 16},
    8: {"altura_cm": Decimal("42"), "hojas": 20},
    12: {"altura_cm": Decimal("48"), "hojas": 24},
}

ANIOS_PROYECCION = (1, 5, 8, 12)


def _q(value: Decimal, places: str = "0.001") -> Decimal:
    return value.quantize(Decimal(places))


def proyectar_carbono_biomasa(
    hectareas: Decimal | float,
    densidad_plantas_ha: int = DENSIDAD_DEFAULT_HA,
) -> dict[str, Any]:
    """
    Proyección anualizada de biomasa seca y CO₂e para años 1, 5, 8 y 12.
    Usa el modelo alométrico in situ por planta × densidad × ha.
    """
    ha = Decimal(str(hectareas))
    plantas = int(ha * Decimal(str(densidad_plantas_ha)))
    hitos: list[dict[str, Any]] = []

    for anio in ANIOS_PROYECCION:
        ref = CRECIMIENTO_POR_ANIO[anio]
        por_planta = calcular_carbono_in_situ(ref["altura_cm"], ref["hojas"])
        biomasa_total = por_planta["biomasa_kg"] * Decimal(plantas)
        carbono_total = por_planta["carbono_acumulado_kg"] * Decimal(plantas)
        co2_total_kg = por_planta["co2_equivalente_kg"] * Decimal(plantas)
        # Techo comunitario escalado: ha × 5 t en madurez (año 12)
        techo_ton = ha * CO2_TON_POR_HA_MADUREZ
        fraccion = Decimal(str(anio)) / Decimal("12")
        co2_meta_escalada_ton = _q(techo_ton * fraccion, "0.01")
        # Usamos el máximo entre alometría y curva meta (suaviza años tempranos)
        co2_ton = max(_q(co2_total_kg / Decimal("1000"), "0.01"), co2_meta_escalada_ton * Decimal("0.35"))
        if anio == 12:
            co2_ton = max(co2_ton, _q(techo_ton, "0.01"))

        hitos.append(
            {
                "anio": anio,
                "plantas": plantas,
                "altura_roseta_cm": float(ref["altura_cm"]),
                "numero_hojas": ref["hojas"],
                "biomasa_seca_kg": float(_q(biomasa_total, "0.1")),
                "carbono_almacenado_kg": float(_q(carbono_total, "0.1")),
                "co2_equivalente_kg": float(_q(co2_total_kg, "0.1")),
                "co2_equivalente_ton": float(_q(co2_ton, "0.01")),
            }
        )

    return {
        "hectareas": float(ha),
        "densidad_plantas_ha": densidad_plantas_ha,
        "plantas_totales": plantas,
        "fraccion_carbono": float(CARBON_FRACTION),
        "factor_co2": float(CO2_CONVERSION_FACTOR),
        "meta_co2_ton_madurez": float(_q(ha * CO2_TON_POR_HA_MADUREZ, "0.01")),
        "hitos": hitos,
    }


def proyectar_financiero(
    hectareas: Decimal | float,
    cultivo_intercalado: str,
    densidad_plantas_ha: int = DENSIDAD_DEFAULT_HA,
) -> dict[str, Any]:
    """Estructura limpia de proyección financiera para el frontend."""
    ha = Decimal(str(hectareas))
    plantas = int(ha * Decimal(str(densidad_plantas_ha)))
    ingreso_penco = plantas * USD_POR_PLANTA_MADUREZ
    usd_ha_inter = INGRESO_INTERCALADO_USD_HA.get(
        cultivo_intercalado, INGRESO_INTERCALADO_USD_HA["papa"]
    )
    ingreso_intercalado = _q(ha * usd_ha_inter, "0.01")

    # Ingreso penco se realiza principalmente hacia madurez (año 12);
    # intercalado en el primer ciclo (año 1 / 6 meses).
    flujo_por_anio = []
    for anio in ANIOS_PROYECCION:
        if anio == 1:
            ingreso = ingreso_intercalado
            concepto = "cultivo_intercalado_6m"
        elif anio == 12:
            ingreso = ingreso_penco
            concepto = "chawarmishky_madurez"
        else:
            # Acumulación parcial estimada (ventas intermedias / avance de valor)
            fraccion = Decimal(str(anio)) / Decimal("12")
            ingreso = _q(ingreso_penco * fraccion * Decimal("0.15"), "0.01")
            concepto = "avance_valor_estimado"

        flujo_por_anio.append(
            {
                "anio": anio,
                "concepto": concepto,
                "ingreso_usd": float(ingreso),
            }
        )

    return {
        "moneda": "USD",
        "hectareas": float(ha),
        "densidad_plantas_ha": densidad_plantas_ha,
        "plantas_totales": plantas,
        "usd_por_planta_madurez": float(USD_POR_PLANTA_MADUREZ),
        "cultivo_intercalado": cultivo_intercalado,
        "ingreso_corto_plazo_usd": float(ingreso_intercalado),
        "ingreso_penco_madurez_usd": float(ingreso_penco),
        "ingreso_total_estimado_usd": float(ingreso_penco + ingreso_intercalado),
        "flujo_por_anio": flujo_por_anio,
        "nota": (
            "Pencos del Norte compra el litro de chawarmishky al doble del precio oficial "
            "de la leche si registras tus siembras en la app."
        ),
    }
