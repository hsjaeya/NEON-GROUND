import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/Authcontext";
import styles from "./Home.module.css";
import { useEffect, useState } from "react";

type Game = {
  to: string;
  icon: string;
  name: string;
  sub: string;
  featured?: boolean;
};

type Util = {
  to?: string;
  label: string;
  danger?: boolean;
  onClick?: () => void;
};

const GAMES: Game[] = [
  { to: "/blackJack", icon: "🃏", name: "BLACK JACK", sub: "Card Protocol" },
  { to: "/roulette", icon: "🎡", name: "ROULETTE", sub: "Spin Matrix" },
  { to: "/poker", icon: "🂠", name: "POKER", sub: "Hand Matrix" },
];

function SectionLabel({ text }: { text: string }) {
  return (
    <div className={styles.sectionLabel}>
      <span>{text}</span>
      <div className={styles.sectionLine} />
    </div>
  );
}

function GameCard({ to, icon, name, sub, featured = false }: Game) {
  return (
    <Link to={to} className={styles.cardLink}>
      <div className={`${styles.card} ${featured ? styles.cardFeatured : ""}`}>
        <div className={styles.cardCorner} />
        <div className={styles.cardGlow} />
        <span className={styles.cardIcon}>{icon}</span>
        <div className={styles.cardBody}>
          <span
            className={`${styles.cardName} ${featured ? styles.cardNameFeatured : ""}`}
          >
            {name}
          </span>
          <span className={styles.cardSub}>{sub}</span>
        </div>
        <span className={styles.cardArrow}>↗</span>
      </div>
    </Link>
  );
}

function GameCardStatic({
  icon,
  name,
  sub,
  featured = false,
  onClick,
}: Omit<Game, "to"> & { onClick?: () => void }) {
  return (
    <div
      className={`${styles.card} ${featured ? styles.cardFeatured : ""} ${styles.cardClickable}`}
      onClick={onClick}
    >
      <div className={styles.cardCorner} />
      <div className={styles.cardGlow} />
      <span className={styles.cardIcon}>{icon}</span>
      <div className={styles.cardBody}>
        <span
          className={`${styles.cardName} ${featured ? styles.cardNameFeatured : ""}`}
        >
          {name}
        </span>
        <span className={styles.cardSub}>{sub}</span>
      </div>
      <span className={styles.cardArrow}>↗</span>
    </div>
  );
}

function LoginPromptModal({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalIcon}>⚠</div>
        <div className={styles.modalTitle}>ACCESS DENIED</div>
        <div className={styles.modalDesc}>
          게임을 플레이하려면 로그인이 필요합니다
        </div>
        <div className={styles.modalActions}>
          <Link to="/login" className={styles.modalBtnPrimary}>
            SIGN IN
          </Link>
          <Link to="/register" className={styles.modalBtnSecondary}>
            CREATE ACCOUNT
          </Link>
        </div>
        <button className={styles.modalClose} onClick={onClose}>✕</button>
      </div>
    </div>
  );
}

interface BonusCardProps {
  available: boolean | null;
  countdown: string;
  claiming: boolean;
  onClaim: () => void;
}

function BonusCard({
  available,
  countdown,
  claiming,
  onClaim,
}: BonusCardProps) {
  const isAvailable = available === true;
  return (
    <div
      className={`${styles.card} ${styles.cardFeatured} ${isAvailable ? styles.cardBonusAvailable : ""}`}
      onClick={isAvailable && !claiming ? onClaim : undefined}
      style={{ cursor: isAvailable ? "pointer" : "default" }}
    >
      <div className={styles.cardCorner} />
      <div className={styles.cardGlow} />
      <span className={styles.cardIcon}>💰</span>
      <div className={styles.cardBody}>
        <span className={`${styles.cardName} ${styles.cardNameFeatured}`}>
          BONUS MONEY
        </span>
        <span className={styles.cardSub}>
          {available === null
            ? "Loading..."
            : isAvailable
              ? "$100,000 AVAILABLE"
              : `NEXT IN ${countdown}`}
        </span>
      </div>
      {isAvailable && (
        <span className={`${styles.cardArrow} ${styles.cardArrowBonus}`}>
          {claiming ? "..." : "↗"}
        </span>
      )}
    </div>
  );
}

function UtilButton({ label, danger = false, onClick, to }: Util) {
  if (to) {
    return (
      <Link to={to} className={styles.utilLink}>
        <button
          className={`${styles.utilBtn} ${danger ? styles.utilBtnDanger : ""}`}
        >
          {label}
        </button>
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`${styles.utilBtn} ${danger ? styles.utilBtnDanger : ""}`}
    >
      {label}
    </button>
  );
}

