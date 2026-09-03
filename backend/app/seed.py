from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import BitacoraCampo, MedicionCrecimiento, Parcela, Planta, Productor, Usuario
from app.models.enums import RolUsuario, TipoCarbono
from app.security import hash_password
from app.utils.carbono import calcular_carbono_in_situ, estimar_carbono_teorico

# Cuenta dueña del proyecto — misma contraseña para ambos portales
OWNER_PASSWORD = "DylanPenco2026"
OWNER_ACCOUNTS = [
    {
        "email": "dylan@pencolab.ec",
        "rol": RolUsuario.PRODUCTOR.value,
        "nombre": "Dylan · Agricultor",
        "comunidad": "Pencos del Norte",
    },
    {
        "email": "dylan.empresa@pencolab.ec",
        "rol": RolUsuario.EMPRESA.value,
        "nombre": "Dylan · Empresa",
        "comunidad": None,
    },
]

# Placeholder SVG (cochinilla / puntos rojos) para pitch sin archivos binarios
SCOUTING_FOTO_PLACEHOLDER = (
    "data:image/svg+xml;base64,"
    "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIj4"
    "8cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzJhM2YyNCIvPjx0ZXh0IHg9IjIwMCIgeT0iMTQwIi"
    "B0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjYWVkNTgxIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaX"
    "plPSIxOCI+U2NvdXRpbmcgaW4gc2l0dTwvdGV4dD48Y2lyY2xlIGN4PSIxMjAiIGN5PSIyMDAiIHI9IjgiIGZpbGw9I"
    "iNlZjUzNTAiLz48Y2lyY2xlIGN4PSIxNjAiIGN5PSIxODAiIHI9IjYiIGZpbGw9IiNlZjUzNTAiLz48Y2lyY2xlIGN4P"
    "SIyMDAiIGN5PSIyMTAiIHI9IjciIGZpbGw9IiNlZjUzNTAiLz48Y2lyY2xlIGN4PSIyNDAiIGN5PSIxOTAiIHI9IjUiI"
    "GZpbGw9IiNlZjUzNTAiLz48dGV4dCB4PSIyMDAiIHk9IjI2MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2Zm"
    "Yjc0ZCIgZm9udC1zaXplPSIxNCI+Q29jaGluaWxsYSAtIHB1bnRvcyByb2pvczwvdGV4dD48L3N2Zz4="
)


def seed_owner_accounts() -> None:
    db: Session = SessionLocal()
    try:
        productor = None
        for item in OWNER_ACCOUNTS:
            email = item["email"].lower()
            user = db.query(Usuario).filter(Usuario.email == email).first()
            if not user:
                user = Usuario(
                    email=email,
                    password_hash=hash_password(OWNER_PASSWORD),
                    rol=item["rol"],
                )
                db.add(user)
                db.flush()
            else:
                user.password_hash = hash_password(OWNER_PASSWORD)
                user.rol = item["rol"]

            if item["rol"] == RolUsuario.PRODUCTOR.value:
                productor = db.query(Productor).filter(Productor.usuario_id == user.id).first()
                if not productor:
                    productor = db.query(Productor).filter(Productor.email == email).first()
                if productor:
                    productor.usuario_id = user.id
                    productor.nombre = item["nombre"]
                    productor.email = email
                    productor.comunidad = item["comunidad"]
                else:
                    productor = Productor(
                        usuario_id=user.id,
                        nombre=item["nombre"],
                        email=email,
                        comunidad=item["comunidad"],
                    )
                    db.add(productor)
                    db.flush()

        db.flush()
        if productor:
            _seed_demo_parcelas(db, productor)
        db.commit()
    finally:
        db.close()


