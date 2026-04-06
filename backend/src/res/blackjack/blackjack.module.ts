import { Module } from '@nestjs/common';
import { BlackjackService } from './blackjack.service';

@Module({
  providers: [BlackjackService],
  exports: [BlackjackService],
})
export class BlackjackModule {}
