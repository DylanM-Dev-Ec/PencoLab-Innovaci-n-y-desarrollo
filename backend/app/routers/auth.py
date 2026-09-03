from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Productor, Usuario
from app.models.enums import RolUsuario
from app.schemas import LoginRequest, RegisterRequest, TokenResponse
from app.security import create_access_token, hash_password, productor_id_for_user, verify_password

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = payload.email.lower()
    if db.query(Usuario).filter(Usuario.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El email ya está registrado")

    rol = payload.rol.value if isinstance(payload.rol, RolUsuario) else payload.rol
    user = Usuario(email=email, password_hash=hash_password(payload.password), rol=rol)
    db.add(user)
    db.flush()

    productor_id = None
    if rol == RolUsuario.PRODUCTOR.value:
        nombre = payload.nombre or email.split("@")[0]
        existing_prod = db.query(Productor).filter(Productor.email == email).first()
        if existing_prod:
            existing_prod.usuario_id = user.id
            if payload.nombre:
                existing_prod.nombre = payload.nombre
            productor_id = existing_prod.id
        else:
            productor = Productor(
                usuario_id=user.id,
                nombre=nombre,
                email=email,
                comunidad=payload.comunidad,
            )
            db.add(productor)
            db.flush()
            productor_id = productor.id

    db.commit()
    db.refresh(user)

    token = create_access_token(user_id=user.id, rol=rol, productor_id=productor_id)
    return TokenResponse(
        access_token=token,
        id=user.id,
        rol=rol,
        productor_id=productor_id,
        email=user.email,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")

    rol = user.rol.value if hasattr(user.rol, "value") else user.rol
    productor_id = productor_id_for_user(db, user)
    token = create_access_token(user_id=user.id, rol=rol, productor_id=productor_id)
    return TokenResponse(
        access_token=token,
        id=user.id,
        rol=rol,
        productor_id=productor_id,
        email=user.email,
    )
