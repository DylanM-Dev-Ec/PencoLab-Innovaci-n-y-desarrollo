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
    hint: 'Ingreso rápido en calles de 3 m · primera cosecha ~6 meses',
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
 * Calculadora de riqueza futura — plan de acción personalizado del agricultor.
 * React móvil (portal productor); equivalente funcional a RN.
 */
export default function CalculadoraRiquezaFutura({ data, onAdd, online, setMsg }) {
  const [ha, setHa] = useState(3)
  const [densidadId, setDensidadId] = useState('actual') // actual | alta
  const [intercaladoId, setIntercaladoId] = useState('papa')
  const [pulse, setPulse] = useState(0)
  const [saving, setSaving] = useState(false)

  const intercalado = INTERCALADOS.find((i) => i.id === intercaladoId) || INTERCALADOS[0]
  const plantasPorHa = densidadId === 'alta' ? DENSIDAD_ALTA_HA : DENSIDAD_ACTUAL_HA

  const calc = useMemo(() => {
    const plantas = Math.round(ha * plantasPorHa)
    const ingresoPenco = plantas * USD_POR_PLANTA_MADUREZ
    const ingresoCorto = Math.round(ha * intercalado.usd_ha_6m)
    const co2Ton = ha * CO2_TON_POR_HA
    const pctCo2 = Math.min(100, (co2Ton / META_CO2_TON) * 100)
    const pctHa = Math.min(100, (ha / HA_META) * 100)
    return { plantas, ingresoPenco, ingresoCorto, co2Ton, pctCo2, pctHa, totalCortoLargo: ingresoPenco + ingresoCorto }
  }, [ha, plantasPorHa, intercalado])

  useEffect(() => {
    setPulse((p) => p + 1)
  }, [ha, densidadId, intercaladoId])

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
      plantas_totales: calc.plantas,
      ingreso_penco_usd: calc.ingresoPenco,
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
        setMsg?.({ type: 'success', text: 'Plan certificado guardado y enviado.' })
      } else {
        setMsg?.({
          type: 'success',
          text: 'Plan guardado offline. Se sincronizará al recuperar internet.',
        })
      }
    } catch {
      setMsg?.({
        type: 'warn',
        text: 'Plan guardado offline. Se enviará al recuperar internet.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="riqueza-screen">
      <header className="riqueza-hero">
        <AppIcon name="plata" alt="" className="glyph-lg" />
        <p className="riqueza-kicker">Plan de acción · riqueza futura</p>
        <h2>Diseña tu lote</h2>
        <p>De 1 a {HA_META} ha · penco + calles intercaladas · carbono hacia {META_CO2_TON} t</p>
      </header>

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
          <div className="riqueza-meter">
            <div className="riqueza-meter-bar">
              <i style={{ width: `${calc.pctHa}%` }} />
            </div>
            <small>{calc.pctHa.toFixed(0)}% del objetivo comunitario</small>
          </div>
        </div>

        <p className="riqueza-label">Densidad de plantación</p>
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
            Alta densidad · {DENSIDAD_ALTA_HA.toLocaleString()}/ha
          </button>
        </div>
        <p className="riqueza-hint">
          {densidadId === 'actual'
            ? 'Referencia del lote actual: 3 000 plantas en 3 ha (1 000/ha).'
            : 'Trazado 1.5 m × 3 m ≈ 2 222 plantas/ha (método de alta densidad).'}
        </p>

        <p className="riqueza-label">Cultivo intercalado (calles de 3 m)</p>
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
          <span className="riqueza-card-label">Densidad · plantas</span>
          <strong>{calc.plantas.toLocaleString()}</strong>
          <small>
            {ha} ha × {plantasPorHa.toLocaleString()}/ha
          </small>
        </article>

        <article className="riqueza-card anim delay-1 highlight">
          <span className="riqueza-card-label">Ingreso futuro · penco</span>
          <strong>${calc.ingresoPenco.toLocaleString()}</strong>
          <small>
            {calc.plantas.toLocaleString()} × ${USD_POR_PLANTA_MADUREZ} chawarmishky maduro
          </small>
        </article>

        <article className="riqueza-card anim delay-2">
          <span className="riqueza-card-label">Corto plazo · {intercalado.label}</span>
          <strong>${calc.ingresoCorto.toLocaleString()}</strong>
          <small>Estimado primeros 6 meses en calles</small>
        </article>

        <article className="riqueza-card anim delay-3 clima">
          <span className="riqueza-card-label">Lucha climática · CO₂</span>
          <strong>
            {calc.co2Ton.toFixed(1)} <em>t</em>
          </strong>
          <div className="riqueza-meter tall">
            <div className="riqueza-meter-bar">
              <i style={{ width: `${calc.pctCo2}%` }} />
            </div>
          </div>
          <small>
            {ha} × {CO2_TON_POR_HA} t/ha · meta comunitaria {META_CO2_TON} t ({calc.pctCo2.toFixed(0)}%)
          </small>
        </article>
      </div>

      <div className="riqueza-total anim delay-4">
        <span>Proyección combinada</span>
        <strong>${calc.totalCortoLargo.toLocaleString()} USD</strong>
        <small>Corto plazo + madurez del penco (estimado)</small>
      </div>

      <button type="button" className="m-btn riqueza-cta" disabled={saving} onClick={generarPlan}>
        {saving ? 'Guardando plan…' : 'Generar mi Plan de Acción de Siembra Certificado'}
      </button>
      <p className="riqueza-offline-hint">
        Se guarda en el teléfono ya. Al recuperar internet se envía al backend.
      </p>

      {(data?.planes_accion || []).length > 0 && (
        <section className="riqueza-historial">
          <h3>Planes guardados</h3>
          {[...(data.planes_accion || [])].reverse().slice(0, 3).map((p) => (
            <div key={p.id} className="riqueza-hist-item">
              <strong>
                {p.hectareas_planificadas ?? p.hectareas} ha ·{' '}
                {(p.proyeccion_financiera?.plantas_totales || p.plantas_totales)?.toLocaleString?.() ||
                  p.plantas_totales}{' '}
                plantas
              </strong>
              <span>
                $
                {Number(
                  p.proyeccion_financiera?.ingreso_penco_madurez_usd || p.ingreso_penco_usd || 0
                ).toLocaleString()}{' '}
                penco · {p.cultivo_intercalado_label || p.cultivo_intercalado_elegido} ·{' '}
                {p.estado || (p.synced_at ? 'enviado' : 'pendiente sync')}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
