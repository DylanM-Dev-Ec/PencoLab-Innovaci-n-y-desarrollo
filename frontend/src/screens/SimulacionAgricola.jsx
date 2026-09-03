import { useMemo, useState } from 'react'
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
import { calcularSimulacionAgricola } from '../store'
import { AppIcon } from '../components/AppIcon'

const TOOLTIP = {
  background: '#ffffff',
  border: '1px solid #e8eee9',
  borderRadius: 12,
  color: '#0f172a',
  boxShadow: '0 12px 28px rgba(13,79,54,0.1)',
}

export default function SimulacionAgricola() {
  const [form, setForm] = useState({ hectareas: '3', presupuesto: '2000' })
  const sim = useMemo(
    () => calcularSimulacionAgricola(form.hectareas, form.presupuesto),
    [form.hectareas, form.presupuesto]
  )

  return (
    <div className="m-sim">
      <div className="m-card">
        <div className="m-hero-num">
          <span>Hectáreas</span>
          <div className="m-stepper">
            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  hectareas: String(Math.max(0.25, +(parseFloat(form.hectareas) - 0.25).toFixed(2))),
                })
              }
            >
              −
            </button>
            <span>{form.hectareas}</span>
            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  hectareas: String(Math.min(50, +(parseFloat(form.hectareas) + 0.25).toFixed(2))),
                })
              }
            >
              +
            </button>
          </div>
        </div>
        <div className="m-hero-num">
          <span>Presupuesto $</span>
          <div className="m-stepper">
            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  presupuesto: String(Math.max(100, parseFloat(form.presupuesto) - 100)),
                })
              }
            >
              −
            </button>
            <span>{form.presupuesto}</span>
            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  presupuesto: String(Math.min(50000, parseFloat(form.presupuesto) + 100)),
                })
              }
            >
              +
            </button>
          </div>
        </div>
      </div>

      {sim && (
        <>
          <div className="m-stats">
            <div className="m-stat">
              <strong>{sim.pencos.toLocaleString()}</strong>
              <span>pencos</span>
            </div>
            <div className="m-stat accent">
              <strong>×{sim.multiplicador_vs_euc}</strong>
              <span>vs eucalipto</span>
            </div>
          </div>

          <div className="m-card">
            <div className="m-money">
              <div>
                <span className="m-money-lbl">
                  <AppIcon name="plantar" alt="" className="glyph-xs" /> Penco
                </span>
                <strong>${sim.ingreso_penco_lp.toLocaleString()}</strong>
              </div>
              <div>
                <span className="m-money-lbl">Eucalipto</span>
                <strong>${sim.ingreso_euc_lp.toLocaleString()}</strong>
              </div>
            </div>
            <div className="chart-box" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sim.comparativo_barras}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8eee9" />
                  <XAxis dataKey="nombre" stroke="#64748b" tick={{ fontSize: 12 }} />
                  <YAxis hide />
                  <Tooltip contentStyle={TOOLTIP} formatter={(v) => [`$${Number(v).toLocaleString()}`, '']} />
                  <Bar dataKey="usd" radius={[10, 10, 0, 0]}>
                    <Cell fill="#0d4f36" />
                    <Cell fill="#94a3b8" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="m-split">
            <div className="m-split-card fert">
              <span>40%</span>
              <strong>${sim.plan_inversion.fertilizante_fase1.toLocaleString()}</strong>
              <p>Fósforo + calcio</p>
            </div>
            <div className="m-split-card crop">
              <span>60%</span>
              <strong>${sim.plan_inversion.intercalado.toLocaleString()}</strong>
              <p>Papa / quinoa</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
