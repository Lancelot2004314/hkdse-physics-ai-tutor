// HKDSE Physics AI Tutor - Frontend Application

// State
let currentImage = null;
let currentImageBase64 = null;
let problemSummary = null;
let previousAnswer = null;
let chatHistory = [];
let inputMode = 'image'; // 'image' or 'text'
let currentUser = null; // Logged-in user info
let lastRequestData = null; // For saving to history

// Debug Logger
const debugLog = {
    logs: [],
    add(type, message, data = null) {
        const time = new Date().toLocaleTimeString();
        const entry = { time, type, message, data };
        this.logs.push(entry);
        this.render();
        console.log(`[${time}] ${type}: ${message}`, data || '');
    },
    info(msg, data) { this.add('info', msg, data); },
    success(msg, data) { this.add('success', msg, data); },
    error(msg, data) { this.add('error', msg, data); },
    clear() {
        this.logs = [];
        this.render();
    },
    render() {
        const el = document.getElementById('debugLog');
        if (!el) return;
        el.innerHTML = this.logs.map(log => {
            let dataStr = '';
            if (log.data) {
                try {
                    dataStr = '\n' + JSON.stringify(log.data, null, 2);
                } catch {
                    dataStr = '\n' + String(log.data);
                }
            }
            return `<span class="log-time">[${log.time}]</span> <span class="log-${log.type}">${log.message}</span>${dataStr ? `<span class="log-data">${dataStr}</span>` : ''}`;
        }).join('\n\n');
        el.scrollTop = el.scrollHeight;
    },
    getText() {
        return this.logs.map(log => {
            let dataStr = log.data ? '\n' + JSON.stringify(log.data, null, 2) : '';
            return `[${log.time}] ${log.type}: ${log.message}${dataStr}`;
        }).join('\n\n');
    }
};

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const imageInput = document.getElementById('imageInput');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const removeImage = document.getElementById('removeImage');
const questionInput = document.getElementById('questionInput');
const levelSelect = document.getElementById('levelSelect');
const modeSelect = document.getElementById('modeSelect');
const visionModelSelect = document.getElementById('visionModelSelect');
const toggleAttempt = document.getElementById('toggleAttempt');
const studentAttempt = document.getElementById('studentAttempt');
const submitBtn = document.getElementById('submitBtn');
const loading = document.getElementById('loading');
const resultsSection = document.getElementById('resultsSection');
const chatSection = document.getElementById('chatSection');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const needsVision = document.getElementById('needsVision');
const sendChat = document.getElementById('sendChat');
const newQuestionBtn = document.getElementById('newQuestionBtn');
const toggleAnswer = document.getElementById('toggleAnswer');
const finalAnswer = document.getElementById('finalAnswer');

// Input mode elements
const modeImageBtn = document.getElementById('modeImage');
const modeTextBtn = document.getElementById('modeText');
const textInputArea = document.getElementById('textInputArea');
const problemTextInput = document.getElementById('problemText');

// Auth elements
const authLoggedOut = document.getElementById('authLoggedOut');
const authLoggedIn = document.getElementById('authLoggedIn');
const userEmailEl = document.getElementById('userEmail');
const showLoginBtn = document.getElementById('showLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginModal = document.getElementById('loginModal');
const closeLoginModal = document.getElementById('closeLoginModal');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const loginStatus = document.getElementById('loginStatus');

// History elements
const historySection = document.getElementById('historySection');
const historyList = document.getElementById('historyList');
const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');

// API Base URL (same origin for Cloudflare Pages Functions)
const API_BASE = '/api';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    initializeEventListeners();
    initializeAuthListeners();
    initPracticeEventListeners();
    loadChatHistory();
    initializeDebugPanel();

    // Check for Google OAuth callback
    await handleGoogleOAuthCallback();

    // Check current auth state
    await checkAuthState();

    // Load user stats if logged in
    await loadUserStats();

    debugLog.info('App initialized');
});

function initializeDebugPanel() {
    const toggleDebug = document.getElementById('toggleDebug');
    const debugContent = document.getElementById('debugContent');
    const clearDebug = document.getElementById('clearDebug');
    const copyDebug = document.getElementById('copyDebug');

    if (toggleDebug) {
        toggleDebug.addEventListener('click', () => {
            debugContent.hidden = !debugContent.hidden;
        });
    }

    if (clearDebug) {
        clearDebug.addEventListener('click', () => debugLog.clear());
    }

    if (copyDebug) {
        copyDebug.addEventListener('click', () => {
            navigator.clipboard.writeText(debugLog.getText())
                .then(() => alert('已複製到剪貼板'))
                .catch(() => alert('複製失敗'));
        });
    }
}

