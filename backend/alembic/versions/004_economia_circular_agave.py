"""Economía circular, vivero semillas, recolección femenina y destilación.

Revision ID: 004_economia_circular_agave
Revises: 003_certificacion_lote
Create Date: 2026-09-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_economia_circular_agave"
down_revision: Union[str, None] = "003_certificacion_lote"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- parcelas: topografía + meta expansión ---
    op.add_column("parcelas", sa.Column("tipo_trazado", sa.String(length=20), nullable=True))
    op.add_column(
        "parcelas",
        sa.Column(
            "metas_expansion_ha",
            sa.Numeric(8, 2),
            nullable=False,
            server_default="20.0",
        ),
    )
    op.create_check_constraint(
        "ck_parcelas_tipo_trazado",
        "parcelas",
        "tipo_trazado IS NULL OR tipo_trazado IN ('laderas', 'zanjas', 'plano')",
    )

    # --- plantas: propagación mixta ---
    op.add_column(
        "plantas",
        sa.Column(
            "tipo_propagacion",
            sa.String(length=20),
            nullable=False,
            server_default="hijuelo",
        ),
    )
    op.create_check_constraint(
        "ck_plantas_tipo_propagacion",
        "plantas",
        "tipo_propagacion IN ('hijuelo', 'semilla')",
    )

    # --- vivero_semillas (germinación teórica ~5%) ---
    op.create_table(
        "vivero_semillas",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("lote_semillas", sa.String(length=120), nullable=False),
        sa.Column("fecha_siembra", sa.Date(), nullable=False),
        sa.Column("cantidad_sembradas", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cantidad_germinadas", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tasa_germinacion_real", sa.Numeric(6, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("cantidad_sembradas >= 0", name="ck_vivero_sembradas"),
        sa.CheckConstraint("cantidad_germinadas >= 0", name="ck_vivero_germinadas"),
        sa.CheckConstraint(
            "tasa_germinacion_real IS NULL OR (tasa_germinacion_real >= 0 AND tasa_germinacion_real <= 100)",
            name="ck_vivero_tasa",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vivero_semillas_lote", "vivero_semillas", ["lote_semillas"])

    # --- recoleccion_jornada (Pacto de Verano / mujeres recolectoras) ---
    op.create_table(
        "recoleccion_jornada",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("recolectora_nombre", sa.String(length=120), nullable=False),
        sa.Column("fecha_recoleccion", sa.Date(), nullable=False),
        sa.Column("litros_extraidos", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("temperatura_clima", sa.Numeric(5, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("litros_extraidos >= 0", name="ck_recoleccion_litros"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_recoleccion_jornada_nombre", "recoleccion_jornada", ["recolectora_nombre"])
    op.create_index("ix_recoleccion_jornada_fecha", "recoleccion_jornada", ["fecha_recoleccion"])

    # --- inventario_residuos (economía circular) ---
    op.create_table(
        "inventario_residuos",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("planta_id", sa.Uuid(), nullable=False),
        sa.Column("tipo_residuo", sa.String(length=40), nullable=False),
        sa.Column("cantidad_kg", sa.Numeric(10, 3), nullable=False, server_default="0"),
        sa.Column("destino_producto", sa.String(length=40), nullable=False),
        sa.Column("ingreso_adicional_usd", sa.Numeric(12, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint(
            "tipo_residuo IN ('fibra_cabuya', 'flores_kirillas', 'chawarquero_madera', 'hoja_para_abono')",
            name="ck_residuo_tipo",
        ),
        sa.CheckConstraint(
            "destino_producto IN ('canastas', 'alpargatas', 'encurtidos', 'abono_compost', 'construccion_vigas')",
            name="ck_residuo_destino",
        ),
        sa.CheckConstraint("cantidad_kg >= 0", name="ck_residuo_cantidad"),
        sa.CheckConstraint(
            "ingreso_adicional_usd IS NULL OR ingreso_adicional_usd >= 0",
            name="ck_residuo_ingreso",
        ),
        sa.ForeignKeyConstraint(["planta_id"], ["plantas.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inventario_residuos_planta_id", "inventario_residuos", ["planta_id"])

    # --- produccion_mensual (destilación $2 USD/L) ---
    op.create_table(
        "produccion_mensual",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("productor_id", sa.Uuid(), nullable=True),
        sa.Column("anio", sa.Integer(), nullable=False),
        sa.Column("mes", sa.Integer(), nullable=False),
        sa.Column("litros_destilados", sa.Numeric(12, 2), nullable=True),
        sa.Column("botellas_producidas_2usd", sa.Integer(), nullable=True),
        sa.Column("ingreso_ventas_usd", sa.Numeric(14, 2), nullable=True),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("mes >= 1 AND mes <= 12", name="ck_produccion_mes"),
        sa.CheckConstraint("anio >= 2000", name="ck_produccion_anio"),
        sa.CheckConstraint(
            "litros_destilados IS NULL OR litros_destilados >= 0",
            name="ck_produccion_litros",
        ),
        sa.CheckConstraint(
            "botellas_producidas_2usd IS NULL OR botellas_producidas_2usd >= 0",
            name="ck_produccion_botellas",
        ),
        sa.CheckConstraint(
            "ingreso_ventas_usd IS NULL OR ingreso_ventas_usd >= 0",
            name="ck_produccion_ingreso",
        ),
        sa.ForeignKeyConstraint(["productor_id"], ["productores.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_produccion_mensual_productor_id", "produccion_mensual", ["productor_id"])
    op.create_index("ix_produccion_mensual_periodo", "produccion_mensual", ["anio", "mes"])


def downgrade() -> None:
    op.drop_index("ix_produccion_mensual_periodo", table_name="produccion_mensual")
    op.drop_index("ix_produccion_mensual_productor_id", table_name="produccion_mensual")
    op.drop_table("produccion_mensual")

    op.drop_index("ix_inventario_residuos_planta_id", table_name="inventario_residuos")
    op.drop_table("inventario_residuos")

    op.drop_index("ix_recoleccion_jornada_fecha", table_name="recoleccion_jornada")
    op.drop_index("ix_recoleccion_jornada_nombre", table_name="recoleccion_jornada")
    op.drop_table("recoleccion_jornada")

    op.drop_index("ix_vivero_semillas_lote", table_name="vivero_semillas")
    op.drop_table("vivero_semillas")

    op.drop_constraint("ck_plantas_tipo_propagacion", "plantas", type_="check")
    op.drop_column("plantas", "tipo_propagacion")

    op.drop_constraint("ck_parcelas_tipo_trazado", "parcelas", type_="check")
    op.drop_column("parcelas", "metas_expansion_ha")
    op.drop_column("parcelas", "tipo_trazado")
