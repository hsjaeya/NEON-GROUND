// src/roulette/roulette.module.ts

import { Module } from '@nestjs/common';
import { RouletteController } from './roulette.controller';
import { RouletteService } from './roulette.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [],
  controllers: [RouletteController],
  providers: [RouletteService, PrismaService],
  exports: [RouletteService],
})
export class RouletteModule {}
