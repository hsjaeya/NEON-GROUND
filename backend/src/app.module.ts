import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { UserModule } from './res/user/user.module';
import { AuthModule } from './auth/auth.module';
import { RouletteModule } from './res/roulette/roulette.module';
import { GameModule } from './gateway/game.module';
import { RankingModule } from './res/ranking/ranking.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 200 },  // 기본: 1분에 200회
      { name: 'auth', ttl: 60000, limit: 10 },       // 인증: 1분에 10회
      { name: 'game', ttl: 60000, limit: 120 },      // 게임: 1분에 120회
    ]),
    UserModule,
    AuthModule,
    RouletteModule,
    GameModule,
    RankingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // 전역 rate limiting
  ],
})
export class AppModule {}
