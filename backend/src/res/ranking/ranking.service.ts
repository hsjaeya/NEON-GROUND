import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type SortKey = 'profit' | 'balance' | 'winrate' | 'games';

const PAGE_SIZE = 10;

const STATS_SELECT = {
  totalGames: true,
  totalWins: true,
  netProfit: true,
  user: {
    select: {
      username: true,
      wallets: { select: { balance: true }, take: 1, where: { deletedAt: null } },
    },
  },
} as const;

function toRow(s: any, rank: number) {
  const balance = s.user.wallets[0] ? parseFloat(s.user.wallets[0].balance.toString()) : 0;
  const winRate = s.totalGames > 0 ? Math.round((s.totalWins / s.totalGames) * 10000) / 100 : 0;
  return {
    rank,
    username: s.user.username,
    balance,
    totalGames: s.totalGames,
    totalWins: s.totalWins,
    netProfit: parseFloat(s.netProfit.toString()),
    winRate,
  };
}

@Injectable()
export class RankingService {
  constructor(private prisma: PrismaService) {}

  async getRanking(sort: string = 'profit', page: number = 1) {
    const validSort: SortKey = ['profit', 'balance', 'winrate', 'games'].includes(sort)
      ? (sort as SortKey)
      : 'profit';

    const currentPage = Math.max(1, page);
    const skip = (currentPage - 1) * PAGE_SIZE;
    const where = { user: { deletedAt: null } };

    // profit/games는 DB 레벨에서 정렬·페이징 처리
    if (validSort === 'profit' || validSort === 'games') {
      const orderBy = validSort === 'profit'
        ? { netProfit: 'desc' as const }
        : { totalGames: 'desc' as const };

      const [total, stats] = await Promise.all([
        this.prisma.playerStats.count({ where }),
        this.prisma.playerStats.findMany({
          where,
          orderBy,
          skip,
          take: PAGE_SIZE,
          select: STATS_SELECT,
        }),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const safePage = Math.min(currentPage, totalPages);
      return {
        data: stats.map((s, i) => toRow(s, skip + i + 1)),
        total,
        page: safePage,
        totalPages,
      };
    }

    // balance/winrate는 계산 필드라 애플리케이션 레벨 정렬
    const stats = await this.prisma.playerStats.findMany({
      where,
      select: STATS_SELECT,
    });

    const rows = stats.map((s) => toRow(s, 0));
    rows.sort((a, b) =>
      validSort === 'balance' ? b.balance - a.balance : b.winRate - a.winRate,
    );

    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    const data = rows.slice(start, start + PAGE_SIZE).map((r, i) => ({ ...r, rank: start + i + 1 }));

    return { data, total, page: safePage, totalPages };
  }
}
