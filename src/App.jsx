import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Flame, Zap, Trophy, Dumbbell, ChevronRight, ChevronLeft, Check,
  Loader2, RotateCcw, Settings, X, Heart, Moon, Sparkles, Salad,
} from 'lucide-react';

/* ----------------------------- design tokens ----------------------------- */

const C = {
  bg: '#090c16',
  bgGrid: '#0d1120',
  panel: '#11152a',
  panel2: '#161b35',
  border: '#262c4d',
  borderBright: '#3a4270',
  cyan: '#4fe3ff',
  cyanDim: '#1c5c6b',
  violet: '#9b7bff',
  amber: '#ffb84f',
  danger: '#ff4d6d',
  text: '#e8ecfb',
  muted: '#717898',
  faint: '#454c70',
};

const FONTS = "@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');";

const STAT_META = {
  STR: { label: 'STR', icon: Dumbbell, color: C.cyan },
  END: { label: 'END', icon: Flame, color: C.amber },
  AGI: { label: 'AGI', icon: Zap, color: C.violet },
  VIT: { label: 'VIT', icon: Heart, color: C.danger },
};

/* ------------------------------- game rules ------------------------------ */

const RANKS = [
  { name: 'F', min: 1 }, { name: 'E', min: 5 }, { name: 'D', min: 10 },
  { name: 'C', min: 15 }, { name: 'B', min: 20 }, { name: 'A', min: 25 },
  { name: 'S', min: 30 }, { name: 'NATIONAL', min: 40 },
];
const getRank = (level) => RANKS.reduce((acc, r) => (level >= r.min ? r.name : acc), 'F');
const xpForLevel = (level) => 100 + (level - 1) * 40;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const todayStr = () => new Date().toISOString().slice(0, 10);
const todayWeekday = () => WEEKDAYS[new Date().getDay()];
const yesterdayStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };

const defaultProfile = () => ({
  level: 1, xp: 0, totalXp: 0, streak: 0, lastActiveDate: null,
  stats: { STR: 1, END: 1, AGI: 1, VIT: 1 }, totalWorkouts: 0, title: 'Unawakened',
});

/* ------------------------------- storage io -------------------------------
   Real browser storage (localStorage). Synchronous, but wrapped defensively
   in case storage is unavailable (private browsing, quota, etc). */

