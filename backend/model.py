from pydantic import BaseModel, EmailStr
from typing import Optional

# Esquema base para los usuarios
class User(BaseModel):
    username: str
    email: EmailStr
    role: str  # Aquí definimos "admin" o "user"
    disabled: Optional[bool] = None

# Lo que recibimos cuando alguien se registra
class UserCreate(User):
    password: str

# Lo que devolvemos al frontend (sin la contraseña por seguridad)
class UserInDB(User):
    hashed_password: str