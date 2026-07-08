# app/routers/orders.py
import uuid
import time
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
    order_id = f"GTV-{int(time.time())}" 
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

# 🎯 RESTAURADO: GET /orders que devuelve GeoJSON para el mapa del usuario/admin
@router.get("")
async def get_all_orders_geojson(current_user = Depends(get_current_user), conn=Depends(get_db)):
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT lng, lat, order_id, zone, status, driver_id FROM orders WHERE user_id = %s", 
            (current_user["id"],)
        )
        rows = cursor.fetchall()

    features = [{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [r['lng'], r['lat']]},
        "properties": {
            "zone": r['zone'], 
            "order_id": r['order_id'], 
            "status": r["status"], 
            "driver_id": r["driver_id"]
        }
    } for r in rows]
    return {"type": "FeatureCollection", "features": features}

# 🎯 RESTAURADO: El endpoint del Conductor con formato GeoJSON (Evita el 404)
@router.get("/driver/my-orders")
async def get_driver_orders_geojson(current_user = Depends(get_current_user), conn=Depends(get_db)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Acceso denegado")
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT order_id, lng, lat, status, driver_id FROM orders WHERE driver_id = %s AND status = 'assigned'", 
            (current_user["id"],)
        )
        rows = cursor.fetchall()
    
    features = [{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [r["lng"], r["lat"]]},
        "properties": {"order_id": r["order_id"], "status": r["status"], "driver_id": r["driver_id"]}
    } for r in rows]
    return {"type": "FeatureCollection", "features": features}

# 🎯 RESTAURADO: El endpoint de Drag & Drop para actualizar ubicación en el mapa
@router.put("/{order_id}/location")
async def update_order_location(order_id: str, lng: float, lat: float, current_user = Depends(get_current_user), conn=Depends(get_db)):
    user_id = current_user["id"]
    user_role = current_user["role"]

    with conn:
        with conn.cursor() as cursor:
            if user_role == "admin":
                cursor.execute("UPDATE orders SET lng = %s, lat = %s WHERE order_id = %s", (lng, lat, order_id))
            else:
                cursor.execute(
                    "UPDATE orders SET lng = %s, lat = %s WHERE order_id = %s AND user_id = %s",
                    (lng, lat, order_id, user_id)
                )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="No encontrado o sin permisos")
    return {"status": "success", "message": "Ubicación actualizada"}

# 🎯 RESTAURADO: El endpoint para eliminar pedidos desde el mapa
@router.delete("/{order_id}")
async def delete_order(order_id: str, current_user = Depends(get_current_user), conn=Depends(get_db)):
    with conn:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM orders WHERE order_id = %s AND user_id = %s", (order_id, current_user["id"]))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="No se pudo eliminar")
    return {"message": "Eliminado con éxito"}

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
                    raise HTTPException(status_code=404, detail="Pedido no encontrado o no asignado")
        return {"message": "Pedido marcado como entregado", "order": updated}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{order_id}/incident")
async def report_order_incident(order_id: str, incident_data: IncidentReport, current_user = Depends(get_current_user), conn = Depends(get_db)):
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Solo los conductores pueden reportar incidentes")
    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "UPDATE orders SET status = 'incident' WHERE order_id = %s AND driver_id = %s RETURNING order_id, status",
                    (order_id, current_user["id"])
                )
                updated = cursor.fetchone()
                if not updated:
                    raise HTTPException(status_code=404, detail="Pedido no encontrado")
        return {"message": "Incidente registrado de inmediato.", "order": updated}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    
# 🎯 RESTAURADO: Endpoint para obtener pedidos de un conductor en formato GeoJSON
@router.get("/driver/my-orders")
async def get_driver_orders_geojson(current_user = Depends(get_current_user), conn = Depends(get_db)):
    # 1. Forzar que solo los usuarios con rol 'driver' puedan consumir este endpoint
    if current_user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Acceso denegado. Solo para conductores.")
        
    with conn.cursor() as cursor:
        # 2. Buscamos las órdenes asignadas a este conductor en específico
        cursor.execute(
            """
            SELECT order_id, lng, lat, status, driver_id, zone 
            FROM orders 
            WHERE driver_id = %s AND status = 'assigned'
            """, 
            (current_user["id"],)
        )
        rows = cursor.fetchall()
    
    # 3. Empaquetamos la respuesta en el formato GeoJSON (FeatureCollection) que MapDisplay espera
    features = [{
        "type": "Feature",
        "geometry": {
            "type": "Point", 
            "coordinates": [float(r["lng"]), float(r["lat"])]
        },
        "properties": {
            "order_id": r["order_id"], 
            "status": r["status"], 
            "driver_id": r["driver_id"],
            "zone": r.get("zone", 0)
        }
    } for r in rows]
    
    return {"type": "FeatureCollection", "features": features}