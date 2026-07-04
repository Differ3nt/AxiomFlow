import { Module } from '@nestjs/common';
import { RunsController } from './runs.controller';
import { ChatController } from './chat.controller';
import { ReasoningModule } from '../reasoning/reasoning.module';
import { LlmModule } from '../llm/llm.module';
import { DbModule } from '@axiomflow/data-access-db';

@Module({
  imports: [ReasoningModule, LlmModule, DbModule],
  controllers: [RunsController, ChatController],
})
export class HttpModule {}
