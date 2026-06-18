import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../renderer/services/api';
import logo from "../../assets/icon.png"

export default function LicenseGate({ children }: { children: React.ReactNode }) {
    const [licensed, setLicensed] = useState<boolean | null>(null);
    const [key, setKey] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch('http://127.0.0.1:3000/api/settings/license/status');
                if (res.ok) {
                    const data = await res.json();
                    setLicensed(data?.licensed ?? false);
                } else {
                    setTimeout(check, 2000);
                }
            } catch {
                setTimeout(check, 2000);
            }
        };
        check();
    }, []);

    const handleActivate = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('http://127.0.0.1:3000/api/settings/license/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ license_key: key.trim() })
            });
            const data = await res.json();
            if (data?.success) {
                setLicensed(true);
            } else {
                setError(data?.error || 'Activation failed');
            }
        } catch {
            setError('Could not connect to server');
        }
        setLoading(false);
    };

    // Still checking
    if (licensed === null) return (
        <div className="h-screen flex items-center justify-center bg-[#141414]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        </div>
    );

    // Not licensed — show activation screen
    if (!licensed) return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "linear-gradient(180deg, #00e060 0%, #00b84a 15%, #007a30 35%, #003a16 55%, #000e05 75%, #000000 100%)" }}>
            <div className="w-full max-w-[calc(100vw-2rem)] sm:max-w-xl lg:max-w-3xl bg-white rounded-2xl overflow-hidden flex shadow-2xl">
                {/* LEFT: Green gradient panel */}
                <div
                    className="w-[45%] hidden sm:flex flex-col justify-between p-8 relative min-h-[520px]"
                    style={{
                        background: "linear-gradient(to bottom, #00e060 0%, #00b84a 20%, #007a30 45%, #003a16 70%, #000e05 88%, #000000 100%)",
                    }}
                >
                    <p className="text-white text-2xl font-bold leading-tight z-10 relative text-left">
                        Manage your pharmacy<br />with ease &amp; precision.
                    </p>
                </div>

                {/* RIGHT: Form */}
                <div className="flex-1 flex flex-col justify-center px-10 py-10">
                    {/* Logo */}
                    <div className="mb-5">
                        <img src={logo} alt="Pharmacy POS" className="w-[42px] h-[42px]" />
                    </div>

                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1">Activate License</h1>
                    <p className="text-sm text-gray-500 mb-6">Enter your license key to activate</p>

                    <div className="h-px bg-gray-200 mb-6" />

                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm text-gray-600 mb-1.5">License Key</label>
                            <input
                                className="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 bg-white text-center font-mono tracking-widest focus:outline-none focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
                                placeholder="IB-XXXXXXXX-XXXX"
                                value={key}
                                onChange={e => setKey(e.target.value.toUpperCase())}
                                onKeyDown={e => e.key === 'Enter' && handleActivate()}
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            onClick={handleActivate}
                            disabled={loading || key.length < 10}
                            className="cta-btn w-full bg-[#16a34a] text-white font-semibold text-sm rounded-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{ transition: "background-color 0.15s ease, transform 0.1s ease" }}
                        >
                            {loading ? 'Activating...' : 'Activate License'}
                        </button>

                        <p className="text-center text-xs text-gray-400 pt-1">
                            Purchase at instantbill.in or contact us on WhatsApp
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    // Licensed — render app normally
    return <>{children}</>;
}