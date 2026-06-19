// AuraGridChat.jsx

import { useState, useRef, useEffect } from "react";

const COORDINATOR_URL = "https://auragrid-coordinator.onrender.com";

const SUGGESTED = [
  "Which node has the highest trust score?",
  "How many migrations happened today?",
  "Are there any unstable nodes right now?",
  "What is the network uptime?",
  "Which node has the lowest battery?",
];

const C = {
  bg:      "#080B14",
  surface: "#0D1220",
  border:  "#1A2540",
  cyan:    "#00F5FF",
  amber:   "#FFB800",
  green:   "#00FF88",
  dim:     "#8892A4",
  text:    "#E2E8F0",
};

export default function AuraGridChat({ nodes = [] }) {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi! I'm AuraGrid AI. Ask me anything about the network — nodes, migrations, battery levels, trust scores.",
    },
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Build a telemetry hint from live node data (same approach as VoiceAgent)
  function buildHint() {
    if (!nodes || nodes.length === 0) return "Network status: waiting for nodes.";
    const online   = nodes.filter(n => n.status === "ONLINE").length;
    const unstable = nodes.filter(n => n.status === "UNSTABLE").length;
    const offline  = nodes.filter(n => n.status === "OFFLINE").length;
    const avgTrust = (nodes.reduce((a, n) => a + (n.trustScore ?? 0), 0) / nodes.length).toFixed(1);
    const countries = [...new Set(nodes.map(n => n.country).filter(Boolean))].length;
    return `Live network: ${nodes.length} nodes total. ${online} online, ${unstable} unstable, ${offline} offline. Avg trust score ${avgTrust}. Spread across ${countries} countries.`;
  }

  async function sendMessage(text) {
    if (!text.trim() || loading) return;
    setMessages(prev => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      // Reuse the exact same endpoint VoiceAgent uses — just send text, no audio
      const form = new FormData();
      form.append("text", text);
      form.append("hint", buildHint());

      const res = await fetch(`${COORDINATOR_URL}/api/ai/voice-chat`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const data = await res.json();
      const reply = data.agentText || data.userText || "I couldn't get a response. Please try again.";

      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", text: "Couldn't reach the AuraGrid coordinator. Please try again shortly." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes chatPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Floating brain button — positioned to not overlap VoiceAgent mic */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Ask AuraGrid AI"
        style={{
          position: "fixed",
          bottom: 100,
          right: 28,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: open
            ? `${C.cyan}22`
            : `linear-gradient(135deg, ${C.cyan}22, ${C.surface})`,
          border: `2px solid ${C.cyan}`,
          color: C.cyan,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          boxShadow: `0 6px 24px ${C.cyan}25`,
          zIndex: 998,
          transition: "all 0.3s",
        }}
      >
        {open ? "✕" : "🧠"}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: "fixed",
          bottom: 164,
          right: 28,
          width: 340,
          maxHeight: 500,
          background: C.surface,
          border: `1px solid ${C.cyan}33`,
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          zIndex: 997,
          boxShadow: `0 12px 40px rgba(0,0,0,0.6)`,
          overflow: "hidden",
          animation: "slideUp 0.2s ease",
        }}>

          {/* Header */}
          <div style={{
            padding: "13px 16px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: C.bg,
          }}>
            <span style={{ fontSize: 18 }}>🧠</span>
            <div>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13, fontFamily: "'Space Grotesk', sans-serif" }}>
                AuraGrid AI
              </div>
              <div style={{ color: C.cyan, fontSize: 10, fontFamily: "monospace" }}>
                ● Powered by Phi3 · Live network data
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "84%",
                  padding: "9px 13px",
                  borderRadius: m.role === "user"
                    ? "14px 14px 4px 14px"
                    : "14px 14px 14px 4px",
                  background: m.role === "user" ? C.cyan : C.bg,
                  color: m.role === "user" ? C.bg : C.text,
                  fontSize: 12,
                  lineHeight: 1.6,
                  fontWeight: m.role === "user" ? 600 : 400,
                  fontFamily: m.role === "assistant" ? "'JetBrains Mono', monospace" : "inherit",
                  border: m.role === "assistant" ? `1px solid ${C.border}` : "none",
                }}>
                  {m.text}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{
                  padding: "9px 14px",
                  borderRadius: "14px 14px 14px 4px",
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  color: C.cyan,
                  fontSize: 12,
                  fontFamily: "monospace",
                }}>
                  Analysing network<span style={{ animation: "chatPulse 1s infinite" }}>...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested questions */}
          {messages.length === 1 && (
            <div style={{
              padding: "0 12px 10px",
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}>
              {SUGGESTED.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  style={{
                    background: "transparent",
                    border: `1px solid ${C.border}`,
                    borderRadius: 20,
                    color: C.dim,
                    fontSize: 10,
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontFamily: "monospace",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { e.target.style.borderColor = C.cyan; e.target.style.color = C.cyan; }}
                  onMouseLeave={e => { e.target.style.borderColor = C.border; e.target.style.color = C.dim; }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: "10px 12px",
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            gap: 8,
            background: C.bg,
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage(input)}
              placeholder="Ask about the network..."
              disabled={loading}
              style={{
                flex: 1,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 20,
                padding: "8px 14px",
                color: C.text,
                fontSize: 12,
                outline: "none",
                fontFamily: "monospace",
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              style={{
                background: input.trim() ? C.cyan : C.border,
                border: "none",
                borderRadius: "50%",
                width: 34,
                height: 34,
                cursor: input.trim() ? "pointer" : "default",
                color: input.trim() ? C.bg : C.dim,
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.2s",
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
