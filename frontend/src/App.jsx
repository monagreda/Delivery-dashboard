import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import axios from 'axios';
import 'maplibre-gl/dist/maplibre-gl.css';
import Navbar from './components/Navbar'
import Hero from './components/Hero';
import Login from './pages/Login';
import Register from './pages/Register';
import { Moon, Sun } from 'lucide-react';

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [zones, setZones] = useState(4);
  const [zoneStats, setZoneStats] = useState({});
  const [status, setStatus] = useState('Listo');
  const [isDark, setIsDark] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [showRegister, setShowRegister] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('role') || 'user');

  const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

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

      if (map.current.isStyleLoaded() && map.current.getSource('pedidos')) {
        if (role === "admin") {
          map.current.getSource('pedidos').setData(res.data.geojson);
          setZoneStats(res.data.stats);
          setStatus(`✅ ${numZones} zonas optimizadas`);
        } else {
          map.current.getSource('pedidos').setData(res.data);
          setStatus('✅ Datos actualizados');
        }
      } else {
        setTimeout(() => fetchZones(numZones), 300);
      }
    } catch (err) {
      console.error(err);
      setStatus('❌ Error de sincronización');
    }
  }, [token, role]);

  const handleLoginSuccess = (newToken, userRole) => {
    setToken(newToken);
    setRole(userRole);
    setIsLoggedIn(true);
    setShowLogin(false);
    localStorage.setItem('token', newToken);
    localStorage.setItem('role', userRole);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setToken('');
    setRole('user');
    setIsLoggedIn(false);
    if (map.current) {
      map.current.remove();
      map.current = null;
    }
  };

  const deleteOrder = async (orderId) => {
    if (!window.confirm(`¿Seguro que quieres eliminar el pedido ${orderId}?`)) return;
    try {
      await axios.delete(`http://127.0.0.1:8000/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchZones(zones);
      const popups = document.getElementsByClassName('mapboxgl-popup');
      for (let p of popups) p.remove();
    } catch (err) {
      alert("Error al eliminar: " + (err.response?.data?.detail || "Intenta de nuevo"));
    }
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

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

    // --- LÓGICA HÍBRIDA DRAG & DROP ---
    const onMove = () => { map.current.getCanvas().style.cursor = 'grabbing'; };

    const onUp = async (e, orderId) => {
      const { lng, lat } = e.lngLat;
      map.current.off('mousemove', onMove);
      map.current.off('touchmove', onMove);
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
      map.current.on('touchmove', onMove);
      map.current.once('mouseup', (el) => onUp(el, orderId));
      map.current.once('touchend', (el) => onUp(el, orderId));
    };

    map.current.on('mousedown', 'puntos-entrega', startDragging);
    map.current.on('touchstart', 'puntos-entrega', startDragging);

    // Crear pedido
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

    // Popups
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

      new maplibregl.Popup({ className: 'custom-popup' })
        .setLngLat(coordinates)
        .setDOMContent(popupNode)
        .addTo(map.current);
    });

    map.current.on('mouseenter', 'puntos-entrega', () => { map.current.getCanvas().style.cursor = 'move'; });
    map.current.on('mouseleave', 'puntos-entrega', () => { map.current.getCanvas().style.cursor = ''; });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [isLoggedIn, token, role, zones, fetchZones, isDark, MAPTILER_KEY]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Navbar isLoggedIn={isLoggedIn} onLoginClick={() => setShowLogin(true)} onRegisterClick={() => setShowRegister(true)} onLogout={handleLogout} />
      {showLogin && <Login onLoginSuccess={handleLoginSuccess} onCancel={() => setShowLogin(false)} />}
      {showRegister && <Register onRegisterSuccess={() => { setShowRegister(false); setShowLogin(true); }} onCancel={() => setShowRegister(false)} />}

      {!isLoggedIn ? (
        <Hero onStart={() => setShowRegister(true)} />
      ) : (
        <>
          <div className="absolute top-5 left-5 z-50 w-72 p-6 bg-white/80 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold dark:text-white text-lg">LogiPredict</h3>
              <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-yellow-400">
                {isDark ? <Moon size={20} /> : <Sun size={20} />}
              </button>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{status}</p>
            </div>

            {role === 'admin' && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <label className="text-xs font-bold dark:text-slate-300">Zonas: {zones}</label>
                <input type="range" min="2" max="6" value={zones} onChange={(e) => setZones(parseInt(e.target.value))} className="w-full accent-blue-600 mb-4" />
                <div className="space-y-2">
                  {Object.entries(zoneStats).map(([zoneId, count]) => (
                    <div key={zoneId} className="flex justify-between items-center p-2 rounded-lg bg-white dark:bg-slate-700/50 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FFD700', '#00FFFF'][zoneId] }}></div>
                        <span className="text-xs font-medium dark:text-slate-200">Zona {zoneId}</span>
                      </div>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{count} peds.</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div ref={mapContainer} className="w-full h-full" />
        </>
      )}
    </div>
  );
}

export default App;