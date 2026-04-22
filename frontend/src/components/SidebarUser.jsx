import React, { useState } from 'react';
import { useMap } from '../context/MapContext';
import { Package, Clock, CheckCircle2, MapPin, ShoppingBag, Trash2, Eye } from 'lucide-react';
import SidebarSkeleton from './SidebarSkeleton';

const SidebarUser = () => {
    const { myOrders, isLoading, createOrder, map } = useMap();
    const [hideDelivered, setHideDelivered] = useState(false);

    const handleQuickOrder = () => {
        if (map.current) {
            const center = map.current.getCenter();
            createOrder(center.lng, center.lat);
        }
    };

    // 1. Contador para saber si hay algo que limpiar
    const hasDelivered = myOrders?.some(o => o.status === 'delivered');

    // 2. Lógica de filtrado (USAR ESTA VARIABLE EN EL MAP)
    const visibleOrders = hideDelivered
        ? myOrders.filter(order => order.status !== 'delivered')
        : myOrders;

    if (isLoading) return <SidebarSkeleton />;

    return (
        <div className="fixed top-5 left-5 bottom-5 w-80 bg-white/95 dark:bg-slate-900/95 p-6 rounded-3xl shadow-2xl z-1000 border border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-xl">
                        <ShoppingBag className="text-white" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold dark:text-white text-lg">Mis Pedidos</h3>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Caracas Delivery</p>
                    </div>
                </div>

                {/* BOTÓN DE LIMPIAR (Movido aquí para mejor estética) */}
                {hasDelivered && (
                    <button
                        onClick={() => setHideDelivered(!hideDelivered)}
                        className={`p-2 rounded-xl transition-all ${hideDelivered
                            ? "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500"
                            }`}
                        title={hideDelivered ? "Mostrar entregados" : "Limpiar entregados"}
                    >
                        {hideDelivered ? <Eye size={18} /> : <Trash2 size={18} />}
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {/* 3. CAMBIO CLAVE: Mapeamos visibleOrders, no myOrders */}
                {visibleOrders && visibleOrders.length > 0 ? (
                    visibleOrders.map((order) => (
                        <div
                            key={order.order_id}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer group ${order.status === 'delivered'
                                    ? "bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-700 opacity-70"
                                    : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-blue-300"
                                }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                                    #{order.order_id}
                                </span>
                                <StatusBadge status={order?.status || 'pending'} />
                            </div>

                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                <MapPin size={14} />
                                <span className="text-xs truncate">Ubicación en el mapa</span>
                            </div>

                            <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center">
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <Clock size={12} /> {order.status === 'delivered' ? 'Completado' : 'Actualizado recientemente'}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                        <Package size={48} className="mb-4" />
                        <p className="text-sm font-medium text-center">
                            {hideDelivered ? "No hay pedidos activos" : "No has realizado pedidos aún"}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

// Sub-componente Badge (Se queda igual)
const StatusBadge = ({ status }) => {
    const styles = {
        pending: "bg-amber-100 text-amber-600",
        assigned: "bg-blue-100 text-blue-600",
        delivered: "bg-green-100 text-green-600",
    };
    const icons = {
        pending: <Clock size={10} />,
        assigned: <Package size={10} />,
        delivered: <CheckCircle2 size={10} />,
    };
    const labels = {
        pending: "Pendiente",
        assigned: "En camino",
        delivered: "Entregado",
    };

    return (
        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${styles[status] || styles.pending}`}>
            {icons[status] || icons.pending}
            {labels[status] || labels.pending}
        </span>
    );
};

export default SidebarUser;