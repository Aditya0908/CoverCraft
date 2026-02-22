# Job Application Assistant

An AI-powered cover letter generator. Upload your resume → paste a job description → get a precision-crafted, tailored cover letter in seconds.

Built with **Next.js 16** (frontend) + **FastAPI** (backend) + **Gemini 2.5 Flash**.

---

## Features

- 📄 Resume upload (PDF / DOCX) — auto-parsed into structured JSON
- 🎯 Experience gap detection before generating
- ✍️ AI cover letter generation tailored to the specific JD
- 🎨 Interactive refinement: concise / detailed / custom instructions
- 📋 Copy to clipboard & download as `.txt`
- 🌌 Animated UI: particles, typewriter effect, step transitions, spring animations

---

## Running Locally

### Prerequisites
- Python 3.11+ with a virtualenv
- Node.js 18+
- A [Gemini API key](https://aistudio.google.com/apikey)

### Setup

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd cover_letter_resume_gen

# 2. Python deps
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. Node deps
npm install

# 4. Environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY and NEXT_PUBLIC_API_URL
```

### Start

```bash
# Terminal 1 — FastAPI backend (port 8000)
source .venv/bin/activate
uvicorn api.index:app --port 8000 --reload

# Terminal 2 — Next.js frontend (port 3000)
npm run dev
```

Open **http://localhost:3000**

---


## Project Structure

```
├── api/
│   └── index.py          # FastAPI backend (4 endpoints)
├── pages/
│   ├── _app.js           # Global layout + toasts
│   └── index.js          # Main animated UI (3-step wizard)
├── styles/
│   └── globals.css       # Dark-mode design system
├── job_assistant.py      # Core AI logic (untouched)
├── next.config.js
├── vercel.json
└── requirements.txt
```
