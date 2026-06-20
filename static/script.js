const recordBtn = document.getElementById("recordBtn");
const recordLabel = document.getElementById("recordLabel");
const recordStatus = document.getElementById("recordStatus");
const recordTimer = document.getElementById("recordTimer");
const transcriptBox = document.getElementById("transcriptBox");
const wordCount = document.getElementById("wordCount");
const summarizeBtn = document.getElementById("summarizeBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");
const errorMsg = document.getElementById("errorMsg");
const audioUpload = document.getElementById("audioUpload");
const uploadFileName = document.getElementById("uploadFileName");

const loadingEl = document.getElementById("loading");
const loadingText = document.getElementById("loadingText");
const resultsEl = document.getElementById("results");
const emptyState = document.getElementById("emptyState");

const MAX_FILE_MB = 25;

let recognition = null;
let isRecording = false;
let timerInterval = null;
let timerSeconds = 0;
let currentNotes = null;
let currentTranscript = "";

// ---------- Word count ----------
transcriptBox.addEventListener("input", updateWordCount);

function updateWordCount() {
  const words = transcriptBox.value.trim().split(/\s+/).filter(Boolean).length;
  wordCount.textContent = `${words} word${words !== 1 ? "s" : ""}`;
}

// ---------- Recording timer ----------
function startTimer() {
  timerSeconds = 0;
  recordTimer.classList.remove("hidden");
  timerInterval = setInterval(() => {
    timerSeconds++;
    const m = Math.floor(timerSeconds / 60);
    const s = String(timerSeconds % 60).padStart(2, "0");
    recordTimer.textContent = `${m}:${s}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  recordTimer.classList.add("hidden");
}

// ---------- Live speech-to-text via the browser's Web Speech API ----------
function setupRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";

  let finalTranscript = transcriptBox.value ? transcriptBox.value + " " : "";

  rec.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += text + " ";
      } else {
        interim += text;
      }
    }
    transcriptBox.value = (finalTranscript + interim).trim();
    updateWordCount();
  };

  rec.onerror = (e) => {
    showError("Speech recognition error: " + e.error);
    stopRecording();
  };

  rec.onend = () => {
    if (isRecording) rec.start();
  };

  return rec;
}

function startRecording() {
  recognition = setupRecognition();
  if (!recognition) {
    showError("Your browser doesn't support live speech recognition. Try Chrome/Edge, or upload an audio file instead.");
    return;
  }
  clearError();
  isRecording = true;
  recognition.start();
  startTimer();
  recordBtn.classList.add("recording");
  recordLabel.textContent = "Stop Recording";
  recordStatus.textContent = "Listening...";
}

function stopRecording() {
  isRecording = false;
  if (recognition) recognition.stop();
  stopTimer();
  recordBtn.classList.remove("recording");
  recordLabel.textContent = "Start Recording";
  recordStatus.textContent = "Idle";
}

recordBtn.addEventListener("click", () => {
  if (isRecording) stopRecording();
  else startRecording();
});

// ---------- Audio file upload -> server-side Whisper transcription ----------
audioUpload.addEventListener("change", async () => {
  const file = audioUpload.files[0];
  if (!file) return;

  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    showError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_FILE_MB} MB.`);
    audioUpload.value = "";
    uploadFileName.textContent = "";
    return;
  }

  uploadFileName.textContent = `Selected: ${file.name}`;
  clearError();

  const formData = new FormData();
  formData.append("audio", file);

  showLoading("Transcribing audio...");
  try {
    const res = await fetch("/api/transcribe", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Transcription failed");
    transcriptBox.value = data.transcript;
    updateWordCount();
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
});

// ---------- Summarize ----------
summarizeBtn.addEventListener("click", async () => {
  const transcript = transcriptBox.value.trim();
  clearError();

  if (!transcript) {
    showError("Please record, upload, or paste a transcript first.");
    return;
  }
  if (isRecording) stopRecording();

  showLoading("Generating summary...");
  resultsEl.classList.add("hidden");
  emptyState.classList.add("hidden");
  downloadBtn.classList.add("hidden");

  try {
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Summarization failed");
    currentNotes = data.notes;
    currentTranscript = transcript;
    renderNotes(data.notes, transcript);
  } catch (err) {
    showError(err.message);
    emptyState.classList.remove("hidden");
  } finally {
    hideLoading();
  }
});

// ---------- Clear / Reset ----------
clearBtn.addEventListener("click", () => {
  if (isRecording) stopRecording();
  transcriptBox.value = "";
  updateWordCount();
  clearError();
  resultsEl.classList.add("hidden");
  emptyState.classList.remove("hidden");
  downloadBtn.classList.add("hidden");
  uploadFileName.textContent = "";
  audioUpload.value = "";
  currentNotes = null;
  currentTranscript = "";
});

// ---------- Copy buttons ----------
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".copy-btn");
  if (!btn) return;
  const targetId = btn.dataset.target;
  const el = document.getElementById(targetId);
  if (!el) return;
  const text = el.tagName === "UL"
    ? [...el.querySelectorAll("li")].map((li) => `• ${li.textContent}`).join("\n")
    : el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = "✓";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copied");
    }, 1500);
  });
});

// ---------- Download as Markdown ----------
downloadBtn.addEventListener("click", () => {
  if (!currentNotes) return;
  const n = currentNotes;
  const lines = [
    `# ${n.title || "Notes"}`,
    "",
    "## Summary",
    n.summary || "",
    "",
    "## Key Points",
    ...(n.key_points || []).map((p) => `- ${p}`),
    "",
    "## Action Items",
    ...(n.action_items && n.action_items.length
      ? n.action_items.map((a) => `- [ ] ${a}`)
      : ["- None"]),
    "",
    "## Full Transcript",
    currentTranscript,
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(n.title || "notes").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
  a.click();
  URL.revokeObjectURL(url);
});

// ---------- Render ----------
function renderNotes(notes, transcript) {
  document.getElementById("noteTitle").textContent = notes.title || "Notes";
  document.getElementById("summaryText").textContent = notes.summary || "";
  document.getElementById("fullTranscript").textContent = transcript;

  const kp = document.getElementById("keyPoints");
  kp.innerHTML = "";
  (notes.key_points || []).forEach((point) => {
    const li = document.createElement("li");
    li.textContent = point;
    kp.appendChild(li);
  });
  if (!notes.key_points || notes.key_points.length === 0) {
    kp.innerHTML = "<li><em>None identified</em></li>";
  }

  const ai = document.getElementById("actionItems");
  ai.innerHTML = "";
  (notes.action_items || []).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    ai.appendChild(li);
  });
  if (!notes.action_items || notes.action_items.length === 0) {
    ai.innerHTML = "<li><em>None identified</em></li>";
  }

  resultsEl.classList.remove("hidden");
  downloadBtn.classList.remove("hidden");
}

function showLoading(text) {
  loadingText.textContent = text;
  loadingEl.classList.remove("hidden");
}
function hideLoading() {
  loadingEl.classList.add("hidden");
}
function showError(msg) {
  errorMsg.textContent = msg;
}
function clearError() {
  errorMsg.textContent = "";
}
