from auth import get_password_hash
import sqlite3

DB_PATH = "delivery.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Crear tabla de usuarios (Sincronizada sin email ni disabled)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            role TEXT NOT NULL
        )
    ''')

    # 2. Crear tabla de pedidos (Incluyendo user_id para vinculación)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            lng REAL NOT NULL,
            lat REAL NOT NULL,
            zone INTEGER DEFAULT 0,
            user_id INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    
    # 3. Insertar usuarios de ejemplo (Sin columnas sobrantes)
    cursor.execute('''
        INSERT OR IGNORE INTO users (username, hashed_password, role) 
        VALUES(?, ?, ?)
    ''', ("admin_luis", get_password_hash("admin123"), "admin"))
    
    cursor.execute('''
        INSERT OR IGNORE INTO users (username, hashed_password, role) 
        VALUES (?, ?, ?)
    ''', ("user_pedro", get_password_hash("user123"), "user"))

    conn.commit()
    conn.close()

# Funciones de ACCESO
def get_user(username: str):
    conn = sqlite3.connect(DB_PATH) # Usamos la constante DB_PATH
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

# Ejecuta la creación al importar el archivo
if __name__ == "__main__":
    init_db()