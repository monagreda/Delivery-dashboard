import React, { useState } from 'react';
import axios from 'axios';

const Register = ({ onCancel, onRegisterSuccess }) => {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'user'
    });
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log("Enviando datos:", formData);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/register`, formData);
            alert("Usuario creado con éxito");
            onRegisterSuccess(formData);
        } catch (err) {
            setError(err.response?.data?.detail || "Error al registrar usuario");
        }
    };

    return (
        <div className="fixed inset-0 z-70 flex items-center justify-center px-4 bg-black/70 backdrop-blur-md">
            <div className="w-full max-w-md p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl">
                <h2 className="text-3xl font-bold text-white mb-6 text-center">Crea tu cuenta</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label
                            htmlFor='username'
                            className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Username</label>
                        <input
                            id='username'
                            name='username'
                            type="text"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition-all"
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        />
                    </div>
                    <div>
                        <label
                            htmlFor='password'
                            className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Password</label>
                        <input
                            id='password'
                            name='password'
                            type="password"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition-all"
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-2 p-1 bg-black/40 rounded-xl">
                        {['user', 'driver'].map((r) => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setFormData({ ...formData, role: r })}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase ${formData.role === r ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    {error && <p className="text-red-400 text-xs text-center">{error}</p>}

                    <button className="w-full bg-indigo-600 hover:bg-indigo-700 py-4 rounded-xl text-white font-bold transition-all mt-4">
                        Registrarse
                    </button>
                    <button type="button" onClick={onCancel} className="w-full text-gray-400 text-sm hover:text-white transition-colors">
                        Volver
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Register;