# app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from psycopg2 import IntegrityError

# Importamos lo que creamos en los pasos anteriores usando rutas relativas
from app.database import get_db
from app.auth import get_password_hash, verify_password, create_access_token
from app.models import UserRegister

router = APIRouter(
    prefix="", # Mantenemos el prefijo vacío porque tus rutas originales eran /register y /token de forma directa
    tags=["Authentication"]
)

@router.post("/register")
async def register_user(user: UserRegister, conn=Depends(get_db)):
    hashed_pw = get_password_hash(user.password)
    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO users (username, hashed_password, role) VALUES (%s, %s, %s) RETURNING id, role",
                    (user.username, hashed_pw, user.role)
                )
                new_user = cursor.fetchone()
        return {"message": "Usuario registrado exitosamente", "user_id": new_user["id"], "role": new_user["role"]}
    except IntegrityError:
        conn.rollback()
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error en servidor: {str(e)}")

@router.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), conn=Depends(get_db)):
    with conn.cursor() as cursor:
        cursor.execute("SELECT * FROM users WHERE username = %s", (form_data.username,))
        user = cursor.fetchone()
    
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer", "role": user["role"]}