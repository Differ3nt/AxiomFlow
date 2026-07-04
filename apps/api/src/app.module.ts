import { Module } from '@nestjs/common';
import { ReasoningModule } from './reasoning/reasoning.module';

@Module({
  imports: [ReasoningModule],
})
export class AppModule {}
