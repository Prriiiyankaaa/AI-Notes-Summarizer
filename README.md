# 🎙️ Notes Summarizer

> Turn your voice into structured, actionable notes — instantly.

**[▶ Try it live](https://ai-notes-summarizer-b3mk.onrender.com)**

Speak into your mic, upload an audio file, or paste a transcript. The app transcribes your speech and uses AI to generate a clean title, summary, key points, and action items — no sign-up required.

---

## How it works

**Step 1 — Get a transcript**

| Option | How |
|--------|-----|
| 🎤 Live mic | Click **Start Recording** — browser transcribes speech instantly (Chrome/Edge) |
| 📁 Upload file | Pick an audio file → backend sends it to Groq Whisper → transcript returned |
| ✏️ Type / paste | Skip audio entirely and type directly into the transcript box |

**Step 2 — Review & edit**
The transcript appears in an editable box. Fix any errors before moving on — better input = better notes.

**Step 3 — Generate summary**
Click **✨ Generate Summary**. The transcript is sent to Groq's Llama 3.3 70B, which returns structured notes in seconds.

**Step 4 — Use your notes**
Copy individual sections, or click **⬇ Download** to save everything as a Markdown file.

---

## Features

- **Record live** with one click — auto-restarts if the browser cuts off mid-session
- **Upload any audio file** up to 25 MB — transcribed server-side via Groq Whisper
- **Paste or type** directly — no audio required
- **Structured AI notes** — title, summary, key points, and action items every time
- **Copy buttons** on every output section
- **Download as Markdown** — exports a `.md` file with action item checkboxes
- **Live word count** and **recording timer**
- **Clear/reset** in one click

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, Flask, Gunicorn |
| Frontend | Vanilla HTML / CSS / JS — no build step |
| Speech-to-text | Browser Web Speech API (live) + Groq Whisper `whisper-large-v3-turbo` (uploads) |
| Summarization | Groq `llama-3.3-70b-versatile` (JSON mode) |
| Hosting | [Render](https://render.com) free tier |

---

## Project structure

```
notes-summarizer/
├── app.py              # Flask backend — API routes & Groq calls
├── requirements.txt
├── Procfile            # gunicorn start command
├── render.yaml         # Render.com deploy config
├── .env.example        # copy to .env and add your key
├── templates/
│   └── index.html      # single-page UI
└── static/
    ├── style.css
    └── script.js       # recording, upload, fetch calls, rendering
```

---

## Local setup

**1. Get a free Groq API key**
→ [console.groq.com/keys](https://console.groq.com/keys)

**2. Clone and install**
```bash
git clone <your-repo-url>
cd notes-summarizer
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

**3. Configure your key**
```bash
cp .env.example .env
# open .env and paste your GROQ_API_KEY
```

**4. Run**
```bash
python app.py
```
Open [http://localhost:5000](http://localhost:5000)

---

## Deployment

### Render (used for the live demo)

1. Push this repo to GitHub
2. On [Render](https://render.com) → **New + → Web Service** → connect the repo
3. Render auto-detects `render.yaml`. If setting manually:
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn app:app`
4. Add `GROQ_API_KEY` in the Render environment variables dashboard
5. Deploy — your URL will look like `https://your-app.onrender.com`

> **Note:** the free Render tier spins down after inactivity. The first request after idle may take ~30 seconds to wake up.

### Railway (alternative)

Same idea — connect repo, set `GROQ_API_KEY`, start command `gunicorn app:app`.

---

## API reference

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/` | Serves the frontend |
| `GET` | `/api/health` | Health check — confirms API key is set |
| `POST` | `/api/transcribe` | `multipart/form-data` audio → `{ transcript }` |
| `POST` | `/api/summarize` | `{ transcript }` → `{ notes: { title, summary, key_points, action_items } }` |

---

## Design decisions

- **JSON mode** is enforced on the summarization call so the response is always parseable — no markdown fences, no freeform prose to strip.
- The system prompt explicitly forbids inventing facts not present in the transcript, keeping summaries grounded.
- The transcript box is always editable before summarizing — correcting STT errors here materially improves output quality.
- File uploads are capped at 25 MB client-side and server-side (Whisper's limit).
