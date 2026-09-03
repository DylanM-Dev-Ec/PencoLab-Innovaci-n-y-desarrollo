import { useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { META_CO2_TON, PRECIO_BOTELLA_USD } from '../agaveAndino'

const FASES = {
  establecimiento: {
    id: 'establecimiento',
    label: 'Fase 1 · Establecimiento',
    years: [1, 4],
    fill: '#d8efe4',
    stroke: '#5aa887',
  },
  circular: {
    id: 'circular',
    label: 'Fase 2 · Economía circular',
    years: [5, 11],
    fill: '#5aa887',
    stroke: '#146c48',
  },
  cosecha: {
    id: 'cosecha',
    label: 'Fase 3 · Cosecha y destilación',
    years: [12, 12],
    fill: '#0d4f36',
    stroke: '#083826',
  },
}

const ACTIVIDADES = {
  1: 'Siembra de hijuelos, papas intercaladas en calles de 3 m y medición de pH',
  2: 'Quinoa en pasillos y venta de plántulas del vivero',
  3: 'Papas intercaladas y cuidado de pH',
  4: 'Cierre de establecimiento · plántulas + intercalado maduro',
  5: 'Fibra de cabuya · canastas y primeras alpargatas',
  6: 'Artesanías de fibra y encurtidos de kirillas',
  7: 'Suelas de alpargatas y compost de hoja residual',
  8: 'Economía circular a escala · fibra + kirillas',
  9: 'Comercialización circular consolidada',
  10: 'Preparación de chawada · circular sigue activo',
  11: 'Último año circular antes de la gran cosecha',
  12: `Destilación de verano, empleo femenino y venta a $${PRECIO_BOTELLA_USD}/L · chawarmishky 4 L/día`,
}

function faseDeAno(year) {
  if (year <= 4) return FASES.establecimiento
  if (year <= 11) return FASES.circular
  return FASES.cosecha
}

/** Ingresos acumulados USD según las 3 fases del pitch. */
export function ingresosAcumuladosAno(year) {
  if (year <= 4) return year * 3000
  if (year <= 11) return 12000 + (year - 4) * 5000
  return 480000
}

/** CO₂e lineal hasta la meta de 15 t en el año 12. */
export function carbonoTonAno(year) {
  return Number(((year / 12) * META_CO2_TON).toFixed(2))
}

function buildSeries() {
  return Array.from({ length: 12 }, (_, i) => {
    const year = i + 1
    const fase = faseDeAno(year)
    const ingresos = ingresosAcumuladosAno(year)
    const prev = year === 1 ? 0 : ingresosAcumuladosAno(year - 1)
    return {
      year,
      label: `Año ${year}`,
      ingresos,
      ingresoFase: ingresos - prev,
      co2: carbonoTonAno(year),
      faseId: fase.id,
      faseLabel: fase.label,
      actividad: ACTIVIDADES[year],
      // Áreas por fase (null fuera del rango = no dibuja)
      areaF1: year <= 4 ? ingresos : null,
      areaF2: year >= 5 && year <= 11 ? ingresos : null,
      areaF3: year === 12 ? ingresos : null,
    }
  })
}

function formatUsd(n) {
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null

  return (
    <div className="rounded-2xl border border-emerald-900/10 bg-white/95 px-4 py-3 shadow-soft backdrop-blur-sm max-w-xs font-display">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-penco-mid m-0 mb-1">
        {row.faseLabel}
      </p>
      <p className="text-base font-bold text-penco-forest m-0 mb-2">{row.label}</p>
      <dl className="grid gap-1.5 m-0 text-[13px] leading-snug text-slate-600">
        <div className="flex justify-between gap-4">
          <dt className="m-0 text-slate-500">Ingresos acumulados</dt>
          <dd className="m-0 font-semibold text-penco-forest">{formatUsd(row.ingresos)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="m-0 text-slate-500">Ingreso de la fase (año)</dt>
          <dd className="m-0 font-semibold text-penco-mid">+{formatUsd(row.ingresoFase)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="m-0 text-slate-500">CO₂e capturado</dt>
          <dd className="m-0 font-semibold text-penco-blue">{row.co2} t</dd>
        </div>
      </dl>
      <p className="mt-2.5 mb-0 rounded-xl bg-emerald-50 px-2.5 py-2 text-[12px] leading-snug text-slate-700">
        <span className="font-semibold text-penco-forest">Actividades: </span>
        {row.actividad}
      </p>
    </div>
  )
}

/**
 * Proyección compuesta 12 años: ingresos por fase + carbono a 15 t CO₂e.
 * Dashboard empresa / pitch Pencos del Norte.
 */
export default function CompoundedProjectionChart({ className = '', height = 360 }) {
  const data = useMemo(() => buildSeries(), [])

  return (
    <section
      className={`rounded-2xl border border-emerald-900/10 bg-white p-5 md:p-6 shadow-soft font-display ${className}`.trim()}
    >
      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="m-0 mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-penco-mid">
            Triple impacto · 12 años
          </p>
          <h3 className="m-0 text-xl font-bold tracking-tight text-penco-forest md:text-2xl">
            Proyección de ingresos y carbono
          </h3>
          <p className="m-0 mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
            El agricultor gana desde el año 1 con intercalado; la circular suma valor; en el año 12
            llega la cosecha de chawarmishky, destilación con empleo femenino y botellas a $
            {PRECIO_BOTELLA_USD}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#d8efe4] px-2.5 py-1 font-semibold text-penco-forest">
            <i className="inline-block h-2 w-2 rounded-full bg-[#a8d5c0]" aria-hidden />
            Años 1–4 · $3k/año
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#c8e6d8] px-2.5 py-1 font-semibold text-penco-forest">
            <i className="inline-block h-2 w-2 rounded-full bg-penco-mid" aria-hidden />
            Años 5–11 · +$5k/año
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-penco-forest px-2.5 py-1 font-semibold text-white">
            <i className="inline-block h-2 w-2 rounded-full bg-white/80" aria-hidden />
            Año 12 · $480k
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-penco-blue">
            <i className="inline-block h-0.5 w-3 border-t-2 border-dashed border-penco-blue" aria-hidden />
            Meta {META_CO2_TON} t CO₂e
          </span>
        </div>
      </header>

      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 18, left: 4, bottom: 8 }}>
            <defs>
              <linearGradient id="gradF1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a8d5c0" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#d8efe4" stopOpacity={0.15} />
              </linearGradient>
              <linearGradient id="gradF2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5aa887" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#5aa887" stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id="gradF3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0d4f36" stopOpacity={0.65} />
                <stop offset="100%" stopColor="#0d4f36" stopOpacity={0.12} />
              </linearGradient>
            </defs>

            <ReferenceArea x1={1} x2={4} fill="#d8efe4" fillOpacity={0.35} strokeOpacity={0} />
            <ReferenceArea x1={4} x2={11} fill="#5aa887" fillOpacity={0.12} strokeOpacity={0} />
            <ReferenceArea x1={11} x2={12} fill="#0d4f36" fillOpacity={0.18} strokeOpacity={0} />

            <CartesianGrid stroke="#e8eee9" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="year"
              tickFormatter={(y) => `A${y}`}
              stroke="#94a3b8"
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              label={{
                value: 'Años',
                position: 'insideBottomRight',
                offset: -2,
                fill: '#94a3b8',
                fontSize: 11,
              }}
            />
            <YAxis
              yAxisId="usd"
              stroke="#94a3b8"
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickFormatter={(v) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
              tickLine={false}
              axisLine={false}
              width={52}
              domain={[0, 500000]}
            />
            <YAxis
              yAxisId="co2"
              orientation="right"
              stroke="#64748b"
              tick={{ fill: '#475569', fontSize: 11 }}
              tickFormatter={(v) => `${v} t`}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={[0, META_CO2_TON]}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#0d4f36', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: 12, color: '#475569', paddingBottom: 4 }}
            />

            <Area
              yAxisId="usd"
              type="monotone"
              dataKey="areaF1"
              name="Fase 1 · Establecimiento"
              stroke="#5aa887"
              strokeWidth={2}
              fill="url(#gradF1)"
              connectNulls={false}
              isAnimationActive
              animationDuration={900}
            />
            <Area
              yAxisId="usd"
              type="monotone"
              dataKey="areaF2"
              name="Fase 2 · Circular"
              stroke="#146c48"
              strokeWidth={2}
              fill="url(#gradF2)"
              connectNulls={false}
              isAnimationActive
              animationDuration={900}
            />
            <Area
              yAxisId="usd"
              type="monotone"
              dataKey="areaF3"
              name="Fase 3 · Cosecha"
              stroke="#0d4f36"
              strokeWidth={2.5}
              fill="url(#gradF3)"
              connectNulls={false}
              isAnimationActive
              animationDuration={900}
            />
            <Line
              yAxisId="usd"
              type="monotone"
              dataKey="ingresos"
              name="Ingresos acumulados (USD)"
              stroke="#0d4f36"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: '#0d4f36', stroke: '#fff', strokeWidth: 1.5 }}
              activeDot={{ r: 6, fill: '#0d4f36', stroke: '#d8efe4', strokeWidth: 3 }}
              legendType="none"
            />
            <Line
              yAxisId="co2"
              type="monotone"
              dataKey="co2"
              name={`Carbono in situ → ${META_CO2_TON} t CO₂e`}
              stroke="#334155"
              strokeWidth={2}
              strokeDasharray="6 5"
              dot={{ r: 2.5, fill: '#334155' }}
              activeDot={{ r: 5, fill: '#334155', stroke: '#e2e8f0', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <footer className="mt-3 grid gap-2 border-t border-emerald-900/5 pt-3 text-[12px] text-slate-500 md:grid-cols-3">
        <p className="m-0">
          <strong className="text-penco-forest">Años 1–4:</strong> $12 000 acumulados · papas/quinoa
          + vivero.
        </p>
        <p className="m-0">
          <strong className="text-penco-forest">Años 5–11:</strong> $47 000 acumulados · fibra,
          alpargatas, kirillas.
        </p>
        <p className="m-0">
          <strong className="text-penco-forest">Año 12:</strong> $480 000 · destilación estival y
          clima ({META_CO2_TON} t CO₂e).
        </p>
      </footer>
    </section>
  )
}
