import { useState, useRef, useEffect, useCallback } from "react";

// ── Unlock AudioContext on first user interaction ─────────────
let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  ctx.resume().then(() => {
    audioUnlocked = true;
    ctx.close();
  });
}

const COORDINATOR = "https://auragrid-coordinator.onrender.com";

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

// Singleton structure for running Audio contexts across re-renders
let sharedAudioCtx = null;
let activeAudioSource = null;

function stopCurrentAudio() {
  if (activeAudioSource) {
    try {
      activeAudioSource.stop();
    } catch (e) {
      // Already stopped
    }
    activeAudioSource = null;
  }
}

// ── Play base64 audio chunks safely ────────────────────────────
async function playAudioChunks(chunks) {
  unlockAudio();
  for (const chunk of chunks) {
    await new Promise((resolve) => {
      const audio = new Audio(`data:audio/mp3;base64,${chunk}`);
      audio.onended = resolve;
      audio.onerror = (e) => {
        console.warn("Audio chunk error:", e);
        resolve();
      };
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Audio play blocked:", err.message);
          resolve();
        });
      }
    });
  }
}

// ── Speak a text string via TTS endpoint ──────────────────────
export async function speakText(text) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/ai/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang: "en" }),
    });
    if (!res.ok) {
      console.warn("TTS backend error:", res.status, await res.text());
      return;
    }
    const data = await res.json();
    console.log("TTS chunks received:", data.audioChunksBase64?.length);
    if (data.audioChunksBase64?.length) {
      await playAudioChunks(data.audioChunksBase64);
    }
  } catch (err) {
    console.warn("TTS unavailable:", err.message);
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
export default function VoiceAgent({ aiNarration, hint, nodes }) {
  const [mode,       setMode]       = useState("idle");   // idle | listening | thinking | speaking | queued
  const [transcript, setTranscript] = useState("");
  const [reply,      setReply]      = useState("");
  const [open,       setOpen]       = useState(false);
  const [log,        setLog]        = useState([]);
  const [queueLen,   setQueueLen]   = useState(0);

  const mediaRef     = useRef(null);
  const chunksRef    = useRef([]);
  const prevNarRef   = useRef("");
  const playbackIdRef = useRef(0);
  
  <div
  onClick={unlockAudio}
  style={{
    background: C.surface,
    border: `1px solid ${expanded ? C.cyan : C.border}44`,
    borderRadius: 12,
    overflow: "hidden",
    transition: "border-color 0.3s",
  }}
></div>
  // ── Narration queue ─────────────────────────────────────────
  // Every new narration is pushed here instead of interrupting
  // whatever is currently playing. A single worker loop drains it
  // one at a time, so five migrations in 10s become five full
  // sentences spoken back to back, never overlapping or cut off.
  const narrationQueueRef = useRef([]);
  const isDrainingRef     = useRef(false);

  const addLog = useCallback((type, text) => {
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setLog(l => [...l.slice(-30), { type, text, time }]);
  }, []);

  const drainQueue = useCallback(async () => {
    if (isDrainingRef.current) return;
    isDrainingRef.current = true;

    while (narrationQueueRef.current.length > 0) {
      const next = narrationQueueRef.current.shift();
      setQueueLen(narrationQueueRef.current.length);
      setMode("speaking");
      addLog("announce", next);
      try {
        await speakText(next);
      } catch (err) {
        console.error("Queued narration playback error:", err);
      }
    }

    isDrainingRef.current = false;
    setMode("idle");
  }, [addLog]);

  // Auto-narrate when aiNarration context updates from dashboard.
  // Pushes onto the queue instead of calling stopCurrentAudio(),
  // so an in-progress sentence always finishes before the next starts.
  useEffect(() => {
    if (!aiNarration || aiNarration === prevNarRef.current) return;
    prevNarRef.current = aiNarration;

    narrationQueueRef.current.push(aiNarration);
    setQueueLen(narrationQueueRef.current.length);
    drainQueue();
  }, [aiNarration, drainQueue]);

  // Clean up recording hardware context on unmount
  useEffect(() => {
    return () => {
      stopCurrentAudio();
      if (mediaRef.current && mediaRef.current.state !== "inactive") {
        mediaRef.current.stop();
        mediaRef.current.stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // ── Start recording ────────────────────────────────────────
  async function startListening() {
    try {
      // User-initiated speech is the one case where we DO interrupt —
      // you don't want to wait through a 5-item narration backlog
      // just to ask a question.
      stopCurrentAudio();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr     = new MediaRecorder(stream, { mimeType: "audio/webm" });

      chunksRef.current = [];
      mr.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = handleRecordingStop;

      mr.start(250);
      mediaRef.current = mr;
      setMode("listening");
      addLog("user", "🎙 Listening...");
    } catch (err) {
      console.error(err);
      addLog("error", "Microphone access denied or unsupported");
    }
  }

  function stopListening() {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
      mediaRef.current.stream.getTracks().forEach(t => t.stop());
    }
  }

  // ── Send to voice-chat endpoint (Ollama/Phi3 powered) ──────
  // The "hint" field carries a live snapshot of node state so
  // Phi3's reply is grounded in what the network is doing right now,
  // not a stale or generic answer.
  async function handleRecordingStop() {
    setMode("thinking");
    const currentPlaybackId = ++playbackIdRef.current;

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const form = new FormData();
    form.append("audio", blob, "voice.webm");

    const currentNodes = nodes || [];
    const onlineCount = currentNodes.filter(n => n.status === "ONLINE").length;
    const unstableCount = currentNodes.filter(n => n.status === "UNSTABLE").length;
    const offlineCount = currentNodes.filter(n => n.status === "OFFLINE").length;
    const uniqueCountries = [...new Set(currentNodes.map(n => n.country || "").filter(Boolean))].length;
    const avgTrust = currentNodes.length
      ? (currentNodes.reduce((a, n) => a + (n.trustScore ?? 0), 0) / currentNodes.length).toFixed(1)
      : "0";

    // Most recent narration gives Phi3 context on "what just happened"
    // in addition to the raw counts below.
    const recentEvent = prevNarRef.current
      ? ` Most recent network event: "${prevNarRef.current}".`
      : "";

    const networkSummary = currentNodes.length
      ? `Live network snapshot: ${currentNodes.length} total nodes. ${onlineCount} online, ${unstableCount} unstable, ${offlineCount} offline. Average trust score ${avgTrust}. Spread across ${uniqueCountries} countries.${recentEvent}`
      : "Network status: Core network setup phase. Waiting for nodes to join cluster.";

    form.append("hint", networkSummary);

    try {
      const res = await fetch(`${COORDINATOR}/api/ai/voice-chat`, {
        method: "POST",
        body:   form,
      });

      if (!res.ok) throw new Error(`HTTP network error code ${res.status}`);

      const data = await res.json();

      const userTxt = data.userText || "User audio query submitted";
      const agentTxt = data.agentText || "Processing topology analysis query.";

      setTranscript(userTxt);
      setReply(agentTxt);

      addLog("user", `You: ${userTxt}`);
      addLog("agent", `AuraGrid: ${agentTxt}`);

      setMode("speaking");
      if (data.audioChunksBase64) {
        await playAudioChunks(data.audioChunksBase64);
      }
    } catch (err) {
      addLog("error", `Voice chat system failure: ${err.message}`);
      setReply("Sorry, I couldn't reach the global coordination agent.");
    } finally {
      if (playbackIdRef.current === currentPlaybackId) {
        // If narrations queued up while we were listening/thinking,
        // hand control back to the drain loop instead of forcing idle.
        if (narrationQueueRef.current.length > 0) {
          drainQueue();
        } else {
          setMode("idle");
        }
      }
    }
  }

  function handleMicPress() {
    if (mode === "listening") {
      stopListening();
    } else if (mode === "idle" || mode === "speaking") {
      startListening();
    }
  }

  const micColor = {
    idle:      C.cyan,
    listening: C.red,
    thinking:  C.amber,
    speaking:  C.green,
  }[mode] || C.cyan;

  const micLabel = {
    idle:      "Ask AuraGrid",
    listening: "Tap to send",
    thinking:  "Analyzing context...",
    speaking:  queueLen > 0 ? `Speaking... (${queueLen} queued)` : "Speaking...",
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
            background: C.surface,
            border: `1px solid ${micColor}44`,
            borderRadius: 16,
            padding: 20,
            width: 320,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            boxShadow: `0 12px 40px rgba(0,0,0,0.6)`,
            animation: "slideIn 0.2s ease",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>🎙</span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: C.text, fontSize: 14 }}>
                  AuraGrid Intelligence
                </span>
              </div>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                color: micColor, textTransform: "uppercase", letterSpacing: 1,
                fontWeight: "bold"
              }}>
                ● {mode}
              </span>
            </div>

            {queueLen > 0 && (
              <div style={{
                fontSize: 11, color: C.amber, fontFamily: "'JetBrains Mono', monospace",
                background: `${C.amber}11`, border: `1px solid ${C.amber}33`,
                borderRadius: 6, padding: "6px 10px",
              }}>
                ⏳ {queueLen} narration{queueLen > 1 ? "s" : ""} queued — finishing current sentence first
              </div>
            )}

            {transcript && (
              <div style={{ background: C.bg, borderRadius: 8, padding: "8px 12px", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginBottom: 4 }}>DECODED INPUT</div>
                <div style={{ fontSize: 12, color: C.text, fontFamily: "'JetBrains Mono', monospace", lineHeight: "1.4" }}>{transcript}</div>
              </div>
            )}

            {reply && (
              <div style={{ background: `${C.cyan}0b`, border: `1px solid ${C.cyan}22`, borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginBottom: 4 }}>ROUTER FEEDBACK (Phi3)</div>
                <div style={{ fontSize: 12, color: C.cyan, fontFamily: "'JetBrains Mono', monospace", lineHeight: "1.4" }}>{reply}</div>
              </div>
            )}

            <div style={{
              height: 110, overflowY: "auto",
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
              display: "flex", flexDirection: "column", gap: 6,
              background: "rgba(0,0,0,0.15)", padding: "6px 8px", borderRadius: 6
            }}>
              {log.slice().reverse().map((l, i) => (
                <div key={i} style={{
                  lineHeight: "1.3",
                  color: l.type === "agent" ? C.cyan : l.type === "error" ? C.red : l.type === "announce" ? C.amber : C.dim,
                }}>
                  <span style={{ color: C.muted }}>[{l.time}]</span> {l.text}
                </div>
              ))}
              {log.length === 0 && (
                <div style={{ color: C.muted, textAlign: "center", paddingTop: 40 }}>System idling... Node queries ready.</div>
              )}
            </div>

            <button
              onClick={handleMicPress}
              disabled={mode === "thinking"}
              style={{
                background: mode === "listening" ? `${C.red}18` : `${C.cyan}0f`,
                border: `1px solid ${micColor}88`,
                borderRadius: 10,
                color: micColor,
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 13,
                padding: "12px 0",
                cursor: mode === "thinking" ? "not-allowed" : "pointer",
                width: "100%",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span style={{
                fontSize: 16,
                display: "inline-block",
                animation: mode === "thinking" ? "voiceSpin 1s linear infinite" : "none",
              }}>
                {mode === "listening" ? "⏹" : mode === "thinking" ? "⚙️" : mode === "speaking" ? "🔊" : "🎙"}
              </span>
              {micLabel}
            </button>
          </div>
        )}

        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: 56, height: 56,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${micColor}15, ${C.surface})`,
            border: `2px solid ${micColor}`,
            color: micColor,
            fontSize: 22,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: `0 6px 24px ${micColor}25`,
          }}
        >
          <PulseRing color={micColor} active={mode === "listening" || mode === "speaking"} />
          {open ? "✕" : mode === "speaking" ? "🔊" : mode === "listening" ? "⏹" : "🎙"}
        </button>
      </div>
    </>
  );
}
