// VoiceAgent.jsx
// ROLE: Broadcasts network events, migrations and power failures out loud (narration only)
// Chat/Q&A is handled separately by AuraGridChat.jsx

import { useState, useRef, useEffect, useCallback } from "react";

let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  ctx.resume().then(() => { audioUnlocked = true; ctx.close(); });
}

const COORDINATOR = "https://auragrid-coordinator.onrender.com";

const C = {
  bg:      "#080B14",
  surface: "#0D1220",
  border:  "#1A2540",
  cyan:    "#00F5FF",
  amber:   "#FFB800",
  green:   "#00FF88",
  red:     "#FF3B3B",
  muted:   "#4A5568",
  text:    "#E2E8F0",
  dim:     "#8892A4",
};

async function playAudioChunks(chunks) {
  unlockAudio();
  for (const chunk of chunks) {
    await new Promise((resolve) => {
      const audio = new Audio(`data:audio/mp3;base64,${chunk}`);
      audio.onended = resolve;
      audio.onerror = () => resolve();
      const p = audio.play();
      if (p !== undefined) p.catch(() => resolve());
    });
  }
}

export async function speakText(text) {
  try {
    const res = await fetch(`${COORDINATOR}/api/ai/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang: "en" }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.audioChunksBase64?.length) await playAudioChunks(data.audioChunksBase64);
  } catch (err) {
    console.warn("TTS unavailable:", err.message);
  }
}

function PulseRing({ color, active }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {active && (
        <span style={{
          position: "absolute", inset: -6, borderRadius: "50%",
          border: `2px solid ${color}`, opacity: 0.5,
          animation: "voicePing 1s ease-in-out infinite",
        }} />
      )}
    </span>
  );
}

export default function VoiceAgent({ aiNarration, hint, nodes }) {
  const [mode,      setMode]      = useState("idle"); // idle | listening | thinking | speaking
  const [transcript,setTranscript]= useState("");
  const [reply,     setReply]     = useState("");
  const [open,      setOpen]      = useState(false);
  const [log,       setLog]       = useState([]);
  const [queueLen,  setQueueLen]  = useState(0);

  const mediaRef       = useRef(null);
  const prevNarRef     = useRef("");
  const narrationQueueRef = useRef([]);
  const isDrainingRef     = useRef(false);

  const addLog = useCallback((type, text) => {
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setLog(l => [...l.slice(-30), { type, text, time }]);
  }, []);

  // ── Drain narration queue (auto-broadcast) ─────────────────
  const drainQueue = useCallback(async () => {
    if (isDrainingRef.current) return;
    isDrainingRef.current = true;
    while (narrationQueueRef.current.length > 0) {
      const next = narrationQueueRef.current.shift();
      setQueueLen(narrationQueueRef.current.length);
      setMode("speaking");
      addLog("announce", next);
      try { await speakText(next); } catch (err) { console.error(err); }
    }
    isDrainingRef.current = false;
    setMode("idle");
  }, [addLog]);

  // ── Auto-broadcast whenever aiNarration changes ────────────
  useEffect(() => {
    if (!aiNarration || aiNarration === prevNarRef.current) return;
    prevNarRef.current = aiNarration;
    narrationQueueRef.current.push(aiNarration);
    setQueueLen(narrationQueueRef.current.length);
    drainQueue();
  }, [aiNarration, drainQueue]);

  useEffect(() => {
  const media = mediaRef.current;
  return () => {
    if (media && media.state !== "inactive") {
      media.stop();
      media.stream.getTracks().forEach(t => t.stop());
    }
  };
}, []);
  // ── Voice recording ────────────────────────────────────────
  async function startListening() {
  try {

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      addLog("error", "Speech recognition not supported — use Chrome");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setMode("listening");
    addLog("user", "🎙 Listening...");

    recognition.onresult = async (event) => {
      const spokenText = event.results[0][0].transcript;
      addLog("user", `You said: ${spokenText}`);
      setTranscript(spokenText);
      setMode("thinking");

      // Send spoken text directly to backend
      try {
        const res = await fetch(`${COORDINATOR}/api/ai/voice-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: spokenText,
            hint: hint || "",
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const agentTxt = data.agentText || "Processing query.";
        setReply(agentTxt);
        addLog("agent", `AuraGrid: ${agentTxt}`);

        setMode("speaking");
        if (data.audioChunksBase64) {
          await playAudioChunks(data.audioChunksBase64);
        }
      } catch (err) {
        addLog("error", `Error: ${err.message}`);
      } finally {
        setMode("idle");
      }
    };

    recognition.onerror = (event) => {
      addLog("error", `Mic error: ${event.error}`);
      setMode("idle");
    };

    recognition.onend = () => {
      if (mode === "listening") setMode("idle");
    };

    recognition.start();

  } catch (err) {
    addLog("error", "Microphone access denied");
    setMode("idle");
  }
}

  function handleMicPress() {
  if (mode === "idle") {
    startListening();
  }
}

  const micColor = {
    idle:     C.cyan,
    listening:C.red,
    thinking: C.amber,
    speaking: queueLen > 0 ? C.amber : C.green,
  }[mode] || C.cyan;

  const micLabel = {
    idle:     "Broadcast Report",
    listening:"Tap to send",
    thinking: "Analyzing...",
    speaking: queueLen > 0 ? `Broadcasting... (${queueLen} queued)` : "Broadcasting...",
  }[mode] || "Ready";

  return (
    <>
      <style>{`
        @keyframes voicePing {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50%       { transform: scale(1.5); opacity: 0; }
        }
        @keyframes voiceSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 999, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>

        {open && (
          <div style={{
            background: C.surface, border: `1px solid ${micColor}44`,
            borderRadius: 16, padding: 20, width: 320,
            display: "flex", flexDirection: "column", gap: 14,
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
            animation: "slideIn 0.2s ease",
          }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>📡</span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: C.text, fontSize: 14 }}>
                  Network Broadcaster
                </span>
              </div>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                color: micColor, textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold",
              }}>
                ● {mode}
              </span>
            </div>

            {/* Description */}
            <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", lineHeight: 1.5 }}>
              Auto-broadcasts power failures, migrations and network events out loud. Press mic to trigger a voice report.
            </div>

            {/* Queue indicator */}
            {queueLen > 0 && (
              <div style={{
                fontSize: 11, color: C.amber, fontFamily: "'JetBrains Mono', monospace",
                background: `${C.amber}11`, border: `1px solid ${C.amber}33`,
                borderRadius: 6, padding: "6px 10px",
              }}>
                ⏳ {queueLen} broadcast{queueLen > 1 ? "s" : ""} queued
              </div>
            )}

            {/* Last broadcast */}
            {transcript && (
              <div style={{ background: C.bg, borderRadius: 8, padding: "8px 12px", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginBottom: 4 }}>VOICE INPUT</div>
                <div style={{ fontSize: 12, color: C.text, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.4 }}>{transcript}</div>
              </div>
            )}

            {reply && (
              <div style={{ background: `${C.cyan}0b`, border: `1px solid ${C.cyan}22`, borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginBottom: 4 }}>BROADCAST REPORT</div>
                <div style={{ fontSize: 12, color: C.cyan, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.4 }}>{reply}</div>
              </div>
            )}

            {/* Event log */}
            <div style={{
              height: 110, overflowY: "auto",
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
              display: "flex", flexDirection: "column", gap: 6,
              background: "rgba(0,0,0,0.15)", padding: "6px 8px", borderRadius: 6,
            }}>
              {log.slice().reverse().map((l, i) => (
                <div key={i} style={{
                  lineHeight: 1.3,
                  color: l.type === "agent" ? C.cyan : l.type === "error" ? C.red : l.type === "announce" ? C.amber : C.dim,
                }}>
                  <span style={{ color: C.muted }}>[{l.time}]</span> {l.text}
                </div>
              ))}
              {log.length === 0 && (
                <div style={{ color: C.muted, textAlign: "center", paddingTop: 36 }}>
                  Monitoring network... events will broadcast automatically.
                </div>
              )}
            </div>

            {/* Mic button */}
            <button
              onClick={handleMicPress}
              disabled={mode === "thinking"}
              style={{
                background: mode === "listening" ? `${C.red}18` : `${C.cyan}0f`,
                border: `1px solid ${micColor}88`,
                borderRadius: 10, color: micColor,
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700, fontSize: 13, padding: "12px 0",
                cursor: mode === "thinking" ? "not-allowed" : "pointer",
                width: "100%", transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <span style={{
                fontSize: 16, display: "inline-block",
                animation: mode === "thinking" ? "voiceSpin 1s linear infinite" : "none",
              }}>
                {mode === "listening" ? "⏹" : mode === "thinking" ? "⚙️" : mode === "speaking" ? "🔊" : "🎙"}
              </span>
              {micLabel}
            </button>
          </div>
        )}

        {/* Floating mic button */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: 56, height: 56, borderRadius: "50%",
            background: `linear-gradient(135deg, ${micColor}15, ${C.surface})`,
            border: `2px solid ${micColor}`, color: micColor,
            fontSize: 22, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: `0 6px 24px ${micColor}25`,
          }}
        >
          <PulseRing color={micColor} active={mode === "listening" || mode === "speaking"} />
          {open ? "✕" : mode === "speaking" ? "🔊" : mode === "listening" ? "⏹" : "📡"}
        </button>
      </div>
    </>
  );
}
