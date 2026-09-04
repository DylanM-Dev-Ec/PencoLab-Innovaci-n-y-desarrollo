import { useEffect, useMemo, useState } from 'react'
import { pushPlanAccion } from '../api'
import { AppIcon } from '../components/AppIcon'
import { HA_META, META_CO2_TON } from '../agaveAndino'

const USD_POR_PLANTA_MADUREZ = 160
const CO2_TON_POR_HA = 5
/** Lote de referencia: 3 ha → 3 000 plantas */
export const DENSIDAD_ACTUAL_HA = 1000
/** Método de trazado alta densidad (1.5 m × 3 m ≈ 2 222/ha) */
export const DENSIDAD_ALTA_HA = 2222

const INTERCALADOS = [
  {
    id: 'papa',
    label: 'Papas del Carchi',
    usd_ha_6m: 1200,
    icon: 'papa',
    hint: 'Ingreso temprano en calles de 3 m · primera cosecha ~6 meses',
  },
  {
    id: 'quinoa',
    label: 'Quinoa',
    usd_ha_6m: 950,
    icon: 'quinoa',
    hint: 'Buen acompañante en altura; no compite con la raíz del penco',
  },
  {
    id: 'chocho',
    label: 'Chocho',
    usd_ha_6m: 800,
    icon: 'chocho',
    hint: 'Fija nitrógeno y mejora el suelo mientras madura el penco',
  },
]

/** Escenarios de pérdida (plantas que no llegan a madurez). */
const MORTALIDAD = [
  {
    id: 'tradicional',
    label: 'Sin protocolo',
    pct: 30,
    tip: 'Sin desinfección ni cicatrización: muchas piñas se pudren o se secan.',
  },
  {
    id: 'cuidado',
    label: 'Con guía básica',
    pct: 12,
    tip: 'Corte limpio, sol 10 días y riego parco: bajas bastante la pérdida.',
  },
  {
    id: 'certificado',
    label: 'Método certificado',
    pct: 4,
    tip: 'Fuego + pasta + cicatriz + trazado 3 m: la meta del protocolo (~4%).',
  },
]

const PLANES_KEY = 'pencolab_planes_accion_v1'

