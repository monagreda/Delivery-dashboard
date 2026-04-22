import sqlite3
from auth import get_password_hash

DB_PATH = "delivery.db"

def create_super_admin():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    username = "admin_master"
    password = "admin123" # Puedes cambiarla
    hashed = get_password_hash(password)
    
    try:
        cursor.execute(
            "INSERT INTO users (username, hashed_password, role) VALUES (?, ?, ?)",
            (username, hashed, "admin")
        )
        conn.commit()
        print(f"✅ Admin creado exitosamente: {username}")
    except sqlite3.IntegrityError:
        print(f"⚠️ El usuario {username} ya existe.")
    finally:
        conn.close()

if __name__ == "__main__":
    create_super_admin()