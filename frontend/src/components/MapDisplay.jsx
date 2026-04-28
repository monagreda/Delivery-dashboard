import React, { useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import axios from 'axios';

// importes de contexto y componentes
import { useAuth } from '../context/AuthContext';
import { useMap, ZONE_COLORS } from '../context/MapContext';
import { AdminPopup, UserPopup, DriverPopup } from './OrderPopups';

const MapDisplay = ({ isDark }) => {
    const { token, isLoggedIn, role } = useAuth();
    const {
        map,
        mapContainer,
        zones,
        setZones,
        fetchZones,
        setStatus,
        showRoutes,
        drivers,
        assignOrderToDriver,
        createOrder,
        zonesData,
        setMyOrders, // Asegúrate de que coincida con el nombre en MapContext
    } = useMap();

    // 1. Referencia para mantener los drivers actualizados dentro de los popups
    const driversRef = React.useRef(drivers);

    // 2. Mantenemos la referencia sincronizada cada vez que 'drivers' cambie
    useEffect(() => {
        driversRef.current = drivers;
    }, [drivers]);

    const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

    // 1. Configuración de capas (Sincronizado con MapContext)
    const setupLayers = useCallback(() => {
        if (!map.current) return;

        // FUENTE Y CAPA DE RUTAS
        if (!map.current.getSource('rutas')) {
            map.current.addSource('rutas', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
            map.current.addLayer({
                id: 'lineas-ruta',
                type: 'line',
                source: 'rutas',
                layout: { 'line-join': 'round', 'line-cap': 'round', 'visibility': showRoutes ? 'visible' : 'none' },
                paint: {
                    'line-color': [
                        'match', ['get', 'zone'],
                        0, ZONE_COLORS[0], 1, ZONE_COLORS[1],
                        2, ZONE_COLORS[2], 3, ZONE_COLORS[3],
                        4, ZONE_COLORS[4], 5, ZONE_COLORS[5],
                        '#ccc'
                    ],
                    'line-width': 3,
                    'line-opacity': 0.6,
                    'line-dasharray': [2, 1]
                }
            });
        }

        // FUENTE Y CAPA DE PEDIDOS (ID: puntos-entrega)
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
                        'case',
                        // 1. Si está entregado (por si acaso queda alguno en el buffer), lo ponemos transparente o gris
                        ['==', ['get', 'status'], 'delivered'], 'rgba(0,0,0,0)',

                        // 2. Si tiene un conductor asignado, usamos el verde esmeralda
                        ['>', ['to-number', ['get', 'driver_id']], 0], '#22c55e',

                        // 3. Si no, usamos el color de la zona según el clustering
                        ['match', ['to-number', ['get', 'zone']],
                            0, ZONE_COLORS[0], 1, ZONE_COLORS[1],
                            2, ZONE_COLORS[2], 3, ZONE_COLORS[3],
                            4, ZONE_COLORS[4], 5, ZONE_COLORS[5],
                            '#fff'
                        ]
                    ],
                    'circle-stroke-width': 2,
                    'circle-stroke-color': isDark ? '#0f172a' : '#fff'
                }
            });
        }
    }, [isDark, showRoutes]);

    // 2. Función para eliminar pedidos
    const deleteOrder = async (orderId) => {
        if (!window.confirm(`¿Seguro que quieres eliminar el pedido ${orderId}?`)) return;
        try {
            await axios.delete(`https://delivery-dashboard-4szq.onrender.com/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchZones(zones);
            // Cerrar popups
            const popups = document.getElementsByClassName('maplibregl-popup');
            for (let p of popups) p.remove();
        } catch (err) {
            alert("Error al eliminar: " + (err.response?.data?.detail || "Intenta de nuevo"));
        }
    };

    // 3. Inicialización del Mapa
    useEffect(() => {
        if (!isLoggedIn || map.current) return;
        if (map.current) return; // Evitar reiniciaciones

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: `https://api.maptiler.com/maps/${isDark ? 'streets-v2-dark' : 'streets-v2'}/style.json?key=${MAPTILER_KEY}`,
            center: [-66.89, 10.48], // Caracas
            zoom: 12
        });

        map.current.on('style.load', setupLayers);

        // Lógica de Drag & Drop para reubicar
        const onMove = () => { map.current.getCanvas().style.cursor = 'grabbing'; };
        const onUp = async (e, orderId) => {
            const { lng, lat } = e.lngLat;
            map.current.off('mousemove', onMove);
            map.current.getCanvas().style.cursor = '';
            try {
                setStatus('📍 Reubicando...');
                await axios.put(`https://delivery-dashboard-4szq.onrender.com/orders/${orderId}/location?lng=${lng}&lat=${lat}`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                fetchZones(zones);
                setStatus('✅ Ubicación guardada');
            } catch (err) {
                setStatus('❌ Error al mover');
                fetchZones(zones);
            }
        };

        map.current.on('mousedown', 'puntos-entrega', (e) => {
            e.preventDefault();
            const orderId = e.features[0].properties.order_id;
            map.current.on('mousemove', onMove);
            map.current.once('mouseup', (el) => onUp(el, orderId));
        });

        // Crear pedido con clic en el mapa
        map.current.on('click', async (e) => {
            const features = map.current.queryRenderedFeatures(e.point, { layers: ['puntos-entrega'] });
            if (features.length > 0) return; // Si clickeamos un punto, no crear uno nuevo

            const { lng, lat } = e.lngLat;

            if (window.confirm("¿Añadir pedido aquí?")) {
                try {
                    // ✅ CAMBIO CLAVE: Usamos la función del contexto en lugar de axios.post
                    // Esta función internamente debe hacer el POST y actualizar el estado de 'myOrders'
                    await createOrder(lng, lat);

                    // Refrescamos las zonas para actualizar los colores/rutas en el mapa
                    await fetchZones();

                } catch (err) {
                    // El error ya suele manejarse dentro de createOrder, 
                    // pero puedes poner un alert extra si lo prefieres
                    console.error("Error en la creación:", err);
                }
            }
        });

        // POPUPS de gestión de pedidos
        map.current.on('click', 'puntos-entrega', (e) => {
            const feature = e.features[0]; // Objeto completo con properties
            const coordinates = e.features[0].geometry.coordinates.slice();

            // IMPORTANTE: MapLibre a veces serializa las properties como strings. 
            // Vamos a normalizarlas para que el componente React no falle.
            const properties = {
                ...feature.properties,
                // Convertimos a número si es necesario, ya que desde el mapa vienen como string
                zone: Number(feature.properties.zone),
                driver_id: feature.properties.driver_id ? Number(feature.properties.driver_id) : 0
            };

            const container = document.createElement('div');
            const root = createRoot(container);

            const popup = new maplibregl.Popup({ offset: 15 })
                .setLngLat(coordinates)
                .setDOMContent(container)
                .addTo(map.current);

            popup.on('close', () => {
                setTimeout(() => root.unmount(), 0);
            });

            // Pasamos un objeto 'order' que tenga la estructura que tus Popups esperan
            const orderData = {
                properties: properties,
                geometry: feature.geometry
            };

            // IMPORTANTE: Pasamos 'order={feature}' en lugar de variables sueltas
            if (role === 'admin') {
                root.render(
                    <AdminPopup
                        order={orderData}
                        drivers={driversRef.current}
                        onDelete={(id) => { deleteOrder(id); popup.remove(); }}
                        onAssign={async (id, driverId) => {
                            if (!driverId) return;
                            await assignOrderToDriver(id, driverId);
                            popup.remove();
                            fetchZones(); // Refrescar para ver el cambio de color a verde
                        }}
                    />
                );
            } else if (role === 'driver') {
                root.render(<DriverPopup order={orderData} />);
            } else {
                root.render(
                    <UserPopup
                        order={orderData}
                        onDelete={(id) => { deleteOrder(id); popup.remove(); }}
                    />
                );
            }
        });

        map.current.on('mouseenter', 'puntos-entrega', () => {
            map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'puntos-entrega', () => {
            map.current.getCanvas().style.cursor = '';
        });

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, []);

    // 3. Actualización de datos en tiempo real (Híbrida: Admin y User)
    useEffect(() => {
        if (!map.current || !zonesData) return;

        const updateMapSource = () => {

            //Actualizamos puntos
            const pointSource = map.current.getSource('pedidos');
            if (pointSource) {
                pointSource.setData(zonesData);
                console.log("Capa 'pedidos' actualizada con:", zonesData.features.length, "puntos");
            }

            //Actualizar rutas
            const routesSource = map.current.getSource('rutas');
            if (routesSource) {
                // Si el backend envió rutas, las ponemos. 
                // Si no (o si falló), enviamos una colección vacía para LIMPIAR el mapa.
                const routesToRender = zonesData.routes_geojson || { type: 'FeatureCollection', features: [] };
                routesSource.setData(routesToRender);
            }
            console.log("ZonesData recibida:", zonesData)

            // 3. Ajustar cámara 
            if (zonesData.features?.length > 0) {
                const bounds = new maplibregl.LngLatBounds();
                zonesData.features.forEach(f => bounds.extend(f.geometry.coordinates));
                map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
            }
        };

        // Si el estilo ya cargó, actualizamos. Si no, esperamos al evento 'style.load'
        if (map.current.isStyleLoaded()) {
            updateMapSource();
        } else {
            map.current.once('style.load', updateMapSource);
        }
    }, [zonesData]); // Se dispara cada vez que zonesData cambie en el contexto

    // Función auxiliar para no repetir la estructura del Feature
    const formatToFeature = (o, zoneId) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [o.lng, o.lat] },
        properties: {
            order_id: o.order_id || o.id,
            zone: zoneId,
            driver_id: o.driver_id ? Number(o.driver_id) : 0,
            status: o.status
        }
    });

    // 4. Efecto de cambio de tema
    useEffect(() => {
        if (map.current) {
            const style = isDark ? 'streets-v2-dark' : 'streets-v2';
            map.current.setStyle(`https://api.maptiler.com/maps/${style}/style.json?key=${MAPTILER_KEY}`);
            map.current.once('style.load', setupLayers);
        }
    }, [isDark]);

    // 5. Visibilidad de rutas
    useEffect(() => {
        if (map.current && map.current.getLayer('lineas-ruta')) {
            map.current.setLayoutProperty('lineas-ruta', 'visibility', showRoutes ? 'visible' : 'none');
        }
    }, [showRoutes]);

    return <div ref={mapContainer} className="w-full h-full" />;
};

export default MapDisplay;

