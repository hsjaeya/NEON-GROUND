import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/Authcontext";
import styles from "./Roulette.module.css";
import RouletteRules from "../components/Rouletterules";
import { io, Socket } from "socket.io-client";

const WHEEL_ORDER = [
  0, 26, 3, 35, 12, 28, 7, 29, 18, 22, 9, 31, 14, 20, 1, 33, 16, 24, 5, 10, 23,
  8, 30, 11, 36, 13, 27, 6, 34, 17, 25, 2, 21, 4, 19, 15, 32,
];

const getNumberColor = (num: number): "red" | "black" | "green" => {
  if (num === 0) return "green";
  const reds = [
    1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
  ];
  return reds.includes(num) ? "red" : "black";
};

type BetType =
  | "straight"
  | "split"
  | "street"
  | "corner"
  | "sixline"
  | "dozen"
  | "column"
  | "redblack"
  | "evenodd"
  | "lowhigh";

type Phase = "betting" | "closing" | "spinning" | "result";
type Bet = {
  id: string;
  type: BetType;
  numbers: number[];
  amount: number;
  name: string;
};
type CelebrationLevel = "none" | "win" | "big" | "jackpot";
type ChatMsg = { username: string; message: string; timestamp: string };

interface UserWithBalance {
  id: number;
  email: string;
  username: string;
  balance?: string | number;
  wallets?: Array<{
    id: number;
    userId: number;
    balance: string | number;
    createdAt: string;
    updatedAt: string;
  }>;
}

