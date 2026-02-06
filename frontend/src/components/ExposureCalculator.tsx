'use client';

import { useState, useEffect, useMemo } from 'react';
import { type GreekData } from '@/lib/api';

// ── Task profile token patterns ──────────────────────────────────
const TASK_PROFILES = {
  simple:    { label: 'Simple',    n_in: 2000,  n_out: 200,  n_think: 0 },
  medium:    { label: 'Medium',    n_in: 8000,  n_out: 800,  n_think: 0 },
  complex:   { label: 'Complex',   n_in: 30000, n_out: 2000, n_think: 0 },
  reasoning: { label: 'Reasoning', n_in: 15000, n_out: 1500, n_think: 8000 },
} as const;

type TaskType = keyof typeof TASK_PROFILES;
const TASK_TYPES: TaskType[] = ['simple', 'medium', 'complex', 'reasoning'];

// ── Volume steps (log-distributed) ───────────────────────────────
const VOLUME_STEPS = [
  1000, 2000, 5000, 10000, 20000, 50000,
  100000, 200000, 500000, 1000000, 2000000, 5000000,
];

// ── Client-side pricing (flat-tier approximation) ────────────────
function calcRInEff(rIn: number, rCache: number, eta: number): number {
  return rIn * (1 - eta) + rCache * eta;
}

function calcCostPerCall(
  beta: number, nOut: number, nIn: number, rInEffVal: number,
  nThink: number, rThink: number,
): number {
  return beta * (nOut + nIn * rInEffVal + nThink * rThink) * 1e-6;
}

function calcKappa(nIn: number, nOut: number, rInEffVal: number): number {
  if (nOut === 0) return Infinity;
  return 1 + (nIn / nOut) * rInEffVal;
}

// ── Formatting ───────────────────────────────────────────────────
function fmtCost(cost: number): string {
  if (cost < 0) return `-${fmtCost(-cost)}`;
  if (cost < 0.01) return '<$0.01';
  if (cost < 1) return `$${cost.toFixed(2)}`;
  if (cost < 100) return `$${cost.toFixed(0)}`;
  if (cost < 10000) return `$${Math.round(cost).toLocaleString()}`;
  if (cost < 1000000) return `$${(cost / 1000).toFixed(1)}K`;
  return `$${(cost / 1000000).toFixed(2)}M`;
}

function fmtVol(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
}

// ── Types ────────────────────────────────────────────────────────
interface ModelMixEntry { ticker: string; weight: number; }
interface TaskMix { simple: number; medium: number; complex: number; reasoning: number; }

interface Preset {
  name: string;
  category: 'workflow' | 'business';
  desc: string;
  monthlyCalls: number;
  eta: number;
  taskMix: TaskMix;
  models: ModelMixEntry[];
  architecture: string[];
  economics: { revenuePerTask: number; overheadPerTask: number; fixedMonthlyCost: number; };
  insights: string[];
}

