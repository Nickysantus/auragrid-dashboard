import { useState, useEffect, useRef } from "react";
import IntroScreen from "./IntroScreen";

// ── Design tokens ──────────────────────────────────────────────
const C = {
  bg:       "#080B14",
  surface:  "#0D1220",
  border:   "#1A2540",
  cyan:     "#00F5FF",
  amber:    "#FFB800",
  green:    "#00FF88",
  red:      "#FF3B3B",
  muted:    "#4A5568",
  text:     "#E2E8F0",
  dim:      "#8892A4",
};

// ── Helpers ────────────────────────────────────────────────────
function statusColor(status) {
  if (!status) return C.muted;
  const s = status.toUpperCase();
  if (s === "ONLINE")   return C.green;
  if (s === "UNSTABLE") return C.amber;
  if (s === "OFFLINE")  return C.red;
  return C.muted;
}

function trustColor(score) {
  if (score >= 80) return C.green;
  if (score >= 50) return C.amber;
  return C.red;
}

function fmt(n, d = 1) {
  return Number(n ?? 0).toFixed(d);
}

// ── Pulse dot ─────────────────────────────────────────────────
function PulseDot({ color }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: 10, height: 10 }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: color, opacity: 0.3,
        animation: "ping 1.4s ease-in-out infinite",
      }} />
      <span style={{
        position: "absolute", inset: 2, borderRadius: "50%",
        background: color,
      }} />
    </span>
  );
}

// ── Grid canvas (animated power lines) ────────────────────────
function GridCanvas({ nodes, migrating }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const tRef      = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const positions = {};
const posSource = nodes.length > 0 ? nodes : [
  { nodeName: "SolarHost-Anambra-01" },
  { nodeName: "SolarHost-Accra-01"   },
  { nodeName: "SolarHost-Nairobi-01" },
  { nodeName: "SolarHost-Karachi-01" },
  { nodeName: "SolarHost-Dakar-01"   },
];
posSource.forEach((n, i) => {
  const total = posSource.length;
  const a = (i / total) * Math.PI * 2 - Math.PI / 2;
  const rx = total <= 4 ? 0.32 : 0.38;
  const ry = total <= 4 ? 0.32 : 0.38;
  positions[n.nodeName] = { x: 0.5 + Math.cos(a) * rx, y: 0.5 + Math.sin(a) * ry };
});

    function draw() {
      const W = canvas.width  = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);
      tRef.current += 0.02;
      const t = tRef.current;

      // Draw grid dots
      ctx.fillStyle = "rgba(0,245,255,0.04)";
      for (let x = 0; x < W; x += 32)
        for (let y = 0; y < H; y += 32)
          ctx.fillRect(x, y, 1, 1);

      const nodeList = nodes.length > 0 ? nodes : [
  { nodeName: "SolarHost-Anambra-01", status: "ONLINE", trustScore: 80.55, city: "Awka",    state: "Anambra",       country: "Nigeria"  },
  { nodeName: "SolarHost-Accra-01",   status: "ONLINE", trustScore: 50,    city: "Accra",   state: "Greater Accra", country: "Ghana"    },
  { nodeName: "SolarHost-Nairobi-01", status: "ONLINE", trustScore: 50,    city: "Nairobi", state: "Nairobi",       country: "Kenya"    },
  { nodeName: "SolarHost-Karachi-01", status: "ONLINE", trustScore: 80.58, city: "Karachi", state: "Sindh",         country: "Pakistan" },
  { nodeName: "SolarHost-Dakar-01",   status: "ONLINE", trustScore: 50,    city: "Dakar",   state: "Dakar",         country: "Senegal"  },
];
if (nodeList.length === 0) return;
      

      // Draw connections
      for (let i = 0; i < nodeList.length; i++) {
        for (let j = i + 1; j < nodeList.length; j++) {
          const a = positions[nodeList[i].nodeName];
          const b = positions[nodeList[j].nodeName];
          if (!a || !b) continue;
          const ax = a.x * W, ay = a.y * H;
          const bx = b.x * W, by = b.y * H;

          const isMigrationPair = migrating &&
            ((nodeList[i].status === "UNSTABLE" && nodeList[j].status === "ONLINE") ||
             (nodeList[j].status === "UNSTABLE" && nodeList[i].status === "ONLINE"));

          if (isMigrationPair) {
            // Animated data packet along the line
            const grad = ctx.createLinearGradient(ax, ay, bx, by);
            grad.addColorStop(0,   "rgba(255,184,0,0)");
            grad.addColorStop(0.5, "rgba(255,184,0,0.6)");
            grad.addColorStop(1,   "rgba(255,184,0,0)");
            ctx.strokeStyle = grad;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]);
            ctx.lineDashOffset = -t * 12;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
            ctx.setLineDash([]);

            // Packet dot
            const p = (Math.sin(t) * 0.5 + 0.5);
            const px = ax + (bx - ax) * p;
            const py = ay + (by - ay) * p;
            ctx.beginPath();
            ctx.arc(px, py, 5, 0, Math.PI * 2);
            ctx.fillStyle = C.amber;
            ctx.shadowColor = C.amber;
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;
          } else {
            ctx.strokeStyle = "rgba(0,245,255,0.12)";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 8]);
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }

      // Draw nodes
      nodeList.forEach((n) => {
        const pos = positions[n.nodeName];
        if (!pos) return;
        const x = pos.x * W, y = pos.y * H;
        const col = statusColor(n.status);
        const pulse = Math.sin(t * 2) * 0.5 + 0.5;

        // Glow ring
        ctx.beginPath();
        ctx.arc(x, y, 18 + pulse * 4, 0, Math.PI * 2);
        ctx.fillStyle = col.replace(")", `,${0.06 + pulse * 0.06})`).replace("rgb", "rgba");
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fillStyle = C.surface;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        // Trust arc
        const trustAngle = ((n.trustScore ?? 0) / 100) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x, y, 15, -Math.PI / 2, -Math.PI / 2 + trustAngle);
        ctx.strokeStyle = trustColor(n.trustScore ?? 0);
        ctx.lineWidth = 3;
        ctx.stroke();

        // Label
        ctx.fillStyle = C.text;
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        const label = n.nodeName?.replace("SolarHost-", "").replace(/-\d+$/, "") ?? "Node";
        ctx.fillText(label, x, y + 28);

        ctx.fillStyle = col;
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.fillText(fmt(n.trustScore ?? 0) + " TS", x, y + 39);
      });

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes, migrating]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}

