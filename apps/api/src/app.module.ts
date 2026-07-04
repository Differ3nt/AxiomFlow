import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ReasoningModule } from './reasoning/reasoning.module';
import { HttpModule } from './http/http.module';
import { DbModule } from '@axiomflow/data-access-db';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ReasoningModule,
    HttpModule,
    DbModule
  ],
})
export class AppModule {}
