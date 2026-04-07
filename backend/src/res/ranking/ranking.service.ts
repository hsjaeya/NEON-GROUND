import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

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

    // profit/games는 PlayerStats 컬럼이라 Prisma ORM으로 처리
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

    // balance/winrate는 계산·조인 필드라 raw SQL로 DB 레벨 정렬+페이징
    const orderExpr =
      validSort === 'balance'
        ? Prisma.sql`COALESCE(w.balance, 0) DESC`
        : Prisma.sql`CASE WHEN ps."totalGames" > 0 THEN ps."totalWins"::float8 / ps."totalGames" ELSE 0 END DESC`;

    const [countResult, rows] = await Promise.all([
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count
        FROM "PlayerStats" ps
        JOIN "User" u ON ps."userId" = u.id
        WHERE u."deletedAt" IS NULL
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT
          u.username,
          COALESCE(CAST(w.balance AS float8), 0)          AS balance,
          ps."totalGames",
          ps."totalWins",
          CAST(ps."netProfit" AS float8)                  AS "netProfit",
          CASE WHEN ps."totalGames" > 0
               THEN ROUND((ps."totalWins"::float8 / ps."totalGames") * 10000) / 100
               ELSE 0 END                                 AS "winRate"
        FROM "PlayerStats" ps
        JOIN "User" u ON ps."userId" = u.id
        LEFT JOIN "Wallet" w ON w."userId" = u.id AND w."deletedAt" IS NULL
        WHERE u."deletedAt" IS NULL
        ORDER BY ${orderExpr}
        LIMIT ${PAGE_SIZE} OFFSET ${skip}
      `,
    ]);

    const total = Number(countResult[0].count);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);

    const data = rows.map((r, i) => ({
      rank: skip + i + 1,
      username: r.username,
      balance: Number(r.balance),
      totalGames: Number(r.totalGames),
      totalWins: Number(r.totalWins),
      netProfit: Number(r.netProfit),
      winRate: Number(r.winRate),
    }));

    return { data, total, page: safePage, totalPages };
  }
}
