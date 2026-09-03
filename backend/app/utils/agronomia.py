from decimal import Decimal

from app.models.enums import EstacionRiego, TipoSuelo


PH_OPTIMO_MIN = Decimal("6.0")
PH_OPTIMO_MAX = Decimal("7.0")

PESO_HIJUELO_MIN_KG = Decimal("1.5")
PESO_HIJUELO_MAX_KG = Decimal("3.0")
ROSETA_MIN_CM = Decimal("8")
ROSETA_MAX_CM = Decimal("11")
EDAD_MADRE_MIN_ANIOS = Decimal("3")
EDAD_MADRE_MAX_ANIOS = Decimal("5")
DIAS_CICATRIZACION = 10

CARBON_FRACTION = Decimal("0.47")
CO2_CONVERSION_FACTOR = Decimal("3.67")

SUELOS_PERMEABLES = {
    TipoSuelo.FRANCO.value,
    TipoSuelo.ARENOSO.value,
    TipoSuelo.ARCILLOSO.value,
    TipoSuelo.FRANCO_ARENOSO.value,
    TipoSuelo.FRANCO_ARCILLOSO.value,
}

REGLAS_RIEGO = {
    EstacionRiego.INVIERNO.value: {
        "descripcion": "Riego racionado al mínimo. Mantener húmedo, no mojado.",
        "frecuencia_dias": 14,
        "nivel_humedad_min": 20.0,
        "nivel_humedad_max": 40.0,
        "alerta": "Evitar encharcamiento: raíces superficiales del penco se pudren con exceso de agua.",
    },
    EstacionRiego.PRIMAVERA.value: {
        "descripcion": "Riego según demanda del suelo. Humedecer sin encharcar.",
        "frecuencia_dias": 7,
        "nivel_humedad_min": 30.0,
        "nivel_humedad_max": 55.0,
        "alerta": "Ajusta según humedad real del suelo; no saturar.",
    },
    EstacionRiego.VERANO.value: {
        "descripcion": "Reducción paulatina para no ahogar la raíz. No regar en época lluviosa extrema.",
        "frecuencia_dias": 10,
        "nivel_humedad_min": 25.0,
        "nivel_humedad_max": 45.0,
        "alerta": "Suspender riego si hay lluvias extremas para evitar problemas sanitarios.",
    },
    EstacionRiego.OTONO.value: {
        "descripcion": "Riego moderado de transición.",
        "frecuencia_dias": 10,
        "nivel_humedad_min": 25.0,
        "nivel_humedad_max": 50.0,
        "alerta": "Mantener riego comedido y parco.",
    },
}

CLASIFICACIONES_SCOUTING = {
    "cochinilla": "Puntos rojos en hojas: posible cochinilla.",
    "picudo_agave": "Daño típico de picudo del agave.",
    "pudricion_erwinia": "Pudrición blanda sugerente de Erwinia.",
    "hongo": "Síntomas fúngicos en pencas.",
    "estres_hidrico": "Estrés hídrico / riego inadecuado.",
    "deficiencia_nutricional": "Posible deficiencia nutricional.",
    "sana": "Hoja sin signos aparentes de enfermedad.",
    "otro": "Clasificación libre / pendiente de diagnóstico.",
    "sin_clasificar": "Pendiente de clasificación.",
}


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


def evaluar_suelo(ph: Decimal | float | None, tipo_suelo: str | None, permeabilidad: str | None = None) -> dict:
    tips = []
    tipo = (tipo_suelo or "").lower()
    if tipo and tipo not in SUELOS_PERMEABLES and tipo != TipoSuelo.OTRO.value:
        tips.append("Prefiere suelo franco, arenoso o arcilloso permeable para evitar encharcamiento.")
    if permeabilidad == "baja":
        tips.append("Permeabilidad baja: riesgo de pudrición de raíces superficiales.")
    return {
        "ph_optimo": [float(PH_OPTIMO_MIN), float(PH_OPTIMO_MAX)],
        "recomendacion_ph": recomendacion_ph(ph),
        "suelo_adecuado": tipo in SUELOS_PERMEABLES if tipo else None,
        "alertas": tips,
    }


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


