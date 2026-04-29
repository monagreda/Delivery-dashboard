import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import HistoryTable from './HistoryTable'; // Importamos la vista
import { ClipboardList, X } from 'lucide-react';

const HistoryContainer = () => {
    const { token, role } = useAuth();
    const [historyData, setHistoryData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const endpoint = `https://delivery-dashboard-4szq.onrender.com/history/${role === 'admin' ? 'admin' : 'driver'}`;
                const res = await axios.get(endpoint, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setHistoryData(res.data);
            } catch (err) {
                console.error("Error en historial:", err);
            } finally {
                setLoading(false);
            }
        };
        if (token) fetchHistory();
    }, [token, role]);

    return (
        <>
            {/* Botón Circular Flotante - Siempre visible si está logueado */}
            <button
                onClick={() => setIsVisible(!isVisible)}
                className="fixed bottom-6 right-6 z-[2000] bg-indigo-950/60 hover:bg-indigo-600/60 text-white p-4 rounded-full shadow-2xl transition-all transform hover:scale-110 active:scale-95 flex items-center justify-center"
            >
                {isVisible ? (
                    <X size={24} strokeWidth={2.5} />
                ) : (
                    <ClipboardList size={24} strokeWidth={2} />
                )}
            </button>

            {/* Solo renderiza la tabla si isVisible es true */}
            {isVisible && !loading && (
                <HistoryTable data={historyData} role={role} />
            )}
        </>
    );
};

export default HistoryContainer;