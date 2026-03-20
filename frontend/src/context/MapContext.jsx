import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext'; // Usamos el contexto que acabas de crear

const MapContext = createContext();

export const MapProvider = ({ children }) => {
    const { token, role, logout, isLoggedIn } = useAuth();
    const map = useRef(null);
    const mapContainer = useRef(null);

    const [zones, setZones] = useState(4);
    const [zoneStats, setZoneStats] = useState({});
    const [status, setStatus] = useState('Listo');

    const fetchZones = useCallback(async (numZones) => {
        if (!map.current || !token) return;

        setStatus('Cargando datos...');
        try {
            const url = role === 'admin'
                ? `http://127.0.0.1:8000/admin/optimize-zones?n_clusters=${numZones}`
                : `http://127.0.0.1:8000/orders`;

            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Verificamos que el mapa y la fuente existan antes de actualizar
            if (map.current.isStyleLoaded() && map.current.getSource('pedidos')) {
                const data = role === "admin" ? res.data.geojson : res.data;
                map.current.getSource('pedidos').setData(data);

                if (role === "admin") setZoneStats(res.data.stats);
                setStatus(role === "admin" ? `✅ ${numZones} zonas optimizadas` : '✅ Datos actualizados');
            }
        } catch (err) {
            if (err.response?.status === 401) {
                logout();
                setStatus('Sesión expirada');
            } else {
                setStatus('❌ Error de conexión');
            }
        }
    }, [token, role, logout]);

    // 3. DISPARADOR AUTOMÁTICO (Fuera de fetchZones)
    // Este efecto vigila 'zones' y 'token'. Si cambian, recarga los puntos.
    useEffect(() => {
        if (isLoggedIn && token) {
            fetchZones(zones);
        }
    }, [zones, token, isLoggedIn, fetchZones]);

    return (
        <MapContext.Provider value={{
            map, mapContainer, zones, setZones, zoneStats, status, setStatus, fetchZones
        }}>
            {children}
        </MapContext.Provider>
    );
};

export const useMap = () => useContext(MapContext);