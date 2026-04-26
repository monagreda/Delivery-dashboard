import numpy as np
import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor # Para que r[0] también funcione como r['lng']
import os
from dotenv import load_dotenv
import uuid # Para generar IDs unicos de pedidos
import requests
import time
from sklearn.cluster import KMeans
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from scipy.spatial.distance import cdist

# importaciones de archivos locales
from auth import verify_password, create_access_token, get_password_hash, SECRET_KEY, ALGORITHM
from model import UserRegister, OrderAssignment
from database import get_user

pedidos_db = []  # Simulación de base de datos de pedidos, se usara en optimize_zones

app = FastAPI(title="LogiPredict AI API")

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Puesto por defecto de vite
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Esto permite que FastAPI entienda de dónde sacar el Token en las peticiones
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# # Modularizacion de la DB
# def get_db_conn():
#     conn = sqlite3.connect(DB_NAME)
#     conn.row_factory = sqlite3.Row #Permite acceder por nombre de columna
#     return conn

def get_db_conn():
    # Conexión a Supabase
    return psycopg2.connect(DATABASE_URL)

# Inicialización de la base de datos al iniciar la app
def init_db():
    conn = get_db_conn()
    if not conn: return

    with conn: 
        cursor = conn.cursor()

        #Tabla de Usuarios
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                role TEXT NOT NULL -- 'user' o 'driver'
            )
        ''')

        #Modificar Tabla de Pedidos (añadiendo user_id)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS orders (
                order_id TEXT PRIMARY KEY,
                lng DOUBLE PRECISION NOT NULL,
                lat DOUBLE PRECISION NOT NULL,
                zone INTEGER DEFAULT 0,
                user_id INTEGER REFERENCES users(id), --Relacion con el ususario que lo creo
                driver_id INTEGER REFERENCES users(id), -- 👈 Nuevo: ID del conductor asignado
                status TEXT DEFAULT 'pending', -- 👈 Nuevo: pending, assigned, delivered
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                delivered_at TIMESTAMP
            )
    ''')
    conn.close()

init_db()


# Dpendencias de Seguridad

# Función para obtener el usuario actual a partir del token, se usará en endpoints de usuarios normales
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

# Admin
async def get_current_admin(current_user = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")
    return current_user


# Endpoint para login y obtención de token
@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = get_user(form_data.username)
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Usuario o contraseña incorrectos")
    
    # Creamos el token incluyendo el ROL del usuario
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"]}
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user["role"]}

#Registro
@app.post("/register")
async def register(user: UserRegister):
    if user.role not in [ 'user', 'driver', 'admin']:
        raise HTTPException(status_code=400, detail='Rol inválido')

    hashed = get_password_hash(user.password)
    try:
        with get_db_conn() as conn:
            conn.execute("INSERT INTO users(username, hashed_password, role) VALUES(%s, %s, %s)",
                          (user.username, hashed, user.role)
                        )
            conn.commit() #aseguramos que se guarde
        return {"status": "success", "message": f"Usuario {user.username} registrado"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail='El usuario ya existe')

# Endpoints de administración para asignar pedidos a drivers y optimizar zonas con KMeans. Solo accesibles para admins.
@app.get("/admin/drivers")
async def get_available_drivers(admin_user=Depends(get_current_admin)):
    """
    Retorna la lista de todos los usuarios con rol 'driver'.
    """
    print(f"DEBUG: Intento de acceso a drivers por admin: {admin_user['username']}")
    try:
        with get_db_conn() as conn:
            # Seleccionamos conductores
            rows = conn.execute(
                "SELECT id, username FROM users WHERE role = 'driver'"
            ).fetchall()
            
            # Convertimos a lista de diccionarios
            drivers_list = [{"id": r["id"], "username": r["username"]} for r in rows]
            
            print(f"DEBUG: Conductores en DB: {len(drivers_list)}")
            return drivers_list
    except Exception as e:
        print(f"ERROR critico en drivers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ================================================================================================================================================


# =================================================================================================================
#CRUD de pedidos para usuarios normales, el pedido se asocia al usuario que lo creo mediante el 
# =================================================================================================================

# Crear pedido: Ahora usamos POST y recibimos los parámetros de la URL
@app.post("/orders")
async def create_order(lng: float, lat: float, current_user = Depends(get_current_user)):
    with get_db_conn() as conn:
        # Generamos un ID único para el pedido (puedes usar el timestamp o uuid)
        order_id = f"CCS-{int(time.time())}"
        
        conn.execute(
            "INSERT INTO orders (order_id, lng, lat, user_id, status) VALUES(%s, %s, %s, %s, %s)",
            (order_id, lng, lat, current_user["id"], "pending")
        )
        conn.commit()
        
    return {"status": "success", "order_id": order_id}

# Read
@app.get("/orders")
async def get_my_orders(current_user = Depends(get_current_user)):
    with get_db_conn() as conn:
        rows = conn.execute(
        "SELECT lng, lat, order_id, zone, status, driver_id FROM orders WHERE user_id = ?", 
        (current_user["id"],)
        ).fetchall()

    #GeoJSON
    features = [{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [r['lng'], r['lat']]},
        "properties": {"zone": int(r[3]), "order_id": r[2], "status": r["status"], "driver_id": r["driver_id"]}
    }  for r in rows]

    return{"type": "FeatureCollection","features": features}

