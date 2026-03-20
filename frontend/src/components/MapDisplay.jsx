import React, { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useMap } from '../context/MapContext';

const MapDisplay = ({ isDark }) => {
    const { token, isLoggedIn } = useAuth();
    const { map, mapContainer, zones, fetchZones, setStatus } = useMap();
    const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

    // Función interna para eliminar pedidos
    const deleteOrder = async (orderId) => {
        if (!window.confirm(`¿Seguro que quieres eliminar el pedido ${orderId}?`)) return;
        try {
            await axios.delete(`http://127.0.0.1:8000/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchZones(zones);
            // Cerrar popups abiertos
            const popups = document.getElementsByClassName('maplibregl-popup');
            for (let p of popups) p.remove();
        } catch (err) {
            alert("Error al eliminar: " + (err.response?.data?.detail || "Intenta de nuevo"));
        }
    };

    useEffect(() => {
        if (!isLoggedIn || map.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: `https://api.maptiler.com/maps/${isDark ? 'streets-v2-dark' : 'streets-v2'}/style.json?key=${MAPTILER_KEY}`,
            center: [-66.89, 10.48],
            zoom: 12
        });

        map.current.on('style.load', () => {
            if (!map.current.getSource('pedidos')) {
                map.current.addSource('pedidos', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });
                map.current.addLayer({
                    id: 'puntos-entrega',
                    type: 'circle',
                    source: 'pedidos',
                    paint: {
                        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 15, 12],
                        'circle-color': [
                            'match', ['get', 'zone'],
                            0, '#FF5733', 1, '#33FF57', 2, '#3357FF',
                            3, '#F333FF', 4, '#FFD700', 5, '#00FFFF',
                            '#fff'
                        ],
                        'circle-stroke-width': 2,
                        'circle-stroke-color': isDark ? '#0f172a' : '#fff'
                    }
                });
            }
            fetchZones(zones);
        });

        // --- LÓGICA DE DRAG & DROP ---
        const onMove = () => { map.current.getCanvas().style.cursor = 'grabbing'; };

        const onUp = async (e, orderId) => {
            const { lng, lat } = e.lngLat;
            map.current.off('mousemove', onMove);
            map.current.getCanvas().style.cursor = '';
            try {
                setStatus('📍 Reubicando...');
                await axios.put(`http://127.0.0.1:8000/orders/${orderId}/location?lng=${lng}&lat=${lat}`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                fetchZones(zones);
                setStatus('✅ Ubicación guardada');
            } catch (err) {
                setStatus('❌ Error al mover');
                fetchZones(zones);
            }
        };

        const startDragging = (e) => {
            e.preventDefault();
            const orderId = e.features[0].properties.order_id;
            map.current.on('mousemove', onMove);
            map.current.once('mouseup', (el) => onUp(el, orderId));
        };

        map.current.on('mousedown', 'puntos-entrega', startDragging);

        // --- CREAR PEDIDO ---
        map.current.on('click', async (e) => {
            const features = map.current.queryRenderedFeatures(e.point, { layers: ['puntos-entrega'] });
            if (features.length > 0) return;
            const { lng, lat } = e.lngLat;
            if (window.confirm("¿Añadir pedido aquí?")) {
                try {
                    await axios.post(`http://127.0.0.1:8000/orders?lng=${lng}&lat=${lat}`, {}, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    fetchZones(zones);
                } catch (err) {
                    alert(err.response?.data?.detail || "Error al guardar");
                }
            }
        });

        // --- POPUPS ---
        map.current.on('click', 'puntos-entrega', (e) => {
            const coordinates = e.features[0].geometry.coordinates.slice();
            const { zone, order_id } = e.features[0].properties;
            const popupNode = document.createElement('div');
            popupNode.innerHTML = `
                <div class="p-3 min-w-150px dark:text-slate-200">
                    <h4 class="font-bold text-sm mb-1">Pedido #${order_id}</h4>
                    <p class="text-xs text-slate-500 mb-3">Zona: ${zone}</p>
                    <button id="btn-delete-${order_id}" class="w-full py-1.5 px-3 bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer">
                        ELIMINAR
                    </button>
                </div>
            `;
            popupNode.querySelector(`#btn-delete-${order_id}`).addEventListener('click', () => deleteOrder(order_id));
            new maplibregl.Popup({ className: 'custom-popup' }).setLngLat(coordinates).setDOMContent(popupNode).addTo(map.current);
        });

        map.current.on('mouseenter', 'puntos-entrega', () => { map.current.getCanvas().style.cursor = 'move'; });
        map.current.on('mouseleave', 'puntos-entrega', () => { map.current.getCanvas().style.cursor = ''; });

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, [isLoggedIn, token]); // Se inicializa al entrar

    // Efecto separado para el cambio de tema sin recargar el mapa
    useEffect(() => {
        if (map.current) {
            const style = isDark ? 'streets-v2-dark' : 'streets-v2';
            map.current.setStyle(`https://api.maptiler.com/maps/${style}/style.json?key=${MAPTILER_KEY}`);
        }
    }, [isDark]);

    return <div ref={mapContainer} className="w-full h-full" />;
};

export default MapDisplay;