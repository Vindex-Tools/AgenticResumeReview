# Cyber Resume Reviewer — Agentic IT & Infosec Review

[![Skill Version](https://img.shields.io/badge/Framework-Cyber%20Resume%20Reviewer%20v4.1-blue.svg)](https://github.com/mubix/cyber-resume-reviewer-skill)
[![Gemini](https://img.shields.io/badge/AI%20Engine-Google%20Gemini%203.6%20%2F%202.0-emerald.svg)](https://aistudio.google.com/)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Client--Side-purple.svg)](#privacy--security)
[![License](https://img.shields.io/badge/License-MIT-gray.svg)](#)

> [!NOTE]
> **Shoutout to Mubix:** Huge thanks to **[Rob Fuller (Mubix)](https://github.com/mubix)** for creating the phenomenal baseline [Cyber Resume Reviewer Skill](https://github.com/mubix/cyber-resume-reviewer-skill) and providing the inspiration to build this interactive tool for students, career changers, and IT/cybersecurity professionals.

A sleek, privacy-first web application designed for IT and cybersecurity professionals to receive evidence-led resume reviews, job description alignment, and exact technical bullet transformations.

Powered by Google's native Gemini REST API and the [Cyber Resume Reviewer Framework](https://github.com/mubix/cyber-resume-reviewer-skill) (v4.1), this application evaluates resumes through a rigorous 4-lens assessment model—focusing on verifiable technical achievements rather than generic keyword stuffing or arbitrary scores.

---

## 🌟 Key Features

### 🛡️ 100% Client-Side Execution & Privacy
- **Zero Backend:** Runs entirely in your browser.
- **In-Browser Document Parsing:** PDF parsing is performed locally via `PDF.js` (v3.11); plain text (`.txt`) is read directly via the browser File API.
- **Direct REST Calls:** API requests travel directly from your browser to Google’s official Gemini REST endpoints (`generativelanguage.googleapis.com`). No intermediate proxy, database, or analytics tracking.
- **Local Key Storage:** Optional `localStorage` persistence with masked input and show/hide visibility toggles.

### 🤖 Intelligent Model Querying & Selection
- **Dynamic Endpoint Discovery:** Click **Query Models** to validate your Gemini API key and query Google's API for available models on your account.
- **Curated Recommendations:** Intelligently maps and surfaces optimal models (such as `gemini-3.6-flash`, `gemini-3.8-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`, `gemini-flash-latest`), while still exposing other discovered endpoints.
- **Fault-Tolerant:** Retains your selected model even if temporary quota or network errors occur.

### 🎯 Evidence-Led Review Framework
Evaluates candidate documents through four core evaluation lenses:
1. **Machine-Read:** Document extraction, structure, and readability checks.
2. **Human-Skim:** First-impression hierarchy, certifications, and high-impact placement.
3. **Human-Believe:** Technical authenticity, tooling context (distinguishing *operated* vs. *supported* vs. *led*), and verifiable metrics.
4. **Human-Act:** Direct alignment with target roles, employer expectations, and gap bridging.

### 📋 4 Tailored Review Objectives
- **Full Review & Assessment:** Comprehensive fit critique, evidence mapping, prioritized technical findings, and exact bullet replacements.
- **Tailor to Job Description:** Maps job requirements directly to candidate achievements, highlighting confirmed evidence and identifying missing scope.
- **Quick Priorities:** Fast-track delivery of the top 5 high-impact findings and immediate technical bullet repairs.
- **Complete Rewrite:** Complete refreshed resume draft preserving authentic candidate facts without hallucinating unverified claims.

### 🧠 Intelligent Guardrails & Temporal Grounding
- **Dynamic Calendar Anchoring:** Automatically injects the real-world calendar date and year into the model's context, preventing AI hallucination from flagging present or recent roles (2024–present) as "future dates".
- **Strict Anti-Self-Talk Filter:** Enforces silent validation reasoning and automatically strips internal drafting scratchpads, verification audits, and self-checks (e.g., `*Check:* Did I invent metrics?`), leaving only crisp, candidate-facing feedback.
- **Offline Resilience:** Dynamic fallback prompt ensures the application works seamlessly even when served offline or without local server access.

### 📊 Executive Report Viewer & Productivity Tools
- **Dual-View Toggle:** Switch between a styled **Formatted Document View** (with executive print headers, responsive tables, and color-coded Before/After diff tags) and a **Raw Markdown View** (`.md`).
- **Export Capabilities:**
  - One-click copy formatted Markdown to clipboard.
  - Export report as a standalone `.md` document.
  - Dedicated print stylesheet for clean **Save as PDF** or physical printing.
- **Instant Demo Mode:** Append `?demo=1` to the URL to instantly preview a sample executive report without an API key or resume upload.

### 🎨 Modern Executive Design
- **Theme Modes:** One-click toggle between sleek Dark Slate and crisp Light mode (persisted across sessions).
- **Subtle Ambient Styling:** Glassmorphism, smooth micro-animations, and responsive layouts tailored for mobile, tablet, and widescreen displays.
- **Toast Alerts:** Non-blocking notifications for uploads, copies, and state changes.

---

## 🚀 Quick Start

### 1. Prerequisites
- A modern web browser (Chrome, Edge, Firefox, Brave, Safari).
- A free Google Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### 2. How to Run Locally

Because the application fetches the framework instructions dynamically from `skill/SKILL.md`, run it using any lightweight local server (to comply with browser CORS policies for local files):

#### Option A: Python (Pre-installed on most systems)

    python -m http.server 8000

Navigate to: **[http://localhost:8000](http://localhost:8000)**

#### Option B: Node.js / npx

    npx serve

#### Option C: VS Code Live Server
Right-click `index.html` and select **"Open with Live Server"**.

#### Option D: Static Hosting
Deploy directly to GitHub Pages, Cloudflare Pages, Netlify, or Vercel with zero backend configuration needed.

---

## 📖 Step-by-Step Usage

1. **Enter API Key:** Paste your Gemini API key in the configuration panel.
2. **Select Model:** Click **Query Models** to auto-detect and select your preferred model (default: `Gemini 3.6 Flash`).
3. **Upload Resume:** Drag & drop or click to upload your resume (`.pdf` or `.txt`).
4. **(Optional) Target Job Description:** Paste a target cybersecurity job description (e.g., SOC Analyst, Cloud Security, AppSec, GRC, PenTester) to enable custom requirement mapping.
5. **Select Review Objective:** Choose between *Full Review*, *Tailor to JD*, *Quick Priorities*, or *Complete Rewrite*.
6. **Click Analyze:** Review the candidate-facing assessment, copy the markdown, or export to PDF.

---

## 🏗️ Architecture & Workflow

1. **Input & Local Extraction Layer**
   - **Candidate Resume:** Parsed locally in browser memory via `PDF.js` (`.pdf`) or Web File API (`.txt`).
   - **Target Job Description:** Optional JD input for targeted cyber capability mapping.
   - **Dynamic Temporal Grounding:** Automatically computes and injects today's real-world calendar date/year so recent experience is never flagged as "future dates".
   - **Framework Instructions:** Loads `skill/SKILL.md` dynamically (with automatic fallback prompt).

2. **Inference & Intelligence Layer**
   - **Direct REST Connection:** Browser communicates directly with `generativelanguage.googleapis.com` via HTTPS.
   - **Dynamic Model Selection:** Supports all Gemini endpoints on your key (`Gemini 3.6 Flash`, `Gemini 3.8 Flash`, `Gemini 2.5 Pro`, `Gemini 2.0 Flash`, etc.).

3. **Sanitization & Executive Presentation Layer**
   - **Direct Output Filter:** Strips AI self-checks, drafting thoughts, and verification checklists.
   - **Dual-Mode Report Viewer:** Toggle between Formatted Executive View (with Before/After diff tags) and Raw Markdown (`.md`).
   - **Export Tools:** One-click copy, download `.md` file, or save/print as PDF.

---

## 🔒 Privacy & Security

| Factor | Implementation |
| :--- | :--- |
| **Document Processing** | Parsed directly in browser memory; never uploaded to any third-party backend. |
| **API Transmission** | HTTPS request sent directly from client to Google's official Gemini endpoint. |
| **API Key Storage** | Kept in memory or stored optionally in your browser's private `localStorage`. |
| **Data Retention** | No analytics, trackers, cookies, or external logs collected by this tool. |

---

## 🛠️ Advanced: CLI Framework Scripts

The repository also includes the original command-line tools in `skill/scripts/`:

- **`analyze_resume_text.py`**: Command-line text analyzer for candidate signals and role evidence:

      python skill/scripts/analyze_resume_text.py --resume resume.txt --jd jd.txt

- **`render_report.py`**: Headless PDF report renderer from Markdown:

      python skill/scripts/render_report.py review.md review.pdf

- **`validate_report.py`**: Validates report schemas and section structures.

---

## 🤝 Acknowledgements

- **Cyber Resume Reviewer Framework:** Created by [mubix](https://github.com/mubix/cyber-resume-reviewer-skill).
- **Google Gemini:** Models and API provided by Google AI Studio.
- **PDF.js:** Document parsing by Mozilla.
- **Marked.js:** Markdown rendering by the Marked community.