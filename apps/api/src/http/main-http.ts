import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('HTTP');
  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  const config = new DocumentBuilder()
    .setTitle('AquaTRIZ API')
    .setDescription('Reasoning Pipeline API')
    .setVersion('1.0')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // also available at /api-docs-json

  await app.listen(3000);
  logger.log('HTTP server running on http://localhost:3000');
}

bootstrap();
