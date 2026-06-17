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
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
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

      await new Promise(resolve => {
        src.onended = resolve;
        src.start();
      });
    } catch (e) {
      console.error("Audio chunk failed:", e);
    }
  }
}

export default function VoiceAgent({ aiNarration, nodes }) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [mode, setMode] = useState("idle");

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const narrationQueueRef = useRef([]);
  const isDrainingRef = useRef(false);

  // Drain narration queue
  const drainQueue = useCallback(async () => {
    if (isDrainingRef.current) return;
    isDrainingRef.current = true;

    while (narrationQueueRef.current.length > 0) {
      const text = narrationQueueRef.current.shift();
      setMode("speaking");
      try {
        await speakText(text);
      } catch (e) {}
    }
    isDrainingRef.current = false;
    setMode("idle");
  }, []);

  // Auto-narrate when dashboard sends new aiNarration
  useEffect(() => {
    if (!aiNarration) return;
    narrationQueueRef.current.push(aiNarration);
    drainQueue();
  }, [aiNarration, drainQueue]);

  async function speakText(text) {
    try {
      const res = await fetch(`${COORDINATOR}/api/ai/voice-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          hint: nodes?.length 
            ? `Live network: ${nodes.length} nodes, ${nodes.filter(n => n.status === "ONLINE").length} online.` 
            : "Network is operational."
        }),
      });

      const data = await res.json();
      if (data.agentText) setReply(data.agentText);
      if (data.audioChunksBase64) await playAudioChunks(data.audioChunksBase64);
    } catch (err) {
      console.error(err);
      setReply("Voice agent temporarily unavailable.");
    }
  }

  const handleTextSend = async () => {
    if (!input.trim() || isLoading) return;
    setIsLoading(true);
    setMode("thinking");

    await speakText(input.trim());

    setInput("");
    setIsLoading(false);
    setMode("idle");
  };

  // Voice recording
  async function startListening() {
    stopCurrentAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = e => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = handleRecordingStop;
      mr.start(250);
      mediaRef.current = mr;
      setMode("listening");
    } catch (err) {
      console.error(err);
      setMode("idle");
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
    form.append("audio", blob);

    const hint = nodes?.length 
      ? `Live: ${nodes.length} nodes.` 
      : "Network operational.";

    form.append("hint", hint);

    try {
      const res = await fetch(`${COORDINATOR}/api/ai/voice-chat`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();

      if (data.agentText) setReply(data.agentText);
      if (data.audioChunksBase64) await playAudioChunks(data.audioChunksBase64);
    } catch (err) {
      console.error(err);
      setReply("Could not process voice input.");
    } finally {
      setMode("idle");
    }
  }

  const handleMicPress = () => {
    if (mode === "listening") stopListening();
    else if (mode === "idle" || mode === "speaking") startListening();
  };

  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 1000,
      width: "min(92vw, 560px)",
    }}>
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
            placeholder="Type your question... (e.g. network status?)"
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
          <button 
            onClick={handleTextSend} 
            disabled={isLoading || !input.trim()}
            style={{
              background: C.cyan,
              color: "#000",
              border: "none",
              borderRadius: 10,
              padding: "0 28px",
              fontWeight: 700,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "..." : "Send"}
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
          {mode === "listening" ? "⏹ Stop & Send" : "🎙 Speak to AuraGrid"}
        </button>

        {reply && (
          <div style={{
            marginTop: 12,
            padding: 14,
            background: "#00FF8822",
            borderRadius: 10,
            color: C.green,
            fontSize: 13.5,
            lineHeight: 1.5,
          }}>
            🤖 {reply}
          </div>
        )}
      </div>
    </div>
  );
}