export default function Roulette() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const user = authUser as UserWithBalance | null;

  const [bets, setBets] = useState<Bet[]>([]);
  const [chipValue, setChipValue] = useState(1000);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [winAmount, setWinAmount] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [localBalance, setLocalBalance] = useState<number | null>(null);

  const [sessionSpins, setSessionSpins] = useState(0);
  const [sessionNet, setSessionNet] = useState(0);
  const [sessionWins, setSessionWins] = useState(0);
  const [winStreak, setWinStreak] = useState(0);
  const [lossStreak, setLossStreak] = useState(0);

  const [lastBets, setLastBets] = useState<Bet[]>([]);
  const [celebration, setCelebration] = useState<CelebrationLevel>("none");

  const [phase, setPhase] = useState<Phase>("betting");
  const [timeLeft, setTimeLeft] = useState(15);
  const [roundId, setRoundId] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [connected, setConnected] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");

  const [roomUsers, setRoomUsers] = useState<{ count: number; usernames: string[] }>({ count: 0, usernames: [] });
  const [activeTab, setActiveTab] = useState<"chat" | "players">("chat");

  const socketRef = useRef<Socket | null>(null);
  const betsRef = useRef<Bet[]>([]);
  const roundIdRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // 베팅 결과는 휠 애니메이션(6s) 완료 후 적용
  const pendingBetResultRef = useRef<{
    totalWin: number;
    newBalance: number;
    totalBet: number;
  } | null>(null);

  useEffect(() => {
    betsRef.current = bets;
  }, [bets]);
  useEffect(() => {
    roundIdRef.current = roundId;
  }, [roundId]);

  useEffect(() => {
    if (!user) {
      navigate("/login");
    } else {
      setLocalBalance(
        Number(user?.balance ?? user?.wallets?.[0]?.balance ?? 0),
      );
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    const token =
      localStorage.getItem("accessToken") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("accessToken") ||
      sessionStorage.getItem("token");
    if (!token) return;

    const socket = io(`${import.meta.env.VITE_API_URL}/roulette`, {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("chatHistory", (msgs: ChatMsg[]) => {
      setChatMessages(msgs.slice(-50));
    });

    socket.on("recentResults", (results: number[]) => {
      setHistory(results.slice(0, 20));
    });

    socket.on(
      "gameState",
      (data: { phase: Phase; timeLeft: number; roundId: number }) => {
        setPhase(data.phase);
        setTimeLeft(data.timeLeft);
        if (data.roundId !== roundIdRef.current) {
          setRoundId(data.roundId);
          setSubmitted(false);
          setBets([]);
          setResult(null);
          setWinAmount(null);
          setSpinning(false);
          pendingBetResultRef.current = null;
        }
      },
    );

    socket.on("bettingClosed", (data: { roundId: number }) => {
      if (data.roundId !== roundIdRef.current) return;
      const currentBets = betsRef.current;
      if (currentBets.length > 0) {
        socket.emit("submitBets", {
          bets: currentBets.map((b) => ({
            type: b.type,
            numbers: b.numbers,
            amount: b.amount,
          })),
          roundId: data.roundId,
        });
        setLastBets(currentBets);
        setSubmitted(true);
        setBets([]);
      }
    });

    socket.on("spinResult", (data: { result: number; roundId: number }) => {
      setSpinning(true);
      setResult(null);
      setWinAmount(null);
      pendingBetResultRef.current = null;

      const winningNumber = data.result;
      const winningIndex = WHEEL_ORDER.indexOf(winningNumber);
      const degreePerSlot = 360 / WHEEL_ORDER.length;
      const slotsToRotate =
        (WHEEL_ORDER.length - winningIndex - 1 + WHEEL_ORDER.length) %
        WHEEL_ORDER.length;
      setRotation(360 * 10 + slotsToRotate * degreePerSlot);

      setTimeout(() => {
        setResult(winningNumber);
        setHistory((prev) => {
          const next = [winningNumber, ...prev];
          return next.slice(0, 20);
        });
        setSpinning(false);

        const pending = pendingBetResultRef.current;
        if (pending !== null) {
          setWinAmount(pending.totalWin);
          setLocalBalance(pending.newBalance);

          const net = pending.totalWin - pending.totalBet;
          setSessionSpins((p) => p + 1);
          setSessionNet((p) => p + net);

          if (pending.totalWin > 0) {
            setSessionWins((p) => p + 1);
            setWinStreak((p) => p + 1);
            setLossStreak(0);
            const ratio = pending.totalWin / pending.totalBet;
            const level: CelebrationLevel =
              ratio >= 20 ? "jackpot" : ratio >= 4 ? "big" : "win";
            setCelebration(level);
            setTimeout(
              () => setCelebration("none"),
              level === "jackpot" ? 4500 : 2500,
            );
          } else {
            setLossStreak((p) => p + 1);
            setWinStreak(0);
          }
          pendingBetResultRef.current = null;
        }

        setTimeout(() => setRotation(0), 500);
      }, 6100);
    });

    socket.on(
      "betResult",
      (data: { totalWin: number; newBalance: number; totalBet: number }) => {
        pendingBetResultRef.current = data;
      },
    );

    socket.on("chatMessage", (msg: ChatMsg) => {
      setChatMessages((prev) => [...prev.slice(-49), msg]);
    });

    socket.on("roomUsers", (data: { count: number; usernames: string[] }) => {
      setRoomUsers(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // 최근 20회 중 2번 이상 출현한 핫 넘버
  const hotNumbers = useMemo(() => {
    const counts = new Map<number, number>();
    history.forEach((n) => counts.set(n, (counts.get(n) || 0) + 1));
    return new Set(
      [...counts.entries()].filter(([, c]) => c >= 2).map(([n]) => n),
    );
  }, [history]);

  if (!user) {
    return (
      <div className={styles.root}>
        <div className={styles.scanlines} />
        <div className={styles.dotGrid} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            color: "#00ffc8",
            fontFamily: "Orbitron,monospace",
            fontSize: "18px",
            letterSpacing: "0.3em",
          }}
        >
          LOADING...
        </div>
      </div>
    );
  }

  const canBet = phase === "betting" && !submitted;

  const addBet = (type: BetType, numbers: number[], name: string) => {
    if (!canBet) return;
    const numBalance = localBalance ?? 0;
    const totalExisting = bets.reduce((sum, b) => sum + b.amount, 0);
    if (numBalance < chipValue + totalExisting) {
      alert(
        `잔액 부족! (현재: $${numBalance.toLocaleString()}, 총 필요: $${(chipValue + totalExisting).toLocaleString()})`,
      );
      return;
    }

    const numSet = new Set(numbers);
    const dupIdx = bets.findIndex(
      (b) =>
        b.type === type &&
        b.numbers.length === numbers.length &&
        b.numbers.every((n) => numSet.has(n)),
    );
    if (dupIdx !== -1) {
      setBets(bets.map((b, i) =>
        i === dupIdx ? { ...b, amount: b.amount + chipValue } : b,
      ));
      return;
    }

    const outsideTypes: BetType[] = [
      "column",
      "dozen",
      "redblack",
      "evenodd",
      "lowhigh",
    ];
    if (outsideTypes.includes(type) && bets.some((b) => b.type === type)) {
      alert("⚠️ 같은 종류의 외부 베팅은 1개만 가능합니다!");
      return;
    }

    const insideTypes: BetType[] = [
      "straight",
      "split",
      "street",
      "corner",
      "sixline",
    ];
    if (insideTypes.includes(type)) {
      const insideCount = bets.filter((b) =>
        insideTypes.includes(b.type),
      ).length;
      if (insideCount >= 5) {
        alert("⚠️ 내부 베팅은 최대 5개까지 가능합니다!");
        return;
      }
    }

    setBets([
      ...bets,
      {
        id: Date.now().toString() + Math.random(),
        type,
        numbers,
        amount: chipValue,
        name,
      },
    ]);
  };

  const removeBet = (id: string) => {
    if (canBet) setBets(bets.filter((b) => b.id !== id));
  };
  const clearBets = () => {
    if (canBet) setBets([]);
  };
  const rebet = () => {
    if (!canBet || lastBets.length === 0) return;
    setBets(
      lastBets.map((b) => ({
        ...b,
        id: Date.now().toString() + Math.random(),
      })),
    );
  };

  const getPayoutMultiplier = (type: BetType): number => {
    const map: Record<BetType, number> = {
      straight: 35,
      split: 17,
      street: 11,
      corner: 8,
      sixline: 5,
      dozen: 2,
      column: 2,
      redblack: 1,
      evenodd: 1,
      lowhigh: 1,
    };
    return map[type];
  };

  const sendChat = () => {
    const msg = chatInput.trim();
    if (!msg || !socketRef.current) return;
    socketRef.current.emit("chatMessage", { message: msg });
    setChatInput("");
  };

  const totalBetAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const sessionWinRate =
    sessionSpins > 0 ? Math.round((sessionWins / sessionSpins) * 100) : 0;

  const timerColor =
    timeLeft <= 5 ? "#ff4444" : timeLeft <= 10 ? "#ffcc00" : "#00ffc8";
  const phaseLabel: Record<Phase, string> = {
    betting: "BETTING",
    closing: "CLOSING",
    spinning: "SPINNING",
    result: "RESULT",
  };

  return (
    <div className={styles.root}>
      <div className={styles.scanlines} />
      <div className={styles.dotGrid} />

      {celebration !== "none" && (
        <div
          className={`${styles.celebrationOverlay} ${styles[`celebration${celebration.charAt(0).toUpperCase() + celebration.slice(1)}`]}`}
          onClick={() => setCelebration("none")}
        >
          {celebration === "jackpot" && (
            <>
              <div className={styles.celebrationEmoji}>💰💰💰</div>
              <div className={styles.celebrationTitle}>JACKPOT!</div>
              <div className={styles.celebrationAmount}>
                ${winAmount?.toLocaleString()}
              </div>
              <div className={styles.celebrationSub}>INCREDIBLE WIN!</div>
            </>
          )}
          {celebration === "big" && (
            <>
              <div className={styles.celebrationEmoji}>⚡</div>
              <div className={styles.celebrationTitle}>BIG WIN!</div>
              <div className={styles.celebrationAmount}>
                ${winAmount?.toLocaleString()}
              </div>
            </>
          )}
          {celebration === "win" && (
            <>
              <div className={styles.celebrationTitle}>WIN!</div>
              <div className={styles.celebrationAmount}>
                ${winAmount?.toLocaleString()}
              </div>
            </>
          )}
        </div>
      )}

      <RouletteRules />

      <header className={styles.header}>
        <button onClick={() => navigate("/home")} className={styles.backBtn}>
          ← BACK
        </button>
        <div className={styles.headerTitle}>
          <span>ROULETTE</span>
        </div>
        <div className={styles.headerRight}>
          <div
            className={styles.connectionDot}
            style={{ background: connected ? "#00ffc8" : "#ff4444" }}
            title={connected ? "Connected" : "Disconnected"}
          />
          <div className={styles.headerBalance}>
            <span className={styles.balanceLabel}>BALANCE</span>
            <span className={styles.balanceValue}>
              ${(localBalance ?? 0).toLocaleString()}
            </span>
          </div>
        </div>
      </header>

      {sessionSpins > 0 && (
        <div className={styles.sessionBar}>
          <div className={styles.sessionStat}>
            <span className={styles.sessionLabel}>SPINS</span>
            <span className={styles.sessionValue}>{sessionSpins}</span>
          </div>
          <div className={styles.sessionDivider} />
          <div className={styles.sessionStat}>
            <span className={styles.sessionLabel}>SESSION</span>
            <span
              className={`${styles.sessionValue} ${sessionNet >= 0 ? styles.sessionProfit : styles.sessionLoss}`}
            >
              {sessionNet >= 0 ? "+" : ""}${sessionNet.toLocaleString()}
            </span>
          </div>
          <div className={styles.sessionDivider} />
          <div className={styles.sessionStat}>
            <span className={styles.sessionLabel}>WIN RATE</span>
            <span className={styles.sessionValue}>{sessionWinRate}%</span>
          </div>
          {winStreak >= 2 && (
            <div className={styles.streakBadge}>🔥 WIN ×{winStreak}</div>
          )}
          {lossStreak >= 3 && (
            <div className={`${styles.streakBadge} ${styles.lossStreakBadge}`}>
              😰 {lossStreak} LOSSES
            </div>
          )}
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.wheelSection}>
          <div className={styles.timerSection}>
            <div className={styles.timerPhase} style={{ color: timerColor }}>
              {phaseLabel[phase]}
            </div>
            {phase === "betting" && (
              <div
                className={styles.timerDisplay}
                style={{ color: timerColor }}
              >
                {timeLeft}
              </div>
            )}
            {phase === "closing" && (
              <div className={styles.timerDisplay} style={{ color: "#ffcc00" }}>
                ...
              </div>
            )}
            {phase === "spinning" && (
              <div className={styles.timerDisplay} style={{ color: "#ff0090" }}>
                🎡
              </div>
            )}
            {phase === "result" && (
              <div className={styles.timerDisplay} style={{ color: "#00ffc8" }}>
                !
              </div>
            )}
            {phase === "betting" && (
              <div className={styles.timerProgress}>
                <div
                  className={styles.timerBar}
                  style={{
                    width: `${(timeLeft / 15) * 100}%`,
                    background: timerColor,
                  }}
                />
              </div>
            )}
            {submitted && phase !== "betting" && (
              <div className={styles.submittedBadge}>✓ BET SUBMITTED</div>
            )}
          </div>

          <div className={styles.wheelContainer}>
            <div className={styles.wheelArrow}>▼</div>
            <div
              className={`${styles.wheel} ${spinning ? styles.wheelSpinning : ""}`}
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? "transform 6s cubic-bezier(0, 0.85, 0.15, 1)"
                  : "none",
              }}
            >
              {WHEEL_ORDER.map((num, idx) => {
                const angle = (360 / WHEEL_ORDER.length) * idx;
                const color = getNumberColor(num);
                const isWinning = result === num;
                return (
                  <div
                    key={idx}
                    className={`${styles.wheelSlot} ${styles[`slot${color.charAt(0).toUpperCase() + color.slice(1)}`]} ${isWinning ? styles.slotWinning : ""}`}
                    style={{
                      transform: `rotate(${angle}deg) translateY(-140px)`,
                    }}
                  >
                    <span
                      style={{
                        transform: `rotate(${-angle - rotation}deg)`,
                        display: "inline-block",
                      }}
                    >
                      {num}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className={styles.wheelCenter}>
              <div className={styles.wheelCenterRing} />
            </div>
          </div>

          {result !== null && (
            <div className={styles.resultBox}>
              <div className={styles.resultLabel}>RESULT</div>
              <div
                className={`${styles.resultNumber} ${styles[`result${getNumberColor(result).charAt(0).toUpperCase() + getNumberColor(result).slice(1)}`]}`}
              >
                {result}
              </div>
              {winAmount !== null && winAmount > 0 && (
                <div className={styles.winAmountBox}>
                  WIN: ${winAmount.toLocaleString()}
                </div>
              )}
              {winAmount === 0 && (
                <div className={styles.loseBox}>YOU LOSE</div>
              )}
            </div>
          )}

          {history.length > 0 && result === null && (
            <div className={styles.historyBox}>
              <div className={styles.historyLabel}>
                HISTORY{" "}
                {hotNumbers.size > 0 && (
                  <span className={styles.hotLabel}>🔥 = HOT</span>
                )}
              </div>
              <div className={styles.historyNumbers}>
                {history.map((num, idx) => (
                  <span
                    key={idx}
                    className={`${styles.historyNum} ${styles[`history${getNumberColor(num).charAt(0).toUpperCase() + getNumberColor(num).slice(1)}`]} ${hotNumbers.has(num) ? styles.historyHot : ""}`}
                  >
                    {num}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.bettingSection}>
          <div className={styles.chipSelector}>
            <div className={styles.sectionLabel}>CHIP VALUE</div>
            <div className={styles.chips}>
              {[1000, 5000, 10000, 50000, 100000].map((value) => (
                <button
                  key={value}
                  onClick={() => setChipValue(value)}
                  className={`${styles.chip} ${chipValue === value ? styles.chipActive : ""}`}
                  disabled={!canBet}
                >
                  ${(value / 1000).toFixed(0)}K
                </button>
              ))}
            </div>
          </div>

          <div className={styles.bettingTable}>
            <div className={styles.sectionLabel}>
              BETTING TABLE{" "}
              {hotNumbers.size > 0 && (
                <span className={styles.hotLabel}>🔥 HOT</span>
              )}
              {!canBet && submitted && (
                <span className={styles.submittedLabel}> · SUBMITTED</span>
              )}
              {!canBet && !submitted && phase !== "betting" && (
                <span className={styles.closedLabel}>
                  {" "}
                  · {phaseLabel[phase]}
                </span>
              )}
            </div>
            <div className={styles.tableLayout}>
              <div
                className={`${styles.numberCell} ${styles.cellGreen} ${styles.zeroNum} ${!canBet ? styles.cellDisabled : ""}`}
                style={{ gridRow: "1 / 4", gridColumn: "1" }}
                onClick={() => addBet("straight", [0], "0")}
              >
                <span>0</span>
              </div>

              {([3, 2, 1] as number[]).flatMap((row, rowIdx) =>
                Array.from({ length: 12 }, (_, col) => {
                  const num = col * 3 + row;
                  const color = getNumberColor(num);
                  const isHot = hotNumbers.has(num);
                  return (
                    <div
                      key={num}
                      className={`${styles.numberCell} ${styles[`cell${color.charAt(0).toUpperCase() + color.slice(1)}`]} ${isHot ? styles.cellHot : ""} ${!canBet ? styles.cellDisabled : ""}`}
                      style={{ gridRow: rowIdx + 1, gridColumn: col + 2 }}
                      onClick={() => addBet("straight", [num], `${num}`)}
                    >
                      <span>{num}</span>
                      {isHot && <span className={styles.hotIndicator}>🔥</span>}
                    </div>
                  );
                })
              )}

              {([3, 2, 1] as number[]).map((row, rowIdx) => {
                const colNums = Array.from({ length: 12 }, (_, i) => i * 3 + row);
                return (
                  <button
                    key={row}
                    className={styles.columnBtn}
                    style={{ gridRow: rowIdx + 1, gridColumn: "14" }}
                    onClick={() => addBet("column", colNums, `COL ${row}`)}
                    disabled={!canBet}
                  >
                    2:1
                  </button>
                );
              })}

              {(
                [
                  ["1ST 12", 1,  "2 / 6" ],
                  ["2ND 12", 13, "6 / 10"],
                  ["3RD 12", 25, "10 / 14"],
                ] as [string, number, string][]
              ).map(([label, start, col]) => (
                <button
                  key={label}
                  className={styles.dozenBtn}
                  style={{ gridRow: "4", gridColumn: col }}
                  onClick={() =>
                    addBet(
                      "dozen",
                      Array.from({ length: 12 }, (_, i) => i + start),
                      label,
                    )
                  }
                  disabled={!canBet}
                >
                  {label}
                </button>
              ))}

              {(
                [
                  { label: "1-18",  type: "lowhigh"  as BetType, nums: Array.from({ length: 18 }, (_, i) => i + 1),                                       col: "2 / 4",   cls: "" },
                  { label: "EVEN",  type: "evenodd"  as BetType, nums: Array.from({ length: 18 }, (_, i) => (i + 1) * 2).filter((n) => n <= 36),           col: "4 / 6",   cls: "" },
                  { label: "RED",   type: "redblack" as BetType, nums: [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36],                                 col: "6 / 8",   cls: styles.outsideBtnRed },
                  { label: "BLACK", type: "redblack" as BetType, nums: [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35],                                col: "8 / 10",  cls: styles.outsideBtnBlack },
                  { label: "ODD",   type: "evenodd"  as BetType, nums: Array.from({ length: 18 }, (_, i) => i * 2 + 1),                                    col: "10 / 12", cls: "" },
                  { label: "19-36", type: "lowhigh"  as BetType, nums: Array.from({ length: 18 }, (_, i) => i + 19),                                       col: "12 / 14", cls: "" },
                ]
              ).map((bet) => (
                <button
                  key={bet.label}
                  className={`${styles.outsideBtn} ${bet.cls}`}
                  style={{ gridRow: "5", gridColumn: bet.col }}
                  onClick={() => addBet(bet.type, bet.nums, bet.label)}
                  disabled={!canBet}
                >
                  {bet.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.currentBets}>
            <div className={styles.sectionLabel}>
              CURRENT BETS ({bets.length})
            </div>
            {bets.length === 0 ? (
              <div className={styles.noBets}>
                {submitted
                  ? "Bets submitted — wait for result"
                  : "No bets placed"}
              </div>
            ) : (
              <div className={styles.betsList}>
                {bets.map((bet) => (
                  <div key={bet.id} className={styles.betItem}>
                    <div className={styles.betInfo}>
                      <span className={styles.betName}>{bet.name}</span>
                      <span className={styles.betAmount}>
                        ${bet.amount.toLocaleString()} ·{" "}
                        {getPayoutMultiplier(bet.type)}:1
                      </span>
                    </div>
                    <button
                      onClick={() => removeBet(bet.id)}
                      className={styles.removeBetBtn}
                      disabled={!canBet}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {bets.length > 0 && (
              <div className={styles.totalBet}>
                TOTAL BET: ${totalBetAmount.toLocaleString()}
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <button
              onClick={clearBets}
              className={styles.clearBtn}
              disabled={!canBet || bets.length === 0}
            >
              CLEAR
            </button>
            <button
              onClick={rebet}
              className={styles.rebetBtn}
              disabled={!canBet || lastBets.length === 0}
            >
              REBET
            </button>
          </div>
        </div>

        <div className={styles.chatSection}>
          <div className={styles.chatTabs}>
            <button
              className={`${styles.chatTab} ${activeTab === "chat" ? styles.chatTabActive : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              <span className={styles.chatTabIcon}>◈</span>
              <span className={styles.chatTabLabel}>LIVE CHAT</span>
            </button>
            <button
              className={`${styles.chatTab} ${activeTab === "players" ? styles.chatTabActive : ""}`}
              onClick={() => setActiveTab("players")}
            >
              <span className={styles.chatTabIcon}>◉</span>
              <span className={styles.chatTabLabel}>PLAYERS</span>
              <span className={`${styles.chatTabBadge} ${activeTab === "players" ? styles.chatTabBadgeActive : ""}`}>
                {roomUsers.count}
              </span>
            </button>
          </div>

          {activeTab === "chat" && (
            <>
              <div className={styles.chatMessages}>
                {chatMessages.map((msg, i) => (
                  <div key={i} className={styles.chatMessage}>
                    <span className={styles.chatUsername}>{msg.username}</span>
                    <span className={styles.chatText}>{msg.message}</span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className={styles.chatInputArea}>
                <input
                  className={styles.chatInput}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
                  placeholder="메시지 입력..."
                  maxLength={200}
                  disabled={!connected}
                />
                <button
                  className={styles.chatSendBtn}
                  onClick={sendChat}
                  disabled={!connected || !chatInput.trim()}
                >
                  ↑
                </button>
              </div>
            </>
          )}

          {activeTab === "players" && (
            <div className={styles.playerList}>
              {roomUsers.usernames.length === 0 ? (
                <div className={styles.playerEmpty}>접속 중인 플레이어 없음</div>
              ) : (
                roomUsers.usernames.map((name, i) => {
                  const isSelf = name === user.username;
                  return (
                    <div key={i} className={`${styles.playerItem} ${isSelf ? styles.playerItemSelf : ""}`}>
                      <div className={`${styles.playerAvatar} ${isSelf ? styles.playerAvatarSelf : ""}`}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <span className={styles.playerName}>{name}</span>
                      {isSelf && <span className={styles.playerSelfTag}>YOU</span>}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
