import { ChangeDetectionStrategy, Component, effect, inject, signal, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvestigationStore } from '../../state/investigation.store';
import { NgxGraphModule } from '@swimlane/ngx-graph';

@Component({
  selector: 'aqt-reasoning-graph',
  standalone: true,
  imports: [CommonModule, NgxGraphModule],
  templateUrl: './reasoning-graph.component.html',
  styleUrls: ['./reasoning-graph.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReasoningGraphComponent implements OnInit {
  store = inject(InvestigationStore);

  nodes = signal<any[]>([]);
  links = signal<any[]>([]);
  selectedNode = signal<any | null>(null);

  constructor() {
    effect(() => {
      const runId = this.store.currentRunId();
      if (runId) {
        this.fetchTrail(runId);
      }
    });
  }

  ngOnInit() {}

  async fetchTrail(runId: string) {
    try {
      const res = await fetch(`http://localhost:3000/runs/${runId}/trail`);
      const data = await res.json();
      
      const ngxNodes = [];
      const ngxLinks = [];
      
      let prevId = null;
      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        ngxNodes.push({
          id: d.id,
          label: d.nodeName,
          data: d
        });
        if (prevId) {
          ngxLinks.push({
            id: `l${i}`,
            source: prevId,
            target: d.id,
            label: 'next'
          });
        }
        prevId = d.id;
      }
      
      this.nodes.set(ngxNodes);
      this.links.set(ngxLinks);
    } catch (e) {
      console.error('Failed to fetch trail', e);
    }
  }

  onNodeClick(node: any) {
    this.selectedNode.set(node.data);
  }
}
