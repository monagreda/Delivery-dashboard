import React from 'react';

const Navbar = ({ isLoggedIn, onLoginClick, onRegisterClick, onLogout }) => {
    return (
        <nav className="absolute top-0 w-full z-50 flex justify-between items-center px-8 py-6">
            <div className="text-xl font-black text-white tracking-tighter">
                LOGI<span className="text-indigo-500">PREDICT</span>
            </div>

            <div className="flex items-center gap-6">
                {!isLoggedIn ? (
                    <>
                        {/* Botón Login */}
                        <button
                            onClick={onLoginClick}
                            className="text-gray-300 hover:text-white font-medium cursor-pointer"
                        >
                            Login
                        </button>

                        {/* Botón Sign Up */}
                        <button
                            onClick={onRegisterClick}
                            className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-all cursor-pointer"
                        >
                            Sign Up
                        </button>
                    </>
                ) : (
                    /* Botón Logout (solo se ve si estás logueado) */
                    <button
                        onClick={onLogout}
                        className="text-red-400 hover:text-red-300 font-medium cursor-pointer"
                    >
                        Logout
                    </button>
                )}
            </div>
        </nav>
    );
};
export default Navbar;