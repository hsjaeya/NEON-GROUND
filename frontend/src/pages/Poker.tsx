import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/Authcontext";
import styles from "./Poker.module.css";

type Suit = "S" | "H" | "D" | "C";
type Rank =
  | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10"
  | "J" | "Q" | "K" | "A";

interface Card { suit: Suit; rank: Rank; }

type Phase = "idle" | "flop" | "result";

interface SettleResult {
  action: string;
  dealerCards: Card[];
  turn: Card | null;
  river: Card | null;
  playerHand?: string;
  dealerHand?: string;
  dealerQualifies?: boolean;
  result: "player" | "dealer" | "push" | "no-qualify" | "fold";
  payout: number;
  net: number;
}

const API_URL = import.meta.env.VITE_API_URL;

const RANK_VAL: Record<string, number> = {
  "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14,
};

function evaluateHand(cards: Card[]): { name: string; level: "strong" | "medium" | "weak" } {
  const vals = cards.map((c) => RANK_VAL[c.rank]).sort((a, b) => a - b);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);
  const isNormalStraight = vals[4] - vals[0] === 4 && new Set(vals).size === 5;
  const isWheel = vals.join(",") === "2,3,4,5,14";
  const isStraight = isNormalStraight || isWheel;
  const freq: Record<number, number> = {};
  for (const v of vals) freq[v] = (freq[v] || 0) + 1;
  const counts = Object.values(freq).sort((a, b) => b - a);
  if (isFlush && isStraight) {
    const isRoyal = vals.join(",") === "10,11,12,13,14";
    return { name: isRoyal ? "ROYAL FLUSH" : "STRAIGHT FLUSH", level: "strong" };
  }
  if (counts[0] === 4) return { name: "FOUR OF A KIND", level: "strong" };
  if (counts[0] === 3 && counts[1] === 2) return { name: "FULL HOUSE", level: "strong" };
  if (isFlush) return { name: "FLUSH", level: "strong" };
  if (isStraight) return { name: "STRAIGHT", level: "strong" };
  if (counts[0] === 3) return { name: "THREE OF A KIND", level: "medium" };
  if (counts[0] === 2 && counts[1] === 2) return { name: "TWO PAIR", level: "medium" };
  if (counts[0] === 2) return { name: "ONE PAIR", level: "weak" };
  return { name: "HIGH CARD", level: "weak" };
}

const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const RED_SUITS = new Set<string>(["H", "D"]);
const ANTE_OPTIONS = [1000, 5000, 10000, 50000];

function PlayingCard({ card }: { card: Card }) {
  const isRed = RED_SUITS.has(card.suit);
  const cls = isRed ? styles.suitRed : styles.suitBlack;
  return (
    <div className={styles.card}>
      <div className={styles.cardCornerTop}>
        <span className={`${styles.cardRankSmall} ${cls}`}>{card.rank}</span>
        <span className={`${styles.cardSuitSmall} ${cls}`}>{SUIT_SYMBOL[card.suit]}</span>
      </div>
      <span className={`${styles.cardCenter} ${cls}`}>{SUIT_SYMBOL[card.suit]}</span>
      <div className={styles.cardCornerBottom}>
        <span className={`${styles.cardRankSmall} ${cls}`}>{card.rank}</span>
        <span className={`${styles.cardSuitSmall} ${cls}`}>{SUIT_SYMBOL[card.suit]}</span>
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div className={`${styles.card} ${styles.cardBack}`}>
      <div className={styles.cardBackInner}>
        <span className={styles.cardBackSymbol}>♠</span>
      </div>
    </div>
  );
}

function EmptyCard() {
  return <div className={`${styles.card} ${styles.cardEmpty}`} />;
}

