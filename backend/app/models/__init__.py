import uuid
from datetime import datetime, date
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import (
    ClasificacionScouting,
    CultivoIntercalado,
    DestinoProducto,
    EstadoBitacora,
    EstadoGeneralPlanta,
    EstadoLote,
    EstadoPlanAccion,
    EstadoPlanta,
    EstacionRiego,
    PermeabilidadSuelo,
    RolUsuario,
    TipoBitacora,
    TipoCarbono,
    TipoPropagacion,
    TipoResiduo,
    TipoSuelo,
    TipoTrazado,
)


class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = (CheckConstraint("rol IN ('productor', 'empresa')", name="ck_usuarios_rol"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    rol: Mapped[RolUsuario] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    productor: Mapped["Productor | None"] = relationship(back_populates="usuario", uselist=False)


class Productor(Base):
    __tablename__ = "productores"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), unique=True, index=True
    )
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    telefono: Mapped[str | None] = mapped_column(String(20))
    comunidad: Mapped[str | None] = mapped_column(String(120))
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    usuario: Mapped["Usuario | None"] = relationship(back_populates="productor")
    parcelas: Mapped[list["Parcela"]] = relationship(back_populates="productor", cascade="all, delete-orphan")
    bitacoras: Mapped[list["BitacoraCampo"]] = relationship(back_populates="productor")


