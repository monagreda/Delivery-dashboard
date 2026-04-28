import numpy as np
import psycopg2
from psycopg2.extras import RealDictCursor 
from psycopg2 import IntegrityError # Importación necesaria para errores de duplicados
import os
from dotenv import load_dotenv
import uuid 
import requests
import time
from sklearn.cluster import KMeans
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from scipy.spatial.distance import cdist

# Importaciones locales
from auth import verify_password, create_access_token, get_password_hash, SECRET_KEY, ALGORITHM
from model import UserRegister, OrderAssignment
from database import get_user

load_dotenv()

app = FastAPI(title="LogiPredict AI API")

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Middleware - Recuerda agregar tu URL de Vercel aquí si tienes problemas de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://delivery-dashboard-eosin.vercel.app", # Tu URL de Vercel
        "http://localhost:5173",
        ], # Permitir todos temporalmente para pruebas en la nube
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# --- CENTRALIZACIÓN DE BASE DE DATOS ---

def get_db_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

# Dependencia para usar en los endpoints (Cierra la conexión automáticamente)
def get_db():
    conn = get_db_conn()
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    conn = get_db_conn()
    try:
        with conn: 
            with conn.cursor() as cursor:
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        username TEXT UNIQUE NOT NULL,
                        hashed_password TEXT NOT NULL,
                        role TEXT NOT NULL
                    )
                ''')
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS orders (
                        order_id TEXT PRIMARY KEY,
                        lng DOUBLE PRECISION NOT NULL,
                        lat DOUBLE PRECISION NOT NULL,
                        zone INTEGER DEFAULT 0,
                        user_id INTEGER REFERENCES users(id),
                        driver_id INTEGER REFERENCES users(id),
                        status TEXT DEFAULT 'pending',
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        delivered_at TIMESTAMPTZ
                    )
                ''')
    finally:
        conn.close()

@app.on_event("startup")
def startup_event():
    try:
        init_db()
        print("✅ Tablas verificadas/creadas en Supabase")
    except Exception as e:
        print(f"❌ Error al iniciar DB: {e}")

# --- SEGURIDAD ---

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Token inválido")
        user = get_user(username)
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

async def get_current_admin(current_user = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")
    return current_user

# --- ENDPOINTS ---

@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = get_user(form_data.username)
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Usuario o contraseña incorrectos")
    
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"]}
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user["role"]}

@app.post("/register")
async def register(user: UserRegister, conn=Depends(get_db)):
    if user.role not in ['user', 'driver', 'admin']:
        raise HTTPException(status_code=400, detail='Rol inválido')

    hashed = get_password_hash(user.password)
    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO users(username, hashed_password, role) VALUES(%s, %s, %s)",
                    (user.username, hashed, user.role)
                )
        return {"status": "success", "message": f"Usuario {user.username} registrado"}
    except IntegrityError:
        raise HTTPException(status_code=400, detail='El usuario ya existe')

@app.get("/admin/drivers")
async def get_available_drivers(admin_user=Depends(get_current_admin), conn=Depends(get_db)):
    with conn.cursor() as cursor:
        cursor.execute("SELECT id, username FROM users WHERE role = 'driver'")
        return cursor.fetchall()

@app.post("/orders")
async def create_order(lng: float, lat: float, current_user = Depends(get_current_user), conn=Depends(get_db)):
    order_id = f"CCS-{int(time.time())}"
    with conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO orders (order_id, lng, lat, user_id, status) VALUES(%s, %s, %s, %s, %s)",
                (order_id, lng, lat, current_user["id"], "pending")
            )
    return {"status": "success", "order_id": order_id}

@app.get("/orders")
async def get_my_orders(current_user = Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT lng, lat, order_id, zone, status, driver_id FROM orders WHERE user_id = %s", 
            (current_user["id"],)
        )
        rows = cursor.fetchall()

    features = [{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [r['lng'], r['lat']]},
        "properties": {
            "zone": r['zone'], 
            "order_id": r['order_id'], 
            "status": r["status"], 
            "driver_id": r["driver_id"]
        }
    } for r in rows]
    return {"type": "FeatureCollection", "features": features}

