// ==========================================================================
// DOM ELEMENTS
// ==========================================================================

// Theme & Navigation
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

// API Key Elements
const apiKeyInput = document.getElementById('api-key');
const toggleKeyVisibilityBtn = document.getElementById('toggle-key-visibility');
const eyeIcon = document.getElementById('eye-icon');
const rememberKeyCheckbox = document.getElementById('remember-key');
const fetchModelsBtn = document.getElementById('fetch-models-btn');
const connectBtnText = document.getElementById('connect-btn-text');

// File Upload Elements
const dropArea = document.getElementById('drop-area');
const resumeUpload = document.getElementById('resume-upload');
const fileCard = document.getElementById('file-card');
const fileNameDisplay = document.getElementById('file-name-display');
const fileMetaDisplay = document.getElementById('file-meta-display');
const removeFileBtn = document.getElementById('remove-file-btn');

// Job Description & Modes
const modelSelect = document.getElementById('model-select');
const modelStatusHint = document.getElementById('model-status-hint');
const jobDescriptionInput = document.getElementById('job-description');
const jdCharCount = document.getElementById('jd-char-count');
const reviewModeSelect = document.getElementById('review-mode');
const modeCards = document.querySelectorAll('.mode-card');

// Analyze Action Elements
const analyzeBtn = document.getElementById('analyze-btn');
const btnText = document.querySelector('.btn-text');
const loader = document.querySelector('.loader');

// Results & Toolbar Elements
const resultsContent = document.getElementById('results-content');
const reportStatusBadge = document.getElementById('report-status-badge');
const toggleViewBtn = document.getElementById('toggle-view-btn');
const toggleViewText = document.getElementById('toggle-view-text');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');
const printBtn = document.getElementById('print-btn');
const clearBtn = document.getElementById('clear-btn');
const toastContainer = document.getElementById('toast-container');

// State Variables
let uploadedFile = null;
let resumeText = '';
let latestMarkdown = '';
let isRawMarkdownView = false;

// Configure marked renderer for clean output
if (window.marked && typeof marked.setOptions === 'function') {
    marked.setOptions({
        gfm: true,
        breaks: true
    });
}

// Configure PDF.js worker
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ==========================================================================
// TOAST NOTIFICATION SYSTEM
// ==========================================================================

function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
        <span class="toast-icon">${iconSvg}</span>
        <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    // Trigger smooth slide in
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}

// ==========================================================================
// THEME MANAGEMENT (Light / Dark)
// ==========================================================================

function initTheme() {
    const savedTheme = localStorage.getItem('resume_reviewer_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        updateThemeIcon(true);
    } else {
        document.body.classList.remove('light-theme');
        updateThemeIcon(false);
    }
}

function updateThemeIcon(isLight) {
    if (isLight) {
        // Show Moon icon when in light mode (to toggle to dark)
        themeIcon.innerHTML = `
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        `;
    } else {
        // Show Sun icon when in dark mode (to toggle to light)
        themeIcon.innerHTML = `
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        `;
    }
}

themeToggleBtn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('resume_reviewer_theme', isLight ? 'light' : 'dark');
    updateThemeIcon(isLight);
    showToast(isLight ? 'Switched to Light theme' : 'Switched to Dark theme', 'info', 1800);
});

// ==========================================================================
// API KEY MANAGEMENT & PERSISTENCE
// ==========================================================================

// Model State Tracking
let modelsLoaded = false;

function resetModelSelect(placeholderText = 'Paste API key or query models...') {
    modelsLoaded = false;
    modelSelect.innerHTML = `<option value="" disabled selected>${placeholderText}</option>`;
    modelSelect.classList.add('is-placeholder');
    const hasKey = apiKeyInput && apiKeyInput.value.trim().length > 10;
    if (hasKey) {
        modelStatusHint.textContent = 'Click Query Models';
        modelStatusHint.style.color = 'var(--accent-cyan)';
    } else {
        modelStatusHint.textContent = 'Awaiting API Key';
        modelStatusHint.style.color = 'var(--text-muted)';
    }
}