function initializeEventListeners() {
    // Input mode toggle
    modeImageBtn.addEventListener('click', () => switchInputMode('image'));
    modeTextBtn.addEventListener('click', () => switchInputMode('text'));

    // Upload area click
    uploadArea.addEventListener('click', () => imageInput.click());

    // File input change
    imageInput.addEventListener('change', handleImageSelect);

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleFile(file);
        }
    });

    // Remove image
    removeImage.addEventListener('click', (e) => {
        e.stopPropagation();
        clearImage();
    });

    // Text input change - update submit button
    problemTextInput.addEventListener('input', updateSubmitButton);

    // Toggle student attempt
    toggleAttempt.addEventListener('click', () => {
        const parent = toggleAttempt.parentElement;
        parent.classList.toggle('open');
        studentAttempt.hidden = !studentAttempt.hidden;
    });

    // Toggle final answer
    toggleAnswer.addEventListener('click', () => {
        finalAnswer.hidden = !finalAnswer.hidden;
        toggleAnswer.innerHTML = finalAnswer.hidden
            ? '<i class="fas fa-eye"></i> 顯示最終答案'
            : '<i class="fas fa-eye-slash"></i> 隱藏最終答案';
    });

    // Submit button
    submitBtn.addEventListener('click', handleSubmit);

    // Chat send
    sendChat.addEventListener('click', handleChatSend);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleChatSend();
        }
    });

    // New question
    newQuestionBtn.addEventListener('click', resetAll);

    // Enable submit when image is selected
    imageInput.addEventListener('change', updateSubmitButton);
}

// Switch between image and text input mode
function switchInputMode(mode) {
    inputMode = mode;

    // Update button states
    modeImageBtn.classList.toggle('active', mode === 'image');
    modeTextBtn.classList.toggle('active', mode === 'text');

    // Show/hide appropriate input areas
    uploadArea.hidden = mode === 'text';
    textInputArea.hidden = mode === 'image';

    // Update submit button state
    updateSubmitButton();

    debugLog.info(`Switched to ${mode} mode`);
}

function handleImageSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

async function handleFile(file) {
    // Check file size (max 3MB)
    if (file.size > 3 * 1024 * 1024) {
        showError('圖片太大，請壓縮至 3MB 以下');
        return;
    }

    // Check file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        showError('請上傳 JPG、PNG 或 WebP 格式的圖片');
        return;
    }

    currentImage = file;

    // Compress and convert to base64
    try {
        currentImageBase64 = await compressAndConvertToBase64(file);
        displayPreview(currentImageBase64);
        updateSubmitButton();
    } catch (err) {
        showError('圖片處理失敗，請重試');
        console.error(err);
    }
}

function compressAndConvertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Resize if too large (max 1280px width)
                let width = img.width;
                let height = img.height;
                const maxWidth = 1280;

                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to base64 with compression
                const base64 = canvas.toDataURL('image/jpeg', 0.85);
                resolve(base64);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function displayPreview(base64) {
    previewImg.src = base64;
    uploadPlaceholder.hidden = true;
    imagePreview.hidden = false;
}

function clearImage() {
    currentImage = null;
    currentImageBase64 = null;
    imageInput.value = '';
    uploadPlaceholder.hidden = false;
    imagePreview.hidden = true;
    updateSubmitButton();
}

function updateSubmitButton() {
    // Enable submit if: (image mode AND has image) OR (text mode AND has text)
    const hasImage = !!currentImageBase64;
    const hasText = problemTextInput.value.trim().length > 0;

    if (inputMode === 'image') {
        submitBtn.disabled = !hasImage;
    } else {
        submitBtn.disabled = !hasText;
    }
}

async function handleSubmit() {
    const hasImage = !!currentImageBase64;
    const problemText = problemTextInput.value.trim();
    const hasText = problemText.length > 0;

    // Validate based on mode
    if (inputMode === 'image' && !hasImage) {
        showError('請先上傳題目照片');
        return;
    }
    if (inputMode === 'text' && !hasText) {
        showError('請輸入題目內容');
        return;
    }

    // Show loading
    loading.hidden = false;
    submitBtn.disabled = true;
    resultsSection.hidden = true;
    chatSection.hidden = true;

    // Determine which API to call
    const isImageMode = inputMode === 'image' && hasImage;
    const apiEndpoint = isImageMode ? `${API_BASE}/explain-image` : `${API_BASE}/explain-text`;

    const requestPayload = {
        question: questionInput.value.trim(),
        studentLevel: levelSelect.value,
        mode: modeSelect.value,
        studentAttempt: studentAttempt.value.trim() || undefined,
    };

    if (isImageMode) {
        requestPayload.image = currentImageBase64;
        requestPayload.visionModel = visionModelSelect.value; // 'auto', 'gpt4o', 'gpt4o-mini', 'qwen-vl', 'gemini'
    } else {
        requestPayload.problemText = problemText;
    }

    debugLog.info(`Sending request to ${apiEndpoint}`, {
        inputMode,
        hasImage,
        hasText,
        question: requestPayload.question,
        level: requestPayload.studentLevel,
        mode: requestPayload.mode
    });

    try {
        const startTime = Date.now();
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestPayload),
        });

        const duration = Date.now() - startTime;
        debugLog.info(`Response received in ${duration}ms`, { status: response.status });

        if (!response.ok) {
            const errorText = await response.text();
            debugLog.error('API Error Response', { status: response.status, body: errorText });
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText };
            }
            throw new Error(errorData.error || `請求失敗 (${response.status})`);
        }

        const data = await response.json();
        debugLog.success('API Success', data);
        displayResults(data);

        // Save for chat context
        problemSummary = data.problemSummary;
        previousAnswer = data.answer;

        // Show chat section
        chatSection.hidden = false;
        newQuestionBtn.hidden = false;

        // Save to history (if logged in)
        if (currentUser) {
            // Prepare request data for history (without image base64 for storage efficiency)
            const historyRequestData = {
                question: requestPayload.question,
                studentLevel: requestPayload.studentLevel,
                mode: requestPayload.mode,
                studentAttempt: requestPayload.studentAttempt,
            };
            if (isImageMode) {
                historyRequestData.hasImage = true;
            } else {
                historyRequestData.problemText = problemText;
            }

            saveToHistory(isImageMode ? 'image' : 'text', historyRequestData, data);
        }

    } catch (err) {
        debugLog.error('Request failed', { message: err.message, stack: err.stack });
        showError(err.message || '處理失敗，請重試');
        console.error(err);
    } finally {
        loading.hidden = true;
        submitBtn.disabled = false;
    }
}

