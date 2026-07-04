import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { InvestigationStore } from '../../state/investigation.store';

const SUGGESTED_PROMPTS = [
  'Explain in plain English',
  'What are the risks?',
  'How much does it cost?',
  'What if we do nothing?',
];

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.scss',
})
export class ChatPanelComponent {
  readonly store = inject(InvestigationStore);
  readonly suggestedPrompts = SUGGESTED_PROMPTS;
}
