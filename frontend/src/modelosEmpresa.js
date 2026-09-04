/**
 * Modelos matemáticos B2B — Pencos del Norte / Agave Andino.
 * Funciones puras para la pestaña Modelos de la consola empresarial.
 */
import {
  HA_ACTUALES,
  HA_META,
  LITROS_DIA_POR_PLANTA,
  META_CO2_TON,
  MUJERES_RECOLECTORAS,
  PRECIO_BOTELLA_USD,
} from './agaveAndino'

/** Densidad alta (1.5 m × 3 m) usada en proyecciones corporativas */
export const DENSIDAD_ALTA_HA = 2222
/** Densidad de referencia baja */
export const DENSIDAD_BAJA_HA = 1000
export const USD_POR_PLANTA_MADUREZ = 160
export const USD_INTERCALADO_HA_6M = 1200
/** t CO₂e / ha de referencia comunitaria (alineado con Plan productor) */
export const CO2_TON_POR_HA = 5
export const EFICIENCIA_DESTILACION_DEFAULT = 0.55
export const DIAS_TEMPORADA_DEFAULT = 60
/** Plantas maduras en producción (año 12 del pitch Resumen) — misma fórmula que Modelos → Cosecha */
export const PLANTAS_COSECHA_PITCH_ANO12 = 1800
/** Mortalidad de referencia compartida Resumen / Modelos */
export const MORTALIDAD_REF_PCT = 12

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const NOMBRES_RECOLECTORAS = ['maria', 'rosa', 'ana']

/** Ha del snapshot de campo (o HA_ACTUALES si vacío). */
export function haFromCampo(campo) {
  const ha = (campo?.parcelas || []).reduce((s, p) => s + (Number(p.area_hectareas) || 0), 0)
  return ha > 0 ? Math.round(ha * 10) / 10 : HA_ACTUALES
}

/** Plantas vivas del snapshot; si no hay, proxy densidad alta × supervivencia 88%. */
export function plantasFromCampo(campo) {
  const plantas = campo?.plantas || []
  const vivas = plantas.filter((p) => (p.estado || 'viva') !== 'muerta')
  if (vivas.length > 0) return vivas.length
  if (plantas.length > 0) return plantas.length
  return Math.round(haFromCampo(campo) * DENSIDAD_ALTA_HA * 0.88)
}

/**
 * Serie diaria de recolección repartida entre recolectoras (Resumen / género).
 * Misma base que calcularCosechaVerano.serieDiariaDemo.
 */
