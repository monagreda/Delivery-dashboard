from auth import get_password_hash

# Esto simula nuestra tabla de usuarios
users_db = {
    "admin_luis": {
        "username": "admin_luis",
        "email": "luis@admin.com",
        "role": "admin",
        "hashed_password": get_password_hash("admin123"), # Tu clave será admin123
        "disabled": False,
    },
    "user_pedro": {
        "username": "user_pedro",
        "email": "pedro@cliente.com",
        "role": "user",
        "hashed_password": get_password_hash("user123"), # Su clave será user123
        "disabled": False,
    },
}