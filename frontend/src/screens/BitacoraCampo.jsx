import { useMemo, useState } from 'react'
import { AppIcon } from '../components/AppIcon'
import { getGps } from '../store'
import { buildParcelaFicha, formatFecha } from '../utils/parcelaQr'

const ESTADOS_LOTE = [
  { id: 'sano', label: 'Sano', icon: 'check', hint: 'Plantas firmes, sin plagas visibles' },
  { id: 'atencion', label: 'Atención', icon: 'ph-atencion', hint: 'Estrés hídrico o pH a vigilar' },
  { id: 'plaga', label: 'Con plaga', icon: 'alerta', hint: 'Cochinilla, picudo u otra plaga' },
  { id: 'encharque', label: 'Encharque', icon: 'encharque', hint: 'Exceso de agua · riesgo de pudrición' },
]

const INTENSIDAD_RIEGO = [
  { id: 'invierno', icon: 'riego', label: 'Poco' },
  { id: 'primavera', icon: 'primavera', label: 'Normal' },
  { id: 'verano', icon: 'sol', label: 'Menos' },
]

/**
 * Pantalla Campo: el agricultor registra estado del lote y último riego.
 */
export default function BitacoraMovil({ data, scope, onAdd }) {
  const parcelas = scope.parcelas || []
  const [parcelaId, setParcelaId] = useState(parcelas[0]?.id || '')
  const parcela = parcelas.find((p) => p.id === parcelaId) || parcelas[0]

  const [estadoLote, setEstadoLote] = useState(parcela?.estado_lote || 'sano')
  const [fechaRiego, setFechaRiego] = useState(new Date().toISOString().slice(0, 10))
  const [estacion, setEstacion] = useState('primavera')
  const [notas, setNotas] = useState('')
  const [registrarRiego, setRegistrarRiego] = useState(true)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const ficha = useMemo(
    () => (parcela ? buildParcelaFicha(parcela, scope.plantas, scope.bitacora) : null),
    [parcela, scope.plantas, scope.bitacora]
  )

  function onChangeParcela(id) {
    setParcelaId(id)
    const p = parcelas.find((x) => x.id === id)
    if (p?.estado_lote) setEstadoLote(p.estado_lote)
  }

  async function guardar(e) {
    e.preventDefault()
    if (!parcela) {
      setMsg({ type: 'warn', text: 'Primero crea un lote en Tierra.' })
      return
    }
    setBusy(true)
    try {
      const gps = await getGps()
      const hoy = new Date().toISOString()
      const bitacora = [...(data.bitacora || [])]

      bitacora.push({
        id: crypto.randomUUID(),
        productor_id: data.session.productor_id,
        parcela_id: parcela.id,
        tipo: 'monitoreo',
        fecha_programada: new Date().toISOString().slice(0, 10),
        estado: 'completada',
        gps_lat: gps.lat,
        gps_lng: gps.lng,
        gps_precision_m: gps.precision,
        datos: { estado_lote: estadoLote },
        notas: notas || `Estado del lote: ${estadoLote}`,
        synced_at: null,
      })

      if (registrarRiego) {
        bitacora.push({
          id: crypto.randomUUID(),
          productor_id: data.session.productor_id,
          parcela_id: parcela.id,
          tipo: 'riego',
          fecha_programada: fechaRiego,
          estado: 'completada',
          gps_lat: gps.lat,
          gps_lng: gps.lng,
          gps_precision_m: gps.precision,
          datos: { estacion, estado_lote: estadoLote },
          notas: notas || `Riego ${estacion}`,
          synced_at: null,
        })
      }

      const parcelasNext = data.parcelas.map((p) =>
        p.id === parcela.id
          ? {
              ...p,
              estado_lote: estadoLote,
              ultimo_riego: registrarRiego ? fechaRiego : p.ultimo_riego || null,
              estado_lote_actualizado_en: hoy,
              synced_at: null,
            }
          : p
      )

      onAdd({ bitacora, parcelas: parcelasNext })
      setMsg({
        type: 'success',
        text: registrarRiego
          ? 'Estado del lote y último riego guardados.'
          : 'Estado del lote guardado.',
      })
      setNotas('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="campo-estado">
      <header className="campo-hero">
        <AppIcon name="bitacora" alt="" className="glyph-lg" />
        <h2>Estado del lote</h2>
        <p>Registra cómo está tu parcela y cuándo fue el último riego. Eso alimenta el QR del campo.</p>
      </header>

      {msg && <div className={`m-toast ${msg.type}`}>{msg.text}</div>}
      {!parcelas.length && (
        <div className="m-toast warn">Primero crea un lote en Tierra para poder registrar.</div>
      )}

      <form className="m-card" onSubmit={guardar}>
        <label className="campo-label">
          ¿Qué lote actualizas?
          <select
            className="m-select"
            value={parcela?.id || ''}
            onChange={(e) => onChangeParcela(e.target.value)}
            disabled={!parcelas.length}
          >
            {parcelas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        {ficha && (
          <div className="campo-resumen">
            <div>
              <span>Estado actual</span>
              <strong>{ficha.estado_lote || parcela?.estado_lote || 'Sin registrar'}</strong>
            </div>
            <div>
              <span>Último riego</span>
              <strong>{formatFecha(ficha.ultimo_riego || parcela?.ultimo_riego)}</strong>
            </div>
          </div>
        )}

        <p className="campo-label">Estado del lote hoy</p>
        <div className="campo-estados">
          {ESTADOS_LOTE.map((e) => (
            <button
              key={e.id}
              type="button"
              className={`campo-estado-btn ${estadoLote === e.id ? 'on' : ''}`}
              onClick={() => setEstadoLote(e.id)}
            >
              <AppIcon name={e.icon} alt="" className="glyph-sm" />
              <strong>{e.label}</strong>
              <small>{e.hint}</small>
            </button>
          ))}
        </div>

        <label className="campo-check">
          <input
            type="checkbox"
            checked={registrarRiego}
            onChange={(e) => setRegistrarRiego(e.target.checked)}
          />
          <span>También registrar el último riego</span>
        </label>

        {registrarRiego && (
          <div className="campo-riego-box">
            <label className="campo-label">
              Fecha del último riego
              <input
                className="m-name"
                type="date"
                value={fechaRiego}
                onChange={(e) => setFechaRiego(e.target.value)}
                required={registrarRiego}
              />
            </label>
            <p className="campo-label">¿Cuánto regaste?</p>
            <div className="m-chip-row">
              {INTENSIDAD_RIEGO.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={`m-chip ${estacion === e.id ? 'on' : ''}`}
                  onClick={() => setEstacion(e.id)}
                >
                  <AppIcon name={e.icon} alt="" className="glyph-xs" />
                  {e.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="campo-label">
          Notas (opcional)
          <input
            className="m-name"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej. regué solo el surco alto"
          />
        </label>

        <button className="m-btn" type="submit" disabled={!parcela || busy}>
          {busy ? 'Guardando…' : 'Guardar estado y riego'}
        </button>
      </form>

      <OtrasActividades data={data} scope={scope} onAdd={onAdd} parcelaId={parcela?.id} />
    </div>
  )
}

function OtrasActividades({ data, scope, onAdd, parcelaId }) {
  const [open, setOpen] = useState(false)
  const [tipo, setTipo] = useState('fertilizacion')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [clasificacion, setClasificacion] = useState('cochinilla')
  const [foto, setFoto] = useState(null)

  async function submitExtra(e) {
    e.preventDefault()
    if (!parcelaId) return
    const gps = await getGps()
    const item = {
      id: crypto.randomUUID(),
      productor_id: data.session.productor_id,
      parcela_id: parcelaId,
      tipo,
      fecha_programada: fecha,
      estado: 'completada',
      gps_lat: gps.lat,
      gps_lng: gps.lng,
      gps_precision_m: gps.precision,
      datos: {
        clasificacion: tipo === 'scouting_visual' ? clasificacion : undefined,
        foto_in_situ: Boolean(foto),
        foto,
      },
      notas: '',
      synced_at: null,
    }
    onAdd({ bitacora: [...data.bitacora, item] })
    setFoto(null)
  }

  const recientes = (scope.bitacora || []).slice().reverse().slice(0, 8)

  return (
    <section className="campo-extra">
      <button type="button" className="m-btn ghost" onClick={() => setOpen((v) => !v)}>
        {open ? 'Ocultar otras actividades' : 'Abono, poda o plaga'}
      </button>
      {open && (
        <form className="m-card" onSubmit={submitExtra}>
          <div className="m-task-grid">
            {[
              { id: 'fertilizacion', icon: 'abono', label: 'Abono' },
              { id: 'poda_sanitaria', icon: 'poda', label: 'Poda' },
              { id: 'scouting_visual', icon: 'campo', label: 'Plaga' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`m-task ${tipo === t.id ? 'on' : ''}`}
                onClick={() => setTipo(t.id)}
              >
                <AppIcon name={t.icon} alt="" className="task-ico" />
                {t.label}
              </button>
            ))}
          </div>
          <input
            className="m-name"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          {tipo === 'scouting_visual' && (
            <div className="m-chip-row">
              {[
                { id: 'cochinilla', icon: 'cochinilla', label: 'Cochinilla' },
                { id: 'pudricion_erwinia', icon: 'erwinia', label: 'Erwinia' },
                { id: 'picudo_agave', icon: 'picudo', label: 'Picudo' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`m-chip ${clasificacion === c.id ? 'on' : ''}`}
                  onClick={() => setClasificacion(c.id)}
                >
                  <AppIcon name={c.icon} alt="" className="glyph-xs" />
                  {c.label}
                </button>
              ))}
            </div>
          )}
          {tipo === 'scouting_visual' && (
            <label className="m-camera">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => setFoto(reader.result)
                  reader.readAsDataURL(file)
                }}
              />
              {foto ? (
                <img src={foto} alt="" />
              ) : (
                <span className="m-camera-empty">
                  <AppIcon name="campo" alt="" className="glyph-md" />
                  Foto
                </span>
              )}
            </label>
          )}
          <button className="m-btn" type="submit" disabled={!parcelaId}>
            Guardar actividad
          </button>
        </form>
      )}

      {recientes.length > 0 && (
        <div className="campo-lista">
          <h3>Últimos registros</h3>
          {recientes.map((b) => (
            <div key={b.id} className="m-lote">
              <div className="m-lote-ico">
                <AppIcon
                  name={
                    b.tipo === 'riego'
                      ? 'riego'
                      : b.tipo === 'fertilizacion'
                        ? 'abono'
                        : b.tipo === 'poda_sanitaria'
                          ? 'poda'
                          : b.tipo === 'scouting_visual'
                            ? 'campo'
                            : b.tipo === 'monitoreo'
                              ? 'bitacora'
                              : 'anotar'
                  }
                  alt=""
                />
              </div>
              <div>
                <strong>
                  {b.tipo === 'monitoreo'
                    ? `Estado: ${b.datos?.estado_lote || '—'}`
                    : b.tipo === 'riego'
                      ? 'Riego'
                      : b.tipo.replaceAll('_', ' ')}
                </strong>
                <p>{b.fecha_programada}</p>
              </div>
              {!b.synced_at && <b>○</b>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
