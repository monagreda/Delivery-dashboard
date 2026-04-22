import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { MapProvider } from './context/MapContext';

// Importa tus componentes
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Login from './pages/Login';
import Register from './pages/Register';
import MapDisplay from './components/MapDisplay';
import SidebarAdmin from './components/SidebarAdmin';
import SidebarDriver from './components/SidebarDriver';
import SidebarUser from './components/SidebarUser';
import HistoryContainer from './components/History/HistoryContainer';

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
        </MapProvider>
      )}
    </div>
  );
}

export default App;