# 🎙️ Notes Summarizer

Convert spoken audio into clean, structured notes — transcript + AI summary —
in a single page, no sign-up required.

## How it works (architecture)

```
┌────────────┐     ┌──────────────────────────┐      ┌───────────────────┐
│  Browser   │     │  Flask backend (app.py)  │      │     Groq API       │
│            │     │                          │      │                    │
│ Web Speech │──A──▶  (live mic: no call      │      │                    │
│   API      │     │   needed, done in-browser)│      │                    │
│            │     │                          │      │                    │
│ File upload│──B──▶ /api/transcribe ─────────┼──────▶ whisper-large-v3   │
│            │     │                          │      │   -turbo           │
│            │◀────┼──────────────────────────┤      │                    │
│            │     │                          │      │                    │
│ "Generate  │──C──▶ /api/summarize ───────────┼──────▶ llama-3.3-70b      │
│  Summary"  │     │   (JSON-mode prompt)     │      │   -versatile        │
│            │◀────┼──────────────────────────┤      │                    │
└────────────┘     └──────────────────────────┘      └───────────────────┘
```

**Two speech-to-text paths** are supported:

1. **Live recording (Path A)** — uses the browser's built-in `Web Speech API`
   (`webkitSpeechRecognition`). This is free, instant, and requires no server
   round-trip or API key, but only works in Chromium-based browsers
   (Chrome/Edge).
2. **File upload (Path B)** — for any audio file (or browsers without Web
   Speech support), the file is sent to the Flask backend, which transcribes
   it using **Groq's hosted Whisper (`whisper-large-v3-turbo`)** — free tier,
   fast, accurate.

Either path populates an editable transcript box. You can also just type or
paste text directly. Clicking **Generate Summary** sends the transcript to
`/api/summarize`, which prompts **Groq's `llama-3.3-70b-versatile`** model
(in JSON mode) to return a title, summary, key points, and action items.

## Tech stack

- **Backend:** Python, Flask, Gunicorn
- **Frontend:** Vanilla HTML/CSS/JS (no build step, no framework)
- **Speech-to-text:** Browser Web Speech API (live) + Groq Whisper API (uploads)
- **Summarization LLM:** Groq Llama 3.3 70B (free tier)

## Project structure

```
notes-summarizer/
├── app.py                 # Flask backend & API routes
├── requirements.txt
├── Procfile                # gunicorn start command
├── render.yaml              # Render.com deploy config
├── .env.example
├── templates/
│   └── index.html          # single-page UI
└── static/
    ├── style.css
    └── script.js            # recording, upload, fetch calls, rendering
```

## Setup (local)

1. **Get a free Groq API key:** https://console.groq.com/keys

2. **Clone and install:**
   ```bash
   git clone <your-repo-url>
   cd notes-summarizer
   python -m venv venv && source venv/bin/activate   # optional but recommended
   pip install -r requirements.txt
   ```

3. **Set your API key:**
   ```bash
   cp .env.example .env
   # edit .env and paste your key, then:
   export GROQ_API_KEY=your_key_here       # macOS/Linux
   # set GROQ_API_KEY=your_key_here        # Windows (cmd)
   ```

4. **Run it:**
   ```bash
   python app.py
   ```
   Open http://localhost:5000

## Deployment (Render.com — free tier)

1. Push this repo to GitHub.
2. On [Render](https://render.com), click **New + → Web Service**, connect
   the repo. Render will auto-detect `render.yaml`, or set manually:
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `gunicorn app:app`
3. Add environment variable `GROQ_API_KEY` (your key) in the Render dashboard.
4. Deploy. Your live URL will look like
   `https://notes-summarizer.onrender.com`.

> Note: the free Render tier spins down after inactivity, so the first
> request after idling may take ~30s to wake up.

### Alternative: Railway

Same idea — connect repo, set `GROQ_API_KEY`, start command
`gunicorn app:app`.

## API endpoints

| Method | Route             | Purpose                                  |
|--------|--------------------|-------------------------------------------|
| GET    | `/`                | Serves the frontend                      |
| GET    | `/api/health`       | Health check / confirms key is configured |
| POST   | `/api/transcribe`   | `multipart/form-data` audio file → `{transcript}` |
| POST   | `/api/summarize`    | `{transcript}` JSON → `{notes: {title, summary, key_points, action_items}}` |

## Notes on accuracy & design choices

- JSON mode is enforced on the summarization call so the response is always
  parseable structured data, not freeform prose.
- The system prompt explicitly forbids inventing facts not present in the
  transcript, to keep summaries grounded.
- Live mic transcription auto-restarts the recognizer if the browser session
  times out mid-recording, so long recordings don't silently cut off.
- The transcript box is always editable, so users can correct STT errors
  before summarizing — this materially improves summary quality.
