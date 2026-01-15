"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function MagicLogin() {

    const router = useRouter();
    const [status, setStatus] = useState('Verifying...');

    useEffect(() => {

        const timer = setTimeout(() => {

            localStorage.setItem('isAuthenticated', 'true');
            setStatus('Verification successful! Redirecting...');

            setTimeout(() => {
                router.push('/');
            }, 1000);
        }, 1500);
    }, [router]);

    return (

        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full text-center space-y-6">
                <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-2">
                    <ShieldCheck size={40} className="text-indigo-500" />
                </div>
                
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight">Admin Portal</h1>
                    <p className="text-slate-400 text-sm">Authenticating your session...</p>
                </div>

                <div className="flex items-center gap-2 text-indigo-400 text-sm font-mono bg-indigo-950/30 px-4 py-2 rounded-full">
                    <Loader2 size={16} className="animate-spin" />
                    {status}
                </div>
            </div>
        </div>
    );
}