function displayResults(data) {
    resultsSection.hidden = false;

    // Check if this is Socratic mode (has _socratic flag or specific summary)
    const isSocraticMode = data._socratic || (data.problemSummary && data.problemSummary.includes('Socratic'));

    // Problem Summary - use formatMathSafe to handle LaTeX
    document.getElementById('problemSummary').innerHTML = formatMathSafe(data.problemSummary || '');

    // Steps - use formatMathSafe for LaTeX support
    const stepsContent = document.getElementById('stepsContent');
    if (data.answer?.steps?.length) {
        if (isSocraticMode) {
            // Interactive Socratic mode with progressive hints
            stepsContent.innerHTML = data.answer.steps.map((step, i) => {
                // Parse step to separate question from hints
                const lines = step.split('\n');
                const question = lines[0];
                const hints = lines.slice(1).filter(l => l.trim());

                return `
                <div class="step socratic-step">
                    <div class="step-number">❓ ${i + 1}</div>
                    <div class="step-content">
                        <div class="socratic-question">${formatMathSafe(question)}</div>
                        ${hints.length > 0 ? `
                        <div class="socratic-hints">
                            ${hints.map((hint, j) => `
                                <div class="hint-wrapper" data-hint="${j}">
                                    <button class="hint-toggle" onclick="toggleHint(this)">
                                        💡 顯示提示 ${j + 1} / Show Hint ${j + 1}
                                    </button>
                                    <div class="hint-content hidden">${formatMathSafe(hint.replace(/^💡\s*/, ''))}</div>
                                </div>
                            `).join('')}
                        </div>
                        ` : ''}
                        <div class="socratic-input-wrapper">
                            <input type="text" class="socratic-input" placeholder="輸入你的答案... / Your answer..." data-question="${i}">
                            <button class="socratic-check" onclick="checkSocraticAnswer(${i})">檢查 / Check</button>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        } else {
            // Normal mode
            stepsContent.innerHTML = data.answer.steps.map((step, i) => `
                <div class="step">
                    <div class="step-number">${i + 1}</div>
                    <div class="step-content">${formatMathSafe(step)}</div>
                </div>
            `).join('');
        }
    } else {
        stepsContent.innerHTML = '<p class="empty-hint">No steps available</p>';
    }

    // Common Mistakes - use formatMathSafe for LaTeX support
    const mistakesContent = document.getElementById('mistakesContent');
    if (data.answer?.commonMistakes?.length) {
        mistakesContent.innerHTML = '<ul>' + data.answer.commonMistakes.map(m =>
            `<li>${formatMathSafe(m)}</li>`
        ).join('') + '</ul>';
    } else {
        mistakesContent.innerHTML = '<p class="empty-hint">No common mistakes listed</p>';
    }

    // Exam Tips - use formatMathSafe for LaTeX support
    const tipsContent = document.getElementById('tipsContent');
    if (data.answer?.examTips?.length) {
        tipsContent.innerHTML = '<ul>' + data.answer.examTips.map(t =>
            `<li>${formatMathSafe(t)}</li>`
        ).join('') + '</ul>';
    } else {
        tipsContent.innerHTML = '<p class="empty-hint">No exam tips available</p>';
    }

    // Verification - use formatMathSafe for LaTeX support
    const verificationContent = document.getElementById('verificationContent');
    if (data.verification) {
        verificationContent.innerHTML = `<p>${formatMathSafe(data.verification)}</p>`;
    } else {
        verificationContent.innerHTML = '<p class="empty-hint">Verification complete</p>';
    }

    // Final Answer (hidden by default) - use formatMathSafe for LaTeX support
    const finalAnswerContent = document.getElementById('finalAnswer');
    if (data.answer?.finalAnswer) {
        finalAnswerContent.innerHTML = formatMathSafe(data.answer.finalAnswer);
    } else {
        finalAnswerContent.innerHTML = '<p class="empty-hint">See steps above</p>';
    }
    finalAnswerContent.hidden = true;

    // Glossary
    const glossaryContent = document.getElementById('glossaryContent');
    if (data.glossary && Object.keys(data.glossary).length) {
        glossaryContent.innerHTML = Object.entries(data.glossary).map(([term, translation]) => `
            <div class="term">
                <div class="term-original">${escapeHtml(term)}</div>
                <div class="term-translation">${escapeHtml(translation)}</div>
            </div>
        `).join('');
    } else {
        glossaryContent.innerHTML = '<p class="empty-hint">No glossary terms</p>';
    }

    // Re-render MathJax after DOM update
    if (window.MathJax && window.MathJax.typesetPromise) {
        MathJax.typesetPromise().catch(err => console.warn('MathJax error:', err));
    }

    // Show practice section for logged-in users (not in Socratic mode)
    if (currentUser && !isSocraticMode) {
        initPracticeSection(data);
    }
}

// ==================== Practice Section ====================
let currentPracticeId = null;
let selectedAnswer = null;
let currentCorrectAnswer = null; // Store correct answer for non-DB verification

async function initPracticeSection(data) {
    const practiceSection = document.getElementById('practiceSection');
    const practiceQuestion = document.getElementById('practiceQuestion');
    const practiceOptions = document.getElementById('practiceOptions');
    const practiceResult = document.getElementById('practiceResult');
    const submitPractice = document.getElementById('submitPractice');
    const skipPractice = document.getElementById('skipPractice');
    const nextPractice = document.getElementById('nextPractice');

    // Reset state
    currentPracticeId = null;
    selectedAnswer = null;
    currentCorrectAnswer = null;
    practiceResult.hidden = true;
    submitPractice.disabled = true;
    nextPractice.hidden = true;
    skipPractice.hidden = false;

    // Show section with loading state
    practiceSection.hidden = false;
    practiceQuestion.innerHTML = '<p class="practice-loading"><i class="fas fa-spinner fa-spin"></i> 正在生成練習題...</p>';
    practiceOptions.innerHTML = '';

    try {
        // Get the original question text
        const originalQuestion = data.problemSummary || problemSummary || '';
        const originalAnswer = data.answer?.finalAnswer || '';

        const response = await fetch(`${API_BASE}/practice/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                originalQuestion,
                originalAnswer,
                topic: data.topic || '',
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to generate practice question');
        }

        const practiceData = await response.json();
        currentPracticeId = practiceData.id;
        currentCorrectAnswer = practiceData.correctAnswer || null; // Store for fallback verification

        // Display question
        practiceQuestion.innerHTML = `<p class="question-text">${formatMathSafe(practiceData.question)}</p>`;

        // Display options
        practiceOptions.innerHTML = practiceData.options.map((option, index) => `
            <label class="practice-option" data-answer="${['A', 'B', 'C', 'D'][index]}">
                <input type="radio" name="practiceAnswer" value="${['A', 'B', 'C', 'D'][index]}">
                <span class="option-text">${formatMathSafe(option)}</span>
            </label>
        `).join('');

        // Add click handlers
        document.querySelectorAll('.practice-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.practice-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                selectedAnswer = option.dataset.answer;
                submitPractice.disabled = false;
            });
        });

        // Re-render MathJax
        if (window.MathJax && window.MathJax.typesetPromise) {
            MathJax.typesetPromise([practiceSection]).catch(err => console.warn('MathJax error:', err));
        }

        debugLog.success('Practice question generated', { id: practiceData.id });

    } catch (err) {
        console.error('Failed to generate practice:', err);
        practiceQuestion.innerHTML = '<p class="practice-error">無法生成練習題，請稍後再試</p>';
    }
}

