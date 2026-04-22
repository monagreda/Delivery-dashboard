import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext.jsx'
import { MapProvider } from './context/MapContext.jsx'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <MapProvider>
        <App />
      </MapProvider>
    </AuthProvider>
  </StrictMode>,
)
