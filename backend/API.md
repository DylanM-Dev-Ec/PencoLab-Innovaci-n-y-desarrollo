# PencoLab Backend API

## Iniciar servidor

```bash
cd backend
python -m pip install -r requirements.txt
# .env usa SQLite local por defecto (pencolab.db)
python -m uvicorn app.main:app --reload --port 8000
```

Documentación interactiva: http://localhost:8000/docs

## Autenticación

| Método | URL | Descripción |
|---|---|---|
| `POST` | `/api/auth/register` | Crea usuario, cifra la contraseña con bcrypt y, si el rol es `productor`, vincula un perfil en `productores` |
| `POST` | `/api/auth/login` | Valida credenciales y devuelve un JWT con `id`, `rol` y `productor_id` (si aplica) |

El JWT incluye claims: `id`, `rol` (`productor` \| `empresa`) y `productor_id`.

## Endpoints principales

### CRUD
| Recurso | Base URL |
|---|---|
| Productores | `GET/POST /api/v1/productores` |
| Parcelas | `GET/POST /api/v1/parcelas` |
| Plantas | `GET/POST /api/v1/plantas` |
| Mediciones | `GET/POST /api/v1/mediciones` |
| Bitácora | `GET/POST /api/v1/bitacora` |

Cada recurso incluye `GET/PATCH/DELETE /{id}`.

### Sincronización offline-first
| Método | URL | Descripción |
|---|---|---|
| `POST` | `/api/v1/sync/push` | Sube datos creados offline desde el móvil |
| `GET` | `/api/v1/sync/pull?productor_id=...&since=...` | Descarga cambios del servidor |

## Reglas automáticas

- **Parcelas**: al guardar `ph`, se calcula `recomendacion_ph` (cal/composta o yeso/azufre).
- **Plantas**: se valida `hijuelo_apto` según peso, roseta y edad de planta madre.
- **Mediciones**: con `calcular_carbono=true` se estima biomasa, carbono y CO₂ equivalente.
- **Bitácora**: soporta riego, poda sanitaria, fitosanitarios y scouting con GPS + JSON flexible.

## Ejemplo sync push

```json
{
  "productor_id": "uuid-del-productor",
  "parcelas": [],
  "plantas": [],
  "mediciones": [],
  "bitacora": [
    {
      "id": "uuid-local",
      "productor_id": "uuid-del-productor",
      "parcela_id": "uuid-parcela",
      "tipo": "riego",
      "fecha_programada": "2026-03-21",
      "estado": "completada",
      "gps_lat": -0.18,
      "gps_lng": -78.47,
      "datos": {"estacion": "invierno", "litros": 30}
    }
  ]
}
```
