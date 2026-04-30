import React from 'react';

const HistoryTable = ({ data, role }) => {
    return (
        <div className="absolute top-20 right-0 left-0 mx-auto w-[95%] md:left-auto md:right-4 md:w-auto md:max-w-4xl z-[1000] max-h-[70vh] overflow-y-auto rounded-xl">
            <div className="bg-slate-900/95 backdrop-blur-md shadow-2xl border border-slate-700 overflow-hidden">

                {/* Vista para Tablet/PC (Tabla) */}
                <table className="hidden md:table w-full text-left border-collapse">
                    <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
                        <tr>
                            <th className="py-3 px-6">Pedido</th>
                            {role === 'admin' && <th className="py-3 px-6">Usuario</th>}
                            {role !== 'user' && <th className="py-3 px-6 text-center">Zona</th>}
                            <th className="py-3 px-6">Entrega</th>
                            {(role === 'admin' || role === 'user') && <th className="py-3 px-6">Conductor</th>}
                            <th className="py-3 px-6 text-center">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="text-slate-300 text-sm">
                        {data.map((item) => (
                            <tr key={item.order_id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                <td className="py-3 px-6 font-mono text-[10px] text-slate-500">#{item.order_id.substring(0, 6)}</td>
                                {role === 'admin' && <td className="py-3 px-6">{item.client || "—"}</td>}
                                {role !== 'user' && (
                                    <td className="py-3 px-6 text-center">
                                        <span className="bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded text-[10px]">Z{item.zone}</span>
                                    </td>
                                )}
                                <td className="py-3 px-6 text-xs">
                                    {item.delivered_at
                                        ? new Date(item.delivered_at).toLocaleString('es-VE', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })
                                        : 'Sin fecha'}
                                </td>
                                {(role === 'admin' || role === 'user') && <td className="py-3 px-6 text-slate-400">👤 {item.driver || "—"}</td>}
                                <td className="py-3 px-6 text-center text-emerald-400 font-bold text-[10px]">READY</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Vista para Celular (Cards) */}
                <div className="md:hidden flex flex-col divide-y divide-slate-800">
                    {data.map((item) => (
                        <div key={item.order_id} className="p-4 flex flex-col space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="font-mono text-slate-500 text-xs">#{item.order_id.substring(0, 8)}</span>
                                <span className="text-emerald-400 text-[10px] font-bold">DELIVERED</span>
                            </div>
                            <div className="flex justify-between text-slate-300 text-sm">
                                <span>{new Date(item.delivered_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                {role !== 'user' && <span className="text-indigo-400 font-bold text-xs">ZONA {item.zone}</span>}
                            </div>
                            {(role === 'admin' || role === 'user') && (
                                <div className="text-xs text-slate-400">
                                    Conductor: <span className="text-slate-200">{item.driver || "—"}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {data.length === 0 && <div className="p-10 text-center text-slate-500">Sin entregas hoy.</div>}
            </div>
        </div>
    );
};

export default HistoryTable;