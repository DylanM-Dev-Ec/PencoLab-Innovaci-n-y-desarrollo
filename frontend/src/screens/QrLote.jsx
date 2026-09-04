import { useEffect, useMemo, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { AppIcon } from '../components/AppIcon'
import {
  buildParcelaFicha,
  formatFecha,
  parseParcelaQr,
  qrDataUrl,
} from '../utils/parcelaQr'

export default function QrLote({ data, scope }) {
  const [mode, setMode] = useState('aprender') // aprender | generar | escanear
  const [parcelaId, setParcelaId] = useState(scope.parcelas[0]?.id || '')
  const [qrImg, setQrImg] = useState(null)
  const [scanResult, setScanResult] = useState(null)
  const [scanError, setScanError] = useState(null)
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef(null)
  const boxId = 'pencolab-qr-reader'

  const parcela = useMemo(
    () => scope.parcelas.find((p) => p.id === parcelaId) || scope.parcelas[0],
    [scope.parcelas, parcelaId]
  )

  const fichaLive = useMemo(
    () => (parcela ? buildParcelaFicha(parcela, scope.plantas, scope.bitacora) : null),
    [parcela, scope.plantas, scope.bitacora]
  )

  useEffect(() => {
    if (!scope.parcelas.length) {
      setParcelaId('')
      return
    }
    if (!scope.parcelas.some((p) => p.id === parcelaId)) {
      setParcelaId(scope.parcelas[0].id)
    }
  }, [scope.parcelas, parcelaId])

  useEffect(() => {
    let cancelled = false
    async function make() {
      if (!fichaLive || mode !== 'generar') {
        setQrImg(null)
        return
      }
      const url = await qrDataUrl(fichaLive)
      if (!cancelled) setQrImg(url)
    }
    make()
    return () => {
      cancelled = true
    }
  }, [fichaLive, mode])

  useEffect(() => {
    return () => {
      stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startScanner() {
    setScanError(null)
    setScanResult(null)
    setScanning(true)
    try {
      const cameras = await Html5Qrcode.getCameras()
      if (!cameras?.length) {
        setScanError('No hay cámara disponible.')
        setScanning(false)
        return
      }
      const camId = cameras.find((c) => /back|rear|environment/i.test(c.label))?.id || cameras[0].id
      const scanner = new Html5Qrcode(boxId)
      scannerRef.current = scanner
      await scanner.start(
        camId,
        { fps: 8, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          const parsed = parseParcelaQr(decoded)
          if (parsed) {
            const live = scope.parcelas.find((p) => p.id === parsed.parcela_id)
            const refreshed = live
              ? buildParcelaFicha(live, scope.plantas, scope.bitacora)
              : parsed
            setScanResult(refreshed)
            stopScanner()
          } else {
            setScanError('Este QR no es de PencoLab.')
          }
        },
        () => {}
      )
    } catch (e) {
      setScanError(e?.message || 'No se pudo abrir la cámara.')
      setScanning(false)
    }
  }

  async function stopScanner() {
    const scanner = scannerRef.current
    scannerRef.current = null
    setScanning(false)
    if (!scanner) return
    try {
      if (scanner.isScanning) await scanner.stop()
      await scanner.clear()
    } catch {
      /* ignore */
    }
  }

  function onMode(next) {
    if (mode === 'escanear') stopScanner()
    setMode(next)
    setScanError(null)
    if (next !== 'escanear') setScanResult(null)
  }

  return (
    <div className="qr-screen">
      <div className="m-card qr-teach">
        <AppIcon name="qr" alt="" className="glyph-lg" />
        <h2>Código QR del lote</h2>
        <p>
          Cada parcela necesita un <strong>QR físico</strong> en el campo. Al escanearlo verás área,
          fecha de establecimiento, plantas vivas, último riego y fertilización.
        </p>
        <ol className="qr-steps">
          <li>Genera el QR del lote</li>
          <li>Imprímelo o guárdalo en el teléfono</li>
          <li>Colócalo en un letrero del cuartel</li>
          <li>Escanea con la cámara para consultar</li>
        </ol>
      </div>

      <div className="m-chip-row qr-modes">
        {[
          { id: 'aprender', label: 'Guía' },
          { id: 'generar', label: 'Generar' },
          { id: 'escanear', label: 'Escanear' },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            className={`m-chip ${mode === m.id ? 'on' : ''}`}
            onClick={() => onMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'aprender' && (
        <div className="m-card">
          <FichaPreview
            ficha={{
              nombre: 'Ejemplo · Loma Norte',
              area: 1.5,
              fecha_establecimiento: '2024-06-12',
              plantas_vivas: 2800,
              ultimo_riego: '2026-08-20',
              fertilizacion: '2026-07-05',
            }}
            demo
          />
        </div>
      )}

      {mode === 'generar' && (
        <>
          {!scope.parcelas.length ? (
            <div className="m-toast warn">Primero crea un lote en Lote o Suelo</div>
          ) : (
            <div className="m-card">
              <select
                className="m-select"
                value={parcela?.id || ''}
                onChange={(e) => setParcelaId(e.target.value)}
              >
                {scope.parcelas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              {qrImg && (
                <div className="qr-print">
                  <img src={qrImg} alt={`QR ${fichaLive?.nombre}`} className="qr-img" />
                  <strong>{fichaLive?.nombre}</strong>
                  <p>Pega este código en el lote</p>
                </div>
              )}
              {fichaLive && <FichaPreview ficha={fichaLive} />}
              {qrImg && (
                <a className="m-btn" href={qrImg} download={`pencolab-qr-${fichaLive?.nombre || 'lote'}.png`}>
                  Descargar QR
                </a>
              )}
            </div>
          )}
        </>
      )}

      {mode === 'escanear' && (
        <div className="m-card">
          <div id={boxId} className="qr-reader-box" />
          {!scanning && !scanResult && (
            <button type="button" className="m-btn" onClick={startScanner}>
              Abrir cámara
            </button>
          )}
          {scanning && (
            <button type="button" className="m-btn ghost" onClick={stopScanner}>
              Cerrar cámara
            </button>
          )}
          {scanError && <div className="m-toast warn">{scanError}</div>}
          {scanResult && (
            <>
              <div className="m-toast success">QR leído</div>
              <FichaPreview ficha={scanResult} />
              <button
                type="button"
                className="m-btn"
                onClick={() => {
                  setScanResult(null)
                  startScanner()
                }}
              >
                Escanear otro
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function FichaPreview({ ficha, demo = false }) {
  if (!ficha) return null
  const rows = [
    { label: 'Área', value: ficha.area != null ? `${ficha.area} ha` : '—' },
    { label: 'Fecha de establecimiento', value: formatFecha(ficha.fecha_establecimiento) },
    { label: 'Nº de plantas vivas', value: ficha.plantas_vivas ?? '—' },
    { label: 'Estado del lote', value: ficha.estado_lote || 'Sin registrar' },
    { label: 'Último riego', value: formatFecha(ficha.ultimo_riego) },
    { label: 'Fertilización', value: formatFecha(ficha.fertilizacion) },
  ]
  return (
    <div className={`qr-ficha ${demo ? 'demo' : ''}`}>
      <h3>{ficha.nombre || 'Lote'}</h3>
      <ul>
        {rows.map((r) => (
          <li key={r.label}>
            <span>{r.label}</span>
            <strong>{r.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
