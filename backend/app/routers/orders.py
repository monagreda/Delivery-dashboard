# app/routers/orders.py
import uuid
from fastapi import APIRouter, Depends, HTTPException
from app.database import get_db
from app.auth import get_current_user
from app.models import IncidentReport, OrderCreate

router = APIRouter(
    prefix="/orders",
    tags=["Orders"]
)

@router.post("")
async def create_new_order(order_data: OrderCreate, current_user = Depends(get_current_user), conn=Depends(get_db)):
    order_id = str(uuid.uuid4())[:8] # Genera un ID corto único
    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO orders (
                        order_id, lng, lat, origin_address, origin_postcode, 
                        destination_address, destination_postcode, weight_kg, 
                        volume_m3, cargo_description, user_id, status
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending')
                    RETURNING order_id, status
                    """,
                    (
                        order_id, order_data.lng, order_data.lat, order_data.origin_address,
                        order_data.origin_postcode, order_data.destination_address,
                        order_data.destination_postcode, order_data.weight_kg,
                        order_data.volume_m3, order_data.cargo_description, current_user["id"]
                    )
                )
                new_order = cursor.fetchone()
        return {"message": "Pedido de carga creado exitosamente", "order": new_order}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar pedido: {str(e)}")

@router.get("/my-orders")
async def get_my_orders(current_user = Depends(get_current_user), conn=Depends(get_db)):
    role = current_user.get("role")
    with conn.cursor() as cursor:
        if role == "driver":
            cursor.execute("SELECT * FROM orders WHERE driver_id = %s ORDER BY created_at DESC", (current_user["id"],))
        else:
            cursor.execute("SELECT * FROM orders WHERE user_id = %s ORDER BY created_at DESC", (current_user["id"],))
        orders = cursor.fetchall()
    return orders

@router.patch("/{order_id}/deliver")
async def deliver_order(order_id: str, current_user = Depends(get_current_user), conn=Depends(get_db)):
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Solo los conductores pueden entregar pedidos")
    
    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE orders 
                    SET status = 'delivered', delivered_at = NOW() 
                    WHERE order_id = %s AND driver_id = %s 
                    RETURNING order_id, status
                    """,
                    (order_id, current_user["id"])
                )
                updated = cursor.fetchone()
                if not updated:
                    raise HTTPException(status_code=404, detail="Pedido no encontrado o no asignado a este conductor")
        return {"message": "Pedido marcado como entregado", "order": updated}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{order_id}/incident")
async def report_order_incident(
    order_id: str, 
    incident_data: IncidentReport, 
    current_user = Depends(get_current_user), 
    conn = Depends(get_db)
):
    # Restricción de seguridad: Solo los conductores en ruta o asignados reportan siniestros
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Solo los conductores pueden reportar incidentes")
    
    try:
        with conn:
            with conn.cursor() as cursor:
                # 1. Actualizamos el estado de la orden a 'incident' y podemos guardar los detalles 
                # en columnas dedicadas si las agregas a tu tabla, o simplemente congelar la orden.
                cursor.execute(
                    """
                    UPDATE orders 
                    SET status = 'incident' 
                    WHERE order_id = %s AND driver_id = %s 
                    RETURNING order_id, status
                    """,
                    (order_id, current_user["id"])
                )
                updated = cursor.fetchone()
                
                if not updated:
                    raise HTTPException(
                        status_code=404, 
                        detail="Pedido no encontrado o no está asignado a tu usuario"
                    )
                
                # OPTATIVO: Si tienes una tabla de auditoría o logs de incidentes, puedes meter un INSERT aquí:
                # cursor.execute(
                #     "INSERT INTO order_incidents (order_id, type, description, driver_id) VALUES (%s, %s, %s, %s)",
                #     (order_id, incident_data.incident_type, incident_data.description, current_user["id"])
                # )
                
        return {
            "message": "Incidente registrado de inmediato. Central de Go Tovar alertada.", 
            "order": updated
        }
        
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error al procesar siniestro: {str(e)}")
    
# Ruta para actualizar la ubicación del repartidor en tiempo real
@router.put("/{order_id}/location")
async def update_order_location(order_id: str, lng: float, lat: float, current_user = Depends(get_current_user), conn = Depends(get_db)):
    try:
        with conn:
            with conn.cursor() as cursor:
                # Actualiza la ubicación geográfica de la orden en ruta
                cursor.execute(
                    "UPDATE orders SET lat = %s, lng = %s WHERE order_id = %s RETURNING order_id",
                    (lat, lng, order_id)
                )
                updated = cursor.fetchone()
                if not updated:
                    raise HTTPException(status_code=404, detail="Orden no encontrada")
        return {"status": "success", "message": "Ubicación del repartidor actualizada"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error GPS: {str(e)}")