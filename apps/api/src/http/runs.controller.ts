import { Controller, Post, Get, Param, Body, Sse } from '@nestjs/common';
import { ReasoningPipeline } from '../reasoning/reasoning.pipeline';
import { Observable } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TrailService, NodeExecution } from '@axiomflow/data-access-db';
import { v4 as uuidv4 } from 'uuid';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

export class StartRunDto {
  problem: string;
  temperature?: number;
  methods?: string[];
  context?: string;
}

@ApiTags('Runs')
@Controller('runs')
export class RunsController {
  constructor(
    private readonly pipeline: ReasoningPipeline,
    private readonly eventEmitter: EventEmitter2,
    private readonly trail: TrailService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Start a new reasoning run' })
  @ApiResponse({ status: 201, description: 'The run ID' })
  startRun(@Body() body: StartRunDto): { id: string } {
    const runId = uuidv4();
    
    // Start asynchronously so we don't block the HTTP response
    setTimeout(async () => {
      try {
        await this.pipeline.solve(body.problem, runId, body.temperature, body.methods, body.context);
      } catch (e) {
        console.error('Run failed', e);
        this.eventEmitter.emit(`run.${runId}.event`, { type: 'error', error: e.message });
      }
    }, 0);

    return { id: runId };
  }

  @Sse(':id/stream')
  @ApiOperation({ summary: 'Stream reasoning run events via SSE' })
  stream(@Param('id') runId: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const onEvent = (data: any) => {
        subscriber.next(new MessageEvent('message', { data: JSON.stringify(data) }));
        if (data.type === 'completed' || data.type === 'error') {
          setTimeout(() => subscriber.complete(), 500); // Give it a moment to send the event
        }
      };

      this.eventEmitter.on(`run.${runId}.event`, onEvent);

      return () => {
        this.eventEmitter.off(`run.${runId}.event`, onEvent);
      };
    });
  }

  @Get(':id/trail')
  @ApiOperation({ summary: 'Get the full reasoning trail for a run' })
  async getTrail(@Param('id') runId: string): Promise<NodeExecution[]> {
    return this.trail.getTrail(runId);
  }
}
