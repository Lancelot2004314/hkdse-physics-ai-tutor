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
const loginEmailInput = document.getElementById('loginEmail');
const sendMagicLinkBtn = document.getElementById('sendMagicLinkBtn');
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
    loadChatHistory();
    initializeDebugPanel();

    // Check for magic token in URL
    await handleMagicLinkToken();

    // Check current auth state
    await checkAuthState();

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

    // Problem Summary
    document.getElementById('problemSummary').innerHTML = escapeHtml(data.problemSummary || '');

    // Steps
    const stepsContent = document.getElementById('stepsContent');
    if (data.answer?.steps?.length) {
        stepsContent.innerHTML = data.answer.steps.map((step, i) => `
            <div class="step">
                <div class="step-number">Step ${i + 1}</div>
                <div class="step-content">${formatMath(escapeHtml(step))}</div>
            </div>
        `).join('');
    } else {
        stepsContent.innerHTML = '<p>暫無分步講解</p>';
    }

    // Common Mistakes
    const mistakesContent = document.getElementById('mistakesContent');
    if (data.answer?.commonMistakes?.length) {
        mistakesContent.innerHTML = '<ul>' + data.answer.commonMistakes.map(m =>
            `<li>${escapeHtml(m)}</li>`
        ).join('') + '</ul>';
    } else {
        mistakesContent.innerHTML = '<p>暫無常見錯誤提示</p>';
    }

    // Exam Tips
    const tipsContent = document.getElementById('tipsContent');
    if (data.answer?.examTips?.length) {
        tipsContent.innerHTML = '<ul>' + data.answer.examTips.map(t =>
            `<li>${escapeHtml(t)}</li>`
        ).join('') + '</ul>';
    } else {
        tipsContent.innerHTML = '<p>暫無考試提示</p>';
    }

    // Verification
    const verificationContent = document.getElementById('verificationContent');
    if (data.verification) {
        verificationContent.innerHTML = `<p>${escapeHtml(data.verification)}</p>`;
    } else {
        verificationContent.innerHTML = '<p>驗算檢查完成</p>';
    }

    // Final Answer (hidden by default)
    const finalAnswerContent = document.getElementById('finalAnswer');
    if (data.answer?.finalAnswer) {
        finalAnswerContent.innerHTML = formatMath(escapeHtml(data.answer.finalAnswer));
    } else {
        finalAnswerContent.innerHTML = '<p>請參考分步講解</p>';
    }
    finalAnswerContent.hidden = true;

    // Glossary
    const glossaryContent = document.getElementById('glossaryContent');
    if (data.glossary && Object.keys(data.glossary).length) {
        glossaryContent.innerHTML = Object.entries(data.glossary).map(([en, zh]) => `
            <div class="term">
                <div class="term-en">${escapeHtml(en)}</div>
                <div class="term-zh">${escapeHtml(zh)}</div>
            </div>
        `).join('');
    } else {
        glossaryContent.innerHTML = '<p>暫無術語對照</p>';
    }

    // Re-render MathJax
    if (window.MathJax) {
        MathJax.typesetPromise();
    }
}

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

function formatMath(text) {
    // Convert common physics notation to LaTeX
    // This is a simple implementation; can be enhanced
    return text
        .replace(/\$([^$]+)\$/g, '\\($1\\)') // Inline math
        .replace(/\n/g, '<br>');
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
        loginEmailInput.focus();
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

    // Send magic link
    sendMagicLinkBtn.addEventListener('click', sendMagicLink);
    loginEmailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMagicLink();
    });

    // Logout
    logoutBtn.addEventListener('click', handleLogout);

    // Refresh history
    refreshHistoryBtn.addEventListener('click', loadHistory);
}

async function handleMagicLinkToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const magicToken = urlParams.get('magic_token');

    if (!magicToken) return;

    debugLog.info('Found magic token in URL, verifying...');

    try {
        const response = await fetch(`${API_BASE}/auth/verify-magic-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: magicToken }),
            credentials: 'include',
        });

        const data = await response.json();

        if (response.ok && data.success) {
            debugLog.success('Magic link verified', data.user);
            currentUser = data.user;
            updateAuthUI();
            showSuccess('登入成功！');
        } else {
            debugLog.error('Magic link verification failed', data);
            showError(data.error || '登入連結無效');
        }
    } catch (err) {
        debugLog.error('Magic link verification error', err);
        showError('登入失敗，請重試');
    }

    // Remove token from URL
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
        loadHistory();
    } else {
        authLoggedOut.hidden = false;
        authLoggedIn.hidden = true;
        userEmailEl.textContent = '';
        historySection.hidden = true;
    }
}

async function sendMagicLink() {
    const email = loginEmailInput.value.trim();

    if (!email) {
        showLoginStatus('請輸入電郵地址', 'error');
        return;
    }

    sendMagicLinkBtn.disabled = true;
    sendMagicLinkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 發送中...';

    try {
        const response = await fetch(`${API_BASE}/auth/request-magic-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showLoginStatus('已發送登入連結到你的電郵，請查收', 'success');
            debugLog.success('Magic link sent', { email });
        } else {
            showLoginStatus(data.error || '發送失敗，請重試', 'error');
            debugLog.error('Magic link send failed', data);
        }
    } catch (err) {
        showLoginStatus('發送失敗，請重試', 'error');
        debugLog.error('Magic link send error', err);
    } finally {
        sendMagicLinkBtn.disabled = false;
        sendMagicLinkBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 發送登入連結';
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