async function submitPracticeAnswer() {
    if (!currentPracticeId || !selectedAnswer) return;

    const submitBtn = document.getElementById('submitPractice');
    const practiceResult = document.getElementById('practiceResult');
    const nextPractice = document.getElementById('nextPractice');
    const skipPractice = document.getElementById('skipPractice');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';

    try {
        const response = await fetch(`${API_BASE}/practice/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                practiceId: currentPracticeId,
                userAnswer: selectedAnswer,
                correctAnswer: currentCorrectAnswer, // Fallback for non-DB verification
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to submit answer');
        }

        const result = await response.json();

        // Show result
        practiceResult.hidden = false;
        practiceResult.className = `practice-result ${result.isCorrect ? 'correct' : 'incorrect'}`;

        let bonusText = '';
        if (result.streakBonus > 0) {
            bonusText = ` (+${result.streakBonus} 連續獎勵)`;
        }
        if (result.isFirstOfDay) {
            bonusText += ' (+5 首題獎勵)';
        }

        practiceResult.innerHTML = result.isCorrect
            ? `<div class="result-icon">✅</div>
               <div class="result-text">答對了！+${result.pointsEarned} 積分${bonusText}</div>`
            : `<div class="result-icon">❌</div>
               <div class="result-text">答錯了！正確答案是 ${result.correctAnswer}</div>`;

        // Highlight correct/wrong answers
        document.querySelectorAll('.practice-option').forEach(option => {
            if (option.dataset.answer === result.correctAnswer) {
                option.classList.add('correct-answer');
            } else if (option.dataset.answer === selectedAnswer && !result.isCorrect) {
                option.classList.add('wrong-answer');
            }
            option.querySelector('input').disabled = true;
        });

        // Update stats display
        document.getElementById('currentStreak').textContent = result.newStreak;
        document.getElementById('totalPoints').textContent = result.totalPoints;

        // Show next button
        nextPractice.hidden = false;
        skipPractice.hidden = true;

        debugLog.success('Practice answer submitted', result);

    } catch (err) {
        console.error('Failed to submit practice answer:', err);
        practiceResult.hidden = false;
        practiceResult.className = 'practice-result error';
        practiceResult.innerHTML = '<div class="result-text">提交失敗，請重試</div>';
    }

    submitBtn.innerHTML = '<i class="fas fa-check"></i> 提交答案 Submit';
}

function skipPracticeQuestion() {
    const practiceSection = document.getElementById('practiceSection');
    practiceSection.hidden = true;
    currentPracticeId = null;
    selectedAnswer = null;
    currentCorrectAnswer = null;
}

async function loadNextPractice() {
    // Get the stored problem data and regenerate
    if (lastRequestData) {
        initPracticeSection({
            problemSummary: problemSummary,
            answer: { finalAnswer: previousAnswer },
        });
    }
}

// Practice event listeners (added in DOMContentLoaded)
function initPracticeEventListeners() {
    const submitPractice = document.getElementById('submitPractice');
    const skipPractice = document.getElementById('skipPractice');
    const nextPractice = document.getElementById('nextPractice');

    if (submitPractice) {
        submitPractice.addEventListener('click', submitPracticeAnswer);
    }
    if (skipPractice) {
        skipPractice.addEventListener('click', skipPracticeQuestion);
    }
    if (nextPractice) {
        nextPractice.addEventListener('click', loadNextPractice);
    }
}

// Load user stats on page load
async function loadUserStats() {
    try {
        const response = await fetch(`${API_BASE}/user/stats`, {
            credentials: 'include',
        });

        if (!response.ok) return;

        const data = await response.json();
        if (data.loggedIn && data.stats) {
            // Update stats display
            const streakEl = document.getElementById('currentStreak');
            const pointsEl = document.getElementById('totalPoints');

            if (streakEl) streakEl.textContent = data.stats.currentStreak;
            if (pointsEl) pointsEl.textContent = data.stats.totalPoints;

            // Update header stats panel if exists
            updateHeaderStats(data.stats);
        }
    } catch (err) {
        console.warn('Failed to load user stats:', err);
    }
}

// Update header stats display
function updateHeaderStats(stats) {
    const headerStats = document.getElementById('headerStats');
    if (headerStats && stats) {
        headerStats.innerHTML = `
            <span class="header-stat">🎮 ${stats.totalPoints} pts</span>
            <span class="header-stat">🔥 ${stats.currentStreak}</span>
        `;
        headerStats.hidden = false;
    }
}

// ==================== End Practice Section ====================

async function handleChatSend() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Add user message to chat
    addChatMessage(message, 'user');
    chatInput.value = '';

    // Add to history
    chatHistory.push({ role: 'user', content: message });
    saveChatHistory();

    debugLog.info('Sending followup request', {
        question: message,
        needsVision: needsVision.checked,
        historyLength: chatHistory.length
    });

    try {
        const startTime = Date.now();
        const response = await fetch(`${API_BASE}/followup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                followupQuestion: message,
                problemSummary: problemSummary,
                previousAnswer: JSON.stringify(previousAnswer),
                chatHistory: chatHistory.slice(-10), // Last 10 messages
                needsVision: needsVision.checked,
                image: needsVision.checked ? currentImageBase64 : undefined,
            }),
        });

        const duration = Date.now() - startTime;
        debugLog.info(`Followup response in ${duration}ms`, { status: response.status });

        if (!response.ok) {
            const errorText = await response.text();
            debugLog.error('Followup API Error', { status: response.status, body: errorText });
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText };
            }
            throw new Error(errorData.error || `請求失敗 (${response.status})`);
        }

        const data = await response.json();
        debugLog.success('Followup success', data);

        // Add assistant reply to chat
        const replyText = formatChatReply(data.reply);
        addChatMessage(replyText, 'assistant');

        // Add to history
        chatHistory.push({ role: 'assistant', content: replyText });
        saveChatHistory();

        // Re-render MathJax
        if (window.MathJax) {
            MathJax.typesetPromise();
        }

    } catch (err) {
        debugLog.error('Followup failed', { message: err.message });
        addChatMessage(`錯誤：${err.message}`, 'assistant');
        console.error(err);
    }
}

