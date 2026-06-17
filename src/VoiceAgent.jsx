import { useState, useRef, useEffect, useCallback } from "react";

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
  if (!chunks || chunks.length === 0) return;

  // Lazily instantiate a single shared window AudioContext
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  // Resume context if browser suspended it due to user interaction policies
  if (sharedAudioCtx.state === "suspended") {
    await sharedAudioCtx.resume();
  }

  stopCurrentAudio();

  for (const chunk of chunks) {
    const binary = atob(chunk);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    const buffer = await sharedAudioCtx.decodeAudioData(bytes.buffer);
    
    await new Promise((resolve, reject) => {
      const src = sharedAudioCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(sharedAudioCtx.destination);
      activeAudioSource = src;
      
      src.onended = () => {
        if (activeAudioSource === src) activeAudioSource = null;
        resolve();
      };
      
      src.onerror = (err) => {
        reject(err);
      };
      
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
    if (data.audioChunksBase64) {
      await playAudioChunks(data.audioChunksBase64);
    }
  } catch (err) {
    console.error("[VoiceAgent] TTS error:", err);
    throw err;
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
  const playbackIdRef = useRef(0);

  const addLog = useCallback((type, text) => {
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setLog(l => [...l.slice(-30), { type, text, time }]);
  }, []);

  // Auto-narrate when aiNarration context updates from dashboard
  useEffect(() => {
    if (!aiNarration || aiNarration === prevNarRef.current) return;
    prevNarRef.current = aiNarration;

    // Interrupt any voice chats currently reading out when system alert drops
    stopCurrentAudio();
    
    const currentPlaybackId = ++playbackIdRef.current;
    setMode("speaking");
    addLog("announce", aiNarration);

    speakText(aiNarration)
      .catch((err) => console.error("Auto narration playback error:", err))
      .finally(() => {
        // Only return to idle if a newer narration cycle hasn't taken over
        if (playbackIdRef.current === currentPlaybackId) {
          setMode("idle");
        }
      });
  }, [aiNarration, addLog]);

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
      stopCurrentAudio(); // Mute background AI talk if user wants to speak
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr     = new MediaRecorder(stream, { mimeType: "audio/webm" });
      
      chunksRef.current = [];
      mr.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = handleRecordingStop;
      
      mr.start(250); // Slice data buffers smoothly
      mediaRef.current = mr;
      setMode("listening");
      addLog("user", "🎙 Listening...");
    } catch (err) {
      console.error(err);
      addLog("error", "Microphone access denied or unsupported");
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
    const currentPlaybackId = ++playbackIdRef.current;
    
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const form = new FormData();
    form.append("audio", blob, "voice.webm");

    // Inject live dashboard metrics directly to system prompt context 
    const currentNodes = nodes || [];
    const onlineCount = currentNodes.filter(n => n.status === "ONLINE").length;
    const unstableCount = currentNodes.filter(n => n.status === "UNSTABLE").length;
    const uniqueCountries = [...new Set(currentNodes.map(n => n.country || "").filter(Boolean))].length;

    const networkSummary = currentNodes.length
      ? `Network context status: Total nodes registered is ${currentNodes.length}. Active online count is ${onlineCount}. Unstable power count is ${unstableCount}. Spread across ${uniqueCountries} regions globally.`
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
        setMode("idle");
      }
    }
  }

  function handleMicPress() {
    if (mode === "listening") {
      stopListening();
    } else if (mode === "idle") {
      startListening();
    }
  }

  const micColor = {
    idle:       C.cyan,
    listening:  C.red,
    thinking:   C.amber,
    speaking:   C.green,
  }[mode] || C.cyan;

  const micLabel = {
    idle:       "Ask AuraGrid",
    listening:  "Tap to send",
    thinking:   "Analyzing context...",
    speaking:   "Speaking...",
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

      {/* Floating Widget interface layout */}
      <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 999, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>

        {/* Expanded Telemetry logs and chat logs panel */}
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
            {/* Header section layout */}
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

            {/* Transcript render container */}
            {transcript && (
              <div style={{ background: C.bg, borderRadius: 8, padding: "8px 12px", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginBottom: 4 }}>DECODED INPUT</div>
                <div style={{ fontSize: 12, color: C.text, fontFamily: "'JetBrains Mono', monospace", lineHeight: "1.4" }}>{transcript}</div>
              </div>
            )}

            {/* AI Agent Answer container */}
            {reply && (
              <div style={{ background: `${C.cyan}0b`, border: `1px solid ${C.cyan}22`, borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginBottom: 4 }}>ROUTER FEEDBACK</div>
                <div style={{ fontSize: 12, color: C.cyan, fontFamily: "'JetBrains Mono', monospace", lineHeight: "1.4" }}>{reply}</div>
              </div>
            )}

            {/* Agent stream and context event logs */}
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

            {/* Primary Action Button */}
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

        {/* Root Floating FAB control button layout element */}
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