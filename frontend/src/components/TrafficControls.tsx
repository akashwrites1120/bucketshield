import React, { useState, useRef } from 'react';

interface TrafficControlsProps {
  clientId: string;
}

const API_BASE = '/api';

async function fireRequest(clientId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/protected`, {
      method: 'POST',
      headers: { 'X-Client-ID': clientId, 'Content-Type': 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Burst button + sustained rate slider controls.
 * Fires real HTTP requests to the backend so WS events flow back through the live feed.
 */
export const TrafficControls: React.FC<TrafficControlsProps> = ({ clientId }) => {
  const [burstSize, setBurstSize] = useState(15);
  const [burstLoading, setBurstLoading] = useState(false);
  const [sustainRate, setSustainRate] = useState(3); // req/sec
  const [sustainDuration, setSustainDuration] = useState(5); // seconds
  const [sustainLoading, setSustainLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ allowed: number; rejected: number } | null>(null);
  const sustainRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleBurst = async () => {
    if (burstLoading) return;
    setBurstLoading(true);
    setLastResult(null);

    // Fire all requests concurrently
    const results = await Promise.all(
      Array.from({ length: burstSize }, () => fireRequest(clientId))
    );
    const allowed = results.filter(Boolean).length;
    setLastResult({ allowed, rejected: burstSize - allowed });
    setBurstLoading(false);
  };

  const handleSustained = () => {
    if (sustainLoading) {
      // Stop
      if (sustainRef.current) clearInterval(sustainRef.current);
      setSustainLoading(false);
      return;
    }

    setSustainLoading(true);
    setLastResult(null);
    let elapsed = 0;
    const intervalMs = 1000 / sustainRate;
    let allowed = 0, rejected = 0;

    sustainRef.current = setInterval(async () => {
      elapsed += intervalMs;
      const ok = await fireRequest(clientId);
      if (ok) allowed++; else rejected++;
      setLastResult({ allowed, rejected });

      if (elapsed >= sustainDuration * 1000) {
        clearInterval(sustainRef.current!);
        setSustainLoading(false);
      }
    }, intervalMs);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Burst section */}
      <div
        className="rounded-xl p-3 flex flex-col gap-2"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Burst</span>
          <span className="text-xs font-bold text-indigo-400">×{burstSize}</span>
        </div>
        <input
          type="range"
          min={1}
          max={30}
          value={burstSize}
          onChange={(e) => setBurstSize(Number(e.target.value))}
          className="w-full accent-indigo-500 cursor-pointer"
          id={`burst-slider-${clientId}`}
        />
        <button
          id={`burst-btn-${clientId}`}
          onClick={handleBurst}
          disabled={burstLoading}
          className="w-full py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-150"
          style={{
            background: burstLoading
              ? 'rgba(99,102,241,0.3)'
              : 'linear-gradient(135deg, #6366f1, #818cf8)',
            color: 'white',
            cursor: burstLoading ? 'not-allowed' : 'pointer',
            boxShadow: burstLoading ? 'none' : '0 0 12px rgba(99,102,241,0.4)',
          }}
        >
          {burstLoading ? 'Firing…' : `Fire Burst ×${burstSize}`}
        </button>
      </div>

      {/* Sustained section */}
      <div
        className="rounded-xl p-3 flex flex-col gap-2"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Sustained</span>
          <span className="text-xs font-bold text-purple-400">{sustainRate} req/s · {sustainDuration}s</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="text-xs text-slate-500 mb-1">Rate</div>
            <input
              type="range" min={1} max={10} value={sustainRate}
              onChange={(e) => setSustainRate(Number(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
              id={`rate-slider-${clientId}`}
            />
          </div>
          <div className="flex-1">
            <div className="text-xs text-slate-500 mb-1">Duration</div>
            <input
              type="range" min={2} max={30} value={sustainDuration}
              onChange={(e) => setSustainDuration(Number(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
              id={`duration-slider-${clientId}`}
            />
          </div>
        </div>
        <button
          id={`sustain-btn-${clientId}`}
          onClick={handleSustained}
          className="w-full py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-150"
          style={{
            background: sustainLoading
              ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
              : 'linear-gradient(135deg, #7c3aed55, #6d28d955)',
            color: sustainLoading ? 'white' : '#a78bfa',
            border: '1px solid rgba(139,92,246,0.4)',
            cursor: 'pointer',
            boxShadow: sustainLoading ? '0 0 12px rgba(124,58,237,0.4)' : 'none',
          }}
        >
          {sustainLoading ? '■ Stop' : '▶ Start Sustained'}
        </button>
      </div>

      {/* Result summary */}
      {lastResult && (
        <div
          className="rounded-lg px-3 py-2 flex gap-3 items-center animate-slide-in text-xs"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <span className="font-bold" style={{ color: '#22c55e' }}>✓ {lastResult.allowed}</span>
          <span className="text-slate-600">|</span>
          <span className="font-bold" style={{ color: '#ef4444' }}>✗ {lastResult.rejected}</span>
        </div>
      )}
    </div>
  );
};