# Edit 
@app.put("/orders/{order_id}/location")
async def update_order(order_id: str, lng: float, lat: float, current_user = Depends(get_current_user)):
    # 1. Obtenemos el ID y el ROL del usuario correctamente
    user_id = current_user["id"] if isinstance(current_user, dict) else current_user.id
    user_role = current_user["role"] if isinstance(current_user, dict) else current_user.role

    with get_db_conn() as conn:
        cursor = conn.cursor()
        
        # 2. Lógica de permisos: El admin mueve todo, el usuario solo lo suyo
        if user_role == "admin":
            cursor.execute(
                "UPDATE orders SET lng = ?, lat = ? WHERE order_id = ?", 
                (lng, lat, order_id)
            )
        else:
            cursor.execute(
                "UPDATE orders SET lng = ?, lat = ? WHERE order_id = ? AND user_id = ?",
                (lng, lat, order_id, user_id)
            )
        
        conn.commit() # ¡Importante para guardar en el archivo .db!

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Pedido no encontrado o sin permisos")
            
    return {"status": "success", "message": f"Pedido {order_id} actualizado"}

# Delete
@app.delete("/orders/{order_id}")
async def delete_order(order_id: str, current_user = Depends(get_current_user)):
    with get_db_conn() as conn:
        
        res = conn.execute(
            "DELETE FROM orders WHERE order_id = ? AND user_id = ?", 
            (order_id, current_user["id"])
        )
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail="No se pudo eliminar el pedido")
    return {"message": "Pedido eliminado"}

# ================================================================================================================================================
# ENDPOINTS
# ================================================================================================================================================

# Endpoint permitirá al Admin "encadenar" pedidos. Cada vez que lo llames con un order_id diferente pero el mismo driver_id, la lista del driver crecerá.
@app.patch("/orders/{order_id}/assign")
async def assign_order(
    order_id: str, 
    assignment: OrderAssignment, # Usamos el esquema de Pydantic aquí
    admin_user = Depends(get_current_admin)
):
    # Convertimos a int explícitamente por seguridad
    target_driver_id = int(assignment.driver_id)

    with get_db_conn() as conn:
        cursor = conn.cursor()
        
        # 1. Verificar que el driver existe y tiene el rol correcto
        driver = cursor.execute(
            "SELECT id FROM users WHERE id = ? AND role = 'driver'", (target_driver_id,)).fetchone()
        
        if not driver:
            raise HTTPException(status_code=404, detail="Conductor no encontrado o rol inválido")

        # 2. Actualizar el pedido
        cursor.execute(
            "UPDATE orders SET driver_id = ?, status = 'assigned' WHERE order_id = ?",
            (target_driver_id, order_id)
        )
        conn.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")

    return {"status": "success", "message": f"Pedido {order_id} asignado correctamente"}
# ================================================================================================================================================

# Endpoint para driver de pedidos pendientes asignados a el
@app.get("/driver/my-orders")
async def get_driver_orders(current_user = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Solo conductores pueden ver esta lista")
        
    with get_db_conn() as conn:
        rows = conn.execute(
            "SELECT order_id, lng, lat, status, driver_id FROM orders WHERE driver_id = ? AND status = 'assigned'",
            (current_user["id"],)
        ).fetchall()

    # Devolvemos un GeoJSON para que el Driver también vea sus puntos en el mapa
    features = [{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [r["lng"], r["lat"]]},
        "properties": {"order_id": r["order_id"], "status": r["status"], "driver_id": r["driver_id"]}
    } for r in rows]

    return {"type": "FeatureCollection", "features": features}

# ================================================================================================================================================

