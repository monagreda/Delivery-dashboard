import React from 'react';
import { useMap } from '../context/MapContext';
import { Navigation, MapPin, Power, Coffee, PackageCheck } from 'lucide-react';
import SidebarSkeleton from './SidebarSkeleton';

const SidebarDriver = () => {
    const {
        driverLocation,
        startTracking,
        stopTracking,
        status,
        myOrders,
        setMyOrders, // Asegúrate de que coincida con el nombre en MapContext
        isLoading, // Asegúrate de que coincida con el nombre en MapContext
        markAsDelivered
    } = useMap();

    if (isLoading) return <SidebarSkeleton />;

    return (
        <div className="fixed bottom-5 left-5 right-5 md:w-80 bg-white/95 dark:bg-slate-900/95 p-6 rounded-3xl shadow-2xl z-[1000] border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold dark:text-white text-lg">Mi Ruta</h3>
                <span className={`text-[10px] px-2 py-1 rounded-full font-bold transition-colors ${driverLocation ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {driverLocation ? 'GPS ONLINE' : 'GPS OFFLINE'}
                </span>
            </div>

            <div className="space-y-4">
                {!driverLocation ? (
                    <button
                        onClick={startTracking}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/30 active:scale-95"
                    >
                        <Power size={20} /> Iniciar Jornada
                    </button>
                ) : (
                    <button
                        onClick={stopTracking}
                        className="w-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95"
                    >
                        Detener Rastreo
                    </button>
                )}

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-slate-500 mb-1">Estado actual:</p>
                    <p className="text-sm font-medium dark:text-white capitalize">{status}</p>
                </div>
            </div>

            <div className="mt-6 border-t pt-4 border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 text-center md:text-left">Siguiente Parada</h4>

                {myOrders && myOrders.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {myOrders.map((order) => {
                            // --- NORMALIZACIÓN DE DATOS ---
                            // Esto permite que el componente lea datos planos o GeoJSON sin romperse
                            const oId = order.order_id || order.properties?.order_id;
                            const coords = order.geometry?.coordinates || [order.lng, order.lat];
                            const currentStatus = order.status || order.properties?.status;

                            return (
                                <div key={oId} className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 transition-all hover:border-blue-400" hidden-scrollbar>
                                    <MapPin className="text-blue-600 shrink-0" size={18} />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold dark:text-white">#{oId}</p>
                                        <p className="text-[10px] text-blue-600 dark:text-blue-400 italic font-medium capitalize">{currentStatus}</p>
                                    </div>

                                    {/* Botón Google Maps */}
                                    <button
                                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`, '_blank')}
                                        className="bg-white dark:bg-slate-700 p-2 rounded-lg shadow-sm hover:bg-blue-500 hover:text-white transition-all group"
                                        title="Ver ruta en Google Maps"
                                    >
                                        <Navigation size={16} className="text-blue-600 group-hover:text-white" />
                                    </button>

                                    {/* Botón Marcar Entregado */}
                                    <button
                                        onClick={() => markAsDelivered(oId)}
                                        className="bg-white dark:bg-slate-700 p-2 rounded-lg shadow-sm hover:bg-green-500 hover:text-white transition-all group"
                                        title="Marcar como entregado"
                                    >
                                        <PackageCheck size={16} className="text-green-600 group-hover:text-white" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center py-6 text-slate-400">
                        <Coffee size={24} className="mb-2 opacity-20" />
                        <p className="text-xs text-center">No tienes pedidos asignados hoy</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SidebarDriver;