function formatChatReply(reply) {
    if (typeof reply === 'string') return reply;

    let text = '';
    if (reply.shortAnswer) text += reply.shortAnswer + '\n\n';
    if (reply.explanation) text += reply.explanation + '\n\n';
    if (reply.examTip) text += '💡 Exam Tip: ' + reply.examTip;
    return text.trim() || '暫無回覆';
}

function addChatMessage(content, role) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    messageDiv.innerHTML = formatMath(escapeHtml(content));
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function resetAll() {
    clearImage();
    problemTextInput.value = '';
    questionInput.value = '';
    studentAttempt.value = '';
    levelSelect.value = 'standard';
    modeSelect.value = 'direct';
    resultsSection.hidden = true;
    chatSection.hidden = true;
    newQuestionBtn.hidden = true;
    chatMessages.innerHTML = '';
    problemSummary = null;
    previousAnswer = null;
    chatHistory = [];
    saveChatHistory();
    updateSubmitButton();
}

function showError(message) {
    // Remove existing error
    const existing = document.querySelector('.error-message');
    if (existing) existing.remove();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${escapeHtml(message)}`;

    const uploadSection = document.querySelector('.upload-section');
    uploadSection.insertBefore(errorDiv, uploadSection.firstChild);

    // Auto remove after 5 seconds
    setTimeout(() => errorDiv.remove(), 5000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Process text with LaTeX formulas
 * Protects LaTeX from HTML escaping while escaping other content
 */
function formatMathSafe(text) {
    if (!text) return '';

    // Placeholder for LaTeX blocks
    const latexBlocks = [];
    let processed = text;

    // Extract and protect display math ($$...$$) first
    processed = processed.replace(/\$\$([^$]+)\$\$/g, (match, latex) => {
        const idx = latexBlocks.length;
        latexBlocks.push(`\\[${latex}\\]`);
        return `%%LATEX_BLOCK_${idx}%%`;
    });

    // Extract and protect inline math ($...$)
    processed = processed.replace(/\$([^$]+)\$/g, (match, latex) => {
        const idx = latexBlocks.length;
        latexBlocks.push(`\\(${latex}\\)`);
        return `%%LATEX_BLOCK_${idx}%%`;
    });

    // Now escape HTML in the non-LaTeX parts
    processed = escapeHtml(processed);

    // Convert newlines to <br>
    processed = processed.replace(/\n/g, '<br>');

    // Restore LaTeX blocks
    latexBlocks.forEach((latex, idx) => {
        processed = processed.replace(`%%LATEX_BLOCK_${idx}%%`, latex);
    });

    return processed;
}

// Legacy function for backward compatibility
function formatMath(text) {
    return formatMathSafe(text);
}

// Socratic mode interaction functions
function toggleHint(button) {
    const wrapper = button.closest('.hint-wrapper');
    const content = wrapper.querySelector('.hint-content');

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        button.textContent = '🙈 隱藏提示 / Hide Hint';
        button.classList.add('revealed');

        // Re-render MathJax for the revealed hint
        if (window.MathJax && window.MathJax.typesetPromise) {
            MathJax.typesetPromise([content]).catch(err => console.warn('MathJax error:', err));
        }
    } else {
        content.classList.add('hidden');
        const hintNum = parseInt(wrapper.dataset.hint) + 1;
        button.textContent = `💡 顯示提示 ${hintNum} / Show Hint ${hintNum}`;
        button.classList.remove('revealed');
    }
}

function checkSocraticAnswer(questionIndex) {
    const input = document.querySelector(`.socratic-input[data-question="${questionIndex}"]`);
    const answer = input.value.trim();

    if (!answer) {
        alert('請輸入你的答案 / Please enter your answer');
        return;
    }

    // Show encouragement and reveal all hints for this question
    const step = input.closest('.socratic-step');
    const hints = step.querySelectorAll('.hint-content.hidden');

    hints.forEach(hint => {
        hint.classList.remove('hidden');
        const button = hint.previousElementSibling;
        if (button && button.classList.contains('hint-toggle')) {
            const hintNum = parseInt(button.closest('.hint-wrapper').dataset.hint) + 1;
            button.textContent = `🙈 隱藏提示 / Hide Hint`;
            button.classList.add('revealed');
        }
    });

    // Add feedback message
    const feedback = document.createElement('div');
    feedback.className = 'socratic-feedback';
    feedback.innerHTML = `
        <div class="your-answer">📝 你的答案 / Your answer: ${escapeHtml(answer)}</div>
        <div class="feedback-text">👍 好的嘗試！請查看提示來驗證你的思路。/ Good attempt! Check the hints to verify your thinking.</div>
    `;

    // Remove existing feedback if any
    const existingFeedback = step.querySelector('.socratic-feedback');
    if (existingFeedback) existingFeedback.remove();

    input.closest('.socratic-input-wrapper').after(feedback);

    // Re-render MathJax
    if (window.MathJax && window.MathJax.typesetPromise) {
        MathJax.typesetPromise([step]).catch(err => console.warn('MathJax error:', err));
    }
}

// Chat history persistence
function saveChatHistory() {
    try {
        const data = {
            problemSummary,
            previousAnswer,
            chatHistory: chatHistory.slice(-20), // Keep last 20 messages
        };
        localStorage.setItem('hkdse-physics-chat', JSON.stringify(data));
    } catch (e) {
        console.warn('Failed to save chat history:', e);
    }
}

function loadChatHistory() {
    try {
        const saved = localStorage.getItem('hkdse-physics-chat');
        if (saved) {
            const data = JSON.parse(saved);
            // Only restore if there's actual history
            if (data.chatHistory?.length > 0) {
                problemSummary = data.problemSummary;
                previousAnswer = data.previousAnswer;
                chatHistory = data.chatHistory;

                // Restore chat messages
                chatHistory.forEach(msg => {
                    addChatMessage(msg.content, msg.role);
                });
            }
        }
    } catch (e) {
        console.warn('Failed to load chat history:', e);
    }
}

// ============ Auth Functions ============

function initializeAuthListeners() {
    // Show login modal
    showLoginBtn.addEventListener('click', () => {
        loginModal.hidden = false;
    });

    // Close login modal
    closeLoginModal.addEventListener('click', () => {
        loginModal.hidden = true;
        loginStatus.hidden = true;
    });

    // Close modal on background click
    loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.hidden = true;
            loginStatus.hidden = true;
        }
    });

    // Google login
    googleLoginBtn.addEventListener('click', loginWithGoogle);

    // Logout
    logoutBtn.addEventListener('click', handleLogout);

    // Refresh history
    refreshHistoryBtn.addEventListener('click', loadHistory);
}

async function handleGoogleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (!code) return;

    debugLog.info('Found Google OAuth code in URL, processing...');

    try {
        const response = await fetch(`${API_BASE}/auth/google/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
            credentials: 'include',
        });

        const data = await response.json();

        if (response.ok && data.success) {
            debugLog.success('Google login successful', data.user);
            currentUser = data.user;
            updateAuthUI();
            // Close login modal
            loginModal.hidden = true;
            loginStatus.hidden = true;
            showSuccess('登入成功！');
        } else {
            debugLog.error('Google login failed', data);
            showError(data.error || '登入失敗');
        }
    } catch (err) {
        debugLog.error('Google login error', err);
        showError('登入失敗，請重試');
    }

    // Remove code from URL
    window.history.replaceState({}, document.title, window.location.pathname);
}

