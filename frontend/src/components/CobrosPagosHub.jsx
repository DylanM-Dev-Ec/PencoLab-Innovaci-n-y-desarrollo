import { useMemo } from 'react'
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
import { B2B, CHART_GRID, CHART_TOOLTIP } from '../empresaTheme'
import {
  REGLAS_PAGO,
  consolidarCobrosPagos,
  demoCarteraCobros,
} from '../cobrosEmpresa'
import { navigate } from '../routing'

function money(n) {
  return `$${Number(n || 0).toLocaleString('es-EC', { maximumFractionDigits: 2 })}`
}

function formatFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Consola B2B: pagos a productores, deudas del Pacto Social y cobros.
 */
export default function CobrosPagosHub({ campoData }) {
  const live = useMemo(() => consolidarCobrosPagos(campoData || {}), [campoData])
  const r = live.sinDatosMercado ? demoCarteraCobros() : live
  const usandoDemo = live.sinDatosMercado
  const t = r.tarifas

  const barras = [
    { nombre: 'Por cobrar (Pacto)', usd: r.porCobrarUsd, fill: B2B.warn },
    { nombre: 'Efectivo recibido', usd: r.efectivoUsd, fill: B2B.teal },
    { nombre: 'Pagar acopio (est.)', usd: r.pagoAcopioEstimadoUsd, fill: B2B.forest },
    { nombre: 'Venta botellas (est.)', usd: r.ingresoVentaEstimadoUsd, fill: B2B.slate },
  ]

  return (
    <div className="cobros-hub">
      <header className="cobros-hero">
        <p className="cobros-kicker">Finanzas · Pencos del Norte</p>
        <h2>Pagos, deudas y cobros</h2>
        <p>
          Todo lo que la empresa debe saber: tarifas de acopio y venta, crédito del Pacto Social,
          deudas pendientes y pagos al productor por chawarmishky.
        </p>
      </header>

      {usandoDemo ? (
        <p className="cobros-banner">
          Aún no hay solicitudes del Mercado en el snapshot. Mostrando cartera de ejemplo. Cuando el
          productor solicite hijuelos a crédito, aparece aquí automáticamente.
        </p>
      ) : (
        <p className="cobros-banner ok">
          Datos del productor: {r.productor}. {r.creditoCount} a crédito · {r.efectivoCount} en
          efectivo · {r.ofertasCount} ofertas de hijuelos.
        </p>
      )}

      <section className="cobros-kpis" aria-label="Resumen financiero">
        <article>
          <span>Por cobrar (Pacto)</span>
          <strong>{money(r.porCobrarUsd)}</strong>
          <small>{r.porCobrarLitros} L de chawarmishky equivalentes</small>
        </article>
        <article>
          <span>Efectivo (solicitudes)</span>
          <strong>{money(r.efectivoUsd)}</strong>
          <small>{r.efectivoCount} pedidos pagados / por pagar en caja</small>
        </article>
        <article className="accent">
          <span>Pagar a productores (est.)</span>
          <strong>{money(r.pagoAcopioEstimadoUsd)}</strong>
          <small>Acopio temporada ≈ {r.litrosTemporadaEstimados} L × ${t.acopio_litro}/L</small>
        </article>
        <article className="accent">
          <span>Margen bruto est.</span>
          <strong>{money(r.margenBrutoEstimadoUsd)}</strong>
          <small>Venta destilada − acopio (sin costos fijos)</small>
        </article>
      </section>

      <div className="cobros-grid">
        <article className="cobros-card">
          <h3>Tarifario oficial</h3>
          <p className="cobros-sub">Precios que rigen cobros y pagos</p>
          <table className="cobros-table">
            <tbody>
              <tr>
                <td>Compra al productor (acopio)</td>
                <td>{money(t.acopio_litro)} / L</td>
              </tr>
              <tr>
                <td>Venta embotellada</td>
                <td>{money(t.venta_litro)} / L</td>
              </tr>
              <tr>
                <td>Hijuelo certificado</td>
                <td>{money(t.hijuelo)} c/u</td>
              </tr>
              <tr>
                <td>Semilla de penco</td>
                <td>{money(t.semilla)} c/u</td>
              </tr>
              <tr>
                <td>Referencia madurez</td>
                <td>{money(t.planta_madurez)} / planta</td>
              </tr>
              <tr>
                <td>Temporada de cobro</td>
                <td>
                  {t.litros_dia_planta} L/planta/día × {t.dias_temporada} d · {t.recolectoras}{' '}
                  recolectoras
                </td>
              </tr>
            </tbody>
          </table>
        </article>

        <article className="cobros-card">
          <h3>Flujo de caja (vista)</h3>
          <p className="cobros-sub">Cobrar vs pagar en el ciclo</p>
          <div className="cobros-chart">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barras} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid {...CHART_GRID} horizontal={false} />
                <XAxis type="number" stroke={B2B.slateLight} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="nombre"
                  width={120}
                  stroke={B2B.slateLight}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip contentStyle={CHART_TOOLTIP} formatter={(v) => [money(v), 'USD']} />
                <Bar dataKey="usd" radius={[0, 8, 8, 0]} maxBarSize={26}>
                  {barras.map((b) => (
                    <Cell key={b.nombre} fill={b.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <section className="cobros-card">
        <h3>Reglas que debes conocer</h3>
        <p className="cobros-sub">Cómo se pagan los pencos y cómo se cobra la deuda</p>
        <div className="cobros-reglas">
          {REGLAS_PAGO.map((regla) => (
            <article key={regla.id}>
              <strong>{regla.titulo}</strong>
              <p>{regla.detalle}</p>
            </article>
          ))}
        </div>
        <ol className="cobros-pasos">
          <li>
            <span>1</span>
            Productor pide hijuelos/semillas en Mercado (app agricultor).
          </li>
          <li>
            <span>2</span>
            Si elige <strong>Crédito del Pacto Social</strong>, nace una deuda en USD convertible a
            litros ({money(t.acopio_litro)}/L).
          </li>
          <li>
            <span>3</span>
            En verano entrega chawarmishky: se descuenta de la deuda o se paga en efectivo al
            productor.
          </li>
          <li>
            <span>4</span>
            La empresa destila y vende a {money(t.venta_litro)}/L; el productor recibe acopio preferencial.
          </li>
        </ol>
      </section>

      <section className="cobros-card">
        <div className="cobros-card-head">
          <div>
            <h3>Cartera · Pacto Social (por cobrar)</h3>
            <p className="cobros-sub">
              Deuda de productores que recibieron material a crédito. Se salda con litros.
            </p>
          </div>
          <button type="button" className="cobros-link" onClick={() => navigate('/empresa/modelos')}>
            Ver Modelos cosecha
          </button>
        </div>

        {r.deudas.length === 0 ? (
          <p className="cobros-empty">No hay deudas de Pacto Social pendientes.</p>
        ) : (
          <div className="cobros-table-wrap">
            <table className="cobros-table wide">
              <thead>
                <tr>
                  <th>Productor</th>
                  <th>Material</th>
                  <th>Cantidad</th>
                  <th>Deuda USD</th>
                  <th>Litros a entregar</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {r.deudas.map((d) => (
                  <tr key={d.id}>
                    <td>{d.productor}</td>
                    <td>{d.tipo === 'semillas' ? 'Semillas' : 'Hijuelos'}</td>
                    <td>{d.cantidad}</td>
                    <td>{money(d.usd)}</td>
                    <td>{d.litros_equivalentes} L</td>
                    <td>
                      <span className={`cobros-pill ${d.estado}`}>{d.estado}</span>
                    </td>
                    <td>{formatFecha(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="cobros-formula">
          Fórmula: deuda USD = unidades × precio material · litros = deuda ÷ ${t.acopio_litro}/L
          acopio
        </div>
      </section>

      <div className="cobros-grid">
        <article className="cobros-card">
          <h3>Qué debe pagar la empresa</h3>
          <ul className="cobros-list">
            <li>
              <strong>Acopio de savia</strong>
              <span>
                {money(t.acopio_litro)}/L al productor (preferencial). Estimado temporada:{' '}
                {money(r.pagoAcopioEstimadoUsd)}.
              </span>
            </li>
            <li>
              <strong>Ofertas de hijuelos</strong>
              <span>
                Si compras excedentes publicados: {money(t.hijuelo)}/u · cartera ofertas ≈{' '}
                {money(r.ofertasUsd)}.
              </span>
            </li>
            <li>
              <strong>Recolectoras (verano)</strong>
              <span>
                {t.recolectoras} mujeres en temporada seca · operación diaria de chawarmishky.
              </span>
            </li>
          </ul>
        </article>

        <article className="cobros-card">
          <h3>Qué debe cobrar la empresa</h3>
          <ul className="cobros-list">
            <li>
              <strong>Pacto Social</strong>
              <span>
                {money(r.porCobrarUsd)} pendientes ≈ {r.porCobrarLitros} L de chawarmishky.
              </span>
            </li>
            <li>
              <strong>Efectivo por material</strong>
              <span>
                Solicitudes de hijuelos/semillas pagadas en caja: {money(r.efectivoUsd)}.
              </span>
            </li>
            <li>
              <strong>Venta destilada</strong>
              <span>
                Botellas a {money(t.venta_litro)}/L · estimado temporada {money(r.ingresoVentaEstimadoUsd)}{' '}
                (con eficiencia de destilación).
              </span>
            </li>
          </ul>
        </article>
      </div>
    </div>
  )
}
