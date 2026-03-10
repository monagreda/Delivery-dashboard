import numpy as np
from sklearn.cluster import KMeans
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from auth import verify_password, create_access_token, SECRET_KEY, ALGORITHM
from database import get_user
import sqlite3
import uuid # Para generar IDs unicos de pedidos

pedidos_db = []  # Simulación de base de datos de pedidos, se usara en optimize_zones

app = FastAPI(title="LogiPredict AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Puesto por defecto de vite
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Esto permite que FastAPI entienda de dónde sacar el Token en las peticiones
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_admin(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        role: str = payload.get("role")
        if role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="No tienes permisos de administrador"
            )
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

# Endpoint para login y obtención de token
@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user_dict = get_user(form_data.username)
    if not user_dict or not verify_password(form_data.password, user_dict.get("hashed_password")):
        raise HTTPException(status_code=400, detail="Usuario o contraseña incorrectos")
    
    # Creamos el token incluyendo el ROL del usuario
    access_token = create_access_token(
        data={"sub": user_dict["username"], "role": user_dict["role"]}
    )
    return {"access_token": access_token, "token_type": "bearer"}

#logica para crear pedidos
@app.post("/admin/create-order")
async def create_order(lng: float, lat: float, admin_user=Depends(get_current_admin)):
    conn = sqlite3.connect("delivery.db")
    cursor = conn.cursor()

    # Generamos un ID tipo 'CCS-XXXX'
    order_id = f"CCS-{str(uuid.uuid4())[:4].upper()}"

    try:
        cursor.execute(
            "INSERT INTO orders(order_id, lng, lat, zone) VALUES(?,?,?,?)",
              (order_id, lng, lat, 0)
              )
        conn.commit()
        return{"status": "success", "order_id": order_id}
    except Exception as e:
        # Si hay un error, FastAPI lo captura aqui
        print(f"Error en DB: {e}")
        raise HTTPException(status_code=500, detail="Error al guardar en base de datos")
    finally:
        conn.close()

@app.get("/")
def home():
    return {"message": "API de LogiPredict con Roles Activa"}

# Endpoint para optimizar zonas usando KMeans, solo accesible para admins
@app.get("/admin/optimize-zones")
async def optimize_zones(n_clusters: int=4, admin_user=Depends(get_current_admin)):
    conn = sqlite3.connect("delivery.db")
    cursor = conn.cursor()

    #Intentar leer los pedidos de la DB
    cursor.execute("SELECT lng, lat, order_id FROM orders")
    rows = cursor.fetchall()

    # 2. Si no hay pedidos, creamos unos iniciales por unica vez
    if not rows:
        np.random.seed(42)
        lat = np.random.uniform(low=10.47, high=10.51, size=50)
        lng = np.random.uniform(low=-66.93, high=-66.85, size=50)

        for i in range(50):
            o_id = f"CCS-{i + 100}"
            cursor.execute(
                "INSERT INTO orders(order_id, lat, lng) VALUES(?,?,?)",
                (o_id, lat[i], lng[i])
            )
        conn.commit()
        cursor.execute("SELECT lng, lat, order_id FROM orders")
        rows = cursor.fetchall()

    # Preparar datos para KMeans
    coords = np.array([[r[0], r[1]] for r in rows])
    order_ids = [r[2] for r in rows]
     

    #3. Ejecutar Kmeans
    model = KMeans(n_clusters=n_clusters, n_init="auto")
    clusters = model.fit_predict(coords)

    # 4. Actualizar las zonas en la DB y preparar GeoJSON
    features = []
    for i in range(len(rows)):
        # Actualizamos la zona en la base de datos
        cursor.execute(
            "UPDATE orders SET zone = ? WHERE order_id = ?", 
            (int(clusters[i]), order_ids[i])
        )
        
        # Construimos el objeto para el mapa de React
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(rows[i][0]), float(rows[i][1])]
            },
            "properties": {
                "zone": int(clusters[i]), 
                "order_id": order_ids[i]
            }
        })
    
    conn.commit()
    conn.close()

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {"zones_count": n_clusters}
    } 

   