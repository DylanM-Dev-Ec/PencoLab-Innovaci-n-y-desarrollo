/** Iconos personalizados PencoLab (inspirados en penco/agave). */
export const ICONS = {
  logo: '/icons/icon-penco-logo.png',
  tierra: '/icons/icon-tierra.png',
  plantar: '/icons/icon-plantar.png',
  plata: '/icons/icon-plata.png',
  campo: '/icons/icon-campo.png',
  mide: '/icons/icon-mide.png',
  empresa: '/icons/icon-empresa.png',
  co2: '/icons/icon-co2.png',
  productores: '/icons/icon-productores.png',
  hectareas: '/icons/icon-hectareas.png',
  alerta: '/icons/icon-alerta.png',
  anotar: '/icons/icon-anotar.png',
  guia: '/icons/icon-guia.png',
  costos: '/icons/icon-costos.png',
  bitacora: '/icons/icon-bitacora.png',
  // Glyphs pequeños (acciones / estados)
  'ph-acido': '/icons/glyph-ph-acido.png',
  'ph-alcalino': '/icons/glyph-ph-alcalino.png',
  'ph-optimo': '/icons/glyph-ph-optimo.png',
  'ph-atencion': '/icons/glyph-ph-atencion.png',
  firme: '/icons/glyph-firme.png',
  fuego: '/icons/glyph-fuego.png',
  pasta: '/icons/glyph-pasta.png',
  sol: '/icons/glyph-sol.png',
  papa: '/icons/glyph-papa.png',
  apisonar: '/icons/glyph-apisonar.png',
  surcos: '/icons/glyph-surcos.png',
  check: '/icons/glyph-check.png',
  regla: '/icons/glyph-regla.png',
  invierno: '/icons/glyph-invierno.png',
  primavera: '/icons/glyph-primavera.png',
  cochinilla: '/icons/glyph-cochinilla.png',
  erwinia: '/icons/glyph-erwinia.png',
  picudo: '/icons/glyph-picudo.png',
  penco: '/icons/glyph-penco-planta.png',
  fibra: '/icons/glyph-fibra.png',
  kirillas: '/icons/glyph-kirillas.png',
  madera: '/icons/glyph-madera.png',
  abono: '/icons/glyph-abono.png',
  semilla: '/icons/glyph-semilla.png',
  quinoa: '/icons/glyph-quinoa.png',
  chocho: '/icons/glyph-chocho.png',
  poda: '/icons/glyph-poda.png',
  encharque: '/icons/glyph-encharque.png',
  riego: '/icons/glyph-riego.png',
}

export function AppIcon({ name, alt = '', className = '', size }) {
  if (name === 'qr') {
    const style = size ? { width: size, height: size } : undefined
    return (
      <svg
        className={`app-icon app-icon-svg ${className}`.trim()}
        style={style}
        viewBox="0 0 48 48"
        aria-hidden={alt ? undefined : true}
        role={alt ? 'img' : undefined}
      >
        {alt ? <title>{alt}</title> : null}
        <rect width="48" height="48" rx="12" fill="#e8f5e9" />
        <rect x="8" y="8" width="14" height="14" rx="2" fill="#0d4f36" />
        <rect x="26" y="8" width="14" height="14" rx="2" fill="#0d4f36" />
        <rect x="8" y="26" width="14" height="14" rx="2" fill="#0d4f36" />
        <rect x="11" y="11" width="8" height="8" rx="1" fill="#e8f5e9" />
        <rect x="29" y="11" width="8" height="8" rx="1" fill="#e8f5e9" />
        <rect x="11" y="29" width="8" height="8" rx="1" fill="#e8f5e9" />
        <rect x="26" y="26" width="5" height="5" fill="#0d4f36" />
        <rect x="33" y="26" width="7" height="3" fill="#0d4f36" />
        <rect x="26" y="33" width="3" height="7" fill="#0d4f36" />
        <rect x="35" y="33" width="5" height="5" fill="#0d4f36" />
      </svg>
    )
  }
  const src = ICONS[name]
  if (!src) return null
  const style = size ? { width: size, height: size } : undefined
  return <img src={src} alt={alt} className={`app-icon ${className}`.trim()} style={style} draggable={false} />
}