// ── Preset definitions ───────────────────────────────────────────
const PRESETS: Record<string, Preset> = {
  gsd: {
    name: 'GSD',
    category: 'workflow',
    desc: 'Agentic coding — multi-agent orchestration with parallel execution',
    monthlyCalls: 150000,
    eta: 0.5,
    taskMix: { simple: 15, medium: 25, complex: 35, reasoning: 25 },
    models: [
      { ticker: 'HAIKU-3.5', weight: 30 },
      { ticker: 'SONNET-4', weight: 40 },
      { ticker: 'OPUS-4.5', weight: 30 },
    ],
    architecture: [
      'User Request',
      '  \u2192 Planner (Opus)         phase design + task breakdown',
      '  \u2192 Researcher (Haiku)     codebase search + context',
      '  \u2192 Executor \u00d74-8 (Sonnet) parallel code generation',
      '  \u2192 Verifier (Opus)        quality check + integration',
      '',
      'Hot path: Executor agents (60% of tokens)',
    ],
    economics: { revenuePerTask: 0.50, overheadPerTask: 0.01, fixedMonthlyCost: 2000 },
    insights: [
      'High kappa \u2014 massive code context per call. Cache optimization is your #1 lever.',
      'Executor agents dominate cost. Consider downshifting routine code tasks to cheaper models.',
      'Theta decay compounds across all agents \u2014 6M forward savings are significant.',
    ],
  },
  openclaw: {
    name: 'OpenClaw',
    category: 'workflow',
    desc: 'Personal AI agent — autonomous task execution via tool chains',
    monthlyCalls: 20000,
    eta: 0.2,
    taskMix: { simple: 30, medium: 40, complex: 20, reasoning: 10 },
    models: [
      { ticker: 'HAIKU-3.5', weight: 30 },
      { ticker: 'SONNET-4', weight: 50 },
      { ticker: 'OPUS-4.5', weight: 20 },
    ],
    architecture: [
      'User (chat / messaging)',
      '  \u2192 Router (Haiku)         task classification',
      '  \u2192 Skill Agent (Sonnet)   web, email, calendar, shopping',
      '  \u2192 Reasoning (Opus)       complex multi-step planning',
      '',
      'Hot path: Skill execution (70% of calls)',
      'Key: Sequential chains, diverse tasks, tool-heavy',
    ],
    economics: { revenuePerTask: 0.10, overheadPerTask: 0.005, fixedMonthlyCost: 500 },
    insights: [
      'Low caching \u2014 each task is unique. Model substitution is the main cost lever.',
      'Router agent is cheap but critical. Accurate routing saves expensive model calls.',
      'Volume scales per-user. Cost structure must support consumer pricing.',
    ],
  },
  saas: {
    name: 'SaaS',
    category: 'business',
    desc: 'AI-augmented product — chatbot, search, recommendations per user',
    monthlyCalls: 500000,
    eta: 0.7,
    taskMix: { simple: 40, medium: 40, complex: 15, reasoning: 5 },
    models: [
      { ticker: 'GPT-4O-MINI', weight: 70 },
      { ticker: 'SONNET-4', weight: 30 },
    ],
    architecture: [
      'End User \u2192 API Gateway',
      '  \u2192 Cheap Model (4o-mini)  simple queries, autocomplete',
      '  \u2192 Quality Model (Sonnet) complex queries, generation',
      '',
      'Hot path: Cheap model handles 70% of traffic',
      'Key: Cost-per-user scales with customer base',
    ],
    economics: { revenuePerTask: 0.03, overheadPerTask: 0.003, fixedMonthlyCost: 5000 },
    insights: [
      'Cost-per-user is the metric that matters. Track it as you scale.',
      'Model substitution is the biggest lever \u2014 route aggressively to cheapest viable model.',
      'Caching is already high (0.7). Further gains require prompt engineering investment.',
    ],
  },
  trading: {
    name: 'Trading',
    category: 'business',
    desc: 'Quantitative analysis — low volume, high-value reasoning per call',
    monthlyCalls: 5000,
    eta: 0.1,
    taskMix: { simple: 5, medium: 15, complex: 30, reasoning: 50 },
    models: [
      { ticker: 'SONNET-4', weight: 10 },
      { ticker: 'OPUS-4.5', weight: 40 },
      { ticker: 'GPT-4.1', weight: 50 },
    ],
    architecture: [
      'Market Data Feed',
      '  \u2192 Data Prep (Sonnet)     normalize + extract signals',
      '  \u2192 Analysis (Opus)        deep pattern recognition',
      '  \u2192 Strategy (GPT-4.1)     hypothesis testing + risk calc',
      '',
      'Hot path: Reasoning models (80% of cost)',
      'Key: Fresh data each call, ROI per call is massive',
    ],
    economics: { revenuePerTask: 5.00, overheadPerTask: 0.10, fixedMonthlyCost: 15000 },
    insights: [
      'Inference cost is noise relative to signal value. Do not optimize for cost here.',
      'Very high kappa \u2014 context-heavy analysis. But ROI justifies expensive models.',
      'Theta decay is irrelevant \u2014 you need the best model now, not a cheaper one later.',
    ],
  },
  research: {
    name: 'Research',
    category: 'business',
    desc: 'Analysis at scale — market research, due diligence, academic review',
    monthlyCalls: 50000,
    eta: 0.4,
    taskMix: { simple: 10, medium: 30, complex: 40, reasoning: 20 },
    models: [
      { ticker: 'GPT-4O-MINI', weight: 20 },
      { ticker: 'SONNET-4', weight: 50 },
      { ticker: 'OPUS-4.5', weight: 30 },
    ],
    architecture: [
      'Document Corpus / Data Sources',
      '  \u2192 Ingestion (4o-mini)    chunk, classify, index',
      '  \u2192 Analysis (Sonnet)      extract, compare, synthesize',
      '  \u2192 Synthesis (Opus)       final reports + conclusions',
      '',
      'Hot path: Analysis phase (50% of tokens)',
      'Key: Large context windows, document-heavy pipelines',
    ],
    economics: { revenuePerTask: 0.25, overheadPerTask: 0.01, fixedMonthlyCost: 3000 },
    insights: [
      'High kappa from document ingestion. Cache improvement and prompt compression both help.',
      'Ingestion phase is high volume but cheap. Analysis phase dominates cost.',
      'Consider batch processing for non-urgent research to capture batch pricing discounts.',
    ],
  },
  content: {
    name: 'Content',
    category: 'business',
    desc: 'Generation at scale — YouTube scripts, blogs, social media, translations',
    monthlyCalls: 500000,
    eta: 0.4,
    taskMix: { simple: 50, medium: 30, complex: 15, reasoning: 5 },
    models: [
      { ticker: 'GPT-4O-MINI', weight: 80 },
      { ticker: 'SONNET-4', weight: 20 },
    ],
    architecture: [
      'Content Brief / Template',
      '  \u2192 Draft (4o-mini)        bulk generation, social posts',
      '  \u2192 Polish (Sonnet)        flagship content, long-form',
      '  \u2192 Variants (4o-mini)     translations, A/B versions',
      '',
      'Hot path: Draft generation (80% of calls)',
      'Key: Output-heavy, high volume, low context',
    ],
    economics: { revenuePerTask: 0.008, overheadPerTask: 0.001, fixedMonthlyCost: 1000 },
    insights: [
      'Low kappa (output-heavy). Input optimization has minimal impact.',
      'Already on cheapest models \u2014 "switch to cheapest" barely helps.',
      'Margin is razor-thin. Volume is everything. Theta decay is your friend.',
    ],
  },
  productivity: {
    name: 'Productivity',
    category: 'business',
    desc: 'Workflow automation — email, meeting notes, doc generation, scheduling',
    monthlyCalls: 100000,
    eta: 0.5,
    taskMix: { simple: 35, medium: 40, complex: 20, reasoning: 5 },
    models: [
      { ticker: 'GPT-4O-MINI', weight: 50 },
      { ticker: 'SONNET-4', weight: 40 },
      { ticker: 'OPUS-4.5', weight: 10 },
    ],
    architecture: [
      'Trigger (email, meeting, document)',
      '  \u2192 Classify (4o-mini)     route to handler',
      '  \u2192 Process (Sonnet)       draft, summarize, extract',
      '  \u2192 Review (Opus)          quality-critical outputs',
      '',
      'Hot path: Process step (60% of calls)',
      'Key: Balanced workload, organizational context reuse',
    ],
    economics: { revenuePerTask: 0.05, overheadPerTask: 0.005, fixedMonthlyCost: 2000 },
    insights: [
      'Most balanced profile \u2014 every optimization lever helps roughly equally.',
      'Organizational context (team docs, email patterns) enables good caching.',
      'Quality matters for user-facing outputs. Don\'t over-optimize away from quality models.',
    ],
  },
};

