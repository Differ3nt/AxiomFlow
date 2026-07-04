import { Module } from '@nestjs/common';
import { TrizDataService } from './triz-data.service';

@Module({
  providers: [TrizDataService],
  exports: [TrizDataService],
})
export class TrizModule {}
