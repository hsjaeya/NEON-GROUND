import {
  IsArray,
  IsEnum,
  IsNumber,
  IsPositive,
  Min,
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
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  numbers: number[];

  @IsNumber()
  @IsPositive()
  amount: number;
}

export class RouletteSpinDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SingleBetDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50) // 최대 50개 베팅
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