const WORKFLOW_PRESETS = Object.entries(PRESETS).filter(([, p]) => p.category === 'workflow');
const BUSINESS_PRESETS = Object.entries(PRESETS).filter(([, p]) => p.category === 'business');

// ── Component ────────────────────────────────────────────────────
interface Props { models: GreekData[]; }

export default function ExposureCalculator({ models }: Props) {
  // Usage profile state
  const [volIdx, setVolIdx] = useState(8);
  const [eta, setEta] = useState(0.6);
  const [taskMix, setTaskMix] = useState<TaskMix>({ simple: 30, medium: 40, complex: 20, reasoning: 10 });
  const [modelMix, setModelMix] = useState<ModelMixEntry[]>([
    { ticker: 'GPT-4O-MINI', weight: 40 },
    { ticker: 'SONNET-4', weight: 35 },
    { ticker: 'OPUS-4.5', weight: 25 },
  ]);
  const [activePreset, setActivePreset] = useState<string | null>('saas');

  // Unit economics state
  const [revenuePerTask, setRevenuePerTask] = useState(0.03);
  const [overheadPerTask, setOverheadPerTask] = useState(0.003);
  const [fixedMonthlyCost, setFixedMonthlyCost] = useState(5000);

  const monthlyCalls = VOLUME_STEPS[volIdx] || 500000;

  // Resolve desired ticker to closest available
  const findTicker = (desired: string): string | null => {
    if (models.find(m => m.ticker === desired)) return desired;
    const prefix = desired.split('-')[0];
    const partial = models.find(m => m.ticker.startsWith(prefix));
    return partial?.ticker || null;
  };

  // Validate model mix when data loads
  useEffect(() => {
    if (models.length === 0) return;
    const validated = modelMix
      .map(entry => {
        const resolved = findTicker(entry.ticker);
        return resolved ? { ...entry, ticker: resolved } : null;
      })
      .filter((e): e is ModelMixEntry => e !== null);

    if (validated.length === 0) {
      setModelMix([{ ticker: models[0].ticker, weight: 100 }]);
    } else if (
      validated.length !== modelMix.length ||
      validated.some((v, i) => v.ticker !== modelMix[i]?.ticker)
    ) {
      setModelMix(validated);
    }
  }, [models]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply preset (includes economics defaults)
  const applyPreset = (key: string) => {
    const p = PRESETS[key];
    if (!p) return;
    const idx = VOLUME_STEPS.findIndex(v => v >= p.monthlyCalls);
    setVolIdx(idx >= 0 ? idx : 8);
    setEta(p.eta);
    setTaskMix(p.taskMix);
    setRevenuePerTask(p.economics.revenuePerTask);
    setOverheadPerTask(p.economics.overheadPerTask);
    setFixedMonthlyCost(p.economics.fixedMonthlyCost);
    const resolved = p.models
      .map(m => { const t = findTicker(m.ticker); return t ? { ticker: t, weight: m.weight } : null; })
      .filter((m): m is ModelMixEntry => m !== null);
    setModelMix(resolved.length > 0 ? resolved : [{ ticker: models[0]?.ticker || '', weight: 100 }]);
    setActivePreset(key);
  };

  // ── Compute all results ────────────────────────────────────────
  const results = useMemo(() => {
    if (models.length === 0) return null;

    const taskTotal = TASK_TYPES.reduce((s, t) => s + taskMix[t], 0);
    const modelTotal = modelMix.reduce((s, m) => s + m.weight, 0);
    if (taskTotal === 0 || modelTotal === 0) return null;

    const tw = Object.fromEntries(
      TASK_TYPES.map(t => [t, taskMix[t] / taskTotal])
    ) as Record<TaskType, number>;
    const mw = modelMix.map(m => ({ ...m, weight: m.weight / modelTotal }));

    function computeCost(
      mix: Array<{ ticker: string; weight: number }>,
      taskWeights: Record<TaskType, number>,
      etaVal: number,
    ): number {
      let total = 0;
      for (const entry of mix) {
        const g = models.find(m => m.ticker === entry.ticker);
        if (!g?.beta_sync) continue;
        const r = calcRInEff(g.r_in, g.r_cache, etaVal);
        for (const t of TASK_TYPES) {
          const p = TASK_PROFILES[t];
          const nThink = (t === 'reasoning' && g.is_reasoning) ? p.n_think : 0;
          total += taskWeights[t] * entry.weight *
            calcCostPerCall(g.beta_sync, p.n_out, p.n_in, r, nThink, g.r_think ?? 0);
        }
      }
      return total * monthlyCalls;
    }

    const totalCost = computeCost(mw, tw, eta);
    const costPerCall = totalCost / monthlyCalls;

    // Per-model breakdown
    const modelBreakdown = mw.map(entry => {
      const g = models.find(m => m.ticker === entry.ticker);
      if (!g?.beta_sync) return null;
      const r = calcRInEff(g.r_in, g.r_cache, eta);
      let cost = 0;
      let k = 0;
      for (const t of TASK_TYPES) {
        const p = TASK_PROFILES[t];
        const nThink = (t === 'reasoning' && g.is_reasoning) ? p.n_think : 0;
        cost += tw[t] * calcCostPerCall(g.beta_sync, p.n_out, p.n_in, r, nThink, g.r_think ?? 0);
        k += tw[t] * calcKappa(p.n_in, p.n_out, r);
      }
      return {
        ticker: g.ticker, displayName: g.display_name, provider: g.provider,
        weight: entry.weight, monthlyCost: cost * monthlyCalls * entry.weight,
        kappa: k, theta: g.theta ?? 0.05, beta: g.beta_sync,
      };
    }).filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => b.monthlyCost - a.monthlyCost);

    // Per-task breakdown
    const taskBreakdown = TASK_TYPES.map(t => {
      let avgCost = 0;
      for (const entry of mw) {
        const g = models.find(m => m.ticker === entry.ticker);
        if (!g?.beta_sync) continue;
        const r = calcRInEff(g.r_in, g.r_cache, eta);
        const nThink = (t === 'reasoning' && g.is_reasoning) ? TASK_PROFILES[t].n_think : 0;
        avgCost += entry.weight *
          calcCostPerCall(g.beta_sync, TASK_PROFILES[t].n_out, TASK_PROFILES[t].n_in, r, nThink, g.r_think ?? 0);
      }
      return { type: t, label: TASK_PROFILES[t].label, weight: tw[t], monthlyCost: monthlyCalls * tw[t] * avgCost };
    });

    const weightedKappa = modelBreakdown.reduce((s, m) => s + m.weight * m.kappa, 0);
    const weightedTheta = modelBreakdown.reduce((s, m) => s + m.weight * m.theta, 0);
    const decay3M = Math.exp(-weightedTheta * 3);
    const decay6M = Math.exp(-weightedTheta * 6);

    // What-if: cheapest model
    const cheapest = [...models].filter(m => m.beta_sync).sort((a, b) => a.beta_sync! - b.beta_sync!)[0];
    const cheapestCost = cheapest ? computeCost([{ ticker: cheapest.ticker, weight: 1 }], tw, eta) : totalCost;

    // What-if: boost caching
    const targetEta = eta >= 0.75 ? 0.95 : 0.8;
    const maxCacheCost = computeCost(mw, tw, targetEta);

    // What-if: downshift
    const cheapestInMix = modelBreakdown.length > 0
      ? modelBreakdown.reduce((min, m) => m.beta < min.beta ? m : min, modelBreakdown[0]) : null;
    let downshiftCost = totalCost;
    if (cheapestInMix && modelBreakdown.length > 1) {
      const cg = models.find(m => m.ticker === cheapestInMix.ticker);
      if (cg?.beta_sync) {
        const cr = calcRInEff(cg.r_in, cg.r_cache, eta);
        let cost = 0;
        for (const t of TASK_TYPES) {
          const p = TASK_PROFILES[t];
          if (t === 'complex' || t === 'reasoning') {
            const nThink = (t === 'reasoning' && cg.is_reasoning) ? p.n_think : 0;
            cost += tw[t] * calcCostPerCall(cg.beta_sync, p.n_out, p.n_in, cr, nThink, cg.r_think ?? 0);
          } else {
            for (const entry of mw) {
              const g = models.find(m => m.ticker === entry.ticker);
              if (!g?.beta_sync) continue;
              const r = calcRInEff(g.r_in, g.r_cache, eta);
              cost += tw[t] * entry.weight * calcCostPerCall(g.beta_sync, p.n_out, p.n_in, r, 0, 0);
            }
          }
        }
        downshiftCost = cost * monthlyCalls;
      }
    }

    const savings = [
      { id: 'cheapest', label: `Switch all to ${cheapest?.ticker}`,
        desc: `Consolidate on ${cheapest?.display_name} (beta=$${cheapest?.beta_sync?.toFixed(2)})`,
        amount: totalCost - cheapestCost, pct: totalCost > 0 ? ((totalCost - cheapestCost) / totalCost) * 100 : 0 },
      { id: 'cache', label: `Boost caching to ${Math.round(targetEta * 100)}%`,
        desc: 'Improve prompt caching hit rate',
        amount: totalCost - maxCacheCost, pct: totalCost > 0 ? ((totalCost - maxCacheCost) / totalCost) * 100 : 0 },
      { id: 'decay', label: 'Wait 3 months (theta decay)',
        desc: `Weighted theta: -${(weightedTheta * 100).toFixed(1)}%/mo`,
        amount: totalCost * (1 - decay3M), pct: totalCost > 0 ? (1 - decay3M) * 100 : 0 },
      { id: 'downshift', label: 'Downshift heavy tasks',
        desc: `Route complex/reasoning to ${cheapestInMix?.ticker}`,
        amount: totalCost - downshiftCost, pct: totalCost > 0 ? ((totalCost - downshiftCost) / totalCost) * 100 : 0 },
    ].filter(s => s.amount > 0.01).sort((a, b) => b.amount - a.amount);

    // ── Unit economics ─────────────────────────────────────────
    const monthlyRevenue = monthlyCalls * revenuePerTask;
    const monthlyOverhead = monthlyCalls * overheadPerTask;
    const monthlyProfit = monthlyRevenue - totalCost - monthlyOverhead - fixedMonthlyCost;
    const grossMargin = monthlyRevenue > 0 ? (monthlyProfit / monthlyRevenue) * 100 : 0;
    const marginPerTask = revenuePerTask - costPerCall - overheadPerTask;
    const breakEvenVolume = marginPerTask > 0 ? Math.ceil(fixedMonthlyCost / marginPerTask) : null;

    // Profit scaling table
    const scaleMultipliers = [0.1, 0.25, 0.5, 1, 2, 5, 10];
    const profitTable = scaleMultipliers.map(mult => {
      const vol = Math.round(monthlyCalls * mult);
      const rev = vol * revenuePerTask;
      const inf = costPerCall * vol;
      const ovh = vol * overheadPerTask;
      const profit = rev - inf - ovh - fixedMonthlyCost;
      const margin = rev > 0 ? (profit / rev) * 100 : 0;
      return { mult, vol, rev, inf, ovh, profit, margin, isCurrent: mult === 1 };
    });

    return {
      totalCost, weightedKappa, weightedTheta, costPerCall,
      decay3M, decay6M, cost3M: totalCost * decay3M, cost6M: totalCost * decay6M,
      modelBreakdown, taskBreakdown, savings,
      monthlyRevenue, monthlyOverhead, monthlyProfit, grossMargin,
      marginPerTask, breakEvenVolume, profitTable,
    };
  }, [models, monthlyCalls, eta, taskMix, modelMix, revenuePerTask, overheadPerTask, fixedMonthlyCost]);

  // ── Model mix management ───────────────────────────────────────
  const addModel = () => {
    const used = new Set(modelMix.map(m => m.ticker));
    const avail = models.find(m => !used.has(m.ticker) && m.beta_sync);
    if (!avail) return;
    setModelMix([...modelMix, { ticker: avail.ticker, weight: 10 }]);
    setActivePreset(null);
  };

  const removeModel = (i: number) => {
    if (modelMix.length <= 1) return;
    setModelMix(modelMix.filter((_, idx) => idx !== i));
    setActivePreset(null);
  };

  const updateModel = (i: number, field: 'ticker' | 'weight', value: string | number) => {
    const updated = [...modelMix];
    if (field === 'ticker') updated[i] = { ...updated[i], ticker: value as string };
    else updated[i] = { ...updated[i], weight: value as number };
    setModelMix(updated);
    setActivePreset(null);
  };

  const taskTotal = TASK_TYPES.reduce((s, t) => s + taskMix[t], 0);
  const modelTotal = modelMix.reduce((s, m) => s + m.weight, 0);
  const currentPreset = activePreset ? PRESETS[activePreset] : null;

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ═══ 1. USAGE PROFILE ═══════════════════════════════════ */}
      <div className="terminal-box">
        <div className="p-3 border-b border-[#262626]">
          <h3 className="mono text-sm text-[#e5e5e5] mb-3">Usage Profile</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[#525252] text-xs mono w-20 shrink-0">Workflows</span>
              <div className="flex gap-2">
                {WORKFLOW_PRESETS.map(([key, p]) => (
                  <button key={key} onClick={() => applyPreset(key)}
                    className={activePreset === key ? 'active' : ''}>{p.name}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#525252] text-xs mono w-20 shrink-0">Business</span>
              <div className="flex gap-2 flex-wrap">
                {BUSINESS_PRESETS.map(([key, p]) => (
                  <button key={key} onClick={() => applyPreset(key)}
                    className={activePreset === key ? 'active' : ''}>{p.name}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mono mb-1">
                <span className="text-[#737373]">Monthly API Calls</span>
                <span className="text-[#e5e5e5]">{fmtVol(monthlyCalls)}</span>
              </div>
              <input type="range" min={0} max={VOLUME_STEPS.length - 1} step={1} value={volIdx}
                onChange={(e) => { setVolIdx(parseInt(e.target.value)); setActivePreset(null); }} />
            </div>

            <div>
              <div className="flex justify-between text-xs mono mb-1">
                <span className="text-[#737373]">Cache Effectiveness (eta)</span>
                <span className="text-[#e5e5e5]">{(eta * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min={0} max={1} step={0.05} value={eta}
                onChange={(e) => { setEta(parseFloat(e.target.value)); setActivePreset(null); }} />
            </div>

            <div>
              <div className="flex justify-between text-xs mono mb-2">
                <span className="text-[#737373]">Task Distribution</span>
                <span className={taskTotal === 100 ? 'text-[#525252]' : 'text-[#ef4444]'}>{taskTotal}%</span>
              </div>
              {TASK_TYPES.map(t => (
                <div key={t} className="flex items-center gap-2 mb-1.5">
                  <span className="text-[#737373] text-xs mono w-20">{TASK_PROFILES[t].label}</span>
                  <input type="range" min={0} max={100} step={5} value={taskMix[t]} className="flex-1"
                    onChange={(e) => { setTaskMix(prev => ({ ...prev, [t]: parseInt(e.target.value) })); setActivePreset(null); }} />
                  <span className="text-[#e5e5e5] text-xs mono w-8 text-right">{taskMix[t]}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div>
            <div className="flex justify-between text-xs mono mb-2">
              <span className="text-[#737373]">Model Allocation</span>
              <span className={modelTotal === 100 ? 'text-[#525252]' : 'text-[#ef4444]'}>{modelTotal}%</span>
            </div>
            <div className="space-y-2">
              {modelMix.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={entry.ticker} onChange={(e) => updateModel(i, 'ticker', e.target.value)}
                    className="w-36 text-xs">
                    {models.filter(m => m.beta_sync).map(m => (
                      <option key={m.ticker} value={m.ticker}>{m.ticker}</option>
                    ))}
                  </select>
                  <input type="range" min={0} max={100} step={5} value={entry.weight} className="flex-1"
                    onChange={(e) => updateModel(i, 'weight', parseInt(e.target.value))} />
                  <span className="text-[#e5e5e5] text-xs mono w-8 text-right">{entry.weight}%</span>
                  <button onClick={() => removeModel(i)} disabled={modelMix.length <= 1}
                    className="text-[#525252] hover:text-[#ef4444] text-xs px-1">x</button>
                </div>
              ))}
            </div>
            {modelMix.length < 6 && (
              <button onClick={addModel} className="mt-2 text-xs">+ Add Model</button>
            )}
            <div className="mt-4 space-y-1">
              {modelMix.map(entry => {
                const g = models.find(m => m.ticker === entry.ticker);
                if (!g?.beta_sync) return null;
                return (
                  <div key={entry.ticker} className="flex justify-between text-xs mono text-[#525252]">
                    <span>{entry.ticker}</span>
                    <span>beta=${g.beta_sync.toFixed(2)}{g.theta != null ? ` | theta=${(g.theta * 100).toFixed(1)}%` : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 2. SYSTEM ARCHITECTURE ═════════════════════════════ */}
      {currentPreset && (
        <div className="terminal-box">
          <div className="p-3 border-b border-[#262626]">
            <div className="flex items-center justify-between">
              <h3 className="mono text-sm text-[#e5e5e5]">System Architecture</h3>
              <span className="text-[#525252] text-xs mono">{currentPreset.desc}</span>
            </div>
          </div>
          <div className="p-4">
            <pre className="mono text-xs text-[#e5e5e5] leading-relaxed whitespace-pre-wrap">
              {currentPreset.architecture.join('\n')}
            </pre>
          </div>
        </div>
      )}

      {/* ═══ 3. EXPOSURE SUMMARY ════════════════════════════════ */}
      {results && (
        <>
          <div className="terminal-box">
            <div className="p-3 border-b border-[#262626]">
              <h3 className="mono text-sm text-[#e5e5e5]">Exposure Summary</h3>
            </div>
            <div className="p-4">
              <div className="mb-6">
                <div className="text-[#737373] text-xs mono">Monthly Inference Cost (C)</div>
                <div className="text-3xl mono font-semibold text-[#06b6d4]">
                  {fmtCost(results.totalCost)}
                  <span className="text-sm text-[#525252] ml-2">/month</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#0a0a0a] p-3 border border-[#262626]">
                  <div className="text-[#525252] text-xs mono">kappa</div>
                  <div className="mono text-lg text-[#e5e5e5]">{results.weightedKappa.toFixed(2)}</div>
                  <div className="text-[#525252] text-[10px] mono">context multiplier</div>
                </div>
                <div className="bg-[#0a0a0a] p-3 border border-[#262626]">
                  <div className="text-[#525252] text-xs mono">theta</div>
                  <div className={`mono text-lg ${results.weightedTheta > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    -{(results.weightedTheta * 100).toFixed(1)}%/mo
                  </div>
                  <div className="text-[#525252] text-[10px] mono">price decay</div>
                </div>
                <div className="bg-[#0a0a0a] p-3 border border-[#262626]">
                  <div className="text-[#525252] text-xs mono">cost/call</div>
                  <div className="mono text-lg text-[#e5e5e5]">${results.costPerCall.toFixed(4)}</div>
                  <div className="text-[#525252] text-[10px] mono">blended average</div>
                </div>
                <div className="bg-[#0a0a0a] p-3 border border-[#262626]">
                  <div className="text-[#525252] text-xs mono">annual run rate</div>
                  <div className="mono text-lg text-[#e5e5e5]">{fmtCost(results.totalCost * 12)}</div>
                  <div className="text-[#525252] text-[10px] mono">at current prices</div>
                </div>
              </div>

              {/* Forward Projections */}
              <div className="border-t border-[#262626] pt-4 mb-4">
                <div className="text-[#737373] text-xs mono mb-3">Forward Projections (theta decay)</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#0a0a0a] p-3 border border-[#262626]">
                    <div className="text-[#525252] text-xs mono">3M Forward</div>
                    <div className="mono text-lg text-[#e5e5e5]">{fmtCost(results.cost3M)}</div>
                    <div className="text-[#22c55e] text-xs mono">
                      -{((1 - results.decay3M) * 100).toFixed(1)}% | save {fmtCost(results.totalCost - results.cost3M)}/mo
                    </div>
                  </div>
                  <div className="bg-[#0a0a0a] p-3 border border-[#262626]">
                    <div className="text-[#525252] text-xs mono">6M Forward</div>
                    <div className="mono text-lg text-[#e5e5e5]">{fmtCost(results.cost6M)}</div>
                    <div className="text-[#22c55e] text-xs mono">
                      -{((1 - results.decay6M) * 100).toFixed(1)}% | save {fmtCost(results.totalCost - results.cost6M)}/mo
                    </div>
                  </div>
                </div>
              </div>

              {/* Cost breakdowns */}
              <div className="border-t border-[#262626] pt-4 mb-4">
                <div className="text-[#737373] text-xs mono mb-3">Cost by Model</div>
                <div className="space-y-2">
                  {results.modelBreakdown.map(m => {
                    const pct = results.totalCost > 0 ? (m.monthlyCost / results.totalCost) * 100 : 0;
                    return (
                      <div key={m.ticker} className="flex items-center gap-3">
                        <span className="mono text-xs text-[#e5e5e5] w-24 shrink-0">{m.ticker}</span>
                        <div className="flex-1 h-4 bg-[#0a0a0a] border border-[#262626] relative overflow-hidden">
                          <div className="h-full bg-[#06b6d4] opacity-50" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="mono text-xs text-[#e5e5e5] w-20 text-right">{fmtCost(m.monthlyCost)}</span>
                        <span className="mono text-xs text-[#525252] w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-[#262626] pt-4">
                <div className="text-[#737373] text-xs mono mb-3">Cost by Task Type</div>
                <div className="space-y-2">
                  {results.taskBreakdown.map(t => {
                    const pct = results.totalCost > 0 ? (t.monthlyCost / results.totalCost) * 100 : 0;
                    return (
                      <div key={t.type} className="flex items-center gap-3">
                        <span className="mono text-xs text-[#e5e5e5] w-24 shrink-0">{t.label}</span>
                        <div className="flex-1 h-4 bg-[#0a0a0a] border border-[#262626] relative overflow-hidden">
                          <div className="h-full bg-[#06b6d4] opacity-30" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="mono text-xs text-[#e5e5e5] w-20 text-right">{fmtCost(t.monthlyCost)}</span>
                        <span className="mono text-xs text-[#525252] w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ═══ 4. UNIT ECONOMICS ════════════════════════════════ */}
          <div className="terminal-box">
            <div className="p-3 border-b border-[#262626]">
              <div className="flex items-center justify-between">
                <h3 className="mono text-sm text-[#e5e5e5]">Unit Economics</h3>
                <span className="mono text-xs text-[#06b6d4]">
                  {'\u03C0'}(x) = x{'\u00B7'}p {'\u2212'} C(x) {'\u2212'} x{'\u00B7'}t {'\u2212'} F
                </span>
              </div>
            </div>
            <div className="p-4">
              {/* Inputs */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-[#737373] text-xs mono mb-1">Revenue per task (p)</label>
                  <input type="number" step="0.001" min="0" value={revenuePerTask}
                    onChange={(e) => { setRevenuePerTask(parseFloat(e.target.value) || 0); setActivePreset(null); }}
                    className="w-full mono text-sm" />
                </div>
                <div>
                  <label className="block text-[#737373] text-xs mono mb-1">Overhead per task (t)</label>
                  <input type="number" step="0.001" min="0" value={overheadPerTask}
                    onChange={(e) => { setOverheadPerTask(parseFloat(e.target.value) || 0); setActivePreset(null); }}
                    className="w-full mono text-sm" />
                </div>
                <div>
                  <label className="block text-[#737373] text-xs mono mb-1">Fixed costs / mo (F)</label>
                  <input type="number" step="100" min="0" value={fixedMonthlyCost}
                    onChange={(e) => { setFixedMonthlyCost(parseFloat(e.target.value) || 0); setActivePreset(null); }}
                    className="w-full mono text-sm" />
                </div>
              </div>

              {/* Summary metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#0a0a0a] p-3 border border-[#262626]">
                  <div className="text-[#525252] text-xs mono">monthly revenue</div>
                  <div className="mono text-lg text-[#e5e5e5]">{fmtCost(results.monthlyRevenue)}</div>
                </div>
                <div className="bg-[#0a0a0a] p-3 border border-[#262626]">
                  <div className="text-[#525252] text-xs mono">monthly profit</div>
                  <div className={`mono text-lg ${results.monthlyProfit >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {fmtCost(results.monthlyProfit)}
                  </div>
                </div>
                <div className="bg-[#0a0a0a] p-3 border border-[#262626]">
                  <div className="text-[#525252] text-xs mono">gross margin</div>
                  <div className={`mono text-lg ${results.grossMargin >= 0 ? 'text-[#e5e5e5]' : 'text-[#ef4444]'}`}>
                    {results.grossMargin.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-[#0a0a0a] p-3 border border-[#262626]">
                  <div className="text-[#525252] text-xs mono">break-even volume</div>
                  <div className="mono text-lg text-[#e5e5e5]">
                    {results.breakEvenVolume ? fmtVol(results.breakEvenVolume) : 'N/A'}
                  </div>
                  <div className="text-[#525252] text-[10px] mono">
                    {results.marginPerTask > 0
                      ? `$${results.marginPerTask.toFixed(4)} margin/task`
                      : 'negative unit margin'}
                  </div>
                </div>
              </div>

              {/* Profit scaling table */}
              <div className="border-t border-[#262626] pt-4">
                <div className="text-[#737373] text-xs mono mb-3">Profit at Scale</div>
                <div className="overflow-x-auto">
                  <table className="data-table text-xs">
                    <thead>
                      <tr>
                        <th>Volume</th>
                        <th>Revenue</th>
                        <th>Inference</th>
                        <th>Overhead</th>
                        <th>Fixed</th>
                        <th>Profit</th>
                        <th>Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.profitTable.map((row) => (
                        <tr key={row.mult}
                          className={row.isCurrent ? '!bg-[#1a1a1a]' : ''}
                          style={row.isCurrent ? { backgroundColor: '#1a1a1a' } : undefined}>
                          <td className={row.isCurrent ? 'text-[#06b6d4]' : ''}>
                            {fmtVol(row.vol)}{row.isCurrent ? ' \u2190' : ''}
                          </td>
                          <td>{fmtCost(row.rev)}</td>
                          <td>{fmtCost(row.inf)}</td>
                          <td>{fmtCost(row.ovh)}</td>
                          <td>{fmtCost(fixedMonthlyCost)}</td>
                          <td className={row.profit >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                            {fmtCost(row.profit)}
                          </td>
                          <td className={row.margin >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                            {row.margin.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ 5. OPTIMIZATION LEVERS ═══════════════════════════ */}
          <div className="terminal-box">
            <div className="p-3 border-b border-[#262626]">
              <h3 className="mono text-sm text-[#e5e5e5]">Optimization Levers</h3>
            </div>
            <div className="p-4">
              {/* Preset-specific insights */}
              {currentPreset && (
                <div className="mb-4 space-y-2">
                  {currentPreset.insights.map((insight, i) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <span className="text-[#06b6d4] mono shrink-0">{'\u25B8'}</span>
                      <span className="text-[#737373]">{insight}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Savings opportunities */}
              {results.savings.length > 0 && (
                <div className={currentPreset ? 'border-t border-[#262626] pt-4' : ''}>
                  <div className="text-[#737373] text-xs mono mb-3">Ranked Savings</div>
                  <div className="space-y-3">
                    {results.savings.map((s, i) => (
                      <div key={s.id}
                        className="bg-[#0a0a0a] p-3 border border-[#262626] flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="mono text-xs text-[#525252]">#{i + 1}</span>
                            <span className="mono text-sm text-[#e5e5e5]">{s.label}</span>
                          </div>
                          <div className="text-[#525252] text-xs mt-1">{s.desc}</div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <div className="mono text-[#22c55e] text-sm">-{fmtCost(s.amount)}/mo</div>
                          <div className="mono text-[#525252] text-xs">-{s.pct.toFixed(1)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
