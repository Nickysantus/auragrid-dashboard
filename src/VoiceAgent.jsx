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

// Audio helpers
let sharedAudioCtx = null;
let activeAudioSource = null;

function stopCurrentAudio() {
  if (activeAudioSource) {
    try { activeAudioSource.stop(); } catch {}
    activeAudioSource = null;
  }
}

async function playAudioChunks(chunks) {
  if (!chunks?.length) return;
  if (!sharedAudioCtx) sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (sharedAudioCtx.state === "suspended") await sharedAudioCtx.resume();

  for (const chunk of chunks) {
    try {
      const binary = atob(chunk);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const buffer = await sharedAudioCtx.decodeAudioData(bytes.buffer);

      const src = sharedAudioCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(sharedAudioCtx.destination);
      activeAudioSource = src;
      await new Promise(r => { src.onended = r; src.start(); });
    } catch (e) { console.error(e); }
  }
}

// ── Main VoiceAgent ─────────────────────────────────────────────
export default function VoiceAgent({ aiNarration, nodes }) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState("idle"); // idle | listening | thinking | speaking
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState([]);

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const narrationQueueRef = useRef([]);
  const isDrainingRef = useRef(false);

  const addLog = (type, text) => {
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setLog(l => [...l.slice(-30), { type, text, time }]);
  };

  // Auto-narration from dashboard
  useEffect(() => {
    if (aiNarration) {
      narrationQueueRef.current.push(aiNarration);
      drainQueue();
    }
  }, [aiNarration]);

  const drainQueue = async () => {
    if (isDrainingRef.current) return;
    isDrainingRef.current = true;

    while (narrationQueueRef.current.length > 0) {
      const text = narrationQueueRef.current.shift();
      setMode("speaking");
      try {
        await speakText(text);
      } catch {}
    }
    isDrainingRef.current = false;
    setMode("idle");
  };

  async function speakText(text) {
    try {
      const res = await fetch(`${COORDINATOR}/api/ai/voice-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          hint: nodes?.length 
            ? `Live: ${nodes.length} nodes. ${nodes.filter(n => n.status === "ONLINE").length} online.` 
            : "Network is operational."
        }),
      });

      const data = await res.json();
      if (data.agentText) setReply(data.agentText);
      if (data.audioChunksBase64) await playAudioChunks(data.audioChunksBase64);
    } catch (err) {
      console.error(err);
      setReply("Sorry, voice agent unavailable.");
    }
  }

  // Text Send
  const handleTextSend = async () => {
    if (!input.trim() || isLoading) return;
    setIsLoading(true);
    setMode("thinking");

    await speakText(input.trim());

    setInput("");
    setIsLoading(false);
    setMode("idle");
  };

  // Voice Recording (kept from your original)
  async function startListening() {
    stopCurrentAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = e => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = handleRecordingStop;
      mr.start(250);
      mediaRef.current = mr;
      setMode("listening");
      addLog("user", "🎙 Listening...");
    } catch (err) {
      addLog("error", "Microphone access denied");
    }
  }

  function stopListening() {
    if (mediaRef.current) {
      mediaRef.current.stop();
      mediaRef.current.stream.getTracks().forEach(t => t.stop());
    }
  }

  async function handleRecordingStop() {
    setMode("thinking");
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const form = new FormData();
    form.append("audio", blob, "voice.webm");

    const hint = nodes?.length 
      ? `Live snapshot: ${nodes.length} nodes.` 
      : "Network is operational.";

    form.append("hint", hint);

    try {
      const res = await fetch(`${COORDINATOR}/api/ai/voice-chat`, { method: "POST", body: form });
      const data = await res.json();

      setTranscript(data.userText || "Voice input");
      setReply(data.agentText || "Processing...");

      addLog("user", `You: ${data.userText}`);
      addLog("agent", `AuraGrid: ${data.agentText}`);

      if (data.audioChunksBase64) await playAudioChunks(data.audioChunksBase64);
    } catch (err) {
      addLog("error", "Voice chat failed");
    } finally {
      setMode("idle");
    }
  }

  const handleMicPress = () => {
    if (mode === "listening") stopListening();
    else if (mode === "idle" || mode === "speaking") startListening();
  };

  return (
    <>
      <style>{`
        @keyframes voicePing { 0%,100% { transform: scale(1); opacity:0.5; } 50% { transform:scale(1.5); opacity:0; } }
      `}</style>

      <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 1000, width: "min(92vw, 560px)" }}>
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
        }}>
          {/* Text Input */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleTextSend()}
              placeholder="Type your question..."
              style={{
                flex: 1,
                background: "#1A2540",
                border: "none",
                borderRadius: 10,
                padding: "14px 16px",
                color: C.text,
                fontSize: 14,
              }}
            />
            <button onClick={handleTextSend} disabled={isLoading || !input.trim()}
              style={{ background: C.cyan, color: "#000", border: "none", borderRadius: 10, padding: "0 24px", fontWeight: 700 }}>
              Send
            </button>
          </div>

          {/* Mic Button */}
          <button
            onClick={handleMicPress}
            style={{
              width: "100%",
              padding: "14px",
              background: mode === "listening" ? C.red : C.cyan,
              color: "#000",
              border: "none",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            {mode === "listening" ? "⏹ Stop Recording" : "🎙 Speak"}
          </button>

          {reply && (
            <div style={{ marginTop: 12, padding: 12, background: "#00FF8822", borderRadius: 10, color: C.green }}>
              🤖 {reply}
            </div>
          )}
        </div>
      </div>
    </>
  );
}