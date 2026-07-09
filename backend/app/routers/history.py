from fastapi import APIRouter, Depends, HTTPException
from app.database import get_db
# 💡 Ajusta estas importaciones según la ruta exacta de tu archivo de autenticación
from app.auth import get_current_user, get_current_admin 

router = APIRouter(
    prefix="/history",
    tags=["Historial de Pedidos"]
)

def format_history_results(rows):
    """Función auxiliar para convertir fechas a texto y evitar errores de JSON"""
    if not rows:
        return []
    for row in rows:
        if 'created_at' in row and row['created_at']:
            row['created_at'] = row['created_at'].isoformat()
        if 'delivered_at' in row and row['delivered_at']:
            row['delivered_at'] = row['delivered_at'].isoformat()
    return rows

@router.get("/user")
async def get_user_history(current_user = Depends(get_current_user), conn=Depends(get_db)):
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT o.order_id, o.status, o.created_at, o.delivered_at, o.lng, o.lat, o.zone,
                          d.username as driver 
                   FROM orders o 
                   LEFT JOIN users d ON o.driver_id = d.id 
                   WHERE o.user_id = %s AND o.status IN ('delivered', 'incident')
                   ORDER BY COALESCE(o.delivered_at, o.created_at) DESC
                   """,
                (current_user["id"],)
            )
            return format_history_results(cursor.fetchall())
    except Exception as e:
        print(f"Error User History: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/driver")
async def get_driver_history(current_user = Depends(get_current_user), conn=Depends(get_db)):
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT order_id, status, created_at, delivered_at, lng, lat, zone 
                   FROM orders 
                   WHERE driver_id = %s AND status IN ('delivered', 'incident') 
                   ORDER BY COALESCE(delivered_at, created_at) DESC
                   """, 
                (current_user["id"],)
            )
            return format_history_results(cursor.fetchall())
    except Exception as e:
        print(f"Error Driver History: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin")
async def get_admin_history(admin_user = Depends(get_current_admin), conn=Depends(get_db)):
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT o.order_id, o.status, o.created_at, o.delivered_at, o.lng, o.lat, o.zone,
                          u.username as client, d.username as driver 
                   FROM orders o 
                   JOIN users u ON o.user_id = u.id 
                   LEFT JOIN users d ON o.driver_id = d.id 
                   WHERE o.status IN ('delivered', 'incident')
                   ORDER BY COALESCE(o.delivered_at, o.created_at) DESC LIMIT 100
                   """
            )
            return format_history_results(cursor.fetchall())
    except Exception as e:
        print(f"Error Admin History: {e}")
        raise HTTPException(status_code=500, detail=str(e))