function storeGet(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}
function storeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('storage set failed', e);
  }
}
function storeDelete(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

/* --------------------------- onboarding questions -------------------------- */

const QUESTIONS = [
  { key: 'goal', label: 'What is your objective?', type: 'select', options: ['Build Muscle', 'Lose Fat', 'Build Endurance', 'General Fitness'] },
  { key: 'level', label: 'Rate your combat experience.', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'] },
  { key: 'days', label: 'How many days a week can you train?', type: 'select', options: ['3', '4', '5', '6'] },
  { key: 'equipment', label: 'What equipment do you have?', type: 'select', options: ['None (Bodyweight)', 'Home (Dumbbells/Bands)', 'Full Gym'] },
  { key: 'diet', label: 'Any dietary restriction?', type: 'select', options: ['None', 'Vegetarian', 'Vegan', 'Halal', 'Dairy-Free'] },
  { key: 'age', label: 'State your age.', type: 'number', placeholder: 'e.g. 27' },
  { key: 'weight', label: 'State your weight (kg).', type: 'number', placeholder: 'e.g. 72' },
  { key: 'height', label: 'State your height (cm).', type: 'number', placeholder: 'e.g. 178' },
];

/* ------------------------------ plan generation -----------------------------
   The browser never talks to Anthropic directly (that would leak the API key).
   Instead it calls our own backend route, which is implemented in
   /api/generate-plan.js and holds the real key server-side. */

function fallbackPlan(a) {
  const days = Number(a.days) || 4;
  const bodyweight = a.equipment === 'None (Bodyweight)';
  const pool = [
    { n: 'Push-ups', s: 3, r: '12', cat: 'STR' },
    { n: bodyweight ? 'Bodyweight Squats' : 'Goblet Squats', s: 3, r: '15', cat: 'STR' },
    { n: 'Plank', s: 3, r: '45s', cat: 'VIT' },
    { n: bodyweight ? 'Lunges' : 'Dumbbell Lunges', s: 3, r: '12', cat: 'AGI' },
    { n: 'Jumping Jacks', s: 3, r: '40', cat: 'END' },
    { n: bodyweight ? 'Pike Push-ups' : 'Shoulder Press', s: 3, r: '10', cat: 'STR' },
    { n: 'Mountain Climbers', s: 3, r: '30s', cat: 'END' },
  ];
  const focuses = ['Upper Body', 'Lower Body', 'Full Body', 'Core & Mobility', 'Cardio'];
  const out = [];
  let trained = 0;
  WEEKDAYS.forEach((d, i) => {
    if (trained < days && i % 2 === (days >= 5 ? 0 : 1)) {
      out.push({ day: d, focus: focuses[trained % focuses.length], exercises: pool.slice(0, 4) });
      trained++;
    } else {
      out.push({ day: d, focus: 'Rest', exercises: [] });
    }
  });
  while (trained < days) {
    const idx = out.findIndex((d) => d.focus === 'Rest');
    if (idx === -1) break;
    out[idx] = { day: out[idx].day, focus: focuses[trained % focuses.length], exercises: pool.slice(0, 4) };
    trained++;
  }
  const w = Number(a.weight) || 70;
  const calories = Math.round(w * (a.goal === 'Lose Fat' ? 24 : a.goal === 'Build Muscle' ? 32 : 28));
  return {
    title: 'Awakened Striver',
    days: out,
    diet: {
      calories,
      protein: Math.round(w * 1.8),
      carbs: Math.round((calories * 0.4) / 4),
      fat: Math.round((calories * 0.25) / 9),
      meals: [
        { n: 'Breakfast', desc: 'Oats, eggs or plant protein, and fruit.', cal: Math.round(calories * 0.25) },
        { n: 'Lunch', desc: 'Lean protein, rice or grains, vegetables.', cal: Math.round(calories * 0.35) },
        { n: 'Dinner', desc: 'Protein, leafy greens, healthy fats.', cal: Math.round(calories * 0.3) },
        { n: 'Snack', desc: 'Yogurt, nuts, or a protein shake.', cal: Math.round(calories * 0.1) },
      ],
    },
  };
}

function safeParsePlan(text) {
  let clean = text.replace(/```json|```/g, '').trim();
  const first = clean.indexOf('{');
  const last = clean.lastIndexOf('}');
  if (first !== -1 && last !== -1) clean = clean.slice(first, last + 1);
  const parsed = JSON.parse(clean);
  if (!parsed.days || !Array.isArray(parsed.days) || !parsed.diet) throw new Error('shape mismatch');
  return parsed;
}

async function generatePlan(answers) {
  try {
    const res = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers),
    });
    if (!res.ok) throw new Error(`API responded ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return { plan: safeParsePlan(data.text), aiGenerated: true };
  } catch (e) {
    console.error('AI generation failed, using fallback', e);
    return { plan: fallbackPlan(answers), aiGenerated: false };
  }
}

/* ---------------------------------- app ----------------------------------- */

export default function App() {
  const [screen, setScreen] = useState('onboarding'); // onboarding | generating | dashboard
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [dayState, setDayState] = useState({ completed: {}, claimed: false });
  const [tab, setTab] = useState('quests');
  const [toast, setToast] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [genNote, setGenNote] = useState(null);

  useEffect(() => {
    const p = storeGet('arise:profile');
    const pl = storeGet('arise:plan');
    if (p && pl) {
      setProfile(p);
      setPlan(pl);
      setDayState(storeGet('arise:day:' + todayStr()) || { completed: {}, claimed: false });
      setScreen('dashboard');
    }
  }, []);

  const showToast = useCallback((t, duration = 3200) => {
    setToast(t);
    window.clearTimeout(window.__ariseToastTimer);
    window.__ariseToastTimer = window.setTimeout(() => setToast(null), duration);
  }, []);

  const handleAnswer = (key, val) => setAnswers((a) => ({ ...a, [key]: val }));

  const nextStep = async () => {
    if (step < QUESTIONS.length - 1) { setStep((s) => s + 1); return; }
    setScreen('generating');
    const { plan: newPlan, aiGenerated } = await generatePlan(answers);
    setGenNote(aiGenerated ? null : 'Could not reach the plan generator — a starter plan was created instead.');
    const newProfile = profile || defaultProfile();
    newProfile.title = newPlan.title || newProfile.title;
    setProfile(newProfile);
    setPlan(newPlan);
    storeSet('arise:profile', newProfile);
    storeSet('arise:plan', newPlan);
    const ds = { completed: {}, claimed: false };
    setDayState(ds);
    storeSet('arise:day:' + todayStr(), ds);
    setScreen('dashboard');
  };
  const prevStep = () => setStep((s) => Math.max(0, s - 1));

  const todayPlan = useMemo(() => {
    if (!plan) return null;
    return plan.days.find((d) => d.day === todayWeekday()) || { day: todayWeekday(), focus: 'Rest', exercises: [] };
  }, [plan]);

  const isRestDay = todayPlan && todayPlan.exercises.length === 0;

  const toggleExercise = (idx) => {
    if (dayState.claimed) return;
    const next = { ...dayState, completed: { ...dayState.completed, [idx]: !dayState.completed[idx] } };
    setDayState(next);
    storeSet('arise:day:' + todayStr(), next);
  };

  const claimDay = () => {
    if (dayState.claimed || !profile) return;
    const completedIdxs = isRestDay ? [-1] : Object.keys(dayState.completed).filter((k) => dayState.completed[k]).map(Number);
    if (!isRestDay && completedIdxs.length === 0) return;

    const newStats = { ...profile.stats };
    let xpGain = 0;
    if (isRestDay) {
      xpGain = 15;
      newStats.VIT += 1;
    } else {
      completedIdxs.forEach((i) => {
        const ex = todayPlan.exercises[i];
        if (!ex) return;
        xpGain += 25;
        newStats[ex.cat] = (newStats[ex.cat] || 1) + 1;
      });
    }

    let { level, xp, totalXp, streak, lastActiveDate, totalWorkouts } = profile;
    totalXp += xpGain;
    xp += xpGain;
    let leveledUp = false;
    while (xp >= xpForLevel(level)) { xp -= xpForLevel(level); level += 1; leveledUp = true; }

    const prevRank = getRank(profile.level);
    const newRank = getRank(level);
    const rankedUp = newRank !== prevRank;

    if (lastActiveDate === yesterdayStr()) streak += 1;
    else if (lastActiveDate !== todayStr()) streak = 1;
    lastActiveDate = todayStr();
    if (!isRestDay) totalWorkouts += 1;

    const newProfile = { ...profile, level, xp, totalXp, streak, lastActiveDate, totalWorkouts, stats: newStats };
    setProfile(newProfile);
    storeSet('arise:profile', newProfile);

    const newDayState = { ...dayState, claimed: true };
    setDayState(newDayState);
    storeSet('arise:day:' + todayStr(), newDayState);

    if (rankedUp) {
      showToast({ kind: 'rankup', lines: [`RANK UP`, `${prevRank} → ${newRank}`] }, 4200);
    } else if (leveledUp) {
      showToast({ kind: 'levelup', lines: [`LEVEL UP`, `Lv ${level - 1} → Lv ${level}`] }, 3800);
    } else {
      showToast({ kind: 'xp', lines: [`+${xpGain} XP`, isRestDay ? 'Recovery logged' : 'Quest complete'] });
    }
  };

  const resetAll = () => {
    storeDelete('arise:profile');
    storeDelete('arise:plan');
    storeDelete('arise:day:' + todayStr());
    setProfile(null); setPlan(null); setAnswers({}); setStep(0);
    setShowSettings(false);
    setScreen('onboarding');
  };

  const regeneratePlan = () => { setShowSettings(false); setStep(0); setScreen('onboarding'); };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        ${FONTS}
        @keyframes scanline { 0%{ transform: translateY(-100%); } 100%{ transform: translateY(100%); } }
        @keyframes panelIn { 0%{ opacity:0; transform: translate(-50%,-12px) scale(0.96); } 100%{ opacity:1; transform: translate(-50%,0) scale(1); } }
        @keyframes flicker { 0%,100%{ opacity:1;} 50%{ opacity:0.85;} }
        @keyframes barGrow { from { width: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .arise-mono { font-family: 'JetBrains Mono', monospace; }
        .arise-display { font-family: 'Orbitron', sans-serif; }
        ::selection { background: ${C.cyan}; color: #000; }
      `}</style>

      {toast && <SystemToast toast={toast} />}

      {screen === 'onboarding' && (
        <Onboarding
          step={step} answers={answers} onAnswer={handleAnswer}
          onNext={nextStep} onPrev={prevStep}
        />
      )}
      {screen === 'generating' && <GeneratingScreen />}
      {screen === 'dashboard' && profile && plan && (
        <Dashboard
          profile={profile} plan={plan} todayPlan={todayPlan} isRestDay={isRestDay}
          dayState={dayState} tab={tab} setTab={setTab}
          onToggleExercise={toggleExercise} onClaim={claimDay}
          showSettings={showSettings} setShowSettings={setShowSettings}
          onReset={resetAll} onRegenerate={regeneratePlan} genNote={genNote}
        />
      )}
    </div>
  );
}

