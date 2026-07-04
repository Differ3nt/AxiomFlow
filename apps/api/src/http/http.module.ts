import { Module } from '@nestjs/common';
import { RunsController } from './runs.controller';
import { ReasoningModule } from '../reasoning/reasoning.module';
import { DbModule } from '@axiomflow/data-access-db';

@Module({
  imports: [ReasoningModule, DbModule],
  controllers: [RunsController],
})
export class HttpModule {}
