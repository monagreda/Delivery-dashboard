import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMap } from '../context/MapContext';

const SidebarAdmin = ({ isDark, setIsDark }) => {
    const { role } = useAuth();
    const { zones, setZones, status, zoneStats } = useMap();

    return (
        <div className="absolute top-5 left-5 z-50 w-72 p-6 bg-white/80 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold dark:text-white text-lg">LogiPredict</h3>
                <button
                    onClick={() => setIsDark(!isDark)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-yellow-400 transition-colors"
                >
                    {isDark ? <Moon size={20} /> : <Sun size={20} />}
                </button>
            </div>

            <div className="flex items-center gap-3 mb-6">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    {status}
                </p>
            </div>

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
                    <div className="space-y-2">
                        {Object.entries(zoneStats).map(([zoneId, count]) => (
                            <div key={zoneId} className="flex justify-between items-center p-2 rounded-lg bg-white dark:bg-slate-700/50 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FFD700', '#00FFFF'][zoneId] }}
                                    ></div>
                                    <span className="text-xs font-medium dark:text-slate-200">Zona {zoneId}</span>
                                </div>
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{count} peds.</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SidebarAdmin;