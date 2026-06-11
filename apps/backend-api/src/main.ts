import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppService } from './app.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    credentials: true,
    origin: true,
  });
  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 3999);
  await app.listen(port, '0.0.0.0');
  app.get(AppService).startPlaybackAlbumAiScheduler();
}
bootstrap();
