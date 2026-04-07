import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { compare } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

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

  logIn(user: any) {
    return { accessToken: this.jwtService.sign(user) };
  }
}
