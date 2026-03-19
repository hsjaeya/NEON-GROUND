import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

const DAILY_BONUS_AMOUNT = 50000;
import { PrismaService } from 'src/prisma/prisma.service';
import { hash } from 'bcrypt';
import { UserResponseDto } from './dto/user-response.dto';
import { plainToInstance } from 'class-transformer';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async register(email: string, username: string, password: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser?.email === email) {
      throw new BadRequestException('이미 해당 이메일이 존재합니다.');
    }
    if (existingUser?.username === username) {
      throw new BadRequestException('이미 해당 이름이 존재합니다.');
    }

    const hashedPassword = await hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        wallets: {
          create: {
            balance: 0,
          },
        },
      },
      include: { wallets: true },
    });

    return user;
  }

  async getUser(userId: number) {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          username: true,
          createdAt: true,
          updatedAt: true,
          wallets: {
            select: {
              id: true,
              userId: true,
              balance: true,
              createdAt: true,
              updatedAt: true,
            },
            where: {
              deletedAt: null,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        wallets: user.wallets.map((wallet) => ({
          id: wallet.id,
          userId: wallet.userId,
          balance: wallet.balance.toString(),
          createdAt: wallet.createdAt,
          updatedAt: wallet.updatedAt,
        })),
      };
    } catch (error) {
      console.error('getUser error:', error);
      throw error;
    }
  }

  async updateUser(userId: number, dto: UpdateUserDto) {
    const data = { ...dto, updatedAt: new Date() };

    if (dto.password) {
      data.password = await hash(dto.password, 10);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return { message: '수정이 완료됐습니다.' };
  }

  async deleteUser(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
      },
    });

    await this.prisma.wallet.updateMany({
      where: { userId },
      data: { deletedAt: new Date() },
    });

    return { message: '삭제가 완료됐습니다.' };
  }

  async getDailyBonusStatus(userId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    if (!user.lastDailyBonusAt) return { available: true, nextClaimAt: null };

    const msSince = Date.now() - user.lastDailyBonusAt.getTime();
    if (msSince >= 24 * 60 * 60 * 1000) return { available: true, nextClaimAt: null };

    const nextClaimAt = new Date(user.lastDailyBonusAt.getTime() + 24 * 60 * 60 * 1000);
    return { available: false, nextClaimAt };
  }

  async claimDailyBonus(userId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { wallets: { where: { deletedAt: null } } },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.lastDailyBonusAt) {
      const msSince = Date.now() - user.lastDailyBonusAt.getTime();
      if (msSince < 24 * 60 * 60 * 1000) {
        const nextClaimAt = new Date(user.lastDailyBonusAt.getTime() + 24 * 60 * 60 * 1000);
        throw new BadRequestException({ message: '이미 오늘의 보너스를 받았습니다.', nextClaimAt });
      }
    }

    const wallet = user.wallets[0];
    if (!wallet) throw new BadRequestException('Wallet not found');

    await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: DAILY_BONUS_AMOUNT } },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { lastDailyBonusAt: new Date() },
      }),
    ]);

    const updated = await this.prisma.wallet.findUnique({ where: { id: wallet.id } });
    return {
      bonusAmount: DAILY_BONUS_AMOUNT,
      newBalance: updated?.balance.toString(),
    };
  }
}
