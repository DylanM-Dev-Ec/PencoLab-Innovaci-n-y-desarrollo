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
    EstadoBitacora,
    EstadoGeneralPlanta,
    EstadoPlanta,
    PermeabilidadSuelo,
    RolUsuario,
    TipoBitacora,
    TipoCarbono,
    TipoSuelo,
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

    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    productor: Mapped["Productor"] = relationship(back_populates="parcelas")
    plantas: Mapped[list["Planta"]] = relationship(back_populates="parcela", cascade="all, delete-orphan")
    bitacoras: Mapped[list["BitacoraCampo"]] = relationship(back_populates="parcela")


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

    # Estimación de carbono (Regla 5)
    tipo_carbono: Mapped[TipoCarbono] = mapped_column(
        String(25), default=TipoCarbono.ESTIMADO.value, nullable=False
    )
    edad_planta_meses: Mapped[int | None] = mapped_column(Integer)
    biomasa_kg: Mapped[Decimal | None] = mapped_column(Numeric(8, 3))
    carbono_acumulado_kg: Mapped[Decimal | None] = mapped_column(Numeric(8, 3))
    co2_equivalente_kg: Mapped[Decimal | None] = mapped_column(Numeric(8, 3))
    algoritmo_version: Mapped[str] = mapped_column(String(20), default="v1.0", nullable=False)

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
