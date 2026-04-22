import React, { useState } from 'react';
import axios from 'axios';

const Login = ({ onLoginSuccess, onCancel }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('user'); // Visual para el usuario
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            // Usamos URLSearchParams porque OAuth2PasswordRequestForm espera 'application/x-www-form-urlencoded'
            const params = new URLSearchParams();
            params.append('username', username);
            params.append('password', password);

            const res = await axios.post('http://127.0.0.1:8000/token', params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            // 1. Extraemos token y rol de la respuesta del backend
            const { access_token, role: userRole } = res.data;

            // 2. persistencia
            localStorage.setItem('token', access_token);
            localStorage.setItem('role', userRole);

            //3. Avisamos a App.jsx pasando ambos parametros
            onLoginSuccess(access_token, userRole);

        } catch (err) {
            setError('Usuario o contraseña incorrectos');
        }
    };

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl animate-fade-in">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2">Bienvenido</h2>
                    <p className="text-gray-400 text-sm">Ingresa tus credenciales para continuar</p>
                </div>

                {/* Selector de Rol Visual */}
                <div className="flex p-1 bg-black/40 rounded-xl mb-8 border border-white/5">
                    {['user', 'driver', 'admin'].map((r) => (
                        <button
                            key={r}
                            onClick={() => setRole(r)}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all 
                                ${role === r ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {r}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label
                            htmlFor='username'
                            className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Username</label>
                        <input
                            id='username'
                            name='username'
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 
                            text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            placeholder="Ej: luis_dev"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor='password'
                            className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Password</label>
                        <input
                            id='password'
                            name='password'
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 
                            text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && <p className="text-red-400 text-xs text-center font-medium bg-red-400/10 py-2 rounded-lg">{error}</p>}

                    <div className="pt-2 flex flex-col gap-3">
                        <button
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-700 py-4 rounded-xl text-white font-bold transition-all shadow-xl shadow-indigo-500/20 active:scale-[0.98]"
                        >
                            Iniciar Sesión
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="w-full bg-transparent text-gray-400 hover:text-white py-2 text-sm transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
export default Login;