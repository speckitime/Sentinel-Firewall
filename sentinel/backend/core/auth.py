"""JWT authentication helpers."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from backend.core.config import get_secret, load_config

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/system/auth/login")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def _jwt_secret() -> str:
    return get_secret().get("api", {}).get("jwt_secret", "insecure-dev-secret")


def _expiry_minutes() -> int:
    return load_config().get("api", {}).get("jwt_expiry_minutes", 480)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def create_access_token(data: dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=_expiry_minutes())
    to_encode["exp"] = expire
    return jwt.encode(to_encode, _jwt_secret(), algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[ALGORITHM])
        sub: str | None = payload.get("sub")
        if sub is None:
            raise credentials_exception
        return {"sub": sub}
    except JWTError:
        raise credentials_exception
