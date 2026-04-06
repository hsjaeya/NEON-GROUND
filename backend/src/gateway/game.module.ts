import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GameGateway } from './game.gateway';
import { PokerGateway } from './poker.gateway';
import { BlackjackGateway } from './blackjack.gateway';
import { RouletteModule } from '../res/roulette/roulette.module';
import { PokerModule } from '../res/poker/poker.module';
import { BlackjackModule } from '../res/blackjack/blackjack.module';
import { StatsModule } from '../res/stats/stats.module';
import { PrismaService } from '../prisma/prisma.service';

const jwtModule = JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.get<string>('JWT_SECRET'),
  }),
});

@Module({
  imports: [RouletteModule, PokerModule, BlackjackModule, StatsModule, jwtModule],
  providers: [GameGateway, PokerGateway, BlackjackGateway, PrismaService],
})
export class GameModule {}