@app.put("/orders/{order_id}/location")
async def update_order(order_id: str, lng: float, lat: float, current_user = Depends(get_current_user), conn=Depends(get_db)):
    user_id = current_user["id"] if isinstance(current_user, dict) else current_user.id
    user_role = current_user["role"] if isinstance(current_user, dict) else current_user.role

    with conn:
        with conn.cursor() as cursor:
            if user_role == "admin":
                cursor.execute("UPDATE orders SET lng = %s, lat = %s WHERE order_id = %s", (lng, lat, order_id))
            else:
                cursor.execute(
                    "UPDATE orders SET lng = %s, lat = %s WHERE order_id = %s AND user_id = %s",
                    (lng, lat, order_id, user_id)
                )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="No encontrado o sin permisos")
    return {"status": "success", "message": "Actualizado"}

@app.delete("/orders/{order_id}")
async def delete_order(order_id: str, current_user = Depends(get_current_user), conn=Depends(get_db)):
    with conn:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM orders WHERE order_id = %s AND user_id = %s", (order_id, current_user["id"]))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="No se pudo eliminar")
    return {"message": "Eliminado"}

@app.patch("/orders/{order_id}/assign")
async def assign_order(order_id: str, assignment: OrderAssignment, admin_user = Depends(get_current_admin), conn=Depends(get_db)):
    target_driver_id = int(assignment.driver_id)
    with conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE id = %s AND role = 'driver'", (target_driver_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Conductor no encontrado")
            cursor.execute("UPDATE orders SET driver_id = %s, status = 'assigned' WHERE order_id = %s", (target_driver_id, order_id))
    return {"status": "success"}

@app.get("/driver/my-orders")
async def get_driver_orders(current_user = Depends(get_current_user), conn=Depends(get_db)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Acceso denegado")
    with conn.cursor() as cursor:
        cursor.execute("SELECT order_id, lng, lat, status, driver_id FROM orders WHERE driver_id = %s AND status = 'assigned'", (current_user["id"],))
        rows = cursor.fetchall()
    
    features = [{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [r["lng"], r["lat"]]},
        "properties": {"order_id": r["order_id"], "status": r["status"], "driver_id": r["driver_id"]}
    } for r in rows]
    return {"type": "FeatureCollection", "features": features}

