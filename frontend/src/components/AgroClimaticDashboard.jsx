import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CloudRain,
  Droplets,
  HelpCircle,
  Leaf,
  Snowflake,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react'

const DAY_OPT = { min: 15, max: 26 }
const NIGHT_OPT = { min: 10, max: 15 }
const FROST_WARN_C = 3
const RAIN_SURVIVAL_MM = 400
const RAIN_OPTIMAL_MM = 1000

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Calendario oficial de lluvias altas (jun–sep). */
export function esTemporadaLluvias(monthIndex) {
  return monthIndex >= 5 && monthIndex <= 8
}

/** Intervalo de riego (días) en temporada seca · lámina neta 20 mm. */
export function intervaloRiegoClima(monthIndex) {
  if (esTemporadaLluvias(monthIndex)) return null
  if (monthIndex === 9) return 11 // octubre
  if (monthIndex === 2 || monthIndex === 3 || monthIndex === 4) return 5
  if (monthIndex === 0 || monthIndex === 11) return 7
  return 6
}

function inRange(v, { min, max }) {
  return v >= min && v <= max
}

function Tip({ text }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex align-middle ml-1">
      <button
        type="button"
        className="inline-flex text-slate-400 hover:text-penco-forest transition-colors p-0.5 rounded-full"
        aria-label="Ayuda"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        <HelpCircle size={15} strokeWidth={1.75} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-20 left-1/2 -translate-x-1/2 top-full mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-soft px-3 py-2 text-[12px] leading-snug text-slate-600 font-normal normal-case tracking-normal"
        >
          {text}
        </span>
      )}
    </span>
  )
}

function MetricCard({ icon: Icon, title, tip, children, className = '' }) {
  return (
    <article
      className={`rounded-2xl bg-white border border-slate-200/80 shadow-soft p-5 ${className}`.trim()}
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-slate-100 text-penco-forest">
            <Icon size={18} strokeWidth={1.75} />
          </span>
          <h3 className="m-0 text-[15px] font-semibold text-slate-800 tracking-tight">
            {title}
            {tip ? <Tip text={tip} /> : null}
          </h3>
        </div>
      </header>
      {children}
    </article>
  )
}

