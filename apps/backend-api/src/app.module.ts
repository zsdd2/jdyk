import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppAccessGuard } from './app-access.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { loadRuntimeEnv } from './runtime-env';

loadRuntimeEnv();

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
    AppAccessGuard,
    {
      provide: APP_GUARD,
      useExisting: AppAccessGuard,
    },
  ],
})
export class AppModule {}
