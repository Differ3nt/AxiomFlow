import { ChangeDetectionStrategy, Component, ElementRef, inject, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  InvestigationStore,
  SUGGESTED_PROBLEMS,
} from '../../state/investigation.store';



interface Method {
  name: string;
  icon: string;
  label: string;
  desc: string;
  available: boolean;
}

const SECOND_METHODS: Method[] = [
  {
    name: 'First-principles',
    icon: '🌱',
    label: 'Physics First',
    desc: 'Decomposes the contradiction into thermodynamics, fluid dynamics, or electromagnetism. Runs in parallel with TRIZ — the best cross-validation.',
    available: true,
  },
  {
    name: 'SCAMPER',
    icon: '🎨',
    label: 'SCAMPER',
    desc: 'Systematic variations: Substitute, Combine, Adapt, Modify, Put to other use, Eliminate, Reverse.',
    available: false,
  },
  {
    name: 'Biomimicry',
    icon: '🦋',
    label: 'Biomimicry',
    desc: 'Search for analogous solutions already evolved in nature.',
    available: false,
  },
  {
    name: 'Morphological',
    icon: '🧬',
    label: 'Morphological',
    desc: 'Enumerate attribute combinations across a solution matrix.',
    available: false,
  },
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
  readonly secondMethods = SECOND_METHODS;
  readonly errorRequirements = ERROR_REQUIREMENTS;
  readonly dragOver = signal(false);

  readonly selectedSecond = signal<string | null>('First-principles');

  readonly methodChipLabel = signal('TRIZ + Physics');

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  useSuggestion(draft: string): void {
    this.store.setProblemDraft(draft);
  }

  openFilePicker(): void {
    this.fileInput.nativeElement.click();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.store.addFiles(Array.from(input.files));
      input.value = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(): void {
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) this.store.addFiles(files);
  }

  selectSecond(name: string | null): void {
    this.selectedSecond.set(name);
    if (name === null) {
      this.methodChipLabel.set('TRIZ only');
    } else {
      const m = SECOND_METHODS.find(x => x.name === name);
      this.methodChipLabel.set('TRIZ + ' + (m?.label ?? name));
    }
  }

  start(): void {
    const second = this.selectedSecond();
    const methods = second ? [second] : ['TRIZ'];
    this.store.startInvestigation(methods);
  }

  formatSize(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
