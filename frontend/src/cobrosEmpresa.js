/**
 * Reglas de pagos, deudas y cobros — Pencos del Norte (consola empresa).
 */
import {
  LITROS_DIA_POR_PLANTA,
  MUJERES_RECOLECTORAS,
  PRECIO_BOTELLA_USD,
} from './agaveAndino'
import { PRECIO_COMPRA_LITRO_AGRICULTOR } from './costosProduccion'

/** Precio de venta embotellado (referencia comercial) */
export const PRECIO_VENTA_LITRO_USD = PRECIO_BOTELLA_USD
/** Precio al que la empresa compra chawarmishky al productor (~doble leche) */
export const PRECIO_ACOPIO_LITRO_USD = PRECIO_COMPRA_LITRO_AGRICULTOR
/** Hijuelo certificado en Mercado de Propagación */
export const PRECIO_HIJUELO_CERT_USD = 2.5
/** Semilla unitaria (vivero; germinación baja) */
export const PRECIO_SEMILLA_USD = 0.08
/** USD por planta en madurez (venta garantizada chawarmishky) */
export const USD_PLANTA_MADUREZ = 160
/** Días de temporada de cosecha / destilación */
export const DIAS_TEMPORADA_COBRO = 60

export const REGLAS_PAGO = [
  {
    id: 'acopio',
    titulo: 'Acopio de chawarmishky',
    detalle: `La empresa compra el litro al productor a $${PRECIO_ACOPIO_LITRO_USD} USD (preferencial).`,
  },
  {
    id: 'venta',
    titulo: 'Venta embotellada',
    detalle: `Producto final a $${PRECIO_VENTA_LITRO_USD} USD/L. Margen = venta − acopio − destilación.`,
  },
  {
    id: 'pacto',
    titulo: 'Crédito del Pacto Social',
    detalle:
      'El productor recibe hijuelos/semillas ahora y paga después con litros de chawarmishky entregados a Pencos del Norte.',
  },
  {
    id: 'garantia',
    titulo: 'Compra garantizada',
    detalle: `Referencia de madurez: ~$${USD_PLANTA_MADUREZ}/planta por venta de chawarmishky.`,
  },
]

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

export function precioMaterial(tipo) {
  return tipo === 'semillas' ? PRECIO_SEMILLA_USD : PRECIO_HIJUELO_CERT_USD
}

/** USD de una solicitud de mercado. */
export function deudaUsdSolicitud(s) {
  const n = Math.max(0, Number(s.cantidad) || 0)
  return round2(n * precioMaterial(s.tipo))
}

/** Litros de chawarmishky equivalentes para saldar deuda (al precio de acopio). */
export function litrosParaSaldar(usd) {
  if (!PRECIO_ACOPIO_LITRO_USD) return 0
  return round2(Math.max(0, Number(usd) || 0) / PRECIO_ACOPIO_LITRO_USD)
}

/**
 * Consolida deudas/cobros desde el snapshot de campo + demo.
 * @param {object} campo
 */
