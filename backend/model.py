from pydantic import BaseModel, EmailStr
from typing import Optional

# esquema base para los usuarios
class UserRegister(BaseModel):
    username: str
    password: str
    role: str = "user"

# Lo que recibimos cuando alguien se registra
class UserResponse(BaseModel):
    username: str
    role: str

    class Config:
        from_attributes = True

# Esquema para el login
class UserLogin(BaseModel):
    username: str
    password: str