export function serieRecoleccionDiaria(cosecha) {
  const n = Math.max(1, cosecha.recolectoras || MUJERES_RECOLECTORAS)
  const keys = NOMBRES_RECOLECTORAS.slice(0, Math.min(3, n))
  while (keys.length < Math.min(3, n)) keys.push(`r${keys.length + 1}`)

  return (cosecha.serieDiariaDemo || []).slice(0, 6).map((d, i) => {
    const shares = keys.map((_, ki) => 0.28 + ((i + ki) % 3) * 0.04)
    const sum = shares.reduce((a, b) => a + b, 0)
    const row = { dia: d.dia, litros: d.litros, botellas: d.botellas, ventas: d.ventas }
    keys.forEach((k, ki) => {
      row[k] = Math.round((d.litros * shares[ki]) / sum)
    })
    return row
  })
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

/**
 * Cosecha de verano + destilación.
 * Fórmula base: plantas × L/día × días × eficiencia → botellas × precio.
 */
export function calcularCosechaVerano({
  plantasVivas = 3000,
  diasTemporada = DIAS_TEMPORADA_DEFAULT,
  litrosDiaPlanta = LITROS_DIA_POR_PLANTA,
  eficienciaDestilacion = EFICIENCIA_DESTILACION_DEFAULT,
  precioBotella = PRECIO_BOTELLA_USD,
  recolectoras = MUJERES_RECOLECTORAS,
} = {}) {
  const plantas = Math.max(0, Math.round(Number(plantasVivas) || 0))
  const dias = Math.max(1, Math.round(Number(diasTemporada) || DIAS_TEMPORADA_DEFAULT))
  const lDia = Math.max(0, Number(litrosDiaPlanta) || 0)
  const eff = Math.min(1, Math.max(0, Number(eficienciaDestilacion) || 0))
  const precio = Math.max(0, Number(precioBotella) || 0)
  const nRec = Math.max(1, Math.round(Number(recolectoras) || 1))

  const litrosTotales = plantas * lDia * dias
  const litrosDestilados = litrosTotales * eff
  const botellas = Math.floor(litrosDestilados)
  const usd = round2(botellas * precio)
  const litrosPorRecolectoraDia = round2(litrosTotales / dias / nRec)

  const semanas = Math.max(1, Math.ceil(dias / 7))
  const litrosSemanaBase = litrosTotales / semanas
  const serieSemanal = Array.from({ length: semanas }, (_, i) => {
    const factor = 0.92 + ((i % 3) * 0.04)
    const litros = round2(litrosSemanaBase * factor)
    const dest = round2(litros * eff)
    const bots = Math.floor(dest)
    return {
      semana: `S${i + 1}`,
      litros,
      destilados: dest,
      botellas: bots,
      ventas: round2(bots * precio),
    }
  })

  const serieDiariaDemo = DIAS_SEMANA.map((dia, i) => {
    const factor = 0.9 + (i % 4) * 0.035
    const litros = round2((litrosTotales / dias) * factor)
    const bots = Math.floor(litros * eff)
    return { dia, litros, botellas: bots, ventas: round2(bots * precio) }
  })

  return {
    plantas,
    dias,
    litrosDiaPlanta: lDia,
    eficienciaDestilacion: eff,
    precioBotella: precio,
    recolectoras: nRec,
    litrosTotales: round2(litrosTotales),
    litrosDestilados: round2(litrosDestilados),
    botellas,
    usd,
    litrosPorRecolectoraDia,
    formula: `${plantas.toLocaleString()} plantas × ${lDia} L/día × ${dias} días × ${Math.round(eff * 100)}% × $${precio}`,
    serieSemanal,
    serieDiariaDemo,
  }
}

/**
 * Supervivencia y pérdida financiera a nivel de portafolio.
 */
export function calcularSupervivenciaFinanciera({
  hectareas = HA_ACTUALES,
  densidadHa = DENSIDAD_ALTA_HA,
  mortalidadPct = MORTALIDAD_REF_PCT,
  usdPorPlanta = USD_POR_PLANTA_MADUREZ,
  usdIntercaladoHa = USD_INTERCALADO_HA_6M,
} = {}) {
  const ha = Math.max(0.25, Number(hectareas) || 0)
  const dens = Math.max(1, Math.round(Number(densidadHa) || DENSIDAD_ALTA_HA))
  const mort = Math.min(100, Math.max(0, Number(mortalidadPct) || 0))
  const usdP = Math.max(0, Number(usdPorPlanta) || 0)
  const usdI = Math.max(0, Number(usdIntercaladoHa) || 0)

  const sembradas = Math.round(ha * dens)
  const vivos = Math.round(sembradas * (1 - mort / 100))
  const muertas = Math.max(0, sembradas - vivos)
  const ingresoIdeal = sembradas * usdP
  const ingresoPenco = vivos * usdP
  const perdidaUsd = muertas * usdP
  const ingresoIntercalado = Math.round(ha * usdI)
  const totalNeto = ingresoPenco + ingresoIntercalado
  const totalIdeal = ingresoIdeal + ingresoIntercalado

  const vivosCert = Math.round(sembradas * 0.96)
  const totalCert = vivosCert * usdP + ingresoIntercalado
  const upsideCert = Math.max(0, totalCert - totalNeto)

  return {
    hectareas: ha,
    densidadHa: dens,
    mortalidadPct: mort,
    sembradas,
    vivos,
    muertas,
    ingresoIdeal: round2(ingresoIdeal),
    ingresoPenco: round2(ingresoPenco),
    perdidaUsd: round2(perdidaUsd),
    ingresoIntercalado: round2(ingresoIntercalado),
    totalNeto: round2(totalNeto),
    totalIdeal: round2(totalIdeal),
    upsideCert: round2(upsideCert),
    supervivenciaPct: round2(100 - mort),
    formula: `${sembradas.toLocaleString()} sembradas × (1 − ${mort}%) = ${vivos.toLocaleString()} vivas × $${usdP}`,
    barras: [
      { nombre: 'Ideal (0% mort.)', usd: round2(totalIdeal) },
      { nombre: 'Neto actual', usd: round2(totalNeto) },
      { nombre: 'Certificado 4%', usd: round2(totalCert) },
    ],
  }
}

/**
 * Escalamiento 3 → 20 ha: curva de plantas, ingreso y CO₂.
 */
export function calcularEscalamientoHa({
  haActual = HA_ACTUALES,
  haObjetivo = HA_META,
  densidadHa = DENSIDAD_ALTA_HA,
  mortalidadPct = 8,
  usdPorPlanta = USD_POR_PLANTA_MADUREZ,
  usdIntercaladoHa = USD_INTERCALADO_HA_6M,
  co2TonPorHa = CO2_TON_POR_HA,
  metaCo2Ton = META_CO2_TON,
} = {}) {
  const haNow = Math.max(0.25, Number(haActual) || HA_ACTUALES)
  const haTarget = Math.max(haNow, Number(haObjetivo) || HA_META)
  const dens = Math.max(1, Math.round(Number(densidadHa) || DENSIDAD_ALTA_HA))
  const mort = Math.min(100, Math.max(0, Number(mortalidadPct) || 0))
  const surv = 1 - mort / 100

  const puntos = []
  const step = haTarget <= 10 ? 0.5 : 1
  for (let h = 1; h <= HA_META + 0.001; h += step) {
    const ha = Math.round(h * 10) / 10
    const sembradas = Math.round(ha * dens)
    const vivos = Math.round(sembradas * surv)
    const ingresoPenco = vivos * usdPorPlanta
    const ingresoInter = Math.round(ha * usdIntercaladoHa)
    const co2 = round2(ha * co2TonPorHa * surv)
    puntos.push({
      ha,
      plantas: vivos,
      ingresoPenco: round2(ingresoPenco),
      ingresoIntercalado: ingresoInter,
      ingresoTotal: round2(ingresoPenco + ingresoInter),
      co2Ton: co2,
      esActual: Math.abs(ha - haNow) < step / 2,
      esObjetivo: Math.abs(ha - haTarget) < step / 2,
      esMeta: Math.abs(ha - HA_META) < step / 2,
    })
  }

  const enObjetivo = (() => {
    const sembradas = Math.round(haTarget * dens)
    const vivos = Math.round(sembradas * surv)
    return {
      ha: haTarget,
      plantas: vivos,
      ingresoTotal: round2(vivos * usdPorPlanta + haTarget * usdIntercaladoHa),
      co2Ton: round2(haTarget * co2TonPorHa * surv),
      pctMetaHa: round2(Math.min(100, (haTarget / HA_META) * 100)),
      pctMetaCo2: round2(Math.min(100, ((haTarget * co2TonPorHa * surv) / metaCo2Ton) * 100)),
    }
  })()

  const enActual = (() => {
    const sembradas = Math.round(haNow * dens)
    const vivos = Math.round(sembradas * surv)
    return {
      ha: haNow,
      plantas: vivos,
      ingresoTotal: round2(vivos * usdPorPlanta + haNow * usdIntercaladoHa),
      co2Ton: round2(haNow * co2TonPorHa * surv),
    }
  })()

  return {
    haActual: haNow,
    haObjetivo: haTarget,
    densidadHa: dens,
    mortalidadPct: mort,
    puntos,
    enActual,
    enObjetivo,
    metaHa: HA_META,
    metaCo2Ton,
    formula: `ha × ${dens}/ha × (1 − ${mort}%) × $${usdPorPlanta} + ha × $${usdIntercaladoHa} intercalado`,
  }
}

/**
 * Agrega carbono estimado vs verificado del snapshot de campo.
 * Las mediciones suelen ser a escala de planta (kg); el pastel de portafolio
 * se expresa en t CO₂e hacia la meta comunitaria.
 * @param {{ mediciones?: object[], parcelas?: object[], plantas?: object[] }} campo
 */
export function agregarCarbonoPortafolio(campo = {}, { metaCo2Ton = META_CO2_TON } = {}) {
  const mediciones = Array.isArray(campo.mediciones) ? campo.mediciones : []
  const parcelas = Array.isArray(campo.parcelas) ? campo.parcelas : []
  const plantas = Array.isArray(campo.plantas) ? campo.plantas : []

  function co2KgFromMedicion(m) {
    const direct = parseFloat(m?.co2_equivalente_kg)
    if (Number.isFinite(direct) && direct > 0) return direct
    const carbono = parseFloat(m?.carbono_acumulado_kg)
    if (Number.isFinite(carbono) && carbono > 0) return carbono * 3.67
    return 0
  }

  function isVerificado(m) {
    return (
      m?.carbono_verificado === true ||
      m?.tipo_carbono === 'verificado_in_situ' ||
      m?.tipo_carbono === 'verificado'
    )
  }

  let estimadoKg = 0
  let verificadoKg = 0

  for (const m of mediciones) {
    const co2 = co2KgFromMedicion(m)
    if (isVerificado(m)) verificadoKg += co2
    else estimadoKg += co2
  }

  const haSnap = parcelas.reduce((s, p) => s + (Number(p.area_hectareas) || 0), 0)
  const ha = haSnap > 0 ? haSnap : HA_ACTUALES
  const expectedPortfolioKg = ha * CO2_TON_POR_HA * 1000
  const sampleKg = estimadoKg + verificadoKg

  let proxySinMediciones = mediciones.length === 0
  let extrapoladoDesdeMuestras = false

  if (mediciones.length === 0 || sampleKg <= 0) {
    estimadoKg = expectedPortfolioKg * 0.55
    verificadoKg = expectedPortfolioKg * 0.35
    proxySinMediciones = true
  } else if (sampleKg < expectedPortfolioKg * 0.2) {
    // Muestras a nivel planta (kg): proyectar a portafolio manteniendo ratio verificado/estimado
    const ratioV = verificadoKg / sampleKg
    const ratioE = estimadoKg / sampleKg
    const capturadoKg = expectedPortfolioKg * 0.9
    verificadoKg = capturadoKg * ratioV
    estimadoKg = capturadoKg * ratioE
    extrapoladoDesdeMuestras = true
  }

  const estimadoTon = round2(estimadoKg / 1000)
  const verificadoTon = round2(verificadoKg / 1000)
  const totalTon = round2(estimadoTon + verificadoTon)
  const pendienteTon = round2(Math.max(0, metaCo2Ton - totalTon))
  const pctMeta = round2(Math.min(100, (totalTon / metaCo2Ton) * 100))

  const plantaById = new Map(plantas.map((p) => [p.id, p]))
  const parcelaById = new Map(parcelas.map((p) => [p.id, p]))

  const porParcelaMap = new Map()
  for (const m of mediciones) {
    const planta = plantaById.get(m.planta_id)
    const parcelaId = planta?.parcela_id || m.parcela_id || 'sin_parcela'
    const parcela = parcelaById.get(parcelaId)
    const key = parcelaId
    if (!porParcelaMap.has(key)) {
      porParcelaMap.set(key, {
        id: key,
        nombre: parcela?.nombre || 'Sin parcela',
        estimadoTon: 0,
        verificadoTon: 0,
      })
    }
    const row = porParcelaMap.get(key)
    const co2 = co2KgFromMedicion(m) / 1000
    if (isVerificado(m)) row.verificadoTon += co2
    else row.estimadoTon += co2
  }

  let porParcela = [...porParcelaMap.values()].map((r) => ({
    ...r,
    estimadoTon: round2(r.estimadoTon),
    verificadoTon: round2(r.verificadoTon),
    totalTon: round2(r.estimadoTon + r.verificadoTon),
  }))

  // Si extrapolamos a portafolio, repartir t finales por parcela (ponderado por muestra o por ha)
  if (extrapoladoDesdeMuestras || proxySinMediciones) {
    if (porParcela.length > 0 && sampleKg > 0 && extrapoladoDesdeMuestras) {
      const sampleTon = sampleKg / 1000
      const scale = sampleTon > 0 ? totalTon / sampleTon : 1
      porParcela = porParcela.map((r) => ({
        ...r,
        estimadoTon: round2(r.estimadoTon * scale),
        verificadoTon: round2(r.verificadoTon * scale),
        totalTon: round2((r.estimadoTon + r.verificadoTon) * scale),
      }))
    } else if (parcelas.length > 0) {
      const haTotal = haSnap > 0 ? haSnap : parcelas.length
      porParcela = parcelas.map((p) => {
        const shareHa = (Number(p.area_hectareas) || haTotal / parcelas.length) / haTotal
        return {
          id: p.id,
          nombre: p.nombre || 'Parcela',
          estimadoTon: round2(estimadoTon * shareHa),
          verificadoTon: round2(verificadoTon * shareHa),
          totalTon: round2(totalTon * shareHa),
        }
      })
    }
  }

  const rawDonut = [
    { name: 'Verificado in situ', value: verificadoTon, fill: '#0d4f36' },
    { name: 'Estimado', value: estimadoTon, fill: '#5aa887' },
    { name: 'Pendiente meta', value: pendienteTon, fill: '#dbe4de' },
  ]
  // Recharts se rompe / se ve vacío con ceros o NaN
  const donut = rawDonut
    .map((d) => ({ ...d, value: Number.isFinite(d.value) ? Math.max(0, d.value) : 0 }))
    .filter((d) => d.value > 0.001)

  return {
    ha,
    medicionesCount: mediciones.length,
    estimadoTon,
    verificadoTon,
    totalTon,
    pendienteTon,
    pctMeta,
    metaCo2Ton,
    porParcela,
    donut,
    formula: extrapoladoDesdeMuestras
      ? `${mediciones.length} muestras → proyectado a ${ha} ha (ratio verif./estim.) / meta ${metaCo2Ton} t`
      : proxySinMediciones
        ? `Proxy ${ha} ha × ${CO2_TON_POR_HA} t/ha → avance / ${metaCo2Ton} t meta`
        : `Σ CO₂ mediciones (estimado + verificado) → avance / ${metaCo2Ton} t meta`,
    proxySinMediciones,
    extrapoladoDesdeMuestras,
  }
}

export {
  HA_ACTUALES,
  HA_META,
  META_CO2_TON,
  PRECIO_BOTELLA_USD,
  LITROS_DIA_POR_PLANTA,
  MUJERES_RECOLECTORAS,
}
