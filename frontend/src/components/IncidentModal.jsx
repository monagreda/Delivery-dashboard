import React, { useState } from 'react';
import { AlertTriangle, X, ShieldAlert, FileText, ChevronDown } from 'lucide-react';

const IncidentModal = ({ isOpen, onClose, onSubmit, isSubmitting }) => {
    const [incidentType, setIncidentType] = useState('accidente');
    const [description, setDescription] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!description.trim()) return;
        onSubmit(incidentType, description);
        setDescription(''); // Limpiamos la caja de texto al enviar
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-9999 p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden transform transition-all scale-100">

                {/* Encabezado del Formulario */}
                <div className="bg-linear-to-r from-red-500 to-amber-500 px-6 py-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-2">
                        <ShieldAlert size={20} className="animate-pulse" />
                        <h3 className="font-bold text-base tracking-wide">Reportar Siniestro / Incidente</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="hover:bg-white/20 p-1.5 rounded-full transition-colors text-white"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Formulario Estético */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">

                    {/* Campo 1: Select de Tipo de Percance */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                            Tipo de Percance
                        </label>
                        <div className="relative">
                            <select
                                value={incidentType}
                                onChange={(e) => setIncidentType(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-xl text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none cursor-pointer transition-all font-medium pr-10"
                            >
                                <option value="accidente">🚗 Accidente de Tránsito</option>
                                <option value="especificaciones_erroneas">📦 Especificaciones Erróneas</option>
                                <option value="objetos_ilicitos">⚠️ Contenido / Objetos Ilícitos</option>
                                <option value="otro">⚙️ Otro Retraso Mayor / Avería</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <ChevronDown size={16} />
                            </div>
                        </div>
                    </div>

                    {/* Campo 2: Textbox / Textarea para especificar detalles */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                            Especificar Detalles del Suceso
                        </label>
                        <div className="relative">
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Por favor, describe detalladamente la situación para informar al centro de control logístico en Europa..."
                                rows="4"
                                required
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 rounded-xl text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none placeholder-slate-400 transition-all leading-relaxed pr-10"
                            ></textarea>
                            <div className="absolute right-4 bottom-4 text-slate-300 dark:text-slate-600 pointer-events-none">
                                <FileText size={18} />
                            </div>
                        </div>
                    </div>

                    {/* Nota de Alerta Informativa */}
                    <div className="flex gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 p-3.5 rounded-xl text-amber-700 dark:text-amber-400">
                        <AlertTriangle size={20} className="shrink-0 mt-0.5 animate-bounce" />
                        <p className="text-xs leading-normal font-medium">
                            Al emitir esta alerta, la orden pasará a estado de congelación inmediata en la base de datos de producción.
                        </p>
                    </div>

                    {/* Botones de Acción del Formulario */}
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors uppercase tracking-wider"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !description.trim()}
                            className="px-5 py-2.5 text-xs font-bold text-white bg-linear-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 rounded-xl shadow-md shadow-red-500/10 hover:shadow-red-500/20 transition-all uppercase tracking-wider disabled:opacity-40 disabled:pointer-events-none"
                        >
                            {isSubmitting ? "Enviando..." : "Enviar Reporte"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default IncidentModal;