// Curated list of primary Gemini models suitable for resume review
const CURATED_MODELS = [
    {
        id: 'gemini-3.6-flash',
        aliases: ['gemini-3.6-flash'],
        label: 'Gemini 3.6 Flash (Recommended - Fast & Free Tier)'
    },
    {
        id: 'gemini-3.8-flash',
        aliases: ['gemini-3.8-flash'],
        label: 'Gemini 3.8 Flash (Latest Flagship)'
    },
    {
        id: 'gemini-3.7-flash',
        aliases: ['gemini-3.7-flash'],
        label: 'Gemini 3.7 Flash'
    },
    {
        id: 'gemini-3.5-flash',
        aliases: ['gemini-3.5-flash'],
        label: 'Gemini 3.5 Flash'
    },
    {
        id: 'gemini-flash-latest',
        aliases: ['gemini-flash-latest'],
        label: 'Gemini Flash (Latest Auto-Updating)'
    },
    {
        id: 'gemini-2.5-pro',
        aliases: ['gemini-2.5-pro'],
        label: 'Gemini 2.5 Pro (Deep Evidence Review)'
    },
    {
        id: 'gemini-2.5-flash-lite',
        aliases: ['gemini-2.5-flash-lite'],
        label: 'Gemini 2.5 Flash-Lite (Lightweight)'
    },
    {
        id: 'gemini-2.0-flash',
        aliases: ['gemini-2.0-flash-001', 'gemini-2.0-flash-exp'],
        label: 'Gemini 2.0 Flash'
    },
    {
        id: 'gemini-1.5-pro',
        aliases: ['gemini-1.5-pro-latest', 'gemini-1.5-pro-002', 'gemini-1.5-pro-001'],
        label: 'Gemini 1.5 Pro'
    },
    {
        id: 'gemini-1.5-flash',
        aliases: ['gemini-1.5-flash-latest', 'gemini-1.5-flash-002', 'gemini-1.5-flash-001'],
        label: 'Gemini 1.5 Flash'
    }
];

async function discoverAvailableModels(apiKey, isManual = false) {
    if (!apiKey || apiKey.length < 10) {
        if (isManual) {
            showToast('Please paste your Gemini API key first.', 'info');
            apiKeyInput.focus();
        }
        resetModelSelect('Paste API key or query models...');
        return null;
    }

    // Set button loading state
    if (fetchModelsBtn && connectBtnText) {
        fetchModelsBtn.classList.add('is-loading');
        fetchModelsBtn.disabled = true;
        connectBtnText.textContent = 'Querying...';
    }
    modelStatusHint.textContent = 'Querying Google models...';
    modelStatusHint.style.color = 'var(--text-muted)';

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await res.json();

        if (!res.ok) {
            const err = data.error?.message || 'Failed to query models.';
            resetModelSelect('Invalid API key — query failed');
            modelStatusHint.textContent = 'API key error';
            modelStatusHint.style.color = 'var(--accent-rose)';
            if (isManual) showToast(`API Key Error: ${err}`, 'error', 4500);
            return null;
        }

        if (!data.models || !Array.isArray(data.models)) {
            resetModelSelect('No models returned for this key');
            modelStatusHint.textContent = 'No models found';
            modelStatusHint.style.color = 'var(--accent-rose)';
            return null;
        }

        // Get all model IDs supporting generateContent
        const returnedIds = data.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace(/^models\//, ''));

        // Match against our clean curated list (prevents 40 messy internal duplicates)
        const matchedCurated = [];
        CURATED_MODELS.forEach(curated => {
            if (returnedIds.includes(curated.id)) {
                matchedCurated.push({ id: curated.id, label: curated.label });
            } else {
                const foundAlias = curated.aliases.find(a => returnedIds.includes(a));
                if (foundAlias) {
                    matchedCurated.push({ id: foundAlias, label: curated.label });
                }
            }
        });

        // Exclude deprecated endpoints and specialized non-text models (tts, audio, video, robotics, embeddings)
        const DEPRECATED_OR_UNSUPPORTED = [
            'gemini-2.5-flash',
            'embedding',
            'aqa',
            'imagen',
            'gemma',
            'tts',
            'veo',
            'lyria',
            'transcribe',
            'robotics',
            'banana',
            'audio'
        ];

        const matchedIds = matchedCurated.map(m => m.id);
        const otherModels = returnedIds.filter(id => {
            const lower = id.toLowerCase();
            if (matchedIds.includes(id)) return false;
            return !DEPRECATED_OR_UNSUPPORTED.some(term => lower.includes(term));
        });

        if (matchedCurated.length > 0 || otherModels.length > 0) {
            const previousSelection = modelSelect.value;
            modelsLoaded = true;
            modelSelect.classList.remove('is-placeholder');
            modelSelect.innerHTML = '';

            // 1. Primary Curated Optgroup
            const curatedGroup = document.createElement('optgroup');
            curatedGroup.label = 'Recommended Models';
            matchedCurated.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.label;
                curatedGroup.appendChild(opt);
            });
            modelSelect.appendChild(curatedGroup);

            // 2. Optional Raw Models Optgroup for advanced users
            if (otherModels.length > 0) {
                const otherGroup = document.createElement('optgroup');
                otherGroup.label = `Other Available Endpoints (${otherModels.length})`;
                otherModels.forEach(id => {
                    const opt = document.createElement('option');
                    opt.value = id;
                    opt.textContent = id;
                    otherGroup.appendChild(opt);
                });
                modelSelect.appendChild(otherGroup);
            }

            // Preserve user's previous selection if it is still available, otherwise default to Gemini 3.6 Flash
            if (previousSelection && (matchedIds.includes(previousSelection) || otherModels.includes(previousSelection))) {
                modelSelect.value = previousSelection;
            } else {
                const bestDefault = matchedCurated.find(m => m.id.includes('3.6-flash')) 
                    || matchedCurated.find(m => m.id.includes('3.8-flash'))
                    || matchedCurated.find(m => m.id.includes('flash-latest'))
                    || matchedCurated.find(m => m.id.includes('2.0-flash')) 
                    || matchedCurated[0];
                if (bestDefault) {
                    modelSelect.value = bestDefault.id;
                }
            }

            modelStatusHint.textContent = `✓ ${matchedCurated.length} recommended models ready`;
            modelStatusHint.style.color = 'var(--accent-emerald)';

            if (isManual) {
                showToast(`Connected! Loaded ${matchedCurated.length} recommended Gemini models.`, 'success', 3000);
            }

            return matchedCurated.map(m => m.id).concat(otherModels);
        }
    } catch (e) {
        console.warn('Could not query models:', e);
        resetModelSelect('Connection error — click Query Models to retry');
        modelStatusHint.textContent = 'Connection error';
        modelStatusHint.style.color = 'var(--accent-rose)';
        if (isManual) showToast('Could not connect to Google API. Check your internet connection.', 'error');
    } finally {
        if (fetchModelsBtn && connectBtnText) {
            fetchModelsBtn.classList.remove('is-loading');
            fetchModelsBtn.disabled = false;
            connectBtnText.textContent = modelsLoaded ? 'Connected ✓' : 'Query Models';
            if (modelsLoaded) {
                setTimeout(() => {
                    connectBtnText.textContent = 'Query Models';
                }, 3000);
            }
        }
    }
    return null;
}

