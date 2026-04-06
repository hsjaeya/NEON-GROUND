import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../context/Authcontext";
import styles from "./PokerRoom.module.css";

const WS_URL = import.meta.env.VITE_WS_URL ?? import.meta.env.VITE_API_URL;

// ─── Types ────────────────────────────────────────────────────────────────────
type Suit = "S" | "H" | "D" | "C";
type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

interface Card {
  suit: Suit;
  rank: Rank;
}

type Phase =
  | "waiting"
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown"
  | "result";

interface PlayerState {
  userId: number;
  username: string;
  chips: number;
  bet: number;
  totalBet: number;
  status: "active" | "folded" | "allin";
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  handName?: string;
  net?: number;
  holeCards: (Card | null)[];
}

interface RoomState {
  id: string;
  name: string;
  hostId: number;
  bigBlind: number;
  maxPlayers: number;
  phase: Phase;
  communityCards: (Card | null)[];
  pot: number;
  currentBet: number;
  minRaise: number;
  currentPlayerId: number | null;
  actionDeadline: number | null;
  playerOrder: number[];
  players: PlayerState[];
}

interface YourTurn {
  actions: string[];
  callAmount: number;
  minRaiseTo: number;
  maxRaiseTo: number;
  pot: number;
  deadline: number;
}

interface RoundResult {
  winnerIds: number[];
  pot: number;
  isShowdown: boolean;
  communityCards: (Card | null)[];
  players: PlayerState[];
}

interface LastAction {
  userId: number;
  action: string;
  amount?: number;
  auto?: boolean;
}

// ─── Seat Layouts ─────────────────────────────────────────────────────────────
// Seat position index → CSS position in the game area
// 0=hero(bottom-center), 1=lower-right, 2=upper-right, 3=top-center,
// 4=upper-left, 5=lower-left
const SEAT_POSITIONS: { left: string; top: string }[] = [
  { left: "50%",  top: "88%" }, // 0 hero
  { left: "84%",  top: "72%" }, // 1 lower-right
  { left: "88%",  top: "30%" }, // 2 upper-right
  { left: "50%",  top: "8%"  }, // 3 top
  { left: "12%",  top: "30%" }, // 4 upper-left
  { left: "16%",  top: "72%" }, // 5 lower-left
];

// Which visual seats to use for N players (index into SEAT_POSITIONS)
const SEAT_LAYOUT: Record<number, number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

const SUIT_SYMBOL: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const RED_SUITS = new Set(["H", "D"]);

const PHASE_LABEL: Record<string, string> = {
  waiting: "WAITING",
  preflop: "PRE-FLOP",
  flop: "FLOP",
  turn: "TURN",
  river: "RIVER",
  showdown: "SHOWDOWN",
  result: "RESULT",
};

// ─── Card Components ──────────────────────────────────────────────────────────
type CardSize = "sm" | "md" | "lg";

