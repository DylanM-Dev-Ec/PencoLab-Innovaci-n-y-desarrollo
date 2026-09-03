import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchDashboardEficiencia } from '../api'
import { B2B, CHART_GRID, CHART_TOOLTIP } from '../empresaTheme'
import { EMPRESA_DEMO } from '../empresaDemo'

const COLORS = {
  cert: B2B.teal,
  trad: B2B.gray,
  euc: B2B.slateLight,
  penco: B2B.forest,
  hito: B2B.tealSoft,
}

export default function EficienciaMexico({ token, demo }) {
  const [ha, setHa] = useState(1)
  const [data, setData] = useState(EMPRESA_DEMO.eficiencia)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetchDashboardEficiencia(token, ha)
        if (!cancelled) {
          setData(res?.proyeccion_cosecha?.length || res?.roi ? res : EMPRESA_DEMO.eficiencia)
        }
      } catch {
        if (!cancelled) {
          const demoData = structuredClone(EMPRESA_DEMO.eficiencia)
          demoData.roi = recalcRoi(ha)
          setData(demoData)
        }
      }
    }
    if (demo) {
      const demoData = structuredClone(EMPRESA_DEMO.eficiencia)
      demoData.roi = recalcRoi(ha)
      setData(demoData)
      return () => {
        cancelled = true
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token, ha, demo])

  const perdidasChart = useMemo(
    () =>
      (data.perdidas_fitosanitarias || []).map((p) => ({
        modelo: p.modelo,
        mortalidad_pct: p.mortalidad_pct,
        supervivencia_pct: p.supervivencia_pct,
        plantas_perdidas: p.plantas_perdidas,
        plantas_vivas: p.plantas_vivas,
      })),
    [data]
  )

  const roi = data.roi || recalcRoi(ha)
  const gancho = roi.multiplicador

  return (
    <div className="eficiencia-mexico">
      <div className="card guia-header">
        <p className="guia-kicker">Modelo de eficiencia de campo · México</p>
        <h2>Panel operativo Pencos del Norte</h2>
        <p>
          Proyección de piñas, impacto fitosanitario del protocolo certificado y retorno frente al
          eucalipto.
        </p>
      </div>

      <div className="card chart-card">
        <h3>Proyección de cosecha · estimación de piñas</h3>
        <p>
          Basado en fechas de siembra: cuántos corazones de penco estarán listos a los 5, 8 y 12 años
          (con supervivencia certificada vs tradicional).
        </p>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.proyeccion_cosecha || []}>
              <CartesianGrid {...CHART_GRID} vertical={false} />
              <XAxis dataKey="hito" stroke={B2B.slateLight} tick={{ fill: B2B.slateLight, fontSize: 12 }} />
              <YAxis
                stroke={B2B.slateLight}
                tick={{ fill: B2B.slateLight, fontSize: 12 }}
                label={{ value: 'Piñas proyectadas', angle: -90, position: 'insideLeft', fill: B2B.slate, fontSize: 11 }}
              />
              <Tooltip contentStyle={CHART_TOOLTIP} />
              <Legend />
              <Bar dataKey="pinas_certificadas_vivas" name="Certificadas vivas (<5% pérdida)" fill={COLORS.cert} radius={[6, 6, 0, 0]} />
              <Bar dataKey="pinas_tradicionales_vivas" name="Tradicional (30% mortalidad)" fill={COLORS.trad} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="hito-notes">
          {(data.proyeccion_cosecha || []).map((h) => (
            <p key={h.hito} className="muted">
              <strong>{h.hito}:</strong> {h.descripcion}
            </p>
          ))}
        </div>
      </div>

      <div className="card chart-card">
        <h3>Reducción de pérdidas fitosanitarias</h3>
        <p>
          Tradicional sin desinfección/cicatrización: <strong>30% mortalidad</strong>. Lotes
          certificados (fuego + 10 días al sol): <strong>&lt;5%</strong>.
        </p>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={perdidasChart}>
              <CartesianGrid {...CHART_GRID} vertical={false} />
              <XAxis dataKey="modelo" stroke={B2B.slateLight} tick={{ fill: B2B.slateLight, fontSize: 12 }} />
              <YAxis
                stroke={B2B.slateLight}
                tick={{ fill: B2B.slateLight, fontSize: 12 }}
                unit="%"
                label={{ value: 'Porcentaje', angle: -90, position: 'insideLeft', fill: B2B.slate, fontSize: 11 }}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP}
                formatter={(v, name) => [`${Number(v).toFixed(1)}%`, name]}
              />
              <Legend />
              <Bar dataKey="mortalidad_pct" name="Mortalidad %" radius={[6, 6, 0, 0]}>
                {perdidasChart.map((entry) => (
                  <Cell key={entry.modelo} fill={entry.modelo.includes('Certificado') ? COLORS.cert : COLORS.trad} />
                ))}
              </Bar>
              <Bar dataKey="supervivencia_pct" name="Supervivencia %" fill={COLORS.hito} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="plan-stats">
          {(data.perdidas_fitosanitarias || []).map((p) => (
            <div key={p.modelo} className="plan-stat">
              <strong>{p.plantas_vivas.toLocaleString()}</strong>
              <span>vivas · {p.modelo}</span>
            </div>
          ))}
          <div className="plan-stat">
            <strong>
              {(
                (data.perdidas_fitosanitarias?.[0]?.mortalidad_pct || 30) -
                (data.perdidas_fitosanitarias?.[1]?.mortalidad_pct || 4)
              ).toFixed(0)}
              pts
            </strong>
            <span>menos mortalidad</span>
          </div>
        </div>
      </div>

      <div className="card chart-card roi-card">
        <h3>Retorno de inversión agrícola · el gancho del cliente</h3>
        <p>
          Eucalipto: <strong>$20/árbol</strong> a 12 años. Penco certificado alta densidad:{' '}
          <strong>$160/planta</strong> por venta garantizada de chawarmishky.
        </p>
        <div className="form-group">
          <label>Hectáreas a simular</label>
          <input
            type="number"
            min="0.25"
            max="100"
            step="0.25"
            value={ha}
            onChange={(e) => setHa(Math.max(0.25, parseFloat(e.target.value) || 1))}
          />
        </div>

        <div className="roi-duel">
          <div className="roi-side euc">
            <h4>Eucalipto</h4>
            <p className="roi-price">${roi.eucalipto.usd_por_arbol_12a}</p>
            <p className="muted">por árbol · 12 años</p>
            <p>
              {roi.eucalipto.arboles.toLocaleString()} árboles ·{' '}
              <strong>${roi.eucalipto.ingreso_total_usd.toLocaleString()}</strong>
            </p>
          </div>
          <div className="roi-vs">
            <span>×{gancho}</span>
            <small>más ingreso</small>
          </div>
          <div className="roi-side penco">
            <h4>Penco certificado</h4>
            <p className="roi-price">${roi.penco_certificado.usd_por_planta}</p>
            <p className="muted">por planta · chawarmishky</p>
            <p>
              {roi.penco_certificado.plantas.toLocaleString()} plantas ·{' '}
              <strong>${roi.penco_certificado.ingreso_total_usd.toLocaleString()}</strong>
            </p>
          </div>
        </div>

        <div className="chart-box">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={roi.comparativo_grafico || []}>
              <CartesianGrid {...CHART_GRID} vertical={false} />
              <XAxis dataKey="cultivo" stroke={B2B.slateLight} tick={{ fill: B2B.slateLight, fontSize: 12 }} />
              <YAxis
                stroke={B2B.slateLight}
                tick={{ fill: B2B.slateLight, fontSize: 12 }}
                label={{ value: 'USD', angle: -90, position: 'insideLeft', fill: B2B.slate, fontSize: 11 }}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP}
                formatter={(v, name) => [
                  `$${Number(v).toLocaleString()}`,
                  name === 'usd_por_unidad' ? 'USD / unidad' : 'USD / ha',
                ]}
              />
              <Legend />
              <Bar dataKey="usd_por_unidad" name="USD / unidad" fill={COLORS.euc} radius={[6, 6, 0, 0]} />
              <Bar dataKey="ingreso_ha_usd" name="USD / ha" fill={COLORS.penco} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="alert success">
          En {ha} ha, el modelo certificado genera aproximadamente{' '}
          <strong>×{gancho}</strong> el ingreso del eucalipto, con compra garantizada de aguamiel.
        </div>
      </div>
    </div>
  )
}

function recalcRoi(hectareas) {
  const ha = Math.max(0.25, Number(hectareas) || 1)
  const eucArboles = Math.floor(1100 * ha)
  const pencoPlantas = Math.floor(2222 * ha * 0.9)
  const eucTotal = eucArboles * 20
  const pencoTotal = pencoPlantas * 160
  return {
    hectareas: ha,
    eucalipto: {
      arboles: eucArboles,
      usd_por_arbol_12a: 20,
      ingreso_total_usd: eucTotal,
      densidad_ha: 1100,
      horizonte_anios: 12,
    },
    penco_certificado: {
      plantas: pencoPlantas,
      usd_por_planta: 160,
      ingreso_total_usd: pencoTotal,
      densidad_ha: 2222,
      fuente: 'Venta garantizada de chawarmishky (aguamiel)',
    },
    multiplicador: Math.round((pencoTotal / Math.max(eucTotal, 1)) * 10) / 10,
    comparativo_grafico: [
      { cultivo: 'Eucalipto (12 a)', usd_por_unidad: 20, ingreso_ha_usd: 1100 * 20 },
      { cultivo: 'Penco certificado', usd_por_unidad: 160, ingreso_ha_usd: Math.floor(2222 * 0.9) * 160 },
    ],
  }
}
