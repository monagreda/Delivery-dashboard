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

# Esquema para crear una orden (lo que el cliente envía)
class OrderCreate(BaseModel):
    lng: float
    lat: float
    origin_address: str
    origin_postcode: str
    destination_address: str
    destination_postcode: str
    weight_kg: float
    volume_m3: float
    cargo_description: str
    origin_country: Optional[str] = "United Kingdom"
    destination_country: Optional[str] = "United Kingdom"

# Este es el que usaremos para la asignación individual
class OrderAssignment(BaseModel):
    driver_id: int

class OrderStatusUpdate(BaseModel):
    status: str # Para cuando el driver marque como 'delivered'

class IncidentReport(BaseModel):
    incident_type: str  # "accidente", "especificaciones_erroneas", "objetos_ilicitos", "otro"
    description: str

# Esquema de estimacion de combustible 
class FuelEstimateRequest(BaseModel):
    distance_km: float
    weight_kg: float
    driver_id: Optional[int] = None

#  Esquema de respuesta de estimacion de combustible
class FuelEstimateResponse(BaseModel):
    estimated_liters: float
    estimated_cost: float
    currency: str = "EUR"