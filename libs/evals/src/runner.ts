import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../apps/api/src/app.module';
import { ReasoningPipeline } from '../../../apps/api/src/reasoning/reasoning.pipeline';
import { SEED_PROBLEMS } from './problems';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const pipeline = app.get(ReasoningPipeline);

  console.log('Starting Evaluation Runner...');
  
  const results = [];
  
  for (const problem of SEED_PROBLEMS) {
    console.log(`\nEvaluating [${problem.type}]: ${problem.text.substring(0, 50)}...`);
    const startTime = Date.now();
    let status = 'SUCCESS';
    let errorMessage = null;
    let report = null;
    
    try {
      report = await pipeline.solve(problem.text, undefined, 0.7, ['First-principles']);
    } catch (e: any) {
      status = 'FAILED';
      errorMessage = e.message;
    }
    
    const latency = Date.now() - startTime;
    
    results.push({
      type: problem.type,
      text: problem.text,
      status,
      latencyMs: latency,
      error: errorMessage,
      winner: report?.choice?.candidate?.title || 'None',
      score: report?.choice?.evaluation?.score || 0
    });
  }
  
  const markdown = [
    '# Evaluation Report',
    '',
    `*Generated on: ${new Date().toISOString()}*`,
    '',
    '## Summary',
    `- Total Problems: ${SEED_PROBLEMS.length}`,
    `- Success Rate: ${results.filter(r => r.status === 'SUCCESS').length} / ${SEED_PROBLEMS.length}`,
    `- Average Latency: ${Math.round(results.reduce((acc, r) => acc + r.latencyMs, 0) / SEED_PROBLEMS.length)}ms`,
    '',
    '## Detailed Results',
    '| Type | Problem Snippet | Status | Latency | Winner | Score | Error |',
    '|---|---|---|---|---|---|---|',
    ...results.map(r => `| ${r.type} | ${r.text.substring(0, 30)}... | ${r.status} | ${r.latencyMs}ms | ${r.winner} | ${Math.round(r.score)} | ${r.error || '-'} |`)
  ].join('\n');
  
  const outPath = path.join(__dirname, '../../../docs/evaluation-report.md');
  fs.writeFileSync(outPath, markdown);
  
  console.log(`\nEvaluation complete. Report saved to ${outPath}`);
  
  await app.close();
  process.exit(0);
}

bootstrap();
