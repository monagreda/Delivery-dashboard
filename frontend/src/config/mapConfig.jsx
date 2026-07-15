// src/config/mapConfig.js

export const ZONE_COLORS = [
    '#FF5733', // Naranja
    '#33FF57', // Verde
    '#3357FF', // Azul
    '#F333FF', // Rosado
    '#FFD700', // Dorado
    '#00FFFF'  // Cian
];

export const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

// Configuración de la capa de líneas de GraphHopper
export const getRouteLayerConfig = (showRoutes) => ({
    id: 'lineas-ruta',
    type: 'line',
    source: 'rutas',
    layout: {
        'line-join': 'round',
        'line-cap': 'round',
        'visibility': showRoutes ? 'visible' : 'none'
    },
    paint: {
        'line-color': [
            'match', ['get', 'zone'],
            0, ZONE_COLORS[0],
            1, ZONE_COLORS[1],
            2, ZONE_COLORS[2],
            3, ZONE_COLORS[3],
            4, ZONE_COLORS[4],
            5, ZONE_COLORS[5],
            '#ccc'
        ],
        'line-width': 3,
        'line-opacity': 0.6,
        'line-dasharray': [2, 1]
    }
});

// Configuración de la capa de pedidos agrupados por clústeres
export const getPedidoLayerConfig = (isDark) => ({
    id: 'puntos-entrega',
    type: 'circle',
    source: 'pedidos',
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 15, 12],
        'circle-color': [
            'case',
            // Si el pedido está entregado, lo hacemos transparente
            ['==', ['get', 'status'], 'delivered'], 'rgba(0,0,0,0)',
            // Si ya tiene conductor asignado, verde esmeralda
            ['>', ['to-number', ['get', 'driver_id']], 0], '#22c55e',
            // Si no, color asignado por K-Means a la zona
            ['match', ['to-number', ['get', 'zone']],
                0, ZONE_COLORS[0],
                1, ZONE_COLORS[1],
                2, ZONE_COLORS[2],
                3, ZONE_COLORS[3],
                4, ZONE_COLORS[4],
                5, ZONE_COLORS[5],
                '#fff'
            ]
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': isDark ? '#0f172a' : '#fff'
    }
});