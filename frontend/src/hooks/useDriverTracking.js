// src/hooks/useDriverTracking.js
import { useState, useRef, useCallback, useEffect } from 'react';
import maplibregl from 'maplibre-gl';

export const useDriverTracking = (mapRef, setStatus) => {
    const [driverLocation, setDriverLocation] = useState(null);
    const watchId = useRef(null);
    const driverMarker = useRef(null);

    // Mueve o inicializa el marcador azul del driver en el mapa
    const updateDriverOnMap = useCallback((pos) => {
        if (!mapRef.current) return;

        if (!driverMarker.current) {
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