from decimal import Decimal

CARBON_FRACTION = Decimal("0.47")
CO2_CONVERSION_FACTOR = Decimal("3.67")


def calcular_carbono_in_situ(
    altura_roseta_cm: Decimal | float,
    numero_hojas: int,
) -> dict[str, Decimal]:
    """
    Modelo alométrico de trazabilidad ambiental (medición real in situ).

    Biomasa_Seca_kg = (altura_roseta_cm * 0.05) + (numero_hojas * 0.12)
    Carbono_Almacenado_kg = Biomasa_Seca_kg * 0.47
    CO2_Equivalente_kg = Carbono_Almacenado_kg * 3.67
    """
    altura = Decimal(str(altura_roseta_cm))
    hojas = Decimal(str(numero_hojas))
    biomasa = (altura * Decimal("0.05") + hojas * Decimal("0.12")).quantize(Decimal("0.001"))
    carbono = (biomasa * CARBON_FRACTION).quantize(Decimal("0.001"))
    co2 = (carbono * CO2_CONVERSION_FACTOR).quantize(Decimal("0.001"))
    return {
        "biomasa_kg": biomasa,
        "carbono_acumulado_kg": carbono,
        "co2_equivalente_kg": co2,
    }


def estimar_carbono_teorico(
    altura_roseta_cm: Decimal | float,
    diametro_roseta_cm: Decimal | float,
    edad_planta_meses: int | None = None,
) -> dict[str, Decimal]:
    """Proyección teórica por dimensiones/edad (carbono_verificado=False)."""
    altura = Decimal(str(altura_roseta_cm))
    diametro = Decimal(str(diametro_roseta_cm))
    radio = diametro / Decimal("2")
    volumen = Decimal("3.1416") * (radio**2) * altura
    factor = Decimal("0.00035")
    if edad_planta_meses and edad_planta_meses > 0:
        factor += Decimal(str(edad_planta_meses)) * Decimal("0.00001")
    biomasa = (volumen * factor).quantize(Decimal("0.001"))
    carbono = (biomasa * CARBON_FRACTION).quantize(Decimal("0.001"))
    co2 = (carbono * CO2_CONVERSION_FACTOR).quantize(Decimal("0.001"))
    return {
        "biomasa_kg": biomasa,
        "carbono_acumulado_kg": carbono,
        "co2_equivalente_kg": co2,
    }
