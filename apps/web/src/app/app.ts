import { ChangeDetectionStrategy, Component, HostListener, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvestigationStore } from './state/investigation.store';
import { TopBarComponent } from './components/top-bar/top-bar.component';
import { ChatPanelComponent } from './components/chat-panel/chat-panel.component';
import { AskScreenComponent } from './screens/ask/ask.component';
import { ProcessScreenComponent } from './screens/process/process.component';
import { AnswerScreenComponent } from './screens/answer/answer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    TopBarComponent,
    ChatPanelComponent,
    AskScreenComponent,
    ProcessScreenComponent,
    AnswerScreenComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  readonly store = inject(InvestigationStore);

  @HostListener('document:keydown.meta.k', ['$event'])
  onCmdK(event: Event): void {
    event.preventDefault();
    this.store.toggleChat();
  }

  ngOnDestroy(): void {
    this.store.destroy();
  }
}
