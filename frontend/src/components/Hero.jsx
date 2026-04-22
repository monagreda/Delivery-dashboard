import React from 'react'

const Hero = ({ onStart }) => {
    //imagen de respaldo
    const backupImageUrl = "https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8ZW50cmVnYXxlbnwwfHwwfHx8MA%3D%3D";

    return (
        <section className='relative min-h-screen flex flex-col md:flex-row bg-[#0a0f1a] overflow-hidden'>
            {/* Lado izquierdo - Texto*/}
            <div className='flex-1 flex flex-col justify-center px-8 lg:px-20 z-10 py-20'>
                <div className='animate-fade-in-up'>
                    <span className='inline-block px-3 py-1 mb-6 text-xs font-semibold tracking-wider 
                text-indigo-400 uppercase bg-indigo-500/10 border border-indigo-500/20 rounded-full'>
                        Logistics & IA Integration
                    </span>
                    <h1 className='text-5xl lg:text-7xl font-extrabold text-white leading-[1,1] mb-6'>
                        Data to enrich <br />
                        <span className='text-indigo-500'>your business.</span>
                    </h1>
                    <p className='text-gray-400 text-lg md:text-xl max-w-lg mb-10 leading-relaxed'>
                        Optimiza la distribución en Caracas con segmentación inteligente de zonas.
                        Visualiza tus pedidos y deja que nuestro algoritmo haga el trabajo pesado.
                    </p>
                    <div className='flex flex-col sm:flex-row gap-4'>
                        <button
                            onClick={onStart}
                            className='px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold
                    rounded-xl transition-all transform hover:scale-105 shadow-xl shadow-indigo-500/20'>
                            Get started
                        </button>
                        <button className='px-8 py-4 bg-transparent text-white font-semibold border border-white/10 
                    rounded-xl hover:bg-white/5 transition-all'>
                            Learn more →
                        </button>
                    </div>
                </div>
            </div>

            {/* Lado derecho - Mapa "Visual" */}
            <div className='flex-1 relative h-400 md:h-auto z-10'>
                {/* Capa de tinte para asegurar que el texto sea legible y combine con el fondo*/}
                <div className='absolute inset-0 bg-[#0a0f1a]/30 z-20' />

                <div
                    className='absolute inset-0 grayscale contrast-125 opacity-60'
                    style={{
                        backgroundImage: `url('${backupImageUrl}')`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                />
                {/* Efecto de degradado para mezclar el mapa con el fondo oscuro */}
                <div className='absolute inset-0 bg-linear-to-t md:bg-linear-to-r from-[#0a0f1a] via-transparent to-transparent z-20' />
            </div>
        </section>
    );
};

export default Hero;