/* -------------------------------- onboarding -------------------------------- */

function Onboarding({ step, answers, onAnswer, onNext, onPrev }) {
  const q = QUESTIONS[step];
  const val = answers[q.key];
  const canProceed = val !== undefined && val !== '';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <Sparkles size={16} style={{ color: C.cyan }} />
          <span className="arise-mono text-xs uppercase tracking-widest" style={{ color: C.cyan }}>
            THE SYSTEM — INITIALIZATION
          </span>
        </div>

        <div className="flex gap-1 mb-10">
          {QUESTIONS.map((_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= step ? C.cyan : C.border, transition: 'background 0.3s' }} />
          ))}
        </div>

        <p className="arise-mono text-xs mb-2" style={{ color: C.muted }}>QUESTION {step + 1} / {QUESTIONS.length}</p>
        <h1 className="arise-display text-2xl mb-8" style={{ color: C.text, lineHeight: 1.3 }}>{q.label}</h1>

        {q.type === 'select' && (
          <div className="flex flex-col gap-3 mb-10">
            {q.options.map((opt) => {
              const active = val === opt;
              return (
                <button
                  key={opt}
                  onClick={() => onAnswer(q.key, opt)}
                  className="text-left px-5 py-4 rounded-lg transition-all"
                  style={{
                    background: active ? 'rgba(79,227,255,0.08)' : C.panel,
                    border: `1px solid ${active ? C.cyan : C.border}`,
                    color: active ? C.cyan : C.text,
                  }}
                >
                  <span className="font-medium">{opt}</span>
                </button>
              );
            })}
          </div>
        )}

        {q.type === 'number' && (
          <input
            type="number"
            inputMode="numeric"
            value={val || ''}
            placeholder={q.placeholder}
            onChange={(e) => onAnswer(q.key, e.target.value)}
            className="w-full px-5 py-4 rounded-lg mb-10 outline-none arise-mono text-lg"
            style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.text }}
          />
        )}

        <div className="flex gap-3">
          {step > 0 && (
            <button onClick={onPrev} className="px-4 py-3 rounded-lg flex items-center gap-1" style={{ border: `1px solid ${C.border}`, color: C.muted }}>
              <ChevronLeft size={16} /> Back
            </button>
          )}
          <button
            onClick={onNext}
            disabled={!canProceed}
            className="flex-1 px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition-opacity"
            style={{
              background: canProceed ? C.cyan : C.border,
              color: canProceed ? '#031018' : C.muted,
              opacity: canProceed ? 1 : 0.6,
              cursor: canProceed ? 'pointer' : 'not-allowed',
            }}
          >
            {step === QUESTIONS.length - 1 ? 'Awaken' : 'Next'} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ generating screen ---------------------------- */

