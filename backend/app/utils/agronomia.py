from decimal import Decimal


PH_OPTIMO_MIN = Decimal("6.0")
PH_OPTIMO_MAX = Decimal("7.0")

PESO_HIJUELO_MIN_KG = Decimal("1.5")
PESO_HIJUELO_MAX_KG = Decimal("3.0")
ROSETA_MIN_CM = Decimal("8")
ROSETA_MAX_CM = Decimal("11")
EDAD_MADRE_MIN_ANIOS = Decimal("3")
EDAD_MADRE_MAX_ANIOS = Decimal("5")

CARBON_FRACTION = Decimal("0.47")
CO2_CONVERSION_FACTOR = Decimal("3.67")


def recomendacion_ph(ph: Decimal | float | None) -> str | None:
    if ph is None:
        return None

    ph_value = Decimal(str(ph))
    if ph_value < PH_OPTIMO_MIN:
        return "Aplicar cal y composta para elevar el pH al rango óptimo (6.0-7.0)"
    if ph_value > Decimal("8.0"):
        return "Aplicar yeso o azufre para reducir el pH al rango óptimo (6.0-7.0)"
    if PH_OPTIMO_MIN <= ph_value <= PH_OPTIMO_MAX:
        return "pH en rango óptimo para Penco/Agave"
    return "pH fuera del rango ideal, monitorear"


def hijuelo_es_apto(
    peso_hijuelo_kg: Decimal | float | None,
    tamano_roseta_inicial_cm: Decimal | float | None,
    edad_planta_madre_anios: Decimal | float | None,
) -> bool | None:
    if edad_planta_madre_anios is None:
        return None

    edad = Decimal(str(edad_planta_madre_anios))
    if not (EDAD_MADRE_MIN_ANIOS <= edad <= EDAD_MADRE_MAX_ANIOS):
        return False

    peso_ok = False
    if peso_hijuelo_kg is not None:
        peso = Decimal(str(peso_hijuelo_kg))
        peso_ok = PESO_HIJUELO_MIN_KG <= peso <= PESO_HIJUELO_MAX_KG

    roseta_ok = False
    if tamano_roseta_inicial_cm is not None:
        roseta = Decimal(str(tamano_roseta_inicial_cm))
        roseta_ok = ROSETA_MIN_CM <= roseta <= ROSETA_MAX_CM

    return peso_ok or roseta_ok


def estimar_carbono(
    altura_roseta_cm: Decimal | float,
    diametro_roseta_cm: Decimal | float,
    edad_planta_meses: int | None = None,
) -> dict[str, Decimal]:
    """
    Estima biomasa y carbono a partir de dimensiones de roseta.
    Fórmula simplificada para hackathon basada en volumen cilíndrico ajustado.
    """
    altura = Decimal(str(altura_roseta_cm))
    diametro = Decimal(str(diametro_roseta_cm))
    radio = diametro / Decimal("2")

    volumen_aprox = Decimal("3.1416") * (radio**2) * altura
    factor_densidad = Decimal("0.00035")
    if edad_planta_meses is not None and edad_planta_meses > 0:
        factor_densidad += Decimal(str(edad_planta_meses)) * Decimal("0.00001")

    biomasa_kg = (volumen_aprox * factor_densidad).quantize(Decimal("0.001"))
    carbono_kg = (biomasa_kg * CARBON_FRACTION).quantize(Decimal("0.001"))
    co2_kg = (carbono_kg * CO2_CONVERSION_FACTOR).quantize(Decimal("0.001"))

    return {
        "biomasa_kg": biomasa_kg,
        "carbono_acumulado_kg": carbono_kg,
        "co2_equivalente_kg": co2_kg,
    }