# Nuevo: Marcar pedido como entregado (Solo Driver)
@app.patch("/orders/{order_id}/deliver")
async def deliver_order(order_id: str, current_user = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Permiso denegado") 
    
    # Debug: Mira qué ID está llegando
   # 2. Asegurar que el ID sea numérico para la DB
    try:
        driver_id = int(current_user["id"])
    except (ValueError, KeyError):
        raise HTTPException(status_code=400, detail="ID de usuario inválido")
    print(f"DEBUG: Driver {driver_id} intentando entregar {order_id}")
        
    with get_db_conn() as conn:
        res = conn.execute(
            """UPDATE orders
            SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP 
            WHERE order_id = ? AND driver_id = ?""",
            (order_id, driver_id)
        )
        conn.commit()
        
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"No se encontró el pedido {order_id} asignado a tu ID ({driver_id})")
            
    return {"status": "success","message": f"Pedido {order_id} marcado como entregado y registrado en el historial"}

# ================================================================================================================================================
# --- SECCIÓN DE HISTORIAL ---

# 1. Historial para el USUARIO (Sus compras)
@app.get("/history/user")
async def get_user_history(current_user = Depends(get_current_user)):
    with get_db_conn() as conn:
        # Añadimos d.username AS driver y el LEFT JOIN
        rows = conn.execute(
            """SELECT o.order_id, o.lng, o.lat, o.status, o.created_at, o.delivered_at, 
                      d.username as driver
               FROM orders o
               LEFT JOIN users d ON o.driver_id = d.id
               WHERE o.user_id = ? AND o.status = 'delivered'
               ORDER BY o.delivered_at DESC""", 
            (current_user["id"],)
        ).fetchall()
    return [dict(r) for r in rows]

# 2. Historial para el DRIVER (Sus entregas realizadas)
@app.get("/history/driver")
async def get_driver_history(current_user = Depends(get_current_user)):
    # Aquí podrías usar una dependencia get_current_driver si la tienes
    with get_db_conn() as conn:
        rows = conn.execute(
            """SELECT order_id, status, created_at, delivered_at, zone
               FROM orders 
               WHERE driver_id = ? AND status = 'delivered'
               ORDER BY delivered_at DESC""", 
            (current_user["id"],)
        ).fetchall()
    return [dict(r) for r in rows]

# 3. Historial para el ADMIN (Visión global)
@app.get("/history/admin")
async def get_admin_history(admin_user = Depends(get_current_admin)):
    with get_db_conn() as conn:
        # El admin ve quién compró y quién entregó
        rows = conn.execute(
            """SELECT o.order_id, o.status, o.created_at, o.delivered_at, 
                      u.username as client, d.username as driver
               FROM orders o
               JOIN users u ON o.user_id = u.id
               LEFT JOIN users d ON o.driver_id = d.id
               WHERE o.status = 'delivered'
               ORDER BY o.delivered_at DESC LIMIT 100"""
        ).fetchall()
    return [dict(r) for r in rows]
# ================================================================================================================================================

