-- Autenticación y roles (PostgreSQL / SQLite compatible)
-- Roles permitidos: 'productor' | 'empresa'

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('productor', 'empresa')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Cada productor puede vincularse a una cuenta de acceso
ALTER TABLE productores
    ADD COLUMN IF NOT EXISTS usuario_id INTEGER UNIQUE
    REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_productores_usuario_id ON productores(usuario_id);
CREATE INDEX IF NOT EXISTS ix_usuarios_email ON usuarios(email);
