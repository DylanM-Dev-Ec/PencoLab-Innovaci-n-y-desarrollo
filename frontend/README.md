# PencoLab Frontend (Prototipo)

Prototipo web mobile-first para gestión de cultivo de Penco con modo **offline-first**.

## Iniciar

```bash
cd frontend
npm install
npm run dev
```

Abre: http://localhost:5173

## Pantallas

- **Inicio** — resumen, carbono total, sincronización
- **Parcelas** — georreferenciación + pH con recomendación automática
- **Plantas** — registro de hijuelos con validación agronómica
- **Medir** — mediciones de crecimiento + estimación de carbono
- **Bitácora** — riego, podas, fitosanitarios con GPS

## Offline-first

Los datos se guardan en `localStorage`. Al pulsar **Sincronizar**, intenta enviar al backend en `localhost:8000` vía proxy Vite.
