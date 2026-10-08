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
  Scale,
  Plus,
  History,
  Info,
  BookOpen,
  Zap,
  BatteryCharging,
  ShieldCheck,
  Users,
  Trophy,
  Target,
} from 'lucide-react';

export const GOAL_CATEGORIES = [
  {
    id: 'FITNESS_BUILD' as const,
    title: 'Kondition & Ausdauer',
    subtitle: 'Länger durchhalten & aerobe Basis stärken',
    icon: Heart,
    color: 'border-rose-500/30 text-rose-400 bg-rose-500/10',
    activeBg: 'bg-rose-500 text-white border-rose-400 shadow-rose-500/20',
    presets: [
      { id: 'RUN_30_MIN', label: '30 Min am Stück durchlaufen', desc: 'Ohne Gehpause, Einstieg in dauerhaftes Laufen' },
      { id: 'RUN_45_MIN', label: '45 Min am Stück durchlaufen', desc: 'Mittlere kontinuierliche aerobe Ausdauer' },
      { id: 'RUN_60_MIN', label: '60 Min am Stück durchlaufen', desc: 'Solide Ausdauerbasis für lange Genussläufe' },
      { id: 'AEROBIC_BASE', label: 'Zone 2 Basis & Puls senken', desc: 'Puls bei Belastung stabil niedrig halten lernen' },
    ],
  },
  {
    id: 'SPEED_IMPROVE' as const,
    title: 'Schneller werden',
    subtitle: 'Pace verbessern & Bestzeit angreifen',
    icon: Zap,
    color: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
    activeBg: 'bg-amber-500 text-white border-amber-400 shadow-amber-500/20',
    presets: [
      { id: '5K_MINUS_1', label: '1 Minute schneller auf 5 km', desc: 'Spezifisches Tempo- & Schwellentraining' },
      { id: '10K_MINUS_2', label: '2 Minuten schneller auf 10 km', desc: 'Tempohärte & Schwellen-Pace steigern' },
      { id: '5K_SUB_25', label: '5 km Sub 25 Min (< 5:00 min/km)', desc: 'Die 5-Minuten-Pace-Grenze knacken' },
      { id: '10K_SUB_50', label: '10 km Sub 50 Min (< 5:00 min/km)', desc: 'Die magische 50-Minuten-Marke erreichen' },
      { id: 'CUSTOM_SPEED', label: 'Individuelles Zeitziel', desc: 'Eigene Zielzeit oder Pace festlegen' },
    ],
  },
  {
    id: 'WEIGHT_LOSS' as const,
    title: 'Gewicht & Fettstoffwechsel',
    subtitle: 'Fettverbrennung aktivieren & Kilos verlieren',
    icon: Flame,
    color: 'border-orange-500/30 text-orange-400 bg-orange-500/10',
    activeBg: 'bg-orange-500 text-white border-orange-400 shadow-orange-500/20',
    presets: [
      { id: 'FAT_BURN_ZONE2', label: 'Optimale Fettverbrennung', desc: 'Fokus auf maximale Fettoxidation in Zone 2' },
      { id: 'BODY_TONING', label: 'Stoffwechsel-Kick & Tonus', desc: 'Zone 2 + kurze Steigerungen für Nachbrenneffekt' },
      { id: 'HEALTH_RESTART', label: 'Gesunder Gewichtsneustart', desc: 'Gelenkschonender Aufbau mit hoher Kontinuität' },
    ],
  },
  {
    id: 'ROUTINE' as const,
    title: 'Routine & Wohlbefinden',
    subtitle: 'Gewohnheit festigen & Stress abbauen',
    icon: Sparkles,
    color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
    activeBg: 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/20',
    presets: [
      { id: 'HABIT_3X', label: 'Verlässliche Laufroutine', desc: '2–3 Einheiten pro Woche fest im Alltag verankern' },
      { id: 'RETURN_RUN', label: 'Sanfter Wiedereinstieg', desc: 'Nach Pause oder Verletzung behutsam zurück' },
      { id: 'STRESS_RELIEF', label: 'Stressabbau & Kopf frei', desc: 'Reines Wohlfühltempo ohne jeglichen Leistungsdruck' },
    ],
  },
  {
    id: 'DISTANCE' as const,
    title: 'Wettkampf & Distanz',
    subtitle: '5k, 10k, Halbmarathon oder Marathon',
    icon: Trophy,
    color: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10',
    activeBg: 'bg-cyan-500 text-white border-cyan-400 shadow-cyan-500/20',
    presets: [
      { id: '5K', label: '5 km Meilenstein', desc: 'Vorbereitung auf 5 km Volkslauf oder Finishen' },
      { id: '10K', label: '10 km Meilenstein', desc: 'Klassische 10-Kilometer-Vorbereitung' },
      { id: 'HALF_MARATHON', label: 'Halbmarathon (21,1 km)', desc: 'Gezielte 12-Wochen-Vorbereitung auf den Halbmarathon' },
      { id: 'MARATHON', label: 'Marathon (42,2 km)', desc: 'Umfangreiche 16-Wochen-Marathonvorbereitung' },
    ],
  },
];

