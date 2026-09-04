import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { B2B, CHART_GRID, CHART_TOOLTIP } from '../empresaTheme'
import {
  DENSIDAD_ALTA_HA,
  DENSIDAD_BAJA_HA,
  HA_ACTUALES,
  HA_META,
  LITROS_DIA_POR_PLANTA,
  META_CO2_TON,
  MUJERES_RECOLECTORAS,
  PRECIO_BOTELLA_USD,
  agregarCarbonoPortafolio,
  calcularCosechaVerano,
  calcularEscalamientoHa,
  calcularSupervivenciaFinanciera,
  haFromCampo,
  plantasFromCampo,
} from '../modelosEmpresa'

const TABS = [
  { id: 'cosecha', label: 'Cosecha', short: 'Verano' },
  { id: 'supervivencia', label: 'Supervivencia', short: 'Neto' },
  { id: 'escala', label: 'Escalamiento', short: '3→20 ha' },
  { id: 'carbono', label: 'Carbono', short: 'Portafolio' },
]

const MORT_PRESETS = [
  { pct: 30, label: 'Sin protocolo', tip: 'Sin desinfección ni cicatrización: mucha pérdida de hijuelos.' },
  { pct: 12, label: 'Buen manejo', tip: 'Corte limpio, sol 10 días y riego parco: bajas bastante la pérdida.' },
  { pct: 4, label: 'Certificado', tip: 'Fuego + pasta + cicatriz + trazado 3 m: meta del protocolo (~4%).' },
]

