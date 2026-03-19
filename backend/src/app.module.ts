import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './res/user/user.module';
import { AuthModule } from './auth/auth.module';
import { RouletteModule } from './res/roulette/roulette.module';
import { GameModule } from './gateway/game.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 전체 모듈에서 사용 가능
    }),
    UserModule,
    AuthModule,
    RouletteModule,
    GameModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
