import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { RouletteService } from '../res/roulette/roulette.service';

type Phase = 'betting' | 'closing' | 'spinning' | 'result';
type ChatMsg = { username: string; message: string; timestamp: string };

@WebSocketGateway({
  namespace: '/roulette',
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
})
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private socketUsers = new Map<string, { id: number; username: string }>();
  private userSockets = new Map<number, string>();
  private pendingBets = new Map<number, { type: string; numbers: number[]; amount: number }[]>();

  private phase: Phase = 'betting';
  private timeLeft = 30;
  private roundId = 0;
  private timer: NodeJS.Timeout | null = null;

  // 늦게 접속한 유저에게 전송할 상태 (최근 채팅 50개, 결과 20개)
  private chatHistory: ChatMsg[] = [];
  private recentResults: number[] = [];

  constructor(
    private jwtService: JwtService,
    private rouletteService: RouletteService,
  ) {}

  afterInit() {
    this.startNewRound();
  }

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string;
      if (!token) { client.disconnect(); return; }
      const payload = this.jwtService.verify(token) as { id: number; username: string };
      this.socketUsers.set(client.id, { id: payload.id, username: payload.username });
      this.userSockets.set(payload.id, client.id);

      client.emit('gameState', { phase: this.phase, timeLeft: this.timeLeft, roundId: this.roundId });
      if (this.chatHistory.length > 0) client.emit('chatHistory', this.chatHistory);
      if (this.recentResults.length > 0) client.emit('recentResults', this.recentResults);
      this.broadcastRoomUsers();
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = this.socketUsers.get(client.id);
    if (user) {
      this.userSockets.delete(user.id);
      this.socketUsers.delete(client.id);
      this.broadcastRoomUsers();
    }
  }

  private broadcastRoomUsers() {
    const users = Array.from(this.socketUsers.values()).map((u) => u.username);
    this.server.emit('roomUsers', { count: users.length, usernames: users });
  }

  @SubscribeMessage('submitBets')
  handleSubmitBets(client: Socket, data: { bets: { type: string; numbers: number[]; amount: number }[]; roundId: number }) {
    const user = this.socketUsers.get(client.id);
    if (!user) return;
    if (data.roundId !== this.roundId) return;
    if (this.phase !== 'betting' && this.phase !== 'closing') return;

    if (!Array.isArray(data.bets) || data.bets.length === 0 || data.bets.length > 15) return;
    const valid = data.bets.every(
      (b) => Number.isInteger(b.amount) && b.amount >= 1000 && b.amount <= 10000000,
    );
    if (!valid) return;

    this.pendingBets.set(user.id, data.bets);
  }

  @SubscribeMessage('chatMessage')
  handleChat(client: Socket, data: { message: string }) {
    const user = this.socketUsers.get(client.id);
    if (!user) return;
    const message = String(data.message || '').slice(0, 200).trim();
    if (!message) return;
    const msg: ChatMsg = { username: user.username, message, timestamp: new Date().toISOString() };
    this.chatHistory = [...this.chatHistory.slice(-49), msg];
    this.server.emit('chatMessage', msg);
  }

  private startNewRound() {
    this.roundId++;
    this.phase = 'betting';
    this.timeLeft = 15;
    this.pendingBets.clear();
    this.broadcastGameState();

    this.timer = setInterval(() => {
      this.timeLeft--;
      this.broadcastGameState();

      if (this.timeLeft <= 0) {
        clearInterval(this.timer!);
        this.phase = 'closing';
        this.server.emit('bettingClosed', { roundId: this.roundId });
        this.broadcastGameState();
        setTimeout(() => this.executeSpin(), 1500);
      }
    }, 1000);
  }

  private async executeSpin() {
    const result = Math.floor(Math.random() * 37);
    const currentRoundId = this.roundId;

    this.recentResults = [result, ...this.recentResults.slice(0, 19)];

    this.phase = 'spinning';
    this.broadcastGameState();
    this.server.emit('spinResult', { result, roundId: currentRoundId });

    const betEntries = Array.from(this.pendingBets.entries());
    await Promise.all(
      betEntries.map(async ([userId, bets]) => {
        try {
          const betResult = await this.rouletteService.processSpinWithResult(userId, bets, result);
          if (betResult) {
            const socketId = this.userSockets.get(userId);
            if (socketId) {
              this.server.to(socketId).emit('betResult', {
                totalWin: betResult.totalWin,
                newBalance: betResult.newBalance,
                totalBet: betResult.totalBet,
              });
            }
          }
        } catch {
          // 개별 베팅 오류는 다른 유저에게 영향 없도록 무시
        }
      }),
    );

    setTimeout(() => {
      this.phase = 'result';
      this.broadcastGameState();
      setTimeout(() => this.startNewRound(), 5000);
    }, 4000);
  }

  private broadcastGameState() {
    this.server.emit('gameState', {
      phase: this.phase,
      timeLeft: this.timeLeft,
      roundId: this.roundId,
    });
  }
}
