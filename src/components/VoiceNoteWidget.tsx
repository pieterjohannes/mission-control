"use client";
import { useState, useRef } from "react";

type State = "idle" | "recording" | "uploading" | "done" | "error";

export default function VoiceNoteWidget() {
  const [state, setState] = useState<State>("idle");
  const [transcript, setTranscript] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [createTask, setCreateTask] = useState(true);
  const [ticktickMsg, setTicktickMsg] = useState("");
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [open, setOpen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(t => t.stop());
        transcribeBlob(blob, "recording.webm");
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setState("recording");
    } catch {
      setError("Microphone access denied");
      setState("error");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setState("uploading");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    transcribeBlob(file, file.name);
  }

  async function transcribeBlob(blob: Blob, filename: string) {
    setState("uploading");
    setError("");
    setTranscript("");
    setTicktickMsg("");

    const fd = new FormData();
    fd.append("audio", blob, filename);
    fd.append("createTask", String(createTask));
    if (taskTitle.trim()) fd.append("taskTitle", taskTitle.trim());

    try {
      const res = await fetch("/api/voice-transcribe", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Transcription failed");
        setState("error");
        return;
      }
      setTranscript(data.transcript || "");
      if (data.ticktick) {
        setTicktickMsg(data.ticktick.ok
          ? `✅ TickTick task created`
          : `⚠️ TickTick: ${data.ticktick.error}`
        );
      }
      setState("done");
      // Pre-fill task title with transcript for next time
      if (data.transcript) setTaskTitle(data.transcript.slice(0, 80));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError(msg);
      setState("error");
    }
  }

  function reset() {
    setState("idle");
    setTranscript("");
    setError("");
    setTicktickMsg("");
    setTaskTitle("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-all duration-200"
        title="Voice Note → Transcribe → TickTick"
      >
        🎙️ Voice Note
      </button>
    );
  }

  return (
    <div className="mx-2 mb-3 p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-purple-300 font-semibold text-sm">🎙️ Voice Note</span>
        <button onClick={() => { setOpen(false); reset(); }} className="text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
      </div>

      {state === "idle" || state === "error" ? (
        <>
          <div className="flex gap-2 mb-2">
            <button
              onClick={startRecording}
              className="flex-1 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-xs font-medium transition"
            >
              🔴 Record
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-medium transition"
            >
              📁 Upload
            </button>
            <input ref={fileInputRef} type="file" accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg" onChange={handleFileChange} className="hidden" />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <input
              type="checkbox"
              id="vn-task"
              checked={createTask}
              onChange={e => setCreateTask(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="vn-task" className="text-gray-400">Create TickTick task</label>
          </div>
          {error && <p className="text-red-400 mt-1">{error}</p>}
        </>
      ) : state === "recording" ? (
        <div className="text-center py-2">
          <div className="text-red-400 animate-pulse text-lg mb-2">⏺ Recording...</div>
          <button
            onClick={stopRecording}
            className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-xs font-medium"
          >
            ⏹ Stop
          </button>
        </div>
      ) : state === "uploading" ? (
        <div className="text-center py-3 text-gray-400 animate-pulse">
          ✨ Transcribing...
        </div>
      ) : state === "done" ? (
        <>
          <div className="bg-black/20 rounded-lg p-2 mb-2 text-gray-200 leading-relaxed max-h-32 overflow-y-auto">
            {transcript || "(empty transcript)"}
          </div>
          {ticktickMsg && <p className="text-green-400 mb-2">{ticktickMsg}</p>}
          <button onClick={reset} className="w-full py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-xs transition">
            🔄 New recording
          </button>
        </>
      ) : null}
    </div>
  );
}
