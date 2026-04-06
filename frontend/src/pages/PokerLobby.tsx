import { Link } from "react-router-dom";

export default function PokerLobby() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#030810",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Share Tech Mono', monospace",
      gap: "32px",
    }}>
      <div style={{ fontSize: "64px", lineHeight: 1 }}>🃏</div>

      <div style={{
        fontSize: "13px",
        letterSpacing: "0.4em",
        color: "rgba(0,255,200,0.4)",
      }}>
        POKER
      </div>

      <div style={{
        fontSize: "22px",
        letterSpacing: "0.15em",
        color: "#c8e6ff",
        textAlign: "center",
      }}>
        준비 중인 게임입니다
      </div>

      <div style={{
        fontSize: "11px",
        letterSpacing: "0.1em",
        color: "rgba(200,230,255,0.3)",
        textAlign: "center",
      }}>
        더 나은 경험을 위해 준비하고 있습니다
      </div>

      <Link to="/" style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: "11px",
        letterSpacing: "0.2em",
        color: "rgba(0,255,200,0.6)",
        textDecoration: "none",
        border: "1px solid rgba(0,255,200,0.25)",
        padding: "10px 28px",
        marginTop: "8px",
        transition: "all 0.2s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLAnchorElement).style.color = "#00ffc8";
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "#00ffc8";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLAnchorElement).style.color = "rgba(0,255,200,0.6)";
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,255,200,0.25)";
      }}
      >
        ← 홈으로
      </Link>
    </div>
  );
}
