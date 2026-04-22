# 1. Base de Python
FROM python:3.11-slim

# 2. Dependencias del sistema (Imprescindible para las rutas de Caracas)
RUN apt-get update && apt-get install -y \
    libgdal-dev \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 3. Directorio de trabajo
WORKDIR /app

# 4. Instalación de librerías (Pandas, Scikit-learn, FastAPI, etc.)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copiamos todo el código (main.py, auth.py, database.py, etc.)
COPY . .

# 6. Puerto de salida
EXPOSE 8000

# 7. forzamos la creación de las tablas al construir la imagen
RUN python database.py

# 7. ÚNICO COMANDO DE ARRANQUE
# Usamos uvicorn para levantar la API de LogiPredict
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]