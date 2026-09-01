import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useAuth } from './context/AuthContext';
import { MapProvider } from './context/MapContext';

// Componentes ligeros: se necesitan de inmediato (landing / auth), se quedan estáticos
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Login from './pages/Login';
import Register from './pages/Register';
import SidebarSkeleton from './components/SidebarSkeleton';

// Componentes pesados: solo se cargan cuando el usuario ya inició sesión.
// MapDisplay arrastra maplibre-gl (~800KB) y SidebarAdmin arrastra recharts (~500KB)
// vía DeidadChart — ninguno de los dos debe estar en el bundle inicial.
const MapDisplay = lazy(() => import('./components/MapDisplay'));
const SidebarAdmin = lazy(() => import('./components/SidebarAdmin'));
const SidebarDriver = lazy(() => import('./components/SidebarDriver'));
const SidebarUser = lazy(() => import('./components/SidebarUser'));
const HistoryContainer = lazy(() => import('./components/History/HistoryContainer'));

function App() {
  const { isLoggedIn, logout, login, role } = useAuth();
  const [isDark, setIsDark] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  //Manejo de clase dark en el lobby
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // 2. Definimos la función de éxito para cerrar el modal y loguear
  const handleLoginSuccess = (token, role) => {
    login(token, role);
    setShowLogin(false);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Navbar
        isLoggedIn={isLoggedIn}
        onLoginClick={() => setShowLogin(true)}
        onRegisterClick={() => setShowRegister(true)}
        onLogout={logout}
      />

      {showLogin && (
        <Login onLoginSuccess={handleLoginSuccess} onCancel={() => setShowLogin(false)} />
      )}

      {showRegister && (
        <Register onRegisterSuccess={() => { setShowRegister(false); setShowLogin(true); }}
          onCancel={() => setShowRegister(false)} />
      )}

      {!isLoggedIn ? (
        <Hero onStart={() => setShowRegister(true)} />
      ) : (
        <MapProvider>
          <Suspense fallback={<SidebarSkeleton />}>
            <MapDisplay isDark={isDark} />
            {/* cambio de logica segun el rol */}
            {role === 'admin' && (
              <SidebarAdmin isDark={isDark} setIsDark={setIsDark} />
            )}

            {role === 'driver' && (
              <SidebarDriver />
            )}

            {role === 'user' && (
              <SidebarUser />
            )}

            {role && <HistoryContainer />}
          </Suspense>
        </MapProvider>
      )}
    </div>
  );
}

export default App;