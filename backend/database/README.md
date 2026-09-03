# Base de Datos - PencoLab Backend

## Stack

- PostgreSQL
- SQLAlchemy 2.0 (modelos ORM)
- Alembic (migraciones)

## Tablas principales

| Tabla | Descripción |
|---|---|
| `productores` | Agricultores registrados en la app |
| `parcelas` | Terrenos georreferenciados con pH, tipo de suelo, trazado y meta de expansión |
| `plantas` | Pencos (hijuelos/semillas) con validación agronómica |
| `mediciones_crecimiento` | Mediciones periódicas con estimación de carbono |
| `bitacora_campo` | Bitácora offline-first (riego, podas, fitosanitarios, scouting) |
| `vivero_semillas` | Monitoreo de germinación (~5% teórico) |
| `recoleccion_jornada` | Recolección de chawarmishky por mujeres (Pacto de Verano) |
| `inventario_residuos` | Economía circular (cabuya, kirillas, abono, chawarqueros) |
| `produccion_mensual` | Destilación y ventas a $2 USD/L |

## Reglas de negocio integradas

- **pH**: recomendación automática vía `app/utils/agronomia.py`
- **Hijuelos**: validación de aptitud (peso 1.5–3 kg, roseta 8–11 cm, madre 3–5 años)
- **Propagación mixta**: `tipo_propagacion` hijuelo|semilla; vivero con tasa real vs ~5%
- **Carbono**: distingue `estimado` vs `verificado_in_situ` en mediciones
- **Offline-first**: campo `synced_at` en parcelas, plantas, mediciones y bitácora
- **Economía circular**: residuos → canastas, alpargatas, encurtidos, compost, vigas
- **Meta expansión**: `metas_expansion_ha` default 20.0; precio embotellado $2/L

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
