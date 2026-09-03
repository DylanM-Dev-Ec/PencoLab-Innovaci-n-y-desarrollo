# Base de Datos - PencoLab Backend

## Stack

- PostgreSQL
- SQLAlchemy 2.0 (modelos ORM)
- Alembic (migraciones)

## Tablas principales

| Tabla | Descripción |
|---|---|
| `productores` | Agricultores registrados en la app |
| `parcelas` | Terrenos georreferenciados con pH y tipo de suelo |
| `plantas` | Pencos/hijuelos individuales con validación agronómica |
| `mediciones_crecimiento` | Mediciones periódicas con estimación de carbono |
| `bitacora_campo` | Bitácora offline-first (riego, podas, fitosanitarios, scouting) |

## Reglas de negocio integradas

- **pH**: recomendación automática vía `app/utils/agronomia.py`
- **Hijuelos**: validación de aptitud (peso 1.5–3 kg, roseta 8–11 cm, madre 3–5 años)
- **Carbono**: distingue `estimado` vs `verificado_in_situ` en mediciones
- **Offline-first**: campo `synced_at` en parcelas, plantas, mediciones y bitácora

## Migraciones

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Editar DATABASE_URL en .env

alembic upgrade head
```

## Crear nueva migración

```bash
alembic revision --autogenerate -m "descripcion del cambio"
alembic upgrade head
```
