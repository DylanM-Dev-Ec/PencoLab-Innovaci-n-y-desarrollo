# PencoLab - Innovación y Desarrollo

## Estructura

```
PencoLab-Innovaci-n-y-desarrollo/
├── backend/      # FastAPI (Render)
├── frontend/     # React + Vite (Vercel)
├── render.yaml   # Blueprint opcional Render
└── .env.example  # Resumen de variables
```

## Despliegue rápido (equipo)

### 1. Backend en Render
1. New → Web Service (o Blueprint con `render.yaml`).
2. **Root Directory:** `backend`
3. **Build:** `pip install -r requirements.txt`
4. **Start:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Variables: ver `backend/.env.example` (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`).
6. Preferir **PostgreSQL** (SQLite en Render se pierde al reiniciar).

### 2. Frontend en Vercel
1. Importar el repo → **Root Directory:** `frontend`
2. Build: `npm run build` · Output: `dist` (ya en `frontend/vercel.json`)
3. Variable: `VITE_API_URL=https://TU-API.onrender.com` (sin `/` final)
4. En Render, pon `CORS_ORIGINS` con la URL de Vercel.

### Local
```bash
# API
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Web (proxy /api → :8000)
cd frontend && npm install && npm run dev
```

Variables de ejemplo: `frontend/.env.example`, `backend/.env.example`.