function initApiKey() {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        rememberKeyCheckbox.checked = true;
        resetModelSelect('Click Query Models to load models...');
        modelStatusHint.textContent = 'Key saved • Click Query Models';
        modelStatusHint.style.color = 'var(--accent-cyan)';
    } else {
        resetModelSelect('Paste API key or query models...');
    }
}

// Allow clicking the dropdown placeholder to prompt user or trigger query
modelSelect.addEventListener('mousedown', (e) => {
    if (!modelsLoaded) {
        e.preventDefault();
        const key = apiKeyInput.value.trim();
        if (!key || key.length < 10) {
            apiKeyInput.focus();
            showToast('Please paste your Gemini API key first.', 'info');
        } else {
            discoverAvailableModels(key, true);
        }
    }
});

// Query Models button click
if (fetchModelsBtn) {
    fetchModelsBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        discoverAvailableModels(key, true);
    });
}

// Paste event: Store if remember is checked, and prompt to query
apiKeyInput.addEventListener('paste', () => {
    setTimeout(() => {
        const pastedKey = apiKeyInput.value.trim();
        if (pastedKey.length > 10) {
            if (rememberKeyCheckbox.checked) {
                localStorage.setItem('gemini_api_key', pastedKey);
            }
            if (!modelsLoaded) {
                modelSelect.innerHTML = `<option value="" disabled selected>Click Query Models to load models...</option>`;
                modelStatusHint.textContent = 'Key pasted • Click Query Models';
                modelStatusHint.style.color = 'var(--accent-cyan)';
                showToast('Key pasted! Click "Query Models" to load available models.', 'info', 3000);
            }
        }
    }, 50);
});

rememberKeyCheckbox.addEventListener('change', () => {
    if (rememberKeyCheckbox.checked) {
        if (apiKeyInput.value.trim()) {
            localStorage.setItem('gemini_api_key', apiKeyInput.value.trim());
            showToast('API Key saved locally', 'success', 2000);
        }
    } else {
        localStorage.removeItem('gemini_api_key');
        showToast('API Key removed from local storage', 'info', 2000);
    }
});

apiKeyInput.addEventListener('input', () => {
    const key = apiKeyInput.value.trim();
    if (rememberKeyCheckbox.checked) {
        localStorage.setItem('gemini_api_key', key);
    }
    if (!key) {
        resetModelSelect('Paste API key or query models...');
    } else if (!modelsLoaded) {
        modelSelect.innerHTML = `<option value="" disabled selected>Click Query Models to load models...</option>`;
        modelStatusHint.textContent = 'Click Query Models';
        modelStatusHint.style.color = 'var(--accent-cyan)';
    }
});

toggleKeyVisibilityBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    
    eyeIcon.innerHTML = isPassword
        ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`
        : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
});

// ==========================================================================
// FILE UPLOAD & DRAG/DROP
// ==========================================================================

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

dropArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
});

resumeUpload.addEventListener('change', (e) => handleFiles(e.target.files));

function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function handleFiles(files) {
    if (!files || files.length === 0) return;
    uploadedFile = files[0];
    
    // Update File Card UI
    fileNameDisplay.textContent = uploadedFile.name;
    const ext = uploadedFile.name.split('.').pop().toUpperCase();
    fileMetaDisplay.textContent = `${ext} • ${formatBytes(uploadedFile.size)}`;
    fileCard.classList.remove('hidden');

    showToast(`Parsing ${uploadedFile.name}...`, 'info', 2000);
    await extractTextFromFile(uploadedFile);
}

removeFileBtn.addEventListener('click', () => {
    uploadedFile = null;
    resumeText = '';
    resumeUpload.value = '';
    fileCard.classList.add('hidden');
    showToast('Resume removed', 'info', 2000);
});

// File Extraction Logic
async function extractTextFromFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    
    if (extension === 'txt') {
        try {
            resumeText = await file.text();
            showToast('Text document extracted successfully', 'success', 2500);
        } catch (error) {
            console.error('Error reading TXT file:', error);
            showToast('Failed to read text file.', 'error');
        }
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
            showToast(`PDF parsed successfully (${pdf.numPages} ${pdf.numPages === 1 ? 'page' : 'pages'})`, 'success', 2500);
        } catch (error) {
            console.error('Error parsing PDF:', error);
            showToast('Failed to parse PDF. Try uploading as plain text (.txt).', 'error', 4500);
        }
    } else {
        showToast('Unsupported file type. Please upload a PDF or TXT file.', 'error');
    }
}

// ==========================================================================
// JOB DESCRIPTION & CHARACTER COUNTER
// ==========================================================================

jobDescriptionInput.addEventListener('input', () => {
    const len = jobDescriptionInput.value.trim().length;
    if (len > 0) {
        jdCharCount.textContent = `${len.toLocaleString()} chars`;
    } else {
        jdCharCount.textContent = 'Optional';
    }
});

// ==========================================================================
// REVIEW MODE SELECTION CARDS
// ==========================================================================

modeCards.forEach(card => {
    card.addEventListener('click', () => {
        modeCards.forEach(c => c.classList.remove('is-selected'));
        card.classList.add('is-selected');
        const mode = card.getAttribute('data-mode');
        reviewModeSelect.value = mode;
    });
});

reviewModeSelect.addEventListener('change', () => {
    const selectedMode = reviewModeSelect.value;
    modeCards.forEach(card => {
        if (card.getAttribute('data-mode') === selectedMode) {
            card.classList.add('is-selected');
        } else {
            card.classList.remove('is-selected');
        }
    });
});

// ==========================================================================
// SYSTEM PROMPT RETRIEVAL
// ==========================================================================

const BUILTIN_CYBER_SKILL_PROMPT = `# IT and Cybersecurity Resume Reviewer

Improve how the candidate communicates relevant work. Preserve the useful four-lens model: **Machine-read** (document extraction), **Human-skim** (first impression), **Human-believe** (evidence), and **Human-act** (target alignment). These are review lenses, not a universal hiring sequence or a prediction of recruiter behavior.

## Truth and scope invariants:
- Do not invent or upgrade employers, titles, duties, tools, metrics, education, certifications, clearances, authorization, team size, budget authority, board access, or project outcomes.
- Keep **operated / built / supported / led / advised / approved** distinct. Lab, course, volunteer, personal, client, and production work must retain their context. Preserve team attribution.
- Put assumptions in analysis, never as facts inside the resume. No [Assumed: ...] claims.
- Never equate keyword overlap with qualifications, fit percentage, ATS score, or interview probability. Do not diagnose deception, personality, motivation, or retention risk from prose style or career history.
- The visual layer may not assert what the prose may not assert. Do not use score gauges, progress bars, percentage rings, letter grades, match percentages, radar charts, or proficiency bars.
- Anchor all date evaluations to the dynamically provided real-world calendar year. Never assume the current year is 2024; recognize experience spanning into the current year as valid, active, or past work.
- Zero internal self-talk or drafting notes: Deliver only direct candidate-facing assessment results (what is strong, issues found, what needs improvement, exact bullet repairs). Strictly forbid outputting self-checks (e.g. '*Check:* Did I...'), chain-of-thought scratchpads, or drafting notes (e.g. '*Drafting the fix:*'). Keep all reasoning internal and silent.

## Quality bar:
Lead immediately with candidate-facing results:
1. Executive Verdict & Core Strengths (what is strong, what works well, evidence to preserve).
2. Prioritized Issues & Weaknesses (uncorroborated claims, missing scope, what needs improvement).
3. Exact Bullet Transformations (concrete Before / After bullet edits using established facts).
4. Target Alignment & Next Steps.

Preserve strengths as deliberately as you fix weaknesses. Be candid without ridicule, canned praise, or invented urgency. Use plain language and the candidate's voice. Deliver the full review in clean GitHub Flavored Markdown. Never output verification checklists, self-audits, or drafting scratchpads.`;

