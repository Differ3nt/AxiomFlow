import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Run, NodeExecution } from './models';
import { TrailService } from './trail.service';

@Module({
  imports: [
    SequelizeModule.forRoot({
      dialect: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5433,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'axiomflow',
      autoLoadModels: true,
      synchronize: true, // For hackathon purposes
      models: [Run, NodeExecution],
      logging: false
    }),
    SequelizeModule.forFeature([Run, NodeExecution]),
  ],
  providers: [TrailService],
  exports: [TrailService, SequelizeModule],
})
export class DbModule {}
