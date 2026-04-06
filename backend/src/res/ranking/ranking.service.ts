import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type SortKey = 'profit' | 'balance' | 'winrate' | 'games';

@Injectable()
export class RankingService {
  constructor(private prisma: PrismaService) {}

  async getRanking(sort: string = 'profit', page: number = 1) {
    const validSort: SortKey = ['profit', 'balance', 'winrate', 'games'].includes(sort)
      ? (sort as SortKey)
      : 'profit';

    const PAGE_SIZE = 10;
    const currentPage = Math.max(1, page);

    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        username: true,
        wallets: { select: { balance: true }, take: 1 },
        playerStats: {
          select: {
            totalGames: true,
            totalWins: true,
            totalWagered: true,
            totalPayout: true,
            netProfit: true,
          },
        },
      },
    });

    const rows = users
      .filter((u) => u.playerStats !== null)
      .map((u) => {
        const s = u.playerStats!;
        const balance = u.wallets[0]
          ? parseFloat(u.wallets[0].balance.toString())
          : 0;
        const totalGames = s.totalGames;
        const totalWins = s.totalWins;
        const netProfit = parseFloat(s.netProfit.toString());
        const winRate =
          totalGames > 0
            ? Math.round((totalWins / totalGames) * 10000) / 100
            : 0;
        return { username: u.username, balance, totalGames, totalWins, netProfit, winRate };
      });

    rows.sort((a, b) => {
      if (validSort === 'profit') return b.netProfit - a.netProfit;
      if (validSort === 'balance') return b.balance - a.balance;
      if (validSort === 'winrate') return b.winRate - a.winRate;
      return b.totalGames - a.totalGames;
    });

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    const data = rows
      .slice(start, start + PAGE_SIZE)
      .map((r, i) => ({ rank: start + i + 1, ...r }));

    return { data, total, page: safePage, totalPages };
  }
}
