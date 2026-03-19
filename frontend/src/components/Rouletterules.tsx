import { useState } from "react";
import styles from "./RouletteRules.module.css";

export default function RouletteRules() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      {isOpen && (
        <div className={styles.overlay} onClick={() => setIsOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsOpen(false)}
              className={styles.closeBtn}
            >
              ✕
            </button>

            <div className={styles.content}>
              <h1 className={styles.title}>🎡 룰렛 게임 규칙</h1>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>📖 기본 규칙</h2>
                <p className={styles.text}>
                  룰렛은 0부터 36까지 총 37개의 숫자 중 하나가 당첨되는
                  게임입니다.
                  <br />
                  원하는 숫자나 영역에 베팅하고, 룰렛을 돌려 당첨되면 배당금을
                  받습니다.
                </p>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>🎯 베팅 방법</h2>

                <div className={styles.betType}>
                  <div className={styles.betHeader}>
                    <span className={styles.betName}>단일 숫자 (Straight)</span>
                    <span className={styles.betPayout}>35배</span>
                  </div>
                  <p className={styles.betDesc}>
                    하나의 숫자에 베팅합니다. 가장 높은 배당!
                    <br />
                    <strong>예시:</strong> 7번에 1,000원 → 당첨 시 36,000원 획득
                  </p>
                </div>

                <div className={styles.betType}>
                  <div className={styles.betHeader}>
                    <span className={styles.betName}>1ST / 2ND / 3RD 12</span>
                    <span className={styles.betPayout}>2배</span>
                  </div>
                  <p className={styles.betDesc}>
                    12개 숫자 그룹에 베팅합니다.
                    <br />
                    <strong>1ST 12:</strong> 1~12번
                    <br />
                    <strong>2ND 12:</strong> 13~24번
                    <br />
                    <strong>3RD 12:</strong> 25~36번
                    <br />
                    <strong>예시:</strong> 1ST 12에 10,000원 → 5번 나오면
                    30,000원 획득
                  </p>
                </div>

                <div className={styles.betType}>
                  <div className={styles.betHeader}>
                    <span className={styles.betName}>
                      빨강 / 검정 (RED / BLACK)
                    </span>
                    <span className={styles.betPayout}>1배</span>
                  </div>
                  <p className={styles.betDesc}>
                    빨간 숫자 또는 검은 숫자에 베팅합니다.
                    <br />
                    <strong>빨강:</strong> 1, 3, 5, 7, 9, 12, 14, 16, 18, 19,
                    21, 23, 25, 27, 30, 32, 34, 36
                    <br />
                    <strong>검정:</strong> 2, 4, 6, 8, 10, 11, 13, 15, 17, 20,
                    22, 24, 26, 28, 29, 31, 33, 35
                    <br />
                    <strong>예시:</strong> RED에 5,000원 → 빨강 나오면 10,000원
                    획득
                  </p>
                </div>

                <div className={styles.betType}>
                  <div className={styles.betHeader}>
                    <span className={styles.betName}>
                      홀수 / 짝수 (ODD / EVEN)
                    </span>
                    <span className={styles.betPayout}>1배</span>
                  </div>
                  <p className={styles.betDesc}>
                    홀수 또는 짝수에 베팅합니다. (0 제외)
                    <br />
                    <strong>예시:</strong> EVEN에 3,000원 → 짝수 나오면 6,000원
                    획득
                  </p>
                </div>

                <div className={styles.betType}>
                  <div className={styles.betHeader}>
                    <span className={styles.betName}>
                      1-18 / 19-36 (LOW / HIGH)
                    </span>
                    <span className={styles.betPayout}>1배</span>
                  </div>
                  <p className={styles.betDesc}>
                    작은 숫자(1-18) 또는 큰 숫자(19-36)에 베팅합니다.
                    <br />
                    <strong>예시:</strong> 1-18에 2,000원 → 10번 나오면 4,000원
                    획득
                  </p>
                </div>

                <div className={styles.betType}>
                  <div className={styles.betHeader}>
                    <span className={styles.betName}>
                      세로줄 (Column) - 2 to 1
                    </span>
                    <span className={styles.betPayout}>2배</span>
                  </div>
                  <p className={styles.betDesc}>
                    세로줄 12개 숫자에 베팅합니다.
                    <br />
                    <strong>COL 1:</strong> 1, 4, 7, 10, 13, 16, 19, 22, 25, 28,
                    31, 34
                    <br />
                    <strong>COL 2:</strong> 2, 5, 8, 11, 14, 17, 20, 23, 26, 29,
                    32, 35
                    <br />
                    <strong>COL 3:</strong> 3, 6, 9, 12, 15, 18, 21, 24, 27, 30,
                    33, 36
                  </p>
                </div>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>💡 플레이 팁</h2>
                <ul className={styles.tipsList}>
                  <li>✅ 여러 곳에 동시 베팅 가능 (분산 투자)</li>
                  <li>✅ 배당이 높을수록 당첨 확률이 낮습니다</li>
                  <li>✅ 0번(초록)이 나오면 RED/BLACK, ODD/EVEN 모두 낙첨</li>
                  <li>✅ 칩 금액을 먼저 선택한 후 베팅하세요</li>
                  <li>⚠️ 책임감 있게 플레이하세요</li>
                </ul>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>🎮 게임 진행</h2>
                <ol className={styles.stepsList}>
                  <li>
                    <strong>1단계:</strong> 칩 금액 선택 (₩1K ~ ₩100K)
                  </li>
                  <li>
                    <strong>2단계:</strong> 원하는 숫자나 영역 클릭하여 베팅
                  </li>
                  <li>
                    <strong>3단계:</strong> 여러 곳에 베팅 가능 (최대 50개)
                  </li>
                  <li>
                    <strong>4단계:</strong> SPIN 버튼 클릭
                  </li>
                  <li>
                    <strong>5단계:</strong> 룰렛이 돌아가고 결과 확인
                  </li>
                  <li>
                    <strong>6단계:</strong> 당첨 시 자동으로 배당금 지급!
                  </li>
                </ol>
              </section>

              <section className={styles.warningSection}>
                <h2 className={styles.warningTitle}>⚠️ 주의사항</h2>
                <ul className={styles.warningList}>
                  <li>모든 베팅 금액은 스핀 시작 전에 차감됩니다</li>
                  <li>당첨된 베팅만 원금 + 배당금을 받습니다</li>
                  <li>낙첨된 베팅 금액은 환불되지 않습니다</li>
                  <li>
                    게임 결과는 서버에서 랜덤으로 생성되며 조작 불가능합니다
                  </li>
                </ul>
              </section>

              <div className={styles.footer}>
                <button
                  onClick={() => setIsOpen(false)}
                  className={styles.startBtn}
                >
                  이제 시작하기! 🎰
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
