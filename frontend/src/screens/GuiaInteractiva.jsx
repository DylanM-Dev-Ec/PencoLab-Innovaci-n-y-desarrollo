import { Component, useMemo, useState } from 'react'
import { certificarLote, ensureProductor, syncPush } from '../api'
import { AppIcon } from '../components/AppIcon'
import { navigate } from '../routing'
import {
  CERT_PENDING_KEY,
  densidadPorSeparacion,
  ESPACIO_SURCO_M,
} from '../store'

const SCENES = [
  { id: 'hijuelo', title: 'Elegir hijuelo', tip: 'Mira, aprieta y mide antes de plantar', icon: 'firme' },
  { id: 'curar', title: 'Curar el corte', tip: 'Fuego, pasta y sol: el orden importa', icon: 'sol' },
  { id: 'trazar', title: 'Trazar el lote', tip: 'Surcos, calles e intercalado', icon: 'surcos' },
  { id: 'plantar', title: 'Plantar firme', tip: 'Profundidad y apisonado (viento Carchi)', icon: 'apisonar' },
]

const INTERCALADOS = [
  { id: 'papa', label: 'Papa', icon: 'papa' },
  { id: 'quinoa', label: 'Quinoa', icon: 'semilla' },
  { id: 'chocho', label: 'Chocho', icon: 'abono' },
]

const EMPTY_SCOPE = { parcelas: [], plantas: [], mediciones: [], bitacora: [] }

