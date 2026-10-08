'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Flame,
  Calendar,
  Activity,
  Heart,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Gauge,
  ArrowRight,
  Loader2,
} from 'lucide-react';

interface Workout {
  id: string;
  scheduledDate: string;
  workoutType: string;
  title: string;
  description: string;
  targetDistance?: number | null;
  targetDurationMinutes?: number | null;
  targetPaceMin?: string | null;
  targetPaceMax?: string | null;
  targetHrZone?: number | null;
  status: string;
  aiFeedback?: string | null;
}

interface Week {
  id: string;
  weekNumber: number;
  phase: string;
  targetDistance: number;
  isDeloadWeek: boolean;
  focusTitle?: string | null;
  workouts: Workout[];
}

interface Plan {
  id: string;
  title: string;
  goalType: string;
  targetDistance?: number | null;
  targetTimeSeconds?: number | null;
  targetDate?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  totalWeeks: number;
  weeks: Week[];
}

interface ProfileData {
  calculatedVdot: number;
  calculatedMaxHr: number;
  baseline: {
    averageWeeklyKm: number;
    peakWeeklyKm: number;
    longestRunKm: number;
    estimatedVdot: number;
    measuredMaxHr?: number;
    acwr: number;
  };
  paces: {
    easyMin: string;
    easyMax: string;
    thresholdMin: string;
    thresholdMax: string;
    intervalMin: string;
    intervalMax: string;
    marathonMin: string;
    marathonMax: string;
  };
  zones: Array<{
    zone: number;
    name: string;
    minHr: number;
    maxHr: number;
    description: string;
  }>;
}

