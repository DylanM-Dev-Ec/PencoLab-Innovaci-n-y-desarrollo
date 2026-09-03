from datetime import datetime, timedelta, timezone
from uuid import UUID

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Productor, Usuario
from app.models.enums import RolUsuario

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def rol_value(rol) -> str:
    return rol.value if hasattr(rol, "value") else str(rol)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(*, user_id: int, rol: str, productor_id: UUID | None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "id_usuario": user_id,
        "id": user_id,
        "rol": rol,
        "productor_id": str(productor_id) if productor_id else None,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expire_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Usuario:
    payload = decode_token(token)
    user_id = payload.get("id_usuario") or payload.get("id") or payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token sin identificador")
    user = db.get(Usuario, int(user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    return user


def require_roles(*roles: str):
    allowed = set(roles)

    def _checker(user: Usuario = Depends(get_current_user)) -> Usuario:
        if rol_value(user.rol) not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para acceder a este recurso",
            )
        return user

    return _checker


def productor_id_for_user(db: Session, user: Usuario) -> UUID | None:
    if rol_value(user.rol) != RolUsuario.PRODUCTOR.value:
        return None
    productor = db.query(Productor).filter(Productor.usuario_id == user.id).first()
    return productor.id if productor else None