function loadCertPending() {
  try {
    const raw = localStorage.getItem(CERT_PENDING_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveCertPending(list) {
  localStorage.setItem(CERT_PENDING_KEY, JSON.stringify(list))
}

function Stepper({ value, onChange, min, max, step = 1, decimals = 0 }) {
  const n = parseFloat(value) || 0
  const clamp = (v) => Math.min(max, Math.max(min, v))
  return (
    <div className="m-stepper">
      <button
        type="button"
        aria-label="menos"
        onClick={() => onChange(String(clamp(Number((n - step).toFixed(decimals)))))}
      >
        -
      </button>
      <span>{decimals ? n.toFixed(decimals) : n}</span>
      <button
        type="button"
        aria-label="más"
        onClick={() => onChange(String(clamp(Number((n + step).toFixed(decimals)))))}
      >
        +
      </button>
    </div>
  )
}

/** Evita pantalla verde si algo truena al renderizar. */
export class GuiaErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="practica-guia practica-fallback">
          <div className="m-card">
            <h2>No se pudo abrir la práctica</h2>
            <p className="practica-fallback-msg">{String(this.state.error?.message || this.state.error)}</p>
            <button type="button" className="m-btn" onClick={() => navigate('/productor/andina')}>
              Volver a la Guía
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

/**
 * Guía interactiva de siembra — práctica guiada (no solo checks).
 */
export default function GuiaInteractiva({ data, scope: scopeProp, onAdd, online, setMsg }) {
  const scope = scopeProp && Array.isArray(scopeProp.parcelas) ? scopeProp : EMPTY_SCOPE
  const parcelas = scope.parcelas
  const safeData = data || { parcelas: [], plantas: [], session: {}, productor: {} }

  const [scene, setScene] = useState(0)
  const [certMsg, setCertMsg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [packOrder, setPackOrder] = useState([])
  const [apisonPress, setApisonPress] = useState(0)
  const [form, setForm] = useState(() => ({
    parcela_id: parcelas[0]?.id || '',
    edad_madre: '4',
    peso: '2.0',
    roseta: '9.5',
    firmeza: null,
    entre_plantas_m: '1.5',
    intercalado: 'papa',
    profundidad: '3/4',
  }))

  const edadVal = parseFloat(form.edad_madre) || 0
  const rosetaVal = parseFloat(form.roseta) || 0
  const pesoVal = parseFloat(form.peso) || 0
  const edadOk = edadVal >= 3 && edadVal <= 5
  const rosetaOk = rosetaVal >= 8 && rosetaVal <= 11
  const pesoOk = pesoVal >= 1.5 && pesoVal <= 3.0
  const firmeOk = form.firmeza === 'firme'
  const apto = edadOk && rosetaOk && pesoOk && firmeOk
  const dens = densidadPorSeparacion(form.entre_plantas_m) || {
    entre_plantas_m: 1.5,
    entre_surcos_m: ESPACIO_SURCO_M,
    plantas_por_ha: 2222,
  }

  const cureDone =
    packOrder.includes('fuego') &&
    packOrder.includes('corte') &&
    packOrder.includes('pasta') &&
    packOrder.includes('sol')
  const cureScore = ['fuego', 'corte', 'pasta', 'sol'].filter((k) => packOrder.includes(k)).length
  const cureOrderOk =
    packOrder.join(',') === 'fuego,corte,pasta,sol' ||
    (cureDone &&
      packOrder.indexOf('fuego') < packOrder.indexOf('corte') &&
      packOrder.indexOf('corte') < packOrder.indexOf('pasta'))

  const apisonOk = apisonPress >= 100
  const plantReady = apto && cureDone && apisonOk
  const progressPct = Math.min(100, ((apto ? 1 : 0) + (cureDone ? 1 : 0) + (apisonOk ? 1 : 0)) * 34)

  const verdicto = useMemo(() => {
    if (form.firmeza === 'bofo') {
      return {
        nivel: 'bad',
        title: 'Descarta este hijuelo',
        text: 'Si se siente esponjoso (bofo), casi seguro falla a los meses. Busca otro firme.',
      }
    }
    if (!edadOk || !pesoOk || !rosetaOk) {
      return {
        nivel: 'warn',
        title: 'Ajusta o busca otro',
        text: 'Madre 3–5 años, peso 1.5–3 kg y roseta 8–11 cm. Fuera de eso el riesgo sube.',
      }
    }
    if (!firmeOk) {
      return {
        nivel: 'warn',
        title: 'Falta la prueba de la mano',
        text: 'Aprieta la base: elige Firme o Bofo según lo que sientes en el campo.',
      }
    }
    return {
      nivel: 'ok',
      title: 'Hijuelo listo pa cicatrizar',
      text: 'Cumple edad, peso, roseta y firmeza. Pasa a curar el corte.',
    }
  }, [edadOk, pesoOk, rosetaOk, firmeOk, form.firmeza])

  function togglePack(id) {
    setPackOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function pressApison() {
    setApisonPress((v) => Math.min(100, v + 18))
  }

  async function finish() {
    setSaving(true)
    setCertMsg(null)
    const incomplete = !plantReady

    let parcelaId = form.parcela_id
    let nextParcelas = safeData.parcelas || []
    if (!parcelaId) {
      parcelaId = crypto.randomUUID()
      nextParcelas = [
        ...nextParcelas,
        {
          id: parcelaId,
          productor_id: safeData.session?.productor_id,
          nombre: 'Parcela guía práctica',
          ph: 6.5,
          fecha_establecimiento: new Date().toISOString().slice(0, 10),
          tipo_suelo: 'franco',
          permeabilidad: 'media',
          recomendacion_ph: 'pH en rango óptimo para Penco/Agave (6.0–7.0)',
          synced_at: null,
        },
      ]
    }

    const plantaId = crypto.randomUUID()
    onAdd({
      parcelas: nextParcelas,
      plantas: [
        ...(safeData.plantas || []),
        {
          id: plantaId,
          parcela_id: parcelaId,
          codigo: `GP-${Date.now().toString(36)}`,
          fecha_siembra: new Date().toISOString().slice(0, 10),
          peso_hijuelo_kg: pesoVal,
          tamano_roseta_inicial_cm: rosetaVal,
          edad_planta_madre_anios: edadVal,
          dias_cicatrizacion: cureDone ? 10 : packOrder.includes('sol') ? 7 : 0,
          tratamiento_sanitario: packOrder.includes('pasta'),
          metodo_desinfeccion: packOrder.includes('fuego') ? 'fuego' : 'pendiente',
          hijuelo_apto: Boolean(apto),
          estado: 'activa',
          notas: `Guía práctica. Profundidad ${form.profundidad}. Surco ${ESPACIO_SURCO_M} m · planta ${dens.entre_plantas_m} m. Intercalado: ${form.intercalado}.`,
          synced_at: null,
        },
      ],
    })

    const certPayload = {
      parcela_id: parcelaId,
      hijuelos_seleccionados_ok: Boolean(apto),
      herramientas_desinfectadas: packOrder.includes('fuego'),
      cicatrizacion_sol_completa: packOrder.includes('sol'),
      trazo_tres_metros_ok: true,
    }

    if (incomplete) {
      setCertMsg({
        type: 'warn',
        text: 'Guardado parcial. Completa firmeza, curación y apisonado cuando puedas.',
      })
    } else if (online && safeData.session?.access_token) {
      try {
        await ensureProductor(
          {
            id: safeData.session.productor_id,
            nombre: safeData.productor?.nombre || String(safeData.session.email || 'productor').split('@')[0],
            email: safeData.session.email,
            comunidad: safeData.productor?.comunidad,
            activo: true,
          },
          safeData.session.access_token
        )
        await syncPush(
          {
            productor_id: safeData.session.productor_id,
            parcelas: nextParcelas
              .filter((p) => p.id === parcelaId)
              .map((p) => ({ ...p, productor_id: safeData.session.productor_id })),
            plantas: [],
            mediciones: [],
            bitacora: [],
          },
          safeData.session.access_token
        )
        const cert = await certificarLote(certPayload, safeData.session.access_token)
        setCertMsg({
          type: cert.apto_pago_preferencial ? 'success' : 'warn',
          text: cert.mensaje || cert.estado,
        })
        if (setMsg) setMsg({ type: cert.apto_pago_preferencial ? 'success' : 'warn', text: cert.mensaje })
      } catch (err) {
        setCertMsg({ type: 'warn', text: `Guardado. Certificación luego: ${err.message}` })
      }
    } else {
      setCertMsg({ type: 'info', text: 'Guardado en el teléfono. Se certifica al sincronizar.' })
      try {
        const queue = loadCertPending()
        queue.push(certPayload)
        saveCertPending(queue)
      } catch {
        /* ignore */
      }
    }

    setSaving(false)
  }

  const current = SCENES[scene] || SCENES[0]
  const cureSteps = [
    { id: 'fuego', icon: 'fuego', title: '1. Cuchillo al fuego', detail: 'Desinfecta antes de cortar' },
    { id: 'corte', icon: 'plantar', title: '2. Corte limpio', detail: 'Rizoma sin desgarrar' },
    { id: 'pasta', icon: 'pasta', title: '3. Pasta sanitaria', detail: 'Fungicida + bactericida + insecticida' },
    { id: 'sol', icon: 'sol', title: '4. Diez días al sol', detail: 'Cicatriza antes de enterrar' },
  ]

  return (
    <div className="practica-guia">
      {certMsg && (
        <div className={`m-toast ${certMsg.type === 'info' ? 'info' : certMsg.type}`}>{certMsg.text}</div>
      )}

      <header className="practica-hero">
        <button type="button" className="practica-back" onClick={() => navigate('/productor/andina')}>
          ← Volver a Guía
        </button>
        <p className="guia-kicker">Práctica de campo</p>
        <h2>Guía interactiva</h2>
        <p>Decides como en la chacra. Cada escena te dice qué está bien y qué conviene cambiar.</p>
        <div className="practica-score" aria-label="Avance">
          <div className="practica-score-bar">
            <i style={{ width: `${progressPct}%` }} />
          </div>
          <small>
            {apto ? 'Hijuelo OK' : 'Hijuelo…'} · {cureDone ? 'Curación OK' : 'Curación…'} ·{' '}
            {apisonOk ? 'Plantado OK' : 'Plantado…'}
          </small>
        </div>
      </header>

      <div className="practica-scenes" role="tablist" aria-label="Escenas">
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === scene}
            className={`practica-scene-btn ${i === scene ? 'on' : ''}`}
            onClick={() => setScene(i)}
          >
            <span className="practica-scene-ico" aria-hidden>
              <AppIcon name={s.icon} alt="" className="glyph-sm" />
            </span>
            <strong>{s.title}</strong>
          </button>
        ))}
      </div>

      <article className="m-card practica-panel">
        <div className="practica-panel-head">
          <span className="practica-scene-ico" aria-hidden>
            <AppIcon name={current.icon} alt="" className="glyph-md" />
          </span>
          <div>
            <span className="guia-num">
              Escena {scene + 1}/{SCENES.length}
            </span>
            <h3>{current.title}</h3>
            <p>{current.tip}</p>
          </div>
        </div>

        {scene === 0 && (
          <div className="practica-body">
            {parcelas.length > 0 && (
              <label className="practica-label">
                Lote donde vas a plantar
                <select
                  className="m-select"
                  value={form.parcela_id}
                  onChange={(e) => setForm({ ...form, parcela_id: e.target.value })}
                >
                  {parcelas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre || 'Lote'}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <p className="practica-ask">¿Cómo se siente la base al apretar?</p>
            <div className="practica-choice-row">
              <button
                type="button"
                className={`practica-choice good ${form.firmeza === 'firme' ? 'on' : ''}`}
                onClick={() => setForm({ ...form, firmeza: 'firme' })}
              >
                <span className="practica-scene-ico" aria-hidden>
                  <AppIcon name="firme" alt="" className="glyph-md" />
                </span>
                <strong>Firme</strong>
                <span>Duro, vivo, sin huecos</span>
              </button>
              <button
                type="button"
                className={`practica-choice bad ${form.firmeza === 'bofo' ? 'on' : ''}`}
                onClick={() => setForm({ ...form, firmeza: 'bofo' })}
              >
                <span className="practica-scene-ico" aria-hidden>
                  <AppIcon name="alerta" alt="" className="glyph-md" />
                </span>
                <strong>Bofo</strong>
                <span>Esponjoso · descartar</span>
              </button>
            </div>

            <div className="m-hero-num">
              <span>Edad de la madre · años {edadOk ? 'OK' : 'ideal 3–5'}</span>
              <Stepper
                value={form.edad_madre}
                min={1}
                max={12}
                step={0.5}
                decimals={1}
                onChange={(edad_madre) => setForm({ ...form, edad_madre })}
              />
            </div>
            <div className="m-hero-num">
              <span>Roseta · cm {rosetaOk ? 'OK' : 'ideal 8–11'}</span>
              <div className="m-ph-big">{rosetaVal.toFixed(1)}</div>
              <input
                type="range"
                min="4"
                max="15"
                step="0.1"
                value={form.roseta}
                onChange={(e) => setForm({ ...form, roseta: e.target.value })}
              />
            </div>
            <div className="m-hero-num">
              <span>Peso · kg {pesoOk ? 'OK' : 'ideal 1.5–3'}</span>
              <Stepper
                value={form.peso}
                min={0.5}
                max={5}
                step={0.1}
                decimals={1}
                onChange={(peso) => setForm({ ...form, peso })}
              />
            </div>

            <div className={`practica-verdict ${veredicto.nivel}`}>
              <strong>{veredicto.title}</strong>
              <p>{veredicto.text}</p>
            </div>
          </div>
        )}

        {scene === 1 && (
          <div className="practica-body">
            <p className="practica-ask">Haz los pasos en orden (como en la parcela):</p>
            <ol className="practica-seq">
              {cureSteps.map((step, idx) => {
                const done = packOrder.includes(step.id)
                const expected = ['fuego', 'corte', 'pasta', 'sol'][packOrder.length]
                const nextHint = !done && step.id === expected
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      className={`practica-seq-btn ${done ? 'done' : ''} ${nextHint ? 'next' : ''}`}
                      onClick={() => togglePack(step.id)}
                    >
                      <span className="practica-scene-ico" aria-hidden>
                        <AppIcon name={step.icon} alt="" className="glyph-sm" />
                      </span>
                      <span>
                        <strong>{step.title}</strong>
                        <small>{step.detail}</small>
                      </span>
                      <em>{done ? 'OK' : nextHint ? 'ahora' : idx + 1}</em>
                    </button>
                  </li>
                )
              })}
            </ol>
            <div className={`practica-verdict ${cureDone ? (cureOrderOk ? 'ok' : 'warn') : 'warn'}`}>
              <strong>
                {cureDone
                  ? cureOrderOk
                    ? 'Curación completa'
                    : 'Hecho, pero el orden ideal es fuego → corte → pasta → sol'
                  : `Avance ${cureScore}/4 · toca el paso marcado “ahora”`}
              </strong>
              <p>Enterrar fresco pudre la piña. El sol de 10 días es el seguro más barato del lote.</p>
            </div>
          </div>
        )}

        {scene === 2 && (
          <div className="practica-body">
            <div className="trazado-visual practica-field">
              <svg viewBox="0 0 320 140" width="100%" aria-hidden>
                {[40, 120, 200, 280].map((x) => (
                  <g key={x}>
                    <line x1={x} y1="16" x2={x} y2="118" stroke="#7cb342" strokeWidth="4" />
                    {[32, 62, 92].map((y) => (
                      <circle key={y} cx={x} cy={y} r="9" fill="#aed581" />
                    ))}
                  </g>
                ))}
                <text x="80" y="136" fill="#b45309" fontSize="12" fontWeight="700">
                  calle ~{ESPACIO_SURCO_M} m
                </text>
              </svg>
            </div>
            <div className="m-hero-num">
              <span>Distancia entre pencos</span>
              <div className="m-ph-big">{Number(dens.entre_plantas_m).toFixed(1)} m</div>
              <input
                type="range"
                min="1"
                max="1.5"
                step="0.1"
                value={form.entre_plantas_m}
                onChange={(e) => setForm({ ...form, entre_plantas_m: e.target.value })}
              />
              <p>
                Surcos a {ESPACIO_SURCO_M} m · dens. aprox. {Number(dens.plantas_por_ha).toLocaleString()}{' '}
                plantas/ha
              </p>
            </div>
            <p className="practica-ask">¿Qué metes en las calles el primer año?</p>
            <div className="practica-choice-row triple">
              {INTERCALADOS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`practica-choice ${form.intercalado === opt.id ? 'on' : ''}`}
                  onClick={() => setForm({ ...form, intercalado: opt.id })}
                >
                  <span className="practica-scene-ico" aria-hidden>
                    <AppIcon name={opt.icon} alt="" className="glyph-sm" />
                  </span>
                  <strong>{opt.label}</strong>
                </button>
              ))}
            </div>
            <div className="practica-verdict ok">
              <strong>Plata temprana mientras crece el penco</strong>
              <p>
                Las calles de ~{ESPACIO_SURCO_M} m no son espacio perdido: ahí va {form.intercalado} el primer
                año.
              </p>
            </div>
          </div>
        )}

        {scene === 3 && (
          <div className="practica-body">
            <div className="siembra-visual">
              <svg viewBox="0 0 280 160" width="100%" className="siembra-svg" aria-hidden>
                <rect x="0" y="100" width="280" height="60" fill="#5d4037" />
                <ellipse
                  cx="140"
                  cy={form.profundidad === '3/4' ? 92 : 82}
                  rx="40"
                  ry="30"
                  fill="#8d6e63"
                />
                <path d="M140 62 L118 12 L140 28 L162 10 Z" fill="#7cb342" />
                <path d="M140 64 L96 34 L136 48 Z" fill="#9ccc65" />
                <path d="M140 64 L184 32 L144 48 Z" fill="#9ccc65" />
                <text x="12" y="24" fill="#0d4f36" fontSize="13" fontWeight="700">
                  {form.profundidad === '3/4' ? '3/4 de la piña enterrada' : '1/2 piña (mínimo)'}
                </text>
              </svg>
            </div>
            <p className="practica-ask">¿Hasta dónde enterras la piña?</p>
            <div className="m-chip-row">
              <button
                type="button"
                className={`m-chip ${form.profundidad === '1/2' ? 'on' : ''}`}
                onClick={() => setForm({ ...form, profundidad: '1/2' })}
              >
                1/2 piña
              </button>
              <button
                type="button"
                className={`m-chip ${form.profundidad === '3/4' ? 'on' : ''}`}
                onClick={() => setForm({ ...form, profundidad: '3/4' })}
              >
                3/4 piña (recomendado)
              </button>
            </div>

            <p className="practica-ask">Apisona contra el viento — toca varias veces:</p>
            <button
              type="button"
              className={`practica-apison ${apisonOk ? 'done' : ''}`}
              onClick={pressApison}
            >
              <span className="practica-scene-ico lg" aria-hidden>
                <AppIcon name="apisonar" alt="" className="glyph-lg" />
              </span>
              <strong>{apisonOk ? 'Bien firme' : 'Toca para apisonar'}</strong>
              <div className="practica-apison-bar">
                <i style={{ width: `${apisonPress}%` }} />
              </div>
              <small>{apisonPress}% · el viento de Carchi tumba hijuelos flojos</small>
            </button>

            <div className={`practica-verdict ${plantReady ? 'ok' : 'warn'}`}>
              <strong>{plantReady ? 'Listo para guardar la planta' : 'Aún falta algo'}</strong>
              <p>
                {plantReady
                  ? 'Hijuelo bueno, curación hecha y tierra apisonada.'
                  : 'Completa hijuelo apto, los 4 pasos de curación y el apisonado al 100%.'}
              </p>
            </div>
          </div>
        )}

        <div className="m-nav-btns">
          {scene > 0 && (
            <button type="button" className="m-btn ghost" onClick={() => setScene(scene - 1)}>
              Anterior
            </button>
          )}
          {scene < SCENES.length - 1 ? (
            <button type="button" className="m-btn" onClick={() => setScene(scene + 1)}>
              Siguiente escena
            </button>
          ) : (
            <button type="button" className="m-btn" disabled={saving} onClick={finish}>
              {saving ? 'Guardando…' : 'Guardar planta'}
            </button>
          )}
        </div>
      </article>

      <div className="practica-footer-actions">
        <button type="button" className="m-btn ghost" onClick={() => navigate('/productor/anotar')}>
          Ir a registrar lote
        </button>
        <button type="button" className="m-btn ghost" onClick={() => navigate('/productor/andina')}>
          Leer la guía escrita
        </button>
      </div>
    </div>
  )
}
