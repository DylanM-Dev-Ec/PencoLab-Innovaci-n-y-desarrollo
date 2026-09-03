import enum


class TipoSuelo(str, enum.Enum):
    FRANCO = "franco"
    ARENOSO = "arenoso"
    ARCILLOSO = "arcilloso"
    LIMOSO = "limoso"
    FRANCO_ARENOSO = "franco-arenoso"
    FRANCO_ARCILLOSO = "franco-arcilloso"
    OTRO = "otro"


class PermeabilidadSuelo(str, enum.Enum):
    ALTA = "alta"
    MEDIA = "media"
    BAJA = "baja"


class EstadoPlanta(str, enum.Enum):
    ACTIVA = "activa"
    COSECHADA = "cosechada"
    CHAWADA = "chawada"
    MUERTA = "muerta"
    ENFERMA = "enferma"


class EstadoGeneralPlanta(str, enum.Enum):
    SANA = "sana"
    ESTRESADA = "estresada"
    ENFERMA = "enferma"
    RECUPERANDOSE = "recuperandose"


class TipoCarbono(str, enum.Enum):
    ESTIMADO = "estimado"
    VERIFICADO_IN_SITU = "verificado_in_situ"


class TipoBitacora(str, enum.Enum):
    RIEGO = "riego"
    PODA_SANITARIA = "poda_sanitaria"
    FITOSANITARIO = "fitosanitario"
    FERTILIZACION = "fertilizacion"
    SIEMBRA = "siembra"
    COSECHA = "cosecha"
    MONITOREO = "monitoreo"
    SCOUTING_VISUAL = "scouting_visual"
    OTRO = "otro"


class EstadoBitacora(str, enum.Enum):
    PENDIENTE = "pendiente"
    EN_PROGRESO = "en_progreso"
    COMPLETADA = "completada"
    CANCELADA = "cancelada"


class RolUsuario(str, enum.Enum):
    PRODUCTOR = "productor"
    EMPRESA = "empresa"


class EstacionRiego(str, enum.Enum):
    INVIERNO = "invierno"
    PRIMAVERA = "primavera"
    VERANO = "verano"
    OTONO = "otono"


class ClasificacionScouting(str, enum.Enum):
    SANA = "sana"
    COCHINILLA = "cochinilla"
    PICUDO_AGAVE = "picudo_agave"
    PUDRICION_ERWINIA = "pudricion_erwinia"
    HONGO = "hongo"
    ESTRES_HIDRICO = "estres_hidrico"
    DEFICIENCIA_NUTRICIONAL = "deficiencia_nutricional"
    OTRO = "otro"
    SIN_CLASIFICAR = "sin_clasificar"


class TipoTrazado(str, enum.Enum):
    """Plantación en terrenos marginales / anti-erosión (.cursorrules Agave Andino)."""

    LADERAS = "laderas"
    ZANJAS = "zanjas"
    PLANO = "plano"


class TipoResiduo(str, enum.Enum):
    FIBRA_CABUYA = "fibra_cabuya"
    FLORES_KIRILLAS = "flores_kirillas"
    CHAWARQUERO_MADERA = "chawarquero_madera"
    HOJA_PARA_ABONO = "hoja_para_abono"


class DestinoProducto(str, enum.Enum):
    CANASTAS = "canastas"
    ALPARGATAS = "alpargatas"
    ENCURTIDOS = "encurtidos"
    ABONO_COMPOST = "abono_compost"
    CONSTRUCCION_VIGAS = "construccion_vigas"


class TipoPropagacion(str, enum.Enum):
    """Propagación mixta: hijuelos + semillas."""

    HIJUELO = "hijuelo"
    SEMILLA = "semilla"


class EstadoLote(str, enum.Enum):
    """Estado operativo del lote reportado desde campo."""

    SANO = "sano"
    ATENCION = "atencion"
    PLAGA = "plaga"
    ENCHARQUE = "encharque"


class EstadoPlanAccion(str, enum.Enum):
    """Estado del plan de acción de siembra certificado."""

    PLANIFICADO = "planificado"
    ACTIVO_EN_PROGRESO = "activo_en_progreso"
    COMPLETADO = "completado"
    CANCELADO = "cancelado"


class CultivoIntercalado(str, enum.Enum):
    PAPA = "papa"
    QUINOA = "quinoa"
    CHOCHO = "chocho"
