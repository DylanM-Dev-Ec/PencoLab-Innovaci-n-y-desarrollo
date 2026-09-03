"""Usuarios, roles y vínculo con productores

Revision ID: 002_auth_usuarios_roles
Revises: 001_initial_penco_schema
Create Date: 2026-09-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_auth_usuarios_roles"
down_revision: Union[str, None] = "001_initial_penco_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "usuarios",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("rol", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("email", name="uq_usuarios_email"),
        sa.CheckConstraint("rol IN ('productor', 'empresa')", name="ck_usuarios_rol"),
    )
    op.create_index("ix_usuarios_email", "usuarios", ["email"])

    op.add_column("productores", sa.Column("usuario_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_productores_usuario_id",
        "productores",
        "usuarios",
        ["usuario_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_productores_usuario_id", "productores", ["usuario_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_productores_usuario_id", table_name="productores")
    op.drop_constraint("fk_productores_usuario_id", "productores", type_="foreignkey")
    op.drop_column("productores", "usuario_id")
    op.drop_index("ix_usuarios_email", table_name="usuarios")
    op.drop_table("usuarios")
