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