export function getGoalBadgeInfo(goalType: string) {
  switch (goalType) {
    case 'FITNESS_BUILD':
      return {
        label: 'Kondition & Ausdauer',
        icon: Heart,
        color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      };
    case 'SPEED_IMPROVE':
      return {
        label: 'Schnelligkeit & Pace',
        icon: Zap,
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      };
    case 'WEIGHT_LOSS':
      return {
        label: 'Gewicht & Fettstoffwechsel',
        icon: Flame,
        color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
      };
    case 'ROUTINE':
      return {
        label: 'Laufroutine & Wohlbefinden',
        icon: Sparkles,
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      };
    case '5K':
      return {
        label: '5 km Distanz',
        icon: Target,
        color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      };
    case '10K':
      return {
        label: '10 km Distanz',
        icon: Target,
        color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      };
    case 'HALF_MARATHON':
      return {
        label: 'Halbmarathon',
        icon: Trophy,
        color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
      };
    case 'MARATHON':
      return {
        label: 'Marathon',
        icon: Trophy,
        color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      };
    default:
      return {
        label: goalType,
        icon: Activity,
        color: 'text-zinc-400 bg-zinc-800 border-zinc-700',
      };
  }
}

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
  isFlexible?: boolean;
  recommendedTiming?: string | null;
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
  generationPrompt?: string | null;
  weeks: Week[];
}

interface HealthMetricItem {
  id: string;
  date: string;
  weightKg?: number | null;
  restingHeartrate?: number | null;
  notes?: string | null;
}

interface ProfileData {
  calculatedVdot: number;
  calculatedMaxHr: number;
  profile?: {
    weightKg?: number | null;
    restingHeartrate?: number | null;
    preferredLongRunDay?: number | null;
    includeSundayRun?: boolean;
  } | null;
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
  const [metricsHistory, setMetricsHistory] = useState<HealthMetricItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'plan' | 'metrics' | 'philosophy' | 'new-plan'>('plan');

  // Generator form state
  const [goalCategory, setGoalCategory] = useState<'FITNESS_BUILD' | 'SPEED_IMPROVE' | 'WEIGHT_LOSS' | 'ROUTINE' | 'DISTANCE'>('FITNESS_BUILD');
  const [goalSubtype, setGoalSubtype] = useState('RUN_30_MIN');
  const [customGoalNote, setCustomGoalNote] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [weeklyDays, setWeeklyDays] = useState(3);
  const [longRunDay, setLongRunDay] = useState<number>(-1); // -1 = Flexibel nach Wetter/Tagesform
  const [includeSundayRun, setIncludeSundayRun] = useState(true);
  const [weightKg, setWeightKg] = useState('');
  const [restingHr, setRestingHr] = useState('');
  const [generationsToday, setGenerationsToday] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(5);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Quick Health Log State
  const [newWeight, setNewWeight] = useState('');
  const [newRestingHr, setNewRestingHr] = useState('');
  const [newMetricNotes, setNewMetricNotes] = useState('');
  const [savingMetric, setSavingMetric] = useState(false);
  const [metricSavedToast, setMetricSavedToast] = useState(false);

