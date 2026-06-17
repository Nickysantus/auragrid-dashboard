import { useState, useRef, useEffect } from "react";

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

// ── Play base64 audio chunks ───────────────────────────────────
async function playAudioChunks(chunks) {
  if (!chunks || chunks.length === 0) return;
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (const chunk of chunks) {
    const binary = atob(chunk);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const buffer = await audioCtx.decodeAudioData(bytes.buffer);
    await new Promise(resolve => {
      const src = audioCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(audioCtx.destination);
      src.onended = resolve;
      src.start();
    });
  }
}

// ── Speak a text string via TTS endpoint ──────────────────────
export async function speakText(text, lang = "en") {
  try {
    const res = await fetch(`${COORDINATOR}/api/ai/tts`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text, lang }),
    });
    const data = await res.json();
    await playAudioChunks(data.audioChunksBase64);
  } catch (err) {
    console.error("[VoiceAgent] TTS error:", err);
  }
}

// ── Pulse ring animation ───────────────────────────────────────
function PulseRing({ color, active }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {active && (
        <span style={{
          position: "absolute",
          inset: -6,
          borderRadius: "50%",
          border: `2px solid ${color}`,
          opacity: 0.5,
          animation: "voicePing 1s ease-in-out infinite",
        }} />
      )}
    </span>
  );
}

