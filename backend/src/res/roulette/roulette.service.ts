
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RouletteSpinDto, BetType } from './dto/roulette-bet.dto';
import { Decimal } from '@prisma/client/runtime/client';
import { StatsService } from '../stats/stats.service';

@Injectable()
export class RouletteService {
  constructor(
    private prisma: PrismaService,
    private stats: StatsService,
  ) {}

  private getNumberColor(num: number): 'red' | 'black' | 'green' {
    if (num === 0) return 'green';
    const reds = [
      1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
    ];
    return reds.includes(num) ? 'red' : 'black';
  }

  private getPayoutMultiplier(type: BetType): number {
    const payouts = {
      [BetType.STRAIGHT]: 35,
      [BetType.SPLIT]: 17,
      [BetType.STREET]: 11,
      [BetType.CORNER]: 8,
      [BetType.SIXLINE]: 5,
      [BetType.DOZEN]: 2,
      [BetType.COLUMN]: 2,
      [BetType.REDBLACK]: 1,
      [BetType.EVENODD]: 1,
      [BetType.LOWHIGH]: 1,
    };
    return payouts[type] || 0;
  }

  private readonly VALID_SETS = {
    RED: new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]),
    BLACK: new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]),
    EVEN: new Set([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36]),
    ODD: new Set([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35]),
    LOW: new Set(Array.from({ length: 18 }, (_, i) => i + 1)),
    HIGH: new Set(Array.from({ length: 18 }, (_, i) => i + 19)),
    DOZEN1: new Set(Array.from({ length: 12 }, (_, i) => i + 1)),
    DOZEN2: new Set(Array.from({ length: 12 }, (_, i) => i + 13)),
    DOZEN3: new Set(Array.from({ length: 12 }, (_, i) => i + 25)),
    COL1: new Set([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]),
    COL2: new Set([2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35]),
    COL3: new Set([3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]),
  };

  private setsEqual(a: Set<number>, b: number[]): boolean {
    if (a.size !== b.length) return false;
    return b.every((n) => a.has(n));
  }

  private validateBet(type: BetType, numbers: number[]): boolean {
    if (numbers.some((n) => n < 0 || n > 36 || !Number.isInteger(n))) {
      return false;
    }

    if (new Set(numbers).size !== numbers.length) {
      return false;
    }

    switch (type) {
      case BetType.STRAIGHT:
        return numbers.length === 1;
      case BetType.SPLIT:
        return numbers.length === 2;
      case BetType.STREET:
        return numbers.length === 3;
      case BetType.CORNER:
        return numbers.length === 4;
      case BetType.SIXLINE:
        return numbers.length === 6;
      case BetType.REDBLACK:
        return (
          this.setsEqual(this.VALID_SETS.RED, numbers) ||
          this.setsEqual(this.VALID_SETS.BLACK, numbers)
        );
      case BetType.EVENODD:
        return (
          this.setsEqual(this.VALID_SETS.EVEN, numbers) ||
          this.setsEqual(this.VALID_SETS.ODD, numbers)
        );
      case BetType.LOWHIGH:
        return (
          this.setsEqual(this.VALID_SETS.LOW, numbers) ||
          this.setsEqual(this.VALID_SETS.HIGH, numbers)
        );
      case BetType.DOZEN:
        return (
          this.setsEqual(this.VALID_SETS.DOZEN1, numbers) ||
          this.setsEqual(this.VALID_SETS.DOZEN2, numbers) ||
          this.setsEqual(this.VALID_SETS.DOZEN3, numbers)
        );
      case BetType.COLUMN:
        return (
          this.setsEqual(this.VALID_SETS.COL1, numbers) ||
          this.setsEqual(this.VALID_SETS.COL2, numbers) ||
          this.setsEqual(this.VALID_SETS.COL3, numbers)
        );
      default:
        return false;
    }
  }

  private validateBetComposition(bets: { type: string }[]): void {
    const outsideTypes = [
      BetType.REDBLACK,
      BetType.EVENODD,
      BetType.LOWHIGH,
      BetType.DOZEN,
      BetType.COLUMN,
    ];
    const insideTypes = [
      BetType.STRAIGHT,
      BetType.SPLIT,
      BetType.STREET,
      BetType.CORNER,
      BetType.SIXLINE,
    ];

    const seen = new Set<string>();
    let insideCount = 0;

    for (const bet of bets) {
      if (outsideTypes.includes(bet.type as BetType)) {
        if (seen.has(bet.type)) {
          throw new BadRequestException(
            `Duplicate outside bet type: ${bet.type}`,
          );
        }
        seen.add(bet.type);
      }
      if (insideTypes.includes(bet.type as BetType)) {
        insideCount++;
        if (insideCount > 5) {
          throw new BadRequestException(
            'Maximum 5 inside bets (straight/split/street/corner/sixline) per spin',
          );
        }
      }
    }
  }

  async spin(userId: number, dto: RouletteSpinDto) {
    for (const bet of dto.bets) {
      if (!this.validateBet(bet.type as BetType, bet.numbers)) {
        throw new BadRequestException(
          `Invalid bet: ${bet.type} with numbers [${bet.numbers.join(',')}]`,
        );
      }
    }

    this.validateBetComposition(dto.bets);

    const totalBet = dto.bets.reduce((sum, bet) => sum + bet.amount, 0);
    const betAmount = new Decimal(totalBet);

    // 결과는 트랜잭션 밖에서 미리 생성 (DB 의존 없음)
    const result = Math.floor(Math.random() * 37);

    let totalWin = new Decimal(0);
    const betResults = dto.bets.map((bet) => {
      const won = bet.numbers.includes(result);
      const multiplier = this.getPayoutMultiplier(bet.type as BetType);
      const payout = won
        ? new Decimal(bet.amount).mul(multiplier)
        : new Decimal(0);

      if (won) {
        totalWin = totalWin.add(new Decimal(bet.amount)).add(payout);
      }

      return {
        type: bet.type,
        numbers: bet.numbers,
        amount: bet.amount,
        won,
        payout: payout.toNumber(),
      };
    });

    // 잔액 읽기와 차감을 하나의 트랜잭션으로 처리하여 race condition 방지
    const { game, newBalance } = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findFirst({ where: { userId } });
      if (!wallet) throw new BadRequestException('Wallet not found');

      const currentBalance = new Decimal(wallet.balance);
      if (currentBalance.lessThan(betAmount)) {
        throw new BadRequestException('Insufficient balance');
      }

      const updatedBalance = currentBalance.sub(betAmount).add(totalWin);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: updatedBalance.toFixed() },
      });

      const game = await tx.rouletteGame.create({
        data: {
          userId,
          totalBet: totalBet.toString(),
          totalWin: totalWin.toString(),
          result,
          bets: {
            create: betResults.map((bet) => ({
              type: bet.type,
              numbers: JSON.stringify(bet.numbers),
              amount: bet.amount.toString(),
              won: bet.won,
              payout: bet.payout.toString(),
            })),
          },
        },
        include: { bets: true },
      });

      return { game, newBalance: updatedBalance };
    });

    const totalWinNum = totalWin.toNumber();
    this.stats.recordGame(userId, totalBet, totalWinNum).catch(() => {});

    return {
      result,
      totalBet,
      totalWin: totalWinNum,
      newBalance: parseFloat(newBalance.toFixed()),
      gameId: game.id,
      bets: betResults,
    };
  }

  // 서버에서 결과를 받아 스핀 처리 (멀티플레이어 룰렛용)
  async processSpinWithResult(userId: number, bets: { type: string; numbers: number[]; amount: number }[], result: number) {
    if (!bets || bets.length === 0) return null;

    for (const bet of bets) {
      if (!this.validateBet(bet.type as BetType, bet.numbers)) {
        return null;
      }
    }

    try {
      this.validateBetComposition(bets);
    } catch {
      return null;
    }

    const totalBet = bets.reduce((sum, bet) => sum + bet.amount, 0);
    const betAmount = new Decimal(totalBet);

    let totalWin = new Decimal(0);
    const betResults = bets.map((bet) => {
      const won = bet.numbers.includes(result);
      const multiplier = this.getPayoutMultiplier(bet.type as BetType);
      const payout = won ? new Decimal(bet.amount).mul(multiplier) : new Decimal(0);
      if (won) totalWin = totalWin.add(new Decimal(bet.amount)).add(payout);
      return { type: bet.type, numbers: bet.numbers, amount: bet.amount, won, payout: payout.toNumber() };
    });

    // 잔액 읽기와 차감을 하나의 트랜잭션으로 처리하여 race condition 방지
    const newBalance = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findFirst({ where: { userId } });
      if (!wallet) return null;

      const currentBalance = new Decimal(wallet.balance);
      if (currentBalance.lessThan(betAmount)) return null;

      const updatedBalance = currentBalance.sub(betAmount).add(totalWin);
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: updatedBalance.toFixed() } });
      await tx.rouletteGame.create({
        data: {
          userId,
          totalBet: totalBet.toString(),
          totalWin: totalWin.toString(),
          result,
          bets: {
            create: betResults.map((bet) => ({
              type: bet.type,
              numbers: JSON.stringify(bet.numbers),
              amount: bet.amount.toString(),
              won: bet.won,
              payout: bet.payout.toString(),
            })),
          },
        },
      });

      return updatedBalance;
    });

    if (newBalance === null) return null;

    const totalWinNum = totalWin.toNumber();
    this.stats.recordGame(userId, totalBet, totalWinNum).catch(() => {});

    return {
      totalBet,
      totalWin: totalWinNum,
      newBalance: parseFloat(newBalance.toFixed()),
    };
  }

  async getHistory(userId: number, limit: number = 10) {
    const games = await this.prisma.rouletteGame.findMany({
      where: { userId },
      include: {
        bets: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return games.map((game) => ({
      id: game.id,
      result: game.result,
      totalBet: parseFloat(game.totalBet.toString()),
      totalWin: parseFloat(game.totalWin.toString()),
      profit:
        parseFloat(game.totalWin.toString()) -
        parseFloat(game.totalBet.toString()),
      createdAt: game.createdAt,
      bets: game.bets.map((bet) => ({
        type: bet.type,
        numbers: JSON.parse(bet.numbers),
        amount: parseFloat(bet.amount.toString()),
        won: bet.won,
        payout: parseFloat(bet.payout.toString()),
      })),
    }));
  }

  async getStats(userId: number) {
    const games = await this.prisma.rouletteGame.findMany({
      where: { userId },
    });

    const totalGames = games.length;
    const totalBet = games.reduce(
      (sum, g) => sum + parseFloat(g.totalBet.toString()),
      0,
    );
    const totalWin = games.reduce(
      (sum, g) => sum + parseFloat(g.totalWin.toString()),
      0,
    );
    const profit = totalWin - totalBet;
    const winCount = games.filter(
      (g) =>
        parseFloat(g.totalWin.toString()) > parseFloat(g.totalBet.toString()),
    ).length;
    const winRate = totalGames > 0 ? (winCount / totalGames) * 100 : 0;

    return {
      totalGames,
      totalBet,
      totalWin,
      profit,
      winRate: Math.round(winRate * 100) / 100,
      biggestWin: Math.max(
        ...games.map((g) => parseFloat(g.totalWin.toString())),
        0,
      ),
      biggestLoss: Math.max(
        ...games.map(
          (g) =>
            parseFloat(g.totalBet.toString()) -
            parseFloat(g.totalWin.toString()),
        ),
        0,
      ),
    };
  }
}