async function checkAuthState() {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            credentials: 'include',
        });

        const data = await response.json();

        if (data.user) {
            currentUser = data.user;
            debugLog.info('User is logged in', currentUser);
        } else {
            currentUser = null;
            debugLog.info('User is not logged in');
        }

        updateAuthUI();
    } catch (err) {
        debugLog.error('Auth check error', err);
        currentUser = null;
        updateAuthUI();
    }
}

function updateAuthUI() {
    if (currentUser) {
        authLoggedOut.hidden = true;
        authLoggedIn.hidden = false;
        userEmailEl.textContent = currentUser.email;
        historySection.hidden = false;
        // Always hide login modal when logged in
        loginModal.hidden = true;
        loginStatus.hidden = true;
        loadHistory();
    } else {
        authLoggedOut.hidden = false;
        authLoggedIn.hidden = true;
        userEmailEl.textContent = '';
        historySection.hidden = true;
    }
}

async function loginWithGoogle() {
    googleLoginBtn.disabled = true;
    googleLoginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 跳轉中...';

    try {
        // Get Google OAuth URL from backend
        const response = await fetch(`${API_BASE}/auth/google/url`);
        const data = await response.json();

        if (response.ok && data.url) {
            debugLog.info('Redirecting to Google OAuth', { url: data.url });
            // Redirect to Google OAuth
            window.location.href = data.url;
        } else {
            showLoginStatus(data.error || '無法獲取登入連結', 'error');
            debugLog.error('Failed to get Google OAuth URL', data);
            googleLoginBtn.disabled = false;
            googleLoginBtn.innerHTML = '<svg class="google-icon" viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> 用 Google 帳號登入';
        }
    } catch (err) {
        showLoginStatus('登入失敗，請重試', 'error');
        debugLog.error('Google login error', err);
        googleLoginBtn.disabled = false;
        googleLoginBtn.innerHTML = '<svg class="google-icon" viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> 用 Google 帳號登入';
    }
}