function GeneratingScreen() {
  const [line, setLine] = useState(0);
  const lines = [
    'Scanning hunter profile...',
    'Calibrating training load...',
    'Calculating nutrition targets...',
    'Compiling your System plan...',
  ];
  useEffect(() => {
    const t = setInterval(() => setLine((l) => (l + 1) % lines.length), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-6">
        <div style={{ width: 64, height: 64, borderRadius: '50%', border: `2px solid ${C.border}` }} />
        <div style={{
          position: 'absolute', top: 0, left: 0, width: 64, height: 64, borderRadius: '50%',
          border: `2px solid transparent`, borderTopColor: C.cyan, animation: 'spin 1s linear infinite',
        }} />
      </div>
      <p className="arise-mono text-xs uppercase tracking-widest mb-2" style={{ color: C.cyan }}>The System</p>
      <p className="text-sm" style={{ color: C.muted }}>{lines[line]}</p>
    </div>
  );
}

/* --------------------------------- toast ----------------------------------- */

function SystemToast({ toast }) {
  const accent = toast.kind === 'rankup' ? C.amber : toast.kind === 'levelup' ? C.violet : C.cyan;
  return (
    <div style={{
      position: 'fixed', top: 24, left: '50%', zIndex: 50,
      animation: 'panelIn 0.35s ease-out forwards', transform: 'translate(-50%,0)',
    }}>
      <div style={{
        position: 'relative', overflow: 'hidden', minWidth: 260, padding: '16px 24px',
        background: 'rgba(10,13,24,0.92)', border: `1px solid ${accent}`,
        boxShadow: `0 0 24px ${accent}55, inset 0 0 24px ${accent}11`, borderRadius: 4,
        textAlign: 'center',
      }}>
        <div style={{
          position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent, ${accent}22, transparent)`,
          animation: 'scanline 1.6s linear infinite',
        }} />
        {toast.lines.map((l, i) => (
          <p key={i}
            className={i === 0 ? 'arise-display' : 'arise-mono'}
            style={{ color: i === 0 ? accent : C.muted, fontSize: i === 0 ? 18 : 12, letterSpacing: '0.08em', margin: i === 0 ? '0 0 4px' : 0 }}>
            {l}
          </p>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- dashboard ---------------------------------- */

function Dashboard({ profile, plan, todayPlan, isRestDay, dayState, tab, setTab, onToggleExercise, onClaim, showSettings, setShowSettings, onReset, onRegenerate, genNote }) {
  const rank = getRank(profile.level);
  const xpNeeded = xpForLevel(profile.level);
  const xpPct = Math.min(100, Math.round((profile.xp / xpNeeded) * 100));
  const allDone = isRestDay ? true : todayPlan.exercises.length > 0 && todayPlan.exercises.every((_, i) => dayState.completed[i]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-16">
      {genNote && (
        <div className="mb-4 px-4 py-2 rounded text-xs" style={{ background: 'rgba(255,184,79,0.08)', border: `1px solid ${C.amber}55`, color: C.amber }}>
          {genNote}
        </div>
      )}

      {/* header / status window */}
      <div className="relative rounded-xl p-5 mb-6" style={{ background: C.panel, border: `1px solid ${C.borderBright}` }}>
        <button onClick={() => setShowSettings(true)} className="absolute top-4 right-4" style={{ color: C.muted }}>
          <Settings size={18} />
        </button>
        <p className="arise-mono text-xs uppercase tracking-widest mb-1" style={{ color: C.cyan }}>{profile.title}</p>
        <div className="flex items-baseline gap-3 mb-4">
          <span className="arise-display text-3xl" style={{ color: C.text }}>LV {profile.level}</span>
          <span className="arise-mono text-sm px-2 py-0.5 rounded" style={{ background: C.cyanDim, color: C.cyan }}>RANK {rank}</span>
          <span className="flex items-center gap-1 ml-auto arise-mono text-sm" style={{ color: C.amber }}>
            <Flame size={14} /> {profile.streak}
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: C.bgGrid }}>
          <div style={{ width: `${xpPct}%`, height: '100%', background: `linear-gradient(90deg, ${C.cyan}, ${C.violet})`, animation: 'barGrow 0.6s ease-out' }} />
        </div>
        <p className="arise-mono text-xs mt-1" style={{ color: C.muted }}>{profile.xp} / {xpNeeded} XP</p>
      </div>

      {/* tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: C.panel }}>
        {[['quests', 'Quests', Trophy], ['diet', 'Diet', Salad], ['stats', 'Stats', Zap]].map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all"
            style={{ background: tab === key ? C.panel2 : 'transparent', color: tab === key ? C.cyan : C.muted }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'quests' && (
        <QuestsTab todayPlan={todayPlan} isRestDay={isRestDay} dayState={dayState} onToggle={onToggleExercise} onClaim={onClaim} allDone={allDone} />
      )}
      {tab === 'diet' && <DietTab diet={plan.diet} />}
      {tab === 'stats' && <StatsTab profile={profile} />}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} onReset={onReset} onRegenerate={onRegenerate} />
      )}
    </div>
  );
}

/* ---------------------------------- quests ----------------------------------- */

function QuestsTab({ todayPlan, isRestDay, dayState, onToggle, onClaim, allDone }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="arise-display text-sm uppercase tracking-wide" style={{ color: C.text }}>
          {todayWeekday()} — {todayPlan.focus}
        </h2>
        {dayState.claimed && (
          <span className="arise-mono text-xs px-2 py-1 rounded" style={{ background: 'rgba(79,227,255,0.1)', color: C.cyan }}>CLAIMED</span>
        )}
      </div>

      {isRestDay ? (
        <div className="rounded-lg p-6 text-center mb-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <Moon size={22} style={{ color: C.violet, margin: '0 auto 8px' }} />
          <p className="font-medium mb-1">Recovery Day</p>
          <p className="text-sm" style={{ color: C.muted }}>Rest, hydrate, and stretch. Log it to earn recovery XP.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {todayPlan.exercises.map((ex, i) => {
            const meta = STAT_META[ex.cat] || STAT_META.STR;
            const Icon = meta.icon;
            const done = !!dayState.completed[i];
            return (
              <button
                key={i}
                onClick={() => onToggle(i)}
                disabled={dayState.claimed}
                className="flex items-center gap-3 p-3 rounded-lg text-left transition-all"
                style={{ background: done ? 'rgba(79,227,255,0.07)' : C.panel, border: `1px solid ${done ? C.cyan : C.border}`, opacity: dayState.claimed && !done ? 0.5 : 1 }}
              >
                <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ border: `1px solid ${done ? C.cyan : C.border}`, background: done ? C.cyan : 'transparent' }}>
                  {done && <Check size={14} style={{ color: '#031018' }} />}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm" style={{ color: C.text }}>{ex.n}</p>
                  <p className="arise-mono text-xs" style={{ color: C.muted }}>{ex.s} sets × {ex.r}</p>
                </div>
                <span className="flex items-center gap-1 arise-mono text-xs" style={{ color: meta.color }}>
                  <Icon size={12} /> {meta.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={onClaim}
        disabled={dayState.claimed || !allDone}
        className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
        style={{
          background: dayState.claimed ? C.border : allDone ? C.cyan : C.border,
          color: dayState.claimed ? C.muted : allDone ? '#031018' : C.muted,
          opacity: allDone || dayState.claimed ? 1 : 0.6,
          cursor: dayState.claimed || !allDone ? 'not-allowed' : 'pointer',
        }}
      >
        {dayState.claimed ? 'XP Claimed' : isRestDay ? 'Log Recovery' : 'Claim Quest XP'}
      </button>
    </div>
  );
}

/* ----------------------------------- diet ------------------------------------ */

function DietTab({ diet }) {
  const macros = [
    { label: 'Protein', value: diet.protein, color: C.cyan },
    { label: 'Carbs', value: diet.carbs, color: C.amber },
    { label: 'Fat', value: diet.fat, color: C.violet },
  ];
  const totalG = macros.reduce((s, m) => s + m.value, 0) || 1;
  return (
    <div>
      <div className="rounded-lg p-5 mb-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
        <p className="arise-mono text-xs uppercase tracking-widest mb-1" style={{ color: C.muted }}>Daily Target</p>
        <p className="arise-display text-3xl mb-4" style={{ color: C.text }}>{diet.calories} <span className="text-sm" style={{ color: C.muted }}>kcal</span></p>
        <div className="flex h-2 rounded-full overflow-hidden mb-3">
          {macros.map((m) => <div key={m.label} style={{ width: `${(m.value / totalG) * 100}%`, background: m.color }} />)}
        </div>
        <div className="flex justify-between">
          {macros.map((m) => (
            <div key={m.label} className="text-center">
              <p className="arise-mono text-sm" style={{ color: m.color }}>{m.value}g</p>
              <p className="text-xs" style={{ color: C.muted }}>{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="arise-mono text-xs uppercase tracking-widest mb-2" style={{ color: C.muted }}>Meal Plan</p>
      <div className="flex flex-col gap-2">
        {diet.meals.map((m, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
            <div>
              <p className="font-medium text-sm" style={{ color: C.text }}>{m.n}</p>
              <p className="text-xs" style={{ color: C.muted }}>{m.desc}</p>
            </div>
            <span className="arise-mono text-xs flex-shrink-0 ml-3" style={{ color: C.amber }}>{m.cal} kcal</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------- stats ------------------------------------ */

function StatsTab({ profile }) {
  const achievements = [
    { label: 'First Steps', done: profile.totalWorkouts >= 1 },
    { label: '7-Day Streak', done: profile.streak >= 7 },
    { label: 'Reached Level 10', done: profile.level >= 10 },
    { label: '50 Quests Completed', done: profile.totalWorkouts >= 50 },
    { label: 'Rank A Hunter', done: getRank(profile.level) === 'A' || getRank(profile.level) === 'S' || getRank(profile.level) === 'NATIONAL' },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {Object.entries(profile.stats).map(([key, value]) => {
          const meta = STAT_META[key];
          const Icon = meta.icon;
          const pct = Math.min(100, value);
          return (
            <div key={key} className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
              <span className="flex items-center gap-1.5 mb-2 arise-mono text-xs" style={{ color: meta.color }}>
                <Icon size={13} /> {meta.label}
              </span>
              <p className="arise-display text-xl mb-2" style={{ color: C.text }}>{value}</p>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.bgGrid }}>
                <div style={{ width: `${pct}%`, height: '100%', background: meta.color }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-lg p-3 text-center" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <p className="arise-display text-2xl" style={{ color: C.cyan }}>{profile.totalWorkouts}</p>
          <p className="text-xs" style={{ color: C.muted }}>Quests Completed</p>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
          <p className="arise-display text-2xl" style={{ color: C.amber }}>{profile.totalXp}</p>
          <p className="text-xs" style={{ color: C.muted }}>Total XP Earned</p>
        </div>
      </div>

      <p className="arise-mono text-xs uppercase tracking-widest mb-2" style={{ color: C.muted }}>Achievements</p>
      <div className="flex flex-col gap-2">
        {achievements.map((a) => (
          <div key={a.label} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.border}`, opacity: a.done ? 1 : 0.4 }}>
            <Trophy size={16} style={{ color: a.done ? C.amber : C.muted }} />
            <p className="text-sm" style={{ color: a.done ? C.text : C.muted }}>{a.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- settings ----------------------------------- */

function SettingsModal({ onClose, onReset, onRegenerate }) {
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="w-full max-w-sm rounded-xl p-5" style={{ background: C.panel, border: `1px solid ${C.borderBright}` }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="arise-display text-sm uppercase tracking-wide" style={{ color: C.text }}>Settings</h3>
          <button onClick={onClose} style={{ color: C.muted }}><X size={18} /></button>
        </div>
        <button onClick={onRegenerate} className="w-full mb-3 py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.cyan }}>
          <RotateCcw size={14} /> Regenerate Plan
        </button>
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="w-full py-3 rounded-lg text-sm font-medium" style={{ border: `1px solid ${C.danger}55`, color: C.danger }}>
            Reset All Progress
          </button>
        ) : (
          <div>
            <p className="text-xs mb-3 text-center" style={{ color: C.muted }}>This will permanently erase your level, XP, streak and plan. Are you sure?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmReset(false)} className="flex-1 py-2 rounded-lg text-sm" style={{ border: `1px solid ${C.border}`, color: C.muted }}>Cancel</button>
              <button onClick={onReset} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: C.danger, color: '#1a0006' }}>Erase</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