function money(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString('es-EC')}`
}

function num(n, d = 0) {
  return Number(n || 0).toLocaleString('es-EC', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

export default function ModelosEmpresaHub({ campoData }) {
  const [tab, setTab] = useState('cosecha')
  const haSnap = haFromCampo(campoData)
  const plantasSnap = plantasFromCampo(campoData)

  return (
    <div className="b2b-modelos">
      <header className="b2b-modelos-hero">
        <p className="b2b-modelos-kicker">Modelos matemáticos · Agave Andino</p>
        <h2>Calculadoras del portafolio</h2>
        <p>
          Cuatro fórmulas alimentadas por el snapshot de campo
          {campoData?.from_snapshot ? ' (datos del productor)' : ' (demo Carchi)'}. Son las mismas que
          alimentan Resumen; aquí ajustas sliders para sensibilizar.
        </p>
      </header>

      <div className="b2b-modelos-tabs" role="tablist" aria-label="Modelos">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'on' : ''}
            onClick={() => setTab(t.id)}
          >
            <strong>{t.label}</strong>
            <span>{t.short}</span>
          </button>
        ))}
      </div>

      {tab === 'cosecha' && <ModeloCosecha plantasSnap={plantasSnap} />}
      {tab === 'supervivencia' && <ModeloSupervivencia haSnap={haSnap} />}
      {tab === 'escala' && <ModeloEscalamiento haSnap={haSnap} />}
      {tab === 'carbono' && <ModeloCarbono campoData={campoData} />}
    </div>
  )
}

function FormulaBar({ text }) {
  return (
    <p className="b2b-modelos-formula" title={text}>
      <span>Fórmula</span> {text}
    </p>
  )
}

function StatGrid({ items }) {
  return (
    <div className="b2b-modelos-stats">
      {items.map((it) => (
        <article key={it.label} className={it.accent ? 'accent' : ''}>
          <span>{it.label}</span>
          <strong>{it.value}</strong>
          {it.hint ? <small>{it.hint}</small> : null}
        </article>
      ))}
    </div>
  )
}

function ModeloCosecha({ plantasSnap }) {
  const [plantas, setPlantas] = useState(plantasSnap)
  const [dias, setDias] = useState(60)
  const [litrosDia, setLitrosDia] = useState(LITROS_DIA_POR_PLANTA)
  const [eff, setEff] = useState(55)
  const [precio, setPrecio] = useState(PRECIO_BOTELLA_USD)
  const [recolectoras, setRecolectoras] = useState(MUJERES_RECOLECTORAS)

  const r = useMemo(
    () =>
      calcularCosechaVerano({
        plantasVivas: plantas,
        diasTemporada: dias,
        litrosDiaPlanta: litrosDia,
        eficienciaDestilacion: eff / 100,
        precioBotella: precio,
        recolectoras,
      }),
    [plantas, dias, litrosDia, eff, precio, recolectoras]
  )

  return (
    <section className="b2b-modelos-panel">
      <div className="b2b-modelos-head">
        <h3>Cosecha y destilación · Pacto de verano</h3>
        <p>Plantas vivas × litros/día × temporada × eficiencia → botellas a ${precio}/L.</p>
      </div>
      <FormulaBar text={r.formula} />

      <div className="b2b-modelos-controls">
        <label>
          <span>Plantas vivas · {num(plantas)}</span>
          <input
            type="range"
            min={500}
            max={50000}
            step={100}
            value={plantas}
            onChange={(e) => setPlantas(Number(e.target.value))}
          />
        </label>
        <label>
          <span>Días de temporada · {dias}</span>
          <input type="range" min={30} max={120} step={1} value={dias} onChange={(e) => setDias(Number(e.target.value))} />
        </label>
        <label>
          <span>Litros / planta / día · {litrosDia}</span>
          <input
            type="range"
            min={2}
            max={8}
            step={0.5}
            value={litrosDia}
            onChange={(e) => setLitrosDia(Number(e.target.value))}
          />
        </label>
        <label>
          <span>Eficiencia destilación · {eff}%</span>
          <input type="range" min={30} max={80} step={1} value={eff} onChange={(e) => setEff(Number(e.target.value))} />
        </label>
        <label>
          <span>Precio botella · ${precio}</span>
          <input
            type="range"
            min={1}
            max={5}
            step={0.5}
            value={precio}
            onChange={(e) => setPrecio(Number(e.target.value))}
          />
        </label>
        <label>
          <span>Recolectoras · {recolectoras}</span>
          <input
            type="range"
            min={1}
            max={12}
            step={1}
            value={recolectoras}
            onChange={(e) => setRecolectoras(Number(e.target.value))}
          />
        </label>
      </div>

      <StatGrid
        items={[
          { label: 'Litros totales', value: `${num(r.litrosTotales)} L` },
          { label: 'Destilados', value: `${num(r.litrosDestilados)} L` },
          { label: 'Botellas', value: num(r.botellas), accent: true },
          { label: 'Ingreso USD', value: money(r.usd), accent: true },
          {
            label: 'L / recolectora / día',
            value: num(r.litrosPorRecolectoraDia, 1),
            hint: `${r.recolectoras} mujeres en temporada`,
          },
        ]}
      />

      <div className="b2b-modelos-chart">
        <h4>Producción semanal</h4>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={r.serieSemanal}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis dataKey="semana" stroke={B2B.slateLight} fontSize={12} tickLine={false} />
            <YAxis stroke={B2B.slateLight} fontSize={12} tickLine={false} />
            <Tooltip contentStyle={CHART_TOOLTIP} />
            <Legend />
            <Bar dataKey="litros" name="Litros" fill={B2B.tealSoft} radius={[6, 6, 0, 0]} />
            <Bar dataKey="ventas" name="USD" fill={B2B.forest} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function ModeloSupervivencia({ haSnap }) {
  const [ha, setHa] = useState(haSnap)
  const [densidad, setDensidad] = useState(DENSIDAD_ALTA_HA)
  const [mort, setMort] = useState(12)

  const r = useMemo(
    () =>
      calcularSupervivenciaFinanciera({
        hectareas: ha,
        densidadHa: densidad,
        mortalidadPct: mort,
      }),
    [ha, densidad, mort]
  )

  const preset = MORT_PRESETS.find((m) => m.pct === mort)
  const tip =
    preset?.tip ||
    (mort <= 5
      ? 'Cerca del protocolo certificado: mantén fuego, pasta y cicatrización.'
      : mort <= 15
        ? 'Buen manejo; aún puedes ganar acercándote a ~4% de mortalidad.'
        : 'Alta pérdida: prioriza desinfección, sol 10 días y riego parco.')

  return (
    <section className="b2b-modelos-panel">
      <div className="b2b-modelos-head">
        <h3>Supervivencia y pérdida financiera</h3>
        <p>Densidad × ha × supervivencia → USD neto vs ideal. Alineado con el Plan del productor.</p>
      </div>
      <FormulaBar text={r.formula} />

      <div className="b2b-modelos-presets">
        {MORT_PRESETS.map((m) => (
          <button
            key={m.pct}
            type="button"
            className={mort === m.pct ? 'on' : ''}
            onClick={() => setMort(m.pct)}
          >
            <strong>{m.pct}%</strong>
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      <div className="b2b-modelos-controls">
        <label>
          <span>Hectáreas · {num(ha, 1)}</span>
          <input
            type="range"
            min={1}
            max={HA_META}
            step={0.5}
            value={ha}
            onChange={(e) => setHa(Number(e.target.value))}
          />
        </label>
        <label>
          <span>Densidad · {num(densidad)} / ha</span>
          <input
            type="range"
            min={DENSIDAD_BAJA_HA}
            max={DENSIDAD_ALTA_HA}
            step={50}
            value={densidad}
            onChange={(e) => setDensidad(Number(e.target.value))}
          />
        </label>
        <label>
          <span>Mortalidad · {mort}%</span>
          <input type="range" min={0} max={40} step={1} value={mort} onChange={(e) => setMort(Number(e.target.value))} />
        </label>
      </div>

      <StatGrid
        items={[
          { label: 'Sembradas', value: num(r.sembradas) },
          { label: 'Vivas', value: num(r.vivos), accent: true },
          { label: 'Muertas', value: num(r.muertas) },
          { label: 'USD neto', value: money(r.totalNeto), accent: true },
          { label: 'Pérdida mortalidad', value: money(r.perdidaUsd) },
          { label: 'Upside a 4%', value: money(r.upsideCert), hint: 'Vs escenario certificado' },
        ]}
      />

      <p className="b2b-modelos-tip">{tip}</p>

      <div className="b2b-modelos-chart">
        <h4>Comparativa de ingreso</h4>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={r.barras} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis type="number" stroke={B2B.slateLight} fontSize={12} tickLine={false} />
            <YAxis type="category" dataKey="nombre" width={110} stroke={B2B.slateLight} fontSize={12} tickLine={false} />
            <Tooltip contentStyle={CHART_TOOLTIP} formatter={(v) => [money(v), 'USD']} />
            <Bar dataKey="usd" radius={[0, 8, 8, 0]}>
              {r.barras.map((b, i) => (
                <Cell key={b.nombre} fill={[B2B.gray, B2B.forest, B2B.teal][i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function ModeloEscalamiento({ haSnap }) {
  const [haObj, setHaObj] = useState(Math.max(haSnap, 8))
  const [mort, setMort] = useState(8)

  const r = useMemo(
    () =>
      calcularEscalamientoHa({
        haActual: haSnap,
        haObjetivo: haObj,
        mortalidadPct: mort,
      }),
    [haSnap, haObj, mort]
  )

  return (
    <section className="b2b-modelos-panel">
      <div className="b2b-modelos-head">
        <h3>Escalamiento {HA_ACTUALES} → {HA_META} ha</h3>
        <p>
          Curva de plantas, ingreso (penco + intercalado) y CO₂ hacia meta {META_CO2_TON} t. Marca actual del
          snapshot vs meta comunitaria.
        </p>
      </div>
      <FormulaBar text={r.formula} />

      <div className="b2b-modelos-controls">
        <label>
          <span>Ha objetivo · {num(haObj, 1)}</span>
          <input
            type="range"
            min={HA_ACTUALES}
            max={HA_META}
            step={0.5}
            value={haObj}
            onChange={(e) => setHaObj(Number(e.target.value))}
          />
        </label>
        <label>
          <span>Mortalidad asumida · {mort}%</span>
          <input type="range" min={0} max={30} step={1} value={mort} onChange={(e) => setMort(Number(e.target.value))} />
        </label>
      </div>

      <StatGrid
        items={[
          {
            label: 'Hoy (snapshot)',
            value: `${num(r.enActual.ha, 1)} ha`,
            hint: `${num(r.enActual.plantas)} plantas · ${money(r.enActual.ingresoTotal)}`,
          },
          {
            label: 'En objetivo',
            value: `${num(r.enObjetivo.ha, 1)} ha`,
            accent: true,
            hint: `${num(r.enObjetivo.plantas)} plantas · ${money(r.enObjetivo.ingresoTotal)}`,
          },
          {
            label: 'CO₂ en objetivo',
            value: `${num(r.enObjetivo.co2Ton, 1)} t`,
            accent: true,
            hint: `${num(r.enObjetivo.pctMetaCo2, 0)}% de meta ${META_CO2_TON} t`,
          },
          {
            label: 'Avance ha',
            value: `${num(r.enObjetivo.pctMetaHa, 0)}%`,
            hint: `Meta comunitaria ${HA_META} ha`,
          },
        ]}
      />

      <div className="b2b-modelos-chart">
        <h4>Ingreso total vs hectáreas</h4>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={r.puntos}>
            <defs>
              <linearGradient id="escIngreso" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={B2B.forest} stopOpacity={0.35} />
                <stop offset="100%" stopColor={B2B.forest} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...CHART_GRID} />
            <XAxis dataKey="ha" stroke={B2B.slateLight} fontSize={12} tickLine={false} unit=" ha" />
            <YAxis stroke={B2B.slateLight} fontSize={12} tickLine={false} />
            <Tooltip
              contentStyle={CHART_TOOLTIP}
              formatter={(v, name) => [
                name === 'co2Ton' ? `${Number(v).toFixed(1)} t` : money(v),
                name === 'ingresoTotal' ? 'Ingreso' : name === 'co2Ton' ? 'CO₂' : name,
              ]}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="ingresoTotal"
              name="Ingreso total"
              stroke={B2B.forest}
              fill="url(#escIngreso)"
              strokeWidth={2.2}
            />
            <Line type="monotone" dataKey="co2Ton" name="CO₂ t" stroke={B2B.teal} strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function ModeloCarbono({ campoData }) {
  const r = useMemo(() => agregarCarbonoPortafolio(campoData || {}), [campoData])

  return (
    <section className="b2b-modelos-panel">
      <div className="b2b-modelos-head">
        <h3>Carbono de portafolio</h3>
        <p>
          Agrega mediciones del snapshot: estimado vs verificado in situ. Brecha a {META_CO2_TON} t CO₂e.
        </p>
      </div>
      <FormulaBar text={r.formula} />

      {r.proxySinMediciones ? (
        <p className="b2b-modelos-tip">
          Sin mediciones en el snapshot: se usa proxy por ha ({num(r.ha, 1)} ha × ~5 t/ha). Cuando el productor
          registre mediciones, el modelo usará datos reales.
        </p>
      ) : r.extrapoladoDesdeMuestras ? (
        <p className="b2b-modelos-tip">
          {r.medicionesCount} mediciones a escala de planta (kg) proyectadas a portafolio de {num(r.ha, 1)} ha,
          manteniendo el ratio verificado / estimado de las muestras.
        </p>
      ) : (
        <p className="b2b-modelos-tip">
          {r.medicionesCount} mediciones agregadas desde el campo del productor.
        </p>
      )}

      <StatGrid
        items={[
          { label: 'Estimado', value: `${num(r.estimadoTon, 1)} t` },
          { label: 'Verificado in situ', value: `${num(r.verificadoTon, 1)} t`, accent: true },
          { label: 'Total', value: `${num(r.totalTon, 1)} t`, accent: true },
          {
            label: 'Pendiente meta',
            value: `${num(r.pendienteTon, 1)} t`,
            hint: `${num(r.pctMeta, 0)}% de ${META_CO2_TON} t`,
          },
        ]}
      />

      <div className="b2b-modelos-progress" aria-label="Avance a meta de carbono">
        <div className="b2b-modelos-progress-bar">
          <span style={{ width: `${r.pctMeta}%` }} />
        </div>
        <small>
          {num(r.pctMeta, 0)}% hacia {META_CO2_TON} t CO₂e
        </small>
      </div>

      <div className="b2b-modelos-grid2">
        <div className="b2b-modelos-chart">
          <h4>Distribución</h4>
          <ResponsiveContainer width="100%" height={240}>
            {r.donut.length === 0 ? (
              <div className="b2b-modelos-tip">Sin datos de carbono para graficar.</div>
            ) : (
              <PieChart>
                <Pie
                  data={r.donut}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={r.donut.length > 1 ? 2 : 0}
                  minAngle={8}
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {r.donut.map((e) => (
                    <Cell key={e.name} fill={e.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={CHART_TOOLTIP}
                  formatter={(v, name) => [`${Number(v).toFixed(1)} t CO₂e`, name]}
                />
                <Legend />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="b2b-modelos-table-wrap">
          <h4>Por parcela</h4>
          {r.porParcela.length === 0 ? (
            <p className="b2b-modelos-tip">Sin parcelas en el snapshot.</p>
          ) : (
            <table className="b2b-modelos-table">
              <thead>
                <tr>
                  <th>Parcela</th>
                  <th>Estimado</th>
                  <th>Verificado</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {r.porParcela.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nombre}</td>
                    <td>{num(p.estimadoTon, 2)} t</td>
                    <td>{num(p.verificadoTon, 2)} t</td>
                    <td>{num(p.totalTon, 2)} t</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  )
}
