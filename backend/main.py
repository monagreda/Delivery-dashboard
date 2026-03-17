import numpy as np
import sqlite3
import uuid # Para generar IDs unicos de pedidos
from sklearn.cluster import KMeans
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt

# importaciones de archivos locales
from auth import verify_password, create_access_token, get_password_hash, SECRET_KEY, ALGORITHM
from model import UserRegister
from database import get_user

pedidos_db = []  # Simulación de base de datos de pedidos, se usara en optimize_zones

app = FastAPI(title="LogiPredict AI API")

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Puesto por defecto de vite
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_NAME = "delivery.db"

# Esto permite que FastAPI entienda de dónde sacar el Token en las peticiones
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Modularizacion de la DB
def get_db_conn():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row #Permite acceder por nombre de columna
    return conn

# Inicialización de la base de datos al iniciar la app
def init_db():
    with get_db_conn() as conn:
        cursor = conn.cursor()

        #Tabla de Usuarios
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                role TEXT NOT NULL -- 'user' o 'driver'
            )
        ''')

        #Modificar Tabla de Pedidos (añadiendo user_id)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS orders (
                order_id TEXT PRIMARY KEY,
                lng REAL NOT NULL,
                lat REAL NOT NULL,
                zone INTEGER DEFAULT 0,
                user_id INTEGER, --Relacion con el ususario que lo creo
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
    ''')

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
            conn.execute("INSERT INTO users(username, hashed_password, role) VALUES(?,?,?)",
                          (user.username, hashed, user.role)
                        )
            conn.commit() #aseguramos que se guarde el ususario
        return {"status": "success", "message": f"Usuario {user.username} registrado"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail='El usuario ya existe')

# =================================================================================================================
#CRUD de pedidos para usuarios normales, el pedido se asocia al usuario que lo creo mediante el 
# =================================================================================================================

# Crear pedido extraer token y guardarlo
@app.post("/orders")
async def create_personal_order(lng: float, lat: float, user = Depends(get_current_user)):
    order_id = f"CCS-{uuid.uuid4().hex[:6].upper()}"  # Genera un ID único para el pedido
    with get_db_conn() as conn:
        conn.execute(
            "INSERT INTO orders(order_id, lng, lat, user_id) VALUES(?,?,?,?)", 
            (order_id, lng, lat, user["id"])
        )
    return{"status": "success", "order_id": order_id}

# Read
@app.get("/my-orders")
async def get_my_orders(current_user = Depends(get_current_user)):
    with get_db_conn() as conn:
        rows = conn.execute(
        "SELECT lng, lat, order_id, zone FROM orders WHERE user_id = ?", 
        (current_user["id"],)
        ).fetchall()

    #GeoJSON
    features = [{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [r[0], r[1]]},
        "properties": {"zone": int(r[3]), "order_id": r[2]}
    }  for r in rows]

    return{"type": "FeatureCollection","features": features}

# Edit 
@app.put("/orders/{order_id}")
async def update_order(order_id: str, lng: float, lat: float, current_user= Depends(get_current_user)):
    with get_db_conn() as conn:
        # Verificar propiedad y actualizar en una sola transaccion
        res = conn.execute(
            "UPDATE orders SET lng = ?, lat = ? WHERE order_id = ? AND user_id = ?",
            (lng, lat, order_id, current_user["id"])
        )
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail="Pedido no encontrado o sin permisos")
    return{"status": "success", "message": f"Pedido{order_id} actualizado"}


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

# Endpoint para optimizar zonas usando KMeans, solo accesible para admins
@app.get("/admin/optimize-zones")
async def optimize_zones(n_clusters: int=4, admin_user=Depends(get_current_admin)):
    with get_db_conn() as conn:
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
                    "INSERT INTO orders(order_id, lng, lat) VALUES(?,?,?)",
                    (o_id, lng[i], lat[i])
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
    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {"zones_count": n_clusters}
        } 

@app.get("/")
def home():
    return {"message": "API de LogiPredict con Roles Activa"}

   