function TempGauge({ label, value, range, unit = '°C' }) {
  const ok = inRange(value, range)
  const span = range.max - range.min || 1
  const pct = Math.min(100, Math.max(0, ((value - (range.min - 5)) / (span + 10)) * 100))
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
          {label}
        </span>
        <span className={`text-[11px] font-semibold ${ok ? 'text-penco-forest' : 'text-amber-700'}`}>
          Óptimo {range.min}–{range.max}
          {unit}
        </span>
      </div>
      <p className="m-0 mb-3 font-display text-3xl font-bold tracking-tight text-slate-900">
        {value.toFixed(1)}
        <span className="text-base font-semibold text-slate-400 ml-1">{unit}</span>
      </p>
      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${ok ? 'bg-penco-forest' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Consola agroclimática premium — empresa (OneSoil / Manna style).
 * Tailwind + Lucide. Sin referencias regionales específicas.
 */
export default function AgroClimaticDashboard({
  initial = {
    tempDiurna: 21.5,
    tempNocturna: 12.2,
    tempMinPronostico: 4.5,
    lluviaAcumuladaMm: 720,
    evaporacionMmDia: 3.8,
  },
} = {}) {
  const [tempDiurna, setTempDiurna] = useState(initial.tempDiurna)
  const [tempNocturna, setTempNocturna] = useState(initial.tempNocturna)
  const [tempMinPronostico, setTempMinPronostico] = useState(initial.tempMinPronostico)
  const [lluviaMm, setLluviaMm] = useState(initial.lluviaAcumuladaMm)
  const [evap, setEvap] = useState(initial.evaporacionMmDia)
  const [monthOverride, setMonthOverride] = useState(null)

  const month = monthOverride ?? new Date().getMonth()
  const lluvias = esTemporadaLluvias(month)
  const intervalo = intervaloRiegoClima(month)

  const macOk = useMemo(
    () => inRange(tempDiurna, DAY_OPT) && inRange(tempNocturna, NIGHT_OPT),
    [tempDiurna, tempNocturna]
  )
  const heladaInminente = tempMinPronostico < FROST_WARN_C
  const heladaCritica = tempMinPronostico <= 0

  const rainPct = Math.min(100, (lluviaMm / RAIN_OPTIMAL_MM) * 100)
  const survivalPct = Math.min(100, (RAIN_SURVIVAL_MM / RAIN_OPTIMAL_MM) * 100)

  let rainTone = 'óptimo'
  let rainMsg = 'Precipitación en zona de desarrollo óptimo.'
  if (lluviaMm < RAIN_SURVIVAL_MM) {
    rainTone = 'crítico'
    rainMsg = 'Por debajo del límite de supervivencia: el penco detiene su desarrollo.'
  } else if (lluviaMm < RAIN_OPTIMAL_MM) {
    rainTone = 'atención'
    rainMsg = 'Sobre el mínimo, aún bajo el óptimo de 1,000 mm/año.'
  }

  return (
    <div className="agro-clima font-display text-slate-800">
      <header className="rounded-2xl bg-gradient-to-br from-slate-100 via-white to-emerald-50 border border-slate-200/80 shadow-soft px-6 py-5 mb-4">
        <p className="m-0 mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-penco-mid">
          Consola meteorológica · agricultura de precisión
        </p>
        <h2 className="m-0 text-2xl font-bold tracking-tight text-penco-forest">
          Dashboard agroclimático
        </h2>
        <p className="m-0 mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          Estrés térmico MAC, heladas, lluvia acumulada vs umbral de sequía, evaporación y bloqueo
          estacional de riego. Mes de referencia:{' '}
          <strong className="text-slate-700">{MESES[month]}</strong>.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* MAC */}
        <MetricCard
          icon={Leaf}
          title="Estrés térmico y metabolismo MAC"
          tip="Las plantas MAC abren estomas de noche. La noche fresca (10–15 °C) reduce pérdida de agua; el día (15–26 °C) favorece fotosíntesis."
        >
          <div className="grid gap-3 sm:grid-cols-2 mb-3">
            <TempGauge label="Temperatura diurna" value={tempDiurna} range={DAY_OPT} />
            <TempGauge label="Temperatura nocturna" value={tempNocturna} range={NIGHT_OPT} />
          </div>
          {macOk ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-penco-forest font-semibold flex items-start gap-2">
              <Sun size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
              Metabolismo MAC en estado óptimo
            </div>
          ) : (
            <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-900 font-medium flex items-start gap-2">
              <Thermometer size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
              Temperaturas fuera de rango MAC. Revisar estrés térmico diurno/nocturno.
            </div>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-[12px] font-semibold text-slate-500">
              Ajuste diurna ({tempDiurna.toFixed(1)} °C)
              <input
                type="range"
                min={0}
                max={40}
                step={0.5}
                value={tempDiurna}
                onChange={(e) => setTempDiurna(Number(e.target.value))}
                className="mt-2 w-full accent-penco-forest"
              />
            </label>
            <label className="text-[12px] font-semibold text-slate-500">
              Ajuste nocturna ({tempNocturna.toFixed(1)} °C)
              <input
                type="range"
                min={-2}
                max={25}
                step={0.5}
                value={tempNocturna}
                onChange={(e) => setTempNocturna(Number(e.target.value))}
                className="mt-2 w-full accent-penco-forest"
              />
            </label>
          </div>
        </MetricCard>

        {/* Heladas */}
        <MetricCard
          icon={Snowflake}
          title="Alerta crítica de heladas"
          tip="Agave andino y agave azul sufren daño celular grave si la temperatura baja a 0 °C o menos por más de una hora. Alerta preventiva bajo 3 °C de mínima pronosticada."
        >
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 mb-3">
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 mb-1">
              Mínima nocturna pronosticada
            </p>
            <p
              className={`m-0 font-display text-4xl font-bold tracking-tight ${
                heladaCritica ? 'text-red-600' : heladaInminente ? 'text-orange-600' : 'text-slate-900'
              }`}
            >
              {tempMinPronostico.toFixed(1)} °C
            </p>
          </div>
          {heladaInminente ? (
            <div
              className={`rounded-2xl px-4 py-3 text-sm font-semibold flex items-start gap-2 border ${
                heladaCritica
                  ? 'bg-red-50 border-red-200 text-red-800 animate-pulse'
                  : 'bg-orange-50 border-orange-200 text-orange-900 animate-pulse'
              }`}
              role="alert"
            >
              <AlertTriangle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
              <span>
                Alerta de helada inminente detectada. Alto riesgo de daño foliar en plantas jóvenes.
                {heladaCritica
                  ? ' Temperatura ≤ 0 °C: daño celular grave si dura más de una hora.'
                  : ''}
              </span>
            </div>
          ) : (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-penco-forest font-medium flex items-start gap-2">
              <Snowflake size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
              Sin alerta de helada. Mínima pronosticada ≥ {FROST_WARN_C} °C.
            </div>
          )}
          <label className="mt-4 block text-[12px] font-semibold text-slate-500">
            Simular mínima nocturna ({tempMinPronostico.toFixed(1)} °C)
            <input
              type="range"
              min={-4}
              max={12}
              step={0.5}
              value={tempMinPronostico}
              onChange={(e) => setTempMinPronostico(Number(e.target.value))}
              className="mt-2 w-full accent-orange-600"
            />
          </label>
        </MetricCard>

        {/* Lluvia */}
        <MetricCard
          icon={CloudRain}
          title="Precipitación acumulada vs sequía"
          tip={`Límite de supervivencia: ${RAIN_SURVIVAL_MM} mm/año. Desarrollo óptimo: ${RAIN_OPTIMAL_MM} mm/año.`}
        >
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                Lluvia anual acumulada
              </p>
              <p className="m-0 font-display text-3xl font-bold text-slate-900">
                {Math.round(lluviaMm)}
                <span className="text-base text-slate-400 font-semibold ml-1">mm</span>
              </p>
            </div>
            <span
              className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
                rainTone === 'crítico'
                  ? 'bg-red-50 text-red-700'
                  : rainTone === 'atención'
                    ? 'bg-amber-50 text-amber-800'
                    : 'bg-emerald-50 text-penco-forest'
              }`}
            >
              {rainTone}
            </span>
          </div>

          <div className="relative h-4 rounded-full bg-slate-100 border border-slate-200 overflow-hidden mb-2">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-penco-mid to-penco-forest transition-all"
              style={{ width: `${rainPct}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500"
              style={{ left: `${survivalPct}%` }}
              title={`${RAIN_SURVIVAL_MM} mm supervivencia`}
            />
          </div>
          <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-3">
            <span>0</span>
            <span className="text-red-600">{RAIN_SURVIVAL_MM} mm mín.</span>
            <span className="text-penco-forest">{RAIN_OPTIMAL_MM} mm óptimo</span>
          </div>
          <p className="m-0 text-sm text-slate-600 leading-relaxed">{rainMsg}</p>
          <label className="mt-4 block text-[12px] font-semibold text-slate-500">
            Ajustar acumulado ({Math.round(lluviaMm)} mm)
            <input
              type="range"
              min={0}
              max={1400}
              step={10}
              value={lluviaMm}
              onChange={(e) => setLluviaMm(Number(e.target.value))}
              className="mt-2 w-full accent-penco-forest"
            />
          </label>
        </MetricCard>

        {/* Evaporación + bloqueo riego */}
        <MetricCard
          icon={Wind}
          title="Evaporación y bloqueo estacional de riego"
          tip="La evaporación diaria estima cuánta agua pierde el suelo por viento, radiación y temperatura. El calendario de lluvias altas (jun–sep) suspende el goteo."
        >
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 mb-3 flex items-center gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-white border border-slate-200 text-penco-slate">
              <Droplets size={18} strokeWidth={1.75} />
            </span>
            <div>
              <p className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                Evaporación diaria estimada
              </p>
              <p className="m-0 font-display text-2xl font-bold text-slate-900">
                {evap.toFixed(1)}
                <span className="text-sm font-semibold text-slate-400 ml-1">mm/día</span>
              </p>
            </div>
          </div>

          {lluvias ? (
            <div
              className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-900 font-medium flex items-start gap-2"
              role="status"
            >
              <CloudRain size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
              <span>
                Bloqueo de Riego Activo: Temporada de lluvias altas (&gt;120 mm mensuales). Riego por
                goteo suspendido para evitar la pudrición de raíces.
              </span>
            </div>
          ) : (
            <div
              className="rounded-2xl bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-950 font-medium flex items-start gap-2"
              role="status"
            >
              <Droplets size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
              <span>
                Riego recomendado: Intervalo de riego cada {intervalo} días (Lámina neta de 20 mm).
                {month === 9 ? ' Calendario de octubre aplicado.' : ` Mes: ${MESES[month]}.`}
              </span>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-[12px] font-semibold text-slate-500">
              Evaporación ({evap.toFixed(1)} mm/día)
              <input
                type="range"
                min={0.5}
                max={8}
                step={0.1}
                value={evap}
                onChange={(e) => setEvap(Number(e.target.value))}
                className="mt-2 w-full accent-slate-600"
              />
            </label>
            <label className="text-[12px] font-semibold text-slate-500">
              Mes del calendario
              <select
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                value={month}
                onChange={(e) => setMonthOverride(Number(e.target.value))}
              >
                {MESES.map((nombre, i) => (
                  <option key={nombre} value={i}>
                    {nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </MetricCard>
      </div>
    </div>
  )
}
