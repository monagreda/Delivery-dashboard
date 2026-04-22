import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Usamos React.memo para que solo se renderice si 'data' cambia
const DeidadChart = React.memo(({ data, onBarClick }) => {
    // Este log es para que veas en la consola que NO se dispara mientras mueves el mapa
    console.log("🔥 Optimizando: Gráfica renderizada solo por cambio de datos");

    return (
        <div className="h-48 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <XAxis dataKey="name" hide />
                    <YAxis hide />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1e293b',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '12px',
                            color: '#fff'
                        }}
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Bar
                        dataKey="pedidos"
                        radius={[6, 6, 6, 6]}
                        className='cursor-pointer'
                        onClick={(entry) => {
                            const zoneId = entry.name.split(' ')[1];
                            onBarClick(zoneId);
                        }}
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.color}
                                fillOpacity={0.8}
                                className='hover:fill-opacity-100 transition-opacity'
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
});

export default DeidadChart;