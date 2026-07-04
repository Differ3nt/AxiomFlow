import { computed, effect, Injectable, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';

export type Screen = 'ask' | 'process' | 'answer';
export type Theme  = 'light' | 'dark';
export type StepStatus = 'done' | 'active' | 'pending';

export interface StepDef {
  n: number;
  plainName: string;
  duration: string;
  result: string;
  detail: string;
}

export interface Subtask {
  text: string;
  meta: string;
  status: 'done' | 'active' | 'pending';
}

export interface Candidate {
  name: string;
  pattern: string;
  confidence: number;
  selected?: boolean;
}

export interface LogLine {
  time: string;
  level: string;
  levelColor: string;
  text: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface AttachedFile {
  name: string;
  size: number;
  type: string;
}

export interface SuggestedProblem {
  text: string;
  draft: string;
}

export const STEP_DEFS: StepDef[] = [
  { n: 1, plainName: 'Read the problem',  duration: '4s',     result: 'Problem parsed · 218 chunks · 12 refs pulled.', detail: 'The assistant reads what you wrote plus any uploaded documents, and figures out what kind of problem this is. Nothing is answered yet — just careful listening.' },
  { n: 2, plainName: 'Find what matters', duration: '3s',     result: 'What must improve: freshwater. What tends to worsen: energy.', detail: 'Not every metric is equal. The assistant flags what should move up (freshwater output) and what usually pushes back (energy use).' },
  { n: 3, plainName: 'Name the tradeoff', duration: '2s',     result: 'Improve §26 (Amount) without worsening §20 (Energy of stationary object).', detail: 'Solving well starts with a precise conflict statement. TRIZ writes it as a clean pair of parameters — forcing the problem to state its terms.' },
  { n: 4, plainName: 'Look up patterns',  duration: '7s',     result: '4 TRIZ patterns matched: 35 · 19 · 3 · 27. Physics: 3 fundamentals identified.', detail: 'Two methods run in parallel. One matches the tradeoff to a database of proven inventive patterns. The other decomposes the problem into physics fundamentals.' },
  { n: 5, plainName: 'Draft ideas',       duration: '1m 48s', result: '6 candidate solutions written up with reasoning and source links.', detail: 'Each pattern and each physics angle becomes a real, written-up candidate solution. Six total, each with its own reasoning.' },
  { n: 6, plainName: 'Score & pick winner', duration: '1m 43s', result: 'Winner: Pulsed Pressure Osmosis (91% match). Full audit signed.', detail: 'Every candidate is scored on the same four dimensions — nothing is picked by vibes. The highest composite score wins, and the full audit trail is signed.' },
];

export const ALL_LOG_LINES: LogLine[] = [];
export const WHITE_CANDIDATES: Candidate[] = [];
export const GREEN_CANDIDATES: Candidate[] = [];

export const SUGGESTED_PROBLEMS: SuggestedProblem[] = [
  { text: 'Reduce concrete CO₂ without losing strength', draft: 'We want to cut the CO₂ footprint of our concrete mix without losing compressive strength or extending curing time.' },
  { text: 'Cheaper cold-chain for vaccines in rural Africa', draft: "Deliver vaccines that need 2-8°C to rural clinics with unreliable power. Can't afford diesel generators." },
  { text: 'Lithium recovery from spent EV batteries', draft: 'Extract high-purity lithium from end-of-life EV batteries without producing hazardous waste streams.' },
];

@Injectable({ providedIn: 'root' })
export class InvestigationStore {
  private readonly doc = inject(DOCUMENT);

  // ---- Core state ----
  readonly theme  = signal<Theme>('light');
  readonly screen = signal<Screen>('ask');
  readonly chatOpen = signal(false);

  // ---- Ask ----
  readonly problemDraft = signal('');
  readonly askDocsOpen   = signal(false);
  readonly askMethodOpen = signal(false);
  readonly askAdvOpen    = signal(false);
  readonly askError      = signal(false);
  readonly askShake      = signal(false);
  readonly temperature   = signal(0.7);
  readonly iterationContext = signal<string | null>(null);
  readonly currentRunId = signal<string | null>(null);

  // ---- Process ----
  readonly activeStep = signal(0);
  readonly focusStep  = signal(0);
  readonly logOpen    = signal(false);

  // ---- Answer ----
  readonly answerSections  = signal<Record<string, boolean>>({ s1: false, s2: false, s3: false, s4: false, s5: false });
  readonly whiteCandidates = signal<Candidate[]>([]);
  readonly greenCandidates = signal<Candidate[]>([]);
  readonly consoleLogList  = signal<LogLine[]>([]);
  readonly winner          = signal<any>(null);
  readonly approved = signal(false);

  readonly topCandidates = signal<any[]>([]);
  readonly allCandidates = signal<any[]>([]);
  readonly kpis          = signal<any[]>([]);
  readonly sections      = signal<any[]>([]);

  // ---- Chat ----
  readonly chatMessages = signal<ChatMessage[]>([]);
  readonly chatLoading  = signal(false);
  readonly chatInput    = signal('');

  // ---- Documents ----
  readonly attachedFiles = signal<AttachedFile[]>([]);

  // ---- Computed ----
  readonly isAsk     = computed(() => this.screen() === 'ask');
  readonly isProcess = computed(() => this.screen() === 'process');
  readonly isAnswer  = computed(() => this.screen() === 'answer');

  readonly screenLabel = computed(() => {
    if (this.isProcess()) return 'Analysis in progress';
    if (this.isAnswer())  return 'Answer';
    return 'Ask';
  });

  readonly themeIcon = computed(() => this.theme() === 'dark' ? '☀' : '🌙');

  readonly showBreadcrumb = computed(() => !this.isAsk());

  readonly processDone = computed(() => this.activeStep() >= 5);

  readonly consoleLog = computed(() => this.consoleLogList());

  readonly processPct = computed(() => ((Math.min(this.activeStep(), 5) / 5) * 100) + '%');

  readonly processStateText = computed(() =>
    this.activeStep() >= 5
      ? 'Investigation complete · winner ready'
      : `Analyzing · step ${Math.min(this.activeStep(), 5) + 1} of 6`
  );

  readonly reportContext = computed(() => {
    const top = this.topCandidates();
    const w = this.winner();
    if (!top.length && !w) return '';
    const lines: string[] = [`Problem: ${this.problemDraft()}`];
    if (w) lines.push(`Winner: ${w.title ?? w.name}`);
    top.forEach((c, i) => lines.push(`Rank ${i + 1}: ${c.name} (${c.confidence}% confidence, ${c.trizPrinciple})`));
    return lines.join('\n');
  });

  private _stepTimer?: ReturnType<typeof setInterval>;
  private _logTimer?:  ReturnType<typeof setInterval>;
  private _shakeTimer?: ReturnType<typeof setTimeout>;
  private _eventSource?: EventSource;

  constructor() {
    // Restore theme from localStorage
    try {
      const saved = localStorage.getItem('aqt-theme-v2') as Theme | null;
      if (saved === 'dark' || saved === 'light') this.theme.set(saved);
    } catch { /* ignore */ }

    // Apply theme attribute on root
    effect(() => {
      this.doc.documentElement.setAttribute('data-theme', this.theme());
    });
  }

  // ---- Actions ----
  setTheme(t: Theme): void {
    this.theme.set(t);
    try { localStorage.setItem('aqt-theme-v2', t); } catch { /* ignore */ }
  }

  toggleTheme(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  toggleChat(): void { this.chatOpen.update(v => !v); }
  closeChat():  void { this.chatOpen.set(false); }

  goAsk(): void { this.screen.set('ask'); }

  goAnswer(): void { this.screen.set('answer'); }

  setFocusStep(idx: number): void { this.focusStep.set(idx); }

  toggleLog(): void { this.logOpen.update(v => !v); }

  toggleAskDocs():   void { this.askDocsOpen.update(v => !v); }
  toggleAskMethod(): void { this.askMethodOpen.update(v => !v); }
  toggleAskAdv():    void { this.askAdvOpen.update(v => !v); }

  dismissAskError(): void { this.askError.set(false); }

  setProblemDraft(val: string): void { this.problemDraft.set(val); }
  setTemperature(val: number): void { this.temperature.set(val); }

  fillExample(): void {
    this.problemDraft.set('We need to get more freshwater out of our desalination plant without a matching jump in electricity use or membrane wear. The feed water is high-salinity reject brine from a chemical plant. Cost has to stay within 10% of our current baseline.');
    this.askError.set(false);
  }

  toggleApproved(): void { this.approved.update(v => !v); }

  addFiles(files: File[]): void {
    const next = files.map(f => ({ name: f.name, size: f.size, type: f.type }));
    this.attachedFiles.update(existing => {
      const names = new Set(existing.map(e => e.name));
      return [...existing, ...next.filter(f => !names.has(f.name))];
    });
  }

  removeFile(name: string): void {
    this.attachedFiles.update(files => files.filter(f => f.name !== name));
  }

  setChatInput(val: string): void { this.chatInput.set(val); }

  async sendChatMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || this.chatLoading()) return;
    this.chatMessages.update(msgs => [...msgs, { role: 'user', text: trimmed }]);
    this.chatInput.set('');
    this.chatLoading.set(true);
    try {
      const res = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, context: this.reportContext() }),
      });
      const data = await res.json();
      this.chatMessages.update(msgs => [...msgs, { role: 'assistant', text: data.reply }]);
    } catch {
      this.chatMessages.update(msgs => [...msgs, { role: 'assistant', text: 'Could not reach the assistant. Make sure the API is running.' }]);
    } finally {
      this.chatLoading.set(false);
    }
  }

  iterateWithCandidate(context: string, methods: string[] = ['First-principles']): void {
    this.iterationContext.set(context);
    this.startInvestigation(methods);
  }

  toggleAnswerSection(key: string): void {
    this.answerSections.update(s => ({ ...s, [key]: !s[key] }));
  }

  async startInvestigation(methods: string[] = ['First-principles']): Promise<void> {
    const words = this.problemDraft().trim().split(/\s+/).filter(Boolean);
    if (words.length < 12) {
      this.askError.set(true);
      this.askShake.set(true);
      if (this._shakeTimer) clearTimeout(this._shakeTimer);
      this._shakeTimer = setTimeout(() => this.askShake.set(false), 500);
      return;
    }
    this.askError.set(false);
    this.screen.set('process');
    this.activeStep.set(0);
    this.focusStep.set(0);
    this.consoleLogList.set([]);
    this.whiteCandidates.set([]);
    this.greenCandidates.set([]);
    this.winner.set(null);
    this.currentRunId.set(null);

    try {
      const res = await fetch('http://localhost:3000/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          problem: this.problemDraft(), 
          temperature: this.temperature(),
          methods,
          context: this.iterationContext() 
        })
      });
      const data = await res.json();
      this.currentRunId.set(data.id);
      
      if (this._eventSource) {
        this._eventSource.close();
      }
      this._eventSource = new EventSource(`http://localhost:3000/runs/${data.id}/stream`);
      
      this._eventSource.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'step') {
          this.activeStep.set(msg.step);
          this.focusStep.set(msg.step);
        } else if (msg.type === 'log') {
          this.consoleLogList.update(logs => [...logs, {
            time: msg.time,
            level: msg.level,
            levelColor: msg.levelColor,
            text: msg.text
          }]);
        } else if (msg.type === 'completed') {
          this._eventSource?.close();
          const report = msg.report;
          
          this.whiteCandidates.set(report.candidates.filter((c: any) => c.method === 'triz').map((c: any) => ({
            name: c.title,
            pattern: c.basis,
            confidence: 80, // mocked metric
            selected: report.choice.candidate.id === c.id
          })));

          this.greenCandidates.set(report.candidates.filter((c: any) => c.method === 'physics').map((c: any) => ({
            name: c.title,
            pattern: c.basis,
            confidence: 70, // mocked metric
            selected: report.choice.candidate.id === c.id
          })));
          
          this.winner.set(report.choice.candidate);
          this.activeStep.set(5);

          // Populate Answer screen data
          const sortedCandidates = [...report.evaluations].sort((a: any, b: any) => b.score - a.score);
          
          const mappedCandidates = report.candidates.map((c: any) => {
            const evalData = report.evaluations.find((e: any) => e.candidateId === c.id);
            const isWinner = report.choice.candidate.id === c.id;
            const rank = sortedCandidates.findIndex((e: any) => e.candidateId === c.id) + 1;
            const rejectedCheck = report.physicalLimitChecks?.find((p: any) => p.candidateId === c.id);
            const rejected = rejectedCheck ? !rejectedCheck.feasible : false;
            
            return {
              rank: rejected ? 99 : (rank || 99),
              name: c.title,
              method: c.method === 'triz' ? 'TRIZ' : 'Physics',
              confidence: evalData ? Math.round(evalData.score) : 0,
              payback: 'N/A', // Mocked as backend doesn't provide
              trizPrinciple: c.basis,
              summary: evalData?.reasoning || rejectedCheck?.reason || c.description,
              isWinner,
              rejected,
              rejectReason: rejectedCheck?.reason,
              scores: evalData ? {
                feasibility: evalData.feasibility,
                energyImpact: evalData.energyImpact,
                equipmentStrain: evalData.equipmentStrain,
                sideEffects: evalData.sideEffects,
              } : null
            };
          }).sort((a: any, b: any) => a.rank - b.rank);
          
          // Reassign sequential ranks for display
          let currentRank = 1;
          mappedCandidates.forEach((mc: any) => {
            if (!mc.rejected) {
              mc.rank = currentRank++;
            } else {
              mc.rank = 99;
            }
          });
          
          this.allCandidates.set(mappedCandidates);
          
          const topFeasible = mappedCandidates.filter((c: any) => !c.rejected);
          const toShow = topFeasible.length > 0 ? topFeasible.slice(0, 3) : mappedCandidates.slice(0, 3);
          this.topCandidates.set(toShow);
          
          this.kpis.set([
            { label: 'Feasibility', value: report.choice.evaluation.feasibility + '/100', deltaPositive: true, note: 'scored by logic' },
            { label: 'Energy Impact', value: report.choice.evaluation.energyImpact + '/100', deltaPositive: true, note: 'scored by logic' },
            { label: 'Equipment Strain', value: report.choice.evaluation.equipmentStrain + '/100', deltaPositive: true, note: 'scored by logic' },
            { label: 'Side Effects', value: report.choice.evaluation.sideEffects + '/100', deltaPositive: true, note: 'scored by logic' },
            { label: 'Final Score', value: Math.round(report.choice.evaluation.score) + '/100', deltaPositive: true, note: 'weighted sum' },
          ]);
          
          this.sections.set([
            {
              key: 's1',
              title: 'Why this solution won',
              icon: '🏆',
              body: report.choice.justification,
              description: report.choice.candidate.description,
              basis: report.choice.candidate.basis,
            },
            {
              key: 's3',
              title: 'All candidates',
              icon: '⚖',
              body: 'table',
            },
            {
              key: 's4',
              title: 'Original problem framing',
              icon: '📝',
              body: `**Input problem:** "${report.problem}"\n\n**Reformulated contradiction:**\n- **Improving parameter:** ${report.contradiction.improving.name} (${report.contradiction.improving.id})\n- **Worsening parameter:** ${report.contradiction.worsening.name} (${report.contradiction.worsening.id})\n\n**Statement:** ${report.contradiction.statement}`,
            }
          ]);
        }
      };
      
      this._eventSource.onerror = (err) => {
        console.error('SSE error:', err);
        this._eventSource?.close();
      };
      
    } catch (err) {
      console.error('API call failed', err);
    }
  }

  destroy(): void {
    if (this._eventSource) this._eventSource.close();
  }
}
