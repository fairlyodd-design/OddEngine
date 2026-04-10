import { queuePanelAction, logActivity } from './brain';
import { pushNotif } from './notifs';
import { getOperatorSummary, pushOperatorMemory, readOperatorMemory, updatePanelContext } from './operatorMemory';
import { loadJSON, saveJSON } from './storage';

export const OPERATOR_ROUTINE_KEY = 'oddengine:operator:routines:v1';
export const OPERATOR_ROUTINE_EVENT = 'oddengine:operator-routines';

export type OperatorRoutineStep = {
  panelId: string;
  label: string;
  actionId?: string;
  note?: string;
};

export type OperatorRoutine = {
  id: string;
  title: string;
  subtitle: string;
  tone?: 'good' | 'warn' | 'bad' | 'muted';
  chips?: string[];
  steps: OperatorRoutineStep[];
};

export type OperatorRoutineRun = {
  id: string;
  title: string;
  startedAt: number;
  steps: OperatorRoutineStep[];
  completedSteps: string[];
  lastPanelId?: string;
};

export type OperatorRoutineState = {
  activeRun: OperatorRoutineRun | null;
  history: Array<{ id: string; title: string; ts: number; panels: string[] }>;
};

function emit() {
  try {
    window.dispatchEvent(new CustomEvent(OPERATOR_ROUTINE_EVENT, { detail: { ts: Date.now() } }));
  } catch {}
}

function defaultState(): OperatorRoutineState {
  return { activeRun: null, history: [] };
}

export function readOperatorRoutineState(): OperatorRoutineState {
  const raw = loadJSON<any>(OPERATOR_ROUTINE_KEY, defaultState());
  return {
    activeRun: raw?.activeRun || null,
    history: Array.isArray(raw?.history) ? raw.history : [],
  };
}

export function writeOperatorRoutineState(next: OperatorRoutineState) {
  saveJSON(OPERATOR_ROUTINE_KEY, next);
  emit();
}

export function getOperatorRoutines(): OperatorRoutine[] {
  const summary = getOperatorSummary();
  const panels = readOperatorMemory().panels;
  const trading = panels.Trading;
  const books = panels.Books;
  const budget = panels.FamilyBudget;

  const tradingSymbol = trading?.chips?.find((c) => /^[A-Z]{2,5}$/.test(c || '')) || 'SPY';
  const studioStage = books?.chips?.[0] || 'Draft';
  const budgetMove = budget?.nextMove || 'Open snapshot';

  return [
    {
      id: 'launch-day',
      title: 'Launch the day',
      subtitle: 'Home digest → Homie brief → budget truth → first operator move.',
      tone: 'good',
      chips: ['Daily', 'Home', 'Homie'],
      steps: [
        { panelId: 'Home', label: 'Refresh Mission Control', note: summary.text || 'Refresh digest and priorities.' },
        { panelId: 'Homie', label: 'Brief Homie', note: 'Ask what matters now and route the next best move.' },
        { panelId: 'FamilyBudget', label: 'Open budget snapshot', note: budget?.summary || 'Check bills, cash, and next money move.' },
      ],
    },
    {
      id: 'trading-focus',
      title: `Trading focus — ${tradingSymbol}`,
      subtitle: 'Kick off the trade workflow, focus best contract, and build a plan.',
      tone: 'warn',
      chips: ['Trading', tradingSymbol, trading?.chips?.[0] || 'Session'],
      steps: [
        { panelId: 'Trading', label: 'Focus best contract', actionId: 'trading:focus-best', note: trading?.summary || `Center the best fit for ${tradingSymbol}.` },
        { panelId: 'Trading', label: 'Build plan', actionId: 'trading:build-plan', note: trading?.nextMove || 'Draft a tighter plan in Notes.' },
        { panelId: 'Home', label: 'Return results to Mission Control', note: 'Push the setup back into Home memory.' },
      ],
    },
    {
      id: 'studio-sprint',
      title: 'Studio sprint',
      subtitle: 'Resume the active creation, lock the next stage, and keep output moving.',
      tone: 'good',
      chips: ['Studio', studioStage, 'Resume'],
      steps: [
        { panelId: 'Books', label: 'Resume last creation', note: books?.summary || 'Continue the current draft or final output.' },
        { panelId: 'Homie', label: 'Get creative brief', note: 'Ask Homie for the next best creative step.' },
        { panelId: 'Home', label: 'Update output registry', note: books?.nextMove || 'Push progress back into Home.' },
      ],
    },
    {
      id: 'money-reset',
      title: 'Money reset',
      subtitle: 'Sync cash truth, update payoff stance, and route the next smartest dollar move.',
      tone: 'warn',
      chips: ['Budget', 'Trading', 'Stability'],
      steps: [
        { panelId: 'FamilyBudget', label: 'Open Avalanche payoff', actionId: 'budget:payoff-avalanche', note: budgetMove },
        { panelId: 'FamilyBudget', label: 'Fund goals', actionId: 'budget:fund-goals', note: 'Apply one contribution pass where possible.' },
        { panelId: 'Trading', label: 'Build safer plan', actionId: 'trading:safer-setup', note: 'Keep risk tight before taking the next swing.' },
      ],
    },
  ];
}