class Parcela(Base):
    __tablename__ = "parcelas"
    __table_args__ = (
        CheckConstraint(
            "tipo_trazado IS NULL OR tipo_trazado IN ('laderas', 'zanjas', 'plano')",
            name="ck_parcelas_tipo_trazado",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    productor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("productores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    ubicacion_lat: Mapped[Decimal | None] = mapped_column(Numeric(10, 8))
    ubicacion_lng: Mapped[Decimal | None] = mapped_column(Numeric(11, 8))
    area_hectareas: Mapped[Decimal | None] = mapped_column(Numeric(8, 4))
    altitud_msnm: Mapped[Decimal | None] = mapped_column(Numeric(6, 1))

    # pH y suelo según reglas agronómicas de .cursorrules
    ph: Mapped[Decimal | None] = mapped_column(Numeric(3, 1))
    tipo_suelo: Mapped[TipoSuelo | None] = mapped_column(String(30))
    permeabilidad: Mapped[PermeabilidadSuelo] = mapped_column(String(15), default=PermeabilidadSuelo.MEDIA.value)
    recomendacion_ph: Mapped[str | None] = mapped_column(Text)

    # Agave Andino: topografía anti-erosión y meta de expansión (3 → 20 ha)
    tipo_trazado: Mapped[TipoTrazado | None] = mapped_column(String(20))
    metas_expansion_ha: Mapped[Decimal] = mapped_column(
        Numeric(8, 2), nullable=False, default=Decimal("20.0")
    )
    # Estado operativo del lote (sano / atención / plaga / encharque)
    estado_lote: Mapped[EstadoLote | None] = mapped_column(String(20))

    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    productor: Mapped["Productor"] = relationship(back_populates="parcelas")
    plantas: Mapped[list["Planta"]] = relationship(back_populates="parcela", cascade="all, delete-orphan")
    bitacoras: Mapped[list["BitacoraCampo"]] = relationship(back_populates="parcela")
    certificaciones: Mapped[list["CertificacionLote"]] = relationship(
        back_populates="parcela", cascade="all, delete-orphan"
    )


class Planta(Base):
    __tablename__ = "plantas"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcela_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("parcelas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    codigo: Mapped[str | None] = mapped_column(String(50), unique=True)
    ubicacion_lat: Mapped[Decimal | None] = mapped_column(Numeric(10, 8))
    ubicacion_lng: Mapped[Decimal | None] = mapped_column(Numeric(11, 8))
    fecha_siembra: Mapped[date] = mapped_column(Date, nullable=False)

    # Regla 2: selección y tratamiento de hijuelos
    edad_planta_madre_anios: Mapped[Decimal | None] = mapped_column(Numeric(3, 1))
    peso_hijuelo_kg: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))
    tamano_roseta_inicial_cm: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    dias_cicatrizacion: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    tratamiento_sanitario: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fecha_corte_rizoma: Mapped[date | None] = mapped_column(Date)
    metodo_desinfeccion: Mapped[str] = mapped_column(String(50), default="fuego", nullable=False)
    hijuelo_apto: Mapped[bool | None] = mapped_column(Boolean)

    # Propagación mixta: hijuelos + semillas (.cursorrules)
    tipo_propagacion: Mapped[TipoPropagacion] = mapped_column(
        String(20), default=TipoPropagacion.HIJUELO.value, nullable=False
    )

    estado: Mapped[EstadoPlanta] = mapped_column(String(20), default=EstadoPlanta.ACTIVA.value, nullable=False)
    notas: Mapped[str | None] = mapped_column(Text)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    parcela: Mapped["Parcela"] = relationship(back_populates="plantas")
    mediciones: Mapped[list["MedicionCrecimiento"]] = relationship(
        back_populates="planta", cascade="all, delete-orphan"
    )
    bitacoras: Mapped[list["BitacoraCampo"]] = relationship(back_populates="planta")
    residuos: Mapped[list["InventarioResiduo"]] = relationship(
        back_populates="planta", cascade="all, delete-orphan"
    )


class MedicionCrecimiento(Base):
    __tablename__ = "mediciones_crecimiento"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    planta_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("plantas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fecha_medicion: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Regla 5: métricas obligatorias
    altura_roseta_cm: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    diametro_roseta_cm: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    numero_hojas: Mapped[int] = mapped_column(Integer, nullable=False)
    estado_general: Mapped[EstadoGeneralPlanta] = mapped_column(
        String(20), default=EstadoGeneralPlanta.SANA.value, nullable=False
    )

    # Carbono: estimado teórico vs verificado in situ
    tipo_carbono: Mapped[TipoCarbono] = mapped_column(
        String(25), default=TipoCarbono.ESTIMADO.value, nullable=False
    )
    carbono_verificado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    edad_planta_meses: Mapped[int | None] = mapped_column(Integer)
    biomasa_kg: Mapped[Decimal | None] = mapped_column(Numeric(8, 3))
    carbono_acumulado_kg: Mapped[Decimal | None] = mapped_column(Numeric(8, 3))
    co2_equivalente_kg: Mapped[Decimal | None] = mapped_column(Numeric(8, 3))
    algoritmo_version: Mapped[str] = mapped_column(String(20), default="alometrico_v1", nullable=False)

    notas: Mapped[str | None] = mapped_column(Text)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    planta: Mapped["Planta"] = relationship(back_populates="mediciones")


class BitacoraCampo(Base):
    __tablename__ = "bitacora_campo"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    productor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("productores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parcela_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("parcelas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    planta_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("plantas.id", ondelete="SET NULL"), index=True
    )

    tipo: Mapped[TipoBitacora] = mapped_column(String(30), nullable=False, index=True)
    fecha_programada: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    fecha_ejecucion: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    estado: Mapped[EstadoBitacora] = mapped_column(
        String(20), default=EstadoBitacora.PENDIENTE.value, nullable=False
    )

    # Offline-first: georreferenciación nativa al registrar en campo
    gps_lat: Mapped[Decimal | None] = mapped_column(Numeric(10, 8))
    gps_lng: Mapped[Decimal | None] = mapped_column(Numeric(11, 8))
    gps_precision_m: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    # Datos flexibles por tipo de actividad (riego, poda, fitosanitario, scouting)
    datos: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    notas: Mapped[str | None] = mapped_column(Text)

    # NULL = pendiente de sincronización desde el dispositivo móvil
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    productor: Mapped["Productor"] = relationship(back_populates="bitacoras")
    parcela: Mapped["Parcela"] = relationship(back_populates="bitacoras")
    planta: Mapped["Planta | None"] = relationship(back_populates="bitacoras")


class ReglaRiego(Base):
    __tablename__ = "reglas_riego"
    __table_args__ = (
        CheckConstraint("estacion IN ('invierno', 'primavera', 'verano', 'otono')", name="ck_reglas_riego_estacion"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    estacion: Mapped[EstacionRiego] = mapped_column(String(15), unique=True, nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    frecuencia_dias: Mapped[int] = mapped_column(Integer, nullable=False)
    nivel_humedad_min: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    nivel_humedad_max: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    alerta_exceso: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ScoutingVisual(Base):
    __tablename__ = "scouting_visual"
    __table_args__ = (
        CheckConstraint(
            "clasificacion IN ('sana','cochinilla','picudo_agave','pudricion_erwinia','hongo',"
            "'estres_hidrico','deficiencia_nutricional','otro','sin_clasificar')",
            name="ck_scouting_clasificacion",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    productor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("productores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parcela_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("parcelas.id", ondelete="SET NULL"), index=True
    )
    planta_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("plantas.id", ondelete="SET NULL"), index=True
    )
    fecha_captura: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    foto_url: Mapped[str | None] = mapped_column(Text)
    foto_local_path: Mapped[str | None] = mapped_column(Text)
    foto_base64: Mapped[str | None] = mapped_column(Text)
    clasificacion: Mapped[ClasificacionScouting] = mapped_column(
        String(40), default=ClasificacionScouting.SIN_CLASIFICAR.value, nullable=False
    )
    confianza_clasificacion: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))
    clasificado_por: Mapped[str] = mapped_column(String(20), default="manual", nullable=False)
    gps_lat: Mapped[Decimal | None] = mapped_column(Numeric(10, 8))
    gps_lng: Mapped[Decimal | None] = mapped_column(Numeric(11, 8))
    notas: Mapped[str | None] = mapped_column(Text)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CertificacionLote(Base):
    """Certificación de calidad de siembra — Método técnico de México."""

    __tablename__ = "certificacion_lote"
    __table_args__ = (
        CheckConstraint(
            "puntuacion_calidad >= 0 AND puntuacion_calidad <= 1",
            name="ck_certificacion_puntuacion",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    parcela_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("parcelas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Valida tamaño (8-11 cm) y peso (1.5-3 kg)
    hijuelos_seleccionados_ok: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Protocolo de fuego
    herramientas_desinfectadas: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Confirmación de los 10 días al sol
    cicatrizacion_sol_completa: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Distancia entre hileras 3 m (maquinaria / intercalado)
    trazo_tres_metros_ok: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    fecha_certificacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # Cumplimiento Modelo Mexicano en escala 0.00–1.00 (NUMERIC 3,2)
    puntuacion_calidad: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False, default=Decimal("0.00"))
    # True si puntuacion > 0.90 → Apto para Pago Preferencial (doble precio leche)
    apto_pago_preferencial: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    estado: Mapped[str] = mapped_column(String(120), nullable=False, default="no_apto")
    notas: Mapped[str | None] = mapped_column(Text)

    parcela: Mapped["Parcela"] = relationship(back_populates="certificaciones")


class ViveroSemilla(Base):
    """Monitoreo de germinación de semillas de penco (tasa teórica ~5%)."""

    __tablename__ = "vivero_semillas"
    __table_args__ = (
        CheckConstraint("cantidad_sembradas >= 0", name="ck_vivero_sembradas"),
        CheckConstraint("cantidad_germinadas >= 0", name="ck_vivero_germinadas"),
        CheckConstraint(
            "tasa_germinacion_real IS NULL OR (tasa_germinacion_real >= 0 AND tasa_germinacion_real <= 100)",
            name="ck_vivero_tasa",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lote_semillas: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    fecha_siembra: Mapped[date] = mapped_column(Date, nullable=False)
    cantidad_sembradas: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cantidad_germinadas: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Porcentaje real observado; comparar vs ~5% teórico (.cursorrules)
    tasa_germinacion_real: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RecoleccionJornada(Base):
    """Control de recolección de chawarmishky por mujeres (Pacto de Verano)."""

    __tablename__ = "recoleccion_jornada"
    __table_args__ = (
        CheckConstraint("litros_extraidos >= 0", name="ck_recoleccion_litros"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recolectora_nombre: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    fecha_recoleccion: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    litros_extraidos: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    temperatura_clima: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InventarioResiduo(Base):
    """Economía circular: aprovechamiento de residuos de hoja / biomasa de penco."""

    __tablename__ = "inventario_residuos"
    __table_args__ = (
        CheckConstraint(
            "tipo_residuo IN ('fibra_cabuya', 'flores_kirillas', 'chawarquero_madera', 'hoja_para_abono')",
            name="ck_residuo_tipo",
        ),
        CheckConstraint(
            "destino_producto IN ('canastas', 'alpargatas', 'encurtidos', 'abono_compost', 'construccion_vigas')",
            name="ck_residuo_destino",
        ),
        CheckConstraint("cantidad_kg >= 0", name="ck_residuo_cantidad"),
        CheckConstraint(
            "ingreso_adicional_usd IS NULL OR ingreso_adicional_usd >= 0",
            name="ck_residuo_ingreso",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    planta_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("plantas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tipo_residuo: Mapped[TipoResiduo] = mapped_column(String(40), nullable=False)
    cantidad_kg: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False, default=Decimal("0"))
    destino_producto: Mapped[DestinoProducto] = mapped_column(String(40), nullable=False)
    ingreso_adicional_usd: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    planta: Mapped["Planta"] = relationship(back_populates="residuos")


class ProduccionMensual(Base):
    """Producción y destilación: botellas a $2.00 USD/L (.cursorrules)."""

    __tablename__ = "produccion_mensual"
    __table_args__ = (
        CheckConstraint("mes >= 1 AND mes <= 12", name="ck_produccion_mes"),
        CheckConstraint("anio >= 2000", name="ck_produccion_anio"),
        CheckConstraint(
            "litros_destilados IS NULL OR litros_destilados >= 0",
            name="ck_produccion_litros",
        ),
        CheckConstraint(
            "botellas_producidas_2usd IS NULL OR botellas_producidas_2usd >= 0",
            name="ck_produccion_botellas",
        ),
        CheckConstraint(
            "ingreso_ventas_usd IS NULL OR ingreso_ventas_usd >= 0",
            name="ck_produccion_ingreso",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    productor_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("productores.id", ondelete="SET NULL"), index=True
    )
    anio: Mapped[int] = mapped_column(Integer, nullable=False)
    mes: Mapped[int] = mapped_column(Integer, nullable=False)
    # Destilación / comercialización
    litros_destilados: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    botellas_producidas_2usd: Mapped[int | None] = mapped_column(Integer)
    ingreso_ventas_usd: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    notas: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PlanAccionSiembra(Base):
    """Planificación de siembra certificada (CalculadoraRiquezaFutura)."""

    __tablename__ = "planes_accion"
    __table_args__ = (
        CheckConstraint(
            "hectareas_planificadas > 0 AND hectareas_planificadas <= 20",
            name="ck_plan_ha_sostenible",
        ),
        CheckConstraint(
            "estado IN ('planificado', 'activo_en_progreso', 'completado', 'cancelado')",
            name="ck_plan_estado",
        ),
        CheckConstraint(
            "cultivo_intercalado_elegido IN ('papa', 'quinoa', 'chocho')",
            name="ck_plan_intercalado",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    productor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("productores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    hectareas_planificadas: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    cultivo_intercalado_elegido: Mapped[CultivoIntercalado] = mapped_column(String(20), nullable=False)
    latitud_inicial: Mapped[Decimal | None] = mapped_column(Numeric(10, 8))
    longitud_inicial: Mapped[Decimal | None] = mapped_column(Numeric(11, 8))
    fecha_inicio_plan: Mapped[date] = mapped_column(Date, nullable=False)
    densidad_plantas_ha: Mapped[int] = mapped_column(Integer, nullable=False, default=1000)
    estado: Mapped[EstadoPlanAccion] = mapped_column(
        String(30), nullable=False, default=EstadoPlanAccion.PLANIFICADO.value, index=True
    )
    proyeccion_financiera: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    proyeccion_carbono: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    activado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    planta_activadora_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("plantas.id", ondelete="SET NULL"), index=True
    )
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    productor: Mapped["Productor"] = relationship()
    planta_activadora: Mapped["Planta | None"] = relationship(foreign_keys=[planta_activadora_id])
