from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from auth import verify_password, create_access_token
from database import users_db

app = FastAPI(title="LogiPredict AI API")

# Esto permite que FastAPI entienda de dónde sacar el Token en las peticiones
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user_dict = users_db.get(form_data.username)
    if not user_dict:
        raise HTTPException(status_code=400, detail="Usuario incorrecto")
    
    user_password = user_dict.get("hashed_password")
    if not verify_password(form_data.password, user_password):
        raise HTTPException(status_code=400, detail="Contraseña incorrecta")
    
    # Creamos el token incluyendo el ROL del usuario
    access_token = create_access_token(
        data={"sub": user_dict["username"], "role": user_dict["role"]}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/")
def home():
    return {"message": "API de LogiPredict con Roles Activa"}