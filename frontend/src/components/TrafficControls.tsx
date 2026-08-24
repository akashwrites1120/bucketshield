import React, { useState, useRef } from 'react';

interface TrafficControlsProps {
  clientId: string;
  accent: string;
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

export const TrafficControls: React.FC<TrafficControlsProps> = ({ clientId, accent }) => {
  const [burstSize, setBurstSize] = useState(15);
  const [burstLoading, setBurstLoading] = useState(false);
  const [sustainRate, setSustainRate] = useState(3);
  const [sustainDuration, setSustainDuration] = useState(5);
  const [sustainLoading, setSustainLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ allowed: number; rejected: number } | null>(null);
  const sustainRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleBurst = async () => {
    if (burstLoading) return;
    setBurstLoading(true);
    setLastResult(null);

    const results = await Promise.all(
      Array.from({ length: burstSize }, () => fireRequest(clientId))
    );
    const allowed = results.filter(Boolean).length;
    setLastResult({ allowed, rejected: burstSize - allowed });
    setBurstLoading(false);
  };

  const handleSustained = () => {
    if (sustainLoading) {
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
      <div
        className="rounded-xl p-3.5 flex flex-col gap-2.5"
        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-[0.14em]">Burst</span>
          <span className="text-xs font-mono tabular-nums text-zinc-300">×{burstSize}</span>
        </div>
        <input
          type="range"
          min={1}
          max={30}
          value={burstSize}
          onChange={(e) => setBurstSize(Number(e.target.value))}
          className="w-full cursor-pointer"
          id={`burst-slider-${clientId}`}
        />
        <button
          id={`burst-btn-${clientId}`}
          onClick={handleBurst}
          disabled={burstLoading}
          className="w-full py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 active:scale-[0.98]"
          style={{
            background: burstLoading ? '#3f3f46' : '#fafafa',
            color: burstLoading ? '#a1a1aa' : '#18181b',
            cursor: burstLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {burstLoading ? (
            <span className="inline-flex items-center gap-1.5">
              <Spinner /> Firing…
            </span>
          ) : (
            `Fire Burst ×${burstSize}`
          )}
        </button>
      </div>

      <div
        className="rounded-xl p-3.5 flex flex-col gap-2.5"
        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-[0.14em]">Sustained</span>
          <span className="text-xs font-mono tabular-nums text-zinc-300">{sustainRate} req/s · {sustainDuration}s</span>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <div className="text-[10px] text-zinc-600 mb-1.5">Rate</div>
            <input
              type="range" min={1} max={10} value={sustainRate}
              onChange={(e) => setSustainRate(Number(e.target.value))}
              className="w-full cursor-pointer"
              id={`rate-slider-${clientId}`}
            />
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-zinc-600 mb-1.5">Duration</div>
            <input
              type="range" min={2} max={30} value={sustainDuration}
              onChange={(e) => setSustainDuration(Number(e.target.value))}
              className="w-full cursor-pointer"
              id={`duration-slider-${clientId}`}
            />
          </div>
        </div>
        <button
          id={`sustain-btn-${clientId}`}
          onClick={handleSustained}
          className="w-full py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 active:scale-[0.98]"
          style={{
            background: sustainLoading ? `${accent}22` : 'transparent',
            color: accent,
            border: `1px solid ${accent}55`,
            cursor: 'pointer',
          }}
        >
          {sustainLoading ? '■ Stop' : '▶ Start Sustained'}
        </button>
      </div>

      {lastResult && (
        <div
          key={`${lastResult.allowed}-${lastResult.rejected}`}
          className="rounded-lg px-3 py-2 flex gap-3 items-center animate-slide-in-row text-xs font-mono tabular-nums"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <span style={{ color: '#34d399' }}>✓ {lastResult.allowed}</span>
          <span className="text-zinc-700">|</span>
          <span style={{ color: '#f87171' }}>✗ {lastResult.rejected}</span>
        </div>
      )}
    </div>
  );
};

const Spinner: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
