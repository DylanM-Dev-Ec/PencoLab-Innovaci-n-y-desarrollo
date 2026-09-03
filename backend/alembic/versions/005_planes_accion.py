"""Planes de acción de siembra certificada.

Revision ID: 005_planes_accion
Revises: 004_economia_circular_agave
Create Date: 2026-09-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_planes_accion"
down_revision: Union[str, None] = "004_economia_circular_agave"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "planes_accion",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("productor_id", sa.Uuid(), nullable=False),
        sa.Column("hectareas_planificadas", sa.Numeric(8, 2), nullable=False),
        sa.Column("cultivo_intercalado_elegido", sa.String(length=20), nullable=False),
        sa.Column("latitud_inicial", sa.Numeric(10, 8), nullable=True),
        sa.Column("longitud_inicial", sa.Numeric(11, 8), nullable=True),
        sa.Column("fecha_inicio_plan", sa.Date(), nullable=False),
        sa.Column("densidad_plantas_ha", sa.Integer(), nullable=False, server_default="1000"),
        sa.Column("estado", sa.String(length=30), nullable=False, server_default="planificado"),
        sa.Column("proyeccion_financiera", sa.JSON(), nullable=False),
        sa.Column("proyeccion_carbono", sa.JSON(), nullable=False),
        sa.Column("activado_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column("planta_activadora_id", sa.Uuid(), nullable=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint(
            "hectareas_planificadas > 0 AND hectareas_planificadas <= 20",
            name="ck_plan_ha_sostenible",
        ),
        sa.CheckConstraint(
            "estado IN ('planificado', 'activo_en_progreso', 'completado', 'cancelado')",
            name="ck_plan_estado",
        ),
        sa.CheckConstraint(
            "cultivo_intercalado_elegido IN ('papa', 'quinoa', 'chocho')",
            name="ck_plan_intercalado",
        ),
        sa.ForeignKeyConstraint(["productor_id"], ["productores.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["planta_activadora_id"], ["plantas.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_planes_accion_productor_id", "planes_accion", ["productor_id"])
    op.create_index("ix_planes_accion_estado", "planes_accion", ["estado"])
    op.create_index("ix_planes_accion_planta_activadora_id", "planes_accion", ["planta_activadora_id"])
    op.create_index("ix_planes_accion_synced_at", "planes_accion", ["synced_at"])


def downgrade() -> None:
    op.drop_index("ix_planes_accion_synced_at", table_name="planes_accion")
    op.drop_index("ix_planes_accion_planta_activadora_id", table_name="planes_accion")
    op.drop_index("ix_planes_accion_estado", table_name="planes_accion")
    op.drop_index("ix_planes_accion_productor_id", table_name="planes_accion")
    op.drop_table("planes_accion")
