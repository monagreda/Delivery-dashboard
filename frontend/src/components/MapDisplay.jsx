import React, { useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import axios from 'axios';

// importes de contexto y componentes
import { useAuth } from '../context/AuthContext';
import { useMap, ZONE_COLORS } from '../context/MapContext';
import { AdminPopup, UserPopup, DriverPopup } from './OrderPopups';
import OrderFormModal from '../pages/OrderForm';

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
        setMyOrders,
        setIsOrderFormOpen,
        setSelectedOrderCoords,
        setSelectedOrderAddress,
        setSelectedOrderPostcode,
        selectedOrderCoords,
        selectedOrderAddress,
        setClickAddressDetails,
        setEstimatedDistance,
    } = useMap();

    // 1. Referencias para mantener los datos actualizados dentro de los eventos del mapa (evita closures obsoletas)
    const driversRef = React.useRef(drivers);
    const roleRef = React.useRef(role);
    const tokenRef = React.useRef(token);
    const zonesRef = React.useRef(zones);
    const fetchZonesRef = React.useRef(fetchZones);
    const assignOrderToDriverRef = React.useRef(assignOrderToDriver);

    // Mantenemos las referencias sincronizadas en cada render sin provocar re-inicializaciones
    useEffect(() => { driversRef.current = drivers; }, [drivers]);
    useEffect(() => { roleRef.current = role; }, [role]);
    useEffect(() => { tokenRef.current = token; }, [token]);
    useEffect(() => { zonesRef.current = zones; }, [zones]);
    useEffect(() => { fetchZonesRef.current = fetchZones; }, [fetchZones]);
    useEffect(() => { assignOrderToDriverRef.current = assignOrderToDriver; }, [assignOrderToDriver]);

    const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

    // Configuración de capas (Sincronizado con MapContext)
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
                        // 1. Si está entregado, lo ponemos transparente o gris
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

    // Referencia para usar setupLayers de forma estable en la inicialización sin recrear el mapa
    const setupLayersRef = React.useRef(setupLayers);
    useEffect(() => {
        setupLayersRef.current = setupLayers;
    }, [setupLayers]);

    // 2. Función para eliminar pedidos (utilizando las referencias para evitar closures obsoletas)
    const deleteOrder = async (orderId) => {
        if (!window.confirm(`¿Seguro que quieres eliminar el pedido ${orderId}?`)) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${tokenRef.current}` }
            });
            fetchZonesRef.current(zonesRef.current);
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

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: `https://api.maptiler.com/maps/${isDark ? 'basic-v2-dark' : 'basic-v2'}/style.json?key=${MAPTILER_KEY}`,
            center: [-3.70379, 40.41678], // Centro de Madrid
            zoom: 13
        });

        // Interceptar imágenes faltantes para silenciar la advertencia de MapTiler
        map.current.on('styleimagemissing', (e) => {
            const id = e.id;
            // Si el mapa pide un sprite que es vacío, nulo o un espacio en blanco " "
            if (id === ' ' || !id.trim()) {
                const width = 1;
                const height = 1;
                const data = new Uint8Array([0, 0, 0, 0]); // Generamos un pixel transparente (RGBA)

                // Si por casualidad ya se agregó, evitamos pisarlo para no causar conflictos
                if (map.current && !map.current.hasImage(id)) {
                    map.current.addImage(id, { width, height, data });
                }
            }
        });

        // Llamar a setupLayers a través del Ref para que siempre use la función más actualizada
        map.current.on('style.load', () => {
            setupLayersRef.current();
        });

        // Lógica de Drag & Drop para reubicar (utilizando referencias actualizadas)
        const onMove = () => { map.current.getCanvas().style.cursor = 'grabbing'; };
        const onUp = async (e, orderId) => {
            const { lng, lat } = e.lngLat;
            map.current.off('mousemove', onMove);
            map.current.getCanvas().style.cursor = '';
            try {
                setStatus('📍 Reubicando...');
                await axios.put(`${import.meta.env.VITE_API_URL}/orders/${orderId}/location?lng=${lng}&lat=${lat}`, {}, {
                    headers: { Authorization: `Bearer ${tokenRef.current}` }
                });
                fetchZonesRef.current(zonesRef.current);
                setStatus('✅ Ubicación guardada');
            } catch (err) {
                setStatus('❌ Error al mover');
                fetchZonesRef.current(zonesRef.current);
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

            setSelectedOrderCoords({ lng, lat });
            setIsOrderFormOpen(true);
            setSelectedOrderAddress('Buscando dirección...');
            setSelectedOrderPostcode('');

            if (typeof setClickAddressDetails === 'function') {
                setClickAddressDetails({ address: 'Buscando...', postcode: '', country: '' });
            }

            try {
                setStatus('🔍 Buscando dirección...');
                const response = await fetch(
                    `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${MAPTILER_KEY}`
                );
                const data = await response.json();

                if (data.features && data.features.length > 0) {
                    const firstFeature = data.features[0];
                    const fullAddress = firstFeature.place_name;

                    setSelectedOrderAddress(fullAddress);

                    let postcode = '';
                    let country = '';

                    if (firstFeature.context) {
                        const postalContext = firstFeature.context.find(c => c.id && c.id.startsWith('postal_code'));
                        if (postalContext) postcode = postalContext.text;

                        const countryContext = firstFeature.context.find(c => c.id && c.id.startsWith('country'));
                        if (countryContext) country = countryContext.text;
                    }

                    if (!postcode && firstFeature.properties?.postal_code) {
                        postcode = firstFeature.properties.postal_code;
                    }

                    setSelectedOrderPostcode(postcode || 'S/N');

                    if (typeof setClickAddressDetails === 'function') {
                        setClickAddressDetails({
                            address: fullAddress,
                            postcode: postcode || 'S/N',
                            country: country || 'Spain'
                        });
                    }

                    setStatus('✅ Dirección cargada');
                } else {
                    setSelectedOrderAddress('Dirección no encontrada');
                    setSelectedOrderPostcode('');
                    if (typeof setClickAddressDetails === 'function') {
                        setClickAddressDetails({ address: 'Dirección no encontrada', postcode: '', country: '' });
                    }
                }
            } catch (error) {
                console.error("Error al geocodificar:", error);
                setSelectedOrderAddress('Error al obtener la dirección');
                setSelectedOrderPostcode('');
                setStatus('❌ Error de red en mapa');
            }
        });

        // POPUPS de gestión de pedidos
        map.current.on('click', 'puntos-entrega', (e) => {
            const feature = e.features[0];
            const coordinates = e.features[0].geometry.coordinates.slice();

            const properties = {
                ...feature.properties,
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

            const orderData = {
                properties: properties,
                geometry: feature.geometry
            };

            const currentRole = roleRef.current;

            if (currentRole === 'admin') {
                root.render(
                    <AdminPopup
                        order={orderData}
                        drivers={driversRef.current}
                        onDelete={(id) => { deleteOrder(id); popup.remove(); }}
                        onAssign={async (id, driverId) => {
                            if (!driverId) return;
                            await assignOrderToDriverRef.current(id, driverId);
                            popup.remove();
                            fetchZonesRef.current(zonesRef.current); // Refrescar usando la referencia
                        }}
                    />
                );
            } else if (currentRole === 'driver') {
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
    }, [isLoggedIn]); // Único disparador estable: el estado de la sesión de Auth

    // 4. Actualización de datos en tiempo real (Híbrida: Admin y User)
    useEffect(() => {
        if (!map.current || !zonesData) return;

        const updateMapSource = () => {
            const pointSource = map.current.getSource('pedidos');
            if (pointSource) {
                pointSource.setData(zonesData);
                console.log("Capa 'pedidos' actualizada con:", zonesData.features?.length, "puntos");
            }

            const routesSource = map.current.getSource('rutas');
            if (routesSource) {
                const routesToRender = zonesData.routes_geojson || { type: 'FeatureCollection', features: [] };
                routesSource.setData(routesToRender);
            }
            console.log("ZonesData recibida:", zonesData);

            if (zonesData.features?.length > 0) {
                const bounds = new maplibregl.LngLatBounds();
                zonesData.features.forEach(f => bounds.extend(f.geometry.coordinates));
                map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
            }
        };

        if (map.current.isStyleLoaded()) {
            updateMapSource();
        } else {
            map.current.once('style.load', updateMapSource);
        }
    }, [zonesData]);

    // 5. Efecto de cambio de tema (Se actualiza suavemente sin destruir la instancia del mapa)
    useEffect(() => {
        if (map.current) {
            const style = isDark ? 'streets-v2-dark' : 'streets-v2';
            map.current.setStyle(
                `https://api.maptiler.com/maps/${style}/style.json?key=${MAPTILER_KEY}`,
                { diff: true });
            map.current.once('style.load', setupLayers);
        }
    }, [isDark]);

    // 6. Visibilidad de rutas (Se actualiza suavemente)
    useEffect(() => {
        if (map.current && map.current.getLayer('lineas-ruta')) {
            map.current.setLayoutProperty('lineas-ruta', 'visibility', showRoutes ? 'visible' : 'none');
        }
    }, [showRoutes]);

    return (
        <div className="relative w-full h-full">
            <div ref={mapContainer} className="w-full h-full" />
            <OrderFormModal />
        </div>
    );
};

export default MapDisplay;