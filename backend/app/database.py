# app/database.py
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Reparación de la URL si viene de Render/Supabase
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

def get_db_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

# Dependencia para usar en los endpoints (Cierra la conexión automáticamente)
def get_db():
    conn = get_db_conn()
    try:
        yield conn
    finally:
        conn.close()

# Tu función exacta original mudada aquí
def get_user(username):
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM users WHERE username = %s", (username,))
            return cur.fetchone()
    except Exception as e:
        print(f"Error al obtener usuario: {e}")
        return None
    finally:
        conn.close()

# Inicialización de tablas main.py
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