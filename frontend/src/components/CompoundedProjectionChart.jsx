import { useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { META_CO2_TON, PRECIO_BOTELLA_USD } from '../agaveAndino'
import {
  DIAS_TEMPORADA_DEFAULT,
  EFICIENCIA_DESTILACION_DEFAULT,
  LITROS_DIA_POR_PLANTA,
  PLANTAS_COSECHA_PITCH_ANO12,
  calcularCosechaVerano,
} from '../modelosEmpresa'

/** Paleta de alto contraste: fases distintas + CO₂ azul (no verde). */
const COLORS = {
  f1: {
    band: '#fef3c7',
    bandOpacity: 0.55,
    stroke: '#b45309',
    fillTop: '#f59e0b',
    fillBot: '#fef3c7',
    badge: '#fffbeb',
    badgeText: '#92400e',
    dot: '#d97706',
  },
  f2: {
    band: '#ccfbf1',
    bandOpacity: 0.45,
    stroke: '#0f766e',
    fillTop: '#14b8a6',
    fillBot: '#ccfbf1',
    badge: '#f0fdfa',
    badgeText: '#115e59',
    dot: '#0d9488',
  },
  f3: {
    band: '#d1fae5',
    bandOpacity: 0.5,
    stroke: '#065f46',
    fillTop: '#059669',
    fillBot: '#a7f3d0',
    badge: '#065f46',
    badgeText: '#ffffff',
    dot: '#047857',
  },
  ingresos: '#0f172a',
  co2: '#0369a1',
  co2Soft: '#bae6fd',
  grid: '#e2e8f0',
  axis: '#64748b',
}

const FASES = {
  establecimiento: {
    id: 'establecimiento',
    label: 'Fase 1 · Establecimiento',
    years: [1, 4],
    ...COLORS.f1,
  },
  circular: {
    id: 'circular',
    label: 'Fase 2 · Economía circular',
    years: [5, 11],
    ...COLORS.f2,
  },
  cosecha: {
    id: 'cosecha',
    label: 'Fase 3 · Cosecha y destilación',
    years: [12, 12],
    ...COLORS.f3,
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
  12: `Destilación de verano, empleo femenino y venta a $${PRECIO_BOTELLA_USD}/L · chawarmishky ${LITROS_DIA_POR_PLANTA} L/día × ${DIAS_TEMPORADA_DEFAULT} días × ${Math.round(EFICIENCIA_DESTILACION_DEFAULT * 100)}% (misma fórmula que Modelos)`,
}

function faseDeAno(year) {
  if (year <= 4) return FASES.establecimiento
  if (year <= 11) return FASES.circular
  return FASES.cosecha
}

/** Ingreso año 12 = Modelos → Cosecha (pitch de plantas maduras) + circular acumulado previo. */
function ingresoAno12Cosecha() {
  const cosecha = calcularCosechaVerano({
    plantasVivas: PLANTAS_COSECHA_PITCH_ANO12,
    diasTemporada: DIAS_TEMPORADA_DEFAULT,
    litrosDiaPlanta: LITROS_DIA_POR_PLANTA,
    eficienciaDestilacion: EFICIENCIA_DESTILACION_DEFAULT,
    precioBotella: PRECIO_BOTELLA_USD,
  })
  // Base circular al cierre año 11 + destilación estival (misma fórmula que Modelos)
  return 12000 + 7 * 5000 + Math.round(cosecha.usd)
}

/** Ingresos acumulados USD según las 3 fases del pitch (año 12 alineado con Modelos). */
export function ingresosAcumuladosAno(year) {
  if (year <= 4) return year * 3000
  if (year <= 11) return 12000 + (year - 4) * 5000
  return ingresoAno12Cosecha()
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
      areaF1: year <= 4 ? ingresos : null,
      areaF2: year >= 5 && year <= 11 ? ingresos : null,
      areaF3: year === 12 ? ingresos : null,
      dotColor: fase.dot,
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
  const fase = faseDeAno(row.year)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg max-w-xs font-display">
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.08em] m-0 mb-1"
        style={{ color: fase.stroke }}
      >
        {row.faseLabel}
      </p>
      <p className="text-base font-bold text-slate-900 m-0 mb-2">{row.label}</p>
      <dl className="grid gap-1.5 m-0 text-[13px] leading-snug text-slate-600">
        <div className="flex justify-between gap-4">
          <dt className="m-0 text-slate-500">Ingresos acumulados</dt>
          <dd className="m-0 font-semibold text-slate-900">{formatUsd(row.ingresos)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="m-0 text-slate-500">Ingreso del año</dt>
          <dd className="m-0 font-semibold" style={{ color: fase.stroke }}>
            +{formatUsd(row.ingresoFase)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="m-0 text-slate-500">CO₂e capturado</dt>
          <dd className="m-0 font-semibold" style={{ color: COLORS.co2 }}>
            {row.co2} t
          </dd>
        </div>
      </dl>
      <p className="mt-2.5 mb-0 rounded-xl bg-slate-50 px-2.5 py-2 text-[12px] leading-snug text-slate-700 border border-slate-100">
        <span className="font-semibold text-slate-900">Actividades: </span>
        {row.actividad}
      </p>
    </div>
  )
}

function IngresoDot(props) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null) return null
  const color = payload?.dotColor || COLORS.ingresos
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill="#fff" stroke={color} strokeWidth={2.5} />
      <circle cx={cx} cy={cy} r={2.2} fill={color} />
    </g>
  )
}

