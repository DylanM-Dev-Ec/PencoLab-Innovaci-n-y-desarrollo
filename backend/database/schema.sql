-- ============================================================
-- PencoLab - Esquema de Base de Datos (PostgreSQL)
-- App de Cultivo de Penco / Agave
-- ============================================================

-- Extensión para UUIDs y geolocalización
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
-- 1. USUARIOS Y AUTENTICACIÓN
-- ============================================================
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('productor', 'empresa')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE productores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id INTEGER UNIQUE REFERENCES usuarios(id) ON DELETE SET NULL,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    comunidad VARCHAR(120),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);


-- ============================================================
-- 2. PARCELAS (Georreferenciadas)
-- ============================================================
CREATE TABLE parcelas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    productor_id UUID NOT NULL REFERENCES productores(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    ubicacion_lat DECIMAL(10, 8),
    ubicacion_lng DECIMAL(11, 8),
    area_hectareas DECIMAL(8, 4),
    altitud_msnm DECIMAL(6, 1),
    geom GEOMETRY(Point, 4326),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_parcelas_productor ON parcelas(productor_id);
CREATE INDEX idx_parcelas_geom ON parcelas USING GIST(geom);

-- ============================================================
-- 3. ANÁLISIS DE SUELO
-- ============================================================
CREATE TABLE analisis_suelo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcela_id UUID NOT NULL REFERENCES parcelas(id) ON DELETE CASCADE,
    fecha_analisis DATE NOT NULL DEFAULT CURRENT_DATE,
    ph DECIMAL(3, 1) NOT NULL CHECK (ph >= 0 AND ph <= 14),
    tipo_suelo VARCHAR(30) NOT NULL
        CHECK (tipo_suelo IN ('franco', 'arenoso', 'arcilloso', 'limoso', 'franco-arenoso', 'franco-arcilloso', 'otro')),
    permeabilidad VARCHAR(15) DEFAULT 'media'
        CHECK (permeabilidad IN ('alta', 'media', 'baja')),
    materia_organica DECIMAL(4, 2),
    nitrogeno DECIMAL(5, 2),
    fosforo DECIMAL(5, 2),
    potasio DECIMAL(5, 2),
    -- Recomendación automática según reglas de negocio
    recomendacion_ph TEXT GENERATED ALWAYS AS (
        CASE
            WHEN ph < 6.0 THEN 'Aplicar cal y composta para elevar el pH al rango óptimo (6.0-7.0)'
            WHEN ph > 8.0 THEN 'Aplicar yeso o azufre para reducir el pH al rango óptimo (6.0-7.0)'
            WHEN ph BETWEEN 6.0 AND 7.0 THEN 'pH en rango óptimo para Penco/Agave'
            ELSE 'pH fuera del rango ideal, monitorear'
        END
    ) STORED,
    notas TEXT,
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_suelo_parcela ON analisis_suelo(parcela_id);

-- ============================================================
-- 4. PLANTAS (Hijuelos / Pencos)
-- ============================================================
CREATE TABLE plantas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcela_id UUID NOT NULL REFERENCES parcelas(id) ON DELETE CASCADE,
    codigo VARCHAR(50) UNIQUE,
    ubicacion_lat DECIMAL(10, 8),
    ubicacion_lng DECIMAL(11, 8),
    fecha_siembra DATE NOT NULL,

    -- Datos del hijuelo (Regla 2: Propagación)
    edad_planta_madre_anios DECIMAL(3, 1)
        CHECK (edad_planta_madre_anios >= 0),
    peso_hijuelo_kg DECIMAL(4, 2)
        CHECK (peso_hijuelo_kg >= 0),
    tamano_roseta_inicial_cm DECIMAL(5, 2),
    dias_cicatrizacion INT DEFAULT 10,
    tratamiento_sanitario BOOLEAN DEFAULT FALSE,
    fecha_corte_rizoma DATE,
    metodo_desinfeccion VARCHAR(50) DEFAULT 'fuego',

    -- Validaciones de reglas de negocio
    hijuelo_apto BOOLEAN GENERATED ALWAYS AS (
        (peso_hijuelo_kg BETWEEN 1.5 AND 3.0 OR tamano_roseta_inicial_cm BETWEEN 8 AND 11)
        AND edad_planta_madre_anios BETWEEN 3 AND 5
    ) STORED,

    estado VARCHAR(20) DEFAULT 'activa'
        CHECK (estado IN ('activa', 'cosechada', 'muerta', 'enferma')),
    notas TEXT,
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_plantas_parcela ON plantas(parcela_id);

-- ============================================================
-- 5. MÉTRICAS DE CRECIMIENTO
-- ============================================================
CREATE TABLE metricas_crecimiento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    planta_id UUID NOT NULL REFERENCES plantas(id) ON DELETE CASCADE,
    fecha_medicion DATE NOT NULL DEFAULT CURRENT_DATE,
    altura_roseta_cm DECIMAL(6, 2) NOT NULL,
    diametro_roseta_cm DECIMAL(6, 2) NOT NULL,
    numero_hojas INT NOT NULL CHECK (numero_hojas >= 0),
    estado_general VARCHAR(20) DEFAULT 'sana'
        CHECK (estado_general IN ('sana', 'estresada', 'enferma', 'recuperandose')),
    notas TEXT,
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_metricas_planta ON metricas_crecimiento(planta_id);
CREATE INDEX idx_metricas_fecha ON metricas_crecimiento(fecha_medicion);

-- ============================================================
-- 6. ESTIMACIÓN DE CARBONO
-- ============================================================
CREATE TABLE estimaciones_carbono (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    planta_id UUID NOT NULL REFERENCES plantas(id) ON DELETE CASCADE,
    metrica_id UUID REFERENCES metricas_crecimiento(id),
    fecha_estimacion DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo VARCHAR(20) NOT NULL
        CHECK (tipo IN ('estimado', 'verificado_in_situ')),
    -- Biomasa y carbono calculados
    biomasa_kg DECIMAL(8, 3),
    carbono_acumulado_kg DECIMAL(8, 3),
    co2_equivalente_kg DECIMAL(8, 3),
    -- Parámetros usados en el cálculo
    algoritmo_version VARCHAR(20) DEFAULT 'v1.0',
    edad_planta_meses INT,
    altura_cm DECIMAL(6, 2),
    diametro_cm DECIMAL(6, 2),
    metodologia TEXT,
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_carbono_planta ON estimaciones_carbono(planta_id);

-- ============================================================
-- 7. TAREAS DIARIAS (Riego, Podas, Fitosanitarios)
-- ============================================================
CREATE TABLE tareas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcela_id UUID NOT NULL REFERENCES parcelas(id) ON DELETE CASCADE,
    planta_id UUID REFERENCES plantas(id),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    tipo VARCHAR(30) NOT NULL
        CHECK (tipo IN ('riego', 'poda_sanitaria', 'fitosanitario', 'fertilizacion', 'siembra', 'cosecha', 'monitoreo', 'otro')),
    fecha_programada DATE NOT NULL,
    fecha_ejecucion TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'en_progreso', 'completada', 'cancelada')),

    -- Datos de GPS al registrar la tarea
    gps_lat DECIMAL(10, 8),
    gps_lng DECIMAL(11, 8),
    gps_precision_m DECIMAL(6, 2),

    -- Datos específicos según tipo de tarea
    datos JSONB DEFAULT '{}',
    /*
      Ejemplos de datos JSONB:
      Riego:         {"metodo": "goteo", "litros": 50, "estacion": "invierno"}
      Poda:          {"hojas_removidas": 3, "motivo": "secas"}
      Fitosanitario: {"producto": "fungicida X", "dosis_ml": 200, "plaga": "cochinilla"}
    */

    notas TEXT,
    synced_at TIMESTAMP,  -- NULL = no sincronizada, se sincroniza al recuperar internet
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tareas_parcela ON tareas(parcela_id);
CREATE INDEX idx_tareas_usuario ON tareas(usuario_id);
CREATE INDEX idx_tareas_fecha ON tareas(fecha_programada);
CREATE INDEX idx_tareas_sync ON tareas(synced_at) WHERE synced_at IS NULL;

