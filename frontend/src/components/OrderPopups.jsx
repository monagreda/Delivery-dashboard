// OrderPopups.jsx

export const AdminPopup = ({ order, drivers, onAssign, onDelete }) => {
    // Normalización de datos para Admin
    const orderId = order.order_id || order.properties?.order_id;
    const zone = order.zone ?? order.properties?.zone ?? 0;

    return (
        <div className="flex flex-col overflow-hidden rounded-xl shadow-2xl">
            <div className="bg-linear-to-r from-blue-600 to-indigo-700 px-4 py-2">
                <h4 className="text-white font-bold text-sm">Gestionar Pedido</h4>
            </div>

            <div className="p-4 bg-slate-900 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ID: #{orderId}</span>
                    <span className="px-2 py-0.5 bg-slate-800 text-blue-400 rounded text-[9px] font-bold border border-blue-900/50">
                        ZONA {zone}
                    </span>
                </div>

                <div>
                    <label className="block text-[9px] font-semibold text-slate-500 uppercase mb-1 ml-1">Asignar Driver</label>
                    <select
                        id={`select-${orderId}`}
                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none focus:border-blue-500 transition-colors"
                    >
                        <option value="">Seleccionar personal...</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.username}</option>)}
                    </select>
                </div>

                <div className="flex gap-2 mt-1">
                    <button
                        onClick={() => {
                            const val = document.getElementById(`select-${orderId}`).value;
                            if (val) onAssign(orderId, val);
                        }}
                        className="flex-1 bg-blue-500 hover:bg-blue-400 text-white text-[10px] font-black py-2 rounded-lg shadow-lg shadow-blue-900/20 transition-all uppercase"
                    > Confirmar </button>
                    <button
                        onClick={() => onDelete(orderId)}
                        className="px-3 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 rounded-lg border border-slate-700 transition-all"
                    > 🗑️ </button>
                </div>
            </div>
        </div>
    );
};

export const UserPopup = ({ order, onDelete }) => {
    const orderId = order.order_id || order.properties?.order_id;
    const zone = order.zone ?? order.properties?.zone ?? 0;

    return (
        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <h4 className="text-slate-100 font-bold text-sm">Tu Pedido #{orderId}</h4>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Estamos procesando tu entrega en la <span className="text-blue-400 font-bold">Zona {zone}</span>.
            </p>
            <button
                onClick={() => onDelete(orderId)}
                className="w-full py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[10px] font-bold rounded-lg border border-red-500/20 transition-all"
            > CANCELAR MI PEDIDO </button>
        </div>
    );
};

export const DriverPopup = ({ order }) => {
    const orderId = order.order_id || order.properties?.order_id;
    const zone = order.zone ?? order.properties?.zone ?? 0;

    return (
        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 min-w-45">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <h4 className="text-slate-100 font-bold text-sm">Ruta Asignada</h4>
            </div>
            <div className="space-y-1">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Orden de Trabajo</p>
                <p className="text-xs text-slate-200 font-mono bg-slate-800 p-1.5 rounded border border-slate-700">
                    #{orderId}
                </p>
            </div>
            <div className="mt-3 flex items-center gap-2 text-emerald-400">
                <span className="text-[10px]">📍</span>
                <span className="text-xs font-semibold">Destino: Zona {zone}</span>
            </div>
        </div>
    );
};