export function CoachDashboard() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'plan' | 'metrics' | 'new-plan'>('plan');

  // Generator form state
  const [goalType, setGoalType] = useState('HALF_MARATHON');
  const [targetDate, setTargetDate] = useState('');
  const [weeklyDays, setWeeklyDays] = useState(3);
  const [longRunDay, setLongRunDay] = useState(0); // 0 = Sunday
  const [weightKg, setWeightKg] = useState('');
  const [restingHr, setRestingHr] = useState('');

  const loadData = React.useCallback(async () => {
    try {
      const [planRes, profileRes] = await Promise.all([
        fetch('/api/coach/plan'),
        fetch('/api/coach/profile'),
      ]);

      if (planRes.ok) {
        const pData = await planRes.json();
        setPlan(pData.plan);
        if (pData.plan?.status === 'QUEUED' || pData.plan?.status === 'PROCESSING') {
          setGenerating(true);
        } else {
          setGenerating(false);
        }
      }
      if (profileRes.ok) {
        const prData = await profileRes.json();
        setProfileData(prData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch plan & profile
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  // Poll while generating
  useEffect(() => {
    if (!generating) return;
    const interval = setInterval(async () => {
      const res = await fetch('/api/coach/plan');
      if (res.ok) {
        const data = await res.json();
        if (data.plan?.status === 'ACTIVE') {
          setPlan(data.plan);
          setGenerating(false);
          setActiveTab('plan');
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [generating]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);

    try {
      // First save profile if inputs provided
      if (weightKg || restingHr) {
        await fetch('/api/coach/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            weightKg: weightKg ? Number(weightKg) : undefined,
            restingHeartrate: restingHr ? Number(restingHr) : undefined,
            weeklyAvailability: weeklyDays,
            preferredLongRunDay: longRunDay,
          }),
        });
      }

      // Trigger plan generation via Inngest & xAI
      const res = await fetch('/api/coach/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalType,
          targetDate: targetDate || undefined,
          weeklyAvailability: weeklyDays,
          preferredLongRunDay: longRunDay,
        }),
      });

      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error(err);
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex items-center gap-3 text-orange-500 font-bold">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Lade Smart Coach...</span>
        </div>
      </div>
    );
  }

  // Find today's workout
  const todayStr = new Date().toISOString().split('T')[0];
  let todayWorkout: Workout | null = null;
  if (plan?.weeks) {
    for (const w of plan.weeks) {
      for (const wo of w.workouts) {
        if (wo.scheduledDate.startsWith(todayStr)) {
          todayWorkout = wo;
          break;
        }
      }
      if (todayWorkout) break;
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>KI & Sportwissenschaft (xAI Grok + Inngest)</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
            DorfDüsen Smart Coach
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Personalisierte, adaptive Ausdauerpläne nach VDOT & 80/20-Polarisierung.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-1 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setActiveTab('plan')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'plan'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Trainingsplan
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'metrics'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Physiologie & Zonen
          </button>
          <button
            onClick={() => setActiveTab('new-plan')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'new-plan'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            + Neuer Plan
          </button>
        </div>
      </div>

      {/* Generation in progress banner */}
      {generating && (
        <div className="rounded-2xl bg-gradient-to-r from-orange-950/60 via-zinc-900 to-zinc-900 border border-orange-500/40 p-6 flex flex-col sm:flex-row items-center gap-4 animate-pulse shadow-xl shadow-orange-500/10">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="font-bold text-white text-base">Inngest & xAI Grok generieren deinen Plan...</h4>
            <p className="text-xs text-zinc-400">
              Strava-Baseline wird analysiert, Periodisierungsphasen werden berechnet und maßgeschneiderte Workouts generiert. Das dauert wenige Sekunden.
            </p>
          </div>
        </div>
      )}

      {/* TAB 1: ACTIVE PLAN */}
      {activeTab === 'plan' && (
        <div className="space-y-8">
          {/* Today's Workout Hero Card */}
          {todayWorkout ? (
            <div className="rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-orange-500/30 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <span className="px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 fill-orange-400" />
                  Heutige Mission
                </span>
                <span className="text-xs font-semibold text-zinc-400">
                  {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
                </span>
              </div>

              <div className="space-y-2 max-w-2xl">
                <h3 className="text-2xl sm:text-3xl font-black text-white">{todayWorkout.title}</h3>
                <p className="text-sm text-zinc-300 leading-relaxed">{todayWorkout.description}</p>
              </div>

              {/* Target Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-zinc-800/80">
                <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800">
                  <span className="text-[11px] font-bold uppercase text-zinc-500 block">Distanz</span>
                  <span className="text-xl font-black text-white">
                    {todayWorkout.targetDistance ? `${todayWorkout.targetDistance} km` : 'Frei'}
                  </span>
                </div>
                <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800">
                  <span className="text-[11px] font-bold uppercase text-zinc-500 block">Soll-Pace</span>
                  <span className="text-xl font-black text-orange-400">
                    {todayWorkout.targetPaceMin ? `${todayWorkout.targetPaceMin} - ${todayWorkout.targetPaceMax}` : 'Wohlfühltempo'}
                  </span>
                </div>
                <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800">
                  <span className="text-[11px] font-bold uppercase text-zinc-500 block">Herzfrequenz</span>
                  <span className="text-xl font-black text-emerald-400">
                    {todayWorkout.targetHrZone ? `Zone ${todayWorkout.targetHrZone}` : 'Moderat'}
                  </span>
                </div>
                <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800">
                  <span className="text-[11px] font-bold uppercase text-zinc-500 block">Status</span>
                  <span className="text-xl font-black text-zinc-300">
                    {todayWorkout.status === 'COMPLETED' ? '✅ Absolviert' : '⏳ Ausstehend'}
                  </span>
                </div>
              </div>

              {todayWorkout.aiFeedback && (
                <div className="mt-4 p-4 rounded-xl bg-orange-950/30 border border-orange-500/20 text-xs text-orange-200">
                  <strong className="block mb-1 text-orange-400">Coach Feedback (Grok):</strong>
                  {todayWorkout.aiFeedback}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white">Heute steht kein Training auf dem Plan</h4>
                  <p className="text-xs text-zinc-400">Nutze den Tag für Regeneration oder leichtes Dehnen.</p>
                </div>
              </div>
            </div>
          )}

          {/* Plan overview & Weeks list */}
          {plan ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-white">{plan.title}</h2>
                  <p className="text-xs text-zinc-400">
                    {plan.totalWeeks} Wochen • Gestartet am{' '}
                    {new Date(plan.startDate).toLocaleDateString('de-DE')}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {plan.weeks?.map((week) => (
                  <div
                    key={week.id}
                    className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 space-y-4 hover:border-zinc-700 transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/60 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-black flex items-center justify-center border border-orange-500/30">
                          W{week.weekNumber}
                        </span>
                        <div>
                          <span className="text-xs font-bold uppercase text-zinc-400 block tracking-wider">
                            Phase: {week.phase} {week.isDeloadWeek && '• 🌿 Deload / Erholung'}
                          </span>
                          <span className="text-sm font-bold text-white">
                            {week.focusTitle || `${week.targetDistance} km Wochenziel`}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-black text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                        {week.targetDistance} km Soll
                      </span>
                    </div>

                    {/* Workouts Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {week.workouts.map((w) => {
                        const date = new Date(w.scheduledDate);
                        const isSunday = date.getDay() === 0;

                        return (
                          <div
                            key={w.id}
                            className={`p-4 rounded-xl border text-xs space-y-2 transition-all ${
                              w.status === 'COMPLETED'
                                ? 'bg-emerald-950/20 border-emerald-500/30'
                                : isSunday
                                ? 'bg-orange-950/15 border-orange-500/30'
                                : 'bg-zinc-950/60 border-zinc-800/80'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-zinc-400">
                                {date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                                  w.workoutType === 'LONGRUN'
                                    ? 'bg-orange-500/20 text-orange-400'
                                    : w.workoutType === 'TEMPO'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-zinc-800 text-zinc-300'
                                }`}
                              >
                                {w.workoutType}
                              </span>
                            </div>

                            <h5 className="font-bold text-white text-sm line-clamp-1">{w.title}</h5>
                            <p className="text-zinc-400 line-clamp-2">{w.description}</p>

                            <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] font-semibold">
                              <span className="text-white font-bold">{w.targetDistance ? `${w.targetDistance} km` : '-'}</span>
                              <span className="text-orange-400">{w.targetPaceMin || 'Easy'}</span>
                              <span className="text-emerald-400">Z{w.targetHrZone || 2}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-zinc-900 rounded-3xl border border-zinc-800 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 text-orange-500 mx-auto flex items-center justify-center">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white">Noch kein Trainingsplan aktiv</h3>
              <p className="text-sm text-zinc-400 max-w-md mx-auto">
                Erstelle jetzt deinen ersten personalisierten Plan mit xAI Grok und unserer Sportwissenschafts-Engine.
              </p>
              <button
                onClick={() => setActiveTab('new-plan')}
                className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-white text-sm transition-all shadow-lg shadow-orange-500/20 inline-flex items-center gap-2"
              >
                <span>Plan jetzt erstellen</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PHYSIOLOGY & METRICS */}
      {activeTab === 'metrics' && profileData && (
        <div className="space-y-8">
          {/* Key VDOT & Heartrate Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase">
                <span>VDOT Fitnesswert</span>
                <Gauge className="w-4 h-4 text-orange-400" />
              </div>
              <div className="text-3xl font-black text-white">{profileData.calculatedVdot}</div>
              <p className="text-[11px] text-zinc-500">Aus Strava-Historie (Jack Daniels Formula)</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase">
                <span>Maximalpuls (HRmax)</span>
                <Heart className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-3xl font-black text-rose-400">{profileData.calculatedMaxHr} bpm</div>
              <p className="text-[11px] text-zinc-500">Messung / Tanaka-Algorithmus</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase">
                <span>Wochen-Ø Volumen</span>
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-black text-white">
                {profileData.baseline.averageWeeklyKm} km
              </div>
              <p className="text-[11px] text-zinc-500">Basis der letzten 8 Wochen</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase">
                <span>ACWR Überlastungs-Index</span>
                <TrendingUp className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-3xl font-black text-cyan-400">{profileData.baseline.acwr}</div>
              <p className="text-[11px] text-zinc-500">
                {profileData.baseline.acwr >= 0.8 && profileData.baseline.acwr <= 1.3
                  ? 'Optimaler Sweet Spot (0.8 - 1.3)'
                  : 'Erhöhtes Ermüdungsrisiko'}
              </p>
            </div>
          </div>

          {/* Daniels Pace Calculator Results */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-xl font-black text-white">Deine individuellen Trainings-Paces</h3>
              <p className="text-xs text-zinc-400">
                Berechnet nach Jack Daniels VDOT-Tabellen basierend auf deinem Leistungsniveau.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-xs font-bold uppercase text-emerald-400">Easy / Grundlagenausdauer</span>
                <div className="text-2xl font-black text-white">
                  {profileData.paces.easyMin} - {profileData.paces.easyMax}
                </div>
                <span className="text-[11px] text-zinc-500">min/km (Zone 2 - 80% des Trainings)</span>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-xs font-bold uppercase text-amber-400">Marathon / Zügig</span>
                <div className="text-2xl font-black text-white">
                  {profileData.paces.marathonMin} - {profileData.paces.marathonMax}
                </div>
                <span className="text-[11px] text-zinc-500">min/km (Zone 3 - Dauerlauf 2)</span>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-xs font-bold uppercase text-orange-400">Threshold / Schwelle</span>
                <div className="text-2xl font-black text-white">
                  {profileData.paces.thresholdMin} - {profileData.paces.thresholdMax}
                </div>
                <span className="text-[11px] text-zinc-500">min/km (Zone 4 - Laktatschwelle)</span>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-xs font-bold uppercase text-rose-400">Intervall / VO2max</span>
                <div className="text-2xl font-black text-white">
                  {profileData.paces.intervalMin} - {profileData.paces.intervalMax}
                </div>
                <span className="text-[11px] text-zinc-500">min/km (Zone 5 - 400m - 1000m)</span>
              </div>
            </div>
          </div>

          {/* 5 Heart Rate Zones Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-xl font-black text-white">Deine 5 Herzfrequenz-Zonen</h3>
              <p className="text-xs text-zinc-400">
                Pulsbereiche für gezielte aerobe und anaerobe Anpassung.
              </p>
            </div>

            <div className="space-y-3">
              {profileData.zones.map((z) => (
                <div
                  key={z.zone}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 font-black text-xs flex items-center justify-center shrink-0">
                      Z{z.zone}
                    </span>
                    <div>
                      <h4 className="font-bold text-white text-sm">{z.name}</h4>
                      <p className="text-xs text-zinc-400">{z.description}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-base font-black text-white">
                      {z.minHr} - {z.maxHr} bpm
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GENERATE NEW PLAN WIZARD */}
      {activeTab === 'new-plan' && (
        <div className="max-w-2xl mx-auto bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
          <div>
            <span className="text-xs font-bold uppercase text-orange-400 tracking-wider">
              Konfiguration & KI-Generierung
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
              Neuen Trainingsplan erstellen
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Wähle dein Ziel. Inngest berechnet die Periodisierung und xAI Grok formuliert deinen individuellen Wochenplan.
            </p>
          </div>

          <form onSubmit={handleCreatePlan} className="space-y-6">
            {/* Goal selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-300 block">Trainingsziel</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: '5K', label: '5 km' },
                  { id: '10K', label: '10 km' },
                  { id: 'HALF_MARATHON', label: 'Halbmarathon' },
                  { id: 'MARATHON', label: 'Marathon' },
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoalType(g.id)}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                      goalType === g.id
                        ? 'bg-orange-500 border-orange-400 text-white shadow-lg shadow-orange-500/20'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Date */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-300 block">
                Zieldatum / Wettkampftag (Optional)
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
              />
              <p className="text-[11px] text-zinc-500">
                Wird kein Datum angegeben, wird ein optimaler Standard-Zeitraum (z. B. 10–12 Wochen) gewählt.
              </p>
            </div>

            {/* Weekly Days */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-300 block">
                Verfügbare Trainingstage pro Woche: {weeklyDays} Tage
              </label>
              <input
                type="range"
                min="2"
                max="5"
                step="1"
                value={weeklyDays}
                onChange={(e) => setWeeklyDays(Number(e.target.value))}
                className="w-full accent-orange-500"
              />
              <div className="flex justify-between text-[11px] text-zinc-500 font-semibold">
                <span>2 Einheiten</span>
                <span>3 Einheiten</span>
                <span>4 Einheiten</span>
                <span>5 Einheiten</span>
              </div>
            </div>

            {/* Long Run Day */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-300 block">
                Bevorzugter Tag für den Langen Lauf (Long Run)
              </label>
              <select
                value={longRunDay}
                onChange={(e) => setLongRunDay(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
              >
                <option value={0}>Sonntag (DorfDüsen Sunday Run)</option>
                <option value={6}>Samstag</option>
                <option value={5}>Freitag</option>
              </select>
            </div>

            {/* Biometrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-zinc-300 block">
                  Körpergewicht (kg)
                </label>
                <input
                  type="number"
                  placeholder="z.B. 74"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-zinc-300 block">
                  Ruhepuls (bpm)
                </label>
                <input
                  type="number"
                  placeholder="z.B. 52"
                  value={restingHr}
                  onChange={(e) => setRestingHr(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={generating}
              className="w-full py-4 rounded-xl font-bold bg-orange-500 hover:bg-orange-600 text-white text-sm shadow-xl shadow-orange-500/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Wird generiert...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span>Plan jetzt generieren</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
