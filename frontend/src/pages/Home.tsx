import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/Authcontext";
import styles from "./Home.module.css";
import { useState } from "react";

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
  { to: "/slotMachine", icon: "🎰", name: "SLOT MACHINE", sub: "RNG Engine" },
  {
    to: "/makeMoney",
    icon: "💰",
    name: "MAKE MONEY",
    sub: "Credit Boost",
    featured: true,
  },
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
}: Omit<Game, "to">) {
  return (
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
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshUser();
    setIsRefreshing(false);
  };

  // 로그인 안 됨 - Landing 화면
  if (!user) {
    return (
      <div className={styles.root}>
        <div className={styles.scanlines} />
        <div className={styles.dotGrid} />

        {/* HUD */}
        <header className={styles.hud}>
          <div className={styles.hudLogo}>
            <div className={styles.hudDot} />
            <span>NEON VAULT</span>
          </div>
          <div className={styles.hudInfo}>
            {/* Dummy spacer to maintain header height */}
            <div className={styles.hudStat}>
              <span className={styles.hudLabel}>&nbsp;</span>
              <span className={styles.hudValue}>&nbsp;</span>
            </div>
            <div className={styles.hudDivider} />
            <div className={styles.hudStat}>
              <span className={styles.hudLabel}>&nbsp;</span>
              <span className={styles.hudValue}>&nbsp;</span>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className={styles.main}>
          {/* Title */}
          <div className={styles.titleBlock}>
            <p className={styles.titleEyebrow}>// WELCOME TO THE VAULT //</p>
            <h1 className={styles.title}>
              ENTER THE
              <br />
              <span className={styles.titleAccent}>NEON</span> VAULT
            </h1>
            <p className={styles.titleSub}>
              Try your luck · luck protocol v2.7 · secure access required
            </p>
          </div>

          {/* Games */}
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
                />
              ))}
            </div>
          </section>

          {/* Divider */}
          <div className={styles.divider}>
            <span className={styles.dividerDiamond}>◆</span>
          </div>

          {/* System */}
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

        {/* Footer */}
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

  // 로그인 됨 - Game Hub 화면
  const UTILS: Util[] = [
    { to: "/Ranking", label: "RAKING" },
    { to: "/setting", label: "SETTINGS" },
    { label: "LOGOUT", danger: true, onClick: handleLogout },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.scanlines} />
      <div className={styles.dotGrid} />

      {/* HUD */}
      <header className={styles.hud}>
        <div className={styles.hudLogo}>
          <div className={styles.hudDot} />
          <span>NEON VAULT</span>
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                minWidth: "140px",
              }}
            >
              <span
                className={styles.hudValue}
                style={{ flex: 1, textAlign: "right" }}
              >
                ₩ {parseFloat(String(user.balance || 0)).toLocaleString()}
              </span>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                style={{
                  background: "none",
                  border: "none",
                  cursor: isRefreshing ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  color: isRefreshing
                    ? "rgba(0, 255, 200, 0.3)"
                    : "rgba(0, 255, 200, 0.6)",
                  transition: "all 0.3s ease",
                  transform: isRefreshing ? "rotate(360deg)" : "rotate(0deg)",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "20px",
                  flexShrink: 0,
                }}
                title="Refresh balance"
              >
                ↻
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className={styles.main}>
        {/* Title */}
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

        {/* Games */}
        <section className={styles.section}>
          <SectionLabel text="GAME MODULES" />
          <div className={styles.gameGrid}>
            {GAMES.map((g) => (
              <GameCard key={g.to} {...g} />
            ))}
          </div>
        </section>

        {/* Divider */}
        <div className={styles.divider}>
          <span className={styles.dividerDiamond}>◆</span>
        </div>

        {/* System */}
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

      {/* Footer */}
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
