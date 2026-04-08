import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import styles from "./Ranking.module.css";

type SortKey = "profit" | "balance" | "winrate" | "games";

interface RankRow {
  rank: number;
  username: string;
  balance: number;
  totalGames: number;
  totalWins: number;
  netProfit: number;
  winRate: number;
}

interface RankingResponse {
  data: RankRow[];
  total: number;
  page: number;
  totalPages: number;
}

const TABS: { key: SortKey; label: string }[] = [
  { key: "profit",  label: "NET PROFIT" },
  { key: "balance", label: "BALANCE"    },
  { key: "winrate", label: "WIN RATE"   },
  { key: "games",   label: "GAMES"      },
];

export default function Ranking() {
  const [sort, setSort] = useState<SortKey>("profit");
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    setLoading(true);
    setError("");

    const load = (retries = 2) => {
      fetch(`${import.meta.env.VITE_API_URL}/ranking?sort=${sort}&page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => {
          if (r.status === 429 && retries > 0) {
            setTimeout(() => load(retries - 1), 1500);
            return;
          }
          if (!r.ok) throw new Error("FETCH FAILED");
          return r.json();
        })
        .then((data) => { if (data) setRes(data as RankingResponse); })
        .catch(() => setError("CONNECTION ERROR"))
        .finally(() => setLoading(false));
    };

    load();
  }, [sort, page]);

  const handleSort = (key: SortKey) => {
    setSort(key);
    setPage(1);
  };

  const rows = res?.data ?? [];
  const totalPages = res?.totalPages ?? 1;
  const total = res?.total ?? 0;

  const pageNums = () => {
    const nums: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) nums.push(i);
    } else {
      nums.push(1);
      if (page > 3) nums.push("…");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) nums.push(i);
      if (page < totalPages - 2) nums.push("…");
      nums.push(totalPages);
    }
    return nums;
  };

  return (
    <div className={styles.root}>
      <div className={styles.scanlines} />
      <div className={styles.dotGrid} />

      <header className={styles.header}>
        <Link to="/" className={styles.backBtn}>← BACK</Link>
        <div className={styles.headerTitle}>
          <span className={styles.headerIcon}>◈</span>
          <span>RANK<span className={styles.headerAccent}>ING</span></span>
        </div>
        <div className={styles.headerSpacer} />
      </header>

      <main className={styles.main}>
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`${styles.tab} ${sort === t.key ? styles.tabActive : ""}`}
              onClick={() => handleSort(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.tableWrap}>
          {loading && <div className={styles.statusMsg}>LOADING...</div>}
          {error && <div className={styles.errorMsg}>{error}</div>}
          {!loading && !error && rows.length === 0 && (
            <div className={styles.statusMsg}>NO DATA YET — PLAY SOME GAMES FIRST</div>
          )}
          {!loading && !error && rows.length > 0 && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thRank}>#</th>
                  <th className={styles.thName}>PLAYER</th>
                  <th className={styles.thNum}>BALANCE</th>
                  <th className={styles.thNum}>NET PROFIT</th>
                  <th className={styles.thNum}>WIN RATE</th>
                  <th className={styles.thNum}>GAMES</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rank} className={`${styles.row} ${r.rank <= 3 ? styles.rowTop : ""}`}>
                    <td className={styles.tdRank}>
                      {r.rank === 1 ? "①" : r.rank === 2 ? "②" : r.rank === 3 ? "③" : r.rank}
                    </td>
                    <td className={styles.tdName}>{r.username.toUpperCase()}</td>
                    <td className={styles.tdNum}>${r.balance.toLocaleString()}</td>
                    <td className={`${styles.tdNum} ${r.netProfit >= 0 ? styles.pos : styles.neg}`}>
                      {r.netProfit >= 0 ? "+" : ""}${r.netProfit.toLocaleString()}
                    </td>
                    <td className={styles.tdNum}>{r.winRate.toFixed(1)}%</td>
                    <td className={styles.tdNum}>{r.totalGames.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && !error && totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pgBtn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ‹
            </button>
            {pageNums().map((n, i) =>
              n === "…" ? (
                <span key={`ellipsis-${i}`} className={styles.pgEllipsis}>…</span>
              ) : (
                <button
                  key={n}
                  className={`${styles.pgBtn} ${page === n ? styles.pgBtnActive : ""}`}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              )
            )}
            <button
              className={styles.pgBtn}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              ›
            </button>
            <span className={styles.pgInfo}>{total} PLAYERS</span>
          </div>
        )}
      </main>
    </div>
  );
}
