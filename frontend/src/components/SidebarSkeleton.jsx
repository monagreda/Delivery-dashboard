import React from 'react';

const SidebarSkeleton = () => {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Fake Status */}
            <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-skeleton"></div>
                <div className="h-3 w-24 bg-skeleton rounded"></div>
            </div>

            {/* Fake Controls Box */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl space-y-4 relative overflow-hidden">
                {/* El efecto Shimmer pasando por encima */}
                <div className="absolute inset-0 animate-shimmer"></div>

                <div className="h-3 w-20 bg-skeleton rounded"></div>
                <div className="h-6 w-full bg-skeleton rounded-lg"></div>

                <div className="space-y-3 pt-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-skeleton"></div>
                                <div className="h-3 w-16 bg-skeleton rounded"></div>
                            </div>
                            <div className="h-4 w-12 bg-skeleton rounded-md"></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Fake Chart Area */}
            <div className="space-y-4">
                <div className="h-4 w-32 bg-skeleton rounded"></div>
                <div className="h-48 w-full bg-skeleton rounded-2xl relative overflow-hidden">
                    <div className="absolute inset-0 animate-shimmer"></div>
                </div>
            </div>

        </div>
    );
};

export default SidebarSkeleton;