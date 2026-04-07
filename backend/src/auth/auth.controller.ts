import { Controller, Post, Req, Body, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  logIn(@Req() req) {
    return this.authService.logIn(req.user);
  }

  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('refresh token이 없습니다.');
    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  async logout(@Body('refreshToken') refreshToken: string) {
    if (refreshToken) await this.authService.revokeRefreshToken(refreshToken);
    return { success: true };
  }
}
