import { useState } from "react";
import styles from "./Rouletterules.module.css";

const STORAGE_KEY = "blackjack-rules-shown";

export default function BlackjackRules() {
  const [isOpen, setIsOpen] = useState(() => {
    if (localStorage.getItem(STORAGE_KEY) !== "true") {
      localStorage.setItem(STORAGE_KEY, "true");
      return true;
    }
    return false;
  });

  const closeOnce = () => setIsOpen(false);

  return (
    <>
      {/* 도움말 버튼 */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: "fixed",
          bottom: "40px",
          left: "24px",
          zIndex: 100,
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: "11px",
          letterSpacing: "0.2em",
          color: "rgba(0,255,200,0.7)",
          background: "rgba(0,10,20,0.85)",
          border: "1px solid rgba(0,255,200,0.3)",
          cursor: "pointer",
          padding: "8px 16px",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#00ffc8";
          e.currentTarget.style.borderColor = "rgba(0,255,200,0.7)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "rgba(0,255,200,0.7)";
          e.currentTarget.style.borderColor = "rgba(0,255,200,0.3)";
        }}
      >
        ? 도움말
      </button>

      {isOpen && (
        <div className={styles.overlay} onClick={closeOnce}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button onClick={closeOnce} className={styles.closeBtn}>
              ✕
            </button>

            <div className={styles.content}>
              <h1 className={styles.title}>🃏 블랙잭 게임 규칙</h1>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>📖 기본 규칙</h2>
                <p className={styles.text}>
                  딜러보다 21에 가깝게 패를 구성하면 이기는 게임입니다.
                  <br />
                  21을 초과하면 즉시 패배(Bust)하며, 딜러도 동일한 규칙을
                  따릅니다.
                </p>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>🎴 카드 값</h2>

                <div className={styles.betType}>
                  <div className={styles.betHeader}>
                    <span className={styles.betName}>숫자 카드 (2 ~ 10)</span>
                    <span className={styles.betPayout}>액면가</span>
                  </div>
                  <p className={styles.betDesc}>
                    카드에 표시된 숫자 그대로 계산됩니다.
                  </p>
                </div>

                <div className={styles.betType}>
                  <div className={styles.betHeader}>
                    <span className={styles.betName}>J / Q / K</span>
                    <span className={styles.betPayout}>10</span>
                  </div>
                  <p className={styles.betDesc}>
                    페이스 카드는 모두 10으로 계산됩니다.
                  </p>
                </div>

                <div className={styles.betType}>
                  <div className={styles.betHeader}>
                    <span className={styles.betName}>에이스 (A)</span>
                    <span className={styles.betPayout}>1 또는 11</span>
                  </div>
                  <p className={styles.betDesc}>
                    패에 유리한 쪽으로 자동 계산됩니다.
                    <br />
                    <strong>예시:</strong> A + 7 = 18 (11+7), A + 7 + 5 = 13
                    (1+7+5)
                  </p>
                </div>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>⚡ 행동 선택</h2>

                <div className={styles.betType}>
                  <div className={styles.betHeader}>
                    <span className={styles.betName}>HIT</span>
                    <span className={styles.betPayout}>카드 추가</span>
                  </div>
                  <p className={styles.betDesc}>
                    카드를 한 장 더 받습니다. 21을 초과하면 즉시 Bust.
                  </p>
                </div>

                <div className={styles.betType}>
                  <div className={styles.betHeader}>
                    <span className={styles.betName}>STAND</span>
                    <span className={styles.betPayout}>현재 유지</span>
                  </div>
                  <p className={styles.betDesc}>
                    현재 패를 유지하고 딜러 차례로 넘깁니다.
                  </p>
                </div>

                <div className={styles.betType}>
                  <div className={styles.betHeader}>
                    <span className={styles.betName}>DOUBLE DOWN</span>
                    <span className={styles.betPayout}>베팅 2배</span>
                  </div>
                  <p className={styles.betDesc}>
                    베팅 금액을 2배로 올리고 카드를 정확히 한 장만 더 받습니다.
                    <br />
                    <strong>조건:</strong> 처음 두 장을 받았을 때만 가능합니다.
                  </p>
                </div>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>🏆 결과 판정</h2>

                <div className={styles.betType}>
                  <div className={styles.betHeader}>
                    <span className={styles.betName}>BLACKJACK</span>
                    <span className={styles.betPayout}>1.5배</span>
                  </div>
                  <p className={styles.betDesc}>
                    처음 두 장이 에이스 + 10점 카드(10·J·Q·K).
                    <br />
                    <strong>예시:</strong> 1만원 배팅 → 1만5천원 획득
                  </p>
                </div>

                <div className={styles.betType}>
                  <div className={styles.betHeader}>
                    <span className={styles.betName}>WIN</span>
                    <span className={styles.betPayout}>1배</span>
                  </div>
                  <p className={styles.betDesc}>
                    딜러보다 높은 점수로 21 이하. 베팅금액만큼 획득.
                  </p>
                </div>

                <div className={styles.betType}>
                  <div className={styles.betHeader}>
                    <span className={styles.betName}>PUSH (무승부)</span>
                    <span className={styles.betPayout}>반환</span>
                  </div>
                  <p className={styles.betDesc}>
                    딜러와 동점. 베팅 금액 그대로 반환됩니다.
                  </p>
                </div>

                <div className={styles.betType}>
                  <div className={styles.betHeader}>
                    <span className={styles.betName}>BUST / LOSE</span>
                    <span className={styles.betPayout}>몰수</span>
                  </div>
                  <p className={styles.betDesc}>
                    21 초과 또는 딜러보다 낮은 점수. 베팅 금액 전액 손실.
                  </p>
                </div>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>🤖 딜러 규칙</h2>
                <ul className={styles.tipsList}>
                  <li>딜러는 처음에 카드 한 장을 뒤집어서 숨겨둡니다</li>
                  <li>플레이어 행동이 끝나면 숨긴 카드를 공개합니다</li>
                  <li>딜러는 합계가 17 미만이면 반드시 HIT합니다</li>
                  <li>딜러는 합계가 17 이상이면 반드시 STAND합니다</li>
                </ul>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>🎮 게임 진행</h2>
                <ol className={styles.stepsList}>
                  <li>
                    <strong>1단계:</strong> 칩을 클릭해 베팅 금액을 설정합니다
                  </li>
                  <li>
                    <strong>2단계:</strong> DEAL 버튼을 눌러 게임을 시작합니다
                  </li>
                  <li>
                    <strong>3단계:</strong> 플레이어와 딜러 각각 2장씩 카드를
                    받습니다
                  </li>
                  <li>
                    <strong>4단계:</strong> HIT / STAND / DOUBLE 중 선택합니다
                  </li>
                  <li>
                    <strong>5단계:</strong> 딜러가 자동으로 패를 완성합니다
                  </li>
                  <li>
                    <strong>6단계:</strong> 결과에 따라 자동으로 정산됩니다
                  </li>
                </ol>
              </section>

              <section className={styles.warningSection}>
                <h2 className={styles.warningTitle}>⚠️ 주의사항</h2>
                <ul className={styles.warningList}>
                  <li>베팅 금액은 DEAL 시작 시 즉시 차감됩니다</li>
                  <li>Double Down 시 추가 베팅 금액도 잔액에서 차감됩니다</li>
                  <li>
                    딜러가 블랙잭이면 플레이어 블랙잭과 무승부(PUSH) 처리됩니다
                  </li>
                </ul>
              </section>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "12px",
                  marginTop: "32px",
                }}
              >
                <button onClick={closeOnce} className={styles.startBtn}>
                  게임 시작! 🃏
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
