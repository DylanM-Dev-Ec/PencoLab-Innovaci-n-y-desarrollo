"""Smoke test for auth, sync, mediciones, incentivo."""
from datetime import date, timedelta
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Parcela, Planta
from app.models.enums import EstadoPlanta

client = TestClient(app)


def main() -> None:
    email = f"test_{uuid4().hex[:8]}@pencolab.ec"
    r = client.post(
        "/api/auth/register",
        json={"email": email, "password": "TestPass123", "rol": "productor", "nombre": "Test"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["id_usuario"] and body["rol"] == "productor" and body["productor_id"]
    assert body["access_token"]
    pid = body["productor_id"]
    print("auth OK", body["id_usuario"], pid)

    r = client.post("/api/auth/login", json={"email": email, "password": "TestPass123"})
    assert r.status_code == 200 and r.json()["id_usuario"] == body["id_usuario"]
    print("login OK")

    db = SessionLocal()
    parcela = Parcela(id=uuid4(), productor_id=UUID(pid), nombre="P1", ph=6.5)
    db.add(parcela)
    planta = Planta(
        id=uuid4(),
        parcela_id=parcela.id,
        fecha_siembra=date.today(),
        estado=EstadoPlanta.ACTIVA.value,
    )
    db.add(planta)
    chawada = Planta(
        id=uuid4(),
        parcela_id=parcela.id,
        fecha_siembra=date.today() - timedelta(days=400),
        estado=EstadoPlanta.CHAWADA.value,
    )
    db.add(chawada)
    db.commit()
    planta_id = str(planta.id)
    parcela_id = str(parcela.id)
    db.close()

    r = client.post(
        "/api/mediciones",
        json={
            "planta_id": planta_id,
            "fecha_medicion": str(date.today()),
            "altura_roseta_cm": 100,
            "diametro_roseta_cm": 40,
            "numero_hojas": 20,
        },
    )
    assert r.status_code == 201, r.text
    m = r.json()
    assert m["carbono_verificado"] is True
    assert float(m["biomasa_kg"]) == 7.4
    assert float(m["carbono_acumulado_kg"]) == 3.478
    assert float(m["co2_equivalente_kg"]) == 12.764
    print("medicion OK", m["biomasa_kg"], m["co2_equivalente_kg"])

    bid = str(uuid4())
    act = [
        {
            "id": bid,
            "productor_id": pid,
            "parcela_id": parcela_id,
            "planta_id": planta_id,
            "tipo": "riego",
            "fecha_programada": str(date.today()),
            "datos": {"litros": 10},
        }
    ]
    r1 = client.post("/api/sync", json=act)
    r2 = client.post("/api/sync", json=act)
    assert r1.status_code == 200 and r1.json()["insertados"] == 1 and r1.json()["omitidos"] == 0, r1.text
    assert r2.json()["insertados"] == 0 and r2.json()["omitidos"] == 1, r2.text
    print("sync OK", r1.json(), r2.json())

    r = client.get(f"/api/productores/{pid}/incentivo")
    assert r.status_code == 200, r.text
    inc = r.json()
    assert inc["cumple_pacto_social"] is True
    assert inc["multiplicador_precio"] == 2.0
    print("incentivo OK", inc["mensaje"][:90])
    print("ALL PASS")


if __name__ == "__main__":
    main()
