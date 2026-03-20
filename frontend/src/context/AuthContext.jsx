// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token') || '');
    const [role, setRole] = useState(localStorage.getItem('role') || 'user');
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));

    //Login
    const login = useCallback((newToken, userRole) => {
        localStorage.setItem('token', newToken);
        localStorage.setItem('role', userRole);
        setToken(newToken);
        setRole(userRole);
        setIsLoggedIn(true);
    }, []);

    //logout
    const logout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        setToken('');
        setRole('user');
        setIsLoggedIn(false);
        // Nota: La limpieza del mapa la haremos en el componente del Mapa
    }, []);

    return (
        <AuthContext.Provider value={{ token, role, isLoggedIn, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);