// ── Main VoiceAgent component ──────────────────────────────────
export default function VoiceAgent({ aiNarration, nodes }) {
  const [mode,       setMode]       = useState("idle");   // idle | listening | thinking | speaking
  const [transcript, setTranscript] = useState("");
  const [reply,      setReply]      = useState("");
  const [open,       setOpen]       = useState(false);
  const [log,        setLog]        = useState([]);

  const mediaRef    = useRef(null);
  const chunksRef   = useRef([]);
  const prevNarRef  = useRef("");

  // Auto-narrate when aiNarration changes
  useEffect(() => {
    if (!aiNarration || aiNarration === prevNarRef.current) return;
    prevNarRef.current = aiNarration;
    setMode("speaking");
    addLog("announce", aiNarration);
    speakText(aiNarration).finally(() => setMode("idle"));
  }, [aiNarration]);

  function addLog(type, text) {
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setLog(l => [...l.slice(-30), { type, text, time }]);
  }

  // ── Start recording ────────────────────────────────────────
  async function startListening() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr     = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = handleRecordingStop;
      mr.start();
      mediaRef.current = mr;
      setMode("listening");
      addLog("user", "🎙 Listening...");
    } catch (err) {
      addLog("error", "Microphone access denied");
    }
  }

  // ── Stop recording ─────────────────────────────────────────
  function stopListening() {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
      mediaRef.current.stream.getTracks().forEach(t => t.stop());
    }
  }

  // ── Send to voice-chat endpoint ────────────────────────────
  async function handleRecordingStop() {
    setMode("thinking");
    const blob    = new Blob(chunksRef.current, { type: "audio/webm" });
    const form    = new FormData();
    form.append("audio", blob, "voice.webm");

    // Inject live network context as a hint for the LLM
    const networkSummary = nodes.length
      ? `Network has ${nodes.length} nodes. Online: ${nodes.filter(n => n.status === "ONLINE").length}. Unstable: ${nodes.filter(n => n.status === "UNSTABLE").length}. Countries: ${[...new Set(nodes.map(n => n.country))].length}.`
      : "";
    if (networkSummary) form.append("hint", networkSummary);

    try {
      const res  = await fetch(`${COORDINATOR}/api/ai/voice-chat`, {
        method: "POST",
        body:   form,
      });
      const data = await res.json();

      setTranscript(data.userText  || "");
      setReply(     data.agentText || "");
      addLog("user",  `You: ${data.userText}`);
      addLog("agent", `AuraGrid: ${data.agentText}`);

      setMode("speaking");
      await playAudioChunks(data.audioChunksBase64);
    } catch (err) {
      addLog("error", `Voice chat error: ${err.message}`);
      setReply("Sorry, I couldn't reach the voice agent.");
    } finally {
      setMode("idle");
    }
  }

  // ── Button press: toggle listen/stop ──────────────────────
  function handleMicPress() {
    if (mode === "listening") {
      stopListening();
    } else if (mode === "idle") {
      startListening();
    }
  }

  const micColor = {
    idle:      C.cyan,
    listening: C.red,
    thinking:  C.amber,
    speaking:  C.green,
  }[mode];

  const micLabel = {
    idle:      "Ask AuraGrid",
    listening: "Tap to send",
    thinking:  "Thinking...",
    speaking:  "Speaking...",
  }[mode];

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

      {/* Floating button */}
      <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 999, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>

        {/* Expanded panel */}
        {open && (
          <div style={{
            background: C.surface,
            border: `1px solid ${micColor}44`,
            borderRadius: 16,
            padding: 20,
            width: 300,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            boxShadow: `0 8px 32px ${C.bg}CC`,
            animation: "slideIn 0.2s ease",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🎙</span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: C.text, fontSize: 14 }}>
                  Voice Agent
                </span>
              </div>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                color: micColor, textTransform: "uppercase", letterSpacing: 1,
              }}>
                {mode}
              </span>
            </div>

            {/* Transcript */}
            {transcript && (
              <div style={{ background: C.bg, borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginBottom: 4 }}>YOU SAID</div>
                <div style={{ fontSize: 12, color: C.text, fontFamily: "'JetBrains Mono', monospace" }}>{transcript}</div>
              </div>
            )}

            {/* Reply */}
            {reply && (
              <div style={{ background: `${C.cyan}11`, border: `1px solid ${C.cyan}33`, borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginBottom: 4 }}>AURAGRID</div>
                <div style={{ fontSize: 12, color: C.cyan, fontFamily: "'JetBrains Mono', monospace" }}>{reply}</div>
              </div>
            )}

            {/* Log */}
            <div style={{
              maxHeight: 120, overflowY: "auto",
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              {log.slice().reverse().map((l, i) => (
                <div key={i} style={{
                  color: l.type === "agent" ? C.cyan : l.type === "error" ? C.red : l.type === "announce" ? C.amber : C.dim,
                }}>
                  <span style={{ color: C.muted }}>{l.time} </span>{l.text}
                </div>
              ))}
              {log.length === 0 && (
                <div style={{ color: C.muted }}>Voice events will appear here...</div>
              )}
            </div>

            {/* Mic button inside panel */}
            <button
              onClick={handleMicPress}
              disabled={mode === "thinking" || mode === "speaking"}
              style={{
                background: mode === "listening" ? `${C.red}22` : `${C.cyan}11`,
                border: `1px solid ${micColor}66`,
                borderRadius: 10,
                color: micColor,
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 13,
                padding: "10px 0",
                cursor: mode === "thinking" || mode === "speaking" ? "not-allowed" : "pointer",
                width: "100%",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span style={{
                fontSize: 18,
                display: "inline-block",
                animation: mode === "thinking" ? "voiceSpin 1s linear infinite" : "none",
              }}>
                {mode === "listening" ? "⏹" : mode === "thinking" ? "⚙️" : mode === "speaking" ? "🔊" : "🎙"}
              </span>
              {micLabel}
            </button>
          </div>
        )}

        {/* FAB toggle button */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: 56, height: 56,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${micColor}22, ${C.surface})`,
            border: `2px solid ${micColor}88`,
            color: micColor,
            fontSize: 24,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
            transition: "border-color 0.3s",
            boxShadow: `0 4px 20px ${micColor}33`,
          }}
        >
          <PulseRing color={micColor} active={mode === "listening" || mode === "speaking"} />
          {open ? "✕" : mode === "speaking" ? "🔊" : mode === "listening" ? "⏹" : "🎙"}
        </button>
      </div>
    </>
  );
}