export default function Poker() {
  const { user, refreshUser } = useAuth();

  const [phase, setPhase] = useState<Phase>("idle");
  const [ante, setAnte] = useState(5000);
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [dealerCards, setDealerCards] = useState<Card[]>([]);
  const [flop, setFlop] = useState<Card[]>([]);
  const [remaining, setRemaining] = useState<Card[]>([]);
  const [settle, setSettle] = useState<SettleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");
  const balance = parseFloat(String(user?.balance ?? 0));

  const handleDeal = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    setSettle(null);
    try {
      const res = await fetch(`${API_URL}/games/poker/deal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Deal failed");
      const data = await res.json();
      setPlayerCards(data.playerCards);
      setDealerCards(data.dealerCards);
      setFlop(data.flop);
      setRemaining(data.remaining);
      setPhase("flop");
    } catch {
      setError("CONNECTION ERROR");
    } finally {
      setLoading(false);
    }
  }, [loading, token]);

  const handleSettle = useCallback(
    async (action: "call" | "fold") => {
      if (loading || phase !== "flop") return;
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_URL}/games/poker/settle`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ anteBet: ante, action, playerCards, dealerCards, flop, remaining }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Settle failed");
        }
        const data: SettleResult = await res.json();
        setSettle(data);
        setDealerCards(data.dealerCards);
        if (data.turn) setFlop((prev) => [...prev, data.turn!, data.river!]);
        setPhase("result");
        await refreshUser();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message.toUpperCase() : "ERROR");
      } finally {
        setLoading(false);
      }
    },
    [loading, phase, token, ante, playerCards, dealerCards, flop, remaining, refreshUser]
  );

  const handleReset = () => {
    setPhase("idle");
    setPlayerCards([]);
    setDealerCards([]);
    setFlop([]);
    setRemaining([]);
    setSettle(null);
    setError("");
  };

  // community: idle→5 empty, flop→3 real+2 empty, result→5 real (or 3 if folded)
  const communityDisplay: (Card | null)[] =
    phase === "idle"
      ? [null, null, null, null, null]
      : phase === "flop"
      ? [...flop, null, null]
      : flop.length === 5
      ? flop
      : [...flop, null, null]; // fold case: only 3 community cards

  const resultText = (): { text: string; cls: string } => {
    if (!settle) return { text: "", cls: "" };
    if (settle.result === "fold")      return { text: "FOLDED · ANTE LOST", cls: styles.resultLose };
    if (settle.result === "dealer")    return { text: "DEALER WINS", cls: styles.resultLose };
    if (settle.result === "push")      return { text: "PUSH · BET RETURNED", cls: styles.resultPush };
    if (settle.result === "no-qualify")
      return { text: `DEALER NO QUALIFY · +$${settle.net.toLocaleString()}`, cls: styles.resultWin };
    return { text: `${settle.playerHand?.toUpperCase()} · +$${settle.net.toLocaleString()}`, cls: styles.resultWin };
  };

  const { text: bannerText, cls: bannerCls } = resultText();

  return (
    <div className={styles.root}>
      <div className={styles.scanlines} />
      <div className={styles.dotGrid} />

      <header className={styles.hud}>
        <Link to="/" className={styles.hudLogo}>
          <div className={styles.hudDot} />
          <span>NEON GROUND</span>
        </Link>
        <div className={styles.hudInfo}>
          <div className={styles.hudStat}>
            <span className={styles.hudLabel}>PLAYER</span>
            <span className={styles.hudValue}>{user?.username.toUpperCase()}</span>
          </div>
          <div className={styles.hudDivider} />
          <div className={styles.hudStat}>
            <span className={styles.hudLabel}>BALANCE</span>
            <span className={styles.hudValue}>$ {balance.toLocaleString()}</span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.titleBlock}>
          <p className={styles.titleEyebrow}>// HOLD'EM PROTOCOL //</p>
          <h1 className={styles.title}>
            TEXAS <span className={styles.titleAccent}>HOLD'EM</span>
          </h1>
        </div>

        <div className={styles.table}>
          {/* Dealer */}
          <span className={styles.zoneLabel}>DEALER</span>
          <div className={styles.cardRow}>
            {phase === "idle" ? (
              <><EmptyCard /><EmptyCard /></>
            ) : phase === "flop" ? (
              <><CardBack /><CardBack /></>
            ) : (
              dealerCards.map((c, i) => <PlayingCard key={i} card={c} />)
            )}
          </div>
          <div className={styles.handLabel}>
            {phase === "result" && settle && settle.result !== "fold" && (
              <span className={settle.dealerQualifies ? styles.handLabelHighlight : ""}>
                {settle.dealerQualifies
                  ? settle.dealerHand?.toUpperCase()
                  : "DOES NOT QUALIFY (< PAIR OF 4s)"}
              </span>
            )}
          </div>

          <div className={styles.separator} />

          {/* Community */}
          <span className={styles.zoneLabel}>COMMUNITY</span>
          <div className={styles.communityRow}>
            {communityDisplay.slice(0, 3).map((c, i) =>
              c ? <PlayingCard key={i} card={c} /> : <EmptyCard key={i} />
            )}
            <div className={styles.communityDivider} />
            {communityDisplay.slice(3).map((c, i) =>
              c ? <PlayingCard key={i + 3} card={c} /> : <EmptyCard key={i + 3} />
            )}
          </div>

          <div className={styles.separator} />

          {/* Player */}
          <div className={styles.cardRow}>
            {phase === "idle" ? (
              <><EmptyCard /><EmptyCard /></>
            ) : (
              playerCards.map((c, i) => <PlayingCard key={i} card={c} />)
            )}
          </div>
          <div className={styles.handLabel}>
            {phase === "flop" && playerCards.length === 2 && flop.length === 3 && (() => {
              const h = evaluateHand([...playerCards, ...flop]);
              return (
                <span className={
                  h.level === "strong" ? styles.handStrong
                  : h.level === "medium" ? styles.handMedium
                  : styles.handWeak
                }>
                  {h.name}
                </span>
              );
            })()}
            {phase === "result" && settle && settle.result !== "fold" && (
              <span className={styles.handLabelHighlight}>
                {settle.playerHand?.toUpperCase()}
              </span>
            )}
          </div>
          <span className={styles.zoneLabel}>YOU</span>

          <div className={styles.separator} />

          {/* Pot */}
          {phase !== "idle" && (
            <div className={styles.potRow}>
              <div className={styles.potItem}>
                <span className={styles.potItemLabel}>ANTE</span>
                <span className={styles.potItemValue}>${ante.toLocaleString()}</span>
              </div>
              {phase === "result" && settle?.action === "call" && (
                <>
                  <div className={styles.potItem}>
                    <span className={styles.potItemLabel}>CALL</span>
                    <span className={styles.potItemValue}>${(ante * 2).toLocaleString()}</span>
                  </div>
                  <div className={styles.potItem}>
                    <span className={styles.potItemLabel}>TOTAL</span>
                    <span className={styles.potItemValue}>${(ante * 3).toLocaleString()}</span>
                  </div>
                  <div className={styles.potItem}>
                    <span className={styles.potItemLabel}>PAYOUT</span>
                    <span className={styles.potItemValue}>${settle.payout.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Result */}
          <div className={`${styles.resultBanner} ${bannerCls}`}>{bannerText}</div>

          <div className={styles.separator} />

          {/* Controls — inside table */}
          <div className={styles.controlsInner}>
            {phase === "idle" && (
              <>
                <div className={styles.betRow}>
                  <span className={styles.betLabel}>ANTE</span>
                  <div className={styles.betChips}>
                    {ANTE_OPTIONS.map((v) => (
                      <button
                        key={v}
                        className={`${styles.betChip} ${ante === v ? styles.betChipActive : ""}`}
                        onClick={() => setAnte(v)}
                      >
                        {v >= 1000 ? `${v / 1000}K` : v}
                      </button>
                    ))}
                  </div>
                  <span className={styles.betValue}>${ante.toLocaleString()}</span>
                </div>
                <button
                  className={`${styles.btn} ${styles.btnDeal}`}
                  onClick={handleDeal}
                  disabled={loading || balance < ante}
                >
                  {loading ? "DEALING..." : "DEAL"}
                </button>
              </>
            )}

            {phase === "flop" && (
              <>
                <span className={styles.callInfo}>
                  CALL = ${(ante * 2).toLocaleString()} · TOTAL = ${(ante * 3).toLocaleString()}
                </span>
                <div className={styles.actionRow}>
                  <button
                    className={`${styles.btn} ${styles.btnFold}`}
                    onClick={() => handleSettle("fold")}
                    disabled={loading}
                  >
                    FOLD
                  </button>
                  <button
                    className={`${styles.btn} ${styles.btnCall}`}
                    onClick={() => handleSettle("call")}
                    disabled={loading || balance < ante * 3}
                  >
                    {loading ? "..." : "CALL"}
                  </button>
                </div>
              </>
            )}

            {phase === "result" && (
              <button className={`${styles.btn} ${styles.btnAgain}`} onClick={handleReset}>
                PLAY AGAIN
              </button>
            )}

            {error && <span className={styles.errorMsg}>{error}</span>}
            <Link to="/" className={styles.backLink}>← BACK TO VAULT</Link>
          </div>
        </div>

        {/* Payout Table */}
        <div className={styles.payoutPanel}>
          <span className={styles.payoutTitle}>// ANTE PAYOUT //</span>
          <div className={styles.payoutGrid}>
            {[
              { hand: "ROYAL FLUSH",    mult: "100:1", tier: "top" },
              { hand: "STRAIGHT FLUSH", mult: "20:1",  tier: "top" },
              { hand: "FOUR OF A KIND", mult: "10:1",  tier: "high" },
              { hand: "FULL HOUSE",     mult: "3:1",   tier: "high" },
              { hand: "FLUSH",          mult: "2:1",   tier: "mid" },
              { hand: "STRAIGHT",       mult: "1:1",   tier: "low" },
              { hand: "THREE OF A KIND",mult: "1:1",   tier: "low" },
              { hand: "TWO PAIR",       mult: "1:1",   tier: "low" },
              { hand: "ONE PAIR",       mult: "1:1",   tier: "low" },
            ].map(({ hand, mult, tier }) => (
              <div key={hand} className={styles.payoutRow}>
                <span className={`${styles.payoutHand} ${styles[`payoutTier_${tier}`]}`}>{hand}</span>
                <span className={`${styles.payoutMult} ${styles[`payoutTier_${tier}`]}`}>{mult}</span>
              </div>
            ))}
          </div>
          <div className={styles.payoutNote}>
            <span>CALL BET ALWAYS PAYS 1:1 ON WIN</span>
            <span>DEALER MUST QUALIFY · PAIR OF 4s+</span>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <span>SYS.STATUS :: HOLD'EM ONLINE</span>
        <div className={styles.pulseBars}>
          {[4, 9, 14, 7, 11].map((h, i) => (
            <span
              key={i}
              className={styles.pulseBar}
              style={{ height: `${h}px`, animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
        <span>DEALER QUALIFIES PAIR 4s+</span>
      </footer>
    </div>
  );
}
