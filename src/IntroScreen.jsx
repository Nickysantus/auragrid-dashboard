import { useState, useEffect } from "react";

const C = {
  bg:    "#080B14",
  cyan:  "#00F5FF",
  amber: "#FFB800",
  dim:   "#8892A4",
  muted: "#4A5568",
};

export default function IntroScreen({ onDone }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 800);
    const t2 = setTimeout(() => setPhase(2), 1800);
    const t3 = setTimeout(() => setPhase(3), 2800);
    const t4 = setTimeout(() => onDone(), 3600);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: C.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 28,
      opacity: phase === 3 ? 0 : 1,
      transition: "opacity 0.8s ease",
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 ${C.cyan}44; }
          50%       { box-shadow: 0 0 0 20px ${C.cyan}00; }
        }
      `}</style>

      {/* Logo */}
      <div style={{
        opacity: phase >= 0 ? 1 : 0,
        transition: "opacity 0.6s ease",
      }}>
        <img
          src="/logo512.png"
          alt="AuraGrid"
          style={{
            width: 90, height: 90,
            borderRadius: "50%",
            border: `2px solid ${C.cyan}55`,
            animation: "pulse-ring 2s ease-in-out infinite",
            filter: `drop-shadow(0 0 20px ${C.cyan}88)`,
          }}
        />
      </div>

      {/* Title */}
      <div style={{
        fontSize: 52, fontWeight: 800, letterSpacing: -1,
        background: `linear-gradient(90deg, ${C.cyan}, ${C.amber})`,
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        opacity: phase >= 1 ? 1 : 0,
        transform: phase >= 1 ? "translateY(0)" : "translateY(24px)",
        transition: "all 0.7s ease",
      }}>
        AuraGrid
      </div>

      {/* Subtitle */}
      <div style={{
        fontSize: 11, color: C.dim,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: 6, textTransform: "uppercase",
        opacity: phase >= 2 ? 1 : 0,
        transition: "opacity 0.6s ease 0.1s",
      }}>
        Global DePIN Network
      </div>

      {/* Loading bar */}
      <div style={{
        width: 260, height: 2,
        background: "#1A2540", borderRadius: 2, overflow: "hidden",
        opacity: phase >= 2 ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}>
        <div style={{
          height: "100%", borderRadius: 2,
          background: `linear-gradient(90deg, ${C.cyan}, ${C.amber})`,
          width: phase >= 2 ? "100%" : "0%",
          transition: "width 1.4s ease",
        }} />
      </div>

      {/* Tagline */}
      <div style={{
        fontSize: 11, color: C.muted,
        fontFamily: "'JetBrains Mono', monospace",
        opacity: phase >= 2 ? 1 : 0,
        transition: "opacity 0.6s ease 0.3s",
      }}>
        Powered by Solar · Built for Africa & Asia
      </div>
    </div>
  );
}