def protocolo_siembra(
    *,
    peso_hijuelo_kg=None,
    tamano_roseta_inicial_cm=None,
    edad_planta_madre_anios=None,
    dias_cicatrizacion: int | None = None,
    tratamiento_sanitario: bool = False,
    metodo_desinfeccion: str | None = None,
    se_siente_bofo: bool = False,
) -> dict:
    apto = hijuelo_es_apto(peso_hijuelo_kg, tamano_roseta_inicial_cm, edad_planta_madre_anios)
    pasos = [
        "Seleccionar planta madre de 3 a 5 años.",
        "Elegir hijuelo de 1.5–3.0 kg o roseta 8–11 cm; descartar hijuelos bofos.",
        "Cortar rizoma con machete/cuchillo desinfectado al fuego.",
        f"Cicatrizar al sol {DIAS_CICATRIZACION} días antes de sembrar.",
        "Aplicar tratamiento sanitario: fungicida + bactericida + insecticida.",
    ]
    bloqueos = []
    if se_siente_bofo:
        bloqueos.append("Hijuelo bofo: no apto para siembra.")
        apto = False
    if dias_cicatrizacion is not None and dias_cicatrizacion < DIAS_CICATRIZACION:
        bloqueos.append(f"Cicatrización insuficiente: se requieren {DIAS_CICATRIZACION} días al sol.")
    if not tratamiento_sanitario:
        bloqueos.append("Falta tratamiento sanitario previo (fungicida, bactericida e insecticida).")
    if metodo_desinfeccion and metodo_desinfeccion.lower() not in {"fuego", "al fuego", "llama"}:
        bloqueos.append("La herramienta debe desinfectarse al fuego según protocolo.")
    return {
        "hijuelo_apto": apto,
        "pasos": pasos,
        "bloqueos": bloqueos,
        "listo_para_siembra": bool(apto) and not bloqueos,
    }


def recomendacion_riego(estacion: str, humedad_suelo: float | None = None, lluvia_extrema: bool = False) -> dict:
    key = estacion.lower()
    regla = REGLAS_RIEGO.get(key)
    if not regla:
        return {"error": "Estación inválida. Use invierno|primavera|verano|otono"}
    alertas = [regla["alerta"]]
    permitir = True
    if lluvia_extrema and key == EstacionRiego.VERANO.value:
        permitir = False
        alertas.append("No regar en época lluviosa extrema.")
    if humedad_suelo is not None and humedad_suelo > regla["nivel_humedad_max"]:
        permitir = False
        alertas.append("Humedad por encima del máximo: riego comedido/parco, no aplicar ahora.")
    return {
        "estacion": key,
        "permitir_riego": permitir,
        **regla,
        "alertas": alertas,
    }


def validar_poda(motivo: str, hojas_verdes: bool = False) -> dict:
    if hojas_verdes or motivo.lower() not in {"secas", "hojas_secas", "sanitaria"}:
        return {
            "valida": False,
            "mensaje": "Poda sanitaria: eliminar únicamente hojas secas (vehículo de picudo/cochinilla).",
        }
    return {
        "valida": True,
        "mensaje": "Poda sanitaria correcta: solo hojas secas removidas.",
    }


def estimar_carbono(
    altura_roseta_cm: Decimal | float,
    diametro_roseta_cm: Decimal | float,
    edad_planta_meses: int | None = None,
) -> dict[str, Decimal]:
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


def clasificar_scouting(clasificacion: str | None) -> dict:
    key = (clasificacion or "sin_clasificar").lower()
    return {
        "clasificacion": key if key in CLASIFICACIONES_SCOUTING else "otro",
        "descripcion": CLASIFICACIONES_SCOUTING.get(key, CLASIFICACIONES_SCOUTING["otro"]),
    }
