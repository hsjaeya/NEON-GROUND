// src/roulette/roulette.service.ts

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

  // 숫자 색상 확인
  private getNumberColor(num: number): 'red' | 'black' | 'green' {
    if (num === 0) return 'green';
    const reds = [
      1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
    ];
    return reds.includes(num) ? 'red' : 'black';
  }

  // 배당률 계산
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

  // 유효한 베팅 숫자 세트 정의
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

  // 베팅 검증 (숫자 개수 + 내용 모두 확인)
  private validateBet(type: BetType, numbers: number[]): boolean {
    // 숫자 범위 확인 (0-36)
    if (numbers.some((n) => n < 0 || n > 36 || !Number.isInteger(n))) {
      return false;
    }

    // 중복 숫자 확인
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

  // 외부 베팅 타입 중복 검사 + 내부 베팅 최대 5개 제한
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

  // 룰렛 스핀
  async spin(userId: number, dto: RouletteSpinDto) {
    // 1. 베팅 검증
    for (const bet of dto.bets) {
      if (!this.validateBet(bet.type as BetType, bet.numbers)) {
        throw new BadRequestException(
          `Invalid bet: ${bet.type} with numbers [${bet.numbers.join(',')}]`,
        );
      }
    }

    // 1-2. 외부 베팅 중복 + 내부 베팅 최대 5개 검사
    this.validateBetComposition(dto.bets);

    // 2. 총 베팅액 계산
    const totalBet = dto.bets.reduce((sum, bet) => sum + bet.amount, 0);

    // 3. 사용자 지갑 조회 및 잔액 확인
    const wallet = await this.prisma.wallet.findFirst({
      where: { userId },
    });

    if (!wallet) {
      throw new BadRequestException('Wallet not found');
    }

    const currentBalance = new Decimal(wallet.balance);
    const betAmount = new Decimal(totalBet);

    if (currentBalance.lessThan(betAmount)) {
      throw new BadRequestException('Insufficient balance');
    }

    // 4. 랜덤 결과 생성 (0-36)
    const result = Math.floor(Math.random() * 37);

    // 5. 각 베팅별 승패 및 배당 계산
    let totalWin = new Decimal(0);
    const betResults = dto.bets.map((bet) => {
      const won = bet.numbers.includes(result);
      const multiplier = this.getPayoutMultiplier(bet.type as BetType);
      const payout = won
        ? new Decimal(bet.amount).mul(multiplier)
        : new Decimal(0);

      if (won) {
        totalWin = totalWin.add(new Decimal(bet.amount)).add(payout); // 원금 + 배당
      }

      return {
        type: bet.type,
        numbers: bet.numbers,
        amount: bet.amount,
        won,
        payout: payout.toNumber(),
      };
    });

    // 6. 트랜잭션으로 DB 업데이트
    const gameResult = await this.prisma.$transaction(async (tx) => {
      // 잔액 차감
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: currentBalance.sub(betAmount).toFixed(), // Decimal -> string
        },
      });

      // 게임 기록 생성
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
        include: {
          bets: true,
        },
      });

      // 승리금 지급
      if (totalWin.greaterThan(0)) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: currentBalance.sub(betAmount).add(totalWin).toFixed(), // Decimal -> string
          },
        });
      }

      return game;
    });

    // 7. 최종 잔액 조회
    const updatedWallet = await this.prisma.wallet.findFirst({
      where: { userId },
    });

    if (!updatedWallet) {
      throw new BadRequestException('Wallet not found after transaction');
    }

    const totalWinNum = totalWin.toNumber();

    this.stats.recordGame(userId, totalBet, totalWinNum).catch(() => {});

    return {
      result,
      totalBet,
      totalWin: totalWinNum,
      newBalance: parseFloat(updatedWallet.balance.toString()),
      gameId: gameResult.id,
      bets: betResults,
    };
  }

  // 서버에서 결과를 받아 스핀 처리 (멀티플레이어 룰렛용)
  async processSpinWithResult(userId: number, bets: { type: string; numbers: number[]; amount: number }[], result: number) {
    if (!bets || bets.length === 0) return null;

    // 베팅 검증
    for (const bet of bets) {
      if (!this.validateBet(bet.type as BetType, bet.numbers)) {
        return null; // 잘못된 베팅은 무시
      }
    }

    try {
      this.validateBetComposition(bets);
    } catch {
      return null;
    }

    const totalBet = bets.reduce((sum, bet) => sum + bet.amount, 0);

    const wallet = await this.prisma.wallet.findFirst({ where: { userId } });
    if (!wallet) return null;

    const currentBalance = new Decimal(wallet.balance);
    const betAmount = new Decimal(totalBet);

    if (currentBalance.lessThan(betAmount)) return null;

    let totalWin = new Decimal(0);
    const betResults = bets.map((bet) => {
      const won = bet.numbers.includes(result);
      const multiplier = this.getPayoutMultiplier(bet.type as BetType);
      const payout = won ? new Decimal(bet.amount).mul(multiplier) : new Decimal(0);
      if (won) totalWin = totalWin.add(new Decimal(bet.amount)).add(payout);
      return { type: bet.type, numbers: bet.numbers, amount: bet.amount, won, payout: payout.toNumber() };
    });

    await this.prisma.$transaction(async (tx) => {
      const newBalance = currentBalance.sub(betAmount).add(totalWin);
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance.toFixed() } });
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
    });

    const updatedWallet = await this.prisma.wallet.findFirst({ where: { userId } });
    const totalWinNum = totalWin.toNumber();

    this.stats.recordGame(userId, totalBet, totalWinNum).catch(() => {});

    return {
      totalBet,
      totalWin: totalWinNum,
      newBalance: parseFloat(updatedWallet!.balance.toString()),
    };
  }

  // 게임 히스토리 조회
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

  // 통계 조회
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