# Endpoint para optimizar zonas usando KMeans, solo accesible para admins
@app.get("/admin/optimize-zones")
async def optimize_zones(n_clusters: int = 4, admin_user=Depends(get_current_admin)):
    with get_db_conn() as conn:
        cursor = conn.cursor()

        # Carga las variables del archivo .env
        load_dotenv()
                
        # Llave de mapa
        MAPTILER_KEY = os.getenv("MAPTILER_KEY")
        GH_KEY = os.getenv("GH_KEY")

        #Intentar leer los pedidos de la DB
        cursor.execute("SELECT lng, lat, order_id, driver_id, status FROM orders WHERE status != 'delivered'")
        rows = cursor.fetchall()

        # 2. Si no hay pedidos, creamos unos iniciales por unica vez
        if not rows:
            np.random.seed(42)
            lat = np.random.uniform(low=10.47, high=10.51, size=20)
            lng = np.random.uniform(low=-66.93, high=-66.85, size=20)

            for i in range(20):
                o_id = f"CCS-{i + 100}"
                cursor.execute(
                    "INSERT INTO orders(order_id, lng, lat) VALUES(%s, %s, %s)",
                    (o_id, lng[i], lat[i])
                )
            conn.commit()
            cursor.execute("SELECT lng, lat, order_id FROM orders")
            rows = cursor.fetchall()

        # Preparar datos para KMeans
        coords = np.array([[float(r[0]), float(r[1])] for r in rows])
        order_ids = [r[2] for r in rows]
        

        #3. Ejecutar Kmeans
        model = KMeans(
            n_clusters=n_clusters,
              init="k-means++",
              random_state=42,
              n_init=10
              )
        clusters = model.fit_predict(coords)

        # 4. Actualizar las zonas en la DB y preparar GeoJSON
        features = []
        routes_features = []
        stats= {i: 0 for i in range(n_clusters)} # inicializamos el contador en 0
        distances_per_zone = {i: 0.0 for i in range(n_clusters)} # Diccionario para distancias

        # Actualizar zonas de DB y prepara puntos
        for i in range(len(rows)):
            zone_id = int(clusters[i])
            order_id = order_ids[i] # El ID del pedido actual

            # Actualizamos la zona en la base de datos
            cursor.execute(
                "UPDATE orders SET zone = ? WHERE order_id = ?", 
                (zone_id, order_ids[i])
            )

            # 2. IMPORTANTE: Necesitamos el driver_id y status actuales para el mapa
            # Hacemos una mini consulta o lo traemos desde el principio
            order_data = cursor.execute(
                "SELECT driver_id, status FROM orders WHERE order_id = ?", 
                (order_id,)
            ).fetchone()
            
            #Sumamos al contador en la zona correspondiente
            stats[zone_id] += 1
            
            # Construimos el objeto para el mapa de React
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(rows[i][0]), float(rows[i][1])]
                },
                "properties": {
                    "zone": zone_id, 
                    "order_id": order_id,
                    "driver_id": order_data["driver_id"],
                    "status": order_data["status"]
                }
            })
        
        # 2. GENERACIÓN DE RUTAS (Lógica de vecino más cercano por zona)
        for z in range(n_clusters):
            time.sleep(0.5) #Pausa de medio segundo entre cada zona
            # Filtramos los puntos que pertenecen a esta zona
            zone_indices = [i for i, val in enumerate(clusters) if val == z]
            if len(zone_indices) < 2: continue # Necesitamos al menos 2 puntos para una línea

            zone_coords = coords[zone_indices].tolist()
            
            # Algoritmo simple de ordenación (TSP básico)
            ordered_route = []
            current_point = zone_coords.pop(0) # Empezamos por el primero de la lista
            ordered_route.append(current_point)

            while zone_coords:
                # Buscamos el punto más cercano al actual
                distances = cdist([current_point], zone_coords)[0]
                closest_idx = np.argmin(distances)
                current_point = zone_coords.pop(closest_idx)
                ordered_route.append(current_point)

            # Consulta a OSRM para lineas de la calle
            try:
                # Formateamos las coordenadas: "lng,lat;lng,lat;..."
                # coords_str = ";".join([f"{round(p[0], 5)},{round(p[1], 5)}" for p in ordered_route])
                points_params = [f"point={round(p[1], 5)},{round(p[0], 5)}" for p in ordered_route]
                points_query = "&".join(points_params)
                
                # Llamada al servidor demo de OSRM
                # osrm_url = f"http://osrm-engine:5000/route/v1/driving/{coords_str}?overview=full&geometries=geojson"

                # Llamada al servidor de maptiler
                # maptiler_url = f"https://api.maptiler.com/routing/v1/bicycle/{coords_str}?key={MAPTILER_KEY}&format=geojson"

                gh_url = (
                    f"https://graphhopper.com/api/1/route?{points_query}"
                    f"&profile=car&locale=es&points_encoded=false"
                    f"&key={GH_KEY}&type=json"
                )
                
                # REQUEST.GET CON OSRM_URL O MAPTILER_URL
                response = requests.get(gh_url, timeout=15)
                if response.status_code == 200:
                    route_data = response.json()
                    if 'paths' in route_data and len(route_data['paths']) > 0:
                        path = route_data['paths'][0]
                        
                        # 2. Extraemos la geometría (GraphHopper ya la da formateada)
                        real_geometry = path['points'] 
                        meters = path.get('distance', 0)
                        
                        distances_per_zone[z] = round(meters / 1000, 2)
                        
                        routes_features.append({
                            "type": "Feature",
                            "properties": {"zone": z},
                            "geometry": real_geometry 
                        })
                else:
                        raise Exception(f"Error en Graphhopper: {response.status_code}")
                
            except Exception as e:
                print(f"Error Maptiler Zona {z}: {response.status_code} - {response.text}")
                print(f"Fallback a línea recta para zona {z}: {e}")

                # Si OSRM o maptiler falla, volvemos a la línea recta para que la app no explote
                routes_features.append({
                    "type": "Feature",
                    "properties": {"zone": z},
                    "geometry": {
                        "type": "LineString",
                        "coordinates": ordered_route
                }
                })

        conn.commit()

    return {
        "geojson": {
            "type": "FeatureCollection",
            "features": features,
        },
        "routes_geojson": {
            "type": "FeatureCollection",
            "features": routes_features,
        },
        "stats": stats,
        "distances": distances_per_zone,
        "metadata": {"zones_count": n_clusters}
        } 

@app.get("/")
def home():
    return {"message": "API de LogiPredict con Roles Activa"}
