import { useState, useEffect, useRef } from "react";
import type { FC } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Makemoney.module.css";

// ===== Types =====
interface Fish {
  id: string;
  name: string;
  icon: string;
  rarity: "common" | "rare" | "legend";
  value: number;
  catchChance: number;
  minBaitTier: number;
}

interface Bait {
  id: string;
  name: string;
  cost: number;
  refillCost: number;
  tier: number;
  fishQuality: Record<string, number>;
}

interface CaughtFish {
  name: string;
  value: number;
  icon: string;
  quality: number;
}

interface YankSpot {
  position: number;
  width: number;
}

type GamePhase =
  | "idle"
  | "baitSelect"
  | "casting"
  | "waiting"
  | "bite"
  | "catching"
  | "yankSpot"
  | "success"
  | "failed";

// ===== Data =====
const BAIT_DATA: Bait[] = [
  {
    id: "worm",
    name: "WORM",
    cost: 0,
    refillCost: 0,
    tier: 0,
    fishQuality: { bass: 100, carp: 90, tuna: 30, swordfish: 5, legendary: 0 },
  },
  {
    id: "cricket",
    name: "CRICKET",
    cost: 100,
    refillCost: 20,
    tier: 1,
    fishQuality: { bass: 95, carp: 95, tuna: 60, swordfish: 20, legendary: 2 },
  },
  {
    id: "leech",
    name: "LEECH",
    cost: 400,
    refillCost: 50,
    tier: 2,
    fishQuality: { bass: 80, carp: 90, tuna: 85, swordfish: 50, legendary: 10 },
  },
  {
    id: "minnow",
    name: "MINNOW",
    cost: 1250,
    refillCost: 100,
    tier: 3,
    fishQuality: { bass: 35, carp: 50, tuna: 80, swordfish: 85, legendary: 40 },
  },
];

const FISH_DATA: Fish[] = [
  {
    id: "bass",
    name: "BASS",
    icon: "🐟",
    rarity: "common",
    value: 100,
    catchChance: 60,
    minBaitTier: 0,
  },
  {
    id: "carp",
    name: "CARP",
    icon: "🐠",
    rarity: "common",
    value: 150,
    catchChance: 50,
    minBaitTier: 0,
  },
  {
    id: "tuna",
    name: "TUNA",
    icon: "🐟",
    rarity: "rare",
    value: 500,
    catchChance: 25,
    minBaitTier: 1,
  },
  {
    id: "swordfish",
    name: "SWORDFISH",
    icon: "⚔️",
    rarity: "rare",
    value: 800,
    catchChance: 15,
    minBaitTier: 2,
  },
  {
    id: "legendary",
    name: "GOLDEN FISH",
    icon: "✨",
    rarity: "legend",
    value: 5000,
    catchChance: 5,
    minBaitTier: 3,
  },
];

// ===== Components =====
interface FishingRodProps {
  angle: number;
  lineLength: number;
  phase: GamePhase;
  currentFish: Fish | null;
}

const FishingRod: FC<FishingRodProps> = ({
  angle,
  lineLength,
  phase,
  currentFish,
}) => {
  const [wobble, setWobble] = useState<number>(0);
  const [reelRotation, setReelRotation] = useState<number>(0);

  useEffect(() => {
    const wobbleInterval = setInterval(() => {
      setWobble(Math.sin(Date.now() / 300) * 3);
    }, 50);

    const reelInterval = setInterval(() => {
      setReelRotation((prev) => (prev + 5) % 360);
    }, 30);

    return () => {
      clearInterval(wobbleInterval);
      clearInterval(reelInterval);
    };
  }, []);

  return (
    <div className={styles.fishingContainer}>
      {/* 낚싯대 */}
      <div
        className={styles.rodContainer}
        style={{
          transform: `rotate(${angle}deg)`,
          transformOrigin: "120px 60px",
        }}
      >
        {/* 낚싯대 본체 */}
        <div className={styles.rodBody}>
          <div className={styles.rodGradient}></div>
        </div>

        {/* 릴 */}
        <div
          className={styles.reel}
          style={{
            transform: `rotate(${reelRotation}deg)`,
          }}
        >
          <div className={styles.reelCenter}></div>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={styles.reelSpoke}
              style={{
                transform: `rotate(${i * 90}deg)`,
              }}
            ></div>
          ))}
        </div>

        {/* 핸드 그립 */}
        <div className={styles.grip}></div>
      </div>

      {/* 낚싯줄 */}
      {lineLength > 0 && (
        <div className={styles.lineContainer}>
          <div
            className={styles.line}
            style={{
              height: `${lineLength}px`,
              transform: `translateX(${wobble}px)`,
            }}
          >
            {/* 미끼 */}
            <div className={styles.bait}></div>
          </div>
        </div>
      )}

      {/* 물고기 */}
      {phase === "bite" && currentFish && (
        <div
          className={styles.fishBite}
          style={{
            top: `${200 + lineLength + 30}px`,
            transform: `translateX(${wobble * 2}px) scaleX(${wobble > 0 ? 1 : -1})`,
          }}
        >
          {currentFish.icon}
        </div>
      )}
    </div>
  );
};