function showLoginStatus(message, type) {
    loginStatus.textContent = message;
    loginStatus.className = `login-status ${type}`;
    loginStatus.hidden = false;
}

async function handleLogout() {
    try {
        await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
        });

        currentUser = null;
        updateAuthUI();
        debugLog.info('Logged out');
    } catch (err) {
        debugLog.error('Logout error', err);
    }
}

// ============ History Functions ============

async function loadHistory() {
    if (!currentUser) return;

    try {
        const response = await fetch(`${API_BASE}/history/list?limit=20`, {
            credentials: 'include',
        });

        const data = await response.json();

        if (response.ok && data.items) {
            renderHistoryList(data.items);
            debugLog.info('History loaded', { count: data.items.length });
        } else {
            debugLog.error('History load failed', data);
        }
    } catch (err) {
        debugLog.error('History load error', err);
    }
}

function renderHistoryList(items) {
    if (!items || items.length === 0) {
        historyList.innerHTML = '<p class="history-empty">暫無歷史記錄</p>';
        return;
    }

    historyList.innerHTML = items.map(item => {
        const icon = item.kind === 'image' ? 'fa-image' : 'fa-keyboard';
        const summary = item.problemSummary || '（無摘要）';
        const date = formatDate(item.createdAt);

        return `
            <div class="history-item" data-id="${item.id}">
                <div class="history-item-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="history-item-content">
                    <div class="history-item-summary">${escapeHtml(summary)}</div>
                    <div class="history-item-date">${date}</div>
                </div>
            </div>
        `;
    }).join('');

    // Add click handlers
    historyList.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => loadHistoryItem(item.dataset.id));
    });
}

function formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;

    // Less than 1 hour ago
    if (diff < 60 * 60 * 1000) {
        const minutes = Math.floor(diff / 60000);
        return minutes <= 1 ? '剛才' : `${minutes} 分鐘前`;
    }

    // Less than 24 hours ago
    if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        return `${hours} 小時前`;
    }

    // Less than 7 days ago
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        return `${days} 天前`;
    }

    // Show full date
    return date.toLocaleDateString('zh-HK', {
        month: 'short',
        day: 'numeric',
    });
}

async function loadHistoryItem(historyId) {
    debugLog.info('Loading history item', { id: historyId });

    try {
        const response = await fetch(`${API_BASE}/history/get?id=${historyId}`, {
            credentials: 'include',
        });

        const data = await response.json();

        if (response.ok) {
            // Restore the problem and response
            restoreFromHistory(data);
            debugLog.success('History item loaded', data);
        } else {
            showError(data.error || '載入失敗');
            debugLog.error('History item load failed', data);
        }
    } catch (err) {
        showError('載入失敗，請重試');
        debugLog.error('History item load error', err);
    }
}

function restoreFromHistory(historyData) {
    const { kind, requestData, responseData } = historyData;

    // Reset current state
    resetAll();

    // Switch to appropriate mode
    switchInputMode(kind);

    // Restore request data
    if (kind === 'image' && requestData.image) {
        // For image mode, we can't restore the actual image file
        // but we can show the response
    } else if (kind === 'text' && requestData.problemText) {
        problemTextInput.value = requestData.problemText;
    }

    if (requestData.question) {
        questionInput.value = requestData.question;
    }
    if (requestData.studentLevel) {
        levelSelect.value = requestData.studentLevel;
    }
    if (requestData.mode) {
        modeSelect.value = requestData.mode;
    }
    if (requestData.studentAttempt) {
        studentAttempt.value = requestData.studentAttempt;
        studentAttempt.hidden = false;
        toggleAttempt.parentElement.classList.add('open');
    }

    // Display results
    displayResults(responseData);

    // Restore for chat context
    problemSummary = responseData.problemSummary;
    previousAnswer = responseData.answer;

    // Show chat section
    chatSection.hidden = false;
    newQuestionBtn.hidden = false;

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

async function saveToHistory(kind, requestData, responseData) {
    if (!currentUser) return;

    try {
        const response = await fetch(`${API_BASE}/history/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                kind,
                problemSummary: responseData.problemSummary,
                requestData,
                responseData,
            }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            debugLog.success('History saved', { id: data.historyId });
            // Refresh history list
            loadHistory();
        } else {
            debugLog.error('History save failed', data);
        }
    } catch (err) {
        debugLog.error('History save error', err);
    }
}

function showSuccess(message) {
    // Remove existing success message
    const existing = document.querySelector('.success-message');
    if (existing) existing.remove();

    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${escapeHtml(message)}`;

    const header = document.querySelector('.header');
    header.insertAdjacentElement('afterend', successDiv);

    // Auto remove after 5 seconds
    setTimeout(() => successDiv.remove(), 5000);
}