export function triggerOperatorRoutine(routineId: string) {
  const routine = getOperatorRoutines().find((item) => item.id === routineId);
  if (!routine) return { ok: false, message: 'Routine not found.' };

  const state = readOperatorRoutineState();
  const run: OperatorRoutineRun = {
    id: `${routine.id}-${Date.now()}`,
    title: routine.title,
    startedAt: Date.now(),
    steps: routine.steps,
    completedSteps: routine.steps.map((s) => `${s.panelId}:${s.actionId || s.label}`),
    lastPanelId: routine.steps[routine.steps.length - 1]?.panelId,
  };

  for (const step of routine.steps) {
    if (step.actionId) queuePanelAction(step.panelId, step.actionId, { source: 'operatorRoutine', routineId: routine.id, title: routine.title });
    pushOperatorMemory(step.panelId, `Routine: ${routine.title}`, `${step.label}${step.note ? ` — ${step.note}` : ''}`);
    updatePanelContext(step.panelId, {
      title: step.panelId === 'Books' ? 'Writers Lounge' : step.panelId,
      summary: step.note || step.label,
      nextMove: step.label,
      tone: routine.tone || 'good',
      chips: routine.chips,
      routeHint: step.panelId,
      score: routine.tone === 'warn' ? 72 : 84,
    });
    logActivity({ kind: 'system', panelId: step.panelId, title: `Routine fired: ${routine.title}`, body: `${step.label}${step.note ? ` — ${step.note}` : ''}`, tags: ['routine', routine.id] });
  }

  state.activeRun = run;
  state.history = [{ id: run.id, title: routine.title, ts: run.startedAt, panels: [...new Set(routine.steps.map((s) => s.panelId))] }, ...state.history].slice(0, 10);
  writeOperatorRoutineState(state);
  pushNotif({ title: `Routine launched — ${routine.title}`, body: `${routine.steps.length} coordinated steps were queued across your operator panels.`, tags: ['Home', 'Routine'], level: 'success' });
  return { ok: true, message: `Launched ${routine.title}.`, routine };
}

export function clearActiveOperatorRoutine() {
  const state = readOperatorRoutineState();
  state.activeRun = null;
  writeOperatorRoutineState(state);
}

export function getOperatorRoutineSummary() {
  const state = readOperatorRoutineState();
  const routines = getOperatorRoutines();
  return {
    activeRun: state.activeRun,
    history: state.history,
    routines,
    text: state.activeRun
      ? `${state.activeRun.title} is active with ${state.activeRun.steps.length} coordinated step${state.activeRun.steps.length === 1 ? '' : 's'}.`
      : routines.length
      ? `Ready routines: ${routines.slice(0, 3).map((r) => r.title).join(' • ')}`
      : 'No routines are ready yet.',
  };
}
