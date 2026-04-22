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
    id: Optional[int] = None # Añadimos el ID para poder manejar asignaciones

    class Config:
        from_attributes = True

# Esquema para el login
class UserLogin(BaseModel):
    username: str
    password: str

#  --- ESQUEMAS DE ÓRDENES (Pydantic para la API) --

# Este es el que usaremos para la asignación individual
class OrderAssignment(BaseModel):
    driver_id: int

class OrderStatusUpdate(BaseModel):
    status: str # Para cuando el driver marque como 'delivered'