function PlayingCard({
  card,
  size = "md",
  delay = 0,
  dim = false,
}: {
  card: Card;
  size?: CardSize;
  delay?: number;
  dim?: boolean;
}) {
  const isRed = RED_SUITS.has(card.suit);
  return (
    <div
      className={`${styles.card} ${styles[`card_${size}`]} ${isRed ? styles.cardRed : styles.cardBlack} ${dim ? styles.cardDim : ""}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className={styles.cardCornerTL}>
        <span className={styles.cardCornerRank}>{card.rank}</span>
        <span className={styles.cardCornerSuit}>{SUIT_SYMBOL[card.suit]}</span>
      </div>
      <span className={styles.cardCenterSuit}>{SUIT_SYMBOL[card.suit]}</span>
      <div className={styles.cardCornerBR}>
        <span className={styles.cardCornerRank}>{card.rank}</span>
        <span className={styles.cardCornerSuit}>{SUIT_SYMBOL[card.suit]}</span>
      </div>
    </div>
  );
}

function CardBack({ size = "md", delay = 0 }: { size?: CardSize; delay?: number }) {
  return (
    <div
      className={`${styles.card} ${styles[`card_${size}`]} ${styles.cardBack}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className={styles.cardBackPattern} />
      <span className={styles.cardBackSymbol}>♠</span>
    </div>
  );
}

function CardPlaceholder({ size = "md" }: { size?: CardSize }) {
  return <div className={`${styles.card} ${styles[`card_${size}`]} ${styles.cardPlaceholder}`} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PokerRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);
  const token = localStorage.getItem("token");

  const [room, setRoom] = useState<RoomState | null>(null);
  const [myCards, setMyCards] = useState<Card[]>([]);
  const [turnInfo, setTurnInfo] = useState<YourTurn | null>(null);
  const [timeLeft, setTimeLeft] = useState(25000);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [error, setError] = useState("");
  const [dealKey, setDealKey] = useState(0);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);

  const myId = user?.id ?? 0;
  const balance = parseFloat(String(user?.balance ?? 0));

  // ── Timer ──
  useEffect(() => {
    if (!turnInfo?.deadline) return;
    const interval = setInterval(() => {
      setTimeLeft(Math.max(0, turnInfo.deadline - Date.now()));
    }, 100);
    return () => clearInterval(interval);
  }, [turnInfo?.deadline]);

  // ── Socket ──
  useEffect(() => {
    const socket = io(`${WS_URL}/poker`, {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("joinRoom", { roomId });
    });

    socket.on("joinedRoom", ({ room: r }: { roomId: string; room: RoomState }) => {
      setRoom(r);
      const me = r.players.find((p) => p.userId === myId);
      if (me?.holeCards) {
        const real = me.holeCards.filter(Boolean) as Card[];
        if (real.length > 0) setMyCards(real);
      }
    });

    socket.on("roomUpdate", (r: RoomState) => {
      setRoom(r);
      const me = r.players.find((p) => p.userId === myId);
      if (me?.holeCards) {
        const real = me.holeCards.filter(Boolean) as Card[];
        if (real.length === 2) setMyCards(real);
      }
      if (r.phase === "waiting") {
        setMyCards([]);
        setRoundResult(null);
      }
    });

    socket.on("holeCards", ({ cards }: { cards: Card[] }) => {
      setMyCards(cards);
      setDealKey((k) => k + 1);
    });

    socket.on("yourTurn", (data: YourTurn) => {
      setTurnInfo(data);
      setTimeLeft(data.deadline - Date.now());
      setRaiseAmount(data.minRaiseTo);
      setError("");
    });

    socket.on("playerAction", (data: LastAction) => {
      setLastAction(data);
      if (data.userId === myId) setTurnInfo(null);
      setTimeout(() => setLastAction((prev) => (prev?.userId === data.userId ? null : prev)), 2500);
    });

    socket.on("roundResult", (data: RoundResult) => {
      setRoundResult(data);
      setTurnInfo(null);
      setDealKey((k) => k + 1);
      refreshUser();
    });

    socket.on("leftRoom", () => navigate("/poker"));
    socket.on("error", (d: { message: string }) => setError(d.message));
    socket.on("connect_error", () => setError("CONNECTION LOST"));

    return () => {
      socket.emit("leaveRoom");
      socket.disconnect();
    };
  }, [token, roomId, myId, navigate, refreshUser]);

  // ── Actions ──
  const sendBet = useCallback((action: string, amount?: number) => {
    if (!socketRef.current) return;
    setError("");
    socketRef.current.emit("betAction", {
      action,
      ...(amount !== undefined ? { amount } : {}),
    });
    setTurnInfo(null);
  }, []);

  const handleStart = () => {
    socketRef.current?.emit("startGame");
    setRoundResult(null);
    setMyCards([]);
  };
  const handleRestart = () => {
    socketRef.current?.emit("restartGame");
    setRoundResult(null);
    setMyCards([]);
    setTurnInfo(null);
  };
  const handleLeave = () => {
    socketRef.current?.emit("leaveRoom");
  };

  // ── Seat assignment ──
  function buildSeats(
    players: PlayerState[],
    playerOrder: number[],
    myUserId: number
  ): Array<{ visualSeat: number; player: PlayerState } | null> {
    const n = players.length;
    const layoutSeats = SEAT_LAYOUT[Math.min(Math.max(n, 2), 6)] ?? SEAT_LAYOUT[6];

    // Find my position in playerOrder
    const myOrderIdx = playerOrder.indexOf(myUserId);

    // Assign players to layout slots (hero always slot 0)
    const result: Array<{ visualSeat: number; player: PlayerState } | null> = Array(6).fill(null);

    playerOrder.forEach((uid, orderIdx) => {
      const player = players.find((p) => p.userId === uid);
      if (!player) return;

      // Relative seat index: 0 = me, 1 = next, etc.
      const relIdx = myOrderIdx < 0 ? orderIdx : (orderIdx - myOrderIdx + n) % n;

      if (relIdx < layoutSeats.length) {
        const visualSeat = layoutSeats[relIdx];
        result[visualSeat] = { visualSeat, player };
      }
    });

    return result;
  }

  // ── Loading screen ──
  if (!room) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingDot} />
        <div className={styles.loadingText}>CONNECTING TO TABLE...</div>
        {error && <div className={styles.errorMsg}>{error}</div>}
        <button className={styles.backLink} onClick={() => navigate("/poker")}>
          ← BACK TO LOBBY
        </button>
      </div>
    );
  }

  // ── Derived state ──
  const isHost = room.hostId === myId;
  const myPlayer = room.players.find((p) => p.userId === myId);
  const isMyTurn = room.currentPlayerId === myId && !!turnInfo;
  const inPlay = ["preflop", "flop", "turn", "river", "showdown"].includes(room.phase);

  // Community cards display (always 5 slots)
  const communityDisplay: (Card | null)[] = (() => {
    const base = (room.communityCards ?? []).filter(Boolean) as Card[];
    const arr: (Card | null)[] = [null, null, null, null, null];
    base.forEach((c, i) => { if (i < 5) arr[i] = c; });
    return arr;
  })();

  // Timer percentage
  const TIMER_TOTAL = 25000;
  const timerPct = Math.min(100, Math.max(0, (timeLeft / TIMER_TOTAL) * 100));
  const timerColor =
    timerPct > 50 ? "#00ffc8" : timerPct > 25 ? "#ffcc00" : "#ff4466";

  const seatsMap = buildSeats(room.players, room.playerOrder, myId);

  // Get result data for a player
  const getResultPlayer = (uid: number) =>
    roundResult?.players.find((p) => p.userId === uid);

  // ── Render ──
  return (
    <div className={styles.root}>
      <div className={styles.scanlines} />

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.roomName}>{room.name}</span>
          <span className={`${styles.phaseBadge} ${styles[`phase_${room.phase}`]}`}>
            {PHASE_LABEL[room.phase] ?? room.phase.toUpperCase()}
          </span>
        </div>

        <div className={styles.headerCenter}>
          {inPlay && (
            <div className={styles.headerPot}>
              <span className={styles.headerPotLabel}>POT</span>
              <span className={styles.headerPotValue}>${room.pot.toLocaleString()}</span>
            </div>
          )}
          <span className={styles.headerBlind}>BB ${room.bigBlind.toLocaleString()}</span>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.headerBalance}>
            <span className={styles.headerBalanceLabel}>BALANCE</span>
            <span className={styles.headerBalanceValue}>$ {balance.toLocaleString()}</span>
          </div>
          {room.phase === "waiting" && isHost && (
            <button
              className={styles.btnHeader}
              onClick={handleStart}
              disabled={room.players.length < 2}
            >
              ▶ START
            </button>
          )}
          {room.phase === "result" && isHost && (
            <button className={styles.btnHeader} onClick={handleRestart}>
              ▶ NEXT
            </button>
          )}
          <button className={styles.btnHeaderLeave} onClick={handleLeave}>
            LEAVE
          </button>
        </div>
      </header>

      {/* ── Game Area ── */}
      <div className={styles.gameArea}>

        {/* ── Oval Table ── */}
        <div className={styles.tableOval}>
          {/* Community cards on table */}
          <div className={styles.tableContent}>
            <div className={styles.communityRow}>
              {communityDisplay.map((c, i) =>
                c ? (
                  <PlayingCard key={`cc${i}-${dealKey}`} card={c} size="md" delay={i * 0.08} />
                ) : (
                  <CardPlaceholder key={`cp${i}`} size="md" />
                )
              )}
            </div>
            {(inPlay || room.phase === "result") && room.pot > 0 && (
              <div className={styles.tablePot}>
                <span className={styles.tablePotLabel}>POT</span>
                <span className={styles.tablePotValue}>${room.pot.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Seats ── */}
        {seatsMap.map((slot, visualSeat) => {
          if (!slot) return null;
          const { player } = slot;
          const isMe = player.userId === myId;
          const isCurrent = room.currentPlayerId === player.userId && inPlay;
          const act = lastAction?.userId === player.userId ? lastAction : null;
          const rp = getResultPlayer(player.userId);
          const pos = SEAT_POSITIONS[visualSeat];

          return (
            <div
              key={player.userId}
              className={`
                ${styles.seat}
                ${isCurrent ? styles.seatCurrent : ""}
                ${player.status === "folded" ? styles.seatFolded : ""}
                ${player.status === "allin" ? styles.seatAllin : ""}
                ${isMe ? styles.seatMe : ""}
              `}
              style={{ left: pos.left, top: pos.top }}
            >
              {/* Action popup */}
              {act && (
                <div
                  className={`${styles.actionPopup} ${
                    act.action === "fold"
                      ? styles.actionFold
                      : act.action === "raise" || act.action === "bet"
                      ? styles.actionRaise
                      : styles.actionCall
                  }`}
                >
                  {act.action.toUpperCase()}
                  {act.amount !== undefined ? ` $${act.amount.toLocaleString()}` : ""}
                  {act.auto ? " (AUTO)" : ""}
                </div>
              )}

              {/* Timer bar for current player */}
              {isCurrent && room.actionDeadline && (
                <div className={styles.seatTimerBar}>
                  <div
                    className={styles.seatTimerFill}
                    style={{
                      width: `${Math.max(0, ((room.actionDeadline - Date.now()) / 25000) * 100)}%`,
                    }}
                  />
                </div>
              )}

              {/* Avatar */}
              <div className={styles.seatAvatar}>
                {player.username.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className={styles.seatInfo}>
                <div className={styles.seatNameRow}>
                  <span className={styles.seatUsername}>{player.username.toUpperCase()}</span>
                  {isMe && <span className={styles.seatBadgeYou}>YOU</span>}
                </div>
                <div className={styles.seatChips}>${player.chips.toLocaleString()}</div>

                {/* Badges */}
                <div className={styles.seatBadges}>
                  {player.isDealer && <span className={`${styles.seatBadge} ${styles.badgeD}`}>D</span>}
                  {player.isSB && <span className={`${styles.seatBadge} ${styles.badgeSB}`}>SB</span>}
                  {player.isBB && <span className={`${styles.seatBadge} ${styles.badgeBB}`}>BB</span>}
                  {player.status === "allin" && (
                    <span className={`${styles.seatBadge} ${styles.badgeAllin}`}>ALLIN</span>
                  )}
                </div>

                {/* Hand name at result */}
                {(room.phase === "result" || roundResult) && rp?.handName && (
                  <div className={styles.seatHandName}>{rp.handName.toUpperCase()}</div>
                )}

                {/* Net result */}
                {rp?.net !== undefined && (
                  <div
                    className={`${styles.seatNet} ${
                      rp.net >= 0 ? styles.seatNetWin : styles.seatNetLose
                    }`}
                  >
                    {rp.net >= 0 ? "+" : ""}${rp.net.toLocaleString()}
                  </div>
                )}
              </div>

              {/* Bet chip */}
              {player.bet > 0 && (
                <div className={styles.betChip}>${player.bet.toLocaleString()}</div>
              )}

              {/* Opponent hole cards (not hero, show during showdown/result or if revealed) */}
              {!isMe && player.holeCards && player.holeCards.length > 0 && (
                <div className={styles.seatCards}>
                  {player.holeCards.map((c, ci) =>
                    c ? (
                      <PlayingCard
                        key={`sc${player.userId}-${ci}-${dealKey}`}
                        card={c}
                        size="sm"
                        delay={ci * 0.05}
                        dim={player.status === "folded"}
                      />
                    ) : (
                      <CardBack key={`sb${player.userId}-${ci}`} size="sm" />
                    )
                  )}
                </div>
              )}
              {!isMe && (!player.holeCards || player.holeCards.length === 0) && inPlay && (
                <div className={styles.seatCards}>
                  <CardBack size="sm" delay={0} />
                  <CardBack size="sm" delay={0.06} />
                </div>
              )}
            </div>
          );
        })}

        {/* ── Hero Cards (bottom center, large) ── */}
        <div className={styles.heroCards}>
          {room.phase === "waiting" ? (
            <>
              <CardPlaceholder size="lg" />
              <CardPlaceholder size="lg" />
            </>
          ) : myCards.length === 2 ? (
            myCards.map((c, i) => (
              <PlayingCard
                key={`hero${i}-${dealKey}`}
                card={c}
                size="lg"
                delay={0.1 + i * 0.14}
                dim={myPlayer?.status === "folded"}
              />
            ))
          ) : (
            <>
              <CardBack size="lg" />
              <CardBack size="lg" />
            </>
          )}
        </div>

        {/* ── Waiting message ── */}
        {room.phase === "waiting" && (
          <div className={styles.waitingOverlay}>
            <div className={styles.waitingText}>
              {room.players.length < 2
                ? "WAITING FOR PLAYERS..."
                : isHost
                ? "PRESS START TO BEGIN"
                : "WAITING FOR HOST TO START"}
            </div>
            {isHost && room.players.length >= 2 && (
              <button className={styles.btnStartBig} onClick={handleStart}>
                ▶ START GAME
              </button>
            )}
          </div>
        )}

        {/* ── Waiting for result next hand ── */}
        {room.phase === "result" && !roundResult && (
          <div className={styles.waitingOverlay}>
            <div className={styles.waitingText}>ROUND COMPLETE</div>
            {isHost ? (
              <button className={styles.btnStartBig} onClick={handleRestart}>
                ▶ NEXT HAND
              </button>
            ) : (
              <div className={styles.waitingSubText}>Waiting for host...</div>
            )}
          </div>
        )}

        {/* ── Action Panel ── */}
        {isMyTurn && turnInfo && (
          <div className={styles.actionPanel}>
            {/* Timer bar */}
            <div className={styles.actionTimerBar}>
              <div
                className={styles.actionTimerFill}
                style={{
                  width: `${timerPct}%`,
                  background: timerColor,
                  boxShadow: `0 0 8px ${timerColor}`,
                }}
              />
            </div>
            <div className={styles.actionTimerLabel}>
              {Math.ceil(timeLeft / 1000)}s
            </div>

            <div className={styles.actionButtons}>
              {/* FOLD */}
              <button
                className={`${styles.actionBtn} ${styles.actionBtnFold}`}
                onClick={() => sendBet("fold")}
              >
                FOLD
              </button>

              {/* CHECK */}
              {turnInfo.actions.includes("check") && (
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnCheck}`}
                  onClick={() => sendBet("check")}
                >
                  CHECK
                </button>
              )}

              {/* CALL */}
              {turnInfo.actions.includes("call") && turnInfo.callAmount > 0 && (
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnCall}`}
                  onClick={() => sendBet("call")}
                >
                  CALL ${turnInfo.callAmount.toLocaleString()}
                </button>
              )}

              {/* RAISE / BET */}
              {turnInfo.actions.includes("raise") && (
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnRaise}`}
                  onClick={() => sendBet("raise", raiseAmount)}
                >
                  {turnInfo.callAmount > 0 ? "RAISE" : "BET"} ${raiseAmount.toLocaleString()}
                </button>
              )}
              {turnInfo.actions.includes("bet") && (
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnRaise}`}
                  onClick={() => sendBet("bet", raiseAmount)}
                >
                  BET ${raiseAmount.toLocaleString()}
                </button>
              )}
            </div>

            {/* Raise slider */}
            {(turnInfo.actions.includes("raise") || turnInfo.actions.includes("bet")) && (
              <div className={styles.raiseSection}>
                <div className={styles.raiseSliderRow}>
                  <button
                    className={styles.raiseStepBtn}
                    onClick={() =>
                      setRaiseAmount((a) =>
                        Math.max(turnInfo.minRaiseTo, a - room.bigBlind)
                      )
                    }
                  >
                    −
                  </button>
                  <input
                    type="range"
                    className={styles.raiseSlider}
                    min={turnInfo.minRaiseTo}
                    max={turnInfo.maxRaiseTo}
                    step={room.bigBlind}
                    value={raiseAmount}
                    onChange={(e) => setRaiseAmount(Number(e.target.value))}
                  />
                  <button
                    className={styles.raiseStepBtn}
                    onClick={() =>
                      setRaiseAmount((a) =>
                        Math.min(turnInfo.maxRaiseTo, a + room.bigBlind)
                      )
                    }
                  >
                    +
                  </button>
                </div>
                <div className={styles.raisePresets}>
                  {[
                    { label: "½ POT", mult: 0.5 },
                    { label: "POT", mult: 1 },
                    { label: "2x POT", mult: 2 },
                  ].map(({ label, mult }) => {
                    const v = Math.min(
                      Math.max(
                        turnInfo.minRaiseTo,
                        Math.round((turnInfo.pot * mult) / room.bigBlind) * room.bigBlind
                      ),
                      turnInfo.maxRaiseTo
                    );
                    if (v < turnInfo.minRaiseTo) return null;
                    return (
                      <button
                        key={label}
                        className={styles.raisePresetBtn}
                        onClick={() => setRaiseAmount(v)}
                      >
                        {label}
                      </button>
                    );
                  })}
                  <button
                    className={`${styles.raisePresetBtn} ${styles.raisePresetAllin}`}
                    onClick={() => setRaiseAmount(turnInfo.maxRaiseTo)}
                  >
                    ALL-IN
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Waiting for other player ── */}
        {!isMyTurn && inPlay && room.currentPlayerId && !roundResult && (
          <div className={styles.waitingIndicator}>
            {room.players.find((p) => p.userId === room.currentPlayerId)?.username.toUpperCase()}{" "}
            IS DECIDING...
          </div>
        )}

        {/* ── Error ── */}
        {error && <div className={styles.errorMsg}>{error}</div>}
      </div>

      {/* ── Round Result Overlay ── */}
      {roundResult && (
        <div className={styles.resultOverlay}>
          <div className={styles.resultPanel}>
            <div className={styles.resultPanelCornerTL} />
            <div className={styles.resultPanelCornerBR} />

            <div className={styles.resultTitle}>
              {roundResult.winnerIds.includes(myId) ? (
                <span className={styles.resultTitleWin}>YOU WIN!</span>
              ) : (
                <span className={styles.resultTitleLose}>ROUND END</span>
              )}
            </div>

            <div className={styles.resultPot}>
              POT: <span>${roundResult.pot.toLocaleString()}</span>
            </div>

            {/* Community cards at result */}
            {roundResult.isShowdown && (
              <div className={styles.resultCommunity}>
                {(roundResult.communityCards ?? []).filter(Boolean).map((c, i) =>
                  c ? <PlayingCard key={`rc${i}`} card={c as Card} size="sm" delay={i * 0.05} /> : null
                )}
              </div>
            )}

            <div className={styles.resultPlayers}>
              {roundResult.players.map((rp) => {
                const isWinner = roundResult.winnerIds.includes(rp.userId);
                return (
                  <div
                    key={rp.userId}
                    className={`${styles.resultPlayerRow} ${isWinner ? styles.resultPlayerWinner : ""}`}
                  >
                    <div className={styles.resultPlayerInfo}>
                      <span className={styles.resultPlayerName}>{rp.username.toUpperCase()}</span>
                      {rp.handName && (
                        <span className={styles.resultHandName}>{rp.handName.toUpperCase()}</span>
                      )}
                    </div>
                    {roundResult.isShowdown && rp.holeCards && rp.holeCards.length > 0 && (
                      <div className={styles.resultPlayerCards}>
                        {rp.holeCards.map((c, ci) =>
                          c ? (
                            <PlayingCard key={`rpc${rp.userId}-${ci}`} card={c} size="sm" />
                          ) : null
                        )}
                      </div>
                    )}
                    {rp.net !== undefined && (
                      <span
                        className={`${styles.resultNet} ${
                          rp.net >= 0 ? styles.resultNetWin : styles.resultNetLose
                        }`}
                      >
                        {rp.net >= 0 ? "+" : ""}${rp.net.toLocaleString()}
                      </span>
                    )}
                    {isWinner && <span className={styles.winnerCrown}>♛</span>}
                  </div>
                );
              })}
            </div>

            <div className={styles.resultActions}>
              {isHost ? (
                <button className={styles.resultBtnNext} onClick={handleRestart}>
                  ▶ NEXT HAND
                </button>
              ) : (
                <div className={styles.resultWaiting}>Waiting for host...</div>
              )}
              <button className={styles.resultBtnLeave} onClick={handleLeave}>
                LEAVE TABLE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
