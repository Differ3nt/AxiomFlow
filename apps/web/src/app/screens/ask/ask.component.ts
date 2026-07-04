import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  InvestigationStore,
  SUGGESTED_PROBLEMS,
} from '../../state/investigation.store';



interface Method { name: string; icon: string; desc: string; selected: boolean; }

const METHODS: Method[] = [
  { name: 'First-principles', icon: '🌱', desc: 'Break the problem down to physics, rebuild without assumptions.', selected: true },
  { name: 'SCAMPER',          icon: '🎨', desc: 'Systematic variations: Substitute, Combine, Adapt, Modify, Put to other use, Eliminate, Reverse.', selected: false },
  { name: 'Biomimicry',       icon: '🦋', desc: 'Search for analogous solutions already evolved in nature.', selected: false },
  { name: 'Morphological',    icon: '🧬', desc: 'Enumerate attribute combinations across a solution matrix.', selected: false },
];

const ERROR_REQUIREMENTS = [
  { status: '✕', iconBg: 'var(--error-soft-bg)',   iconColor: 'var(--error-strong)',   title: 'What should improve?',                   hint: 'e.g. "more freshwater output", "shorter curing time"' },
  { status: '✕', iconBg: 'var(--error-soft-bg)',   iconColor: 'var(--error-strong)',   title: 'What tends to worsen when we push that?', hint: 'e.g. "energy consumption", "material cost"' },
  { status: '~', iconBg: 'var(--warning-soft-bg)', iconColor: 'var(--warning-strong)', title: 'A hard constraint',                       hint: 'budget · timeline · physical limit · regulation' },
];

@Component({
  selector: 'app-ask-screen',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ask.component.html',
  styleUrl: './ask.component.scss',
})
export class AskScreenComponent {
  readonly store = inject(InvestigationStore);
  readonly suggestedProblems = SUGGESTED_PROBLEMS;
  readonly methods = METHODS;
  readonly errorRequirements = ERROR_REQUIREMENTS;

  useSuggestion(draft: string): void {
    this.store.setProblemDraft(draft);
  }



  selectMethod(m: Method): void {
    this.methods.forEach(x => (x.selected = false));
    m.selected = true;
  }

  start(): void {
    const selectedMethods = this.methods.filter(m => m.selected).map(m => m.name);
    this.store.startInvestigation(selectedMethods);
  }
}
