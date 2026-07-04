import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ReasoningPipeline } from './reasoning/reasoning.pipeline';
import { ReportService } from './reasoning/report.service';
import { parseCliArgs, USAGE } from './cli';

/**
 * Console entrypoint for the reasoning pipeline. This boots a Nest application context
 * (no HTTP server) so the exact same providers/modules can later be reused behind a
 * REST controller for the web frontend without any rewrite.
 *
 * Usage: see USAGE in ./cli.ts (node main.js --help)
 */
async function bootstrap() {
  const logger = new Logger('CLI');
  const args = parseCliArgs(process.argv.slice(2));

  if (args.help) {
    console.log(USAGE);
    return;
  }

  if (!args.problem) {
    console.error('Error: a problem statement is required (positional argument or --file).\n');
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const problem = args.problem;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const pipeline = app.get(ReasoningPipeline);
    const reportService = app.get(ReportService);

    const report = await pipeline.solve(problem);
    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      reportService.print(report);
    }
  } catch (error) {
    logger.error('Reasoning pipeline failed', error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

bootstrap();
