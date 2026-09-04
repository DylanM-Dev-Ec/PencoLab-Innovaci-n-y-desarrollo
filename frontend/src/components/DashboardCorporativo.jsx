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
import {
  DIAS_TEMPORADA_DEFAULT,
  EFICIENCIA_DESTILACION_DEFAULT,
  MORTALIDAD_REF_PCT,
  agregarCarbonoPortafolio,
  calcularCosechaVerano,
  calcularEscalamientoHa,
  calcularSupervivenciaFinanciera,
  haFromCampo,
  plantasFromCampo,
  serieRecoleccionDiaria,
} from '../modelosEmpresa'
import { navigate } from '../routing'
import CompoundedProjectionChart from './CompoundedProjectionChart'

function money(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString('es-EC')}`
}

/**
 * Resumen ejecutivo — mismos motores que la pestaña Modelos.
 */
export default function DashboardCorporativo({ stats, residuos = [], campoData = null }) {
  const haActual = useMemo(() => {
    const fromCampo = haFromCampo(campoData)
    const fromStats = Number(stats?.hectareas_actuales)
    if (campoData && fromCampo > 0) return fromCampo
    return fromStats > 0 ? fromStats : HA_ACTUALES
  }, [campoData, stats])

  const plantas = useMemo(() => plantasFromCampo(campoData), [campoData])

  const carbono = useMemo(() => agregarCarbonoPortafolio(campoData || {}), [campoData])

  // Siempre la misma agregación que Modelos → Carbono (snapshot / proxy)
  const co2Ver = carbono.verificadoTon
  const co2Est = carbono.estimadoTon
  const co2Total = carbono.totalTon
  const pctMeta = carbono.pctMeta
  const pendienteCo2 = carbono.pendienteTon

  const cosecha = useMemo(
    () =>
      calcularCosechaVerano({
        plantasVivas: plantas,
        diasTemporada: DIAS_TEMPORADA_DEFAULT,
        eficienciaDestilacion: EFICIENCIA_DESTILACION_DEFAULT,
        precioBotella: PRECIO_BOTELLA_USD,
        recolectoras: MUJERES_RECOLECTORAS,
      }),
    [plantas]
  )

  const supervivencia = useMemo(
    () =>
      calcularSupervivenciaFinanciera({
        hectareas: haActual,
        mortalidadPct: MORTALIDAD_REF_PCT,
      }),
    [haActual]
  )

  const escala = useMemo(
    () =>
      calcularEscalamientoHa({
        haActual,
        haObjetivo: HA_META,
        mortalidadPct: MORTALIDAD_REF_PCT,
      }),
    [haActual]
  )

  const destilacion = useMemo(() => serieRecoleccionDiaria(cosecha), [cosecha])
  const litrosSemana = destilacion.reduce((s, d) => s + d.litros, 0)
  const botellasSemana = destilacion.reduce((s, d) => s + d.botellas, 0)
  const ventasSemana = destilacion.reduce((s, d) => s + d.ventas, 0)

  const circularUsd = residuos.reduce((s, r) => s + (Number(r.ingreso_adicional_usd) || 0), 0)
  const circularDemo = circularUsd > 0 ? circularUsd : 1240

  const pctHa = Math.min(100, (haActual / HA_META) * 100)

  const donut = [
    { name: 'Verificado in situ', value: co2Ver, fill: B2B.forest },
    { name: 'Estimado', value: co2Est, fill: B2B.tealSoft },
    {
      name: `Pendiente meta ${META_CO2_TON} t`,
      value: pendienteCo2,
      fill: B2B.grayGrid,
    },
  ]

  const ingresos = [
    { fuente: `Temporada $${PRECIO_BOTELLA_USD}/L`, usd: Math.round(cosecha.usd), fill: B2B.forest },
    { fuente: 'Circular', usd: Math.round(circularDemo), fill: B2B.teal },
    {
      fuente: 'Total',
      usd: Math.round(cosecha.usd + circularDemo),
      fill: B2B.slate,
    },
  ]

  const puente = [
    {
      id: 'cosecha',
      label: 'Cosecha',
      value: money(cosecha.usd),
      hint: `${cosecha.botellas.toLocaleString('es-EC')} botellas`,
      formula: cosecha.formula,
    },
    {
      id: 'supervivencia',
      label: 'Supervivencia',
      value: money(supervivencia.totalNeto),
      hint: `${supervivencia.vivos.toLocaleString('es-EC')} vivas · ${MORTALIDAD_REF_PCT}% mort.`,
      formula: supervivencia.formula,
    },
    {
      id: 'escala',
      label: 'Escalamiento',
      value: `${haActual} → ${HA_META} ha`,
      hint: `${pctHa.toFixed(0)}% · ${escala.enActual.co2Ton} t CO₂`,
      formula: escala.formula,
    },
    {
      id: 'carbono',
      label: 'Carbono',
      value: `${co2Total.toFixed(1)} / ${META_CO2_TON} t`,
      hint: `${pctMeta.toFixed(0)}% meta`,
      formula: carbono.formula,
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

      <div className="corp-bridge">
        <div className="corp-bridge-copy">
          <p className="corp-bridge-kicker">Cohesión con Modelos</p>
          <strong>Mismos motores matemáticos</strong>
          <span>
            Resumen muestra el resultado con el snapshot de campo. En Modelos puedes sensibilizar con
            sliders.
          </span>
        </div>
        <button type="button" className="corp-bridge-btn" onClick={() => navigate('/empresa/modelos')}>
          Abrir Modelos
        </button>
      </div>

      <div className="corp-model-strip" aria-label="Vista previa de los 4 modelos">
        {puente.map((p) => (
          <button
            key={p.id}
            type="button"
            className="corp-model-chip"
            onClick={() => navigate('/empresa/modelos')}
            title={p.formula}
          >
            <span>{p.label}</span>
            <strong>{p.value}</strong>
            <small>{p.hint}</small>
            <em>{p.formula}</em>
          </button>
        ))}
      </div>

      <CompoundedProjectionChart className="corp-projection" height={380} />

      <div className="corp-grid">
        <article className="corp-card">
          <h3>Captura de carbono</h3>
          <p className="corp-sub">
            Misma agregación que Modelos → Carbono · avance a {META_CO2_TON} t CO₂e
          </p>
          <p className="corp-formula">{carbono.formula}</p>
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
            Modelos → Cosecha · {MUJERES_RECOLECTORAS} mujeres · ${PRECIO_BOTELLA_USD}/L
          </p>
          <p className="corp-formula">{cosecha.formula}</p>
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
            Semana tipo (reparto del modelo): {Math.round(litrosSemana).toLocaleString('es-EC')} L →{' '}
            {botellasSemana.toLocaleString('es-EC')} botellas · {money(ventasSemana)}. Temporada completa (
            {cosecha.dias} d): {money(cosecha.usd)} · {cosecha.litrosPorRecolectoraDia} L/recolectora/día.
          </p>
        </article>

        <article className="corp-card">
          <h3>Expansión de tierra</h3>
          <p className="corp-sub">
            Modelos → Escalamiento · {haActual} ha actuales vs meta {HA_META} ha
          </p>
          <p className="corp-formula">{escala.formula}</p>
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
          <div className="corp-split corp-split-stack">
            <span>
              Hoy: {escala.enActual.plantas.toLocaleString('es-EC')} plantas · {money(escala.enActual.ingresoTotal)}
            </span>
            <span>
              A {HA_META} ha: {escala.enObjetivo.plantas.toLocaleString('es-EC')} plantas ·{' '}
              {money(escala.enObjetivo.ingresoTotal)}
            </span>
          </div>
        </article>

        <article className="corp-card">
          <h3>Ingresos combinados</h3>
          <p className="corp-sub">
            Temporada de destilación (Modelos → Cosecha) + retorno circular
          </p>
          <p className="corp-formula">
            {cosecha.formula} + circular snapshot
          </p>
          <div className="corp-chart">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ingresos} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid {...CHART_GRID} horizontal={false} />
                <XAxis type="number" stroke={B2B.slateLight} />
                <YAxis type="category" dataKey="fuente" width={120} stroke={B2B.slateLight} tick={{ fontSize: 11 }} />
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
          <p className="corp-note">
            Supervivencia de referencia ({MORTALIDAD_REF_PCT}%): {money(supervivencia.totalNeto)} neto · pérdida
            por mortalidad {money(supervivencia.perdidaUsd)}.
          </p>
        </article>
      </div>
    </div>
  )
}
