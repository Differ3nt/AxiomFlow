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

  approve(): void {
    this.store.toggleApproved();
  }

  downloadPdf(): void {
    const top = this.topCandidates();
    const all = this.allCandidates();
    const kpis = this.kpis();
    const sections = this.sections();
    const lines: string[] = [
      'AxiomFlow R&D Investigation Report',
      '====================================',
      '',
      `Problem: ${this.store.problemDraft()}`,
      '',
      '--- Top Solutions ---',
      ...top.map(c => `#${c.rank} ${c.name} (${c.confidence}% confidence) — ${c.trizPrinciple}`),
      '',
      '--- KPIs ---',
      ...kpis.map(k => `${k.label}: ${k.value} — ${k.note}`),
      '',
      '--- All Candidates ---',
      ...all.map(c => `${c.rejected ? '✕' : '#' + c.rank} ${c.name} [${c.method}] ${c.confidence}%`),
      '',
      ...sections.map(s => [`--- ${s.title} ---`, s.body ?? '', '']).flat(),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'axiomflow-report.txt';
    a.click();
    URL.revokeObjectURL(url);
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

  splitIntoParagraphs(text: string): string[] {
    if (!text) return [];
    const sentences = text.match(/[^.!?]+[.!?]+["']?\s*/g) ?? [text];
    const result: string[] = [];
    for (let i = 0; i < sentences.length; i += 2) {
      const para = sentences.slice(i, i + 2).join('').trim();
      if (para) result.push(para);
    }
    return result;
  }

  chartOptions = computed<EChartsOption>(() => {
    const candidates = this.topCandidates();
    if (!candidates || candidates.length === 0) return {};

    const isDark = this.store.theme() === 'dark';
    const textColor   = isDark ? '#e8e8e8' : '#111111';
    const mutedColor  = isDark ? '#aaaaaa' : '#555555';
    const borderColor = isDark ? '#404040' : '#d0d0d0';

    const colors = ['#26BDE2', '#FCC30B', '#FD6925'];
    const axes = ['Feasibility', 'Energy Impact', 'Equip. Strain', 'Side Effects', 'Overall Score', 'Confidence'];

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const vals: number[] = params.value ?? [];
          const rows = axes
            .map((ax, i) => '<span style="color:' + mutedColor + '">' + ax + '</span> <b>' + Math.round(vals[i] ?? 0) + '</b>')
            .join('<br/>');
          return '<b style="font-size:13px;color:' + textColor + '">' + params.name + '</b><br/><br/>' + rows;
        },
      },
      legend: {
        orient: 'vertical',
        left: 16,
        top: 'middle',
        itemGap: 18,
        icon: 'circle',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: textColor, fontSize: 13, lineHeight: 20 },
        formatter: (name: string) => name.length > 30 ? name.slice(0, 30) + '…' : name,
      },
      radar: {
        center: ['60%', '50%'],
        radius: '64%',
        indicator: axes.map(name => ({ name, max: 100 })),
        axisName: {
          color: textColor,
          fontSize: 14,
          fontWeight: 700,
          padding: [4, 8],
        },
        splitNumber: 4,
        splitArea: {
          areaStyle: {
            color: isDark
              ? ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)']
              : ['rgba(0,0,0,0.02)',       'rgba(0,0,0,0.05)',       'rgba(0,0,0,0.02)',       'rgba(0,0,0,0.05)'],
          },
        },
        splitLine: { lineStyle: { color: borderColor, width: 1 } },
        axisLine:  { lineStyle: { color: borderColor, width: 1 } },
      },
      series: [{
        type: 'radar',
        emphasis: { lineStyle: { width: 3 } },
        data: candidates.map((c, i) => ({
          value: [
            c.scores?.feasibility     ?? 0,
            c.scores?.energyImpact    ?? 0,
            c.scores?.equipmentStrain ?? 0,
            c.scores?.sideEffects     ?? 0,
            c.confidence              ?? 0,
            c.confidence              ?? 0,
          ],
          name: c.name,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: colors[i % colors.length] },
          lineStyle: { color: colors[i % colors.length], width: 2 },
          areaStyle: { color: colors[i % colors.length], opacity: 0.08 },
        })),
      }],
    };
  });
}
