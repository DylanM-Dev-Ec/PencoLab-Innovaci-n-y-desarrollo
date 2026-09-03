from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

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


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")


# --- Productores ---


class ProductorBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    nombre: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    telefono: str | None = Field(None, max_length=20)
    comunidad: str | None = Field(None, max_length=120)
    activo: bool = True


class ProductorCreate(ProductorBase):
    id: UUID | None = None


class ProductorUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=100)
    email: EmailStr | None = None
    telefono: str | None = Field(None, max_length=20)
    comunidad: str | None = Field(None, max_length=120)
    activo: bool | None = None


class ProductorRead(ProductorBase, ORMModel):
    id: UUID
    usuario_id: int | None = None
    created_at: datetime
    updated_at: datetime


# --- Auth ---


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    rol: RolUsuario
    nombre: str | None = Field(None, min_length=1, max_length=100)
    comunidad: str | None = Field(None, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    id: int
    rol: RolUsuario
    productor_id: UUID | None = None
    email: EmailStr


# --- Parcelas ---


class ParcelaBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    nombre: str = Field(..., min_length=1, max_length=100)
    ubicacion_lat: Decimal | None = Field(None, ge=-90, le=90)
    ubicacion_lng: Decimal | None = Field(None, ge=-180, le=180)
    area_hectareas: Decimal | None = Field(None, gt=0)
    altitud_msnm: Decimal | None = None
    ph: Decimal | None = Field(None, ge=0, le=14)
    tipo_suelo: TipoSuelo | None = None
    permeabilidad: PermeabilidadSuelo = PermeabilidadSuelo.MEDIA


class ParcelaCreate(ParcelaBase):
    productor_id: UUID


class ParcelaUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=100)
    ubicacion_lat: Decimal | None = Field(None, ge=-90, le=90)
    ubicacion_lng: Decimal | None = Field(None, ge=-180, le=180)
    area_hectareas: Decimal | None = Field(None, gt=0)
    altitud_msnm: Decimal | None = None
    ph: Decimal | None = Field(None, ge=0, le=14)
    tipo_suelo: TipoSuelo | None = None
    permeabilidad: PermeabilidadSuelo | None = None


class ParcelaRead(ParcelaBase, ORMModel):
    id: UUID
    productor_id: UUID
    recomendacion_ph: str | None = None
    synced_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


# --- Plantas ---


class PlantaBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    codigo: str | None = Field(None, max_length=50)
    ubicacion_lat: Decimal | None = Field(None, ge=-90, le=90)
    ubicacion_lng: Decimal | None = Field(None, ge=-180, le=180)
    fecha_siembra: date
    edad_planta_madre_anios: Decimal | None = Field(None, ge=0)
    peso_hijuelo_kg: Decimal | None = Field(None, ge=0)
    tamano_roseta_inicial_cm: Decimal | None = Field(None, ge=0)
    dias_cicatrizacion: int = Field(10, ge=0)
    tratamiento_sanitario: bool = False
    fecha_corte_rizoma: date | None = None
    metodo_desinfeccion: str = "fuego"
    estado: EstadoPlanta = EstadoPlanta.ACTIVA
    notas: str | None = None


class PlantaCreate(PlantaBase):
    parcela_id: UUID


class PlantaUpdate(BaseModel):
    codigo: str | None = Field(None, max_length=50)
    ubicacion_lat: Decimal | None = Field(None, ge=-90, le=90)
    ubicacion_lng: Decimal | None = Field(None, ge=-180, le=180)
    fecha_siembra: date | None = None
    edad_planta_madre_anios: Decimal | None = Field(None, ge=0)
    peso_hijuelo_kg: Decimal | None = Field(None, ge=0)
    tamano_roseta_inicial_cm: Decimal | None = Field(None, ge=0)
    dias_cicatrizacion: int | None = Field(None, ge=0)
    tratamiento_sanitario: bool | None = None
    fecha_corte_rizoma: date | None = None
    metodo_desinfeccion: str | None = None
    estado: EstadoPlanta | None = None
    notas: str | None = None


class PlantaRead(PlantaBase, ORMModel):
    id: UUID
    parcela_id: UUID
    hijuelo_apto: bool | None = None
    synced_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


# --- Mediciones ---


class MedicionBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    fecha_medicion: date
    altura_roseta_cm: Decimal = Field(..., gt=0)
    diametro_roseta_cm: Decimal = Field(..., gt=0)
    numero_hojas: int = Field(..., ge=0)
    estado_general: EstadoGeneralPlanta = EstadoGeneralPlanta.SANA
    tipo_carbono: TipoCarbono = TipoCarbono.ESTIMADO
    edad_planta_meses: int | None = Field(None, ge=0)
    biomasa_kg: Decimal | None = None
    carbono_acumulado_kg: Decimal | None = None
    co2_equivalente_kg: Decimal | None = None
    notas: str | None = None


class MedicionCreate(MedicionBase):
    planta_id: UUID
    calcular_carbono: bool = True


class MedicionUpdate(BaseModel):
    fecha_medicion: date | None = None
    altura_roseta_cm: Decimal | None = Field(None, gt=0)
    diametro_roseta_cm: Decimal | None = Field(None, gt=0)
    numero_hojas: int | None = Field(None, ge=0)
    estado_general: EstadoGeneralPlanta | None = None
    tipo_carbono: TipoCarbono | None = None
    edad_planta_meses: int | None = Field(None, ge=0)
    biomasa_kg: Decimal | None = None
    carbono_acumulado_kg: Decimal | None = None
    co2_equivalente_kg: Decimal | None = None
    notas: str | None = None
    calcular_carbono: bool = False


class MedicionRead(MedicionBase, ORMModel):
    id: UUID
    planta_id: UUID
    algoritmo_version: str
    synced_at: datetime | None = None
    created_at: datetime


# --- Bitácora ---


class BitacoraBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    tipo: TipoBitacora
    fecha_programada: date
    fecha_ejecucion: datetime | None = None
    estado: EstadoBitacora = EstadoBitacora.PENDIENTE
    gps_lat: Decimal | None = Field(None, ge=-90, le=90)
    gps_lng: Decimal | None = Field(None, ge=-180, le=180)
    gps_precision_m: Decimal | None = Field(None, ge=0)
    datos: dict[str, Any] = Field(default_factory=dict)
    notas: str | None = None


class BitacoraCreate(BitacoraBase):
    productor_id: UUID
    parcela_id: UUID
    planta_id: UUID | None = None


class BitacoraUpdate(BaseModel):
    tipo: TipoBitacora | None = None
    fecha_programada: date | None = None
    fecha_ejecucion: datetime | None = None
    estado: EstadoBitacora | None = None
    gps_lat: Decimal | None = Field(None, ge=-90, le=90)
    gps_lng: Decimal | None = Field(None, ge=-180, le=180)
    gps_precision_m: Decimal | None = Field(None, ge=0)
    datos: dict[str, Any] | None = None
    notas: str | None = None


class BitacoraRead(BitacoraBase, ORMModel):
    id: UUID
    productor_id: UUID
    parcela_id: UUID
    planta_id: UUID | None = None
    synced_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


# --- Sincronización offline ---


class SyncParcelaItem(ParcelaBase):
    id: UUID
    productor_id: UUID


class SyncPlantaItem(PlantaBase):
    id: UUID
    parcela_id: UUID


class SyncMedicionItem(MedicionBase):
    id: UUID
    planta_id: UUID
    algoritmo_version: str = "v1.0"
    calcular_carbono: bool = True


class SyncBitacoraItem(BitacoraBase):
    id: UUID
    productor_id: UUID
    parcela_id: UUID
    planta_id: UUID | None = None


class SyncPushPayload(BaseModel):
    productor_id: UUID
    parcelas: list[SyncParcelaItem] = Field(default_factory=list)
    plantas: list[SyncPlantaItem] = Field(default_factory=list)
    mediciones: list[SyncMedicionItem] = Field(default_factory=list)
    bitacora: list[SyncBitacoraItem] = Field(default_factory=list)


class SyncPullResponse(BaseModel):
    productor_id: UUID
    sincronizado_en: datetime
    parcelas: list[ParcelaRead] = Field(default_factory=list)
    plantas: list[PlantaRead] = Field(default_factory=list)
    mediciones: list[MedicionRead] = Field(default_factory=list)
    bitacora: list[BitacoraRead] = Field(default_factory=list)


class SyncPushResponse(BaseModel):
    productor_id: UUID
    sincronizado_en: datetime
    parcelas_procesadas: int = 0
    plantas_procesadas: int = 0
    mediciones_procesadas: int = 0
    bitacora_procesadas: int = 0
