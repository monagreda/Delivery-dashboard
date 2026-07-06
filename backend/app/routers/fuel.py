# src/routers/fuel.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.models import FuelEstimateRequest, FuelEstimateResponse

router = APIRouter(
    prefix="/api/fuel",
    tags=["Fuel & Expenses"]
)

from pydantic import BaseModel
class FuelEstimateResponse(BaseModel):
    estimated_liters: float
    estimated_cost: float
    currency: str = "EUR"

@router.post("/estimate", response_model=FuelEstimateResponse)
async def get_fuel_estimate(payload: FuelEstimateRequest):
    try:
        # Lógica matemática (puedes ajustarla según los vehículos luego)
        consumo_base_por_100km = 8.0  # 8 litros promedio cada 100km
        precio_litro_combustible = 1.65  # Precio promedio en EUR
        
        # Penalización por peso: +1% de consumo por cada 100kg de carga
        factor_peso = 1 + (payload.weight_kg / 100) * 0.01
        
        # Operaciones
        litros_necesarios = (payload.distance_km / 100) * consumo_base_por_100km * factor_peso
        costo_total = litros_necesarios * precio_litro_combustible
        
        return FuelEstimateResponse(
            estimated_liters=round(litros_necesarios, 2),
            estimated_cost=round(costo_total, 2)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al calcular gasto: {str(e)}")