// ── Node card ─────────────────────────────────────────────────
function NodeCard({ node }) {
  const col = statusColor(node.status);
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${col}33`,
      borderRadius: 12,
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      transition: "border-color 0.4s",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: C.text, fontSize: 14 }}>
          {node.nodeName}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <PulseDot color={col} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: col, textTransform: "uppercase" }}>
            {node.status ?? "OFFLINE"}
          </span>
        </div>
      </div>

      {/* Trust score bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: C.dim, fontFamily: "monospace" }}>TRUST SCORE</span>
          <span style={{ fontSize: 11, color: trustColor(node.trustScore ?? 0), fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
            {fmt(node.trustScore ?? 0)}
          </span>
        </div>
        <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${node.trustScore ?? 0}%`,
            background: trustColor(node.trustScore ?? 0),
            borderRadius: 2,
            transition: "width 0.6s ease, background 0.4s",
          }} />
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[
          { label: "BATTERY", value: `${node.batteryLevel ?? 0}%`, color: node.batteryLevel > 50 ? C.green : C.red },
          { label: "CPU",     value: `${fmt(node.cpuUsage ?? 0)}%`,   color: C.cyan },
          { label: "RAM",     value: `${fmt(node.ramUsage ?? 0)}%`,   color: C.cyan },
        ].map(m => (
          <div key={m.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.dim, fontFamily: "monospace", marginBottom: 2 }}>{m.label}</div>
            <div style={{ fontSize: 13, color: m.color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>
        {node.city}, {node.state}, {node.country} · {node.ipAddress}
      </div>
    </div>
  );
}

// ── Migration event log ────────────────────────────────────────
function EventLog({ events }) {
  const bottomRef = useRef(null);
  useEffect(() => {
  const el = bottomRef.current?.parentElement;
  if (el) el.scrollTop = el.scrollHeight;
}, [events]);

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 16,
      height: 220,
      overflowY: "auto",
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 11,
    }}>
      <div style={{ color: C.dim, marginBottom: 10, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>
        ▸ Network Event Log
      </div>
      {events.length === 0 && (
        <div style={{ color: C.muted }}>Waiting for network events...</div>
      )}
      {events.map((e, i) => (
        <div key={i} style={{
          display: "flex", gap: 10, marginBottom: 6,
          color: e.type === "migration" ? C.amber : e.type === "error" ? C.red : e.type === "success" ? C.green : C.dim,
        }}>
          <span style={{ color: C.muted, flexShrink: 0 }}>{e.time}</span>
          <span>{e.icon} {e.message}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// ── Token counter ──────────────────────────────────────────────
function TokenCounter({ tokens }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.amber}33`,
      borderRadius: 12,
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}>
      <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", letterSpacing: 2 }}>
        NODE EARNINGS (AUR)
      </div>
      <div style={{
        fontSize: 32,
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 800,
        color: C.amber,
        letterSpacing: -1,
      }}>
        {tokens.toFixed(4)}
        <span style={{ fontSize: 14, color: C.dim, marginLeft: 6 }}>AUR</span>
      </div>
      <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>
        Passive income from hosting migrated workloads
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────
export default function AuraGridDashboard() {
  const [nodes,      setNodes]      = useState([]);
  const [events,     setEvents]     = useState([]);
  const [tokens,     setTokens]     = useState(0);
  const [migrating,  setMigrating]  = useState(false);
  const [aiNarration, setAiNarration] = useState("");
  const [connected, setConnected] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  function addEvent(type, icon, message) {
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setEvents(ev => [...ev.slice(-80), { type, icon, message, time }]);
  }

  // ── Simulate demo (works without real backend) ────────────────
  async function runDemo() {
    let loadedNodes = [];
    try {
      const res = await fetch("https://auragrid-coordinator.onrender.com/api/nodes");
      const data = await res.json();
      loadedNodes = data.nodes;
      setNodes(loadedNodes);
      addEvent("success", "🌍", `${data.count} AuraGrid nodes loaded across Africa & Asia`);
    } catch (err) {
      addEvent("error", "❌", `Could not reach coordinator: ${err.message}`);
      addEvent("info", "🔄", "Try clicking RUN DEMO again in ~30s (Render may be waking up)");
      return;
    }

    addEvent("info", "☀️", "Solar nodes stable across Africa & Asia");
    addEvent("info", "🔋", `All ${loadedNodes.length} nodes reporting battery levels`);

    // Simulate realistic metrics for nodes that have 0 cpu/ram
setNodes(loadedNodes.map(n => ({
  ...n,
  cpuUsage:  n.cpuUsage  > 0 ? n.cpuUsage  : parseFloat((Math.random() * 30 + 5).toFixed(1)),
  ramUsage:  n.ramUsage  > 0 ? n.ramUsage  : parseFloat((Math.random() * 40 + 20).toFixed(1)),
})));

   // Simulate NEPA outage after 4s
setTimeout(() => {
  const onlineNodes = loadedNodes.filter(n => n.status === "ONLINE");
  const failNode = onlineNodes[Math.floor(Math.random() * onlineNodes.length)];
  const recoverNode = onlineNodes.find(n => n.id !== failNode.id && n.trustScore >= 50);

  addEvent("error", "⚡", `GRID ALERT — NEPA power failure detected in ${failNode.city}!`);
  setNodes(prev => prev.map(n =>
    n.id === failNode.id
      ? { ...n, status: "UNSTABLE", batteryLevel: 12, powerStatus: "unstable", trustScore: 61 }
      : n
  ));
  setAiNarration(`⚡ Grid instability on ${failNode.nodeName} (${failNode.country}). Battery critical at 12%...`);
  setMigrating(true);

  // Store for later use
  window._failNode = failNode;
  window._recoverNode = recoverNode;
}, 4000);

    // AI analysis
    setTimeout(() => {
  const recover = window._recoverNode;
  addEvent("migration", "🧠", "AI Router: Running trust score analysis across network...");
  setAiNarration(`🧠 Analysing nodes... ${recover?.nodeName} (${recover?.country}): Trust Score ${recover?.trustScore}, Battery ${recover?.batteryLevel}% — selected as migration target.`);
}, 5500);

    // Migration
    setTimeout(() => {
  const recover = window._recoverNode;
  addEvent("migration", "🔄", "Checkpoint freeze initiated — workload state captured at step_3");
  addEvent("migration", "🚀", `Atomic migration: llama3-7b-inference → ${recover?.nodeName}`);
  setAiNarration(`🚀 Migrating workload to ${recover?.city}, ${recover?.country}. Checkpoint frozen at step_3...`);
}, 7000);

    // Success
    setTimeout(() => {
  const recover = window._recoverNode;
  setNodes(prev => prev.map(n =>
    n.id === recover?.id
      ? { ...n, cpuUsage: 38.7, ramUsage: 61.2, trustScore: 96 }
      : n
  ));
  addEvent("success", "✅", `Workload LIVE on ${recover?.nodeName} — zero data loss`);
  addEvent("success", "💰", `${recover?.city} node earning: +0.0012 AUR for hosting migrated task`);
  setAiNarration(`✅ Migration complete. Workload running on ${recover?.nodeName} in ${recover?.country}. Earning passive income from solar power.`);
      setMigrating(false);
      setTokens(t => t + 0.0012);
    }, 9000);

    // Recovery
    setTimeout(() => {
  const fail = window._failNode;
  setNodes(prev => prev.map(n =>
    n.id === fail?.id
      ? { ...n, status: "OFFLINE", batteryLevel: 8 }
      : n
  ));
  addEvent("info", "🔴", `${fail?.nodeName} (${fail?.city}): Gracefully taken offline — awaiting power restore`);
  setAiNarration(`🔴 ${fail?.city} offline. Network stable. Workload protected on solar-powered node in ${window._recoverNode?.country}.`);
}, 11000);

    // Token ticking
    const tick = setInterval(() => setTokens(t => t + 0.0001), 1500);
    setTimeout(() => clearInterval(tick), 30000);
  }

// ── Real Socket.IO connection ─────────────────────────────────
useEffect(() => {
  const COORDINATOR_URL = "https://auragrid-coordinator.onrender.com";
  import("socket.io-client").then(({ io }) => {
    const socket = io(COORDINATOR_URL, { transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      setConnected(true);
      addEvent("success", "🔌", `Live connection to AuraGrid Coordinator`);
    });

    socket.on("node:update", (data) => {
      setNodes(prev => {
        const idx = prev.findIndex(n => n.id === data.id);
        if (idx === -1) return [...prev, data];
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...data };
        return updated;
      });
    });

    socket.on("disconnect", () => {
      setConnected(false);
      addEvent("error", "❌", "Lost connection to coordinator");
    });

    return () => socket.disconnect();
  });
}, []);

  const onlineCount  = nodes.filter(n => n.status === "ONLINE").length;
  const unstableCount = nodes.filter(n => n.status === "UNSTABLE").length;

  return (
    <>
      {showIntro && <IntroScreen onDone={() => setShowIntro(false)} />}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${C.surface}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
        @keyframes ping {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50%       { transform: scale(2); opacity: 0; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glow {
          0%, 100% { text-shadow: 0 0 8px ${C.cyan}44; }
          50%       { text-shadow: 0 0 20px ${C.cyan}AA; }
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: "'Space Grotesk', sans-serif",
        padding: "0 0 40px",
        overflowX: "hidden",
      }}>

        {/* Header */}
        <div style={{
          borderBottom: `1px solid ${C.border}`,
          padding: "16px clamp(12px, 4vw, 28px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: `${C.surface}CC`,
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: `linear-gradient(135deg, ${C.cyan}22, ${C.amber}22)`,
              border: `1px solid ${C.cyan}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}>⚡</div>
            <div>
              <div style={{
                fontSize: 18, fontWeight: 800, letterSpacing: -0.5,
                background: `linear-gradient(90deg, ${C.cyan}, ${C.amber})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                animation: "glow 3s ease-in-out infinite",
              }}>
                AuraGrid
              </div>
              <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", letterSpacing: 2 }}>
                GLOBAL DEPIN NETWORK v1.0
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Status pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { label: "ONLINE",   count: onlineCount,   color: C.green },
                { label: "UNSTABLE", count: unstableCount, color: C.amber },
                { label: "NODES",    count: nodes.length,  color: C.cyan  },
              ].map(p => (
                <div key={p.label} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: `${p.color}11`,
                  border: `1px solid ${p.color}33`,
                  borderRadius: 20, padding: "4px 10px",
                  fontSize: 10, fontFamily: "monospace",
                }}>
                  <span style={{ color: p.color, fontWeight: 700 }}>{p.count}</span>
                  <span style={{ color: C.dim }}>{p.label}</span>
                </div>
              ))}
            </div>

            {/* Connection indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: connected ? C.green : C.muted, fontFamily: "monospace" }}>
              <PulseDot color={connected ? C.green : C.muted} />
              <span style={{ display: window.innerWidth < 480 ? "none" : "inline" }}>
                {connected ? "LIVE" : "DEMO"}
              </span>
            </div>

            {/* Run demo button */}
            <button
              onClick={runDemo}
              style={{
                background: `linear-gradient(135deg, ${C.cyan}22, ${C.amber}22)`,
                border: `1px solid ${C.cyan}55`,
                borderRadius: 8,
                color: C.cyan,
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 12,
                padding: "8px 16px",
                cursor: "pointer",
                letterSpacing: 1,
                transition: "all 0.2s",
              }}
              onMouseEnter={e => e.target.style.background = `${C.cyan}22`}
              onMouseLeave={e => e.target.style.background = `linear-gradient(135deg, ${C.cyan}22, ${C.amber}22)`}
            >
              ▶ RUN DEMO
            </button>
          </div>
        </div>

        <div style={{ padding: "clamp(12px, 4vw, 24px) clamp(12px, 4vw, 28px)", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* AI Narration Banner */}
          {aiNarration && (
            <div style={{
              background: `linear-gradient(90deg, ${C.amber}11, ${C.cyan}11)`,
              border: `1px solid ${C.amber}44`,
              borderRadius: 10,
              padding: "12px 18px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              color: C.amber,
              animation: "slideIn 0.3s ease",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 16 }}>🤖</span>
              <span><strong style={{ color: C.cyan }}>AuraGrid AI:</strong> {aiNarration}</span>
            </div>
          )}

          {/* Migration alert */}
          {migrating && (
            <div style={{
              background: `${C.amber}11`,
              border: `1px solid ${C.amber}66`,
              borderRadius: 10,
              padding: "12px 18px",
              display: "flex", alignItems: "center", gap: 12,
              animation: "slideIn 0.3s ease",
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: C.amber,
                animation: "ping 0.8s ease-in-out infinite",
              }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.amber, fontWeight: 700 }}>
                ATOMIC MIGRATION IN PROGRESS — Workload being transferred to stable solar node
              </span>
            </div>
          )}

          {/* Main grid */}
           <div style={{ display: "grid", 
            gridTemplateColumns: window.innerWidth < 900 ? "1fr" : "1fr 340px",
            gap: 20 }}>
            {/* Left: Canvas + node cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Network canvas */}
              <div style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                height: 400,
                overflow: "hidden",
                position: "relative",
              }}>
                <div style={{
                  position: "absolute", top: 12, left: 16, zIndex: 2,
                  fontSize: 10, color: C.dim, fontFamily: "monospace", letterSpacing: 2,
                }}>
                  NETWORK TOPOLOGY
                </div>
                <GridCanvas nodes={nodes} migrating={migrating} />
              </div>

              {/* Node cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {nodes.length === 0 ? (
                  <div style={{
                    gridColumn: "1/-1",
                    background: C.surface,
                    border: `1px dashed ${C.border}`,
                    borderRadius: 12,
                    padding: 32,
                    textAlign: "center",
                    color: C.muted,
                    fontFamily: "monospace",
                    fontSize: 13,
                  }}>
                    No nodes registered yet — click ▶ RUN DEMO or connect your backend
                  </div>
                ) : (
                  nodes.map(n => <NodeCard key={n.id ?? n.nodeName} node={n} />)
                )}
              </div>
            </div>

            {/* Right panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Token counter */}
              <TokenCounter tokens={tokens} />

              {/* Stats */}
              <div style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}>
                <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", letterSpacing: 2 }}>
                  NETWORK STATS
                </div>
                {[
                  { label: "Total Nodes",       value: nodes.length,                              color: C.cyan  },
                  { label: "Migrations Today",  value: Math.floor(tokens / 0.0012),               color: C.amber },
                  { label: "Avg Trust Score",   value: nodes.length ? fmt(nodes.reduce((a, n) => a + (n.trustScore ?? 0), 0) / nodes.length) : "—", color: C.green },
                  { label: "Countries",      value: [...new Set(nodes.map(n => n.country))].length || "—", color: C.cyan  },
                  { label: "Network Uptime", value: "99.8%",                                               color: C.green },
                ].map(s => (
                  <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: C.dim, fontFamily: "monospace" }}>{s.label}</span>
                    <span style={{ fontSize: 14, color: s.color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Event log */}
              <EventLog events={events} />
            </div>
          </div>

          {/* Footer */}
          <div style={{
            borderTop: `1px solid ${C.border}`,
            paddingTop: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 10,
            color: C.muted,
            fontFamily: "monospace",
          }}>
            <span>AuraGrid DePIN Network · Built at Lablab.ai Hackathon · Team: NickySantus, Abdoul Rahim, Ian Kusapali, Naimat Khan, Kamso Daniel.</span>
            <span style={{ color: C.cyan }}>Powered by Band AI · Ollama · Socket.IO · PostgreSQL</span>
          </div>
        </div>
      </div>
    </>
  );
}