function loadPendingPlanes() {
  try {
    const raw = localStorage.getItem(PLANES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function savePendingPlanes(list) {
  localStorage.setItem(PLANES_KEY, JSON.stringify(list))
}

/** Une planes del store con la cola offline y elimina duplicados. */
export function enqueuePlanesFromStore(planes = []) {
  const queue = loadPendingPlanes()
  const byId = new Map(queue.map((p) => [p.id, p]))
  for (const p of planes) {
    if (!p?.id || p.synced_at) continue
    if (!byId.has(p.id)) byId.set(p.id, p)
  }
  const next = [...byId.values()]
  savePendingPlanes(next)
  return next
}

/**
 * Intenta enviar planes pendientes.
 * @returns {{ remaining: object[], syncedIds: string[] }}
 */
export async function flushPlanesAccion(token, planesFromStore = []) {
  const queue = enqueuePlanesFromStore(planesFromStore)
  if (!queue.length || !token) return { remaining: queue, syncedIds: [] }
  const remaining = []
  const syncedIds = []
  for (const plan of queue) {
    try {
      await pushPlanAccion(plan, token)
      syncedIds.push(plan.id)
    } catch {
      remaining.push(plan)
    }
  }
  savePendingPlanes(remaining)
  return { remaining, syncedIds }
}

/**
 * Calculadora de plan de acción — guía para maximizar ingreso con pérdidas.
 */
export default function CalculadoraRiquezaFutura({ data, onAdd, online, setMsg }) {
  const [ha, setHa] = useState(3)
  const [densidadId, setDensidadId] = useState('alta')
  const [intercaladoId, setIntercaladoId] = useState('papa')
  const [mortalidadPct, setMortalidadPct] = useState(12)
  const [pulse, setPulse] = useState(0)
  const [saving, setSaving] = useState(false)

  const intercalado = INTERCALADOS.find((i) => i.id === intercaladoId) || INTERCALADOS[0]
  const mortPreset = MORTALIDAD.find((m) => m.pct === mortalidadPct)
  const mortTip =
    mortPreset?.tip ||
    (mortalidadPct <= 5
      ? 'Mortalidad baja: mantén el protocolo de corte, sol y riego parco.'
      : mortalidadPct <= 15
        ? 'Mortalidad media: revisa cicatrización y desinfección para bajarla.'
        : 'Mortalidad alta: sin protocolo pierdes muchas plantas y mucho ingreso.')
  const plantasPorHa = densidadId === 'alta' ? DENSIDAD_ALTA_HA : DENSIDAD_ACTUAL_HA

  const calc = useMemo(() => {
    const sembradas = Math.round(ha * plantasPorHa)
    const vivos = Math.round(sembradas * (1 - mortalidadPct / 100))
    const muertas = Math.max(0, sembradas - vivos)
    const ingresoIdeal = sembradas * USD_POR_PLANTA_MADUREZ
    const ingresoPenco = vivos * USD_POR_PLANTA_MADUREZ
    const perdidaUsd = muertas * USD_POR_PLANTA_MADUREZ
    const ingresoCorto = Math.round(ha * intercalado.usd_ha_6m)
    const total = ingresoPenco + ingresoCorto
    const co2Ton = Number(((vivos / Math.max(plantasPorHa, 1)) * CO2_TON_POR_HA).toFixed(1))
    const pctCo2 = Math.min(100, (co2Ton / META_CO2_TON) * 100)
    const pctHa = Math.min(100, (ha / HA_META) * 100)

    const vivosCert = Math.round(sembradas * (1 - 4 / 100))
    const ingresoCert = vivosCert * USD_POR_PLANTA_MADUREZ + ingresoCorto
    const gananciaVsActual = ingresoCert - total

    const tips = []
    if (densidadId !== 'alta') {
      tips.push({
        id: 'densidad',
        text: `Pasa a alta densidad (${DENSIDAD_ALTA_HA.toLocaleString()}/ha): más plantas vivas por hectárea sin ahogar el lote.`,
      })
    }
    if (mortalidadPct > 4) {
      tips.push({
        id: 'mort',
        text: `Baja la mortalidad hacia ~4% (fuego, pasta, 10 días al sol): recuperas unos $${perdidaUsd.toLocaleString()} que hoy se pierden.`,
      })
    }
    tips.push({
      id: 'inter',
      text: `Mantén ${intercalado.label} en las calles el primer año: ~$${ingresoCorto.toLocaleString()} mientras el penco crece.`,
    })
    tips.push({
      id: 'riego',
      text: 'Riego parco y poda solo de hojas secas: menos pudrición y menos puente para plagas.',
    })

    return {
      sembradas,
      vivos,
      muertas,
      ingresoIdeal,
      ingresoPenco,
      perdidaUsd,
      ingresoCorto,
      total,
      co2Ton,
      pctCo2,
      pctHa,
      gananciaVsActual,
      tips,
    }
  }, [ha, plantasPorHa, intercalado, mortalidadPct, densidadId])

  useEffect(() => {
    setPulse((p) => p + 1)
  }, [ha, densidadId, intercaladoId, mortalidadPct])

  async function generarPlan() {
    setSaving(true)
    const hoy = new Date().toISOString().slice(0, 10)
    const plan = {
      id: crypto.randomUUID(),
      productor_id: data?.session?.productor_id || null,
      hectareas_planificadas: ha,
      cultivo_intercalado_elegido: intercalado.id,
      cultivo_intercalado_label: intercalado.label,
      latitud_inicial: null,
      longitud_inicial: null,
      fecha_inicio_plan: hoy,
      densidad_plantas_ha: plantasPorHa,
      plantas_totales: calc.sembradas,
      plantas_vivas_estimadas: calc.vivos,
      mortalidad_pct: mortalidadPct,
      plantas_perdidas_estimadas: calc.muertas,
      ingreso_penco_usd: calc.ingresoPenco,
      ingreso_perdida_mortalidad_usd: calc.perdidaUsd,
      ingreso_intercalado_6m_usd: calc.ingresoCorto,
      co2_mitigado_ton: calc.co2Ton,
      created_at: new Date().toISOString(),
      synced_at: null,
      estado: 'planificado',
    }

    const previos = data?.planes_accion || []
    onAdd?.({ planes_accion: [...previos, plan] })

    const queue = loadPendingPlanes()
    queue.push(plan)
    savePendingPlanes(queue)

    try {
      if (online && data?.session?.access_token) {
        const res = await pushPlanAccion(plan, data.session.access_token)
        const rest = loadPendingPlanes().filter((p) => p.id !== plan.id)
        savePendingPlanes(rest)
        const enriched = {
          ...plan,
          synced_at: new Date().toISOString(),
          estado: res?.estado || 'planificado',
          proyeccion_financiera: res?.proyeccion_financiera,
          proyeccion_carbono: res?.proyeccion_carbono,
        }
        onAdd?.({
          planes_accion: [...previos, enriched],
        })
        setMsg?.({ type: 'success', text: 'Plan de siembra guardado y enviado.' })
      } else {
        setMsg?.({
          type: 'success',
          text: 'Plan guardado sin red. Se sincronizará al recuperar conexión.',
        })
      }
    } catch {
      setMsg?.({
        type: 'warn',
        text: 'Plan guardado sin red. Se enviará al recuperar conexión.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="riqueza-screen">
      <header className="riqueza-hero">
        <AppIcon name="plata" alt="" className="glyph-lg" />
        <p className="riqueza-kicker">Plan de acción · maximizar ingreso</p>
        <h2>¿Cómo gano más con mi lote?</h2>
        <p>
          Ajusta hectáreas, densidad, intercalado y pérdida de plantas. El ingreso del penco solo
          cuenta las que llegan vivas a madurez.
        </p>
      </header>

      <section className="m-card riqueza-pasos">
        <h3>Pasos para maximizar</h3>
        <ol>
          <li>
            <strong>Densidad alta</strong> (1.5 m × 3 m) → más plantas por hectárea.
          </li>
          <li>
            <strong>Baja mortalidad</strong> con protocolo (fuego, pasta, 10 días al sol).
          </li>
          <li>
            <strong>Intercalado</strong> en calles el primer año → ingreso temprano.
          </li>
          <li>
            <strong>Riego parco y poda sanitaria</strong> → menos pudrición y plagas.
          </li>
        </ol>
      </section>

      <section className="m-card riqueza-inputs">
        <div className="m-hero-num">
          <span>Hectáreas disponibles</span>
          <div className="m-ph-big">{ha}</div>
          <input
            type="range"
            min={1}
            max={HA_META}
            step={0.5}
            value={ha}
            onChange={(e) => setHa(parseFloat(e.target.value))}
            aria-label="Hectáreas"
          />
          <div className="riqueza-ha-scale">
            <span>1 ha</span>
            <span>Meta {HA_META} ha</span>
          </div>
        </div>

        <p className="riqueza-label">1. Densidad de plantación</p>
        <div className="m-chip-row">
          <button
            type="button"
            className={`m-chip ${densidadId === 'actual' ? 'on' : ''}`}
            onClick={() => setDensidadId('actual')}
          >
            Actual · {DENSIDAD_ACTUAL_HA.toLocaleString()}/ha
          </button>
          <button
            type="button"
            className={`m-chip ${densidadId === 'alta' ? 'on' : ''}`}
            onClick={() => setDensidadId('alta')}
          >
            Alta · {DENSIDAD_ALTA_HA.toLocaleString()}/ha
          </button>
        </div>
        <p className="riqueza-hint">
          {densidadId === 'actual'
            ? 'Referencia baja (1 000/ha). Para maximizar, conviene alta densidad.'
            : 'Trazado 1.5 m × 3 m ≈ 2 222/ha: más ingreso por hectárea si cuidas la supervivencia.'}
        </p>

        <p className="riqueza-label">2. Pérdida por plantas muertas</p>
        <div className="riqueza-mort-row">
          {MORTALIDAD.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`riqueza-mort ${mortalidadPct === m.pct ? 'on' : ''}`}
              onClick={() => setMortalidadPct(m.pct)}
            >
              <strong>{m.label}</strong>
              <span>{m.pct}% mortalidad</span>
            </button>
          ))}
        </div>
        <p className="riqueza-hint">{mortTip}</p>

        <div className="m-hero-num riqueza-mort-slider">
          <span>Ajuste fino · mortalidad {mortalidadPct}%</span>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={mortalidadPct}
            onChange={(e) => setMortalidadPct(parseInt(e.target.value, 10))}
            aria-label="Porcentaje de mortalidad"
          />
          <div className="riqueza-ha-scale">
            <span>0% (ideal)</span>
            <span>40% (malo)</span>
          </div>
        </div>
        <p className="riqueza-hint soft">
          El ingreso del penco se calcula solo con plantas vivas. Las muertas restan ~$
          {USD_POR_PLANTA_MADUREZ} c/u.
        </p>

        <p className="riqueza-label">3. Cultivo intercalado (calles de 3 m)</p>
        <div className="riqueza-crops">
          {INTERCALADOS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`riqueza-crop ${intercaladoId === c.id ? 'on' : ''}`}
              onClick={() => setIntercaladoId(c.id)}
            >
              <AppIcon name={c.icon} alt="" className="glyph-md" />
              <strong>{c.label}</strong>
              <span>~${c.usd_ha_6m}/ha · 6 meses</span>
            </button>
          ))}
        </div>
        <p className="riqueza-hint">{intercalado.hint}</p>
      </section>

      <div className="riqueza-results" key={pulse}>
        <article className="riqueza-card anim">
          <span className="riqueza-card-label">Sembradas</span>
          <strong>{calc.sembradas.toLocaleString()}</strong>
          <small>
            {ha} ha × {plantasPorHa.toLocaleString()}/ha
          </small>
        </article>

        <article className="riqueza-card anim delay-1 good">
          <span className="riqueza-card-label">Vivas a madurez</span>
          <strong>{calc.vivos.toLocaleString()}</strong>
          <small>Tras {mortalidadPct}% de pérdida</small>
        </article>

        <article className="riqueza-card anim delay-1 warn">
          <span className="riqueza-card-label">Muertas / pérdida</span>
          <strong>{calc.muertas.toLocaleString()}</strong>
          <small>≈ −${calc.perdidaUsd.toLocaleString()} USD</small>
        </article>

        <article className="riqueza-card anim delay-2 highlight">
          <span className="riqueza-card-label">Ingreso penco (solo vivas)</span>
          <strong>${calc.ingresoPenco.toLocaleString()}</strong>
          <small>
            {calc.vivos.toLocaleString()} × ${USD_POR_PLANTA_MADUREZ}
          </small>
        </article>

        <article className="riqueza-card anim delay-2">
          <span className="riqueza-card-label">Corto plazo · {intercalado.label}</span>
          <strong>${calc.ingresoCorto.toLocaleString()}</strong>
          <small>Estimado primeros 6 meses</small>
        </article>

        <article className="riqueza-card anim delay-3 clima">
          <span className="riqueza-card-label">CO₂ (plantas vivas)</span>
          <strong>
            {calc.co2Ton.toFixed(1)} <em>t</em>
          </strong>
          <div className="riqueza-meter tall">
            <div className="riqueza-meter-bar">
              <i style={{ width: `${calc.pctCo2}%` }} />
            </div>
          </div>
          <small>
            Meta comunitaria {META_CO2_TON} t ({calc.pctCo2.toFixed(0)}%)
          </small>
        </article>
      </div>

      <div className="riqueza-total anim delay-4">
        <span>Ingreso estimado (vivas + intercalado)</span>
        <strong>${calc.total.toLocaleString()} USD</strong>
        <small>
          Sin contar ${calc.perdidaUsd.toLocaleString()} perdidos por mortalidad. Ideal sin pérdidas: $
          {(calc.ingresoIdeal + calc.ingresoCorto).toLocaleString()}.
        </small>
      </div>

      {calc.gananciaVsActual > 0 && mortalidadPct > 4 && (
        <div className="riqueza-upside">
          Si bajas la mortalidad a 4% (método certificado), podrías sumar unos{' '}
          <strong>${calc.gananciaVsActual.toLocaleString()}</strong> al plan actual.
        </div>
      )}

      <section className="m-card riqueza-tips">
        <h3>Qué hacer ahora</h3>
        <ul>
          {calc.tips.map((t) => (
            <li key={t.id}>{t.text}</li>
          ))}
        </ul>
      </section>

      <button type="button" className="m-btn riqueza-cta" disabled={saving} onClick={generarPlan}>
        {saving ? 'Guardando plan…' : 'Guardar mi plan de siembra'}
      </button>
      <p className="riqueza-offline-hint">
        Se guarda en el dispositivo. Al recuperar conexión se envía al servidor.
      </p>

      {(data?.planes_accion || []).length > 0 && (
        <section className="riqueza-historial">
          <h3>Planes guardados</h3>
          {[...(data.planes_accion || [])].reverse().slice(0, 3).map((p) => (
            <div key={p.id} className="riqueza-hist-item">
              <strong>
                {p.hectareas_planificadas ?? p.hectareas} ha ·{' '}
                {(p.plantas_vivas_estimadas || p.plantas_totales)?.toLocaleString?.() || p.plantas_totales}{' '}
                vivas
              </strong>
              <span>
                $
                {Number(p.ingreso_penco_usd || 0).toLocaleString()} penco
                {p.mortalidad_pct != null ? ` · ${p.mortalidad_pct}% mort.` : ''} ·{' '}
                {p.cultivo_intercalado_label || p.cultivo_intercalado_elegido} ·{' '}
                {p.estado || (p.synced_at ? 'enviado' : 'pendiente sync')}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
