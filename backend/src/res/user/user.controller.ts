import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Delete,
  Req,
  Patch,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { UpdateUserDto } from './dto/update-user.dto';

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
  @Get('me')
  async getUser(@Req() req) {
    const userId = req.user.id;
    return this.userService.getUser(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('me')
  async updateUser(@Req() req, @Body() updateUserDto: UpdateUserDto) {
    const userId = req.user.id;
    return this.userService.updateUser(userId, updateUserDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('me')
  async deleteUser(@Req() req) {
    const userId = req.user.id;
    return this.userService.deleteUser(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@Req() req) {
    return this.userService.getProfile(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('daily-bonus')
  async getDailyBonusStatus(@Req() req) {
    return this.userService.getDailyBonusStatus(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('daily-bonus')
  async claimDailyBonus(@Req() req) {
    return this.userService.claimDailyBonus(req.user.id);
  }
}
