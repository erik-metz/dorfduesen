'use client';

import React from 'react';
import Image from 'next/image';
import { ActivityDetailData } from '@/lib/strava/activity-detail';
import { ActivityStreamChart } from './ActivityStreamChart';
import { ActivitySplitsTable } from './ActivitySplitsTable';
import { polylineToSvgPath } from '@/lib/strava/polyline';
import {
  Flame,
  Heart,
  Mountain,
  Gauge,
  Thermometer,
  Zap,
  Watch,
  Award,
  Sparkles,
  Camera,
  ExternalLink,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import { StravaIcon } from '@/components/icons/BrandIcons';

interface ActivityDetailCardProps {
  detail: ActivityDetailData;
  onOpenModal?: () => void;
  isModal?: boolean;
}

function formatDurationSeconds(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  }
  return `${m}:${s.toString().padStart(2, '0')}m`;
}

export function ActivityDetailCard({ detail, onOpenModal, isModal = false }: ActivityDetailCardProps) {
  const isRide = detail.sportType.toLowerCase().includes('ride');
  const polylineSource = detail.detailedPolyline || detail.summaryPolyline;
  const svgMapPath = polylineSource ? polylineToSvgPath(polylineSource, 400, 240, 16) : null;

  return (
    <div className={`space-y-6 ${isModal ? 'p-6 sm:p-8' : 'p-4 sm:p-6 bg-zinc-900/90 rounded-2xl border border-zinc-800'}`}>
      {/* Description / Notes if user wrote any */}
      {detail.description && (
        <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs text-zinc-300 italic">
          &quot;{detail.description}&quot;
        </div>
      )}

      {/* Grid of Key Parameter Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Calories */}
        {detail.calories !== null && detail.calories !== undefined && (
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span>Kalorien</span>
            </div>
            <div className="text-lg font-black text-white mt-1">
              {Math.round(detail.calories)} <span className="text-xs text-zinc-400 font-normal">kcal</span>
            </div>
          </div>
        )}

        {/* Heart Rate Avg & Max */}
        {detail.averageHeartrate && (
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>Herzfrequenz</span>
            </div>
            <div className="text-lg font-black text-rose-400 mt-1">
              {Math.round(detail.averageHeartrate)}{' '}
              <span className="text-xs text-zinc-400 font-normal">Ø bpm</span>
            </div>
            {detail.maxHeartrate && (
              <div className="text-[10px] text-zinc-500 font-mono">Max {Math.round(detail.maxHeartrate)} bpm</div>
            )}
          </div>
        )}

        {/* Cadence */}
        {detail.averageCadence && (
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <Gauge className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isRide ? 'Trittfrequenz' : 'Schrittfrequenz'}</span>
            </div>
            <div className="text-lg font-black text-white mt-1">
              {Math.round(isRide ? detail.averageCadence : detail.averageCadence * 2)}{' '}
              <span className="text-xs text-zinc-400 font-normal">{isRide ? 'rpm' : 'spm'}</span>
            </div>
          </div>
        )}

        {/* Watts / Power */}
        {detail.averageWatts && (
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Leistung</span>
            </div>
            <div className="text-lg font-black text-amber-400 mt-1">
              {Math.round(detail.averageWatts)} <span className="text-xs text-zinc-400 font-normal">Ø W</span>
            </div>
            {detail.maxWatts && (
              <div className="text-[10px] text-zinc-500 font-mono">Max {Math.round(detail.maxWatts)} W</div>
            )}
          </div>
        )}

        {/* Elevation Extents */}
        {(detail.elevHigh !== null || detail.elevLow !== null) && (
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <Mountain className="w-3.5 h-3.5 text-emerald-400" />
              <span>Höhe min/max</span>
            </div>
            <div className="text-lg font-black text-white mt-1">
              {detail.elevHigh !== null ? Math.round(detail.elevHigh!) : '-'}{' '}
              <span className="text-xs text-zinc-400 font-normal">m</span>
            </div>
            {detail.elevLow !== null && (
              <div className="text-[10px] text-zinc-500 font-mono">Tiefste: {Math.round(detail.elevLow!)} m</div>
            )}
          </div>
        )}

        {/* Suffer Score / Relative Effort */}
        {detail.sufferScore && (
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
              <span>Relative Effort</span>
            </div>
            <div className="text-lg font-black text-orange-400 mt-1">
              {detail.sufferScore} <span className="text-xs text-zinc-400 font-normal">Score</span>
            </div>
          </div>
        )}

        {/* Temperature */}
        {detail.averageTemp !== null && detail.averageTemp !== undefined && (
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <Thermometer className="w-3.5 h-3.5 text-sky-400" />
              <span>Temperatur</span>
            </div>
            <div className="text-lg font-black text-white mt-1">
              {Math.round(detail.averageTemp)} <span className="text-xs text-zinc-400 font-normal">°C</span>
            </div>
          </div>
        )}

        {/* Gear / Equipment */}
        {detail.gear && (
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 col-span-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>{isRide ? 'Fahrrad' : 'Schuhe'}</span>
            </div>
            <div className="text-sm font-bold text-white mt-1 truncate" title={detail.gear.name}>
              {detail.gear.name}
            </div>
            {detail.gear.distance && (
              <div className="text-[10px] text-zinc-500 font-mono">
                {(detail.gear.distance / 1000).toFixed(0)} km Gesamtstrecke
              </div>
            )}
          </div>
        )}

        {/* Device Name */}
        {detail.deviceName && (
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <Watch className="w-3.5 h-3.5 text-cyan-400" />
              <span>Aufzeichnung</span>
            </div>
            <div className="text-xs font-semibold text-zinc-200 mt-1 truncate" title={detail.deviceName}>
              {detail.deviceName}
            </div>
          </div>
        )}
      </div>

      {/* Main Analysis Section: Map and Stream Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive Charts (Höhenprofil & Herzfrequenz) */}
        <div className={`space-y-4 ${svgMapPath ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-zinc-300">
              Interaktives Höhen- & Sensor-Profil
            </h4>
            <span className="text-[11px] text-zinc-500 font-mono">
              Bewegungszeit: {formatDurationSeconds(detail.movingTime)}
            </span>
          </div>
          {detail.streams && detail.streams.length > 0 ? (
            <ActivityStreamChart streams={detail.streams} sportType={detail.sportType} />
          ) : (
            <div className="p-6 text-center text-xs text-zinc-500 bg-zinc-950/60 rounded-xl border border-zinc-800">
              Keine Sensor-Streams von Strava hinterlegt.
            </div>
          )}
        </div>

        {/* GPS Route Map Preview */}
        {svgMapPath && (
          <div className="lg:col-span-4 space-y-2 bg-zinc-950/70 p-4 rounded-2xl border border-zinc-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-300 uppercase tracking-wider text-[11px] flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-orange-500" />
                GPS Strecke
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {(detail.distance / 1000).toFixed(2)} km
              </span>
            </div>
            <div className="w-full aspect-video bg-zinc-950 rounded-xl border border-zinc-850 p-2 flex items-center justify-center relative overflow-hidden">
              <svg viewBox="0 0 400 240" className="w-full h-full drop-shadow-[0_0_12px_rgba(234,88,12,0.3)]">
                <path
                  d={svgMapPath}
                  fill="none"
                  stroke="#ea580c"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="text-[10px] text-zinc-500 text-center pt-1">
              Präziser GPS-Track ({polylineSource ? 'HD Vektor' : 'Strava Track'})
            </div>
          </div>
        )}
      </div>

      {/* KM Splits Table */}
      {detail.splitsMetric && detail.splitsMetric.length > 0 && (
        <ActivitySplitsTable splits={detail.splitsMetric} sportType={detail.sportType} />
      )}

      {/* Best Efforts (PRs within the run: 400m, 1k, 5k...) */}
      {detail.bestEfforts && detail.bestEfforts.length > 0 && (
        <div className="space-y-3 bg-zinc-950/70 p-4 sm:p-5 rounded-2xl border border-zinc-800">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-black uppercase tracking-wider text-zinc-300">
              Abschnitts-Bestzeiten (Best Efforts)
            </h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {detail.bestEfforts.map((effort) => {
              const sec = effort.moving_time;
              const m = Math.floor(sec / 60);
              const s = sec % 60;
              const isPR = effort.pr_rank === 1;

              return (
                <div
                  key={effort.id}
                  className={`p-3 rounded-xl border ${
                    isPR
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-zinc-900/60 border-zinc-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
                    <span>{effort.name}</span>
                    {effort.pr_rank && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                          isPR ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        PR #{effort.pr_rank}
                      </span>
                    )}
                  </div>
                  <div className="text-base font-black text-white mt-1 font-mono">
                    {m}:{s.toString().padStart(2, '0')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Segment Efforts */}
      {detail.segmentEfforts && detail.segmentEfforts.length > 0 && (
        <div className="space-y-2 bg-zinc-950/70 p-4 sm:p-5 rounded-2xl border border-zinc-800">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-zinc-300">
              Strava Segmente ({detail.segmentEfforts.length})
            </h4>
            <span className="text-[11px] text-zinc-500">Platzierungen & Bestzeiten</span>
          </div>
          <div className="divide-y divide-zinc-900 max-h-56 overflow-y-auto pr-1">
            {detail.segmentEfforts.map((seg) => {
              const sec = seg.moving_time;
              const m = Math.floor(sec / 60);
              const s = sec % 60;

              return (
                <div key={seg.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                  <div className="truncate">
                    <span className="font-semibold text-zinc-200 block truncate">
                      {seg.name}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {(seg.distance / 1000).toFixed(2)} km
                      {seg.segment?.average_grade ? ` • ${seg.segment.average_grade.toFixed(1)}% Steigung` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {seg.pr_rank && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        PR #{seg.pr_rank}
                      </span>
                    )}
                    <span className="font-mono font-bold text-white">
                      {m}:{s.toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Photo Gallery if Photos exist */}
      {detail.photos?.primaryUrl && (
        <div className="space-y-2 bg-zinc-950/70 p-4 sm:p-5 rounded-2xl border border-zinc-800">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-300">
            <Camera className="w-4 h-4 text-orange-500" />
            <span>Strava Fotos ({detail.photos.count})</span>
          </div>
          <div className="relative w-full max-w-md h-64 rounded-xl overflow-hidden border border-zinc-800">
            <Image
              src={detail.photos.primaryUrl}
              alt="Strava Aktivitätsfoto"
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/80">
        <span className="text-[11px] text-zinc-500">
          Gecacht in Dorfdüsen DB • Zuletzt synchronisiert: {new Date(detail.cachedAt).toLocaleTimeString('de-DE')}
        </span>

        <div className="flex items-center gap-2">
          {onOpenModal && !isModal && (
            <button
              onClick={onOpenModal}
              className="px-3.5 py-1.5 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 hover:text-orange-300 border border-orange-500/30 text-xs font-bold transition-all cursor-pointer"
            >
              Im Vollbild anzeigen
            </button>
          )}

          <a
            href={`https://www.strava.com/activities/${detail.stravaId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
          >
            <StravaIcon className="w-3.5 h-3.5 text-[#fc5200]" />
            <span>Auf Strava öffnen</span>
            <ExternalLink className="w-3 h-3 text-zinc-500" />
          </a>
        </div>
      </div>
    </div>
  );
}
