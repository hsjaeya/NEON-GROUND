import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './res/user/user.module';
import { AuthModule } from './auth/auth.module';
import { RouletteModule } from './res/roulette/roulette.module';
import { GameModule } from './gateway/game.module';
import { RankingModule } from './res/ranking/ranking.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UserModule,
    AuthModule,
    RouletteModule,
    GameModule,
    RankingModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