export function consolidarCobrosPagos(campo = {}) {
  const solicitudes = Array.isArray(campo.mercado_solicitudes) ? campo.mercado_solicitudes : []
  const ofertas = Array.isArray(campo.mercado_ofertas) ? campo.mercado_ofertas : []
  const productor = campo.productor?.nombre || 'Productor (demo)'

  const credito = solicitudes.filter((s) => s.pago === 'credito_pacto')
  const efectivo = solicitudes.filter((s) => s.pago !== 'credito_pacto')

  const deudas = credito.map((s) => {
    const usd = deudaUsdSolicitud(s)
    const litros = litrosParaSaldar(usd)
    return {
      id: s.id,
      productor: s.productor_nombre || productor,
      tipo: s.tipo || 'hijuelos',
      cantidad: s.cantidad,
      usd,
      litros_equivalentes: litros,
      estado: s.estado_pago || s.estado || 'pendiente',
      created_at: s.created_at,
      origen: 'pacto_social',
    }
  })

  const deudaTotalUsd = round2(deudas.reduce((a, d) => a + d.usd, 0))
  const deudaTotalLitros = round2(deudas.reduce((a, d) => a + d.litros_equivalentes, 0))
  const cobradoUsd = round2(
    deudas.filter((d) => d.estado === 'pagado' || d.estado === 'saldado').reduce((a, d) => a + d.usd, 0)
  )
  const porCobrarUsd = round2(Math.max(0, deudaTotalUsd - cobradoUsd))
  const porCobrarLitros = litrosParaSaldar(porCobrarUsd)

  const efectivoUsd = round2(efectivo.reduce((a, s) => a + deudaUsdSolicitud(s), 0))

  // Lo que la empresa debe pagar al productor en temporada (estimación de acopio)
  const litrosTemporadaEstimados =
    LITROS_DIA_POR_PLANTA * DIAS_TEMPORADA_COBRO * Math.max(1, Number(campo.plantas?.length) || 50)
  const pagoAcopioEstimadoUsd = round2(litrosTemporadaEstimados * PRECIO_ACOPIO_LITRO_USD)
  const ingresoVentaEstimadoUsd = round2(litrosTemporadaEstimados * PRECIO_VENTA_LITRO_USD * 0.55)

  const ofertasUsd = round2(
    ofertas.reduce((a, o) => a + Math.max(0, Number(o.cantidad) || 0) * PRECIO_HIJUELO_CERT_USD, 0)
  )

  return {
    productor,
    deudas,
    deudaTotalUsd,
    deudaTotalLitros,
    cobradoUsd,
    porCobrarUsd,
    porCobrarLitros,
    efectivoUsd,
    solicitudesCount: solicitudes.length,
    creditoCount: credito.length,
    efectivoCount: efectivo.length,
    ofertasCount: ofertas.length,
    ofertasUsd,
    litrosTemporadaEstimados: round2(litrosTemporadaEstimados),
    pagoAcopioEstimadoUsd,
    ingresoVentaEstimadoUsd,
    margenBrutoEstimadoUsd: round2(ingresoVentaEstimadoUsd - pagoAcopioEstimadoUsd),
    tarifas: {
      acopio_litro: PRECIO_ACOPIO_LITRO_USD,
      venta_litro: PRECIO_VENTA_LITRO_USD,
      hijuelo: PRECIO_HIJUELO_CERT_USD,
      semilla: PRECIO_SEMILLA_USD,
      planta_madurez: USD_PLANTA_MADUREZ,
      litros_dia_planta: LITROS_DIA_POR_PLANTA,
      dias_temporada: DIAS_TEMPORADA_COBRO,
      recolectoras: MUJERES_RECOLECTORAS,
    },
    sinDatosMercado: solicitudes.length === 0 && ofertas.length === 0,
  }
}

/** Demo de cartera para pitch cuando no hay solicitudes en el snapshot. */
export function demoCarteraCobros() {
  const demoSolicitudes = [
    {
      id: 'demo-cred-1',
      tipo: 'hijuelos',
      cantidad: 80,
      pago: 'credito_pacto',
      estado: 'pendiente',
      productor_nombre: 'María Penco',
      created_at: '2026-08-12T10:00:00.000Z',
    },
    {
      id: 'demo-cred-2',
      tipo: 'hijuelos',
      cantidad: 40,
      pago: 'credito_pacto',
      estado: 'pendiente',
      productor_nombre: 'José Agave',
      created_at: '2026-08-20T10:00:00.000Z',
    },
    {
      id: 'demo-ef-1',
      tipo: 'semillas',
      cantidad: 200,
      pago: 'efectivo',
      estado: 'pagada',
      productor_nombre: 'Rosa Quilo',
      created_at: '2026-09-01T10:00:00.000Z',
    },
  ]
  return consolidarCobrosPagos({
    productor: { nombre: 'Portafolio demo' },
    mercado_solicitudes: demoSolicitudes,
    mercado_ofertas: [
      {
        id: 'demo-of-1',
        cantidad: 15,
        tamano_roseta_cm: 9.5,
        peso_kg: 2.1,
        created_at: '2026-09-02T10:00:00.000Z',
      },
    ],
    plantas: Array.from({ length: 60 }, (_, i) => ({ id: `p${i}` })),
  })
}
