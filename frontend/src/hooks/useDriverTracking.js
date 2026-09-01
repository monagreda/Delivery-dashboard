// src/hooks/useDriverTracking.js
import { useState, useRef, useCallback, useEffect } from 'react';

// Import dinámico: maplibre-gl solo se descarga cuando realmente se usa.
// Para cuando esto se llama, MapDisplay ya cargó su propio chunk de
// maplibre-gl, así que este import resuelve al instante desde caché
// del navegador — sin descarga adicional ni impacto en el bundle inicial.
let maplibreglPromise;
const getMaplibreGl = () => {
    if (!maplibreglPromise) maplibreglPromise = import('maplibre-gl');
    return maplibreglPromise;
};

export const useDriverTracking = (mapRef, setStatus) => {
    const [driverLocation, setDriverLocation] = useState(null);
    const watchId = useRef(null);
    const driverMarker = useRef(null);

    // Mueve o inicializa el marcador azul del driver en el mapa
    const updateDriverOnMap = useCallback(async (pos) => {
        if (!mapRef.current) return;

        if (!driverMarker.current) {
            const { default: maplibregl } = await getMaplibreGl();
            if (!mapRef.current) return; // pudo desmontarse mientras esperábamos el import

            const el = document.createElement('div');
            el.className = 'driver-marker'; // Círculo azul pulsante CSS

            driverMarker.current = new maplibregl.Marker(el)
                .setLngLat([pos.lng, pos.lat])
                .addTo(mapRef.current);
        } else {
            driverMarker.current.setLngLat([pos.lng, pos.lat]);
        }
    }, [mapRef]);

    const startTracking = useCallback(() => {
        if (!navigator.geolocation) {
            setStatus("❌ GPS no soportado");
            return;
        }

        setStatus("🛰️ Activando GPS...");

        if (watchId.current !== null) {
            navigator.geolocation.clearWatch(watchId.current);
        }

        watchId.current = navigator.geolocation.watchPosition(
            (pos) => {
                const { longitude, latitude } = pos.coords;
                const newPos = { lng: longitude, lat: latitude };

                setDriverLocation(newPos);
                setStatus("✅ GPS Activo");
                updateDriverOnMap(newPos);
            },
            (err) => {
                console.error("Error GPS:", err);
                setStatus("❌ Error de ubicación");
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }, [setStatus, updateDriverOnMap]);

    const stopTracking = useCallback(() => {
        if (watchId.current !== null) {
            navigator.geolocation.clearWatch(watchId.current);
            watchId.current = null;
            setStatus("Listo");
        }
    }, [setStatus]);

    // Cleanup automático al desmontar el componente o cerrar sesión
    useEffect(() => {
        return () => {
            if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
            if (driverMarker.current) {
                driverMarker.current.remove();
                driverMarker.current = null;
            }
        };
    }, []);

    return { driverLocation, startTracking, stopTracking };
};