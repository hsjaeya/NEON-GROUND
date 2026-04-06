import { Injectable } from '@nestjs/common';

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A';
export interface Card { suit: Suit; rank: Rank; }

const RANKS: Rank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS: Suit[] = ['S','H','D','C'];

@Injectable()
export class BlackjackService {
  buildDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS)
      for (const rank of RANKS)
        deck.push({ suit, rank });
    return deck;
  }

  shuffle(deck: Card[]): Card[] {
    const d = [...deck];
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  handValue(cards: Card[]): number {
    let val = 0;
    let aces = 0;
    for (const c of cards) {
      if (c.rank === 'A') { aces++; val += 11; }
      else if (['J', 'Q', 'K'].includes(c.rank)) val += 10;
      else val += parseInt(c.rank);
    }
    while (val > 21 && aces > 0) { val -= 10; aces--; }
    return val;
  }

  isBlackjack(cards: Card[]): boolean {
    return cards.length === 2 && this.handValue(cards) === 21;
  }

  isBust(cards: Card[]): boolean {
    return this.handValue(cards) > 21;
  }
}
