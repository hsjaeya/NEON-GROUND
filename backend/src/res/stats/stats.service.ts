import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async recordGame(userId: number, wagered: number, payout: number) {
    const won = payout > wagered ? 1 : 0;
    const net = payout - wagered;
    await this.prisma.playerStats.upsert({
      where: { userId },
      create: {
        userId,
        totalGames: 1,
        totalWins: won,
        totalWagered: wagered.toFixed(2),
        totalPayout: payout.toFixed(2),
        netProfit: net.toFixed(2),
      },
      update: {
        totalGames: { increment: 1 },
        totalWins: { increment: won },
        totalWagered: { increment: wagered },
        totalPayout: { increment: payout },
        netProfit: { increment: net },
      },
    });
  }
}
