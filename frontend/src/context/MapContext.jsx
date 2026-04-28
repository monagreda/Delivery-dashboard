import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import maplibregl from 'maplibre-gl'
import { useAuth } from './AuthContext'; // Usamos el contexto que acabas de crear

const MapContext = createContext();

export const MapProvider = ({ children }) => {
    const { token, role, logout, isLoggedIn } = useAuth();
    const map = useRef(null);
    const mapContainer = useRef(null);

    // Estados relacionados con zonas y optimización
    const [zones, setZones] = useState(4);
    const [zoneStats, setZoneStats] = useState({});
    const [zoneDistances, setZoneDistances] = useState({});
    const [status, setStatus] = useState('Listo');
    const [showRoutes, setShowRoutes] = useState(true);
    const [zonesData, setZonesData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [drivers, setDrivers] = useState([]); // lista de conductores
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [driverLocation, setDriverLocation] = useState(null);
    const watchId = useRef(null); //apagar el gps cuando no se esta usando
    const [myOrders, setMyOrders] = useState([]); // Pedidos específicos del driver
    const driverMarker = useRef(null);

    // ==========================================================================================================================
    // Función para actualizar o crear el marcador del conductor en el mapa
    const fetchZones = useCallback(async (numZones) => {
        // 🚩 VALIDACIÓN CRÍTICA: Si numZones es undefined, usa el estado 'zones' o un valor por defecto (4)
        const finalZones = numZones || zones || 4

        if (!map.current || !token) return;

        setIsLoading(true);
        setStatus('Cargando datos...');

        try {
            const url = role === 'admin'
                ? `${import.meta.env.VITE_API_URL}/admin/optimize-zones?n_clusters=${numZones}`
                : role === 'driver'
                    ? `${import.meta.env.VITE_API_URL}/driver/my-orders`
                    : `${import.meta.env.VITE_API_URL}/orders`;

            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            let geojsonParaMapa;
            let listaParaEstado = [];

            // 1. Normalización
            if (role === 'admin') {
                // CAPTURAMOS TODO: puntos y rutas
                const puntos = res.data?.geojson || { type: 'FeatureCollection', features: [] };
                const rutas = res.data?.routes_geojson || { type: 'FeatureCollection', features: [] };

                // Construimos un objeto unificado que mantenga la estructura GeoJSON para los puntos
                // pero que guarde las rutas como una propiedad extra.
                geojsonParaMapa = {
                    ...puntos,
                    routes_geojson: rutas // <--- ESTO es lo que le faltaba a MapDisplay
                };
                listaParaEstado = Array.isArray(res.data?.zones) ? res.data.zones : [];
            } else {
                geojsonParaMapa = res.data;

                if (res.data && res.data.features) {
                    listaParaEstado = res.data.features.map(f => ({
                        id: f.properties.order_id,
                        order_id: f.properties.order_id,
                        lng: f.geometry.coordinates[0],
                        lat: f.geometry.coordinates[1],
                        zone: f.properties.zone,
                        status: f.properties.status || 'pending', // por si lo usas
                        ...f.properties // traemos todo lo demás
                    }));
                };
            }

            // 2. ACTUALIZAR ESTADOS (Dentro del try, donde las variables existen)
            setZonesData(geojsonParaMapa);
            setMyOrders(listaParaEstado);

            if (role === "admin") {
                setZoneStats(res.data.stats || {});
                setZoneDistances(res.data.distances || {});
            }

            setStatus('✅ Listo');
        } catch (err) {
            console.error("Error en fetchZones:", err);
            setStatus(err.response?.status === 401 ? 'Sesión expirada' : '❌ Error');
            if (err.response?.status === 401) logout();
        } finally {
            setIsLoading(false); // Usar finally asegura que el loading se apague siempre
        }
    }, [token, role, logout]);
    // ==========================================================================================================================

    // Cargar lista de conductores (Drivers) al iniciar
    useEffect(() => {
        const loadDrivers = async () => {
            console.log("Estado Auth", { isLoggedIn, role, token: !!token })
            if (isLoggedIn && role === 'admin' && token) {
                try {
                    const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/drivers`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setDrivers(res.data);
                } catch (err) {
                    console.error("Error cargando conductores:", err.response?.data || err);
                }
            }
        };
        loadDrivers();
    }, [isLoggedIn, role, token]);

    // Crear orden
    // DENTRO DE MapContext.jsx
    const createOrder = useCallback(async (lng, lat) => {
        try {
            setStatus('Creando pedido...');

            // El backend crea el pedido
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/orders?lng=${lng}&lat=${lat}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Actualizamos la lista del sidebar inmediatamente
            if (res.data) {
                setMyOrders(prev => [...prev, res.data]);
            }

            setStatus('✅ Pedido creado');

            // REFRESCAMOS TODO: 
            // Al llamar a fetchZones, se ejecuta la lógica que SÍ tiene el geojson definido
            await fetchZones(zones);

        } catch (err) {
            console.error("Error al crear pedido:", err);
            setStatus('❌ Error al crear pedido');
            throw err; // Re-lanzamos para que el try/catch de MapDisplay también lo vea
        }
    }, [token, fetchZones, zones]);

    //Asignar orden a conductor
    const assignOrderToDriver = useCallback(async (orderId, driverId) => {
        try {
            setStatus('Asignando pedido...');
            await axios.patch(`${import.meta.env.VITE_API_URL}/orders/${orderId}/assign`,
                { driver_id: parseInt(driverId) },
                { headers: { Authorization: `Bearer ${token}` } },
            );

            setStatus('✅ Pedido asignado');
            setSelectedOrder(null); // Cerramos el popup tras asignar

            // Refrescamos los datos para que el mapa se actualice (puedes volver a llamar a fetchZones)
            fetchZones(zones);
        } catch (err) {
            console.error("Error asignando:", err);
            setStatus('❌ Error al asignar');
        }
    }, [token, fetchZones, zones])



    //Zoom zone
    const zoomToZone = useCallback((zoneId) => {
        if (!map.current || !zonesData) return;

        // Filtrar puntos que pertenecen a la zona seleccionada
        const zoneFeatures = zonesData.features.filter(
            f => f.properties.zone === parseInt(zoneId)
        );

        if (zoneFeatures.length === 0) return;

        // Crear límites (Bounds) para esos puntos
        const bounds = new maplibregl.LngLatBounds();
        zoneFeatures.forEach(f => bounds.extend(f.geometry.coordinates));

        // Mover la cámara con un efecto suave
        map.current.fitBounds(bounds, {
            padding: 80, // Espacio alrededor de los puntos
            maxZoom: 15,
            duration: 1500 // 1.5 segundos de animación
        });
    }, [zonesData]);

    // ===========================================================================================================================

    // Función para actualizar o crear el marcador del conductor en el mapa
    const updateDriverOnMap = (pos) => {
        if (!map.current) return;

        // Si el marcador no existe, lo creamos
        if (!driverMarker.current) {
            const el = document.createElement('div');
            el.className = 'driver-marker'; // Luego le damos estilo CSS (punto azul pulsante)

            driverMarker.current = new maplibregl.Marker(el)
                .setLngLat([pos.lng, pos.lat])
                .addTo(map.current);
        } else {
            // Si ya existe, solo lo movemos suavemente
            driverMarker.current.setLngLat([pos.lng, pos.lat]);
        }
    };
    // ===========================================================================================================================

    // Función para iniciar el seguimiento del GPS
    const startTracking = useCallback(() => {
        if (!navigator.geolocation) {
            setStatus("❌ GPS no soportado");
            return;
        }

        setStatus("🛰️ Activando GPS...");

        watchId.current = navigator.geolocation.watchPosition(
            (pos) => {
                const { longitude, latitude } = pos.coords;
                const newPos = { lng: longitude, lat: latitude };

                setDriverLocation(newPos);
                setStatus("✅ GPS Activo");

                // Actualizar o crear el marcador en el mapa
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
    }, []);
    // ===========================================================================================================================

    // Función para detener el seguimiento (ahorro de batería)
    const stopTracking = useCallback(() => {
        if (watchId.current !== null) {
            navigator.geolocation.clearWatch(watchId.current);
            watchId.current = null;
            setStatus("Listo");
        }
    }, []);

    // ============================================================================================================================

    // Función para marcar un pedido como entregado (solo Drivers)
    const markAsDelivered = useCallback(async (orderId) => {
        try {
            setStatus('Actualizando entrega...');
            await axios.patch(`${import.meta.env.VITE_API_URL}/orders/${orderId}/deliver`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setStatus('✅ Pedido entregado');

            // Refrescamos todo: esto hará que el punto desaparezca de los mapas 
            // y las listas si el backend ya filtró los "entregados".
            fetchZones(zones);
        } catch (err) {
            console.error("Error al entregar:", err);
            setStatus('❌ Error en el servidor');
        }
    }, [token, fetchZones, zones]);

    // 3. DISPARADOR AUTOMÁTICO (Fuera de fetchZones)
    // Este efecto vigila 'zones' y 'token'. Si cambian, recarga los puntos.
    useEffect(() => {
        if (isLoggedIn && token) {
            fetchZones(zones);
        }
    }, [zones, token, isLoggedIn, fetchZones]);

    return (
        <MapContext.Provider value={{
            map, mapContainer,
            zones, setZones,
            zoneStats,
            zoneDistances,
            status, setStatus,
            showRoutes, setShowRoutes,
            fetchZones,
            zoomToZone,
            zonesData,
            isLoading,
            driverLocation,
            startTracking,
            stopTracking,
            drivers,
            createOrder,
            selectedOrder, setSelectedOrder,
            assignOrderToDriver,
            myOrders,
            setMyOrders,
            isLoading,
            markAsDelivered
        }}>
            {children}
        </MapContext.Provider>
    );
};

export const useMap = () => useContext(MapContext);

export const ZONE_COLORS = [
    '#FF5733', //Naranja
    '#33FF57', //Verde
    '#3357FF', //Azul
    '#F333FF', //Rosado
    '#FFD700', //Dorado
    '#00FFFF'  //Cian
];
