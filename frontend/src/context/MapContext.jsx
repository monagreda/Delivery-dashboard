// src/context/MapContext.jsx
import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { deliveryService } from '../services/deliveryService';
import { useDriverTracking } from '../hooks/useDriverTracking';
import { ZONE_COLORS } from '../config/mapConfig';

const MapContext = createContext();

export const MapProvider = ({ children }) => {
    const { token, role, isLoggedIn } = useAuth();
    const map = useRef(null);
    const mapContainer = useRef(null);

    // Formulario y Coordenadas seleccionadas
    const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
    const [selectedOrderCoords, setSelectedOrderCoords] = useState(null);
    const [selectedOrderAddress, setSelectedOrderAddress] = useState('');
    const [selectedOrderPostcode, setSelectedOrderPostcode] = useState('');

    // Estados relacionados con clústeres y optimización
    const [zones, setZones] = useState(4);
    const [zoneStats, setZoneStats] = useState({});
    const [zoneDistances, setZoneDistances] = useState({});
    const [status, setStatus] = useState('Listo');
    const [showRoutes, setShowRoutes] = useState(true);
    const [zonesData, setZonesData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [drivers, setDrivers] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [originCoords, setOriginCoords] = useState({ lng: -3.70379, lat: 40.41678 }); // Madrid por defecto
    const [clickAddressDetails, setClickAddressDetails] = useState({ address: '', postCode: '', country: '' });
    const [estimatedDistance, setEstimatedDistance] = useState(null);
    const [myOrders, setMyOrders] = useState([]);

    // Hook personalizado de Geolocalización para conductores
    const { driverLocation, startTracking, stopTracking } = useDriverTracking(map, setStatus);

    // ⚡ ESTRATEGIA DE CACHÉ EN MEMORIA
    const cache = useRef({ lastFetch: 0, data: null, role: null, queryZones: 0 });

    const fetchZones = useCallback(async (numZones, forceRefresh = false) => {
        if (!token) return;

        const now = Date.now();
        const finalZones = numZones || zones || 4;

        // Si consultamos los mismos parámetros en menos de 10 seg, leemos de la memoria
        if (!forceRefresh &&
            cache.current.data &&
            (now - cache.current.lastFetch < 10000) &&
            cache.current.role === role &&
            cache.current.queryZones === finalZones
        ) {
            console.log("⚡ [Caché] Retornando GeoJSON de memoria");
            setZonesData(cache.current.data);

            if (role === 'driver' || role === 'user') {
                const ordersArray = cache.current.data.features ? cache.current.data.features.map(f => ({
                    order_id: f.properties.order_id,
                    status: f.properties.status,
                    driver_id: f.properties.driver_id,
                    zone: f.properties.zone,
                    lng: f.geometry.coordinates[0],
                    lat: f.geometry.coordinates[1]
                })) : [];
                setMyOrders(ordersArray);
            }
            return;
        }

        try {
            setIsLoading(true);
            setStatus('Cargando datos...');

            if (role === 'driver') {
                const data = await deliveryService.getDriverOrders(token);
                if (data) {
                    setZonesData(data);
                    const ordersArray = data.features ? data.features.map(f => ({
                        order_id: f.properties.order_id,
                        status: f.properties.status,
                        driver_id: f.properties.driver_id,
                        zone: f.properties.zone,
                        lng: f.geometry.coordinates[0],
                        lat: f.geometry.coordinates[1]
                    })) : [];
                    setMyOrders(ordersArray);
                    cache.current = { lastFetch: now, data, role, queryZones: finalZones };
                }
                setStatus('✅ Tus entregas cargadas');
            } else if (role === 'user') {
                const data = await deliveryService.getUserOrders(token);
                if (data) {
                    setZonesData(data);
                    const ordersArray = data.features ? data.features.map(f => ({
                        order_id: f.properties.order_id,
                        status: f.properties.status,
                        driver_id: f.properties.driver_id,
                        zone: f.properties.zone,
                        lng: f.geometry.coordinates[0],
                        lat: f.geometry.coordinates[1]
                    })) : [];
                    setMyOrders(ordersArray);
                    cache.current = { lastFetch: now, data, role, queryZones: finalZones };
                }
                setStatus('✅ Tus pedidos cargados');
            } else {
                const data = await deliveryService.getAdminZones(token, finalZones);
                if (data && data.geojson) {
                    const fullGeoJSON = {
                        ...data.geojson,
                        routes_geojson: data.routes_geojson || { type: 'FeatureCollection', features: [] }
                    };
                    setZonesData(fullGeoJSON);
                    setZoneStats(data.stats || {});
                    setZoneDistances(data.distances || {});
                    cache.current = { lastFetch: now, data: fullGeoJSON, role, queryZones: finalZones };
                }
                setStatus('✅ Zonas optimizadas por IA');
            }
        } catch (err) {
            console.error("Error cargando mapa:", err);
            setStatus('❌ Error de sincronización');
        } finally {
            setIsLoading(false);
        }
    }, [token, role, zones]);

    // Carga inicial de conductores para el Admin
    useEffect(() => {
        const loadDrivers = async () => {
            if (isLoggedIn && role === 'admin' && token) {
                try {
                    const data = await deliveryService.getDrivers(token);
                    setDrivers(data);
                } catch (err) {
                    console.error("Error al cargar lista de conductores:", err);
                }
            }
        };
        loadDrivers();
    }, [isLoggedIn, role, token]);

    // Crear un pedido
    const createOrder = useCallback(async (orderData) => {
        try {
            setStatus('Creando pedido...');
            const resData = await deliveryService.createOrder(token, orderData);

            if (resData) {
                setMyOrders(prev => [...prev, resData]);
                setIsOrderFormOpen(false);
                setSelectedOrderCoords(null);
            }
            setStatus('✅ Pedido creado');
            fetchZones(zones, true); // Forzar recarga real
        } catch (err) {
            console.error("Error al crear:", err);
            setStatus('❌ Error al crear pedido');
            throw err;
        }
    }, [token, fetchZones, zones]);

    // Asignar pedido a conductor
    const assignOrderToDriver = useCallback(async (orderId, driverId) => {
        try {
            setStatus('Asignando pedido...');
            await deliveryService.assignOrderToDriver(token, orderId, driverId);

            setStatus('✅ Pedido asignado');
            setSelectedOrder(null);
            fetchZones(zones, true); // Forzar recarga real
        } catch (err) {
            console.error("Error asignando:", err);
            setStatus('❌ Error al asignar');
        }
    }, [token, fetchZones, zones]);

    // Zoom enfocado a una zona de pedidos en el mapa
    const zoomToZone = useCallback((zoneId) => {
        if (!map.current || !zonesData) return;

        const zoneFeatures = zonesData.features.filter(f => f.properties.zone === parseInt(zoneId));
        if (zoneFeatures.length === 0) return;

        const bounds = new maplibregl.LngLatBounds();
        zoneFeatures.forEach(f => bounds.extend(f.geometry.coordinates));

        map.current.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 1500 });
    }, [zonesData]);

    // Marcar pedido como entregado (Driver)
    const markAsDelivered = useCallback(async (orderId, imageFile = null) => {
        try {
            setStatus('Actualizando entrega...');
            await deliveryService.deliverOrder(token, orderId, imageFile);
            setStatus('✅ Pedido entregado');
            fetchZones(zones, true); // Forzar recarga
        } catch (err) {
            console.error("Error al entregar:", err);
            setStatus('❌ Error en entrega');
        }
    }, [token, fetchZones, zones]);

    // Reportar un incidente (Driver)
    const reportIncident = useCallback(async (orderId, incidentType, description, imageFile = null) => {
        try {
            setStatus('Reportando incidente...');
            await deliveryService.reportIncident(token, orderId, incidentType, description, imageFile);
            setStatus('⚠️ Incidente reportado');
            fetchZones(zones, true); // Forzar recarga
        } catch (err) {
            console.error("Error reportando incidente:", err);
            setStatus('❌ Error en reporte');
        }
    }, [token, fetchZones, zones]);

    useEffect(() => {
        if (isLoggedIn && token) fetchZones(zones);
    }, [zones, token, isLoggedIn, fetchZones]);

    // Cálculo matemático reactivo de la distancia Sede -> Cliente
    useEffect(() => {
        if (!originCoords || !selectedOrderCoords) {
            setEstimatedDistance(null);
            return;
        }
        try {
            const lat1 = originCoords.lat;
            const lng1 = originCoords.lng;
            const lat2 = selectedOrderCoords.lat;
            const lng2 = selectedOrderCoords.lng;

            const R = 6371; // Radio terrestre en KM
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLng = (lng2 - lng1) * Math.PI / 180;

            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distanciaLineaRecta = R * c;
            const distanciaEstimadaCarretera = distanciaLineaRecta * 1.3;

            setEstimatedDistance(distanciaEstimadaCarretera);
        } catch (error) {
            console.error("Error en distancia reactiva:", error);
            setEstimatedDistance(15.0);
        }
    }, [originCoords, selectedOrderCoords]);

    const contextValue = useMemo(() => ({
        map, mapContainer,
        zones, setZones,
        zoneStats, zoneDistances,
        status, setStatus,
        showRoutes, setShowRoutes,
        fetchZones, zoomToZone,
        zonesData, isLoading,
        driverLocation, startTracking, stopTracking,
        drivers, createOrder,
        selectedOrder, setSelectedOrder,
        assignOrderToDriver,
        myOrders, setMyOrders,
        markAsDelivered, reportIncident,
        isOrderFormOpen, setIsOrderFormOpen,
        selectedOrderCoords, setSelectedOrderCoords,
        selectedOrderAddress, setSelectedOrderAddress,
        selectedOrderPostcode, setSelectedOrderPostcode,
        clickAddressDetails, setClickAddressDetails,
        estimatedDistance, setEstimatedDistance,
        originCoords, setOriginCoords
    }), [
        zones, zoneStats, zoneDistances, status, showRoutes, zonesData,
        isLoading, driverLocation, startTracking, stopTracking, drivers,
        selectedOrder, myOrders, isOrderFormOpen, selectedOrderCoords,
        selectedOrderAddress, selectedOrderPostcode, clickAddressDetails,
        estimatedDistance, originCoords, fetchZones, zoomToZone, createOrder,
        assignOrderToDriver, markAsDelivered, reportIncident
    ]);

    return (
        <MapContext.Provider value={contextValue}>
            {children}
        </MapContext.Provider>
    );
};

export const useMap = () => useContext(MapContext);
export { ZONE_COLORS };