  const loadData = React.useCallback(async () => {
    try {
      const [planRes, profileRes, metricsRes] = await Promise.all([
        fetch('/api/coach/plan'),
        fetch('/api/coach/profile'),
        fetch('/api/coach/metrics'),
      ]);

      if (planRes.ok) {
        const pData = await planRes.json();
        setPlan(pData.plan);
        if (typeof pData.generationsToday === 'number') {
          setGenerationsToday(pData.generationsToday);
        }
        if (typeof pData.dailyLimit === 'number') {
          setDailyLimit(pData.dailyLimit);
        }
        if (pData.plan?.status === 'QUEUED' || pData.plan?.status === 'PROCESSING') {
          setGenerating(true);
        } else {
          setGenerating(false);
        }
      }

      if (profileRes.ok) {
        const prData = await profileRes.json();
        setProfileData(prData);
        if (prData.profile?.weightKg) setWeightKg(String(prData.profile.weightKg));
        if (prData.profile?.restingHeartrate) setRestingHr(String(prData.profile.restingHeartrate));
      }

      if (metricsRes.ok) {
        const mData = await metricsRes.json();
        setMetricsHistory(mData.metrics || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch plan & profile
  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Poll while generating
  useEffect(() => {
    if (!generating) return;
    const interval = setInterval(async () => {
      const res = await fetch('/api/coach/plan');
      if (res.ok) {
        const data = await res.json();
        if (typeof data.generationsToday === 'number') {
          setGenerationsToday(data.generationsToday);
        }
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
    setGenerationError(null);
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
            includeSundayRun,
          }),
        });
      }

      const selectedCategory = GOAL_CATEGORIES.find((c) => c.id === goalCategory);
      const selectedPreset = selectedCategory?.presets.find((p) => p.id === goalSubtype);

      const finalGoalType = goalCategory === 'DISTANCE' ? goalSubtype : goalCategory;
      const planTitle = customGoalNote.trim()
        ? `${selectedCategory?.title}: ${customGoalNote.trim()}`
        : `${selectedCategory?.title} (${selectedPreset?.label || ''})`;

      const goalDescription = customGoalNote.trim() || selectedPreset?.label;

      let targetDistance: number | undefined = undefined;
      if (goalCategory === 'DISTANCE') {
        if (goalSubtype === '5K') targetDistance = 5;
        else if (goalSubtype === '10K') targetDistance = 10;
        else if (goalSubtype === 'HALF_MARATHON') targetDistance = 21.1;
        else if (goalSubtype === 'MARATHON') targetDistance = 42.195;
      } else if (goalSubtype === '5K_MINUS_1' || goalSubtype === '5K_SUB_25') {
        targetDistance = 5;
      } else if (goalSubtype === '10K_MINUS_2' || goalSubtype === '10K_SUB_50') {
        targetDistance = 10;
      }

      // Trigger plan generation via Inngest & xAI
      const res = await fetch('/api/coach/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: planTitle,
          goalType: finalGoalType,
          goalSubtype,
          goalDescription,
          targetDistance,
          targetDate: targetDate || undefined,
          weeklyAvailability: weeklyDays,
          preferredLongRunDay: longRunDay,
          includeSundayRun,
        }),
      });

      if (res.ok) {
        await loadData();
      } else {
        const errData = await res.json().catch(() => ({}));
        setGenerationError(errData.error || 'Fehler beim Erstellen des Trainingsplans.');
        if (typeof errData.generationsToday === 'number') {
          setGenerationsToday(errData.generationsToday);
        }
        setGenerating(false);
      }
    } catch (err) {
      console.error(err);
      setGenerationError('Netzwerkfehler beim Erstellen des Trainingsplans.');
      setGenerating(false);
    }
  };

