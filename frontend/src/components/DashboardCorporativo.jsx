import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { B2B, CHART_GRID, CHART_TOOLTIP } from '../empresaTheme'
import {
  HA_ACTUALES,
  HA_META,
  META_CO2_TON,
  MUJERES_RECOLECTORAS,
  PRECIO_BOTELLA_USD,
} from '../agaveAndino'
import CompoundedProjectionChart from './CompoundedProjectionChart'

/** Demo / pitch: 3 recolectoras en temporada seca, destilación $2/L */
const DEMO_RECOLECCION = [
  { dia: 'Lun', maria: 42, rosa: 38, ana: 40 },
  { dia: 'Mar', maria: 45, rosa: 41, ana: 39 },
  { dia: 'Mié', maria: 48, rosa: 44, ana: 42 },
  { dia: 'Jue', maria: 46, rosa: 40, ana: 43 },
  { dia: 'Vie', maria: 50, rosa: 46, ana: 45 },
  { dia: 'Sáb', maria: 44, rosa: 42, ana: 41 },
]

/**
 * Dashboard corporativo premium — pitch Pencos del Norte.
 */
export default function DashboardCorporativo({ stats, residuos = [] }) {
  const co2Ver = Number(stats?.co2_verificado_ton ?? 4.2)
  const co2Est = Number(stats?.co2_estimado_ton ?? 6.8)
  const co2Total = co2Ver + co2Est
  const pctMeta = Math.min(100, (co2Total / META_CO2_TON) * 100)

  const haActual = Number(stats?.hectareas_actuales ?? HA_ACTUALES)
  const pctHa = Math.min(100, (haActual / HA_META) * 100)

  const donut = [
    { name: 'Verificado in situ', value: co2Ver, fill: B2B.forest },
    { name: 'Estimado', value: co2Est, fill: B2B.tealSoft },
    {
      name: 'Pendiente meta 15 t',
      value: Math.max(0, META_CO2_TON - co2Total),
      fill: B2B.grayGrid,
    },
  ]

  const destilacion = useMemo(() => {
    return DEMO_RECOLECCION.map((d) => {
      const litros = d.maria + d.rosa + d.ana
      const botellas = Math.floor(litros * 0.55)
      return {
        dia: d.dia,
        litros,
        destilados: Math.round(litros * 0.55),
        botellas,
        ventas: botellas * PRECIO_BOTELLA_USD,
        maria: d.maria,
        rosa: d.rosa,
        ana: d.ana,
      }
    })
  }, [])

  const ventasBotellas = destilacion.reduce((s, d) => s + d.ventas, 0)
  const circularUsd = residuos.reduce((s, r) => s + (Number(r.ingreso_adicional_usd) || 0), 0)
  const circularDemo = circularUsd > 0 ? circularUsd : 1240

  const ingresos = [
    { fuente: 'Botellas $2/L', usd: ventasBotellas, fill: B2B.forest },
    { fuente: 'Circular', usd: Math.round(circularDemo), fill: B2B.teal },
    {
      fuente: 'Total',
      usd: Math.round(ventasBotellas + circularDemo),
      fill: B2B.slate,
    },
  ]

  return (
    <div className="corp-dash">
      <section className="corp-hero">
        <p className="corp-kicker">Consola ejecutiva · Pencos del Norte</p>
        <h2>Escalabilidad, género y clima</h2>
        <p>
          De {HA_ACTUALES} a {HA_META} ha · {MUJERES_RECOLECTORAS} recolectoras en verano · meta{' '}
          {META_CO2_TON} t CO₂e
        </p>
      </section>

      <CompoundedProjectionChart className="corp-projection" height={380} />

      <div className="corp-grid">
        <article className="corp-card">
          <h3>Captura de carbono</h3>
          <p className="corp-sub">Avance a {META_CO2_TON} t CO₂e · verificado vs estimado</p>
          <div className="corp-chart">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={donut}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={86}
                  paddingAngle={2}
                >
                  {donut.map((e) => (
                    <Cell key={e.name} fill={e.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP} formatter={(v) => [`${Number(v).toFixed(1)} t`, '']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="corp-meter">
            <div className="corp-meter-bar">
              <i style={{ width: `${pctMeta}%` }} />
            </div>
            <span>
              {co2Total.toFixed(1)} / {META_CO2_TON} t · {pctMeta.toFixed(0)}%
            </span>
          </div>
          <div className="corp-split">
            <span>Verificado {co2Ver.toFixed(1)} t</span>
            <span>Estimado {co2Est.toFixed(1)} t</span>
          </div>
        </article>

        <article className="corp-card">
          <h3>Género y destilación estival</h3>
          <p className="corp-sub">
            {MUJERES_RECOLECTORAS} mujeres · chawarmishky → botellas a ${PRECIO_BOTELLA_USD}/L
          </p>
          <div className="corp-chart">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={destilacion}>
                <CartesianGrid {...CHART_GRID} vertical={false} />
                <XAxis dataKey="dia" stroke={B2B.slateLight} tick={{ fontSize: 12 }} />
                <YAxis stroke={B2B.slateLight} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={CHART_TOOLTIP} />
                <Legend />
                <Bar dataKey="maria" name="María L" stackId="a" fill={B2B.forest} radius={[0, 0, 0, 0]} />
                <Bar dataKey="rosa" name="Rosa Q" stackId="a" fill={B2B.teal} />
                <Bar dataKey="ana" name="Ana C" stackId="a" fill={B2B.tealSoft} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="corp-note">
            Semana demo: {destilacion.reduce((s, d) => s + d.litros, 0)} L recolectados →{' '}
            {destilacion.reduce((s, d) => s + d.botellas, 0)} botellas · ${ventasBotellas.toLocaleString()}
          </p>
        </article>

        <article className="corp-card">
          <h3>Expansión de tierra</h3>
          <p className="corp-sub">
            {haActual} ha actuales vs meta {HA_META} ha en laderas reforestadas
          </p>
          <div className="corp-ha">
            <strong>
              {haActual}
              <small> / {HA_META} ha</small>
            </strong>
            <div className="corp-meter tall">
              <div className="corp-meter-bar">
                <i style={{ width: `${pctHa}%` }} />
              </div>
            </div>
            <span>{pctHa.toFixed(0)}% del objetivo sostenible</span>
          </div>
        </article>

        <article className="corp-card">
          <h3>Ingresos combinados</h3>
          <p className="corp-sub">Botellas $2 + retorno circular (canastas, alpargatas, kirillas, abono)</p>
          <div className="corp-chart">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ingresos} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid {...CHART_GRID} horizontal={false} />
                <XAxis type="number" stroke={B2B.slateLight} />
                <YAxis type="category" dataKey="fuente" width={100} stroke={B2B.slateLight} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP}
                  formatter={(v) => [`$${Number(v).toLocaleString()}`, 'USD']}
                />
                <Bar dataKey="usd" radius={[0, 8, 8, 0]} maxBarSize={28}>
                  {ingresos.map((e) => (
                    <Cell key={e.fuente} fill={e.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>
    </div>
  )
}
