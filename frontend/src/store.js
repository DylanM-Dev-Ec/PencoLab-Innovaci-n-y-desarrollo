const STORAGE_KEY = 'pencolab_offline_v1';
/** Instantánea de campo que la empresa solo lee (no escribe). */
export const CAMPO_SNAPSHOT_KEY = 'pencolab_campo_snapshot_v1';
export const CERT_PENDING_KEY = 'pencolab_cert_pending';
export const PLANES_PENDING_KEY = 'pencolab_planes_accion_v1';

const defaultData = () => ({
  session: {
    access_token: null,
    user_id: null,
    rol: null,
    productor_id: null,
    email: null,
  },
  productor: {
    id: null,
    nombre: '',
    email: '',
    comunidad: 'Pencos del Norte',
  },
  parcelas: [],
  plantas: [],
  mediciones: [],
  bitacora: [],
  residuos: [],
  vivero_semillas: [],
  planes_accion: [],
  lastSync: null,
});

export function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    const defaults = defaultData();
    return {
      ...defaults,
      ...parsed,
      session: { ...defaults.session, ...(parsed.session || {}) },
      productor: { ...defaults.productor, ...(parsed.productor || {}) },
    };
  } catch {
    return defaultData();
  }
}

export function saveStore(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  // Solo el productor publica la instantánea; la empresa nunca la escribe.
  if (data.session?.rol === 'productor') {
    saveCampoSnapshot(data);
  }
}

/** Publica datos del productor para que la empresa los consulte sin poder editarlos. */
export function saveCampoSnapshot(data) {
  const snap = {
    productor: data.productor || null,
    parcelas: data.parcelas || [],
    plantas: data.plantas || [],
    mediciones: data.mediciones || [],
    bitacora: data.bitacora || [],
    residuos: data.residuos || [],
    vivero_semillas: data.vivero_semillas || [],
    planes_accion: data.planes_accion || [],
    lastSync: data.lastSync || null,
    updated_at: new Date().toISOString(),
    source: 'productor',
    read_only: true,
  };
  localStorage.setItem(CAMPO_SNAPSHOT_KEY, JSON.stringify(snap));
}

