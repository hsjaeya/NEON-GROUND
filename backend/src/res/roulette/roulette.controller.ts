// src/roulette/roulette.controller.ts

import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { RouletteService } from './roulette.service';
import { RouletteSpinDto } from './dto/roulette-bet.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('games/roulette')
@UseGuards(JwtAuthGuard) // 인증 필요
export class RouletteController {
  constructor(private readonly rouletteService: RouletteService) {}

  @Post('spin')
  async spin(@Req() req, @Body() dto: RouletteSpinDto) {
    const userId = req.user.id; // JWT에서 추출된 사용자 ID
    return this.rouletteService.spin(userId, dto);
  }

  @Get('history')
  async getHistory(@Req() req, @Query('limit') limit?: string) {
    const userId = req.user.id;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.rouletteService.getHistory(userId, limitNum);
  }

  @Get('stats')
  async getStats(@Req() req) {
    const userId = req.user.id;
    return this.rouletteService.getStats(userId);
  }
}
