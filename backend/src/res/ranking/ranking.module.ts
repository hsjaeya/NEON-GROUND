import { Module } from '@nestjs/common';
import { RankingController } from './ranking.controller';
import { RankingService } from './ranking.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [RankingController],
  providers: [RankingService, PrismaService],
})
export class RankingModule {}
