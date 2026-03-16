import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Delete,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  async register(
    @Body('email') email: string,
    @Body('username') username: string,
    @Body('password') password: string,
  ) {
    return this.userService.register(email, username, password);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('me')
  async deleteUser(@Req() req) {
    const userId = req.user.id;
    return this.userService.deleteUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('user-info')
  async getUserInfo() {
    return 'user-info Page';
  }
}
