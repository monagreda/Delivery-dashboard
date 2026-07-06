import React, { useState, useEffect, useRef } from 'react';
import { useMap } from '../context/MapContext';
import axios from 'axios';

const OrderForm = () => {
    const {
        isOrderFormOpen,
        setIsOrderFormOpen,
        selectedOrderCoords,
        setSelectedOrderCoords,
        createOrder,
        status,
        selectedOrderAddress,
        setSelectedOrderAddress,
        selectedOrderPostcode,
        setSelectedOrderPostcode,
        estimatedDistance,
        originCoords,
        setOriginCoords
    } = useMap();

    // 🔐 Tu clave protegida desde las variables de entorno de Vite
    const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

    // Origen Fijo (Sedes)
    const LOGISTIC_HUBS = [
        {
            id: "madrid_central",
            name: "Sede Central - Madrid",
            address: "Calle de la Logística 12, Madrid, España",
            postcode: "28001",
            coords: { lng: -3.70379, lat: 40.41678 }
        },
        {
            id: "lisboa_sur",
            name: "Hub Portugal - Lisboa",
            address: "Av. da Liberdade 240, Lisboa, Portugal",
            postcode: "1250-096",
            coords: { lng: -9.1450, lat: 38.7223 }
        },
        {
            id: "london_hub",
            name: "Hub UK - Londres",
            address: "22 Logistics Rd, London, UK",
            postcode: "EC1A 1BB",
            coords: { lng: -0.1276, lat: 51.5074 }
        }
    ];

    // Estados para la estimación de combustible
    const [weight, setWeight] = useState(0);
    const [fuelEstimate, setFuelEstimate] = useState(null);
    const [isCalculatingFuel, setIsCalculatingFuel] = useState(false);

    // 🎯 ESTADOS LOCALES PROTEGIDOS: Controlan el texto local sin romper el Mapa
    const [destinationInput, setDestinationInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [selectedHub, setSelectedHub] = useState(LOGISTIC_HUBS[0]);

    const autocompleteRef = useRef(null);

    // Sincronizar el input si el usuario hizo clic directamente en el mapa
    useEffect(() => {
        if (isOrderFormOpen && selectedOrderAddress) {
            setDestinationInput(selectedOrderAddress);
        }
    }, [isOrderFormOpen, selectedOrderAddress]);

    // EFECTO EXTRA: Limpiar estados al abrir/cerrar un nuevo pedido
    useEffect(() => {
        if (isOrderFormOpen) {
            setWeight(0);
            setFuelEstimate(null);
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [isOrderFormOpen, selectedOrderCoords]);

    // Cerrar sugerencias si se hace clic fuera del buscador
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (autocompleteRef.current && !autocompleteRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // EFECTO: Llama a la API de combustible
    useEffect(() => {
        const fetchFuelEstimate = async () => {
            if (!estimatedDistance || weight <= 0) {
                setFuelEstimate(null);
                return;
            }
            try {
                setIsCalculatingFuel(true);
                const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/fuel/estimate`, {
                    distance_km: estimatedDistance,
                    weight_kg: weight
                });
                setFuelEstimate(response.data);
            } catch (error) {
                console.error("Error al obtener estimación de combustible:", error);
            } finally {
                setIsCalculatingFuel(false);
            }
        };
        fetchFuelEstimate();
    }, [estimatedDistance, weight]);

    // 🔍 FUNCIÓN: Autocompletado Predictivo (Centrado en Europa/Madrid)
    const handleDestinationChange = async (e) => {
        const value = e.target.value;
        setDestinationInput(value); // Actualiza el texto local al instante de forma segura

        if (value.trim().length < 3) {
            setSuggestions([]);
            return;
        }

        try {
            // Referencia geográfica de Madrid para la proximidad europea
            const madridLng = -3.70379;
            const madridLat = 40.41678;

            const res = await axios.get(
                `https://api.maptiler.com/geocoding/${encodeURIComponent(value)}.json?key=${MAPTILER_KEY}&proximity=${madridLng},${madridLat}&fuzzyMatch=true`
            );

            setSuggestions(res.data.features || []);
            setShowSuggestions(true);
        } catch (err) {
            console.error("Error buscando sugerencias:", err);
        }
    };

    // 🎯 FUNCIÓN: El usuario selecciona una sugerencia de la lista
    const handleSelectSuggestion = (suggestion) => {
        setDestinationInput(suggestion.place_name);
        setSelectedOrderAddress(suggestion.place_name); // Actualiza el contexto de forma segura
        setShowSuggestions(false);

        const postcodeContext = suggestion.context?.find(c => c.id.includes('postcode'));
        setSelectedOrderPostcode(postcodeContext ? postcodeContext.text : "28001");

        const [lng, lat] = suggestion.geometry.coordinates;
        setSelectedOrderCoords({ lng, lat });
    };

    // 📍 FUNCIÓN: Obtener ubicación actual para el DESTINO
    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            alert("Tu navegador no soporta geolocalización.");
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;

            try {
                const res = await axios.get(
                    `https://api.maptiler.com/geocoding/${longitude},${latitude}.json?key=${MAPTILER_KEY}`
                );

                if (res.data.features && res.data.features.length > 0) {
                    const topResult = res.data.features[0];

                    // Inyectamos los datos en el destino
                    setDestinationInput(topResult.place_name);
                    setSelectedOrderAddress(topResult.place_name);

                    const postcodeContext = topResult.context?.find(c => c.id.includes('postcode'));
                    setSelectedOrderPostcode(postcodeContext ? postcodeContext.text : "28001");

                    // Sincroniza las coordenadas en el mapa global para trazar la ruta
                    setSelectedOrderCoords({ lng: longitude, lat: latitude });
                }
            } catch (err) {
                console.error("Error en geocoding inverso de destino:", err);
            } finally {
                setIsLocating(false);
            }
        }, (error) => {
            console.error("Error al obtener ubicación:", error);
            setIsLocating(false);
            alert("No se pudo acceder a tu ubicación actual.");
        });
    };

    if (!isOrderFormOpen || !selectedOrderCoords) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        parseFloat(formData.get("weight_kg"));
        const volume = parseFloat(formData.get("volume_m3"));

        const payload = {
            // Nos aseguramos de que las coordenadas viajen como floats puros
            lng: parseFloat(selectedOrderCoords?.lng || 0),
            lat: parseFloat(selectedOrderCoords?.lat || 0),

            origin_address: selectedHub?.address || "Hub Central España",
            origin_postcode: selectedHub?.postcode || "28001",

            destination_address: destinationInput || "",
            // Evitamos que viaje undefined si el código postal aún no ha cargado
            destination_postcode: selectedOrderPostcode || "28001",

            // Si el usuario no escribió nada (NaN), enviamos 0 en su lugar para satisfacer a Pydantic
            weight_kg: isNaN(weight) ? 0.0 : weight,
            volume_m3: isNaN(volume) ? 0.0 : volume,

            cargo_description: formData.get("cargo_description") || "Sin descripción",
            origin_country: "España",
            destination_country: "España"
        };

        console.log("🚀 Enviando este payload exacto a Render:", payload);

        await createOrder(payload);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <form
                onSubmit={handleSubmit}
                className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-slate-700 no-scrollbar"
            >
                <div className="flex justify-between items-center border-b pb-2 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">New Cargo Order</h3>
                    <button type="button" onClick={() => setIsOrderFormOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold">×</button>
                </div>

                <div className="space-y-3">
                    {/* ORIGEN FIJO (Centro de Operaciones) */}
                    <div className="bg-gray-100 dark:bg-slate-700 p-3 rounded-lg border border-gray-200 dark:border-slate-600">
                        <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 block mb-1.5">
                            Collection Hub (Origin)
                        </label>

                        <select
                            name="origin_hub_select"
                            value={selectedHub?.id || LOGISTIC_HUBS[0].id}
                            onChange={(e) => {
                                const hub = LOGISTIC_HUBS.find(h => h.id === e.target.value);
                                setSelectedHub(hub);

                                // 🎯 AQUÍ ESTÁ EL TRUCO: Actualiza las coordenadas globales de origen
                                setOriginCoords(hub.coords);
                            }}
                            className="w-full bg-white dark:bg-slate-800 border dark:border-slate-600 p-2 rounded text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium mb-2"
                        >
                            {LOGISTIC_HUBS.map((hub) => (
                                <option key={hub.id} value={hub.id}>
                                    {hub.name}
                                </option>
                            ))}
                        </select>

                        {/* Detalle informativo de la sede seleccionada en tiempo real */}
                        <div className="text-[11px] text-gray-600 dark:text-gray-400 border-t pt-1.5 dark:border-slate-600/60 space-y-0.5">
                            <p><span className="font-semibold text-gray-500">Address:</span> {selectedHub?.address || LOGISTIC_HUBS[0].address}</p>
                            <p><span className="font-semibold text-gray-500">Postcode:</span> {selectedHub?.postcode || LOGISTIC_HUBS[0].postcode}</p>
                        </div>
                    </div>

                    {/* DESTINO INTERACTIVO: Ubicación + Autocomplete en Europa */}
                    <div ref={autocompleteRef} className="bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg border border-gray-100 dark:border-slate-700 relative">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 block">Delivery (Destination)</label>
                            <button
                                type="button"
                                onClick={handleGetCurrentLocation}
                                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                                📍 {isLocating ? "Locating..." : "Use My Location"}
                            </button>
                        </div>
                        <input
                            name="destination_address"
                            placeholder="Type destination (e.g., Gran Via...)"
                            required
                            value={destinationInput}
                            onChange={handleDestinationChange}
                            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                            className="w-full bg-white dark:bg-slate-800 border dark:border-slate-600 p-2 rounded text-sm mb-2 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        {/* LISTA DESPLEGABLE */}
                        {showSuggestions && suggestions.length > 0 && (
                            <ul className="absolute left-3 right-3 top-72px bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50 text-sm divide-y dark:divide-slate-700 no-scrollbar">
                                {suggestions.map((suggestion) => (
                                    <li
                                        key={suggestion.id}
                                        onClick={() => handleSelectSuggestion(suggestion)}
                                        className="p-2.5 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer text-gray-900 dark:text-gray-200 transition-colors"
                                    >
                                        {suggestion.place_name}
                                    </li>
                                ))}
                            </ul>
                        )}

                        <input
                            name="destination_postcode"
                            placeholder="Postcode"
                            required
                            value={selectedOrderPostcode || ""}
                            onChange={(e) => setSelectedOrderPostcode(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border dark:border-slate-600 p-2 rounded text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Peso, volumen y descripción */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Weight (kg)</label>
                            <input type="number" step="0.1" name="weight_kg" required onChange={(e) => setWeight(parseFloat(e.target.value) || 0)} className="w-full bg-white dark:bg-slate-800 border dark:border-slate-600 p-2 rounded text-sm text-gray-900 dark:text-white outline-none" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Volume (m³)</label>
                            <input type="number" step="0.01" name="volume_m3" required className="w-full bg-white dark:bg-slate-800 border dark:border-slate-600 p-2 rounded text-sm text-gray-900 dark:text-white outline-none" />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Cargo Description</label>
                        <textarea name="cargo_description" placeholder="Cargo description..." required className="w-full bg-white dark:bg-slate-800 border dark:border-slate-600 p-2 rounded text-sm h-16 text-gray-900 dark:text-white outline-none resize-none"></textarea>
                    </div>

                    {/* Cotizador */}
                    <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-xl p-3 space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
                        <div className="flex justify-between items-center border-b border-blue-100 dark:border-blue-900/40 pb-1.5">
                            <span className="font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider text-[10px]">Financial & Fuel Forecast</span>
                            <span className="font-mono text-gray-500">
                                {estimatedDistance ? `${estimatedDistance.toFixed(1)} km` : '0.0 km'}
                            </span>
                        </div>
                        {isCalculatingFuel ? (
                            <p className="text-center text-gray-400 py-1 animate-pulse">Calculating operational expenses...</p>
                        ) : fuelEstimate ? (
                            <div className="grid grid-cols-2 gap-2 pt-0.5">
                                <div>
                                    <p className="text-gray-400 text-[10px] uppercase font-medium">Est. Consumption</p>
                                    <p className="font-bold font-mono text-sm text-gray-900 dark:text-white">{fuelEstimate.estimated_liters} L</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-gray-400 text-[10px] uppercase font-medium">Est. Fuel Budget</p>
                                    <p className="font-bold font-mono text-sm text-emerald-600 dark:text-emerald-400">
                                        {fuelEstimate.estimated_cost.toFixed(2)} {fuelEstimate.currency}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-gray-400 py-1 italic">Enter cargo weight to generate forecast</p>
                        )}
                    </div>
                </div>

                <div className="flex justify-end space-x-3 pt-2 border-t dark:border-slate-700">
                    <button type="button" onClick={() => setIsOrderFormOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">Cancel</button>
                    <button type="submit" disabled={status === 'Creando pedido de carga...'} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                        {status === 'Creando pedido de carga...' ? 'Saving...' : 'Create Order'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default OrderForm;