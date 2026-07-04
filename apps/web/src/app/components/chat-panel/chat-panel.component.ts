import { ChangeDetectionStrategy, Component, ElementRef, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvestigationStore } from '../../state/investigation.store';

const SUGGESTED_PROMPTS = [
  'Explain the winning solution in plain English',
  'What are the main risks of this approach?',
  'How does TRIZ apply here?',
  'What if we do nothing?',
];

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.scss',
})
export class ChatPanelComponent {
  readonly store = inject(InvestigationStore);
  readonly suggestedPrompts = SUGGESTED_PROMPTS;

  @ViewChild('chatBody') chatBody!: ElementRef<HTMLDivElement>;

  send(): void {
    const text = this.store.chatInput();
    if (!text.trim()) return;
    this.store.sendChatMessage(text).then(() => this.scrollToBottom());
  }

  useChip(prompt: string): void {
    this.store.setChatInput(prompt);
    this.store.sendChatMessage(prompt).then(() => this.scrollToBottom());
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.chatBody?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }
}
