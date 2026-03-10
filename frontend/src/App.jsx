import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import axios from 'axios';
import 'maplibre-gl/dist/maplibre-gl.css';

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [zones, setZones] = useState(4); // Estado para el slider
  const [status, setStatus] = useState('Listo');
  const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

  // ===========================================================================================
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbl9sdWlzIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzczMTAwNzkwfQ.u0iCkN7a7GrEoC6XIziuTayu2MeUhlyKCN8IhtndqXQ"; // Recuerda actualizarlo si caduca
  // ===========================================================================================

  // Función para cargar/recargar datos
  const fetchZones = async (numZones) => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    setStatus('Calculando zonas...');
    try {
      const res = await axios.get(`http://127.0.0.1:8000/admin/optimize-zones?n_clusters=${numZones}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Actualizar la fuente de datos del mapa
      if (map.current.getSource('pedidos')) {
        map.current.getSource('pedidos').setData(res.data);
      }
      setStatus(`✅ Mostrando ${numZones} zonas optimizadas`);
    } catch (err) {
      console.error(err)
      setStatus('❌ Error: Revisa el Token o el Backend');
    }
  };

  useEffect(() => {
    if (map.current) return; //Cuando 'zones' cambia, corre FetchZones

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
      center: [-66.89, 10.48],
      zoom: 12
    });

    map.current.on('load', () => {
      // Fuente inicial vacía
      map.current.addSource('pedidos', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      map.current.addLayer({
        id: 'puntos-entrega',
        type: 'circle',
        source: 'pedidos',
        paint: {
          'circle-radius': 12,
          'circle-color': ['match', ['get', 'zone'], 0, '#FF5733', 1, '#33FF57', 2, '#3357FF', 3, '#F333FF', 4, '#FFD700', 5, '#00FFFF', '#000'],
          'circle-stroke-width': 2, 'circle-stroke-color': '#fff'
        }
      });

      // EVENTO DE POPUP AL HACER CLIC
      map.current.on('click', 'puntos-entrega', (e) => {
        const { order_id, zone } = e.features[0].properties;
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`<strong>Pedido:</strong> ${order_id}<br><strong>Zona IA:</strong> ${zone}`)
          .addTo(map.current);
      });

      // Evento de agregar un nuevo pedido
      map.current.on('click', async (e) => {
        // Verificar si el click fue al mapa y nno a un punto existente
        const features = map.current.queryRenderedFeatures(e.point, { layers: ['puntos-entrega'] });
        if (features.length > 0) return; //Si toco un punto, que salga el popup, no creamos uno nuevo

        const { lng, lat } = e.lngLat;

        if (window.confirm(`Quieres añadir un nuevo pedido en este punto?`)) {
          try {
            await axios.post(`http://127.0.0.1:8000/admin/create-order?lng=${lng}&lat=${lat}`, {}, {
              headers: { Authorization: `Bearer ${token}` }
            });
            // Recargamos los datos: Al agregar uno nuevo, la IA debe recalcular el algoritmo
            fetchZones(zones);
            setStatus("Nuevo pedido agregado y optimizado");
          } catch (err) {
            console.error(err);
            alert("Error al guardar el pedido")
          }
        }
      });

      fetchZones(zones);
    });
  }, []);

  // Recargar cuando el slider cambie
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      fetchZones(zones);
    }
  }, [zones])

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div style={{
        position: 'absolute', top: 20, left: 20, zIndex: 10,
        background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', width: '250px',
        fontFamily: 'sans-serif'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>LogiPredict Dashboard</h3>
        <label>Número de Zonas: <strong>{zones}</strong></label>
        <input
          type="range" min="2" max="6" value={zones}
          onChange={(e) => setZones(parseInt(e.target.value))}
          style={{ width: '100%', margin: '10px 0' }}
        />
        <p style={{ fontSize: '12px', color: '#666' }}>{status}</p>
      </div>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

export default App;