import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvestigationStore } from '../../state/investigation.store';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ReasoningGraphComponent } from '../../components/reasoning-graph/reasoning-graph.component';
import type { EChartsOption } from 'echarts';

@Component({
  selector: 'app-answer-screen',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective, ReasoningGraphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './answer.component.html',
  styleUrl: './answer.component.scss',
})
export class AnswerScreenComponent {
  readonly store = inject(InvestigationStore);

  readonly topCandidates = this.store.topCandidates;
  readonly allCandidates = this.store.allCandidates;
  readonly kpis = this.store.kpis;
  readonly sections = this.store.sections;

  readonly openSections = signal<Record<string, boolean>>({
    s1: true, s2: false, s3: false, s4: false, s5: false,
  });

  toggleSection(key: string): void {
    this.openSections.update(s => ({ ...s, [key]: !s[key] }));
  }

  isOpen(key: string): boolean {
    return this.openSections()[key] ?? false;
  }

  confidenceColor(c: number): string {
    if (c === 0) return 'var(--error)';
    if (c >= 80) return 'var(--accent)';
    if (c >= 60) return 'var(--info)';
    return 'var(--warning)';
  }

  rankBadgeClass(rank: number): string {
    if (rank === 1) return 'rank-badge--gold';
    if (rank === 2) return 'rank-badge--silver';
    return 'rank-badge--bronze';
  }

  iterate(context: string): void {
    this.store.iterateWithCandidate(context);
  }

  chartOptions = computed<EChartsOption>(() => {
    const candidates = this.topCandidates();
    if (!candidates || candidates.length === 0) return {};
    
    return {
      tooltip: { trigger: 'item' },
      legend: {
        bottom: 0,
        data: candidates.map(c => c.name),
        textStyle: { color: 'var(--text)' }
      },
      radar: {
        indicator: [
          { name: 'Feasibility', max: 100 },
          { name: 'Energy', max: 100 },
          { name: 'Equipment', max: 100 },
          { name: 'Side Effects', max: 100 }
        ],
        axisName: { color: 'var(--text)' },
        splitArea: { areaStyle: { color: ['transparent'] } },
        splitLine: { lineStyle: { color: 'var(--border)' } },
        axisLine: { lineStyle: { color: 'var(--border)' } }
      },
      series: [{
        type: 'radar',
        data: candidates.map((c, i) => {
          const colors = ['#26BDE2', '#FCC30B', '#FD6925'];
          return {
            value: c.scores ? [c.scores.feasibility, c.scores.energyImpact, c.scores.equipmentStrain, c.scores.sideEffects] : [0,0,0,0],
            name: c.name,
            itemStyle: { color: colors[i % colors.length] },
            areaStyle: { opacity: 0.1 }
          };
        })
      }]
    };
  });
}
