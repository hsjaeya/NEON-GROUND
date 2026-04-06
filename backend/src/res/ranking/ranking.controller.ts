import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RankingService } from './ranking.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('ranking')
@UseGuards(JwtAuthGuard)
export class RankingController {
  constructor(private rankingService: RankingService) {}

  @Get()
  async getRanking(@Query('sort') sort?: string, @Query('page') page?: string) {
    return this.rankingService.getRanking(sort, page ? parseInt(page, 10) : 1);
  }
}
