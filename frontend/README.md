# PencoLab Frontend (Prototipo)

Prototipo web con **hub raíz** y dos portales según rol JWT.

## Iniciar

```bash
cd frontend
npm install
npm run dev
```

Abre: http://localhost:5173 → `#/`

## Rutas

| Ruta | Pantalla |
|---|---|
| `#/` | Hub raíz: elige Agricultor o Empresa |
| `#/login?portal=productor` | Login / registro productor |
| `#/login?portal=empresa` | Login / registro empresa |
| `#/productor` | Guía de siembra |
| `#/productor/bitacora` | Bitácora offline |
| `#/productor/metricas` | Métricas propias |
| `#/empresa` | Dashboard CO₂ |
| `#/empresa/mapa` | Mapa de parcelas |
| `#/empresa/alertas` | Alertas fitosanitarias |

Las rutas cruzadas se bloquean según el rol del token. Desde cada app puedes volver al hub con **Inicio**.