  const handleSaveHealthMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWeight && !newRestingHr) return;

    setSavingMetric(true);
    try {
      const res = await fetch('/api/coach/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weightKg: newWeight ? Number(newWeight) : undefined,
          restingHeartrate: newRestingHr ? Number(newRestingHr) : undefined,
          notes: newMetricNotes || undefined,
        }),
      });

      if (res.ok) {
        setNewWeight('');
        setNewRestingHr('');
        setNewMetricNotes('');
        setMetricSavedToast(true);
        setTimeout(() => setMetricSavedToast(false), 3000);
        await loadData();
      }
    } catch (err) {
      console.error('Error logging metric:', err);
    } finally {
      setSavingMetric(false);
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
            <span>Sportwissenschaftlich fundiert &amp; KI-gestützt</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
            DorfDüsen Smart Coach
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Personalisierte, flexible Trainingspläne nach VDOT, 80/20-Polarisierung und physiologischer Periodisierung.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex flex-wrap items-center gap-2 bg-zinc-900 border border-zinc-800 p-1 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setActiveTab('plan')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'plan'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Trainingsplan
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'metrics'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Physiologie &amp; Zonen
          </button>
          <button
            onClick={() => setActiveTab('philosophy')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'philosophy'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Trainingsphilosophie
          </button>
          <button
            onClick={() => setActiveTab('new-plan')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
            <h4 className="font-bold text-white text-base">Dein Trainingsplan wird berechnet...</h4>
            <p className="text-xs text-zinc-400">
              Strava-Baseline wird analysiert, Periodisierungsphasen werden berechnet und maßgeschneiderte Workouts generiert.
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
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 fill-orange-400" />
                    Heutige Mission
                  </span>
                  {todayWorkout.isFlexible && (
                    <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[11px] font-semibold border border-zinc-700">
                      Flexibel nach Tagesform
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-zinc-400">
                  {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
                </span>
              </div>

              <div className="space-y-2 max-w-2xl">
                <h3 className="text-2xl sm:text-3xl font-black text-white">{todayWorkout.title}</h3>
                <p className="text-sm text-zinc-300 leading-relaxed">{todayWorkout.description}</p>
                {todayWorkout.recommendedTiming && (
                  <p className="text-xs text-orange-400/90 font-medium">
                    Zeitfenster: {todayWorkout.recommendedTiming}
                  </p>
                )}
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
                  <strong className="block mb-1 text-orange-400">Coach Feedback &amp; Analyse:</strong>
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
                  <h4 className="font-bold text-white">Heute steht kein festes Workout an</h4>
                  <p className="text-xs text-zinc-400">
                    Wähle eine Einheit aus deinem Wochenpool oder gönn dir einen wohlverdienten Ruhetag.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Plan overview & Weeks list */}
          {plan ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800">
                <div className="space-y-1">
                  {(() => {
                    const badge = getGoalBadgeInfo(plan.goalType);
                    const Icon = badge.icon;
                    return (
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold border ${badge.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          <span>{badge.label}</span>
                        </span>
                        {plan.generationPrompt && (
                          <span className="text-xs text-zinc-300 bg-zinc-800/80 px-2.5 py-0.5 rounded-full border border-zinc-700/60 font-medium">
                            {plan.generationPrompt}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  <h2 className="text-xl sm:text-2xl font-black text-white">{plan.title}</h2>
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

                    {/* Workouts Grid (Weekly Missions Pool) */}
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
                                : w.workoutType === 'LONGRUN'
                                ? 'bg-orange-950/20 border-orange-500/40 shadow-sm shadow-orange-500/5'
                                : isSunday
                                ? 'bg-orange-950/10 border-orange-500/20'
                                : 'bg-zinc-950/60 border-zinc-800/80'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-zinc-300 truncate">
                                {w.recommendedTiming || date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {w.isFlexible && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-zinc-800 text-zinc-400">
                                    Flexibel
                                  </span>
                                )}
                                <span
                                  className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                                    w.workoutType === 'LONGRUN'
                                      ? 'bg-orange-500/20 text-orange-400'
                                      : w.workoutType === 'TEMPO'
                                      ? 'bg-amber-500/20 text-amber-400'
                                      : w.workoutType === 'INTERVAL'
                                      ? 'bg-rose-500/20 text-rose-400'
                                      : 'bg-zinc-800 text-zinc-300'
                                  }`}
                                >
                                  {w.workoutType}
                                </span>
                              </div>
                            </div>

                            <h5 className="font-bold text-white text-sm line-clamp-1">{w.title}</h5>
                            <p className="text-zinc-400 line-clamp-2">{w.description}</p>

                            <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] font-semibold">
                              <span className="text-white font-bold">{w.targetDistance ? `${w.targetDistance} km` : '-'}</span>
                              <span className="text-orange-400">{w.targetPaceMin ? `${w.targetPaceMin} - ${w.targetPaceMax}` : 'Easy'}</span>
                              <span className="text-emerald-400">Z{w.targetHrZone || 2}</span>
                              <span className="text-zinc-400">
                                {w.status === 'COMPLETED' ? '✅' : '⏳'}
                              </span>
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
                Erstelle jetzt deinen ersten personalisierten Plan mit flexiblen Wochen-Missionen.
              </p>
              <button
                onClick={() => setActiveTab('new-plan')}
                className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-white text-sm transition-all shadow-lg shadow-orange-500/20 inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Plan jetzt erstellen</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PHYSIOLOGY & HEALTH METRICS */}
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

          {/* NEW SECTION: HISTORICAL HEALTH METRICS TRACKER */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-orange-400" />
                  <h3 className="text-xl font-black text-white">Körperdaten & Vital-Tracking</h3>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Tracke dein Gewicht und deinen Ruhepuls historisch. Hält deinen VDOT und die Pulszonen aktuell.
                </p>
              </div>

              {/* Quick Entry Form */}
              <form onSubmit={handleSaveHealthMetric} className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  placeholder="Gewicht (kg)"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  className="w-28 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                />
                <input
                  type="number"
                  placeholder="Ruhepuls (bpm)"
                  value={newRestingHr}
                  onChange={(e) => setNewRestingHr(e.target.value)}
                  className="w-28 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                />
                <input
                  type="text"
                  placeholder="Notiz (optional)"
                  value={newMetricNotes}
                  onChange={(e) => setNewMetricNotes(e.target.value)}
                  className="w-36 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 hidden md:block"
                />
                <button
                  type="submit"
                  disabled={savingMetric || (!newWeight && !newRestingHr)}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-xs text-white transition-all shadow-md shadow-orange-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {savingMetric ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Eintragen</span>
                </button>
              </form>
            </div>

            {metricSavedToast && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Messwert erfolgreich gespeichert und Trainingszonen synchronisiert!</span>
              </div>
            )}

            {/* Metrics History Cards & Table */}
            {metricsHistory.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] font-bold uppercase text-zinc-500 block">Neuestes Gewicht</span>
                    <span className="text-lg font-black text-white">
                      {metricsHistory[0].weightKg ? `${metricsHistory[0].weightKg} kg` : '-'}
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">
                      {new Date(metricsHistory[0].date).toLocaleDateString('de-DE')}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] font-bold uppercase text-zinc-500 block">Neuester Ruhepuls</span>
                    <span className="text-lg font-black text-rose-400">
                      {metricsHistory[0].restingHeartrate ? `${metricsHistory[0].restingHeartrate} bpm` : '-'}
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">
                      {new Date(metricsHistory[0].date).toLocaleDateString('de-DE')}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold uppercase text-zinc-500 block">Erfasste Einträge</span>
                    <span className="text-lg font-black text-orange-400">{metricsHistory.length}</span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">Messpunkte in Historie</span>
                  </div>
                </div>

                {/* History Table */}
                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800 sticky top-0">
                        <tr>
                          <th className="p-2.5 font-bold">Datum</th>
                          <th className="p-2.5 font-bold">Gewicht</th>
                          <th className="p-2.5 font-bold">Ruhepuls</th>
                          <th className="p-2.5 font-bold">Notiz</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/30">
                        {metricsHistory.slice(0, 15).map((m) => (
                          <tr key={m.id} className="hover:bg-zinc-900/40 transition-colors">
                            <td className="p-2.5 text-zinc-300 font-medium">
                              {new Date(m.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </td>
                            <td className="p-2.5 font-bold text-white">
                              {m.weightKg ? `${m.weightKg} kg` : '-'}
                            </td>
                            <td className="p-2.5 font-bold text-rose-400">
                              {m.restingHeartrate ? `${m.restingHeartrate} bpm` : '-'}
                            </td>
                            <td className="p-2.5 text-zinc-400 italic">
                              {m.notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 text-center space-y-2">
                <Info className="w-6 h-6 text-zinc-500 mx-auto" />
                <p className="text-xs text-zinc-400">
                  Noch keine manuellen Messwerte eingetragen. Nutze das Formular oben, um dein Gewicht oder deinen Ruhepuls festzuhalten.
                </p>
              </div>
            )}
          </div>

          {/* Daniels Pace Calculator Results */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-xl font-black text-white">Deine individuellen Trainings-Paces</h3>
              <p className="text-xs text-zinc-400">
                Berechnet nach Jack Daniels VDOT-Tabellen basierend auf deinem aktuellen Leistungsniveau.
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

      {/* TAB 3: TRAINING PHILOSOPHY & SPORTS SCIENCE */}
      {activeTab === 'philosophy' && (
        <div className="space-y-8">
          {/* Hero Banner */}
          <div className="rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-950 border border-orange-500/30 p-6 sm:p-10 relative overflow-hidden shadow-2xl space-y-4">
            <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5" />
              <span>DorfDüsen Trainingslehre</span>
            </div>

            <div className="space-y-3 max-w-3xl">
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                Laufen mit Köpfchen: Warum langsam laufen schnell macht
              </h2>
              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
                Viele Läufer verfallen in dieselbe Falle: Jedes Training wird im gleichen, anstrengenden Mitteltempo gelaufen. Das Ergebnis sind Stagnation, chronische Müdigkeit oder Überlastungsverletzungen. Unsere Trainingspläne basieren auf moderner Sportwissenschaft (Stephen Seiler, Jack Daniels und Hans van Dijk) – für maximalen Leistungszuwachs bei minimalem Verletzungsrisiko.
              </p>
            </div>

            {/* Quick Summary Pill Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-zinc-800/80">
              <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
                <span className="text-[11px] font-bold uppercase text-orange-400 block">80/20 Prinzip</span>
                <span className="text-sm font-black text-white">Polarisiertes Training</span>
              </div>
              <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
                <span className="text-[11px] font-bold uppercase text-emerald-400 block">Jack Daniels</span>
                <span className="text-sm font-black text-white">VDOT-Pacezonen</span>
              </div>
              <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
                <span className="text-[11px] font-bold uppercase text-cyan-400 block">Periodisierung</span>
                <span className="text-sm font-black text-white">Phasen &amp; Deloads</span>
              </div>
              <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
                <span className="text-[11px] font-bold uppercase text-purple-400 block">Community</span>
                <span className="text-sm font-black text-white">Sonntagsrunde als Anker</span>
              </div>
            </div>
          </div>

          {/* Section 1: 80/20 & Polarized Training */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase text-orange-400 tracking-wider">Säule 1</span>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                  Das 80/20-Prinzip: Polarisiertes Training
                </h3>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 self-start sm:self-auto border border-zinc-700/60">
                Nach Dr. Stephen Seiler &amp; Matt Fitzgerald
              </span>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed">
              Studien mit Weltklasse-Athleten zeigen ein klares Bild: Die erfolgreichsten Ausdauersportler trainieren nicht einfach härter, sondern polarisierter. Rund 80 % der gesamten Laufkilometer werden bei sehr niedriger Intensität (Zone 2) gelaufen, während nur ca. 20 % in gezielten Schwellenläufen oder Intervallen stattfinden.
            </p>

            {/* Visual Ratio Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-emerald-400">80 % Grundlagenausdauer (Zone 2 / Aerob)</span>
                <span className="text-orange-400">20 % Qualität &amp; Tempo (Zone 4 &amp; 5)</span>
              </div>
              <div className="h-4 w-full bg-zinc-950 rounded-full overflow-hidden flex border border-zinc-800">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 w-[80%]" title="80% Aerob" />
                <div className="h-full bg-gradient-to-r from-orange-500 to-rose-500 w-[20%]" title="20% Schwellen &amp; Intervalle" />
              </div>
            </div>

            {/* 3 Physiological Mechanisms */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-5 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <Zap className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-white text-base">Mitochondrien-Biogenese</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Mitochondrien sind die „Kraftwerke“ deiner Muskelzellen. Neue Mitochondrien entstehen fast ausschließlich bei niedriger Laktatkonzentration (Zone 2). Mehr Mitochondrien bedeuten mehr aerobe Energie bei gleicher Anstrengung.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Flame className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-white text-base">Fettstoffwechsel-Ökonomie</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Lockere Dauerläufe trainieren deinen Körper, Fett als primären Treibstoff zu verbrennen. Dadurch schonst du die begrenzten Glykogenspeicher – der gefürchtete „Mann mit dem Hammer“ bei Kilometer 30 bleibt aus.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-2">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                  <BatteryCharging className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-white text-base">Vegetatives Nervensystem</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Zone 2 überlastet weder das Nervensystem noch schüttet sie übermäßig Stresshormone (Cortisol) aus. Das hält dich frisch, gesund und lässt dich die 20 % harten Einheiten mit voller Qualität durchziehen.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: VDOT & Daniels Pace System */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase text-orange-400 tracking-wider">Säule 2</span>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                  Jack Daniels’ VDOT: Dein physiologischer Fingerabdruck
                </h3>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 self-start sm:self-auto border border-zinc-700/60">
                Daniels’ Running Formula
              </span>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed">
              Es gibt kein universelles Tempo wie „ein Intervall muss 4:30 min/km sein“. Dein optimaler Trainingsreiz hängt von deiner aktuellen aeroben Leistungsfähigkeit ab. Der VDOT-Wert verbindet deine maximale Sauerstoffaufnahme (VO2max) mit deiner individuellen Laufökonomie.
            </p>

            <div className="space-y-3">
              {[
                {
                  code: 'E',
                  name: 'Easy Pace (Zone 2)',
                  badge: 'Grundlagenausdauer I',
                  color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
                  desc: 'Entspanntes Wohlfühltempo, bei dem du problemlos in ganzen Sätzen sprechen kannst. Dient dem aeroben Kapillarenaufbau, der Regeneration und macht ca. 80% des Plans aus.',
                },
                {
                  code: 'M',
                  name: 'Marathon Pace (Zone 3)',
                  badge: 'Dauerlauf zügig',
                  color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
                  desc: 'Gleichmäßiges, zügiges Tempo. Gewöhnt Kopf und Beine an das spezifische Renntempo für Halbmarathon und Marathon.',
                },
                {
                  code: 'T',
                  name: 'Threshold / Schwellen-Pace (Zone 4)',
                  badge: 'Laktatschwelle (ca. 88-92% HFmax)',
                  color: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
                  desc: 'Das Tempo am Laktat-Gleichgewicht (Steady State): Dein Körper produziert genauso viel Laktat wie er zeitgleich abbauen kann. Verschiebt deine anaerobe Schwelle spürbar nach oben.',
                },
                {
                  code: 'I',
                  name: 'Interval Pace (Zone 5)',
                  badge: 'VO2max (95-100% HFmax)',
                  color: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
                  desc: 'Harte 3- bis 5-minütige Belastungen mit Trabpausen. Fordert die maximale Sauerstoffaufnahmekapazität und vergrößert das Schlagvolumen des Herzens.',
                },
                {
                  code: 'R',
                  name: 'Repetition Pace (Zone 5+)',
                  badge: 'Schnelligkeit & Ökonomie',
                  color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
                  desc: 'Kurze Abschnitte (200m bis 400m) mit voller Erholungspause. Verbessert Schrittfrequenz, Lauftechnik und neuromuskuläre Koordination ohne anaerobe Übersäuerung.',
                },
              ].map((item) => (
                <div
                  key={item.code}
                  className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <span className={`w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center shrink-0 border ${item.color}`}>
                      {item.code}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-white text-sm">{item.name}</h4>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Periodization & Deloads */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase text-orange-400 tracking-wider">Säule 3</span>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                  Periodisierung: Anpassung entsteht in den Pausen
                </h3>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 self-start sm:self-auto border border-zinc-700/60">
                Superkompensation &amp; Belastungssteuerung
              </span>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed">
              Ein Trainingsplan ist kein starrer Countdown, sondern folgt den biologischen Zyklen menschlicher Anpassung. Der Körper wird im Training nicht stärker – er wird ermüdet. Stärker wird er erst in der Erholungsphase, wenn die Superkompensation greift.
            </p>

            {/* 4 Phases Timeline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-black flex items-center justify-center">1</span>
                <h4 className="font-bold text-white text-sm">Base-Phase</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Aufbau des aeroben Fundaments. Anpassung von Sehnen, Bändern und Knochenstruktur an die steigenden Kilometer.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-black flex items-center justify-center">2</span>
                <h4 className="font-bold text-white text-sm">Build-Phase</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Steigerung der Tempohärte. Schwellenläufe und Tempodauerläufe heben die Laktattoleranz an.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-black flex items-center justify-center">3</span>
                <h4 className="font-bold text-white text-sm">Peak-Phase</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Höchste wettkampfspezifische Belastung. Zielpace-Intervalle und finale lange Vorbereitungsläufe.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-black flex items-center justify-center">4</span>
                <h4 className="font-bold text-white text-sm">Taper-Phase</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Umfangsreduktion um 40–50% bei kurzen Aktivierungsreizen. Volle Glykogenspeicher und frische Beine am Start.
                </p>
              </div>
            </div>

            {/* Deload Box */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/30 to-zinc-950 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">Die Deload-Woche (Jede 4. Woche)</h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Jede vierte Woche wird das Volumen gezielt um ca. 25 % gesenkt. Das schützt dein Immunsystem, beugt Übertraining vor und gibt dem Bindegewebe Zeit zur Mikrozell-Reparatur. Nach der Deload-Woche startest du mit messbar höherer Leistungsfähigkeit in den nächsten Block.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Injury Prevention & Community */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ACWR & Load safety */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-white">
                Verletzungsprävention &amp; ACWR
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                Der häufigste Grund für Verletzungen (wie Shin Splints oder Läuferknie) ist eine zu schnelle Steigerung des Laufvolumens.
              </p>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold mt-0.5">•</span>
                  <span><strong>10%-Regel:</strong> Wochenkilometer steigen maximal um 7–10% pro Belastungswoche.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold mt-0.5">•</span>
                  <span><strong>Acute:Chronic Workload:</strong> Das Verhältnis der letzten 7 Tage zum Monatsdurchschnitt bleibt im optimalen Sweet Spot (0.8 – 1.3).</span>
                </li>
              </ul>
            </div>

            {/* Sunday Run Community Anchor */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center border border-orange-500/20">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-white">
                Der Sonntagslauf als Long-Run-Anker
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                Der sonntägliche Vereinstreff in Nordheim (10:00 Uhr) ist das soziale Herzstück der DorfDüsen und fest im Trainingsplan verankert.
              </p>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 font-bold mt-0.5">•</span>
                  <span><strong>Gemeinsamer Long Run:</strong> Der lange aerobe Lauf fällt in der Gruppe mental um ein Vielfaches leichter.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 font-bold mt-0.5">•</span>
                  <span><strong>Kein Leistungsdruck:</strong> Das Tempo wird flexibel der Gruppe angepasst – niemand läuft alleine zurück.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GENERATE NEW PLAN WIZARD */}
      {activeTab === 'new-plan' && (
        <div className="max-w-2xl mx-auto bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase text-orange-400 tracking-wider">
                Konfiguration &amp; Individualisierung
              </span>
              <span
                className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-all ${
                  generationsToday >= dailyLimit
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    : generationsToday >= dailyLimit - 1
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}
              >
                ⚡ {generationsToday}/{dailyLimit} Plangenerierungen heute
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Neuen Trainingsplan erstellen
            </h2>
            <p className="text-sm text-zinc-400">
              Wähle dein Ziel. Der Coach berechnet deine physiologische Periodisierung, Schwellenpaces und deinen maßgeschneiderten Wochenplan.
            </p>
          </div>

          {generationError && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-rose-200 block text-sm">Hinweis zur Plangenerierung</span>
                <p className="leading-relaxed">{generationError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleCreatePlan} className="space-y-6">
            {/* Goal selection: 2 Steps (Category -> Presets & Custom note) */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-zinc-300 block mb-1">
                  1. Was ist dein Hauptfokus?
                </label>
                <p className="text-xs text-zinc-400">
                  Wähle deinen Trainingsschwerpunkt. Der Coach stimmt Periodisierung und Einheiten darauf ab.
                </p>
              </div>

              {/* 5 Categories Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {GOAL_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = goalCategory === cat.id;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setGoalCategory(cat.id);
                        setGoalSubtype(cat.presets[0].id);
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                        isSelected
                          ? `${cat.activeBg} shadow-lg ring-1 ring-white/20`
                          : 'bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : `${cat.color}`
                        }`}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                          {cat.title}
                        </span>
                      </div>
                      <p className={`text-[11px] leading-snug line-clamp-2 ${isSelected ? 'text-white/80' : 'text-zinc-500'}`}>
                        {cat.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Presets & Fine-tuning for the active category */}
              {(() => {
                const activeCat = GOAL_CATEGORIES.find((c) => c.id === goalCategory);
                if (!activeCat) return null;

                return (
                  <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase text-zinc-300 block">
                        2. Konkretes Ziel für „{activeCat.title}“
                      </label>
                      <span className="text-[11px] text-zinc-500 font-medium">Preset oder Feintuning</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeCat.presets.map((preset) => {
                        const isPresetSelected = goalSubtype === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setGoalSubtype(preset.id)}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              isPresetSelected
                                ? 'bg-orange-500/15 border-orange-500 text-white shadow-sm'
                                : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-xs font-bold ${isPresetSelected ? 'text-orange-400' : 'text-zinc-200'}`}>
                                {preset.label}
                              </span>
                              {isPresetSelected && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{preset.desc}</p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Optional custom note / exact target time */}
                    <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-400 flex items-center justify-between">
                        <span>Individuelles Detail / Wunsch (Optional)</span>
                        <span className="text-[10px] text-zinc-500">z. B. „1 Min schneller“, „Puls unter 140“</span>
                      </label>
                      <input
                        type="text"
                        value={customGoalNote}
                        onChange={(e) => setCustomGoalNote(e.target.value)}
                        placeholder={
                          goalCategory === 'SPEED_IMPROVE'
                            ? "z. B. 'Ziel: 5 km in 24:30 min (aktuell 25:40)'"
                            : goalCategory === 'FITNESS_BUILD'
                            ? "z. B. 'Schaffe 2 km, möchte 45 Min am Stück schaffen'"
                            : goalCategory === 'WEIGHT_LOSS'
                            ? "z. B. '3-4 kg abnehmen, maximal gelenkschonend'"
                            : "z. B. 'Laufschuhe wieder regelmäßig 2-3x pro Woche schnüren'"
                        }
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition-colors"
                      />
                    </div>
                  </div>
                );
              })()}
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

            {/* Flexible Long Run Day Option */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-300 block">
                Langer Lauf (Long Run) Präferenz
              </label>
              <select
                value={longRunDay}
                onChange={(e) => setLongRunDay(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
              >
                <option value={-1}>🌟 Flexibel nach Wetter & Tagesform (Empfohlen)</option>
                <option value={0}>Sonntag (Fester Tag)</option>
                <option value={6}>Samstag (Fester Tag)</option>
                <option value={5}>Freitag (Fester Tag)</option>
                <option value={4}>Donnerstag (Fester Tag)</option>
                <option value={3}>Mittwoch (Fester Tag)</option>
                <option value={2}>Dienstag (Fester Tag)</option>
                <option value={1}>Montag (Fester Tag)</option>
              </select>
              <p className="text-[11px] text-zinc-500">
                Bei flexibler Wahl absolvierst du den Long Run, wann es dir am besten passt. Inngest matcht ihn automatisch an deinen Strava-Lauf.
              </p>
            </div>

            {/* Sunday Club Run Toggle */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800">
              <input
                type="checkbox"
                id="includeSundayRun"
                checked={includeSundayRun}
                onChange={(e) => setIncludeSundayRun(e.target.checked)}
                className="mt-1 w-4 h-4 accent-orange-500 rounded cursor-pointer"
              />
              <label htmlFor="includeSundayRun" className="text-xs text-zinc-300 cursor-pointer">
                <span className="font-bold text-white block">DorfDüsen Sunday Run (5 km) fest einplanen</span>
                Reserviert sonntags einen lockeren 5-km-Community-Lauf in Zone 2 im Wochenplan.
              </label>
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

            {(() => {
              const isLimitReached = generationsToday >= dailyLimit;
              return (
                <button
                  type="submit"
                  disabled={generating || isLimitReached}
                  className={`w-full py-4 rounded-xl font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-2 group cursor-pointer ${
                    isLimitReached
                      ? 'bg-zinc-800 border border-zinc-700/80 text-zinc-500 cursor-not-allowed shadow-none'
                      : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20 disabled:opacity-50'
                  }`}
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Wird generiert...</span>
                    </>
                  ) : isLimitReached ? (
                    <>
                      <AlertCircle className="w-5 h-5 text-zinc-500" />
                      <span>Tageslimit erreicht (max. {dailyLimit} Pläne/Tag) – Morgen wieder verfügbar</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      <span>Plan jetzt generieren ({Math.max(0, dailyLimit - generationsToday)} von {dailyLimit} heute übrig)</span>
                    </>
                  )}
                </button>
              );
            })()}
          </form>
        </div>
      )}
    </div>
  );
}