/** La empresa solo lee esta instantánea. Nunca debe escribirse desde EmpresaApp. */
export function loadCampoSnapshot() {
  try {
    const raw = localStorage.getItem(CAMPO_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function resetStore() {
  const data = defaultData();
  saveStore(data);
  return data;
}

export function applySession(data, auth, extra = {}) {
  return {
    ...data,
    session: {
      access_token: auth.access_token,
      user_id: auth.id,
      rol: auth.rol,
      productor_id: auth.productor_id || null,
      email: auth.email,
    },
    productor: {
      ...data.productor,
      id: auth.productor_id || data.productor.id,
      email: auth.email,
      nombre: extra.nombre || data.productor.nombre || auth.email.split('@')[0],
    },
  };
}

export function clearSession(data) {
  const next = defaultData();
  return {
    ...next,
    parcelas: data.parcelas || [],
    plantas: data.plantas || [],
    mediciones: data.mediciones || [],
    bitacora: data.bitacora || [],
    residuos: data.residuos || [],
    vivero_semillas: data.vivero_semillas || [],
    planes_accion: data.planes_accion || [],
  };
}

export function recomendacionPh(ph) {
  const value = parseFloat(ph);
  if (Number.isNaN(value)) return null;
  if (value < 6) {
    return {
      nivel: 'acido',
      texto:
        'Suelo ácido detectado. Recomendación científica: Aplica cal y composta para neutralizar el pH antes de sembrar',
      titulo: 'Suelo ácido (pH bajo)',
      soluciones: [
        'Aplica cal agrícola (cal dolomítica) y mézclala en los primeros 15–20 cm de suelo.',
        'Incorpora composta madura o estiércol bien descompuesto para estabilizar el pH.',
        'Espera 2–3 semanas y vuelve a medir el pH antes de plantar hijuelos.',
        'No uses fertilizantes amoniacales fuertes mientras el suelo esté muy ácido.',
      ],
      advertencia:
        value < 5.2
          ? 'pH muy bajo: la raíz del penco absorbe mal nutrientes y puede pudrir en lluvias. Corrige antes de sembrar.'
          : 'Conviene corregir el pH hacia 6.0–7.0 para un establecimiento sano.',
    };
  }
  if (value > 8) {
    return {
      nivel: 'alcalino',
      texto: 'Aplicar yeso o azufre de inmediato',
      titulo: 'Suelo alcalino (pH alto)',
      soluciones: [
        'Aplica yeso agrícola o azufre elemental en dosis bajas y repartidas.',
        'Incorpora materia orgánica ácida (composta de hojas, residuos de penco triturados).',
        'Riego comedido: el encharque en suelos alcalinos empeora la absorción de hierro.',
        'Vuelve a medir el pH tras 3–4 semanas; no sobrecargues azufre de una sola vez.',
      ],
      advertencia:
        value > 8.8
          ? 'pH muy alto: riesgo de clorosis y crecimiento lento. No plantes hasta bajar hacia 7.0.'
          : 'Baja el pH gradualmente hasta el rango 6.0–7.0.',
    };
  }
  if (value >= 6 && value <= 7) {
    return {
      nivel: 'optimo',
      texto: 'pH en rango óptimo para Penco/Agave (6.0–7.0)',
      titulo: 'pH óptimo para penco',
      soluciones: [
        'Puedes sembrar con confianza si el drenaje es bueno (franco, arenoso o arcilloso permeable).',
        'Mantén materia orgánica ligera; evita encharcamiento que pudre raíces superficiales.',
        'Registra este pH en el lote para comparar en la próxima temporada.',
      ],
      advertencia: null,
    };
  }
  return {
    nivel: 'atencion',
    texto: 'pH fuera del rango ideal, monitorear',
    titulo: 'pH al límite (vigilar)',
    soluciones: [
      value > 7
        ? 'Estás entre 7 y 8: añade composta y vigila; si sube más, usa yeso o azufre suave.'
        : 'Estás cerca del óptimo: mantén humedad sin encharcar y mide de nuevo en 2 semanas.',
      'No apliques correctores fuertes de golpe: el penco prefiere cambios graduales.',
      'Prefiere suelos permeables; si hay charcos, abre zanjas de drenaje.',
    ],
    advertencia: 'No está en el rango ideal 6.0–7.0. Siembra con precaución o corrige primero.',
  };
}

/** Tipos de planta / esquema de plantación para la calculadora Tierra */
export const TIPOS_PLANTA = [
  {
    id: 'penco_andino',
    label: 'Penco andino',
    especie: 'Agave americana',
    icon: 'penco',
    entre_plantas_m: 1.5,
    entre_surcos_m: 3.0,
    tip: 'Estándar Ecuador: buen equilibrio producción y manejo en laderas.',
    uso: 'Chawarmishky, fibra y carbono',
  },
  {
    id: 'penco_denso',
    label: 'Penco denso',
    especie: 'Agave americana',
    icon: 'penco',
    entre_plantas_m: 1.0,
    entre_surcos_m: 3.0,
    tip: 'Más plantas/ha en terrazas anti-erosión. Requiere más hijuelos y mano de obra.',
    uso: 'Reforestación de laderas',
  },
  {
    id: 'intercalado_papa',
    label: 'Penco + papa',
    especie: 'Agave + Solanum',
    icon: 'papa',
    entre_plantas_m: 1.5,
    entre_surcos_m: 3.0,
    tip: 'Calles entre surcos para papa el primer año. No aprietes el penco: la papa usa el espacio libre.',
    uso: 'Ingreso temprano + penco',
  },
  {
    id: 'vivero_semilla',
    label: 'Vivero semilla',
    especie: 'Agave americana (semilla)',
    icon: 'semilla',
    entre_plantas_m: 0.25,
    entre_surcos_m: 0.3,
    tip: 'Almácigo denso. Germinación ~5%: siembra muchas más de las que necesitas y controla humedad diario.',
    uso: 'Propagación en vivero',
    vivero: true,
  },
];

export function tipoPlantaById(id) {
  return TIPOS_PLANTA.find((t) => t.id === id) || TIPOS_PLANTA[0];
}

export function hijueloApto(peso, roseta, edadMadre) {
  if (!edadMadre) return null;
  const edad = parseFloat(edadMadre);
  if (edad < 3 || edad > 5) return false;
  const pesoOk = peso && parseFloat(peso) >= 1.5 && parseFloat(peso) <= 3;
  const rosetaOk = roseta && parseFloat(roseta) >= 8 && parseFloat(roseta) <= 11;
  return Boolean(pesoOk && rosetaOk);
}

/** Densidad Ecuador: surco fijo 3 m; planta entre 1.0 y 1.5 m → 3 333–2 222 plantas/ha. */
export const ESPACIO_PLANTA_MIN_M = 1.0;
export const ESPACIO_PLANTA_MAX_M = 1.5;
export const ESPACIO_PLANTA_M = 1.5; // estándar recomendado
export const ESPACIO_SURCO_M = 3.0;
export const PLANTAS_POR_HA_MIN = Math.floor(10000 / (ESPACIO_PLANTA_MAX_M * ESPACIO_SURCO_M)); // 2222
export const PLANTAS_POR_HA_MAX = Math.floor(10000 / (ESPACIO_PLANTA_MIN_M * ESPACIO_SURCO_M)); // 3333
export const PLANTAS_POR_HA = PLANTAS_POR_HA_MIN;

export const DENSIDAD_ECUADOR = {
  id: 'ecuador',
  label: 'Estándar Ecuador',
  entre_plantas_m: ESPACIO_PLANTA_M,
  entre_plantas_min_m: ESPACIO_PLANTA_MIN_M,
  entre_plantas_max_m: ESPACIO_PLANTA_MAX_M,
  entre_surcos_m: ESPACIO_SURCO_M,
  plantas_por_ha: PLANTAS_POR_HA,
  plantas_por_ha_min: PLANTAS_POR_HA_MIN,
  plantas_por_ha_max: PLANTAS_POR_HA_MAX,
  descripcion: '1.0–1.5 m entre plantas × 3 m entre surcos (2 222–3 333 plantas/ha)',
};

/** @deprecated usar DENSIDAD_ECUADOR */
export const DENSIDADES_PENCO = {
  ecuador: DENSIDAD_ECUADOR,
};

/**
 * Densidad según separación entre plantas (surco siempre 3 m).
 * @param {number|string} entrePlantasM 1.0–1.5
 */
export function densidadPorSeparacion(entrePlantasM = ESPACIO_PLANTA_M) {
  const planta = Math.min(
    ESPACIO_PLANTA_MAX_M,
    Math.max(ESPACIO_PLANTA_MIN_M, parseFloat(entrePlantasM) || ESPACIO_PLANTA_M)
  );
  const plantasHa = Math.floor(10000 / (planta * ESPACIO_SURCO_M));
  return {
    entre_plantas_m: planta,
    entre_surcos_m: ESPACIO_SURCO_M,
    plantas_por_ha: plantasHa,
  };
}

/** Litros de chaguarmishky estimados por planta en un ciclo de chawada. */
const LITROS_POR_PLANTA_CICLO = { min: 35, mid: 55, max: 80 };
/** Fracción útil de la parcela (caminos, bordes, pendientes). */
const FRACCION_UTIL = 0.9;
/** Tamaño sugerido de cuartel de manejo (ha). */
const CUARTEL_HA = 0.5;

/**
 * Calcula pencos, división del terreno y rendimiento a partir del área.
 * @param {number|string} hectareas
 * @param {{ entre_plantas_m?: number, entre_surcos_m?: number, id?: string, label?: string, vivero?: boolean }|string} [opts]
 */
export function calcularPlanSiembra(hectareas, opts = {}) {
  const ha = parseFloat(hectareas);
  if (!ha || ha <= 0 || Number.isNaN(ha)) return null;

  const conf =
    typeof opts === 'string'
      ? DENSIDAD_ECUADOR
      : {
          entre_plantas_m: opts.entre_plantas_m || DENSIDAD_ECUADOR.entre_plantas_m,
          entre_surcos_m: opts.entre_surcos_m || DENSIDAD_ECUADOR.entre_surcos_m,
          id: opts.id || 'custom',
          label: opts.label || 'Personalizado',
          vivero: Boolean(opts.vivero),
        };

  const dens = {
    id: conf.id,
    label: conf.label,
    entre_plantas_m: conf.entre_plantas_m,
    entre_surcos_m: conf.entre_surcos_m,
    plantas_por_ha: Math.floor(10000 / (conf.entre_plantas_m * conf.entre_surcos_m)),
  };

  const areaUtilHa = ha * FRACCION_UTIL;
  const areaUtilM2 = areaUtilHa * 10000;
  const pencos = Math.floor(areaUtilM2 / (dens.entre_plantas_m * dens.entre_surcos_m));

  const ladoM = Math.sqrt(ha * 10000);
  const surcos = Math.max(1, Math.floor(ladoM / dens.entre_surcos_m));
  const plantasPorSurco = Math.max(1, Math.floor(ladoM / dens.entre_plantas_m));
  const cuarteles = Math.max(1, Math.ceil(ha / CUARTEL_HA));
  const pencosPorCuartel = Math.floor(pencos / cuarteles);

  const litrosMin = conf.vivero ? 0 : pencos * LITROS_POR_PLANTA_CICLO.min;
  const litrosMid = conf.vivero ? 0 : pencos * LITROS_POR_PLANTA_CICLO.mid;
  const litrosMax = conf.vivero ? 0 : pencos * LITROS_POR_PLANTA_CICLO.max;
  const carbonoPorPlanta = conf.vivero ? 0.05 : (48 * 0.05 + 24 * 0.12) * 0.47;
  const carbonoTotalKg = pencos * carbonoPorPlanta;
  const co2TotalKg = carbonoTotalKg * 3.67;

  // Vista previa del mapa: repite plantas según surcos × plantas/surco (tope visual)
  const previewCols = Math.min(conf.vivero ? 12 : 10, Math.max(3, plantasPorSurco));
  const previewRows = Math.min(conf.vivero ? 8 : 6, Math.max(2, surcos));

  return {
    hectareas: ha,
    area_util_ha: Number(areaUtilHa.toFixed(3)),
    fraccion_util: FRACCION_UTIL,
    densidad: dens,
    pencos_totales: pencos,
    pencos_por_ha: dens.plantas_por_ha,
    surcos,
    plantas_por_surco: plantasPorSurco,
    cuarteles,
    pencos_por_cuartel: pencosPorCuartel,
    cuartel_ha: CUARTEL_HA,
    preview_cols: previewCols,
    preview_rows: previewRows,
    vivero: conf.vivero,
    espaciamiento: `${dens.entre_plantas_m} m entre plantas × ${dens.entre_surcos_m} m entre surcos`,
    rendimiento: {
      litros_chaguarmishky_min: litrosMin,
      litros_chaguarmishky_mid: litrosMid,
      litros_chaguarmishky_max: litrosMax,
      litros_por_planta_ciclo: LITROS_POR_PLANTA_CICLO,
      carbono_estimado_kg: Number(carbonoTotalKg.toFixed(1)),
      co2_equivalente_kg: Number(co2TotalKg.toFixed(1)),
      co2_por_ha_kg: Number((co2TotalKg / ha).toFixed(1)),
    },
    division: {
      resumen: `${cuarteles} cuartel(es) de ~${CUARTEL_HA} ha para manejo`,
      layout: `${surcos} surcos × ~${plantasPorSurco} plantas/surco (parcela ~${ladoM.toFixed(0)}×${ladoM.toFixed(0)} m)`,
      consejo:
        conf.vivero
          ? 'En vivero controla humedad a diario. Trasplanta solo plantines firmes; el resto a compost.'
          : cuarteles > 1
            ? `Divide la finca en ${cuarteles} bloques y siembra de forma escalonada para no chawar todo el lote el mismo año.`
            : 'Con menos de 0.5 ha puedes manejar un solo bloque; deja calles de acceso cada 8–10 surcos (cada surco a 3 m).',
    },
  };
}

/** Modelo alométrico in situ (mismo del backend). */
export function calcularCarbonoInSitu(altura, numeroHojas) {
  const h = parseFloat(altura);
  const n = parseInt(numeroHojas, 10);
  const biomasa = h * 0.05 + n * 0.12;
  const carbono = biomasa * 0.47;
  const co2 = carbono * 3.67;
  return {
    biomasa_kg: biomasa.toFixed(3),
    carbono_acumulado_kg: carbono.toFixed(3),
    co2_equivalente_kg: co2.toFixed(3),
  };
}

export function estimarCarbono(altura, diametro, edadMeses = 12) {
  const h = parseFloat(altura);
  const d = parseFloat(diametro);
  const radio = d / 2;
  const volumen = Math.PI * radio * radio * h;
  const factor = 0.00035 + edadMeses * 0.00001;
  const biomasa = volumen * factor;
  const carbono = biomasa * 0.47;
  const co2 = carbono * 3.67;
  return {
    biomasa_kg: biomasa.toFixed(3),
    carbono_acumulado_kg: carbono.toFixed(3),
    co2_equivalente_kg: co2.toFixed(3),
  };
}

export function ownScope(data) {
  const pid = data.session?.productor_id;
  if (!pid) {
    return { parcelas: [], plantas: [], mediciones: [], bitacora: [] };
  }
  const parcelas = (data.parcelas || []).filter((p) => p.productor_id === pid);
  const parcelaIds = new Set(parcelas.map((p) => p.id));
  const plantas = (data.plantas || []).filter((p) => parcelaIds.has(p.parcela_id));
  const plantaIds = new Set(plantas.map((p) => p.id));
  const mediciones = (data.mediciones || []).filter((m) => plantaIds.has(m.planta_id));
  const bitacora = (data.bitacora || []).filter((b) => b.productor_id === pid);
  return { parcelas, plantas, mediciones, bitacora };
}

export const USD_PENCO_POR_PLANTA = 160;
export const USD_EUCALIPTO_POR_ARBOL = 20;
export const DENSIDAD_EUCALIPTO_HA = 1100;
/** Split del presupuesto de referencia $2000: 40% fertilizante fase 1, 60% intercalado. */
export const FRACCION_FERTILIZANTE = 0.4;
export const FRACCION_INTERCALADO = 0.6;

/**
 * Simulación agricultor: hectáreas + presupuesto → ROI penco vs eucalipto y plan de inversión.
 */
export function calcularSimulacionAgricola(hectareas, presupuesto) {
  const ha = parseFloat(hectareas);
  const budget = parseFloat(presupuesto);
  if (!ha || ha <= 0 || Number.isNaN(ha) || !budget || budget <= 0 || Number.isNaN(budget)) return null;

  const plan = calcularPlanSiembra(ha);
  if (!plan) return null;
  const pencos = plan.pencos_totales;
  const eucArboles = Math.floor(DENSIDAD_EUCALIPTO_HA * ha);
  const ingresoPenco = pencos * USD_PENCO_POR_PLANTA;
  const ingresoEuc = eucArboles * USD_EUCALIPTO_POR_ARBOL;

  const fert = Math.round(budget * FRACCION_FERTILIZANTE);
  const intercalado = Math.round(budget * FRACCION_INTERCALADO);
  // Calles de 3 m: ~2/3 del área útil para papa/quinoa de ciclo corto
  const haCalles = Number((plan.area_util_ha * (2 / 3)).toFixed(2));
  // Ingreso 6 meses: retorno ~1.6× del capital intercalado, más $450/ha de calle
  const ingresoCortoPlazo = Math.round(intercalado * 1.6 + haCalles * 450);
  const aniosSinFert = 12;
  const aniosConFert = 8;

  return {
    hectareas: ha,
    presupuesto: budget,
    pencos,
    euc_arboles: eucArboles,
    usd_penco_planta: USD_PENCO_POR_PLANTA,
    usd_euc_arbol: USD_EUCALIPTO_POR_ARBOL,
    ingreso_penco_lp: ingresoPenco,
    ingreso_euc_lp: ingresoEuc,
    multiplicador_vs_euc: Number((ingresoPenco / Math.max(ingresoEuc, 1)).toFixed(1)),
    plan_inversion: {
      fertilizante_fase1: fert,
      fertilizante_detalle: 'Fósforo y calcio — acorta el ciclo de crecimiento',
      intercalado: intercalado,
      intercalado_detalle: 'Quinoa o papas en las calles de 3 m — ingreso a 6 meses',
      ha_calles: haCalles,
      anios_sin_fert: aniosSinFert,
      anios_con_fert: aniosConFert,
    },
    ingreso_corto_plazo: ingresoCortoPlazo,
    riqueza_ecologica_lp: ingresoPenco,
    comparativo_barras: [
      { nombre: 'Penco', usd: ingresoPenco },
      { nombre: 'Eucalipto', usd: ingresoEuc },
    ],
    horizonte_barras: [
      { horizonte: 'Corto plazo (6 meses)', usd: ingresoCortoPlazo, tipo: 'rapido' },
      { horizonte: 'Largo plazo (penco certificado)', usd: ingresoPenco, tipo: 'ecologico' },
    ],
  };
}

export function getGps() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: null, lng: null, precision: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
          precision: pos.coords.accuracy?.toFixed(1),
        }),
      () => resolve({ lat: null, lng: null, precision: null }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}
