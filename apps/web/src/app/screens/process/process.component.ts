import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  InvestigationStore,
  STEP_DEFS,
  WHITE_CANDIDATES,
  GREEN_CANDIDATES,
} from '../../state/investigation.store';

@Component({
  selector: 'app-process-screen',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './process.component.html',
  styleUrl: './process.component.scss',
})
export class ProcessScreenComponent {
  readonly store = inject(InvestigationStore);
  readonly stepDefs = STEP_DEFS;
  readonly whiteCandidates = this.store.whiteCandidates;
  readonly greenCandidates = this.store.greenCandidates;

  readonly steps = computed(() => {
    const active = this.store.activeStep();
    const focus  = this.store.focusStep();
    return STEP_DEFS.map((st, i) => {
      const status = i < active ? 'done' : i === active ? 'active' : 'pending';
      return {
        ...st,
        status,
        isFocus: i === focus,
        chipContent: status === 'done' ? '✓' : String(st.n),
        ariaLabel: `Step ${st.n} — ${st.plainName} (${status})`,
      };
    });
  });

  readonly focusStep = computed(() => {
    const idx = Math.min(this.store.focusStep(), 5);
    const active = this.store.activeStep();
    const status = idx < active ? 'done' : idx === active ? 'active' : 'pending';
    const st = STEP_DEFS[idx];
    return { ...st, status, idx };
  });

  readonly focusBadge = computed(() => {
    const s = this.focusStep().status;
    return {
      text:  s === 'done' ? 'Complete' : s === 'active' ? 'In progress' : 'Waiting',
      color: s === 'done' ? 'var(--accent-strong)' : s === 'active' ? 'var(--warning-strong)' : 'var(--text-dim)',
      bg:    s === 'done' ? 'var(--accent-soft-bg)' : s === 'active' ? 'var(--warning-soft-bg)' : 'var(--bg-elevated)',
    };
  });

  readonly elapsed = computed(() => {
    const times = ['0s', '4s', '7s', '9s', '16s', '1m 44s', '3m 47s'];
    return times[Math.min(this.store.activeStep() + 1, 6)];
  });

  clickStep(idx: number): void {
    this.store.setFocusStep(idx);
  }

  goAnswer(): void {
    this.store.goAnswer();
  }
}
