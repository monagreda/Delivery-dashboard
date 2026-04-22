import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronDown, ChevronUp, LayoutDashboard, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMap, ZONE_COLORS } from '../context/MapContext';
import DeidadChart from './DeidadChart';
import SidebarSkeleton from './SidebarSkeleton';


const SidebarAdmin = ({ isDark, setIsDark }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { role } = useAuth();
    const { zones, setZones, status, zoneStats, zoneDistances, showRoutes, setShowRoutes, zoomToZone, isLoading } = useMap();

    // Transformamos el objeto {0: 12, 1: 8...} en un array para Recharts
    const chartData = Object.keys(zoneStats).map(key => ({
        name: `Zona ${key}`,
        pedidos: zoneStats[key],
        color: ZONE_COLORS[key] || '#ccc'
    }));

    return (
        <div className={`fixed md:absolute z-1000 transition-all duration-500 ease-in-out
            /* Posición Mobile */
            bottom-0 left-0 w-full 
            /* Posición PC */
            md:top-5 md:left-5 md:w-80 md:bottom-auto
            /* Lógica de Cierre */
            ${isCollapsed ? 'translate-y-[85%] md:translate-y-0 md:opacity-0 md:pointer-events-none' : 'translate-y-0'}
            
            p-5 bg-white/90 dark:bg-slate-900/95 backdrop-blur-md 
            rounded-t-[2.5rem] md:rounded-3xl shadow-2xl border-t md:border 
            border-slate-200 dark:border-slate-800 max-h-[70vh] md:max-h-[90vh]
             overflow-y-auto scrollbar-hide`}
        >

            {/* Handle para móviles (la rayita para deslizar) */}
            <div
                className="md:hidden w-full flex justify-center pb-4 cursor-pointer"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <div className="w-12 h-1.5 bg-slate-300/60 dark:bg-slate-700/60 rounded-full hover:bg-blue-500 transition-colors" />
            </div>

            {/* Header con Botón de Cierre real */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/30">
                        <LayoutDashboard size={18} className="text-white" />
                    </div>
                    <h3 className="font-bold dark:text-white text-lg tracking-tight">LogiPredict</h3>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsDark(!isDark)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-yellow-400"
                    >
                        {isDark ? <Moon size={18} /> : <Sun size={18} />}
                    </button>

                    {/* Botón para colapsar en Mobile */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500"
                    >
                        {isCollapsed ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                </div>
            </div>

            <div className={`${isCollapsed ? 'opacity-0 md:opacity-100' : 'opacity-100'} transition-opacity duration-300`}>

                {isLoading ? (
                    <SidebarSkeleton />
                ) : (
                    <>
                        <div className="flex items-center gap-3 mb-6">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                {status}
                            </p>
                        </div>

                        {/* sidebar de zonas y lineas */}
                        {role === 'admin' && (
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                <label className="text-xs font-bold dark:text-slate-300">Zonas: {zones}</label>
                                <input
                                    type="range"
                                    min="2"
                                    max="6"
                                    value={zones}
                                    onChange={(e) => setZones(parseInt(e.target.value))}
                                    className="w-full accent-blue-600 mb-4 cursor-pointer"
                                />

                                <div className="mb-8">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-medium dark:text-slate-300">
                                            Visualizar Rutas
                                        </label>

                                        {/* Switch Estilizado con Tailwind */}
                                        <button
                                            onClick={() => setShowRoutes(!showRoutes)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${showRoutes ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showRoutes ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-500">
                                        {showRoutes ? 'Mostrando conexiones lógicas' : 'Solo visualizando puntos'}
                                    </p>
                                </div>


                                <div className="space-y-2 mt-4">
                                    {Object.entries(zoneStats).map(([zoneId, count]) => (
                                        <div
                                            key={zoneId}
                                            onClick={() => zoomToZone(zoneId)} // Aprovecha para darle interactividad
                                            className="flex justify-between items-center p-2 rounded-lg bg-white dark:bg-slate-700/50 shadow-sm border border-transparent dark:border-slate-600/30 hover:border-blue-400 cursor-pointer transition-all"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full shadow-sm"
                                                    style={{ backgroundColor: ZONE_COLORS[zoneId] || '#ccc' }}
                                                ></div>
                                                <div className="flex flex-col"> {/* Cambiamos a columna para stackear texto */}
                                                    <span className="text-xs font-medium dark:text-slate-200 uppercase tracking-tighter">
                                                        Zona {zoneId}
                                                    </span>
                                                    {/* AQUÍ LAS DISTANCIAS */}
                                                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">
                                                        {zoneDistances?.[zoneId] ? `${zoneDistances[zoneId]} km` : 'Calculando...'}
                                                    </span>
                                                </div>
                                            </div>

                                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md">
                                                {count} PEDS.
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <h3 className="text-sm font-bold mb-4 dark:text-white uppercase tracking-wider">
                            Carga por Zona
                        </h3>

                        {/* Invocamos al componente optimizado */}
                        <DeidadChart
                            data={chartData}
                            onBarClick={zoomToZone}
                        />
                    </>
                )}

                <p className="text-[10px] text-center text-slate-500 mt-2">
                    Distribución de {chartData.reduce((a, b) => a + b.pedidos, 0)} pedidos totales
                </p>
            </div>
        </div>
    );
};

export default SidebarAdmin;

