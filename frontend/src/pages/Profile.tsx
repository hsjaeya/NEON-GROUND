import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/Authcontext";
import styles from "./Profile.module.css";
import type { FormEvent } from "react";

interface ProfileStats {
  totalGames: number;
  totalWins: number;
  winRate: number;
  netProfit: number;
  totalWagered: number;
  totalPayout: number;
}

interface ProfileData {
  id: number;
  username: string;
  email: string;
  createdAt: string;
  balance: number;
  stats: ProfileStats | null;
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "pos" | "neg" | "cyan";
}) {
  const accentClass =
    accent === "pos"
      ? styles.statBoxPos
      : accent === "neg"
        ? styles.statBoxNeg
        : accent === "cyan"
          ? styles.statBoxCyan
          : "";
  return (
    <div className={`${styles.statBox} ${accentClass}`}>
      <span className={styles.statLabel}>{label}</span>
      <span
        className={`${styles.statValue} ${
          accent === "pos"
            ? styles.pos
            : accent === "neg"
              ? styles.neg
              : accent === "cyan"
                ? styles.cyan
                : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function Profile() {
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editPasswordConfirm, setEditPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = () => {
    const token = localStorage.getItem("token");
    fetch(`${import.meta.env.VITE_API_URL}/user/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setProfile)
      .catch(() => setError("CONNECTION ERROR"))
      .finally(() => setLoading(false));
  };

  const openEdit = () => {
    if (!profile) return;
    setEditUsername(profile.username);
    setEditEmail(profile.email);
    setEditPassword("");
    setEditPasswordConfirm("");
    setSaveError("");
    setSaveSuccess("");
    setEditing(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (editPassword && editPassword !== editPasswordConfirm) {
      setSaveError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (editPassword && editPassword.length < 8) {
      setSaveError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    const body: Record<string, string> = {};
    if (editUsername !== profile?.username) body.username = editUsername;
    if (editEmail !== profile?.email) body.email = editEmail;
    if (editPassword) body.password = editPassword;

    if (Object.keys(body).length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/user/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? data.message[0]
          : data.message;
        setSaveError(msg || "수정 실패");
        return;
      }
      setSaveSuccess("정보가 수정되었습니다.");
      setEditing(false);
      fetchProfile();
      await refreshUser();
    } catch {
      setSaveError("서버 연결 오류");
    } finally {
      setSaving(false);
    }
  };

  const joined = profile
    ? new Date(profile.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  return (
    <div className={styles.root}>
      <div className={styles.scanlines} />
      <div className={styles.dotGrid} />

      <header className={styles.header}>
        <Link to="/" className={styles.backBtn}>
          ← BACK
        </Link>
        <div className={styles.headerTitle}>
          <span className={styles.headerIcon}>◉</span>
          <span>
            PRO<span className={styles.headerAccent}>FILE</span>
          </span>
        </div>
        <div className={styles.headerSpacer} />
      </header>

      <main className={styles.main}>
        {loading && <div className={styles.statusMsg}>LOADING...</div>}
        {error && <div className={styles.errorMsg}>{error}</div>}

        {!loading && !error && profile && (
          <>
            {/* ID Card */}
            <div className={styles.idCard}>
              <div className={styles.idCornerTL} />
              <div className={styles.idCornerTR} />
              <div className={styles.idCornerBL} />
              <div className={styles.idCornerBR} />

              <div className={styles.idTopRow}>
                <div className={styles.idAvatar}>
                  {profile.username.charAt(0).toUpperCase()}
                </div>
                <div className={styles.idInfo}>
                  <div className={styles.idUsernameRow}>
                    <div className={styles.idUsername}>
                      {profile.username.toUpperCase()}
                    </div>
                    <button className={styles.editBtn} onClick={openEdit}>
                      EDIT
                    </button>
                  </div>
                  <div className={styles.idEmail}>{profile.email}</div>
                  <div className={styles.idMeta}>
                    <span className={styles.idMetaItem}>
                      <span className={styles.idMetaLabel}>ID</span>
                      <span className={styles.idMetaValue}>
                        #{String(profile.id).padStart(6, "0")}
                      </span>
                    </span>
                    <span className={styles.idMetaDivider}>·</span>
                    <span className={styles.idMetaItem}>
                      <span className={styles.idMetaLabel}>JOINED</span>
                      <span className={styles.idMetaValue}>{joined}</span>
                    </span>
                  </div>
                </div>
              </div>

              {saveSuccess && !editing && (
                <div className={styles.saveSuccess}>{saveSuccess}</div>
              )}

              <div className={styles.idDivider} />

              <div className={styles.idBalanceRow}>
                <div className={styles.idBalanceLeft}>
                  <span className={styles.idBalanceLabel}>BALANCE</span>
                  <span className={styles.idBalanceValue}>
                    ${parseFloat(String(profile.balance)).toLocaleString()}
                  </span>
                </div>
                <div className={styles.idCardTag}>PLAYER ACCESS</div>
              </div>
            </div>

            {/* Edit Form */}
            {editing && (
              <form className={styles.editForm} onSubmit={handleSave}>
                <div className={styles.editFormTitle}>
                  <span className={styles.editFormIcon}>◈</span>
                  EDIT PROFILE
                </div>

                <div className={styles.editField}>
                  <label className={styles.editLabel}>USERNAME</label>
                  <input
                    className={styles.editInput}
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    maxLength={30}
                    required
                  />
                </div>

                <div className={styles.editField}>
                  <label className={styles.editLabel}>EMAIL</label>
                  <input
                    className={styles.editInput}
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    required
                  />
                </div>

                {/* <div className={styles.editDivider} />
                <div className={styles.editPasswordNote}>NEW PASSWORD (선택 사항)</div> */}

                <div className={styles.editField}>
                  <label className={styles.editLabel}>NEW PASSWORD</label>
                  <input
                    className={styles.editInput}
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="8자 이상"
                    autoComplete="new-password"
                  />
                </div>

                <div className={styles.editField}>
                  <label className={styles.editLabel}>CONFIRM PASSWORD</label>
                  <input
                    className={styles.editInput}
                    type="password"
                    value={editPasswordConfirm}
                    onChange={(e) => setEditPasswordConfirm(e.target.value)}
                    placeholder="비밀번호 재입력"
                    autoComplete="new-password"
                  />
                </div>

                {saveError && (
                  <div className={styles.saveError}>{saveError}</div>
                )}

                <div className={styles.editActions}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => {
                      setEditing(false);
                      setSaveError("");
                    }}
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className={styles.saveBtn}
                    disabled={saving}
                  >
                    {saving ? "SAVING..." : "SAVE"}
                  </button>
                </div>
              </form>
            )}

            {/* Stats */}
            {profile.stats ? (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>GAME STATS</div>

                {/* Win Rate Bar */}
                <div className={styles.winRateWrap}>
                  <div className={styles.winRateHeader}>
                    <span className={styles.winRateLabel}>WIN RATE</span>
                    <span className={styles.winRateValue}>
                      {profile.stats.winRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className={styles.winRateTrack}>
                    <div
                      className={styles.winRateFill}
                      style={{
                        width: `${Math.min(100, profile.stats.winRate)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Row 1: Games / Wins / Losses */}
                <div className={styles.statsGrid}>
                  <StatBox
                    label="GAMES PLAYED"
                    value={profile.stats.totalGames.toLocaleString()}
                    accent="cyan"
                  />
                  <StatBox
                    label="WINS"
                    value={profile.stats.totalWins.toLocaleString()}
                    accent="pos"
                  />
                  <StatBox
                    label="LOSSES"
                    value={(
                      profile.stats.totalGames - profile.stats.totalWins
                    ).toLocaleString()}
                    accent="neg"
                  />
                </div>

                {/* Net Profit Hero */}
                {(() => {
                  const isPos = profile.stats.netProfit >= 0;
                  return (
                    <div
                      className={`${styles.profitHero} ${!isPos ? styles.profitHeroNeg : ""}`}
                    >
                      <div className={styles.profitLeft}>
                        <span className={styles.profitLabel}>NET PROFIT</span>
                        <span
                          className={`${styles.profitValue} ${isPos ? styles.profitValuePos : styles.profitValueNeg}`}
                        >
                          {isPos ? "+" : "-"}$
                          {Math.abs(profile.stats.netProfit).toLocaleString()}
                        </span>
                      </div>
                      <div className={styles.profitBadge}>
                        <span
                          className={`${styles.profitBadgeIcon} ${!isPos ? styles.profitBadgeIconNeg : ""}`}
                        >
                          {isPos ? "▲" : "▼"}
                        </span>
                        <span className={styles.profitBadgeText}>
                          {isPos ? "PROFIT" : "DEFICIT"}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Row 2: Wagered / Payout */}
                <div className={styles.statsGrid2}>
                  <StatBox
                    label="TOTAL WAGERED"
                    value={`$${profile.stats.totalWagered.toLocaleString()}`}
                  />
                  <StatBox
                    label="TOTAL PAYOUT"
                    value={`$${profile.stats.totalPayout.toLocaleString()}`}
                    accent="cyan"
                  />
                </div>
              </div>
            ) : (
              <div className={styles.noStats}>
                <div className={styles.noStatsIcon}>◈</div>
                <div className={styles.noStatsText}>NO GAME HISTORY YET</div>
                <div className={styles.noStatsSub}>
                  Play some games to see your stats
                </div>
                <Link to="/" className={styles.playBtn}>
                  PLAY NOW →
                </Link>
              </div>
            )}

            {/* Quick links */}
            <div className={styles.links}>
              <Link to="/ranking" className={styles.linkBtn}>
                RANKING
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
