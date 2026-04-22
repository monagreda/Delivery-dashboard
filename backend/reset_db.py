import sqlite3
import os
# Importamos desde el mismo directorio
from auth import get_password_hash 

# Al estar dentro de /backend, la DB se creará allí mismo
DB_NAME = "delivery.db"

def reset_database():
    # 1. Limpieza inicial
    if os.path.exists(DB_NAME):
        os.remove(DB_NAME)
        print(f"Archivo {DB_NAME} eliminado para limpieza total.")

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    print("Creando tablas desde cero...")
    # Tabla de Usuarios
    cursor.execute('''
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            role TEXT NOT NULL
        )
    ''')
    
    # Tabla de Pedidos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            lng REAL NOT NULL,
            lat REAL NOT NULL,
            zone INTEGER DEFAULT 0,
            user_id INTEGER,
            driver_id INTEGER,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            delivered_at DATETIME,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(driver_id) REFERENCES users(id)
        )
    ''')

    # 2. Crear el Administrador Inicial para tus pruebas en Caracas
    admin_user = "admin_luis"
    admin_pass = "admin123" 
    hashed_pass = get_password_hash(admin_pass)
    
    cursor.execute(
        "INSERT INTO users (username, hashed_password, role) VALUES (?, ?, ?)",
        (admin_user, hashed_pass, "admin")
    )
    
    conn.commit()
    conn.close()
    print(f"✅ Base de datos reseteada con éxito dentro de /backend.")
    print(f"👤 Usuario Admin: {admin_user}")
    print(f"🔑 Contraseña: {admin_pass}")

if __name__ == "__main__":
    reset_database()