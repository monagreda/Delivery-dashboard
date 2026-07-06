# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import auth_router, orders_router, admin_router, fuel_router

app = FastAPI(title="LogiPredict AI API")

# Inicializamos las tablas de la base de datos de forma automática al encender el servidor
@app.on_event("startup")
def startup_event():
    init_db()

# Configuración de políticas CORS compartidas
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://delivery-dashboard-eosin.vercel.app",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registramos las rutas modulares
app.include_router(auth_router)
app.include_router(orders_router)
app.include_router(admin_router)
app.include_router(fuel_router)

@app.get("/")
def home():
    return {"message": "API de LogiPredict con Roles Activa y Modularizada"}