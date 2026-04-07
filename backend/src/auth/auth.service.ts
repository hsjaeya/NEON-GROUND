import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { compare } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) throw new BadRequestException('이메일이 잘못되었습니다.');

    const isPasswordMatch = await compare(password, user.password);
    if (!isPasswordMatch) throw new BadRequestException('비밀번호가 일치하지 않습니다.');
    if (user.deletedAt) throw new UnauthorizedException('삭제된 사용자 입니다. 관리자에게 문의하세요.');

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }

  async logIn(user: any) {
    const accessToken = this.jwtService.sign(user);
    const refreshToken = await this.createRefreshToken(user.id);
    return { accessToken, refreshToken };
  }

  async refresh(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date() || stored.user.deletedAt) {
      throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
    }

    // 기존 토큰 삭제 후 새 토큰 발급 (rotation)
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const { id, username, email, createdAt, updatedAt, deletedAt } = stored.user;
    const payload = { id, username, email, createdAt, updatedAt, deletedAt };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.createRefreshToken(id);

    return { accessToken, refreshToken };
  }

  async revokeRefreshToken(token: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token } });
  }

  private async createRefreshToken(userId: number): Promise<string> {
    const token = randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.prisma.refreshToken.create({ data: { token, userId, expiresAt } });
    return token;
  }
}