async function fetchSkillPrompt() {
    try {
        const response = await fetch('skill/SKILL.md');
        if (!response.ok) throw new Error('Skill fetch returned status ' + response.status);
        return await response.text();
    } catch (error) {
        // Fallback works seamlessly when running locally from file:// without web server
        return BUILTIN_CYBER_SKILL_PROMPT;
    }
}

// ==========================================================================
// ANALYZE ACTION & GEMINI INTEGRATION
// ==========================================================================

analyzeBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        showToast('Please enter your Gemini API Key.', 'error');
        apiKeyInput.focus();
        return;
    }
    if (!resumeText) {
        showToast('Please upload a resume first.', 'error');
        return;
    }

    const jobDesc = jobDescriptionInput.value.trim();
    const mode = reviewModeSelect.value;

    // Enter Loading State
    analyzeBtn.disabled = true;
    btnText.textContent = 'Reviewing...';
    loader.classList.remove('hidden');
    reportStatusBadge.textContent = 'Analyzing with Gemini';
    reportStatusBadge.style.color = 'var(--accent-primary)';

    resultsContent.innerHTML = `
        <div class="analyzing-state">
            <div class="ai-pulse-loader">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                </svg>
            </div>
            <div>
                <h3 class="analyzing-status">Conducting Evidence-Led Cyber Review</h3>
                <p class="analyzing-subtext">Gemini is evaluating your resume against the 4-lens framework...</p>
            </div>
        </div>
    `;

    try {
        // Compute real-world current date and year for dynamic temporal grounding
        const now = new Date();
        const formattedCurrentDate = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const currentYear = now.getFullYear();

        const temporalGrounding = `\n\n### TEMPORAL CONTEXT & CALENDAR ANCHORING (CRITICAL):
- Current Real-World Date: ${formattedCurrentDate} (Year: ${currentYear}).
- Today is in ${currentYear}.
- All candidate work experience, roles, education, and credentials spanning through ${currentYear} are present or historical.
- STRICT RULE: Do NOT flag dates in 2024, 2025, or ${currentYear} as "future dates", "inaccurate timelines", or "impossible dates". The calendar year is ${currentYear}.`;

        // Fetch skill instructions (from local file or built-in cyber framework)
        let systemInstruction = await fetchSkillPrompt();
        systemInstruction += temporalGrounding;
        
        // Build customized prompt based on selected review mode
        let userPrompt = `[TEMPORAL CONTEXT: Today's date is ${formattedCurrentDate}. The current year is ${currentYear}. Dates through ${currentYear} are valid current/historical dates, NOT in the future.]\n\n`;
        userPrompt += `I need you to review my resume using the cyber-resume-reviewer skill.\n\n`;
        
        userPrompt += `### OUTPUT REQUIREMENTS (STRICT):
1. Focus directly on actionable candidate-facing results:
   - **Executive Assessment / Strong Points**: What is strong, what is working well, and what evidence should be preserved.
   - **Issues & Areas Needing Improvement**: Specific issues, uncorroborated claims, missing context, or weak phrasing.
   - **Exact Bullet Transformations**: Concrete Before & After bullet edits with brief rationale.
   - **Target Alignment / Next Steps**: Actionable next moves.
2. ABSOLUTELY ZERO SELF-TALK:
   - Do NOT output internal monologues, self-checks, or validation checklists (e.g., do NOT write "*Check:* Did I invent metrics? No.", "*Check:* Did I...", or similar self-audits).
   - Do NOT output drafting scratchpad thoughts (e.g., do NOT write "*Drafting the fix:*...", "*Drafting the highlight:*...").
   - Perform all fact-checking and rule validation SILENTLY in your reasoning. Output ONLY the polished, final review.\n\n`;

        if (mode === 'full') {
            userPrompt += `Deliverable: Full Review. Give me a candid assessment of what is strong, prioritized issues/weaknesses, and exact Before/After bullet edits supported by my resume facts. Deliver the report in clean Markdown.\n`;
        } else if (mode === 'tailor') {
            userPrompt += `Deliverable: Tailor to JD. Map requirements to evidence, highlight what aligns well, identify capability gaps, and provide truthful Before/After bullet adaptations.\n`;
        } else if (mode === 'quick') {
            userPrompt += `Deliverable: Quick Review. Up to five material findings (strengths and issues) and useful exact Before/After bullet edits. Omit scoring.\n`;
        } else if (mode === 'rewrite') {
            userPrompt += `Deliverable: Complete Rewrite. Produce the complete rewrite now using established facts. Provide brief explanations of material changes.\n`;
        }

        userPrompt += `\n--- MY RESUME ---\n${resumeText}\n`;
        
        if (jobDesc) {
            userPrompt += `\n--- TARGET JOB DESCRIPTION ---\n${jobDesc}\n`;
        }

        // Direct native fetch to Google Gemini REST API
        // Eliminates third-party CDN / dynamic import CORS restrictions
        const requestPayload = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: userPrompt }]
                }
            ],
            generationConfig: {
                temperature: 0.3
            }
        };

        if (systemInstruction) {
            requestPayload.systemInstruction = {
                parts: [{ text: systemInstruction }]
            };
        }

        const chosenModel = modelSelect.value || 'gemini-3.6-flash';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${chosenModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            const errorMsg = data.error?.message || `API error (${response.status}): ${response.statusText}`;
            throw new Error(errorMsg);
        }

        const candidate = data.candidates?.[0];
        if (!candidate || !candidate.content?.parts?.[0]?.text) {
            if (candidate?.finishReason === 'SAFETY') {
                throw new Error('Analysis was filtered by Gemini safety guidelines. Please verify the uploaded text.');
            }
            throw new Error('No content returned from Gemini API. Please try again.');
        }

        const rawOutput = candidate.content.parts[0].text;
        latestMarkdown = cleanMarkdownResponse(rawOutput);
        
        isRawMarkdownView = false;
        updateReportDisplay();

        reportStatusBadge.textContent = 'Complete';
        reportStatusBadge.style.color = 'var(--accent-emerald)';

        showToast('Cyber resume review generated successfully!', 'success', 3000);
        
    } catch (error) {
        console.error('Error during analysis:', error);
        reportStatusBadge.textContent = 'Error';
        reportStatusBadge.style.color = 'var(--accent-rose)';
        
        const failedModel = modelSelect.value || 'gemini-3.6-flash';
        resultsContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon-wrap" style="background: rgba(244, 63, 94, 0.12); color: var(--accent-rose);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>
                <h3>Analysis Encountered an Issue</h3>
                <p style="color: var(--accent-rose);">${escapeHtml(error.message || 'An error occurred during generation.')}</p>
                <p class="analyzing-subtext">Selected model: <strong>${escapeHtml(failedModel)}</strong> (kept active — not changed). Check your API key quota or select another model from the dropdown.</p>
            </div>
        `;
        showToast(`Generation failed: ${error.message}`, 'error', 4500);
    } finally {
        analyzeBtn.disabled = false;
        btnText.textContent = 'Analyze Resume';
        loader.classList.add('hidden');
    }
});

// ==========================================================================
// MARKDOWN SANITIZATION & EXECUTIVE DOCUMENT RENDERING
// ==========================================================================

function cleanMarkdownResponse(rawText) {
    if (!rawText) return '';
    let text = rawText.trim();
    
    // Strip outer code fences if the entire output was enclosed in ```markdown ... ``` or ``` ... ```
    const fenceMatch = text.match(/^```(?:markdown|md|txt)?\s*[\r\n]([\s\S]*?)[\r\n]\s*```$/i);
    if (fenceMatch) {
        text = fenceMatch[1].trim();
    }
    
    // Remove rogue leading fences
    if (/^```(?:markdown|md|txt)?\s*[\r\n]/i.test(text)) {
        text = text.replace(/^```(?:markdown|md|txt)?\s*[\r\n]/i, '');
    }
    // Remove rogue trailing fences
    if (/[\r\n]\s*```$/i.test(text)) {
        text = text.replace(/[\r\n]\s*```$/i, '');
    }
    
    // Strip entire self-talk / verification / drafting sections if present (e.g. ### Verification Checklist)
    text = text.replace(/^#{1,4}\s*(?:Verification(?:\s+Checklist|\s+Audit)?|Self-Check(?:list)?|Internal\s+(?:Audit|Verification|Notes?)|Drafting\s+Notes?)[^\n]*\r?\n(?:[\s\S]*?(?=(?:^#{1,4}\s|\Z)))/gim, '');
    
    // Strip individual bulleted or inline self-talk and drafting lines
    // Handles patterns like:
    // *   *Check:* Did I invent any metrics? No.
    // *   *Drafting the "Digital Engineer" fix:* I can't tell him...
    // *   *Drafting the "ICS" highlight:* Emphasize that...
    // - *Check:* ...
    // *Check:* ...
    text = text.replace(/^\s*(?:[-*+]\s+)?(?:\*{1,2}|_{1,2})\s*(?:Check|Drafting[^\n:]*|Self-Check|Verification|Internal\s+(?:Check|Note|Audit)|Validation)\s*(?:\*{1,2}|_{1,2})?:?[^\n]*(?:\r?\n|$)/gim, '');
    
    // Strip lines starting with plain "Check: ..." or "Drafting ...: ..." without asterisks
    text = text.replace(/^\s*(?:Check|Drafting\s+[^\n:]*|Self-Check|Internal Check)\s*:\s*[^\n]*(?:\r?\n|$)/gim, '');
    
    // Collapse excess blank lines left behind
    text = text.replace(/\n{3,}/g, '\n\n');
    
    return text.trim();
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function fallbackMarkdownToHtml(md) {
    if (!md) return '';
    let html = escapeHtml(md);
    
    // Code blocks
    html = html.replace(/```([a-z0-9_-]*)\r?\n([\s\S]*?)```/gi, (match, lang, code) => {
        return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Headers
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote><p>$1</p></blockquote>');
    
    // Bold & Italics
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/___(.*?)___/g, '<strong><em>$1</em></strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');
    
    // Horizontal rule
    html = html.replace(/^---+$/gim, '<hr>');
    
    // Lists
    html = html.replace(/^[\*\-] (.*$)/gim, '<ul><li>$1</li></ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    html = html.replace(/^\d+\. (.*$)/gim, '<ol><li>$1</li></ol>');
    html = html.replace(/<\/ol>\s*<ol>/g, '');
    
    // Paragraphs
    const blocks = html.split(/\n\n+/);
    html = blocks.map(b => {
        b = b.trim();
        if (!b) return '';
        if (/^<(h[1-4]|ul|ol|pre|blockquote|hr|table|div)/i.test(b)) {
            return b;
        }
        return `<p>${b.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
    
    return html;
}

function renderFormattedReport(markdown) {
    if (!markdown) return;
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const printHeader = `
        <div class="print-document-header">
            <div class="print-brand-row">
                <div class="print-title">Cyber Resume Review &amp; Assessment</div>
                <div class="print-badge">Evidence-Led Report</div>
            </div>
            <div class="print-meta-row">
                <span>Evaluation Date: ${dateStr}</span>
                <span>Framework: 4-Lens Evidence &amp; Integrity Model</span>
            </div>
        </div>
    `;
    
    let renderedHtml = '';
    if (window.marked && typeof window.marked.parse === 'function') {
        try {
            renderedHtml = window.marked.parse(markdown);
        } catch (e) {
            console.warn('Marked parse failed, using fallback parser:', e);
            renderedHtml = fallbackMarkdownToHtml(markdown);
        }
    } else {
        renderedHtml = fallbackMarkdownToHtml(markdown);
    }
    
    // Wrap tables in responsive container so they never force page scrollbars
    renderedHtml = renderedHtml.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
        return `<div class="table-responsive">${match}</div>`;
    });
    
    // Enhance Before / After bullet diff labels
    renderedHtml = renderedHtml.replace(/(?:<strong>)?\s*Before:\s*(?:<\/strong>)?/gi, '<span class="diff-tag diff-before">Before</span> ');
    renderedHtml = renderedHtml.replace(/(?:<strong>)?\s*Original:\s*(?:<\/strong>)?/gi, '<span class="diff-tag diff-before">Original</span> ');
    renderedHtml = renderedHtml.replace(/(?:<strong>)?\s*After:\s*(?:<\/strong>)?/gi, '<span class="diff-tag diff-after">After</span> ');
    renderedHtml = renderedHtml.replace(/(?:<strong>)?\s*Revised:\s*(?:<\/strong>)?/gi, '<span class="diff-tag diff-after">Revised</span> ');
    
    resultsContent.innerHTML = printHeader + renderedHtml;
}

function updateReportDisplay() {
    if (!latestMarkdown) return;
    
    if (isRawMarkdownView) {
        // Render Raw Markdown in high-readability wrapped container
        resultsContent.innerHTML = `<pre class="raw-markdown-view"><code>${escapeHtml(latestMarkdown)}</code></pre>`;
        if (toggleViewBtn) {
            toggleViewBtn.classList.add('is-active');
            toggleViewText.textContent = 'Formatted View';
        }
    } else {
        // Render Beautiful Formatted Document
        renderFormattedReport(latestMarkdown);
        if (toggleViewBtn) {
            toggleViewBtn.classList.remove('is-active');
            toggleViewText.textContent = 'Raw .md';
        }
    }
}

// ==========================================================================
// RESULTS TOOLBAR ACTIONS (Toggle View, Copy, Download, Print, Clear)
// ==========================================================================

// Toggle View (Formatted Document vs Raw Markdown)
if (toggleViewBtn) {
    toggleViewBtn.addEventListener('click', () => {
        if (!latestMarkdown) {
            showToast('Analyze a resume first to view the report.', 'info');
            return;
        }
        isRawMarkdownView = !isRawMarkdownView;
        updateReportDisplay();
        showToast(isRawMarkdownView ? 'Showing Raw Markdown (.md)' : 'Showing Formatted Document', 'info', 1800);
    });
}

// Copy Markdown
copyBtn.addEventListener('click', async () => {
    if (!latestMarkdown) {
        showToast('No report available to copy.', 'info', 2000);
        return;
    }
    try {
        await navigator.clipboard.writeText(latestMarkdown);
        showToast('Report Markdown copied to clipboard!', 'success', 2500);
    } catch (err) {
        console.error('Failed to copy text:', err);
        showToast('Failed to copy to clipboard.', 'error');
    }
});

// Download Markdown as file
downloadBtn.addEventListener('click', () => {
    if (!latestMarkdown) {
        showToast('No report available to download.', 'info', 2000);
        return;
    }
    const blob = new Blob([latestMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cyber_Resume_Review_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Report downloaded as Markdown (.md)', 'success', 2500);
});

// Print or Save as PDF
printBtn.addEventListener('click', () => {
    if (!latestMarkdown && resultsContent.querySelector('.empty-state')) {
        showToast('Analyze a resume first before printing.', 'info', 2000);
        return;
    }
    window.print();
});

// Clear Results
clearBtn.addEventListener('click', () => {
    if (!latestMarkdown) return;
    latestMarkdown = '';
    isRawMarkdownView = false;
    if (toggleViewText) toggleViewText.textContent = 'Raw .md';
    if (toggleViewBtn) toggleViewBtn.classList.remove('is-active');
    reportStatusBadge.textContent = 'Ready';
    reportStatusBadge.style.color = '';
    resultsContent.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
            </div>
            <h3>Ready for Cyber Review</h3>
            <p>Upload your IT or cybersecurity resume to receive an evidence-led review, prioritized findings, and exact edits.</p>
            
            <div class="empty-checklist">
                <div class="check-item">
                    <span class="check-num">1</span>
                    <span>Provide your free Gemini API key</span>
                </div>
                <div class="check-item">
                    <span class="check-num">2</span>
                    <span>Upload a PDF or TXT cyber resume</span>
                </div>
                <div class="check-item">
                    <span class="check-num">3</span>
                    <span>Click Analyze for evidence-backed critique & rewrites</span>
                </div>
            </div>
        </div>
    `;
    showToast('Report cleared', 'info', 2000);
});

// ==========================================================================
// DEMO PREVIEW (Loads realistic cyber review when URL contains ?demo=1)
// ==========================================================================

const SAMPLE_DEMO_REVIEW = `\`\`\`markdown
# Cybersecurity Resume Review & Assessment

## Executive Summary
Strong mid-level Security Operations (SOC) and Incident Response background. The candidate demonstrates hands-on SIEM telemetry, threat hunting, and containment experience across enterprise environments. However, several bullet points bury high-impact containment outcomes behind generic routine duty descriptions.

### Four-Lens Framework Evaluation

- **Machine-read (Document Extraction):**
  Clear chronological progression, standard section taxonomy, and cleanly extractable role headers. Zero parsing impediments found.
- **Human-skim (First Impression):**
  Tools and certifications (Security+, CySA+, B.S. Cybersecurity) are immediately noticeable. However, technical impact metrics are clustered at the bottom of bullets rather than leading the statement.
- **Human-believe (Evidence & Authenticity):**
  Specific incident handling numbers (e.g., 150+ alerts triaged weekly) provide authentic grounding. Need clearer distinction between supported systems versus tools directly operated.
- **Human-act (Target Alignment):**
  Directly aligns with Senior SOC Tier 2 / Incident Response Analyst job requirements.

## Prioritized Findings & Bullet Edits

> **Advisory Recommendation:** Lead every experience bullet with the containment outcome and technical tooling, rather than "Responsible for monitoring...".

### Bullet Point Transformations

- Before: Responsible for monitoring Splunk dashboards and triaging alerts across enterprise endpoints.
- After: Triaged 150+ daily high-severity alerts in Splunk ES and CrowdStrike Falcon, reducing false-positive MTTR by 28%.

- Before: Helped patch vulnerabilities identified during weekly vulnerability scans.
- After: Remediated 45 critical CVEs across 1,200 Linux/Windows servers using Tenable.io and Ansible playbooks.

### Cyber Capability Mapping

| Requirement | Resume Evidence | Status |
| :--- | :--- | :--- |
| SIEM Telemetry | Splunk Enterprise Security, QRadar correlation rules | Verified Evidence |
| Endpoint Detection & Response | CrowdStrike Falcon, Defender for Endpoint | Verified Evidence |
| Incident Response Playbooks | NIST SP 800-61 containment workflows | Needs Clarification |
\`\`\``;

function initDemoPreview() {
    if (window.location.search && window.location.search.includes('demo=1')) {
        latestMarkdown = cleanMarkdownResponse(SAMPLE_DEMO_REVIEW);
        isRawMarkdownView = false;
        updateReportDisplay();
        reportStatusBadge.textContent = 'Complete';
        reportStatusBadge.style.color = 'var(--accent-emerald)';
    }
}

// Initialize on page load
initTheme();
initApiKey();
initDemoPreview();
