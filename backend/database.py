import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Reparación de la URL para SQLAlchemy/Psycopg2 si viene de Heroku/Render
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

def get_user(username):
    # Conectamos a Postgres (Supabase)
    conn = psycopg2.connect(DATABASE_URL)
    try:
        # Usamos RealDictCursor para que el resultado sea un diccionario {'username': 'admin', ...}
        # y no una simple lista o tupla.
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM users WHERE username = %s", (username,))
            user = cur.fetchone()
            return user
    except Exception as e:
        print(f"Error al obtener usuario: {e}")
        return None
    finally:
        conn.close() # Importante cerrar siempre la conexión