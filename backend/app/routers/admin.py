# app/routers/admin.py
import os
import requests
import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sklearn.cluster import KMeans
from scipy.spatial.distance import cdist

from app.database import get_db
from app.auth import get_current_admin
from app.models import OrderAssignment

router = APIRouter(
    prefix="/admin",
    tags=["Admin & AI Optimization"]
)

GRAPHHOPPER_KEY = os.getenv("GH_KEY")

@router.get("/drivers")
async def get_available_drivers(admin_user=Depends(get_current_admin), conn=Depends(get_db)):
    with conn.cursor() as cursor:
        cursor.execute("SELECT id, username, role FROM users WHERE role = 'driver'")
        drivers = cursor.fetchall()
    return drivers


@router.post("/assign-order")
async def assign_order(order_id: str, driver_id: int, admin_user=Depends(get_current_admin), conn=Depends(get_db)):
    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "UPDATE orders SET driver_id = %s, status = 'assigned' WHERE order_id = %s RETURNING order_id, status",
                    (driver_id, order_id)
                )
                updated = cursor.fetchone()
                if not updated:
                    raise HTTPException(status_code=404, detail="Pedido no encontrado")
        return {"status": "success", "order": updated}
    except Exception as e:
        conn.rollback()
        print(f"🔥 Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/optimize-zones")
async def optimize_zones(n_clusters: int = 4, admin_user=Depends(get_current_admin), conn=Depends(get_db)):
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT order_id, lng, lat, status, driver_id FROM orders WHERE status != 'delivered'")
            orders = cursor.fetchall()

        if not orders:
            return {"geojson": {"type": "FeatureCollection", "features": []}, "routes_geojson": {"type": "FeatureCollection", "features": []}, "stats": {}, "distances": {}}

        # Si hay menos pedidos que los clústeres pedidos, reducimos los clústeres dinámicamente
        n_clusters = min(n_clusters, len(orders))

        # Preparar coordenadas para K-Means
        coords = np.array([[o['lng'], o['lat']] for o in orders])
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10).fit(coords)
        labels = kmeans.labels_

        features = []
        zones_points = {i: [] for i in range(n_clusters)}
        stats = {i: 0 for i in range(n_clusters)}

        # 1. Agrupar puntos y preparar GeoJSON de los marcadores
        with conn:
            with conn.cursor() as cursor:
                for idx, o in enumerate(orders):
                    z = int(labels[idx])
                    stats[z] += 1
                    zones_points[z].append([o['lng'], o['lat']])

                    cursor.execute("UPDATE orders SET zone = %s WHERE order_id = %s", (z, o['order_id']))

                    features.append({
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [o['lng'], o['lat']]},
                        "properties": {
                            "order_id": o['order_id'],
                            "zone": z,
                            "driver_id": o['driver_id'] if o['driver_id'] else 0,
                            "status": o['status']
                        }
                    })
            conn.commit()

        # 2. Calcular Rutas Óptimas con el algoritmo del Vecino Más Cercano y GraphHopper
        routes_features = []
        distances_per_zone = {}

        for z in range(n_clusters):
            pts = zones_points[z]
            if len(pts) == 0:
                continue

            # Ordenamiento por proximidad espacial (SciPy)
            unvisited = pts.copy()
            ordered_route = [unvisited.pop(0)]
            while unvisited:
                last = ordered_route[-1]
                distances = cdist([last], unvisited)[0]
                closest_idx = np.argmin(distances)
                ordered_route.append(unvisited.pop(closest_idx))

            # Si es un solo punto, no hay ruta que trazar
            if len(ordered_route) < 2:
                distances_per_zone[z] = 0
                continue

            # Petición a GraphHopper
            gh_url = f"https://graphhopper.com/api/1/route?key={GRAPHHOPPER_KEY}"
            payload = {
                "points": ordered_route,
                "profile": "car",
                "locale": "es",
                "points_encoded": False
            }

            try:
                resp = requests.post(gh_url, json=payload, timeout=5)
                if resp.status_code == 200:
                    path = resp.json()['paths'][0]
                    routes_features.append({
                        "type": "Feature",
                        "properties": {"zone": z},
                        "geometry": path['points']
                    })
                    distances_per_zone[z] = round(path.get('distance', 0) / 1000, 2)
                else:
                    raise Exception()
            except:
                # Fallback: Si GraphHopper falla o no tiene cobertura, dibuja una línea recta
                routes_features.append({
                    "type": "Feature",
                    "properties": {"zone": z},
                    "geometry": {"type": "LineString", "coordinates": ordered_route}
                })
                distances_per_zone[z] = 0.0

        return {
            "geojson": {"type": "FeatureCollection", "features": features},
            "routes_geojson": {"type": "FeatureCollection", "features": routes_features},
            "stats": stats,
            "distances": distances_per_zone
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error interno IA: {str(e)}")