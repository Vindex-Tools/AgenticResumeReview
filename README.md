# ResumeIQ — Agentic Resume Reviewer

A local, privacy-first web application powered by the Gemini Pro API and the [Cyber Resume Reviewer Framework](https://github.com/mubix/cyber-resume-reviewer-skill). It delivers candid, evidence-led career critique, ATS-friendly suggestions, and targeted resume rewrites.

## Key Features
- **Clean Executive Aesthetic:** Modern, distraction-free SaaS design with ambient lighting, glassmorphism, and responsive layout.
- **Light & Dark Theme:** Seamless one-click toggle between Dark Slate and crisp Light mode.
- **Privacy First:** 100% client-side execution. PDF extraction and text parsing happen directly in your browser.
- **Evidence-Led Review Modes:**
  - **Full Review & Assessment:** Comprehensive fit analysis, evidence mapping, and prioritized critique.
  - **Tailor to Job Description:** Maps JD requirements to candidate achievements and bridges gaps.
  - **Quick Priorities:** Top 5 high-impact bullet repairs.
  - **Complete Rewrite:** Full refreshed resume draft.
- **Export & Productivity Tools:**
  - One-click copy formatted Markdown to clipboard.
  - Export report as `.md` file.
  - Print or Save as PDF with dedicated print stylesheet.
- **Persistent Key Storage:** Secure local storage option with show/hide password toggle.

## How to Run

Because this app fetches the skill instructions dynamically from the `skill/` folder, it should be run through a local web server (to comply with browser CORS policies):

### Using Python
```bash
python -m http.server 8000
```
Then navigate to: [http://localhost:8000](http://localhost:8000)

### Using Node.js
```bash
npx serve
```

## Quick Start
1. Open the app in your browser via your local server.
2. Enter your free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Upload your resume (`.pdf` or `.txt`) and optionally paste a target job description.
4. Select your review mode and click **Analyze Resume**.