@app.patch("/orders/{order_id}/deliver")
async def deliver_order(order_id: str, current_user = Depends(get_current_user), conn=Depends(get_db)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Permiso denegado") 
    with conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE orders SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP WHERE order_id = %s AND driver_id = %s",
                (order_id, current_user["id"])
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return {"status": "success"}

# --- HISTORIAL ---

@app.get("/history/user")
async def get_user_history(current_user = Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT o.*, d.username as driver FROM orders o LEFT JOIN users d ON o.driver_id = d.id WHERE o.user_id = %s AND o.status = 'delivered' ORDER BY o.delivered_at DESC", 
            (current_user["id"],)
        )
        return cursor.fetchall()

@app.get("/history/driver")
async def get_driver_history(current_user = Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM orders WHERE driver_id = %s AND status = 'delivered' ORDER BY delivered_at DESC", (current_user["id"],))
        return cursor.fetchall()

@app.get("/history/admin")
async def get_admin_history(admin_user = Depends(get_current_admin), conn=Depends(get_db)):
    with conn.cursor() as cursor:
        cursor.execute("SELECT o.*, u.username as client, d.username as driver FROM orders o JOIN users u ON o.user_id = u.id LEFT JOIN users d ON o.driver_id = d.id WHERE o.status = 'delivered' ORDER BY o.delivered_at DESC LIMIT 100")
        return cursor.fetchall()

@app.get("/admin/optimize-zones")
async def optimize_zones(n_clusters: int = 4, admin_user=Depends(get_current_admin), conn=Depends(get_db)):
    GH_KEY = os.getenv("GH_KEY")
    
    try:
        with conn.cursor() as cursor:
            # 1. Obtener pedidos pendientes
            cursor.execute("SELECT lng, lat, order_id, driver_id, status FROM orders WHERE status != 'delivered'")
            rows = cursor.fetchall()

            if not rows:
                return {"message": "No hay pedidos para optimizar"}

            # Evitar que KMeans explote si hay pocos pedidos
            actual_clusters = min(n_clusters, len(rows))
            
            coords = np.array([[float(r['lng']), float(r['lat'])] for r in rows])
            order_ids = [r['order_id'] for r in rows]

            # 2. IA: K-Means
            model = KMeans(n_clusters=actual_clusters, init="k-means++", random_state=42, n_init=10)
            clusters = model.fit_predict(coords)

            features = []
            routes_features = []
            stats = {i: 0 for i in range(actual_clusters)}
            distances_per_zone = {i: 0.0 for i in range(actual_clusters)}

            # 3. Actualizar zonas en la DB y preparar GeoJSON
            for i in range(len(rows)):
                zone_id = int(clusters[i])
                o_id = order_ids[i]
                
                # Ejecutamos el update
                cursor.execute("UPDATE orders SET zone = %s WHERE order_id = %s", (zone_id, o_id))
                stats[zone_id] += 1
                
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [coords[i][0], coords[i][1]]},
                    "properties": {
                        "zone": zone_id, 
                        "order_id": o_id,
                        "driver_id": rows[i]['driver_id'],
                        "status": rows[i]['status']
                    }
                })

            # 4. Generación de rutas (TSP simplificado)
            for z in range(actual_clusters):
                zone_indices = [idx for idx, val in enumerate(clusters) if val == z]
                if len(zone_indices) < 2: continue

                zone_coords = coords[zone_indices].tolist()
                ordered_route = [zone_coords.pop(0)]
                while zone_coords:
                    distances = cdist([ordered_route[-1]], zone_coords)[0]
                    closest_idx = np.argmin(distances)
                    ordered_route.append(zone_coords.pop(closest_idx))

                # Petición a GraphHopper para rutas reales
                try:
                    points_query = "&".join([f"point={round(p[1], 5)},{round(p[0], 5)}" for p in ordered_route])
                    gh_url = f"https://graphhopper.com/api/1/route?{points_query}&profile=car&key={GH_KEY}&type=json&points_encoded=false"
                    
                    resp = requests.get(gh_url, timeout=5) # Timeout más corto para no bloquear Render
                    if resp.status_code == 200:
                        path = resp.json()['paths'][0]
                        routes_features.append({
                            "type": "Feature",
                            "properties": {"zone": z},
                            "geometry": path['points']
                        })
                        distances_per_zone[z] = round(path.get('distance', 0) / 1000, 2)
                    else:
                        raise Exception("GH falló")
                except:
                    # Fallback a línea recta si falla la API de rutas
                    routes_features.append({
                        "type": "Feature",
                        "properties": {"zone": z},
                        "geometry": {"type": "LineString", "coordinates": ordered_route}
                    })

            # IMPORTANTE: Guardar cambios en Supabase
            conn.commit()

        return {
            "geojson": {"type": "FeatureCollection", "features": features},
            "routes_geojson": {"type": "FeatureCollection", "features": routes_features},
            "stats": stats,
            "distances": distances_per_zone
        }
    except Exception as e:
        conn.rollback() # Si algo falla, deshacemos cambios para no dejar la DB bloqueada
        print(f"🔥 Error crítico en optimize_zones: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@app.get("/")
def home():
    return {"message": "API de LogiPredict con Roles Activa"}