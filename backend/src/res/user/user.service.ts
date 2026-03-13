import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { hash } from 'bcrypt';

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
      },
    });

    return user;
  }

  async deleteUser(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    return { message: '삭제가 완료됐습니다.' };
  }
}
