# Cyber Resume Reviewer (Local App)

This is a local, privacy-first web application that uses the Gemini Pro API and the [Cyber Resume Reviewer Skill](https://github.com/mubix/cyber-resume-reviewer-skill) to analyze and improve your IT/Cybersecurity resume.

## Features
- **Privacy First:** The app runs entirely in your browser. Your resume is only sent directly to Google's Gemini API.
- **Custom Aesthetic:** Premium glassmorphism design with a dynamic dark mode.
- **Direct Skill Integration:** Uses the exact instructions from the Cyber Resume Reviewer skill for high-quality, evidence-led feedback.
- **PDF Extraction:** Extracts text locally from your PDFs before sending to Gemini to save tokens and ensure clean parsing.

## How to Run

Because this app fetches the skill instructions dynamically from the `skill/` folder, you cannot simply double-click the `index.html` file (your browser will block it due to CORS security policies). You must run it through a local web server.

### Using Python (Recommended)
If you have Python installed, open a terminal in this directory and run:
```bash
python -m http.server 8000
```
Then open your browser and navigate to: http://localhost:8000

### Using Node.js
If you have Node.js installed, you can use `npx serve`:
```bash
npx serve
```

## Setup Instructions
1. Open the app in your browser using one of the methods above.
2. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Paste the API key into the app (it is only stored in your browser's memory while the tab is open).
4. Upload your resume (PDF or TXT) and optionally a target Job Description.
5. Click **Analyze Resume** and wait for the results!