'use client';

import React, { useState, useId } from 'react';
import { ActivityStreamPoint } from '@/lib/strava/activity-detail';
import { Mountain, Heart, Zap, Timer } from 'lucide-react';

interface ActivityStreamChartProps {
  streams: ActivityStreamPoint[];
  sportType: string;
}

export function ActivityStreamChart({ streams, sportType }: ActivityStreamChartProps) {
  const [activeMetric, setActiveMetric] = useState<'altitude' | 'heartrate' | 'speed'>('altitude');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const chartId = useId();

  if (!streams || streams.length < 2) {
    return (
      <div className="py-8 text-center text-xs text-zinc-500 bg-zinc-950/40 rounded-xl border border-zinc-850">
        Keine detaillierten Sensordaten (Streams) für diese Aktivität verfügbar.
      </div>
    );
  }

  const isRide = sportType.toLowerCase().includes('ride');
  const totalDistanceKm = streams[streams.length - 1].distance / 1000;

  // Check which data is available
  const hasAltitude = streams.some((s) => s.altitude !== undefined && s.altitude !== null);
  const hasHeartrate = streams.some((s) => s.heartrate !== undefined && s.heartrate !== null && s.heartrate > 0);
  const hasSpeed = streams.some((s) => s.speed !== undefined && s.speed !== null && s.speed > 0);

  // SVG dimensions
  const width = 800;
  const height = 220;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  // Compute extents
  const altitudes = streams.map((s) => s.altitude ?? 0);
  const minAlt = Math.floor(Math.min(...altitudes));
  const maxAlt = Math.ceil(Math.max(...altitudes));
  const altRange = Math.max(maxAlt - minAlt, 10);

  const heartrates = streams.map((s) => s.heartrate ?? 0).filter((h) => h > 0);
  const minHr = heartrates.length ? Math.floor(Math.min(...heartrates)) : 60;
  const maxHr = heartrates.length ? Math.ceil(Math.max(...heartrates)) : 190;
  const hrRange = Math.max(maxHr - minHr, 20);

  const speeds = streams.map((s) => s.speed ?? 0);
  const minSpeed = Math.min(...speeds);
  const maxSpeed = Math.max(...speeds);
  const speedRange = Math.max(maxSpeed - minSpeed, 1);

  // Helper coordinate getters
  const getX = (distMeters: number) => {
    const fraction = totalDistanceKm > 0 ? distMeters / (totalDistanceKm * 1000) : 0;
    return padLeft + fraction * innerW;
  };

  const getYAlt = (alt?: number) => {
    const val = alt ?? minAlt;
    const fraction = (val - minAlt) / altRange;
    return padTop + innerH - fraction * innerH;
  };

  const getYHr = (hr?: number) => {
    const val = hr ?? minHr;
    const fraction = (val - minHr) / hrRange;
    return padTop + innerH - fraction * innerH;
  };

  const getYSpeed = (spd?: number) => {
    const val = spd ?? minSpeed;
    const fraction = (val - minSpeed) / speedRange;
    return padTop + innerH - fraction * innerH;
  };

  // Build SVG Paths
  let altitudeAreaPath = '';
  let altitudeLinePath = '';
  let heartrateLinePath = '';
  let speedLinePath = '';

  if (hasAltitude) {
    const pts = streams.map((s) => `${getX(s.distance).toFixed(1)},${getYAlt(s.altitude).toFixed(1)}`);
    altitudeLinePath = `M ${pts.join(' L ')}`;
    altitudeAreaPath = `M ${getX(streams[0].distance).toFixed(1)},${(padTop + innerH).toFixed(1)} L ${pts.join(' L ')} L ${getX(streams[streams.length - 1].distance).toFixed(1)},${(padTop + innerH).toFixed(1)} Z`;
  }

  if (hasHeartrate) {
    const pts = streams
      .filter((s) => s.heartrate && s.heartrate > 0)
      .map((s) => `${getX(s.distance).toFixed(1)},${getYHr(s.heartrate).toFixed(1)}`);
    if (pts.length > 1) {
      heartrateLinePath = `M ${pts.join(' L ')}`;
    }
  }

  if (hasSpeed) {
    const pts = streams
      .filter((s) => s.speed !== undefined)
      .map((s) => `${getX(s.distance).toFixed(1)},${getYSpeed(s.speed).toFixed(1)}`);
    if (pts.length > 1) {
      speedLinePath = `M ${pts.join(' L ')}`;
    }
  }

  // Hover detection
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, (mouseX - padLeft * (rect.width / width)) / (innerW * (rect.width / width))));
    const index = Math.round(fraction * (streams.length - 1));
    setHoverIndex(index);
  };

  const hoveredPoint = hoverIndex !== null ? streams[hoverIndex] : null;

  return (
    <div className="space-y-3 bg-zinc-950/70 p-4 sm:p-5 rounded-2xl border border-zinc-800">
      {/* Metric Toggle Buttons & Stats Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
          {hasAltitude && (
            <button
              onClick={() => setActiveMetric('altitude')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeMetric === 'altitude'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Mountain className="w-3.5 h-3.5" />
              <span>Höhenprofil</span>
            </button>
          )}

          {hasHeartrate && (
            <button
              onClick={() => setActiveMetric('heartrate')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeMetric === 'heartrate'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Pulsverlauf</span>
            </button>
          )}

          {hasSpeed && (
            <button
              onClick={() => setActiveMetric('speed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeMetric === 'speed'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isRide ? 'Tempo (km/h)' : 'Pace'}</span>
            </button>
          )}
        </div>

        {/* Live Hover Info Display */}
        {hoveredPoint ? (
          <div className="flex items-center gap-3 text-xs bg-zinc-900/90 border border-zinc-750 px-3 py-1.5 rounded-xl">
            <span className="text-zinc-400 font-mono">
              📍 {(hoveredPoint.distance / 1000).toFixed(2)} km
            </span>
            {hoveredPoint.altitude !== undefined && (
              <span className="text-orange-400 font-semibold flex items-center gap-1">
                <Mountain className="w-3 h-3" />
                {Math.round(hoveredPoint.altitude)} m
              </span>
            )}
            {hoveredPoint.heartrate && (
              <span className="text-rose-400 font-semibold flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {Math.round(hoveredPoint.heartrate)} bpm
              </span>
            )}
            {hoveredPoint.speed !== undefined && hoveredPoint.speed > 0 && (
              <span className="text-cyan-400 font-semibold flex items-center gap-1">
                <Timer className="w-3 h-3" />
                {isRide
                  ? `${(hoveredPoint.speed * 3.6).toFixed(1)} km/h`
                  : (() => {
                      const sec = 1000 / hoveredPoint.speed;
                      const m = Math.floor(sec / 60);
                      const s = Math.floor(sec % 60);
                      return `${m}:${s.toString().padStart(2, '0')} /km`;
                    })()}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-zinc-500 hidden sm:inline">
            💡 Fahre mit der Maus über das Diagramm für Streckendetails
          </span>
        )}
      </div>

      {/* SVG Interactive Chart */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 sm:h-56 cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={`${chartId}-altGrad`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ea580c" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ea580c" stopOpacity="0.03" />
            </linearGradient>
            <linearGradient id={`${chartId}-hrGrad`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e11d48" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#e11d48" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines (horizontal) */}
          {[0, 0.33, 0.66, 1].map((pct, idx) => {
            const y = padTop + innerH * pct;
            return (
              <line
                key={idx}
                x1={padLeft}
                y1={y}
                x2={padLeft + innerW}
                y2={y}
                stroke="#27272a"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            );
          })}

          {/* Y-Axis Labels based on active metric */}
          {activeMetric === 'altitude' && (
            <>
              <text x={padLeft - 8} y={padTop + 4} fill="#71717a" fontSize="10" textAnchor="end" fontFamily="monospace">
                {maxAlt}m
              </text>
              <text x={padLeft - 8} y={padTop + innerH / 2 + 4} fill="#71717a" fontSize="10" textAnchor="end" fontFamily="monospace">
                {Math.round((maxAlt + minAlt) / 2)}m
              </text>
              <text x={padLeft - 8} y={padTop + innerH} fill="#71717a" fontSize="10" textAnchor="end" fontFamily="monospace">
                {minAlt}m
              </text>
            </>
          )}

          {activeMetric === 'heartrate' && (
            <>
              <text x={padLeft - 8} y={padTop + 4} fill="#f43f5e" fontSize="10" textAnchor="end" fontFamily="monospace">
                {maxHr}
              </text>
              <text x={padLeft - 8} y={padTop + innerH / 2 + 4} fill="#f43f5e" fontSize="10" textAnchor="end" fontFamily="monospace">
                {Math.round((maxHr + minHr) / 2)}
              </text>
              <text x={padLeft - 8} y={padTop + innerH} fill="#f43f5e" fontSize="10" textAnchor="end" fontFamily="monospace">
                {minHr}
              </text>
            </>
          )}

          {activeMetric === 'speed' && (
            <>
              <text x={padLeft - 8} y={padTop + 4} fill="#06b6d4" fontSize="10" textAnchor="end" fontFamily="monospace">
                {isRide ? `${(maxSpeed * 3.6).toFixed(0)}km/h` : 'Max'}
              </text>
              <text x={padLeft - 8} y={padTop + innerH} fill="#06b6d4" fontSize="10" textAnchor="end" fontFamily="monospace">
                {isRide ? `${(minSpeed * 3.6).toFixed(0)}km/h` : 'Min'}
              </text>
            </>
          )}

          {/* Elevation Area & Line */}
          {hasAltitude && (
            <>
              <path
                d={altitudeAreaPath}
                fill={`url(#${chartId}-altGrad)`}
                opacity={activeMetric === 'altitude' ? 1 : 0.25}
                className="transition-opacity duration-300"
              />
              <path
                d={altitudeLinePath}
                fill="none"
                stroke="#ea580c"
                strokeWidth={activeMetric === 'altitude' ? 2.5 : 1}
                opacity={activeMetric === 'altitude' ? 1 : 0.35}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-opacity duration-300"
              />
            </>
          )}

          {/* Heart Rate Line */}
          {hasHeartrate && heartrateLinePath && (
            <path
              d={heartrateLinePath}
              fill="none"
              stroke="#f43f5e"
              strokeWidth={activeMetric === 'heartrate' ? 2.5 : 1}
              opacity={activeMetric === 'heartrate' ? 1 : 0.35}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-opacity duration-300"
            />
          )}

          {/* Speed / Pace Line */}
          {hasSpeed && speedLinePath && (
            <path
              d={speedLinePath}
              fill="none"
              stroke="#06b6d4"
              strokeWidth={activeMetric === 'speed' ? 2.5 : 1}
              opacity={activeMetric === 'speed' ? 1 : 0.3}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-opacity duration-300"
            />
          )}

          {/* X-Axis Distance Labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const x = padLeft + innerW * pct;
            const km = (totalDistanceKm * pct).toFixed(1);
            return (
              <g key={idx}>
                <line x1={x} y1={padTop + innerH} x2={x} y2={padTop + innerH + 4} stroke="#3f3f46" strokeWidth="1" />
                <text
                  x={x}
                  y={padTop + innerH + 16}
                  fill="#71717a"
                  fontSize="9"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {km} km
                </text>
              </g>
            );
          })}

          {/* Hover Vertical Guide Line & Dots */}
          {hoveredPoint && (
            <g>
              <line
                x1={getX(hoveredPoint.distance)}
                y1={padTop}
                x2={getX(hoveredPoint.distance)}
                y2={padTop + innerH}
                stroke="#f97316"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />

              {activeMetric === 'altitude' && hoveredPoint.altitude !== undefined && (
                <circle
                  cx={getX(hoveredPoint.distance)}
                  cy={getYAlt(hoveredPoint.altitude)}
                  r="4.5"
                  fill="#ea580c"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              )}

              {activeMetric === 'heartrate' && hoveredPoint.heartrate && (
                <circle
                  cx={getX(hoveredPoint.distance)}
                  cy={getYHr(hoveredPoint.heartrate)}
                  r="4.5"
                  fill="#f43f5e"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              )}

              {activeMetric === 'speed' && hoveredPoint.speed !== undefined && (
                <circle
                  cx={getX(hoveredPoint.distance)}
                  cy={getYSpeed(hoveredPoint.speed)}
                  r="4.5"
                  fill="#06b6d4"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              )}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
