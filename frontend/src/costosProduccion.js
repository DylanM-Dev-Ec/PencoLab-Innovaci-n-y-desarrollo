/** Costos de producción sencillos — Agricultor y Empresa (USD). */

export const PRECIO_COMPRA_LITRO_AGRICULTOR = 0.9 // ~doble precio leche referencial (USD/L)
export const LITROS_POR_PLANTA_CICLO = 55
export const PRECIO_VENTA_BOTELLA = 2
export const LITROS_POR_BOTELLA = 1

/** Costos unitarios por defecto — agricultor (por ha, ciclo 12 años prorrateado o fijo) */
export const COSTOS_AGRICULTOR_DEFAULT = {
  hijuelos_usd_ha: 180, // material vegetativo
  mano_obra_siembra_usd_ha: 120,
  zanjas_terrazas_usd_ha: 90,
  mantenimiento_anual_usd_ha: 40, // poda sanitaria, vigilancia (×12)
  cosecha_chawado_usd_ha: 150,
  transporte_campo_usd_ha: 35,
}

/** Costos unitarios por defecto — empresa (por litro procesado) */
export const COSTOS_EMPRESA_DEFAULT = {
  compra_litro_usd: PRECIO_COMPRA_LITRO_AGRICULTOR,
  destilacion_usd_l: 0.25,
  embotellado_usd_l: 0.18,
  logistica_usd_l: 0.12,
  certificacion_usd_l: 0.08,
  admin_usd_l: 0.07,
}

export const INGRESO_INTERCALADO_USD_HA = {
  papa: 1200,
  quinoa: 950,
  chocho: 800,
}

/**
 * @param {number} hectareas
 * @param {number} plantasPorHa
 * @param {object} costos
 * @param {string} intercalado
 */
export function analizarCostoAgricultor(
  hectareas = 3,
  plantasPorHa = 1000,
  costos = COSTOS_AGRICULTOR_DEFAULT,
  intercalado = 'papa'
) {
  const ha = Math.max(0.25, Number(hectareas) || 0)
  const dens = Math.max(1, Number(plantasPorHa) || 1000)
  const plantas = Math.round(ha * dens)

  const establecimiento =
    (Number(costos.hijuelos_usd_ha) || 0) +
    (Number(costos.mano_obra_siembra_usd_ha) || 0) +
    (Number(costos.zanjas_terrazas_usd_ha) || 0)
  const mantenimiento12 = (Number(costos.mantenimiento_anual_usd_ha) || 0) * 12
  const cosecha = Number(costos.cosecha_chawado_usd_ha) || 0
  const transporte = Number(costos.transporte_campo_usd_ha) || 0

  const costoHa = establecimiento + mantenimiento12 + cosecha + transporte
  const costoTotal = costoHa * ha
  const costoPlanta = plantas > 0 ? costoTotal / plantas : 0

  const ingresoPenco = plantas * 160
  const ingresoInter = ha * (INGRESO_INTERCALADO_USD_HA[intercalado] || 900)
  const ingresoTotal = ingresoPenco + ingresoInter
  const margen = ingresoTotal - costoTotal
  const margenPct = ingresoTotal > 0 ? (margen / ingresoTotal) * 100 : 0

  const desglose = [
    { id: 'establecimiento', label: 'Establecimiento (hijuelos + siembra + zanjas)', usd: establecimiento * ha },
    { id: 'mantenimiento', label: 'Mantenimiento 12 años (poda / vigilancia)', usd: mantenimiento12 * ha },
    { id: 'cosecha', label: 'Cosecha / chawado', usd: cosecha * ha },
    { id: 'transporte', label: 'Transporte a acopio', usd: transporte * ha },
  ]

  return {
    rol: 'agricultor',
    hectareas: ha,
    plantas,
    plantas_por_ha: dens,
    costo_total_usd: round2(costoTotal),
    costo_por_ha_usd: round2(costoHa),
    costo_por_planta_usd: round2(costoPlanta),
    ingreso_penco_usd: round2(ingresoPenco),
    ingreso_intercalado_usd: round2(ingresoInter),
    ingreso_total_usd: round2(ingresoTotal),
    margen_usd: round2(margen),
    margen_pct: round2(margenPct),
    desglose: desglose.map((d) => ({ ...d, usd: round2(d.usd) })),
    punto_equilibrio_plantas: costoPlanta > 0 ? Math.ceil(costoTotal / 160) : 0,
  }
}

/**
 * @param {number} litros
 * @param {object} costos
 * @param {number} ingresoCircularUsd
 */
export function analizarCostoEmpresa(
  litros = 5000,
  costos = COSTOS_EMPRESA_DEFAULT,
  ingresoCircularUsd = 0
) {
  const L = Math.max(0, Number(litros) || 0)
  const unit =
    (Number(costos.compra_litro_usd) || 0) +
    (Number(costos.destilacion_usd_l) || 0) +
    (Number(costos.embotellado_usd_l) || 0) +
    (Number(costos.logistica_usd_l) || 0) +
    (Number(costos.certificacion_usd_l) || 0) +
    (Number(costos.admin_usd_l) || 0)

  const costoTotal = unit * L
  const botellas = Math.floor(L / LITROS_POR_BOTELLA)
  const ingresoBotellas = botellas * PRECIO_VENTA_BOTELLA
  const circular = Number(ingresoCircularUsd) || 0
  const ingresoTotal = ingresoBotellas + circular
  const margen = ingresoTotal - costoTotal
  const margenPct = ingresoTotal > 0 ? (margen / ingresoTotal) * 100 : 0
  const margenBotella = botellas > 0 ? margen / botellas : 0

  const desglose = [
    { id: 'compra', label: 'Compra chawarmishky al productor', usd: (Number(costos.compra_litro_usd) || 0) * L },
    { id: 'destilacion', label: 'Destilación', usd: (Number(costos.destilacion_usd_l) || 0) * L },
    { id: 'embotellado', label: 'Embotellado', usd: (Number(costos.embotellado_usd_l) || 0) * L },
    { id: 'logistica', label: 'Logística', usd: (Number(costos.logistica_usd_l) || 0) * L },
    { id: 'certificacion', label: 'Certificación / calidad', usd: (Number(costos.certificacion_usd_l) || 0) * L },
    { id: 'admin', label: 'Administración', usd: (Number(costos.admin_usd_l) || 0) * L },
  ]

  return {
    rol: 'empresa',
    litros: L,
    botellas,
    costo_total_usd: round2(costoTotal),
    costo_por_litro_usd: round2(unit),
    costo_por_botella_usd: round2(unit * LITROS_POR_BOTELLA),
    ingreso_botellas_usd: round2(ingresoBotellas),
    ingreso_circular_usd: round2(circular),
    ingreso_total_usd: round2(ingresoTotal),
    margen_usd: round2(margen),
    margen_pct: round2(margenPct),
    margen_por_botella_usd: round2(margenBotella),
    precio_venta_botella_usd: PRECIO_VENTA_BOTELLA,
    desglose: desglose.map((d) => ({ ...d, usd: round2(d.usd) })),
  }
}

/** Litros estimados desde ha de la red (para empresa). */
export function litrosDesdeHa(hectareas, plantasPorHa = 1000, litrosPorPlanta = LITROS_POR_PLANTA_CICLO) {
  const plantas = Math.round(Number(hectareas) * Number(plantasPorHa))
  return Math.round(plantas * litrosPorPlanta)
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}