-- ============================================================
-- 8. REGLAS DE RIEGO POR ESTACIÓN
-- ============================================================
CREATE TABLE reglas_riego (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estacion VARCHAR(15) NOT NULL UNIQUE
        CHECK (estacion IN ('invierno', 'primavera', 'verano', 'otono')),
    descripcion TEXT NOT NULL,
    frecuencia_dias INT,
    nivel_humedad_min DECIMAL(4, 2),
    nivel_humedad_max DECIMAL(4, 2),
    alerta_exceso BOOLEAN DEFAULT TRUE
);

INSERT INTO reglas_riego (estacion, descripcion, frecuencia_dias, nivel_humedad_min, nivel_humedad_max) VALUES
('invierno', 'Riego racionado al mínimo. Mantener húmedo, no mojado.', 14, 20.00, 40.00),
('primavera', 'Riego según demanda del suelo. Humedecer sin encharcar.', 7, 30.00, 55.00),
('verano', 'Reducción paulatina. No regar en época lluviosa extrema.', 10, 25.00, 45.00),
('otono', 'Riego moderado de transición.', 10, 25.00, 50.00);

-- ============================================================
-- 9. SCOUTING VISUAL (Fotos de enfermedades)
-- ============================================================
CREATE TABLE scouting_visual (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    planta_id UUID NOT NULL REFERENCES plantas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    fecha_captura TIMESTAMP NOT NULL DEFAULT NOW(),
    foto_url TEXT NOT NULL,
    foto_local_path TEXT,

    -- Clasificación de enfermedad
    clasificacion VARCHAR(50)
        CHECK (clasificacion IN (
            'sana', 'cochinilla', 'picudo_agave',
            'pudricion_erwinia', 'hongo', 'estres_hidrico',
            'deficiencia_nutricional', 'otro', 'sin_clasificar'
        )),
    confianza_clasificacion DECIMAL(4, 2) CHECK (confianza_clasificacion BETWEEN 0 AND 1),
    clasificado_por VARCHAR(10) DEFAULT 'manual'
        CHECK (clasificado_por IN ('manual', 'modelo_ia')),

    gps_lat DECIMAL(10, 8),
    gps_lng DECIMAL(11, 8),
    notas TEXT,
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scouting_planta ON scouting_visual(planta_id);
CREATE INDEX idx_scouting_clasificacion ON scouting_visual(clasificacion);

-- ============================================================
-- 10. VISTA: Resumen de Parcela con Carbono
-- ============================================================
CREATE VIEW vista_resumen_parcela AS
SELECT
    p.id AS parcela_id,
    p.nombre AS parcela_nombre,
    p.area_hectareas,
    COUNT(DISTINCT pl.id) AS total_plantas,
    COUNT(DISTINCT pl.id) FILTER (WHERE pl.estado = 'activa') AS plantas_activas,
    ROUND(AVG(mc.altura_roseta_cm), 2) AS altura_promedio_cm,
    ROUND(AVG(mc.diametro_roseta_cm), 2) AS diametro_promedio_cm,
    ROUND(SUM(ec.carbono_acumulado_kg), 2) AS carbono_total_estimado_kg,
    ROUND(SUM(ec.co2_equivalente_kg), 2) AS co2_equivalente_total_kg,
    MAX(as2.ph) AS ultimo_ph,
    MAX(as2.recomendacion_ph) AS recomendacion_ph
FROM parcelas p
LEFT JOIN plantas pl ON pl.parcela_id = p.id
LEFT JOIN metricas_crecimiento mc ON mc.planta_id = pl.id
    AND mc.fecha_medicion = (
        SELECT MAX(fecha_medicion) FROM metricas_crecimiento WHERE planta_id = pl.id
    )
LEFT JOIN estimaciones_carbono ec ON ec.planta_id = pl.id AND ec.tipo = 'estimado'
LEFT JOIN analisis_suelo as2 ON as2.parcela_id = p.id
    AND as2.fecha_analisis = (
        SELECT MAX(fecha_analisis) FROM analisis_suelo WHERE parcela_id = p.id
    )
GROUP BY p.id, p.nombre, p.area_hectareas;

-- ============================================================
-- 11. CERTIFICACIÓN DE LOTE (Método Mexicano)
-- parcela_id UUID para alinearse con el esquema actual de parcelas
-- puntuacion_calidad: 0.00–1.00 (>0.90 = pago preferencial)
-- ============================================================
CREATE TABLE IF NOT EXISTS certificacion_lote (
    id SERIAL PRIMARY KEY,
    parcela_id UUID NOT NULL REFERENCES parcelas(id) ON DELETE CASCADE,
    hijuelos_seleccionados_ok BOOLEAN NOT NULL DEFAULT FALSE,
    herramientas_desinfectadas BOOLEAN NOT NULL DEFAULT FALSE,
    cicatrizacion_sol_completa BOOLEAN NOT NULL DEFAULT FALSE,
    trazo_tres_metros_ok BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_certificacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    puntuacion_calidad NUMERIC(3, 2) NOT NULL DEFAULT 0.00
        CHECK (puntuacion_calidad >= 0 AND puntuacion_calidad <= 1),
    apto_pago_preferencial BOOLEAN NOT NULL DEFAULT FALSE,
    estado VARCHAR(120) NOT NULL DEFAULT 'no_apto',
    notas TEXT
);

CREATE INDEX IF NOT EXISTS ix_certificacion_lote_parcela_id ON certificacion_lote(parcela_id);

-- ============================================================
-- 12. AGAVE ANDINO — Economía circular, vivero y recolección
-- (.cursorrules: NUEVAS REGLAS OPERATIVAS Y COMERCIALES)
-- ============================================================

-- Extender parcelas (topografía anti-erosión + meta 20 ha)
ALTER TABLE parcelas
    ADD COLUMN IF NOT EXISTS tipo_trazado VARCHAR(20)
        CHECK (tipo_trazado IS NULL OR tipo_trazado IN ('laderas', 'zanjas', 'plano')),
    ADD COLUMN IF NOT EXISTS metas_expansion_ha NUMERIC(8, 2) NOT NULL DEFAULT 20.0;

-- Propagación mixta en plantas
ALTER TABLE plantas
    ADD COLUMN IF NOT EXISTS tipo_propagacion VARCHAR(20) NOT NULL DEFAULT 'hijuelo'
        CHECK (tipo_propagacion IN ('hijuelo', 'semilla'));

-- Vivero de semillas (germinación teórica ~5%)
CREATE TABLE IF NOT EXISTS vivero_semillas (
    id SERIAL PRIMARY KEY,
    lote_semillas VARCHAR(120) NOT NULL,
    fecha_siembra DATE NOT NULL,
    cantidad_sembradas INT NOT NULL DEFAULT 0 CHECK (cantidad_sembradas >= 0),
    cantidad_germinadas INT NOT NULL DEFAULT 0 CHECK (cantidad_germinadas >= 0),
    tasa_germinacion_real NUMERIC(6, 2)
        CHECK (tasa_germinacion_real IS NULL OR (tasa_germinacion_real >= 0 AND tasa_germinacion_real <= 100)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_vivero_semillas_lote ON vivero_semillas(lote_semillas);

-- Recolección femenina de chawarmishky (Pacto de Verano)
CREATE TABLE IF NOT EXISTS recoleccion_jornada (
    id SERIAL PRIMARY KEY,
    recolectora_nombre VARCHAR(120) NOT NULL,
    fecha_recoleccion DATE NOT NULL,
    litros_extraidos NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (litros_extraidos >= 0),
    temperatura_clima NUMERIC(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_recoleccion_jornada_nombre ON recoleccion_jornada(recolectora_nombre);
CREATE INDEX IF NOT EXISTS ix_recoleccion_jornada_fecha ON recoleccion_jornada(fecha_recoleccion);

-- Inventario de residuos (economía circular / valor agregado)
CREATE TABLE IF NOT EXISTS inventario_residuos (
    id SERIAL PRIMARY KEY,
    planta_id UUID NOT NULL REFERENCES plantas(id) ON DELETE CASCADE,
    tipo_residuo VARCHAR(40) NOT NULL
        CHECK (tipo_residuo IN ('fibra_cabuya', 'flores_kirillas', 'chawarquero_madera', 'hoja_para_abono')),
    cantidad_kg NUMERIC(10, 3) NOT NULL DEFAULT 0 CHECK (cantidad_kg >= 0),
    destino_producto VARCHAR(40) NOT NULL
        CHECK (destino_producto IN ('canastas', 'alpargatas', 'encurtidos', 'abono_compost', 'construccion_vigas')),
    ingreso_adicional_usd NUMERIC(12, 2)
        CHECK (ingreso_adicional_usd IS NULL OR ingreso_adicional_usd >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_inventario_residuos_planta_id ON inventario_residuos(planta_id);

-- Producción mensual / destilación ($2.00 USD por litro embotellado)
CREATE TABLE IF NOT EXISTS produccion_mensual (
    id SERIAL PRIMARY KEY,
    productor_id UUID REFERENCES productores(id) ON DELETE SET NULL,
    anio INT NOT NULL CHECK (anio >= 2000),
    mes INT NOT NULL CHECK (mes >= 1 AND mes <= 12),
    litros_destilados NUMERIC(12, 2)
        CHECK (litros_destilados IS NULL OR litros_destilados >= 0),
    botellas_producidas_2usd INT
        CHECK (botellas_producidas_2usd IS NULL OR botellas_producidas_2usd >= 0),
    ingreso_ventas_usd NUMERIC(14, 2)
        CHECK (ingreso_ventas_usd IS NULL OR ingreso_ventas_usd >= 0),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_produccion_mensual_productor_id ON produccion_mensual(productor_id);
CREATE INDEX IF NOT EXISTS ix_produccion_mensual_periodo ON produccion_mensual(anio, mes);
