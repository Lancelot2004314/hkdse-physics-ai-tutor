// HKDSE Physics AI Tutor - Frontend Application

// State
let currentImage = null;
let currentImageBase64 = null;
let problemSummary = null;
let previousAnswer = null;
let chatHistory = [];

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

// API Base URL (same origin for Cloudflare Pages Functions)
const API_BASE = '/api';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadChatHistory();
    initializeDebugPanel();
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
    submitBtn.disabled = !currentImageBase64;
}

async function handleSubmit() {
    if (!currentImageBase64) {
        showError('請先上傳題目照片');
        return;
    }

    // Show loading
    loading.hidden = false;
    submitBtn.disabled = true;
    resultsSection.hidden = true;
    chatSection.hidden = true;

    const requestBody = {
        image: currentImageBase64.substring(0, 100) + '...[truncated]',
        question: questionInput.value.trim(),
        studentLevel: levelSelect.value,
        mode: modeSelect.value,
        studentAttempt: studentAttempt.value.trim() || undefined,
    };

    debugLog.info('Sending request to /api/explain-image', {
        imageSize: currentImageBase64.length,
        question: requestBody.question,
        level: requestBody.studentLevel,
        mode: requestBody.mode
    });

    try {
        const startTime = Date.now();
        const response = await fetch(`${API_BASE}/explain-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: currentImageBase64,
                question: questionInput.value.trim(),
                studentLevel: levelSelect.value,
                mode: modeSelect.value,
                studentAttempt: studentAttempt.value.trim() || undefined,
            }),
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
