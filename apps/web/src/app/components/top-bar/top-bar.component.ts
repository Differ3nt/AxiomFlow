import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvestigationStore, STEP_DEFS } from '../../state/investigation.store';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
  readonly store = inject(InvestigationStore);
  readonly steps = STEP_DEFS;

  stepStatus(idx: number): 'done' | 'active' | 'pending' {
    const active = this.store.activeStep();
    if (idx < active) return 'done';
    if (idx === active) return 'active';
    return 'pending';
  }

  focusStep(idx: number): void {
    this.store.setFocusStep(idx);
    if (!this.store.isProcess()) this.store.screen.set('process');
  }
}
