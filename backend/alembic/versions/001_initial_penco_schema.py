"""Esquema inicial PencoLab

Revision ID: 001_initial_penco_schema
Revises:
Create Date: 2026-03-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial_penco_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    op.create_table(
        "productores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=150), nullable=False),
        sa.Column("telefono", sa.String(length=20), nullable=True),
        sa.Column("comunidad", sa.String(length=120), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("email", name="uq_productores_email"),
    )

    op.create_table(
        "parcelas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("productor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("productores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("ubicacion_lat", sa.Numeric(10, 8), nullable=True),
        sa.Column("ubicacion_lng", sa.Numeric(11, 8), nullable=True),
        sa.Column("area_hectareas", sa.Numeric(8, 4), nullable=True),
        sa.Column("altitud_msnm", sa.Numeric(6, 1), nullable=True),
        sa.Column("ph", sa.Numeric(3, 1), nullable=True),
        sa.Column("tipo_suelo", sa.String(length=30), nullable=True),
        sa.Column("permeabilidad", sa.String(length=15), nullable=False, server_default="media"),
        sa.Column("recomendacion_ph", sa.Text(), nullable=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("ph IS NULL OR (ph >= 0 AND ph <= 14)", name="ck_parcelas_ph_rango"),
        sa.CheckConstraint(
            "tipo_suelo IS NULL OR tipo_suelo IN ('franco', 'arenoso', 'arcilloso', 'limoso', 'franco-arenoso', 'franco-arcilloso', 'otro')",
            name="ck_parcelas_tipo_suelo",
        ),
        sa.CheckConstraint(
            "permeabilidad IN ('alta', 'media', 'baja')",
            name="ck_parcelas_permeabilidad",
        ),
    )
    op.create_index("ix_parcelas_productor_id", "parcelas", ["productor_id"])
    op.create_index("ix_parcelas_synced_at", "parcelas", ["synced_at"])

    op.create_table(
        "plantas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("parcela_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("parcelas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("codigo", sa.String(length=50), nullable=True),
        sa.Column("ubicacion_lat", sa.Numeric(10, 8), nullable=True),
        sa.Column("ubicacion_lng", sa.Numeric(11, 8), nullable=True),
        sa.Column("fecha_siembra", sa.Date(), nullable=False),
        sa.Column("edad_planta_madre_anios", sa.Numeric(3, 1), nullable=True),
        sa.Column("peso_hijuelo_kg", sa.Numeric(4, 2), nullable=True),
        sa.Column("tamano_roseta_inicial_cm", sa.Numeric(5, 2), nullable=True),
        sa.Column("dias_cicatrizacion", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("tratamiento_sanitario", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("fecha_corte_rizoma", sa.Date(), nullable=True),
        sa.Column("metodo_desinfeccion", sa.String(length=50), nullable=False, server_default="fuego"),
        sa.Column("hijuelo_apto", sa.Boolean(), nullable=True),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="activa"),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("codigo", name="uq_plantas_codigo"),
        sa.CheckConstraint(
            "estado IN ('activa', 'cosechada', 'muerta', 'enferma')",
            name="ck_plantas_estado",
        ),
    )
    op.create_index("ix_plantas_parcela_id", "plantas", ["parcela_id"])
    op.create_index("ix_plantas_synced_at", "plantas", ["synced_at"])

    op.create_table(
        "mediciones_crecimiento",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("planta_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("plantas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fecha_medicion", sa.Date(), nullable=False),
        sa.Column("altura_roseta_cm", sa.Numeric(6, 2), nullable=False),
        sa.Column("diametro_roseta_cm", sa.Numeric(6, 2), nullable=False),
        sa.Column("numero_hojas", sa.Integer(), nullable=False),
        sa.Column("estado_general", sa.String(length=20), nullable=False, server_default="sana"),
        sa.Column("tipo_carbono", sa.String(length=25), nullable=False, server_default="estimado"),
        sa.Column("edad_planta_meses", sa.Integer(), nullable=True),
        sa.Column("biomasa_kg", sa.Numeric(8, 3), nullable=True),
        sa.Column("carbono_acumulado_kg", sa.Numeric(8, 3), nullable=True),
        sa.Column("co2_equivalente_kg", sa.Numeric(8, 3), nullable=True),
        sa.Column("algoritmo_version", sa.String(length=20), nullable=False, server_default="v1.0"),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("numero_hojas >= 0", name="ck_mediciones_numero_hojas"),
        sa.CheckConstraint(
            "estado_general IN ('sana', 'estresada', 'enferma', 'recuperandose')",
            name="ck_mediciones_estado_general",
        ),
        sa.CheckConstraint(
            "tipo_carbono IN ('estimado', 'verificado_in_situ')",
            name="ck_mediciones_tipo_carbono",
        ),
    )
    op.create_index("ix_mediciones_crecimiento_planta_id", "mediciones_crecimiento", ["planta_id"])
    op.create_index("ix_mediciones_crecimiento_fecha_medicion", "mediciones_crecimiento", ["fecha_medicion"])
    op.create_index("ix_mediciones_crecimiento_synced_at", "mediciones_crecimiento", ["synced_at"])

    op.create_table(
        "bitacora_campo",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("productor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("productores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parcela_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("parcelas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("planta_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("plantas.id", ondelete="SET NULL"), nullable=True),
        sa.Column("tipo", sa.String(length=30), nullable=False),
        sa.Column("fecha_programada", sa.Date(), nullable=False),
        sa.Column("fecha_ejecucion", sa.DateTime(timezone=True), nullable=True),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="pendiente"),
        sa.Column("gps_lat", sa.Numeric(10, 8), nullable=True),
        sa.Column("gps_lng", sa.Numeric(11, 8), nullable=True),
        sa.Column("gps_precision_m", sa.Numeric(6, 2), nullable=True),
        sa.Column("datos", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "tipo IN ('riego', 'poda_sanitaria', 'fitosanitario', 'fertilizacion', 'siembra', 'cosecha', 'monitoreo', 'scouting_visual', 'otro')",
            name="ck_bitacora_tipo",
        ),
        sa.CheckConstraint(
            "estado IN ('pendiente', 'en_progreso', 'completada', 'cancelada')",
            name="ck_bitacora_estado",
        ),
    )
    op.create_index("ix_bitacora_campo_productor_id", "bitacora_campo", ["productor_id"])
    op.create_index("ix_bitacora_campo_parcela_id", "bitacora_campo", ["parcela_id"])
    op.create_index("ix_bitacora_campo_planta_id", "bitacora_campo", ["planta_id"])
    op.create_index("ix_bitacora_campo_tipo", "bitacora_campo", ["tipo"])
    op.create_index("ix_bitacora_campo_fecha_programada", "bitacora_campo", ["fecha_programada"])
    op.create_index("ix_bitacora_campo_synced_at", "bitacora_campo", ["synced_at"])
    op.create_index(
        "ix_bitacora_campo_pendiente_sync",
        "bitacora_campo",
        ["synced_at"],
        postgresql_where=sa.text("synced_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_bitacora_campo_pendiente_sync", table_name="bitacora_campo")
    op.drop_index("ix_bitacora_campo_synced_at", table_name="bitacora_campo")
    op.drop_index("ix_bitacora_campo_fecha_programada", table_name="bitacora_campo")
    op.drop_index("ix_bitacora_campo_tipo", table_name="bitacora_campo")
    op.drop_index("ix_bitacora_campo_planta_id", table_name="bitacora_campo")
    op.drop_index("ix_bitacora_campo_parcela_id", table_name="bitacora_campo")
    op.drop_index("ix_bitacora_campo_productor_id", table_name="bitacora_campo")
    op.drop_table("bitacora_campo")

    op.drop_index("ix_mediciones_crecimiento_synced_at", table_name="mediciones_crecimiento")
    op.drop_index("ix_mediciones_crecimiento_fecha_medicion", table_name="mediciones_crecimiento")
    op.drop_index("ix_mediciones_crecimiento_planta_id", table_name="mediciones_crecimiento")
    op.drop_table("mediciones_crecimiento")

    op.drop_index("ix_plantas_synced_at", table_name="plantas")
    op.drop_index("ix_plantas_parcela_id", table_name="plantas")
    op.drop_table("plantas")

    op.drop_index("ix_parcelas_synced_at", table_name="parcelas")
    op.drop_index("ix_parcelas_productor_id", table_name="parcelas")
    op.drop_table("parcelas")

    op.drop_table("productores")
