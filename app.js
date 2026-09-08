import { GoogleGenAI } from '@google/genai';
import { marked } from 'marked';

// DOM Elements
const apiKeyInput = document.getElementById('api-key');
const resumeUpload = document.getElementById('resume-upload');
const dropArea = document.getElementById('drop-area');
const fileMsg = document.querySelector('.file-msg');
const jobDescriptionInput = document.getElementById('job-description');
const reviewModeSelect = document.getElementById('review-mode');
const analyzeBtn = document.getElementById('analyze-btn');
const btnText = document.querySelector('.btn-text');
const loader = document.querySelector('.loader');
const resultsContent = document.getElementById('results-content');

let uploadedFile = null;
let resumeText = '';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// --- Event Listeners for Drag and Drop ---
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.add('is-active'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.remove('is-active'), false);
});

dropArea.addEventListener('drop', handleDrop, false);
resumeUpload.addEventListener('change', (e) => handleFiles(e.target.files), false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function handleFiles(files) {
    if (files.length > 0) {
        uploadedFile = files[0];
        fileMsg.textContent = uploadedFile.name;
        extractTextFromFile(uploadedFile);
    }
}

// --- File Extraction Logic ---
async function extractTextFromFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    
    if (extension === 'txt') {
        const text = await file.text();
        resumeText = text;
    } else if (extension === 'pdf') {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }
            resumeText = fullText;
        } catch (error) {
            console.error('Error parsing PDF:', error);
            alert('Failed to parse PDF. Please try a TXT file instead.');
        }
    } else {
        alert('Unsupported file type. Please upload a PDF or TXT file.');
    }
}

// --- Fetch Skill System Prompt ---
async function fetchSkillPrompt() {
    try {
        const response = await fetch('skill/SKILL.md');
        if (!response.ok) throw new Error('Failed to fetch skill');
        return await response.text();
    } catch (error) {
        console.warn('Could not fetch SKILL.md. Ensure you are running a local web server (e.g. python -m http.server). Using fallback minimal instructions.', error);
        // Fallback minimal instruction if running from file:// without server
        return `You are the Cyber Resume Reviewer. Review the provided IT/Cybersecurity resume. Be candid, prioritize findings, and suggest exact edits. Focus on evidence and alignment. Deliver the review in Markdown formatting.`;
    }
}

// --- Analyze Logic ---
analyzeBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('Please enter your Gemini API Key.');
        return;
    }
    if (!resumeText) {
        alert('Please upload a resume first.');
        return;
    }

    const jobDesc = jobDescriptionInput.value.trim();
    const mode = reviewModeSelect.value;

    // UI Loading state
    analyzeBtn.disabled = true;
    btnText.classList.add('hidden');
    loader.classList.remove('hidden');
    resultsContent.innerHTML = '<div class="empty-state"><div class="icon" style="animation: pulse 1.5s infinite">🤖</div><p>Gemini is analyzing your resume...</p></div>';

    try {
        // Initialize Gemini API
        const ai = new GoogleGenAI({ apiKey: apiKey });
        
        // Get system prompt
        const systemInstruction = await fetchSkillPrompt();
        
        // Construct the prompt based on mode
        let userPrompt = `I need you to use your cyber-resume-reviewer skill to process my resume.\n\n`;
        
        if (mode === 'full') {
            userPrompt += `Deliverable: Full Review. Give me a candid fit assessment, prioritized findings, and exact edits supported by my resume. Do not invent metrics or experience. Deliver the full report as Markdown.\n`;
        } else if (mode === 'tailor') {
            userPrompt += `Deliverable: Tailor to JD. Map requirements to evidence, then make truthful changes. Separate employer requirements from assumed role expectations.\n`;
        } else if (mode === 'quick') {
            userPrompt += `Deliverable: Quick Review. Up to five material findings and useful exact edits. Omit scoring.\n`;
        } else if (mode === 'rewrite') {
            userPrompt += `Deliverable: Complete Rewrite. Produce the complete rewrite now using established facts. Explain material changes briefly.\n`;
        }

        userPrompt += `\n--- MY RESUME ---\n${resumeText}\n`;
        
        if (jobDesc) {
            userPrompt += `\n--- TARGET JOB DESCRIPTION ---\n${jobDesc}\n`;
        }

        // Call Gemini
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-pro',
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.3
            }
        });

        const markdownText = response.text;
        
        // Render Markdown
        resultsContent.innerHTML = marked.parse(markdownText);
        
    } catch (error) {
        console.error('Error calling Gemini:', error);
        resultsContent.innerHTML = `<div class="empty-state" style="color: #ef4444;"><div class="icon">❌</div><p>Error: ${error.message}</p></div>`;
    } finally {
        analyzeBtn.disabled = false;
        btnText.classList.remove('hidden');
        loader.classList.add('hidden');
    }
});
