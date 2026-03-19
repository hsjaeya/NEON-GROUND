// src/roulette/roulette.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RouletteSpinDto, BetType } from './dto/roulette-bet.dto';
import { Decimal } from '@prisma/client/runtime/client';

@Injectable()
export class RouletteService {
  constructor(private prisma: PrismaService) {}

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

  // 베팅 검증
  private validateBet(type: BetType, numbers: number[]): boolean {
    // 숫자 범위 확인 (0-36)
    if (numbers.some((n) => n < 0 || n > 36)) {
      return false;
    }

    // 타입별 숫자 개수 확인
    const expectedCounts = {
      [BetType.STRAIGHT]: 1,
      [BetType.SPLIT]: 2,
      [BetType.STREET]: 3,
      [BetType.CORNER]: 4,
      [BetType.SIXLINE]: 6,
      [BetType.DOZEN]: 12,
      [BetType.COLUMN]: 12,
      [BetType.REDBLACK]: 18,
      [BetType.EVENODD]: 18,
      [BetType.LOWHIGH]: 18,
    };

    return numbers.length === expectedCounts[type];
  }

  // 룰렛 스핀
  async spin(userId: number, dto: RouletteSpinDto) {
    // 1. 베팅 검증
    for (const bet of dto.bets) {
      if (!this.validateBet(bet.type as BetType, bet.numbers)) {
        throw new BadRequestException(
          `Invalid bet: ${bet.type} with ${bet.numbers.length} numbers`,
        );
      }
    }

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

    return {
      result,
      totalBet,
      totalWin: totalWin.toNumber(),
      newBalance: parseFloat(updatedWallet.balance.toString()),
      gameId: gameResult.id,
      bets: betResults,
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
