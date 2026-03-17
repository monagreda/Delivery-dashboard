from auth import get_password_hash
import sqlite3

DB_PATH = "delivery.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Crear tabla de usuarios
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL,
            hashed_password TEXT NOT NULL,
            disabled INTEGER NOT NULL DEFAULT 0
        )
    ''')

    #2. Crear tabla de pedidos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT UNIQUE NOT NULL,
            lng REAL NOT NULL,
            lat REAL NOT NULL,
            zone INTEGER
        )
    ''')
    
    #3. Insertar usuarios de ejemplo
    cursor.execute('''
        INSERT OR IGNORE INTO users (username, email, role, hashed_password, disabled) 
        VALUES('admin_luis', 'luis@admin.com', 'admin', ?, 0)
    ''', (get_password_hash("admin123"),))
    
    # Insertar otros usuarios de ejemplo
    cursor.execute('''
        INSERT OR IGNORE INTO users (username, email, role, hashed_password, disabled) 
        VALUES ('user_pedro', 'pedro@cliente.com', 'user', ?, 0)
    ''', (get_password_hash("user123"),))

    conn.commit()
    conn.close()

# Funciones de ACCESO

def get_user(username: str):
    conn = sqlite3.connect("delivery.db")
    conn.row_factory = sqlite3.Row # Esto permite acceder por nombre de columna
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)  # Convertir a diccionario para facilitar su uso
    return None

# Ejecuta la creacion al importar el archivo
init_db()

