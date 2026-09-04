import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AppIcon } from '../components/AppIcon'

const COLORS = {
  forest: '#0d4f36',
  forestMid: '#146c48',
  teal: '#2a7a5c',
  slate: '#475569',
  slateSoft: '#64748b',
  gray: '#94a3b8',
  line: '#e4ebe6',
  paper: '#ffffff',
  canvas: '#f3f6f4',
  warn: '#c9782a',
  danger: '#b91c1c',
  optimoFill: 'rgba(13, 79, 54, 0.08)',
}

/** Rango óptimo de humedad a 20 cm para penco (riego parco). */
export const HUMEDAD_OPTIMA = { min: 30, max: 55 }
const HUMEDAD_ENCHARQUE = 80
const HUMEDAD_SEQUIA = 20

/** Meses 0–11. Lluvias: jun–sep. Seca: oct–may. */
export function esEpocaLluvias(monthIndex = new Date().getMonth()) {
  return monthIndex >= 5 && monthIndex <= 8 // jun=5 … sep=8
}

/**
 * Intervalo recomendado (días) para reponer ~20 mm en temporada seca.
 * Mar–abr: 5 · Ene: 7 · resto seca: según mes.
 */
export function intervaloRiegoDias(monthIndex = new Date().getMonth()) {
  const m = monthIndex
  if (m === 2 || m === 3) return 5 // marzo, abril
  if (m === 0) return 7 // enero
  if (m === 1) return 6 // febrero
  if (m === 4) return 5 // mayo
  if (m === 9) return 7 // octubre
  if (m === 10) return 6 // noviembre
  if (m === 11) return 7 // diciembre
  return null // lluvias: sin intervalo
}

function nombreMes(monthIndex) {
  return [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ][monthIndex]
}

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n))
}

function buildHistorial7d(humedadActual) {
  const hoy = new Date()
  const base = clamp(humedadActual, 12, 92)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hoy)
    d.setDate(hoy.getDate() - (6 - i))
    const drift = Math.sin(i * 0.9) * 8 + (i - 3) * 1.2
    const humedad = Math.round(clamp(base - 10 + drift + (i === 6 ? 0 : (i % 2) * 3), 10, 95))
    return {
      dia: d.toLocaleDateString('es-EC', { weekday: 'short' }).replace('.', ''),
      fecha: d.toISOString().slice(0, 10),
      humedad: i === 6 ? Math.round(base) : humedad,
      optimoMin: HUMEDAD_OPTIMA.min,
      optimoMax: HUMEDAD_OPTIMA.max,
    }
  })
}

/** Simulación de sensor a 20 cm (valores vivos + leve ruido). */
function leerSensorSimulado(humedadOverride) {
  const h =
    humedadOverride != null
      ? humedadOverride
      : clamp(38 + Math.sin(Date.now() / 40000) * 12 + (Math.random() - 0.5) * 4, 8, 95)
  return {
    humedad: Math.round(h * 10) / 10,
    temperaturaC: Math.round((18 + (h - 40) * 0.04 + Math.random() * 1.2) * 10) / 10,
    salinidadDsM: Math.round((0.85 + (h > 70 ? 0.25 : 0) + Math.random() * 0.15) * 100) / 100,
    profundidadCm: 20,
    actualizado: new Date(),
  }
}

