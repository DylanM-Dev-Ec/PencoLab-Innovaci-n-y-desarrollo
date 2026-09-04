import { useMemo, useState } from 'react'
import { AppIcon } from '../components/AppIcon'
import { GERMINACION_TEORICA_PCT } from '../agaveAndino'
import { getGps, recomendacionPh } from '../store'
import { navigate } from '../routing'

/**
 * Pestaña rápida: registrar un lote offline (GPS, trazado, hijuelo/semilla).
 */
export default function AnotarLote({ data, onAdd, setMsg }) {
  const [origen, setOrigen] = useState('hijuelo')
  const [ph, setPh] = useState('6.5')
  const [edadMadre, setEdadMadre] = useState(4)
  const [peso, setPeso] = useState(2)
  const [roseta, setRoseta] = useState(9.5)
  const [diasSol, setDiasSol] = useState(10)
  const [form, setForm] = useState({
    nombre: '',
    area: '0.5',
    tipo_trazado: 'zanjas',
    cantidad: '50',
    lote_semillas: '',
  })
  const [gps, setGps] = useState({ lat: null, lng: null, precision: null })
  const [gpsBusy, setGpsBusy] = useState(false)

  const phTip = useMemo(() => recomendacionPh(ph), [ph])
  const edadOk = edadMadre >= 3 && edadMadre <= 5
  const pesoOk = peso >= 1.5 && peso <= 3
  const rosetaOk = roseta >= 8 && roseta <= 11
  const solOk = diasSol >= 10

  async function captureGps() {
    setGpsBusy(true)
    try {
      const pos = await getGps()
      setGps(pos)
      if (!pos.lat) setMsg?.({ type: 'warn', text: 'GPS no disponible. Intenta al aire libre.' })
    } finally {
      setGpsBusy(false)
    }
  }

  function save(e) {
    e.preventDefault()
    if (!form.nombre.trim()) {
      setMsg?.({ type: 'warn', text: 'Pon un nombre al lote.' })
      return
    }
    const parcelaId = crypto.randomUUID()
    const hoy = new Date().toISOString().slice(0, 10)
    const qty = Math.max(1, parseInt(form.cantidad, 10) || 1)
    const plantas = []
    for (let i = 0; i < Math.min(qty, 200); i += 1) {
      plantas.push({
        id: crypto.randomUUID(),
        parcela_id: parcelaId,
        codigo: `AND-${Date.now().toString(36)}-${i + 1}`,
        fecha_siembra: hoy,
        tipo_propagacion: origen,
        ubicacion_lat: gps.lat ? parseFloat(gps.lat) : null,
        ubicacion_lng: gps.lng ? parseFloat(gps.lng) : null,
        estado: 'activa',
        peso_hijuelo_kg: origen === 'hijuelo' ? peso : null,
        tamano_roseta_inicial_cm: origen === 'hijuelo' ? roseta : null,
        edad_planta_madre_anios: origen === 'hijuelo' ? edadMadre : null,
        dias_cicatrizacion: origen === 'hijuelo' ? diasSol : 0,
        tratamiento_sanitario: origen === 'hijuelo',
        metodo_desinfeccion: origen === 'hijuelo' ? 'fuego' : 'n/a',
        hijuelo_apto: origen === 'hijuelo' ? edadOk && pesoOk && rosetaOk : null,
        notas:
          origen === 'semilla'
            ? `Vivero. Lote ${form.lote_semillas || 'S/N'}. Germinación ~${GERMINACION_TEORICA_PCT}%.`
            : `Siembra andina en ${form.tipo_trazado}.`,
        synced_at: null,
      })
    }

    const vivero =
      origen === 'semilla'
        ? [
            ...(data.vivero_semillas || []),
            {
              id: crypto.randomUUID(),
              lote_semillas: form.lote_semillas || `LOTE-${hoy}`,
              fecha_siembra: hoy,
              cantidad_sembradas: qty,
              cantidad_germinadas: 0,
              tasa_germinacion_real: null,
              synced_at: null,
            },
          ]
        : data.vivero_semillas || []

    onAdd({
      parcelas: [
        ...data.parcelas,
        {
          id: parcelaId,
          productor_id: data.session.productor_id,
          nombre: form.nombre.trim(),
          area_hectareas: parseFloat(form.area) || null,
          tipo_trazado: form.tipo_trazado,
          metas_expansion_ha: 20,
          fecha_establecimiento: hoy,
          ubicacion_lat: gps.lat ? parseFloat(gps.lat) : null,
          ubicacion_lng: gps.lng ? parseFloat(gps.lng) : null,
          ph: parseFloat(ph) || 6.5,
          tipo_suelo: 'franco',
          permeabilidad: 'media',
          recomendacion_ph: phTip?.texto || 'pH en rango óptimo (6.0–7.0)',
          estado_lote: 'sano',
          synced_at: null,
        },
      ],
      plantas: [...data.plantas, ...plantas],
      vivero_semillas: vivero,
    })
    setMsg?.({
      type: 'success',
      text:
        origen === 'semilla'
          ? `Lote «${form.nombre.trim()}» anotado. Revisa humedad diario.`
          : `Lote «${form.nombre.trim()}» anotado offline.`,
    })
    setForm((f) => ({ ...f, nombre: '', cantidad: '50', lote_semillas: '' }))
  }

  return (
    <div className="anotar-lote-screen">
      <header className="anotar-hero">
        <AppIcon name="anotar" alt="" className="glyph-lg" />
        <p className="anotar-kicker">Registro rápido · offline</p>
        <h2>Anotar lote</h2>
        <p>Deja el lote en el teléfono con GPS, trazado y origen. Sincroniza cuando tengas red.</p>
      </header>

      <button type="button" className="m-card anotar-qr-link" onClick={() => navigate('/productor/qr')}>
        <AppIcon name="qr" alt="" className="glyph-md" />
        <div>
          <strong>Código QR del lote</strong>
          <span>Genera o escanea el QR para identificar parcelas en campo</span>
        </div>
      </button>

      <form className="m-card anotar-form" onSubmit={save}>
        <input
          className="m-name"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          placeholder="Nombre del lote (ej. Ladera norte)"
          required
        />

        <div className="m-hero-num">
          <span>Hectáreas aproximadas</span>
          <div className="m-ph-big">{parseFloat(form.area || 0).toFixed(1)}</div>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
          />
        </div>

        <p className="andina-label">Trazado</p>
        <div className="m-chip-row">
          {[
            { id: 'laderas', label: 'Laderas' },
            { id: 'zanjas', label: 'Zanjas / terrazas' },
            { id: 'plano', label: 'Plano' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={`m-chip ${form.tipo_trazado === t.id ? 'on' : ''}`}
              onClick={() => setForm({ ...form, tipo_trazado: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="m-hero-num">
          <span>pH del suelo</span>
          <div className="m-ph-big">{parseFloat(ph).toFixed(1)}</div>
          <input
            type="range"
            min="4"
            max="9"
            step="0.1"
            value={ph}
            onChange={(e) => setPh(e.target.value)}
          />
          {phTip && <p className={`anotar-ph ${phTip.nivel}`}>{phTip.texto}</p>}
        </div>

        <p className="andina-label">Origen</p>
        <div className="m-chip-row">
          <button
            type="button"
            className={`m-chip ${origen === 'hijuelo' ? 'on' : ''}`}
            onClick={() => setOrigen('hijuelo')}
          >
            <AppIcon name="firme" alt="" className="glyph-xs" />
            Hijuelo
          </button>
          <button
            type="button"
            className={`m-chip ${origen === 'semilla' ? 'on' : ''}`}
            onClick={() => setOrigen('semilla')}
          >
            <AppIcon name="semilla" alt="" className="glyph-xs" />
            Semilla
          </button>
        </div>

        {origen === 'hijuelo' ? (
          <div className="anotar-hijuelo">
            <label className="anotar-field">
              <span>Edad madre (años) · ideal 3–5</span>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={edadMadre}
                onChange={(e) => setEdadMadre(parseFloat(e.target.value))}
              />
              <strong className={edadOk ? 'ok' : 'warn'}>{edadMadre}</strong>
            </label>
            <label className="anotar-field">
              <span>Peso (kg) · ideal 1.5–3</span>
              <input
                type="range"
                min="0.5"
                max="4"
                step="0.1"
                value={peso}
                onChange={(e) => setPeso(parseFloat(e.target.value))}
              />
              <strong className={pesoOk ? 'ok' : 'warn'}>{peso.toFixed(1)}</strong>
            </label>
            <label className="anotar-field">
              <span>Roseta (cm) · ideal 8–11</span>
              <input
                type="range"
                min="4"
                max="16"
                step="0.1"
                value={roseta}
                onChange={(e) => setRoseta(parseFloat(e.target.value))}
              />
              <strong className={rosetaOk ? 'ok' : 'warn'}>{roseta.toFixed(1)}</strong>
            </label>
            <label className="anotar-field">
              <span>Días al sol · mín. 10</span>
              <input
                type="range"
                min="0"
                max="14"
                value={diasSol}
                onChange={(e) => setDiasSol(parseInt(e.target.value, 10))}
              />
              <strong className={solOk ? 'ok' : 'warn'}>{diasSol}</strong>
            </label>
          </div>
        ) : (
          <>
            <p className="andina-hint">
              Germinación teórica ~{GERMINACION_TEORICA_PCT}%. Siembra de más y revisa humedad a diario.
            </p>
            <input
              className="m-name"
              value={form.lote_semillas}
              onChange={(e) => setForm({ ...form, lote_semillas: e.target.value })}
              placeholder="Código lote de semillas"
            />
          </>
        )}

        <div className="m-hero-num">
          <span>{origen === 'semilla' ? 'Semillas / plantines' : 'Hijuelos aproximados'}</span>
          <input
            className="m-name"
            type="number"
            min="1"
            value={form.cantidad}
            onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
          />
        </div>

        <div className="andina-gps">
          <button type="button" className="m-btn ghost" onClick={captureGps} disabled={gpsBusy}>
            {gpsBusy ? 'Obteniendo GPS…' : 'Capturar GPS del lote'}
          </button>
          {gps.lat ? (
            <p>
              GPS {gps.lat}, {gps.lng}
              {gps.precision ? ` · ±${gps.precision} m` : ''}
            </p>
          ) : (
            <p className="andina-hint">Sin GPS aún — puedes guardar igual</p>
          )}
        </div>

        <button className="m-btn" type="submit">
          Guardar lote offline
        </button>
        <button type="button" className="m-btn ghost" onClick={() => navigate('/productor/andina')}>
          Ver guía de siembra
        </button>
      </form>
    </div>
  )
}
