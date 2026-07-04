import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Run, NodeExecution } from './models';

@Injectable()
export class TrailService {
  constructor(
    @InjectModel(Run) private runModel: typeof Run,
    @InjectModel(NodeExecution) private nodeExecutionModel: typeof NodeExecution,
  ) {}

  async createRun(id: string, problem: string, temperature: number): Promise<Run> {
    return this.runModel.create({ id, problem, temperature });
  }

  async record(runId: string, nodeName: string, data: { input?: any; output?: any; raw?: any; tokens?: any; latencyMs?: number }): Promise<NodeExecution> {
    return this.nodeExecutionModel.create({
      runId,
      nodeName,
      input: data.input,
      output: data.output,
      raw: data.raw,
      tokens: data.tokens,
      latencyMs: data.latencyMs,
    });
  }
  
  async getTrail(runId: string): Promise<NodeExecution[]> {
    return this.nodeExecutionModel.findAll({
      where: { runId },
      order: [['createdAt', 'ASC']],
    });
  }
}
