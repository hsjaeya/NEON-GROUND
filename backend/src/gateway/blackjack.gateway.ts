import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { BlackjackService, Card } from '../res/blackjack/blackjack.service';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../res/stats/stats.service';
import { Decimal } from '@prisma/client/runtime/client';

type Phase = 'idle' | 'player' | 'dealer' | 'result';
type Result = 'blackjack' | 'dealer_blackjack' | 'win' | 'lose' | 'bust' | 'push';

interface Session {
  userId: number;
  phase: Phase;
  playerHand: Card[];
  dealerHand: Card[];
  bet: number;
  deck: Card[];
  result?: Result;
  net?: number;
}

const MAX_BET = 500000;
const MIN_BET = 500;

@WebSocketGateway({
  namespace: '/blackjack',
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
})
export class BlackjackGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private sessions = new Map<number, Session>();
  private socketUsers = new Map<string, { id: number; username: string }>();

  constructor(
    private jwt: JwtService,
    private bj: BlackjackService,
    private prisma: PrismaService,
    private stats: StatsService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string;
      if (!token) { client.disconnect(); return; }
      const payload = this.jwt.verify(token) as { id: number; username: string };
      this.socketUsers.set(client.id, payload);

      if (!this.sessions.has(payload.id)) {
        this.sessions.set(payload.id, {
          userId: payload.id, phase: 'idle',
          playerHand: [], dealerHand: [], bet: 0, deck: [],
        });
      }
      client.emit('gameState', this.serialize(payload.id, false));
    } catch { client.disconnect(); }
  }

  handleDisconnect(client: Socket) {
    const user = this.socketUsers.get(client.id);
    if (!user) return;
    this.socketUsers.delete(client.id);
    // Sessions persist so players can reconnect
  }


  @SubscribeMessage('placeBet')
  async onPlaceBet(client: Socket, data: { amount: number }) {
    const user = this.socketUsers.get(client.id);
    if (!user) return;
    const session = this.sessions.get(user.id);
    if (!session || session.phase !== 'idle') {
      client.emit('error', { message: 'Finish the current hand first' }); return;
    }

    const bet = Math.floor(data.amount);
    if (bet < MIN_BET || bet > MAX_BET) {
      client.emit('error', { message: `Bet must be $${MIN_BET.toLocaleString()}–$${MAX_BET.toLocaleString()}` }); return;
    }

    const wallet = await this.prisma.wallet.findFirst({ where: { userId: user.id } });
    const balance = wallet ? parseFloat(wallet.balance.toString()) : 0;
    if (balance < bet) {
      client.emit('error', { message: 'Insufficient balance' }); return;
    }

    // 6-deck shoe
    let shoe: Card[] = [];
    for (let i = 0; i < 6; i++) shoe = shoe.concat(this.bj.buildDeck());
    shoe = this.bj.shuffle(shoe);

    // Deal: player-dealer-player-dealer
    session.playerHand = [shoe[0], shoe[2]];
    session.dealerHand = [shoe[1], shoe[3]];
    session.deck = shoe.slice(4);
    session.bet = bet;
    session.result = undefined;
    session.net = undefined;

    const playerBJ = this.bj.isBlackjack(session.playerHand);
    const dealerBJ = this.bj.isBlackjack(session.dealerHand);

    if (playerBJ || dealerBJ) {
      let result: Result;
      if (playerBJ && dealerBJ) result = 'push';
      else if (playerBJ) result = 'blackjack';
      else result = 'dealer_blackjack';

      session.net =
        result === 'blackjack' ? Math.floor(bet * 1.5) :
        result === 'push' ? 0 : -bet;
      session.phase = 'result';
      session.result = result;
      await this.applyNet(user.id, session.net, bet);
      client.emit('gameState', this.serialize(user.id, true));
      return;
    }

    session.phase = 'player';
    client.emit('gameState', this.serialize(user.id, false));
  }

  @SubscribeMessage('hit')
  async onHit(client: Socket) {
    const user = this.socketUsers.get(client.id);
    if (!user) return;
    const session = this.sessions.get(user.id);
    if (!session || session.phase !== 'player') return;

    session.playerHand.push(session.deck.shift()!);

    if (this.bj.isBust(session.playerHand)) {
      session.result = 'bust';
      session.net = -session.bet;
      session.phase = 'result';
      await this.applyNet(user.id, session.net, session.bet);
      client.emit('gameState', this.serialize(user.id, true));
    } else if (this.bj.handValue(session.playerHand) === 21) {
      // Auto-stand on 21
      await this.runDealer(user.id, client);
    } else {
      client.emit('gameState', this.serialize(user.id, false));
    }
  }

  @SubscribeMessage('stand')
  async onStand(client: Socket) {
    const user = this.socketUsers.get(client.id);
    if (!user) return;
    const session = this.sessions.get(user.id);
    if (!session || session.phase !== 'player') return;
    await this.runDealer(user.id, client);
  }

  @SubscribeMessage('double')
  async onDouble(client: Socket) {
    const user = this.socketUsers.get(client.id);
    if (!user) return;
    const session = this.sessions.get(user.id);
    if (!session || session.phase !== 'player') return;
    if (session.playerHand.length !== 2) {
      client.emit('error', { message: 'Can only double on the first two cards' }); return;
    }

    const wallet = await this.prisma.wallet.findFirst({ where: { userId: user.id } });
    const balance = wallet ? parseFloat(wallet.balance.toString()) : 0;
    if (balance < session.bet) {
      client.emit('error', { message: 'Insufficient balance to double down' }); return;
    }

    session.bet *= 2;
    session.playerHand.push(session.deck.shift()!);

    if (this.bj.isBust(session.playerHand)) {
      session.result = 'bust';
      session.net = -session.bet;
      session.phase = 'result';
      await this.applyNet(user.id, session.net, session.bet);
      client.emit('gameState', this.serialize(user.id, true));
    } else {
      // Show the doubled hand briefly before dealer runs
      client.emit('gameState', this.serialize(user.id, false));
      await this.runDealer(user.id, client);
    }
  }

  @SubscribeMessage('newGame')
  onNewGame(client: Socket) {
    const user = this.socketUsers.get(client.id);
    if (!user) return;
    const session = this.sessions.get(user.id);
    if (!session || session.phase !== 'result') return;
    session.phase = 'idle';
    session.playerHand = []; session.dealerHand = [];
    session.bet = 0; session.deck = [];
    session.result = undefined; session.net = undefined;
    client.emit('gameState', this.serialize(user.id, false));
  }


  private async runDealer(userId: number, client: Socket) {
    const session = this.sessions.get(userId)!;
    session.phase = 'dealer';

    // Reveal dealer hand immediately
    client.emit('gameState', this.serialize(userId, true));

    // Dealer hits until 17+
    while (this.bj.handValue(session.dealerHand) < 17) {
      session.dealerHand.push(session.deck.shift()!);
    }

    const pv = this.bj.handValue(session.playerHand);
    const dv = this.bj.handValue(session.dealerHand);

    let result: Result;
    if (this.bj.isBust(session.dealerHand)) result = 'win';
    else if (pv > dv) result = 'win';
    else if (pv < dv) result = 'lose';
    else result = 'push';

    session.result = result;
    session.net = result === 'win' ? session.bet : result === 'push' ? 0 : -session.bet;
    session.phase = 'result';
    await this.applyNet(userId, session.net, session.bet);
    client.emit('gameState', this.serialize(userId, true));
  }

  private async applyNet(userId: number, net: number, bet?: number) {
    if (net !== 0) {
      try {
        const w = await this.prisma.wallet.findFirst({ where: { userId } });
        if (w) {
          const next = new Decimal(w.balance.toString()).add(new Decimal(net));
          await this.prisma.wallet.update({
            where: { id: w.id },
            data: { balance: next.lessThan(0) ? '0' : next.toFixed() },
          });
        }
      } catch { /* ignore */ }
    }
    if (bet !== undefined) {
      const wagered = bet;
      const payout = bet + net; // net can be negative (loss), zero (push), or positive (win)
      this.stats.recordGame(userId, wagered, payout < 0 ? 0 : payout).catch(() => {});
    }
  }

  private serialize(userId: number, revealDealer: boolean) {
    const s = this.sessions.get(userId);
    if (!s) return null;
    const reveal = revealDealer || s.phase === 'dealer' || s.phase === 'result';
    return {
      phase: s.phase,
      playerHand: s.playerHand,
      dealerHand: reveal
        ? s.dealerHand
        : (s.dealerHand.length > 0 ? [s.dealerHand[0], null] : []),
      playerValue: this.bj.handValue(s.playerHand),
      dealerValue: reveal
        ? this.bj.handValue(s.dealerHand)
        : (s.dealerHand.length > 0 ? this.bj.handValue([s.dealerHand[0]]) : 0),
      bet: s.bet,
      result: s.result,
      net: s.net,
      canDouble: s.phase === 'player' && s.playerHand.length === 2,
    };
  }
}
