import QRCode from 'qrcode'

const PREFIX = 'PENCOLAB|'

/** Arma la ficha de campo de un lote a partir del store local. */
export function buildParcelaFicha(parcela, plantas = [], bitacora = []) {
  if (!parcela) return null
  const delLote = plantas.filter((p) => p.parcela_id === parcela.id)
  const vivas = delLote.filter((p) => !p.estado || p.estado === 'activa').length
  const fechasSiembra = delLote
    .map((p) => p.fecha_siembra)
    .filter(Boolean)
    .sort()
  const fechaEst =
    parcela.fecha_establecimiento ||
    fechasSiembra[0] ||
    (parcela.created_at ? String(parcela.created_at).slice(0, 10) : null)

  const delBit = bitacora.filter((b) => b.parcela_id === parcela.id)
  const riegos = delBit
    .filter((b) => b.tipo === 'riego')
    .map((b) => b.fecha_programada)
    .filter(Boolean)
    .sort()
  const ferts = delBit
    .filter((b) => b.tipo === 'fertilizacion' || b.tipo === 'fitosanitario')
    .map((b) => b.fecha_programada)
    .filter(Boolean)
    .sort()
  const estados = delBit
    .filter((b) => b.tipo === 'monitoreo' && b.datos?.estado_lote)
    .sort((a, b) => String(a.fecha_programada).localeCompare(String(b.fecha_programada)))

  const ultimoRiego = parcela.ultimo_riego || (riegos.length ? riegos[riegos.length - 1] : null)
  const estadoLote =
    parcela.estado_lote ||
    (estados.length ? estados[estados.length - 1].datos.estado_lote : null)

  return {
    v: 1,
    app: 'pencolab',
    parcela_id: parcela.id,
    nombre: parcela.nombre || 'Lote',
    area: parcela.area_hectareas != null ? Number(parcela.area_hectareas) : null,
    fecha_establecimiento: fechaEst,
    plantas_vivas: vivas,
    ultimo_riego: ultimoRiego,
    fertilizacion: ferts.length ? ferts[ferts.length - 1] : null,
    estado_lote: estadoLote,
  }
}

export function encodeParcelaQr(ficha) {
  return `${PREFIX}${JSON.stringify(ficha)}`
}

export function parseParcelaQr(raw) {
  if (!raw || typeof raw !== 'string') return null
  const text = raw.trim()
  try {
    if (text.startsWith(PREFIX)) {
      return JSON.parse(text.slice(PREFIX.length))
    }
    if (text.startsWith('{')) {
      const obj = JSON.parse(text)
      if (obj?.parcela_id || obj?.app === 'pencolab') return obj
    }
  } catch {
    return null
  }
  return null
}

export async function qrDataUrl(ficha) {
  const payload = encodeParcelaQr(ficha)
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 280,
    color: { dark: '#0d4f36', light: '#ffffff' },
  })
}

export function formatFecha(iso) {
  if (!iso) return 'Sin registro'
  try {
    const d = new Date(`${iso}T12:00:00`)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}
