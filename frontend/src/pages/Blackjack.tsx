import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../context/Authcontext";
import styles from "./Blackjack.module.css";
import BlackjackRules from "../components/BlackjackRules";

const WS_URL = import.meta.env.VITE_WS_URL ?? import.meta.env.VITE_API_URL;

type Suit = "S" | "H" | "D" | "C";
type Rank = "2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"10"|"J"|"Q"|"K"|"A";
interface Card { suit: Suit; rank: Rank; }

type Phase = "idle" | "player" | "dealer" | "result";
type Result = "blackjack" | "dealer_blackjack" | "win" | "lose" | "bust" | "push";

interface GameState {
  phase: Phase;
  playerHand: Card[];
  dealerHand: (Card | null)[];
  playerValue: number;
  dealerValue: number;
  bet: number;
  result?: Result;
  net?: number;
  canDouble: boolean;
}

const SUIT_SYMBOL: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const RED_SUITS = new Set(["H", "D"]);

const CHIP_CONFIG = [
  { amount: 500,    label: "500",   accent: "#00ffc8" },
  { amount: 1000,   label: "1K",    accent: "#0088ff" },
  { amount: 5000,   label: "5K",    accent: "#8844ff" },
  { amount: 10000,  label: "10K",   accent: "#ff2288" },
  { amount: 50000,  label: "50K",   accent: "#ffcc00" },
  { amount: 100000, label: "100K",  accent: "#ff6600" },
];

const RESULT_CONFIG: Record<Result, { label: string; color: string }> = {
  blackjack:        { label: "BLACKJACK!",    color: "#ffcc00" },
  win:              { label: "YOU WIN!",       color: "#00ffc8" },
  push:             { label: "PUSH",           color: "#aabbff" },
  lose:             { label: "DEALER WINS",    color: "#ff4466" },
  bust:             { label: "BUST!",          color: "#ff4466" },
  dealer_blackjack: { label: "DEALER BJ",      color: "#ff4466" },
};

function PlayingCard({ card, delay = 0, dim = false }: { card: Card; delay?: number; dim?: boolean }) {
  const isRed = RED_SUITS.has(card.suit);
  const cls = isRed ? styles.suitRed : styles.suitBlack;
  return (
    <div className={`${styles.card} ${dim ? styles.cardDim : ""}`} style={{ animationDelay: `${delay}s` }}>
      <div className={styles.cardCornerTop}>
        <span className={`${styles.cardRank} ${cls}`}>{card.rank}</span>
        <span className={`${styles.cardSuit} ${cls}`}>{SUIT_SYMBOL[card.suit]}</span>
      </div>
      <span className={`${styles.cardCenter} ${cls}`}>{SUIT_SYMBOL[card.suit]}</span>
      <div className={styles.cardCornerBottom}>
        <span className={`${styles.cardRank} ${cls}`}>{card.rank}</span>
        <span className={`${styles.cardSuit} ${cls}`}>{SUIT_SYMBOL[card.suit]}</span>
      </div>
    </div>
  );
}

function CardBack({ delay = 0 }: { delay?: number }) {
  return (
    <div className={`${styles.card} ${styles.cardBack}`} style={{ animationDelay: `${delay}s` }}>
      <div className={styles.cardBackInner}><span className={styles.cardBackSymbol}>◈</span></div>
    </div>
  );
}

function EmptyCardSlot() {
  return <div className={`${styles.card} ${styles.cardEmpty}`} />;
}

function ValueBadge({ value, bust }: { value: number; bust?: boolean }) {
  if (value === 0) return null;
  return (
    <div className={`${styles.valueBadge} ${bust ? styles.valueBadgeBust : value === 21 ? styles.valueBadge21 : ""}`}>
      {value}
    </div>
  );
}

