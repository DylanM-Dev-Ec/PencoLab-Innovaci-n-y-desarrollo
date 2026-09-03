-- ============================================================
-- PencoLab - Esquema Local SQLite (Offline-First)
-- Para sincronización con backend PostgreSQL
-- ============================================================

-- 1. PARCELAS
CREATE TABLE IF NOT EXISTS parcelas (
    id TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL,
    nombre TEXT NOT NULL,
    ubicacion_lat REAL,
    ubicacion_lng REAL,
    area_hectareas REAL,
    altitud_msnm REAL,
    synced_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. ANÁLISIS DE SUELO
CREATE TABLE IF NOT EXISTS analisis_suelo (
    id TEXT PRIMARY KEY,
    parcela_id TEXT NOT NULL REFERENCES parcelas(id),
    fecha_analisis TEXT NOT NULL DEFAULT (date('now')),
    ph REAL NOT NULL CHECK (ph >= 0 AND ph <= 14),
    tipo_suelo TEXT NOT NULL,
    permeabilidad TEXT DEFAULT 'media',
    materia_organica REAL,
    nitrogeno REAL,
    fosforo REAL,
    potasio REAL,
    notas TEXT,
    synced_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 3. PLANTAS
CREATE TABLE IF NOT EXISTS plantas (
    id TEXT PRIMARY KEY,
    parcela_id TEXT NOT NULL REFERENCES parcelas(id),
    codigo TEXT UNIQUE,
    ubicacion_lat REAL,
    ubicacion_lng REAL,
    fecha_siembra TEXT NOT NULL,
    edad_planta_madre_anios REAL,
    peso_hijuelo_kg REAL,
    tamano_roseta_inicial_cm REAL,
    dias_cicatrizacion INTEGER DEFAULT 10,
    tratamiento_sanitario INTEGER DEFAULT 0,
    fecha_corte_rizoma TEXT,
    metodo_desinfeccion TEXT DEFAULT 'fuego',
    estado TEXT DEFAULT 'activa',
    notas TEXT,
    synced_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 4. MÉTRICAS DE CRECIMIENTO
CREATE TABLE IF NOT EXISTS metricas_crecimiento (
    id TEXT PRIMARY KEY,
    planta_id TEXT NOT NULL REFERENCES plantas(id),
    fecha_medicion TEXT NOT NULL DEFAULT (date('now')),
    altura_roseta_cm REAL NOT NULL,
    diametro_roseta_cm REAL NOT NULL,
    numero_hojas INTEGER NOT NULL,
    estado_general TEXT DEFAULT 'sana',
    notas TEXT,
    synced_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 5. ESTIMACIONES DE CARBONO
CREATE TABLE IF NOT EXISTS estimaciones_carbono (
    id TEXT PRIMARY KEY,
    planta_id TEXT NOT NULL REFERENCES plantas(id),
    metrica_id TEXT REFERENCES metricas_crecimiento(id),
    fecha_estimacion TEXT NOT NULL DEFAULT (date('now')),
    tipo TEXT NOT NULL CHECK (tipo IN ('estimado', 'verificado_in_situ')),
    biomasa_kg REAL,
    carbono_acumulado_kg REAL,
    co2_equivalente_kg REAL,
    algoritmo_version TEXT DEFAULT 'v1.0',
    edad_planta_meses INTEGER,
    altura_cm REAL,
    diametro_cm REAL,
    synced_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 6. TAREAS DIARIAS (Riego, Podas, Fitosanitarios)
CREATE TABLE IF NOT EXISTS tareas (
    id TEXT PRIMARY KEY,
    parcela_id TEXT NOT NULL REFERENCES parcelas(id),
    planta_id TEXT REFERENCES plantas(id),
    usuario_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    fecha_programada TEXT NOT NULL,
    fecha_ejecucion TEXT,
    estado TEXT DEFAULT 'pendiente',
    gps_lat REAL,
    gps_lng REAL,
    gps_precision_m REAL,
    datos TEXT DEFAULT '{}',  -- JSON string
    notas TEXT,
    synced_at TEXT,  -- NULL = pendiente de sincronización
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 7. REGLAS DE RIEGO (Catálogo local)
CREATE TABLE IF NOT EXISTS reglas_riego (
    id TEXT PRIMARY KEY,
    estacion TEXT NOT NULL UNIQUE,
    descripcion TEXT NOT NULL,
    frecuencia_dias INTEGER,
    nivel_humedad_min REAL,
    nivel_humedad_max REAL,
    alerta_exceso INTEGER DEFAULT 1
);

INSERT OR IGNORE INTO reglas_riego (id, estacion, descripcion, frecuencia_dias, nivel_humedad_min, nivel_humedad_max) VALUES
('rr-inv', 'invierno', 'Riego racionado al mínimo. Mantener húmedo, no mojado.', 14, 20.00, 40.00),
('rr-pri', 'primavera', 'Riego según demanda del suelo. Humedecer sin encharcar.', 7, 30.00, 55.00),
('rr-ver', 'verano', 'Reducción paulatina. No regar en época lluviosa extrema.', 10, 25.00, 45.00),
('rr-oto', 'otono', 'Riego moderado de transición.', 10, 25.00, 50.00);

-- 8. SCOUTING VISUAL
CREATE TABLE IF NOT EXISTS scouting_visual (
    id TEXT PRIMARY KEY,
    planta_id TEXT NOT NULL REFERENCES plantas(id),
    usuario_id TEXT NOT NULL,
    fecha_captura TEXT NOT NULL DEFAULT (datetime('now')),
    foto_local_path TEXT NOT NULL,
    foto_url TEXT,
    clasificacion TEXT DEFAULT 'sin_clasificar',
    confianza_clasificacion REAL,
    clasificado_por TEXT DEFAULT 'manual',
    gps_lat REAL,
    gps_lng REAL,
    notas TEXT,
    synced_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 9. COLA DE SINCRONIZACIÓN
CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tabla TEXT NOT NULL,
    registro_id TEXT NOT NULL,
    operacion TEXT NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    payload TEXT NOT NULL,  -- JSON con los datos
    intentos INTEGER DEFAULT 0,
    ultimo_error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue(intentos);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_tareas_sync ON tareas(synced_at);
CREATE INDEX IF NOT EXISTS idx_plantas_parcela ON plantas(parcela_id);
CREATE INDEX IF NOT EXISTS idx_metricas_planta ON metricas_crecimiento(planta_id);
CREATE INDEX IF NOT EXISTS idx_scouting_planta ON scouting_visual(planta_id);