// ===== Main Component =====
const MakeMoney: FC = () => {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<GamePhase>("baitSelect");
  const [balance, setBalance] = useState<number>(0);
  const [caughtFishes, setCaughtFishes] = useState<CaughtFish[]>([]);
  const [message, setMessage] = useState<string>("미끼를 선택하세요!");
  const [rodAngle, setRodAngle] = useState<number>(45);
  const [lineLength, setLineLength] = useState<number>(0);
  const [currentFish, setCurrentFish] = useState<Fish | null>(null);
  const [currentBait, setCurrentBait] = useState<Bait | null>(null);
  const [catchBar, setCatchBar] = useState<number>(0);
  const [yankSpots, setYankSpots] = useState<YankSpot[]>([]);
  const [currentYankIndex, setCurrentYankIndex] = useState<number>(0);
  const [biteAlert, setBiteAlert] = useState<boolean>(false);

  const biteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catchProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 미끼 선택
  const handleBaitSelect = (bait: Bait): void => {
    setCurrentBait(bait);
    setPhase("casting");
    setMessage("낚싯대를 던지는 중...");

    let angle = 45;
    const castInterval = setInterval(() => {
      angle -= 3;
      setRodAngle(angle);

      if (angle <= -30) {
        clearInterval(castInterval);

        let length = 0;
        const lineInterval = setInterval(() => {
          length += 15;
          setLineLength(length);

          if (length >= 150) {
            clearInterval(lineInterval);
            setPhase("waiting");
            setMessage("물고기를 기다리는 중...");
            startWaiting(bait);
          }
        }, 30);
      }
    }, 30);
  };

  // 물고기 대기
  const startWaiting = (bait: Bait): void => {
    const waitTime = Math.random() * 3000 + 1000;

    biteTimeoutRef.current = setTimeout(() => {
      const availableFish = FISH_DATA.filter((f) => f.minBaitTier <= bait.tier);
      const randomFish =
        availableFish[Math.floor(Math.random() * availableFish.length)];

      if (Math.random() * 100 < randomFish.catchChance) {
        setCurrentFish(randomFish);
        setPhase("bite");
        setBiteAlert(true);
        setMessage(`${randomFish.name}이 물었다! 스페이스바를 눌러 낚시!`);

        let blink = 0;
        const blinkInterval = setInterval(() => {
          setBiteAlert(blink % 2 === 0);
          blink++;
          if (blink > 6) {
            clearInterval(blinkInterval);
          }
        }, 100);

        setTimeout(() => {
          if (phase === "bite") {
            handleMissed();
          }
        }, 3000);
      } else {
        startWaiting(bait);
      }
    }, waitTime);
  };

  // 당기기 스팟 생성
  const generateYankSpots = (): YankSpot[] => {
    const spots: YankSpot[] = [];
    const spotCount = 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < spotCount; i++) {
      spots.push({
        position: Math.random() * 70 + 15,
        width: 15 + Math.random() * 10,
      });
    }

    return spots.sort((a, b) => a.position - b.position);
  };

  // 물고기 물았을 때
  const handleBite = (): void => {
    if (phase !== "bite" || !currentFish || !currentBait) return;

    setPhase("catching");
    setBiteAlert(false);
    setMessage(`${currentFish.name}을 낚아올리는 중... (마우스로 계속 클릭!)`);
    setCatchBar(0);

    const spots = generateYankSpots();
    setYankSpots(spots);
    setCurrentYankIndex(0);

    let progress = 0;
    let timeElapsed = 0;
    const maxTime = 30000; // 30초 제한

    const catchInterval = setInterval(() => {
      progress += Math.random() * 10;
      timeElapsed += 150;
      setCatchBar(progress);

      // 시간 초과
      if (timeElapsed > maxTime) {
        clearInterval(catchInterval);
        setMessage("제시간에 낚지 못했다...");
        handleMissed();
        return;
      }

      if (currentYankIndex < spots.length) {
        const spot = spots[currentYankIndex];
        if (
          progress >= spot.position &&
          progress < spot.position + spot.width
        ) {
          setPhase("yankSpot");
          setMessage(`연타! 스페이스바를 계속 눌러!`);
          clearInterval(catchInterval);
          handleYankSpot(spots, currentYankIndex);
          return;
        } else if (progress > spot.position + spot.width) {
          setCurrentYankIndex(currentYankIndex + 1);
        }
      }

      if (progress >= 100) {
        clearInterval(catchInterval);
        handleSuccess();
      }
    }, 150);

    catchProgressRef.current = catchInterval;
  };

  // Yank Spot 처리
  const handleYankSpot = (spots: YankSpot[], index: number): void => {
    let yankClicks = 0;
    const requiredClicks = 5;
    let yankTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleYankClick = (): void => {
      yankClicks++;

      if (yankClicks >= requiredClicks) {
        window.removeEventListener("keydown", handleYankKeyPress);
        if (yankTimeout) clearTimeout(yankTimeout);

        setCurrentYankIndex(index + 1);
        setPhase("catching");
        setCatchBar(spots[index].position + spots[index].width + 5);

        let progress = spots[index].position + spots[index].width + 5;
        const catchInterval = setInterval(() => {
          progress += Math.random() * 10;
          setCatchBar(progress);

          if (index + 1 < spots.length) {
            const nextSpot = spots[index + 1];
            if (
              progress >= nextSpot.position &&
              progress < nextSpot.position + nextSpot.width
            ) {
              clearInterval(catchInterval);
              setPhase("yankSpot");
              setMessage(`연타! 스페이스바를 계속 눌러!`);
              handleYankSpot(spots, index + 1);
              return;
            }
          }

          if (progress >= 100) {
            clearInterval(catchInterval);
            handleSuccess();
          }
        }, 150);

        catchProgressRef.current = catchInterval;
      }
    };

    const handleYankKeyPress = (e: KeyboardEvent): void => {
      if (e.code === "Space") {
        e.preventDefault();
        handleYankClick();
      }
    };

    // Yank Spot 제시간 제한 (3초)
    yankTimeout = setTimeout(() => {
      window.removeEventListener("keydown", handleYankKeyPress);
      setMessage("제시간에 반응하지 못했다...");
      handleMissed();
    }, 3000);

    window.addEventListener("keydown", handleYankKeyPress);
  };

  // 마우스 클릭
  const handleMouseClick = (): void => {
    if (phase === "idle") {
      setPhase("baitSelect");
      setMessage("미끼를 선택하세요!");
    } else if (phase === "catching") {
      setCatchBar((prev) => Math.min(prev + 5, 100));
    }
  };

  // 키보드 이벤트
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent): void => {
      if (e.code === "Space") {
        e.preventDefault();
        if (phase === "idle") {
          setPhase("baitSelect");
        } else if (phase === "bite") {
          handleBite();
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [phase, currentFish, currentBait]);

  // 낚시 성공
  const handleSuccess = (): void => {
    if (!currentFish || !currentBait) return;

    const qualityRandom = Math.random() * 100;
    let quality = 0;

    if (qualityRandom < 5) quality = 5;
    else if (qualityRandom < 15) quality = 4;
    else if (qualityRandom < 35) quality = 3;
    else if (qualityRandom < 65) quality = 2;
    else if (qualityRandom < 90) quality = 1;

    const bonus = currentFish.value * (1 + quality * 0.2);
    const totalValue = Math.floor(bonus);

    setPhase("success");
    setMessage(`${currentFish.name}을(를) 낚았다! +$${totalValue}`);
    setBalance((prev) => prev + totalValue);

    const caughtFish: CaughtFish = {
      name: currentFish.name,
      value: totalValue,
      icon: currentFish.icon,
      quality,
    };

    setCaughtFishes((prev) => [caughtFish, ...prev].slice(0, 10));

    setTimeout(() => {
      resetGame();
    }, 1500);
  };

  // 낚시 실패
  const handleMissed = (): void => {
    setPhase("failed");
    setMessage("물고기를 놓쳤다...");

    setTimeout(() => {
      resetGame();
    }, 1500);
  };

  // 게임 리셋
  const resetGame = (): void => {
    setPhase("idle");
    setRodAngle(45);
    setLineLength(0);
    setCurrentFish(null);
    setCatchBar(0);
    setYankSpots([]);
    setCurrentYankIndex(0);
    setBiteAlert(false);
    setMessage("낚시를 계속하시겠습니까?");

    if (biteTimeoutRef.current) clearTimeout(biteTimeoutRef.current);
    if (catchProgressRef.current) clearInterval(catchProgressRef.current);
  };

  // 게임 종료
  const handleQuit = (): void => {
    if (biteTimeoutRef.current) clearTimeout(biteTimeoutRef.current);
    if (catchProgressRef.current) clearInterval(catchProgressRef.current);
    navigate("/");
  };

  return (
    <div className={styles.root} onClick={handleMouseClick}>
      <div className={styles.scanlines} />
      <div className={styles.dotGrid} />

      {/* HUD */}
      <header className={styles.hud}>
        <div className={styles.hudLogo}>
          <div className={styles.hudDot} />
          <span>FISHING GAME</span>
        </div>
        <div className={styles.hudInfo}>
          <div className={styles.hudStat}>
            <span className={styles.hudLabel}>BALANCE</span>
            <span className={styles.hudValue}>
              $ {balance.toLocaleString()}
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className={styles.main}>
        {/* 미끼 선택 화면 */}
        {phase === "baitSelect" && (
          <div className={styles.baitSelection}>
            <h2 className={styles.baitTitle}>미끼를 선택하세요</h2>
            <div className={styles.baitGrid}>
              {BAIT_DATA.map((bait) => (
                <button
                  key={bait.id}
                  className={styles.baitCard}
                  onClick={() => handleBaitSelect(bait)}
                >
                  <div className={styles.baitName}>{bait.name}</div>
                  <div className={styles.baitCost}>${bait.cost}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 게임 영역 */}
        {phase !== "baitSelect" && (
          <>
            <div className={styles.gameContainer}>
              <div className={styles.canvasWrapper}>
                <FishingRod
                  angle={rodAngle}
                  lineLength={lineLength}
                  phase={phase}
                  currentFish={currentFish}
                />
              </div>

              {/* 상태 메시지 */}
              <div
                className={`${styles.statusBox} ${biteAlert ? styles.biteAlert : ""}`}
                style={{
                  boxShadow: biteAlert
                    ? "0 0 20px rgba(0, 255, 200, 0.8)"
                    : "none",
                }}
              >
                <span className={styles.statusMessage}>{message}</span>
              </div>

              {/* 캐치 진행도 바 */}
              {(phase === "catching" || phase === "yankSpot") && (
                <div className={styles.progressContainer}>
                  <span className={styles.progressLabel}>
                    {phase === "yankSpot"
                      ? "연타! 스페이스바!"
                      : "클릭해서 낚아올리기!"}
                  </span>
                  <div className={styles.progressBarContainer}>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${catchBar}%` }}
                      />
                    </div>
                    {yankSpots.map((spot, idx) => (
                      <div
                        key={idx}
                        className={styles.yankSpot}
                        style={{
                          left: `${spot.position}%`,
                          width: `${spot.width}%`,
                          backgroundColor:
                            idx === currentYankIndex
                              ? "rgba(255, 0, 100, 0.8)"
                              : "rgba(100, 150, 255, 0.5)",
                        }}
                      />
                    ))}
                  </div>
                  <span className={styles.progressPercent}>
                    {Math.floor(catchBar)}%
                  </span>
                </div>
              )}

              {/* 버튼 */}
              <div className={styles.buttonGroup}>
                <button
                  className={`${styles.castBtn} ${phase === "idle" ? styles.active : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (phase === "idle") {
                      setPhase("baitSelect");
                    }
                  }}
                >
                  🎣 NEW FISHING (SPACE)
                </button>
                <button
                  className={styles.quitBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuit();
                  }}
                >
                  ← QUIT
                </button>
              </div>
            </div>

            {/* 낚아올린 물고기 */}
            <div className={styles.section}>
              <div className={styles.sectionLabel}>
                <span>CAUGHT FISH</span>
                <div className={styles.sectionLine} />
              </div>
              <div className={styles.fishLog}>
                {caughtFishes.length === 0 ? (
                  <div className={styles.emptyLog}>물고기를 낚아보세요!</div>
                ) : (
                  caughtFishes.map((fish, idx) => (
                    <div key={idx} className={styles.fishItem}>
                      <span className={styles.fishItemIcon}>{fish.icon}</span>
                      <span className={styles.fishItemName}>{fish.name}</span>
                      <span className={styles.fishItemQuality}>
                        {"★".repeat(fish.quality || 1)}
                      </span>
                      <span className={styles.fishItemValue}>
                        +${fish.value.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <span>FISHING PROTOCOL v3.0 · ADVANCED FISHING</span>
        <div className={styles.pulseBars}>
          {[4, 9, 14, 7, 11].map((h, i) => (
            <span
              key={i}
              className={styles.pulseBar}
              style={{ height: `${h}px`, animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
        <span>TOTAL EARNED: $ {balance.toLocaleString()}</span>
      </footer>
    </div>
  );
};

export default MakeMoney;