/**
 * Proyección compuesta 12 años: ingresos por fase + carbono a 15 t CO₂e.
 * Colores de alto contraste: ámbar / teal / esmeralda + CO₂ azul.
 */
export default function CompoundedProjectionChart({ className = '', height = 360 }) {
  const data = useMemo(() => buildSeries(), [])
  const usdAno12 = data[11]?.ingresos ?? ingresoAno12Cosecha()
  const cosechaPitch = useMemo(
    () =>
      calcularCosechaVerano({
        plantasVivas: PLANTAS_COSECHA_PITCH_ANO12,
        diasTemporada: DIAS_TEMPORADA_DEFAULT,
        eficienciaDestilacion: EFICIENCIA_DESTILACION_DEFAULT,
      }),
    []
  )
  const yMax = Math.ceil(usdAno12 / 50000) * 50000 + 20000

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-soft font-display ${className}`.trim()}
    >
      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="m-0 mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-teal-700">
            Triple impacto · 12 años
          </p>
          <h3 className="m-0 text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            Proyección de ingresos y carbono
          </h3>
          <p className="m-0 mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
            El agricultor gana desde el año 1 con intercalado; la circular suma valor; en el año 12
            llega la cosecha de chawarmishky, destilación con empleo femenino y botellas a $
            {PRECIO_BOTELLA_USD}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold"
            style={{ background: COLORS.f1.badge, color: COLORS.f1.badgeText }}
          >
            <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS.f1.dot }} aria-hidden />
            Años 1–4 · $3k/año
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold"
            style={{ background: COLORS.f2.badge, color: COLORS.f2.badgeText }}
          >
            <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS.f2.dot }} aria-hidden />
            Años 5–11 · +$5k/año
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold"
            style={{ background: COLORS.f3.badge, color: COLORS.f3.badgeText }}
          >
            <i className="inline-block h-2.5 w-2.5 rounded-full bg-white/90" aria-hidden />
            Año 12 · {formatUsd(usdAno12)}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold"
            style={{ background: COLORS.co2Soft, color: COLORS.co2 }}
          >
            <i
              className="inline-block h-0.5 w-4 border-t-2 border-dashed"
              style={{ borderColor: COLORS.co2 }}
              aria-hidden
            />
            Meta {META_CO2_TON} t CO₂e
          </span>
        </div>
      </header>

      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 18, left: 4, bottom: 8 }}>
            <defs>
              <linearGradient id="gradF1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.f1.fillTop} stopOpacity={0.45} />
                <stop offset="100%" stopColor={COLORS.f1.fillBot} stopOpacity={0.12} />
              </linearGradient>
              <linearGradient id="gradF2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.f2.fillTop} stopOpacity={0.4} />
                <stop offset="100%" stopColor={COLORS.f2.fillBot} stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="gradF3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.f3.fillTop} stopOpacity={0.55} />
                <stop offset="100%" stopColor={COLORS.f3.fillBot} stopOpacity={0.15} />
              </linearGradient>
            </defs>

            {/* Bandas de fase: ámbar / teal / esmeralda — legibles sin confundirse */}
            <ReferenceArea
              x1={1}
              x2={4}
              fill={COLORS.f1.band}
              fillOpacity={COLORS.f1.bandOpacity}
              strokeOpacity={0}
            />
            <ReferenceArea
              x1={4}
              x2={11}
              fill={COLORS.f2.band}
              fillOpacity={COLORS.f2.bandOpacity}
              strokeOpacity={0}
            />
            <ReferenceArea
              x1={11}
              x2={12}
              fill={COLORS.f3.band}
              fillOpacity={COLORS.f3.bandOpacity}
              strokeOpacity={0}
            />

            <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="year"
              tickFormatter={(y) => `A${y}`}
              stroke={COLORS.axis}
              tick={{ fill: COLORS.axis, fontSize: 12, fontWeight: 600 }}
              tickLine={false}
              axisLine={{ stroke: COLORS.grid }}
              label={{
                value: 'Años',
                position: 'insideBottomRight',
                offset: -2,
                fill: COLORS.axis,
                fontSize: 11,
              }}
            />
            <YAxis
              yAxisId="usd"
              stroke={COLORS.ingresos}
              tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
              tickFormatter={(v) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
              tickLine={false}
              axisLine={false}
              width={52}
              domain={[0, yMax]}
              label={{
                value: 'USD',
                angle: -90,
                position: 'insideLeft',
                offset: 8,
                fill: '#334155',
                fontSize: 10,
              }}
            />
            <YAxis
              yAxisId="co2"
              orientation="right"
              stroke={COLORS.co2}
              tick={{ fill: COLORS.co2, fontSize: 11, fontWeight: 600 }}
              tickFormatter={(v) => `${v} t`}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={[0, META_CO2_TON]}
              label={{
                value: 'CO₂e',
                angle: 90,
                position: 'insideRight',
                offset: 4,
                fill: COLORS.co2,
                fontSize: 10,
              }}
            />

            <ReferenceLine
              yAxisId="co2"
              y={META_CO2_TON}
              stroke={COLORS.co2}
              strokeDasharray="2 4"
              strokeOpacity={0.35}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: COLORS.ingresos, strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: 12, color: '#334155', paddingBottom: 4, fontWeight: 600 }}
            />

            <Area
              yAxisId="usd"
              type="monotone"
              dataKey="areaF1"
              name="Fase 1 · Establecimiento"
              stroke={COLORS.f1.stroke}
              strokeWidth={2.5}
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
              stroke={COLORS.f2.stroke}
              strokeWidth={2.5}
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
              stroke={COLORS.f3.stroke}
              strokeWidth={3}
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
              stroke={COLORS.ingresos}
              strokeWidth={3}
              dot={<IngresoDot />}
              activeDot={{ r: 7, fill: COLORS.ingresos, stroke: '#fff', strokeWidth: 2 }}
              legendType="none"
            />
            <Line
              yAxisId="co2"
              type="monotone"
              dataKey="co2"
              name={`Carbono → ${META_CO2_TON} t CO₂e`}
              stroke={COLORS.co2}
              strokeWidth={2.5}
              strokeDasharray="7 5"
              dot={{ r: 3.5, fill: '#fff', stroke: COLORS.co2, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: COLORS.co2, stroke: COLORS.co2Soft, strokeWidth: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <footer className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-[12px] text-slate-600 md:grid-cols-3">
        <p className="m-0">
          <strong style={{ color: COLORS.f1.stroke }}>Años 1–4 (ámbar):</strong> $12 000 acumulados ·
          papas/quinoa + vivero.
        </p>
        <p className="m-0">
          <strong style={{ color: COLORS.f2.stroke }}>Años 5–11 (teal):</strong> $47 000 acumulados ·
          fibra, alpargatas, kirillas.
        </p>
        <p className="m-0">
          <strong style={{ color: COLORS.f3.stroke }}>Año 12 (verde):</strong> {formatUsd(usdAno12)} ·
          destilación = Modelos → Cosecha ({PLANTAS_COSECHA_PITCH_ANO12.toLocaleString()} plantas ·{' '}
          {cosechaPitch.formula}) · clima ({META_CO2_TON} t CO₂e en{' '}
          <span style={{ color: COLORS.co2, fontWeight: 700 }}>azul</span>).
        </p>
      </footer>
    </section>
  )
}