def _seed_demo_parcelas(db: Session, productor: Productor) -> None:
    """Datos de pitch Carchi: parcelas GPS, carbono estimado/verificado, scouting."""
    if db.query(Parcela).filter(Parcela.nombre == "Finca El Ángel", Parcela.productor_id == productor.id).first():
        return

    demos = [
        {
            "nombre": "Finca El Ángel",
            "lat": Decimal("0.6225"),
            "lng": Decimal("-77.9370"),
            "area": Decimal("1.80"),
            "ph": Decimal("6.4"),
        },
        {
            "nombre": "Loma Miraflor",
            "lat": Decimal("0.5980"),
            "lng": Decimal("-77.9100"),
            "area": Decimal("2.40"),
            "ph": Decimal("5.7"),
        },
        {
            "nombre": "Valle Chota Sur",
            "lat": Decimal("0.4850"),
            "lng": Decimal("-78.0500"),
            "area": Decimal("1.20"),
            "ph": Decimal("6.9"),
        },
    ]

    now = datetime.now(timezone.utc)
    for i, d in enumerate(demos):
        parcela = Parcela(
            id=uuid4(),
            productor_id=productor.id,
            nombre=d["nombre"],
            ubicacion_lat=d["lat"],
            ubicacion_lng=d["lng"],
            area_hectareas=d["area"],
            ph=d["ph"],
            tipo_suelo="franco",
            permeabilidad="media",
            synced_at=now,
        )
        db.add(parcela)
        db.flush()

        planta = Planta(
            id=uuid4(),
            parcela_id=parcela.id,
            codigo=f"PN-DEMO-{i + 1}",
            ubicacion_lat=d["lat"],
            ubicacion_lng=d["lng"],
            fecha_siembra=date.today() - timedelta(days=120 + i * 30),
            edad_planta_madre_anios=Decimal("4"),
            peso_hijuelo_kg=Decimal("2.2"),
            tamano_roseta_inicial_cm=Decimal("9.5"),
            dias_cicatrizacion=10,
            tratamiento_sanitario=True,
            metodo_desinfeccion="fuego",
            hijuelo_apto=True,
            estado="activa",
            synced_at=now,
        )
        db.add(planta)
        db.flush()

        for m_i, (altura, diam, hojas, meses) in enumerate(
            [(18, 22, 12, 4), (28, 32, 16, 8), (40, 45, 22, 12)]
        ):
            teorico = estimar_carbono_teorico(altura, diam, meses)
            db.add(
                MedicionCrecimiento(
                    id=uuid4(),
                    planta_id=planta.id,
                    fecha_medicion=date.today() - timedelta(days=90 - m_i * 30),
                    altura_roseta_cm=Decimal(str(altura)),
                    diametro_roseta_cm=Decimal(str(diam)),
                    numero_hojas=hojas,
                    tipo_carbono=TipoCarbono.ESTIMADO.value,
                    carbono_verificado=False,
                    edad_planta_meses=meses,
                    biomasa_kg=teorico["biomasa_kg"],
                    carbono_acumulado_kg=teorico["carbono_acumulado_kg"],
                    co2_equivalente_kg=teorico["co2_equivalente_kg"],
                    algoritmo_version="teorico_v1",
                    synced_at=now,
                )
            )

        # Última medición in situ (verificada)
        altura_v, hojas_v = 48 + i * 5, 24 + i
        in_situ = calcular_carbono_in_situ(altura_v, hojas_v)
        db.add(
            MedicionCrecimiento(
                id=uuid4(),
                planta_id=planta.id,
                fecha_medicion=date.today() - timedelta(days=3),
                altura_roseta_cm=Decimal(str(altura_v)),
                diametro_roseta_cm=Decimal(str(52 + i)),
                numero_hojas=hojas_v,
                tipo_carbono=TipoCarbono.VERIFICADO_IN_SITU.value,
                carbono_verificado=True,
                edad_planta_meses=14,
                biomasa_kg=in_situ["biomasa_kg"],
                carbono_acumulado_kg=in_situ["carbono_acumulado_kg"],
                co2_equivalente_kg=in_situ["co2_equivalente_kg"],
                algoritmo_version="alometrico_v1",
                synced_at=now,
            )
        )

        if i == 0:
            db.add(
                BitacoraCampo(
                    id=uuid4(),
                    productor_id=productor.id,
                    parcela_id=parcela.id,
                    planta_id=planta.id,
                    tipo="scouting_visual",
                    fecha_programada=date.today() - timedelta(days=2),
                    fecha_ejecucion=now - timedelta(days=2),
                    estado="completada",
                    gps_lat=d["lat"],
                    gps_lng=d["lng"],
                    gps_precision_m=Decimal("8.5"),
                    datos={
                        "clasificacion": "cochinilla",
                        "foto": SCOUTING_FOTO_PLACEHOLDER,
                        "foto_in_situ": True,
                    },
                    notas="Puntos rojos en pencas inferiores: posible cochinilla.",
                    synced_at=now,
                )
            )