function RingHumedad({ value, critico, sequia, optimo }) {
  const size = 168
  const stroke = 12
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = clamp(Number(value) || 0, 0, 100)
  const offset = c - (pct / 100) * c
  const color = critico ? COLORS.danger : sequia ? COLORS.warn : optimo ? COLORS.forest : COLORS.teal

  return (
    <div className="riego-ring" aria-label={`Humedad del suelo ${pct}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e8eee9"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div className="riego-ring-label">
        <strong style={{ color }}>{pct.toFixed(0)}%</strong>
        <span>Humedad a 20 cm</span>
      </div>
    </div>
  )
}

/**
 * Riego inteligente — sensores de humedad a 20 cm + alertas agronómicas del penco.
 * (UI móvil React; misma experiencia que el resto de la app del productor.)
 */
export default function RiegoInteligenteScreen() {
  const month = new Date().getMonth()
  const lluvias = esEpocaLluvias(month)
  const intervalo = intervaloRiegoDias(month)

  const [manualHumedad, setManualHumedad] = useState(null)
  const [sensor, setSensor] = useState(() => leerSensorSimulado(42))

  useEffect(() => {
    const tick = () => setSensor(leerSensorSimulado(manualHumedad))
    tick()
    const id = setInterval(tick, 4000)
    return () => clearInterval(id)
  }, [manualHumedad])

  const humedad = sensor.humedad
  const encharque = humedad > HUMEDAD_ENCHARQUE
  const sequia = !lluvias && humedad < HUMEDAD_SEQUIA
  const enOptimo = humedad >= HUMEDAD_OPTIMA.min && humedad <= HUMEDAD_OPTIMA.max

  const historial = useMemo(() => buildHistorial7d(humedad), [humedad])

  const estadoTxt = lluvias
    ? 'Época de lluvias · riego suspendido'
    : encharque
      ? 'Riesgo de encharcamiento'
      : sequia
        ? 'Sequía extrema'
        : enOptimo
          ? 'Zona óptima'
          : 'Fuera de rango óptimo'

  return (
    <div className="riego-screen">
      <header className="riego-hero">
        <p className="riego-kicker">Sensores · 20 cm de profundidad</p>
        <h2>Riego inteligente</h2>
        <p>
          Lectura simulada de humedad, temperatura y salinidad del suelo. El penco necesita riego
          parco: húmedo, nunca encharcado.
        </p>
        <div className="riego-live">
          <i className="riego-dot" aria-hidden />
          <span>
            Sensor activo · actualizado{' '}
            {sensor.actualizado.toLocaleTimeString('es-EC', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        </div>
      </header>

      <section className="riego-card riego-status">
        <div className="riego-status-top">
          <RingHumedad value={humedad} critico={encharque} sequia={sequia} optimo={enOptimo} />
          <div className="riego-status-meta">
            <span className="riego-chip" data-tone={encharque ? 'danger' : sequia ? 'warn' : lluvias ? 'rain' : 'ok'}>
              {estadoTxt}
            </span>
            <p>
              Profundidad de sonda: <strong>{sensor.profundidadCm} cm</strong>
            </p>
            <p>
              Mes actual: <strong>{nombreMes(month)}</strong>
              {lluvias ? ' · lluvias' : ' · temporada seca'}
            </p>
            {!lluvias && intervalo != null && (
              <p>
                Intervalo tip: cada <strong>{intervalo} días</strong> · lámina neta ~20 mm
              </p>
            )}
          </div>
        </div>

        <div className="riego-readings">
          <article className="riego-mini">
            <AppIcon name="sol" alt="" className="glyph-sm" />
            <div>
              <span>Temperatura del suelo</span>
              <strong>{sensor.temperaturaC} °C</strong>
            </div>
          </article>
          <article className="riego-mini">
            <AppIcon name="tierra" alt="" className="glyph-sm" />
            <div>
              <span>Salinidad (CE)</span>
              <strong>{sensor.salinidadDsM} dS/m</strong>
            </div>
          </article>
        </div>
      </section>

      {/* Banners dinámicos */}
      {encharque && (
        <aside className="riego-banner danger" role="alert">
          <AppIcon name="encharque" alt="" className="glyph-md" />
          <div>
            <strong>Peligro de encharcamiento a 20 cm</strong>
            <p>
              Apague el riego por goteo de inmediato para evitar la asfixia y pudrición de las raíces
              del penco.
            </p>
          </div>
        </aside>
      )}

      {lluvias && (
        <aside className="riego-banner rain" role="status">
          <AppIcon name="riego" alt="" className="glyph-md" />
          <div>
            <strong>Época de lluvias activa</strong>
            <p>Riego suspendido automáticamente por alta precipitación.</p>
          </div>
        </aside>
      )}

      {!lluvias && sequia && (
        <aside className="riego-banner warn" role="alert">
          <AppIcon name="riego" alt="" className="glyph-md" />
          <div>
            <strong>Sequía extrema · temporada seca</strong>
            <p>
              Active el riego por goteo para reponer la lámina neta de 20 mm. Intervalo recomendado en{' '}
              {nombreMes(month)}: cada {intervalo} días.
            </p>
          </div>
        </aside>
      )}

      {!lluvias && !encharque && !sequia && (
        <aside className="riego-banner ok" role="status">
          <AppIcon name="check" alt="" className="glyph-sm" />
          <div>
            <strong>Sin alerta crítica</strong>
            <p>
              Mantenga el riego comedido. Zona segura de humedad: {HUMEDAD_OPTIMA.min}–{HUMEDAD_OPTIMA.max}%
              a 20 cm.
            </p>
          </div>
        </aside>
      )}

      <section className={`riego-card ${lluvias ? 'is-disabled' : ''}`}>
        <div className="riego-card-head">
          <h3>Control de goteo</h3>
          <span>{lluvias ? 'Bloqueado' : 'Disponible'}</span>
        </div>
        <div className="riego-actions">
          <button type="button" className="riego-btn primary" disabled={lluvias || encharque}>
            <AppIcon name="riego" alt="" className="glyph-xs" />
            Activar goteo (20 mm)
          </button>
          <button type="button" className="riego-btn ghost" disabled={lluvias}>
            Apagar goteo
          </button>
        </div>
        {lluvias && (
          <p className="riego-disabled-hint">
            Sugerencias de riego deshabilitadas en junio–septiembre.
          </p>
        )}
      </section>

      <section className="riego-card">
        <div className="riego-card-head">
          <h3>Humedad · últimos 7 días</h3>
          <span style={{ color: COLORS.forest }}>
            Óptimo {HUMEDAD_OPTIMA.min}–{HUMEDAD_OPTIMA.max}%
          </span>
        </div>
        <div className="riego-chart">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={historial} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="dia"
                stroke={COLORS.gray}
                tick={{ fill: COLORS.slateSoft, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                stroke={COLORS.gray}
                tick={{ fill: COLORS.slateSoft, fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: `1px solid ${COLORS.line}`,
                  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                }}
                formatter={(v) => [`${v}%`, 'Humedad']}
              />
              <ReferenceArea
                y1={HUMEDAD_OPTIMA.min}
                y2={HUMEDAD_OPTIMA.max}
                fill={COLORS.optimoFill}
                strokeOpacity={0}
              />
              <ReferenceLine
                y={HUMEDAD_OPTIMA.min}
                stroke={COLORS.forest}
                strokeDasharray="4 4"
                strokeOpacity={0.55}
              />
              <ReferenceLine
                y={HUMEDAD_OPTIMA.max}
                stroke={COLORS.forest}
                strokeDasharray="4 4"
                strokeOpacity={0.55}
              />
              <Line
                type="monotone"
                dataKey="humedad"
                stroke={COLORS.forestMid}
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: COLORS.forest, stroke: '#fff', strokeWidth: 1.5 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="riego-card riego-sim">
        <div className="riego-card-head">
          <h3>Simular lectura del sensor</h3>
          <span>Prueba alertas</span>
        </div>
        <label className="riego-slider">
          <span>Humedad a 20 cm · {Math.round(manualHumedad ?? humedad)}%</span>
          <input
            type="range"
            min={5}
            max={95}
            step={1}
            value={Math.round(manualHumedad ?? humedad)}
            onChange={(e) => setManualHumedad(Number(e.target.value))}
            aria-label="Simular humedad del suelo"
          />
        </label>
        <button
          type="button"
          className="riego-btn ghost wide"
          onClick={() => setManualHumedad(null)}
        >
          Volver a sensor automático
        </button>
      </section>
    </div>
  )
}
