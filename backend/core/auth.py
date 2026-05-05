"""JWT authentication helpers."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from .config import load_secrets

_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/system/auth/login")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(data: dict) -> str:
    secrets = load_secrets()["auth"]
    expire  = datetime.now(timezone.utc) + timedelta(minutes=int(secrets["jwt_expire_minutes"]))
    payload = {**data, "exp": expire}
    return jwt.encode(payload, secrets["jwt_secret"], algorithm=secrets["jwt_algorithm"])


async def get_current_user(token: str = Depends(_oauth2)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        secrets = load_secrets()["auth"]
        payload = jwt.decode(token, secrets["jwt_secret"], algorithms=[secrets["jwt_algorithm"]])
        username: Optional[str] = payload.get("sub")
        if username is None:
            raise credentials_exception
        return {"username": username}
    except JWTError:
        raise credentials_exception
