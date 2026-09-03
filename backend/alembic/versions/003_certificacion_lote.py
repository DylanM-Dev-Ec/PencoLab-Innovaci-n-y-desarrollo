"""Add certificacion_lote for Método Mexicano planting quality.

Revision ID: 003_certificacion_lote
Revises: 002_auth_usuarios_roles
Create Date: 2026-09-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_certificacion_lote"
down_revision: Union[str, None] = "002_auth_usuarios_roles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "certificacion_lote",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("parcela_id", sa.Uuid(), nullable=False),
        sa.Column("hijuelos_seleccionados_ok", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("herramientas_desinfectadas", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("cicatrizacion_sol_completa", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("trazo_tres_metros_ok", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("fecha_certificacion", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("puntuacion_calidad", sa.Numeric(3, 2), nullable=False, server_default="0.00"),
        sa.Column("apto_pago_preferencial", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("estado", sa.String(120), nullable=False, server_default="no_apto"),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "puntuacion_calidad >= 0 AND puntuacion_calidad <= 1",
            name="ck_certificacion_puntuacion",
        ),
        sa.ForeignKeyConstraint(["parcela_id"], ["parcelas.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_certificacion_lote_parcela_id", "certificacion_lote", ["parcela_id"])


def downgrade() -> None:
    op.drop_index("ix_certificacion_lote_parcela_id", table_name="certificacion_lote")
    op.drop_table("certificacion_lote")
