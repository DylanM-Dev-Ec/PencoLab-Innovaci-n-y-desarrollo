import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AppIcon } from '../components/AppIcon'
import { B2B, CHART_GRID, CHART_TOOLTIP } from '../empresaTheme'
import {
  analizarCostoAgricultor,
  analizarCostoEmpresa,
  COSTOS_AGRICULTOR_DEFAULT,
  COSTOS_EMPRESA_DEFAULT,
  litrosDesdeHa,
  PRECIO_VENTA_BOTELLA,
} from '../costosProduccion'

/**
 * Análisis sencillo de costo de producción.
 * mode: 'agricultor' | 'empresa'
 * readOnlyCampo: empresa no altera ha/densidad ni costos; usa datos del productor.
 */
export default function AnalisisCostos({
  mode = 'agricultor',
  residuos = [],
  hectareasFijas = null,
  readOnlyCampo = false,
}) {
  const haLocked =
    readOnlyCampo && hectareasFijas != null && Number(hectareasFijas) > 0
      ? Number(Number(hectareasFijas).toFixed(1))
      : null
  const [ha, setHa] = useState(haLocked ?? (mode === 'empresa' ? 8 : 3))
  const [densidad, setDensidad] = useState(1000)
  const [intercalado, setIntercalado] = useState('papa')
  const [costosAgri, setCostosAgri] = useState({ ...COSTOS_AGRICULTOR_DEFAULT })
  const [costosEmp, setCostosEmp] = useState({ ...COSTOS_EMPRESA_DEFAULT })
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    if (haLocked != null) setHa(haLocked)
  }, [haLocked])

  const haEff = haLocked ?? ha

  const circularUsd = useMemo(
    () => (residuos || []).reduce((s, r) => s + (Number(r.ingreso_adicional_usd) || 0), 0),
    [residuos]
  )

  const agri = useMemo(
    () => analizarCostoAgricultor(haEff, densidad, costosAgri, intercalado),
    [haEff, densidad, costosAgri, intercalado]
  )

  const litros = useMemo(() => litrosDesdeHa(haEff, densidad), [haEff, densidad])
  const emp = useMemo(
    () => analizarCostoEmpresa(litros, costosEmp, circularUsd),
    [litros, costosEmp, circularUsd]
  )

  const chartAgri = [
    { name: 'Costo', usd: agri.costo_total_usd, fill: '#94a3b8' },
    { name: 'Ingreso', usd: agri.ingreso_total_usd, fill: B2B.forest },
    { name: 'Margen', usd: Math.max(0, agri.margen_usd), fill: B2B.teal },
  ]
  const chartEmp = [
    { name: 'Costo', usd: emp.costo_total_usd, fill: '#94a3b8' },
    { name: 'Ingreso', usd: emp.ingreso_total_usd, fill: B2B.forest },
    { name: 'Margen', usd: Math.max(0, emp.margen_usd), fill: B2B.teal },
  ]

  return (
    <div className={`costos-screen ${mode}${readOnlyCampo ? ' readonly' : ''}`}>
      <header className="costos-hero">
        <AppIcon name={mode === 'empresa' ? 'empresa' : 'costos'} alt="" className="glyph-lg" />
        <p className="costos-kicker">
          {mode === 'empresa' ? 'Consola empresarial' : 'Portal agricultor'} · costos USD
          {readOnlyCampo ? ' · datos de campo fijos' : ''}
        </p>
        <h2>Costo de producción</h2>
        <p>
          {mode === 'empresa'
            ? 'Compra de chawarmishky, destilación, botellas a $2 y margen estimado. Residuos e hectáreas vienen del productor.'
            : 'Cuánto te cuesta establecer y mantener el lote frente al ingreso certificado.'}
        </p>
      </header>

      <section className="m-card costos-inputs">
        <div className="m-hero-num">
          <span>{mode === 'empresa' ? 'Hectáreas de la red' : 'Tus hectáreas'}</span>
          <div className="m-ph-big">{haEff}</div>
          {!readOnlyCampo && (
            <input
              type="range"
              min={1}
              max={20}
              step={0.5}
              value={ha}
              onChange={(e) => setHa(parseFloat(e.target.value))}
            />
          )}
          {readOnlyCampo && (
            <p className="costos-hint">Fijas según parcelas del productor</p>
          )}
        </div>
        {!readOnlyCampo && (
          <div className="m-chip-row">
            <button
              type="button"
              className={`m-chip ${densidad === 1000 ? 'on' : ''}`}
              onClick={() => setDensidad(1000)}
            >
              1 000 pl/ha
            </button>
            <button
              type="button"
              className={`m-chip ${densidad === 2222 ? 'on' : ''}`}
              onClick={() => setDensidad(2222)}
            >
              2 222 pl/ha
            </button>
          </div>
        )}
        {readOnlyCampo && (
          <p className="costos-hint">
            Densidad de cálculo: {densidad} pl/ha · ingreso circular reportado: ${circularUsd.toFixed(0)}
          </p>
        )}
        {mode === 'agricultor' && (
          <>
            <p className="costos-label">Intercalado (ingreso corto plazo)</p>
            <div className="m-chip-row">
              {[
                { id: 'papa', label: 'Papa', icon: 'papa' },
                { id: 'quinoa', label: 'Quinoa', icon: 'quinoa' },
                { id: 'chocho', label: 'Chocho', icon: 'chocho' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`m-chip ${intercalado === c.id ? 'on' : ''}`}
                  onClick={() => setIntercalado(c.id)}
                >
                  <AppIcon name={c.icon} alt="" className="glyph-xs" />
                  {c.label}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {mode === 'agricultor' ? (
        <ResultadosAgricultor agri={agri} chart={chartAgri} />
      ) : (
        <ResultadosEmpresa emp={emp} chart={chartEmp} litros={litros} />
      )}

      {!readOnlyCampo && (
        <button type="button" className="m-btn ghost" onClick={() => setShowDetail((v) => !v)}>
          {showDetail ? 'Ocultar costos unitarios' : 'Ajustar costos unitarios'}
        </button>
      )}

      {showDetail && !readOnlyCampo && mode === 'agricultor' && (
        <section className="m-card costos-edit">
          <h3>Costos por hectárea (USD)</h3>
          {Object.entries(costosAgri).map(([key, val]) => (
            <label key={key} className="costos-field">
              <span>{labelCostoAgri(key)}</span>
              <input
                type="number"
                min="0"
                step="5"
                value={val}
                onChange={(e) => setCostosAgri({ ...costosAgri, [key]: parseFloat(e.target.value) || 0 })}
              />
            </label>
          ))}
        </section>
      )}

      {showDetail && !readOnlyCampo && mode === 'empresa' && (
        <section className="m-card costos-edit">
          <h3>Costos por litro (USD)</h3>
          {Object.entries(costosEmp).map(([key, val]) => (
            <label key={key} className="costos-field">
              <span>{labelCostoEmp(key)}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={val}
                onChange={(e) => setCostosEmp({ ...costosEmp, [key]: parseFloat(e.target.value) || 0 })}
              />
            </label>
          ))}
          <p className="costos-hint">Venta referencial: ${PRECIO_VENTA_BOTELLA}/botella (1 L)</p>
        </section>
      )}
    </div>
  )
}

function ResultadosAgricultor({ agri, chart }) {
  return (
    <>
      <div className="costos-kpis">
        <article>
          <span>Costo total</span>
          <strong>${agri.costo_total_usd.toLocaleString()}</strong>
          <small>${agri.costo_por_ha_usd}/ha · ${agri.costo_por_planta_usd}/planta</small>
        </article>
        <article className="ok">
          <span>Ingreso estimado</span>
          <strong>${agri.ingreso_total_usd.toLocaleString()}</strong>
          <small>
            Penco ${agri.ingreso_penco_usd.toLocaleString()} + intercalado $
            {agri.ingreso_intercalado_usd.toLocaleString()}
          </small>
        </article>
        <article className={agri.margen_usd >= 0 ? 'ok' : 'bad'}>
          <span>Margen</span>
          <strong>${agri.margen_usd.toLocaleString()}</strong>
          <small>{agri.margen_pct}% · equilibrio ~{agri.punto_equilibrio_plantas} plantas</small>
        </article>
      </div>
      <ChartBlock data={chart} />
      <Desglose items={agri.desglose} total={agri.costo_total_usd} />
    </>
  )
}

function ResultadosEmpresa({ emp, chart, litros }) {
  return (
    <>
      <div className="costos-kpis">
        <article>
          <span>Costo total</span>
          <strong>${emp.costo_total_usd.toLocaleString()}</strong>
          <small>
            ${emp.costo_por_litro_usd}/L · {litros.toLocaleString()} L · {emp.botellas.toLocaleString()}{' '}
            botellas
          </small>
        </article>
        <article className="ok">
          <span>Ingreso estimado</span>
          <strong>${emp.ingreso_total_usd.toLocaleString()}</strong>
          <small>
            Botellas ${emp.ingreso_botellas_usd.toLocaleString()}
            {emp.ingreso_circular_usd > 0
              ? ` + circular $${emp.ingreso_circular_usd.toLocaleString()}`
              : ''}
          </small>
        </article>
        <article className={emp.margen_usd >= 0 ? 'ok' : 'bad'}>
          <span>Margen</span>
          <strong>${emp.margen_usd.toLocaleString()}</strong>
          <small>
            {emp.margen_pct}% · ${emp.margen_por_botella_usd}/botella
          </small>
        </article>
      </div>
      <ChartBlock data={chart} />
      <Desglose items={emp.desglose} total={emp.costo_total_usd} />
    </>
  )
}

function ChartBlock({ data }) {
  return (
    <div className="costos-chart m-card">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...CHART_GRID} vertical={false} />
          <XAxis dataKey="name" stroke={B2B.slateLight} tick={{ fontSize: 12 }} />
          <YAxis stroke={B2B.slateLight} tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
          <Tooltip contentStyle={CHART_TOOLTIP} formatter={(v) => [`$${Number(v).toLocaleString()}`, 'USD']} />
          <Bar dataKey="usd" radius={[8, 8, 0, 0]} maxBarSize={48}>
            {data.map((e) => (
              <Cell key={e.name} fill={e.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Desglose({ items, total }) {
  return (
    <ul className="costos-desglose">
      {items.map((d) => (
        <li key={d.id}>
          <span>{d.label}</span>
          <strong>${d.usd.toLocaleString()}</strong>
          <i style={{ width: `${total > 0 ? Math.min(100, (d.usd / total) * 100) : 0}%` }} />
        </li>
      ))}
    </ul>
  )
}

function labelCostoAgri(key) {
  const map = {
    hijuelos_usd_ha: 'Hijuelos / material',
    mano_obra_siembra_usd_ha: 'Mano de obra siembra',
    zanjas_terrazas_usd_ha: 'Zanjas / terrazas',
    mantenimiento_anual_usd_ha: 'Mantenimiento anual',
    cosecha_chawado_usd_ha: 'Cosecha / chawado',
    transporte_campo_usd_ha: 'Transporte',
  }
  return map[key] || key
}

function labelCostoEmp(key) {
  const map = {
    compra_litro_usd: 'Compra al productor / L',
    destilacion_usd_l: 'Destilación / L',
    embotellado_usd_l: 'Embotellado / L',
    logistica_usd_l: 'Logística / L',
    certificacion_usd_l: 'Certificación / L',
    admin_usd_l: 'Administración / L',
  }
  return map[key] || key
}