export default function Blackjack() {
  const { user, refreshUser } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const token = localStorage.getItem("token");

  const [gs, setGs] = useState<GameState | null>(null);
  const [localBet, setLocalBet] = useState(0);
  const [error, setError] = useState("");
  const [dealKey, setDealKey] = useState(0);

  const balance = parseFloat(String(user?.balance ?? 0));

  useEffect(() => {
    const socket = io(`${WS_URL}/blackjack`, { auth: { token }, transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("gameState", (state: GameState) => {
      setGs(prev => {
        // New hand started — trigger deal animation
        if (prev?.phase === "idle" && state.phase === "player") {
          setDealKey(k => k + 1);
        }
        // Result came in — refresh balance
        if (state.phase === "result") {
          refreshUser();
        }
        return state;
      });
      setError("");
    });

    socket.on("error", (d: { message: string }) => setError(d.message));
    socket.on("connect_error", () => setError("CONNECTION ERROR"));

    return () => { socket.disconnect(); };
  }, [token, refreshUser]);

  const send = useCallback((event: string, data?: unknown) => {
    setError("");
    socketRef.current?.emit(event, data);
  }, []);

  const addChip = (amount: number) => {
    setLocalBet(b => {
      const next = b + amount;
      return next > Math.min(balance, 500000) ? b : next;
    });
  };

  const handleDeal = () => {
    if (localBet < 500) { setError("Minimum bet is $500"); return; }
    send("placeBet", { amount: localBet });
    setLocalBet(0);
  };

  const handleNewGame = () => {
    send("newGame");
    setLocalBet(0);
  };

  if (!gs) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingText}>CONNECTING...</div>
        {error && <div className={styles.errorMsg}>{error}</div>}
        <Link to="/" className={styles.backLink}>← BACK TO VAULT</Link>
      </div>
    );
  }

  const inPlay = gs.phase === "player" || gs.phase === "dealer";
  const playerBust = gs.playerValue > 21;
  const dealerBust = gs.dealerValue > 21 && gs.phase === "result";
  const resultInfo = gs.result ? RESULT_CONFIG[gs.result] : null;

  return (
    <div className={styles.root}>
      <div className={styles.scanlines} />
      <div className={styles.dotGrid} />

      <BlackjackRules />

      {/* Header */}
      <header className={styles.header}>
        <Link to="/" className={styles.backBtn}>← BACK</Link>
        <div className={styles.headerTitle}>
          <span className={styles.headerIcon}>♠</span>
          <span>BLACK<span className={styles.headerAccent}>JACK</span></span>
        </div>
        <div className={styles.headerBalance}>
          <span className={styles.balanceLabel}>BALANCE</span>
          <span className={styles.balanceValue}>$ {balance.toLocaleString()}</span>
        </div>
      </header>

      <main className={styles.main}>
        {/* TABLE */}
        <div className={styles.tableWrap}>
          <div className={styles.table}>

            {/* Dealer zone */}
            <div className={styles.dealerZone}>
              <div className={styles.zoneLabel}>
                DEALER
                {(inPlay || gs.phase === "result") && gs.dealerValue > 0 && (
                  <ValueBadge value={gs.dealerValue} bust={dealerBust} />
                )}
              </div>
              <div className={styles.cardRow}>
                {gs.phase === "idle" ? (
                  <><EmptyCardSlot /><EmptyCardSlot /></>
                ) : (
                  gs.dealerHand.map((c, i) =>
                    c ? (
                      <PlayingCard key={`d${i}-${dealKey}`} card={c} delay={i * 0.12} />
                    ) : (
                      <CardBack key={`db${i}`} delay={0.12} />
                    )
                  )
                )}
              </div>
            </div>

            <div className={styles.tableDivider} />

            {/* Center info */}
            <div className={styles.tableCenter}>
              {gs.phase === "idle" && (
                <div className={styles.payoutTable}>
                  <div className={styles.payoutRow}><span>BLACKJACK</span><span className={styles.payoutVal}>3:2</span></div>
                  <div className={styles.payoutRow}><span>WIN</span><span className={styles.payoutVal}>1:1</span></div>
                  <div className={styles.payoutRow}><span>PUSH</span><span className={styles.payoutVal}>TIE</span></div>
                  <div className={styles.payoutNote}>DEALER STANDS ON 17</div>
                </div>
              )}
              {(inPlay || gs.phase === "result") && gs.bet > 0 && (
                <div className={styles.betDisplay}>
                  <span className={styles.betLabel}>BET</span>
                  <span className={styles.betAmount}>${gs.bet.toLocaleString()}</span>
                </div>
              )}
              {resultInfo && gs.phase === "result" && (
                <div className={styles.resultBanner} style={{ color: resultInfo.color, borderColor: resultInfo.color }}>
                  <span className={styles.resultLabel}>{resultInfo.label}</span>
                  {gs.net !== undefined && gs.net !== 0 && (
                    <span className={`${styles.resultNet} ${gs.net > 0 ? styles.netPos : styles.netNeg}`}>
                      {gs.net > 0 ? "+" : ""}${gs.net.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className={styles.tableDivider} />

            {/* Player zone */}
            <div className={styles.playerZone}>
              <div className={styles.cardRow}>
                {gs.phase === "idle" ? (
                  <><EmptyCardSlot /><EmptyCardSlot /></>
                ) : (
                  gs.playerHand.map((c, i) => (
                    <PlayingCard
                      key={`p${i}-${dealKey}`}
                      card={c}
                      delay={0.08 + i * 0.12}
                      dim={gs.phase === "result" && playerBust}
                    />
                  ))
                )}
              </div>
              <div className={styles.zoneLabel}>
                YOU
                {gs.phase !== "idle" && gs.playerValue > 0 && (
                  <ValueBadge value={gs.playerValue} bust={playerBust} />
                )}
              </div>
            </div>

          </div>
        </div>

        {/* CONTROLS */}
        <div className={styles.controls}>

          {/* Betting phase */}
          {gs.phase === "idle" && (
            <div className={styles.betPanel}>
              <div className={styles.betPanelTop}>
                <div className={styles.currentBet}>
                  <span className={styles.currentBetLabel}>CURRENT BET</span>
                  <span className={styles.currentBetAmount}>${localBet.toLocaleString()}</span>
                </div>
                <button
                  className={styles.btnClear}
                  onClick={() => setLocalBet(0)}
                  disabled={localBet === 0}
                >
                  CLEAR
                </button>
              </div>
              <div className={styles.chipRow}>
                {CHIP_CONFIG.map(chip => (
                  <button
                    key={chip.amount}
                    className={styles.chip}
                    style={{ '--accent': chip.accent } as React.CSSProperties}
                    onClick={() => addChip(chip.amount)}
                    disabled={localBet + chip.amount > Math.min(balance, 500000)}
                  >
                    <span className={styles.chipPlus}>+</span>
                    <span className={styles.chipLabel}>${chip.label}</span>
                  </button>
                ))}
              </div>
              <button
                className={styles.btnDeal}
                onClick={handleDeal}
                disabled={localBet < 500}
              >
                DEAL ▶
              </button>
              {error && <div className={styles.errorMsg}>{error}</div>}
            </div>
          )}

          {/* Player action phase */}
          {gs.phase === "player" && (
            <div className={styles.actionPanel}>
              <button className={`${styles.btnAction} ${styles.btnHit}`} onClick={() => send("hit")}>
                HIT
              </button>
              <button className={`${styles.btnAction} ${styles.btnStand}`} onClick={() => send("stand")}>
                STAND
              </button>
              {gs.canDouble && (
                <button className={`${styles.btnAction} ${styles.btnDouble}`} onClick={() => send("double")}>
                  DOUBLE<br />
                  <span className={styles.btnSub}>${(gs.bet).toLocaleString()}</span>
                </button>
              )}
              {error && <div className={styles.errorMsg}>{error}</div>}
            </div>
          )}

          {/* Dealer playing */}
          {gs.phase === "dealer" && (
            <div className={styles.dealerPlaying}>
              <span className={styles.dealerPlayingDot} />
              DEALER IS PLAYING...
            </div>
          )}

          {/* Result */}
          {gs.phase === "result" && (
            <div className={styles.resultPanel}>
              <button className={styles.btnNewGame} onClick={handleNewGame}>
                ▶ NEW HAND
              </button>
              <Link to="/" className={styles.backLink}>← VAULT</Link>
            </div>
          )}

        </div>
      </main>

      <footer className={styles.footer}>
        <span className={styles.footerNote}>6-DECK SHOE · DEALER STANDS ON 17 · BLACKJACK PAYS 3:2</span>
      </footer>
    </div>
  );
}