export default function Home() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [loginPrompt, setLoginPrompt] = useState(false);

  const [dailyBonus, setDailyBonus] = useState<{
    available: boolean;
    nextClaimAt: string | null;
  } | null>(null);
  const [bonusCountdown, setBonusCountdown] = useState("");
  const [claimingBonus, setClaimingBonus] = useState(false);

  useEffect(() => {
    if (user) {
      refreshUser();
      fetchDailyBonusStatus();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!dailyBonus?.nextClaimAt) return;
    const tick = () => {
      const diff = new Date(dailyBonus.nextClaimAt!).getTime() - Date.now();
      if (diff <= 0) {
        setDailyBonus({ available: true, nextClaimAt: null });
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setBonusCountdown(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [dailyBonus?.nextClaimAt]);

  const fetchDailyBonusStatus = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/user/daily-bonus`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) setDailyBonus(await res.json());
    } catch {}
  };

  const handleClaimBonus = async () => {
    const token = localStorage.getItem("token");
    if (!token || claimingBonus) return;
    setClaimingBonus(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/user/daily-bonus`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        await refreshUser();
        setDailyBonus({
          available: false,
          nextClaimAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        });
        alert(
          `💰 보너스 머니 $${Number(data.bonusAmount).toLocaleString()} 지급 완료!`,
        );
      }
    } catch {
    } finally {
      setClaimingBonus(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (!user) {
    return (
      <div className={styles.root}>
        <div className={styles.scanlines} />
        <div className={styles.dotGrid} />

        {loginPrompt && <LoginPromptModal onClose={() => setLoginPrompt(false)} />}

        <header className={styles.hud}>
          <div className={styles.hudLogo}>
            <div className={styles.hudDot} />
            <span>NEON GROUND</span>
          </div>
          <div className={styles.hudInfo}>
            <div className={styles.hudStat}>
              <span className={styles.hudLabel}>&nbsp;</span>
              <span className={styles.hudValue}>&nbsp;</span>
            </div>
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.titleBlock}>
            <p className={styles.titleEyebrow}>// WELCOME TO THE VAULT //</p>
            <h1 className={styles.title}>
              ENTER THE
              <br />
              <span className={styles.titleAccent}>NEON</span> GROUND
            </h1>
            <p className={styles.titleSub}>
              Try your luck · luck protocol v2.7 · secure access required
            </p>
          </div>

          <section className={styles.section}>
            <SectionLabel text="GAME MODULES" />
            <div className={styles.gameGrid}>
              {GAMES.map((g) => (
                <GameCardStatic
                  key={g.name}
                  icon={g.icon}
                  name={g.name}
                  sub={g.sub}
                  featured={g.featured}
                  onClick={() => setLoginPrompt(true)}
                />
              ))}
            </div>
          </section>

          <div className={styles.divider}>
            <span className={styles.dividerDiamond}>◆</span>
          </div>

          <section className={styles.section}>
            <SectionLabel text="SYSTEM ACCESS" />
            <div className={styles.utilRow}>
              <Link to="/register" className={styles.utilLink}>
                <button className={styles.utilBtn}>CREATE ACCOUNT</button>
              </Link>
              <Link to="/login" className={styles.utilLink}>
                <button className={styles.utilBtn}>SIGN IN</button>
              </Link>
            </div>
          </section>
        </main>

        <footer className={styles.footer}>
          <span>SYS.STATUS :: ONLINE · VAULT LOCKED</span>
          <div className={styles.pulseBars}>
            {[4, 9, 14, 7, 11].map((h, i) => (
              <span
                key={i}
                className={styles.pulseBar}
                style={{ height: `${h}px`, animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
          <span>NODE 7 · SECTOR 4 · 2087</span>
        </footer>
      </div>
    );
  }

  const UTILS: Util[] = [
    { to: "/profile", label: "PROFILE" },
    { to: "/ranking", label: "RANKING" },
    { label: "LOGOUT", danger: true, onClick: handleLogout },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.scanlines} />
      <div className={styles.dotGrid} />

      <header className={styles.hud}>
        <div className={styles.hudLogo}>
          <div className={styles.hudDot} />
          <span>NEON GROUND</span>
        </div>
        <div className={styles.hudInfo}>
          <div className={styles.hudStat}>
            <span className={styles.hudLabel}>PLAYER</span>
            <span className={styles.hudValue}>
              {user.username.toUpperCase()}
            </span>
          </div>
          <div className={styles.hudDivider} />
          <div className={styles.hudStat}>
            <span className={styles.hudLabel}>BALANCE</span>
            <span className={styles.hudValue}>
              $ {parseFloat(String(user.balance || 0)).toLocaleString()}
            </span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.titleBlock}>
          <p className={styles.titleEyebrow}>// SELECT INTERFACE //</p>
          <h1 className={styles.title}>
            CHOOSE
            <br />
            YOUR <span className={styles.titleAccent}>GAME</span>
          </h1>
          <p className={styles.titleSub}>
            4 modules available · luck protocol v2.7
          </p>
        </div>

        <section className={styles.section}>
          <SectionLabel text="GAME MODULES" />
          <div className={styles.gameGrid}>
            {GAMES.map((g) => (
              <GameCard key={g.to} {...g} />
            ))}
            <BonusCard
              available={dailyBonus?.available ?? null}
              countdown={bonusCountdown}
              claiming={claimingBonus}
              onClaim={handleClaimBonus}
            />
          </div>
        </section>

        <div className={styles.divider}>
          <span className={styles.dividerDiamond}>◆</span>
        </div>

        <section className={styles.section}>
          <SectionLabel text="SYSTEM" />
          <div className={styles.utilRow}>
            {UTILS.map(({ to, label, danger, onClick }) => (
              <UtilButton
                key={label}
                to={to}
                label={label}
                danger={danger}
                onClick={onClick}
              />
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>SYS.STATUS :: ONLINE · LUCK ENGINE ACTIVE</span>
        <div className={styles.pulseBars}>
          {[4, 9, 14, 7, 11].map((h, i) => (
            <span
              key={i}
              className={styles.pulseBar}
              style={{ height: `${h}px`, animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
        <span>NODE 7 · SECTOR 4 · 2087</span>
      </footer>
    </div>
  );
}
