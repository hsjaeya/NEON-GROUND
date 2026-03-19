import {
  IsArray,
  IsEnum,
  IsInt,
  IsPositive,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum BetType {
  STRAIGHT = 'straight',
  SPLIT = 'split',
  STREET = 'street',
  CORNER = 'corner',
  SIXLINE = 'sixline',
  DOZEN = 'dozen',
  COLUMN = 'column',
  REDBLACK = 'redblack',
  EVENODD = 'evenodd',
  LOWHIGH = 'lowhigh',
}

export class SingleBetDto {
  @IsEnum(BetType)
  type: BetType;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(36)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(36, { each: true })
  numbers: number[];

  @IsInt()
  @IsPositive()
  @Min(1000)
  @Max(10000000)
  amount: number;
}

export class RouletteSpinDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SingleBetDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(15) // 최대 15개 베팅
  bets: SingleBetDto[];
}

export class RouletteSpinResponseDto {
  result: number;
  totalBet: number;
  totalWin: number;
  newBalance: number;
  gameId: number;
  bets: {
    type: string;
    numbers: number[];
    amount: number;
    won: boolean;
    payout: number;
  }[];
}
