import React, { useEffect, useRef, useState } from 'react';
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
  const [status, setStatus] = useState('Listo');
  const [isDark, setIsDark] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [showRegister, setShowRegister] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('role') || 'user');

  const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

  const handleLoginSuccess = (newToken, userRole) => {
    setToken(newToken);
    setRole(userRole);
    setIsLoggedIn(true);
    setShowLogin(false);

    // Guardamos en persistencia
    localStorage.setItem('token', newToken);
    localStorage.setItem('role', userRole);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setIsLoggedIn(false);
    if (map.current) {
      map.current.remove(); //Destruye la instancia del mapa
      map.current = null;
    }
  };

  // 1. Cargar datos desde el Backend
  const fetchZones = async (numZones) => {
    if (!map.current || !map.current.isStyleLoaded() || !token) return;
    setStatus('Calculando zonas...');
    try {
      const res = await axios.get(`http://127.0.0.1:8000/admin/optimize-zones?n_clusters=${numZones}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (map.current.getSource('pedidos')) {
        map.current.getSource('pedidos').setData(res.data);
      }
      setStatus(`✅ ${numZones} zonas optimizadas`);
    } catch (err) {
      console.error(err);
      setStatus('❌ Error de conexión');
    }
  };

  // 2. Control del DOM para Modo Oscuro (Tailwind v4)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // 3. Inicialización del Mapa (Solo una vez)
  useEffect(() => {
    if (!isLoggedIn || map.current) return; //Solo inicia si estas logueado

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/${isDark ? 'streets-v2-dark' : 'streets-v2'}/style.json?key=${MAPTILER_KEY}`,
      center: [-66.89, 10.48],
      zoom: 12
    });

    map.current.on('style.load', () => {
      // Re-añadir capas y fuentes cuando el estilo cambia (claro/oscuro)
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
            'circle-radius': 9,
            'circle-color': [
              'match', ['get', 'zone'],
              0, '#FF5733',
              1, '#33FF57',
              2, '#3357FF',
              3, '#F333FF',
              4, '#FFD700',
              5, '#00FFFF',
              '#fff'],
            'circle-stroke-width': 2,
            'circle-stroke-color': isDark ? '#0f172a' : '#fff'
          }
        });
      }
      fetchZones(zones);
    });

    // Evento para añadir pedidos al hacer click
    map.current.on('click', async (e) => {
      //Bloqueo por rol:
      if (role !== 'admin') {
        return;
      }

      const features = map.current.queryRenderedFeatures(e.point, { layers: ['puntos-entrega'] });
      if (features.length > 0) return;

      const { lng, lat } = e.lngLat;
      if (window.confirm("¿Añadir pedido aquí?")) {
        try {
          await axios.post(`http://127.0.0.1:8000/admin/orders?lng=${lng}&lat=${lat}`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          fetchZones(zones);
        } catch (err) { alert("Error al guardar"); }
      }
    });

    // popups para driver
    map.current.on('click', 'puntos-entrega', (e) => {
      const coordinates = e.features[0].geometry.coordinates.slice();
      const { zone, id } = e.features[0].properties;

      // Aseguramos que el popup aparezca exactamente sobre el punto
      new maplibregl.Popup({ className: 'custom-popup' })
        .setLngLat(coordinates)
        .setHTML(`
      <div style="padding: 10px; font-family: sans-serif;">
        <h4 style="margin: 0; color: #6366f1;">Pedido #${id || 'N/A'}</h4>
        <p style="margin: 5px 0 0; font-size: 12px; color: #64748b;">
          Asignado a: <strong>Zona ${zone}</strong>
        </p>
      </div>
    `)
        .addTo(map.current);
    });

    //cambia el cursor al pasar sobre un punto
    map.current.on('mouseenter', 'puntos-entrega', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });
    map.current.on('mouseleave', 'puntos-entrega', () => {
      map.current.getCanvas().style.cursor = '';
    });

  }, [isLoggedIn]);

  // 4. Efecto para cambiar el estilo del mapa cuando isDark cambie
  useEffect(() => {
    if (map.current) {
      const newStyle = isDark ? 'streets-v2-dark' : 'streets-v2';
      map.current.setStyle(`https://api.maptiler.com/maps/${newStyle}/style.json?key=${MAPTILER_KEY}`);
    }
  }, [isDark]);

  // 5. Efecto para recalcular zonas cuando el slider cambie
  useEffect(() => {
    fetchZones(zones);
  }, [zones]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
      <Navbar
        isLoggedIn={isLoggedIn}
        onLoginClick={() => setShowLogin(true)}
        onRegisterClick={() => setShowRegister(true)}
        onLogout={handleLogout}
      />

      {/* Modales de Auth */}
      {showLogin && (
        <Login
          onLoginSuccess={handleLoginSuccess}
          onCancel={() => setShowLogin(false)}
        />
      )}

      {showRegister && (
        <Register
          onRegisterSuccess={(userData) => {
            setShowRegister(false);
            setRole(userData.role); // Asignamos el rol del nuevo usuario
            setShowLogin(true);
          }}
          onCancel={() => setShowRegister(false)}
        />
      )}

      {!isLoggedIn ? (
        <Hero onStart={() => setShowRegister(true)} />
      ) : (
        <>
          {/* Panel Flotante */}
          <div className="absolute top-5 left-5 z-60 w-72 p-6 bg-white/80 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 transition-all">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 dark:text-white leading-tight">LogiPredict Dashboard</h3>
              <button
                onClick={() => setIsDark(!isDark)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-yellow-400"
              >
                {isDark ? <Moon size={20} /> : <Sun size={20} />}
              </button>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">{status}</p>
            </div>

            {role === 'admin' ? (
              <div className="bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/50 dark:border-slate-700">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 block mb-2">
                  Número de Zonas: <span className="text-blue-600 dark:text-blue-400">{zones}</span>
                </label>
                <input
                  type="range" min="2" max="6" value={zones}
                  onChange={(e) => setZones(parseInt(e.target.value))}
                  className="w-full mt-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            ) : (
              // Vista para el Driver
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                <p className="text-[11px] text-slate-500 dark:text-indigo-300 leading-relaxed">
                  Estás en modo <strong>Visualización</strong>. Los pedidos están optimizados por zonas de entrega.
                </p>
              </div>
            )}
          </div>

          {/* El mapa debe tener h-full y w-full */}
          <div ref={mapContainer} className="w-full h-full" />
        </>
      )}
    </div>
  );
}

export default App;