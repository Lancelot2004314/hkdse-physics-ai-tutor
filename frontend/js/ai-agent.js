/**
 * AI Agent - Lancelot Assistant
 * An interactive 3D cartoon knight assistant with voice support
 */

class AIAgent {
    constructor(options = {}) {
        this.options = {
            containerId: 'ai-agent-root',
            theme: 'knight', // 'default' or 'knight'
            welcomeMessage: '你好！我是 Lancelot，你的物理學習助手。有什麼可以幫你的嗎？',
            agentName: 'Lancelot',
            agentTitle: '物理學習助手',
            quickActions: [
                { text: '如何使用 AI Tutor？', action: '如何使用 AI Tutor？' },
                { text: '開始練習題', action: '我想開始做練習題' },
                { text: '查看排行榜', action: '怎麼查看排行榜？' }
            ],
            ...options
        };

        this.isOpen = false;
        this.isRecording = false;
        this.isSpeaking = false;
        this.messages = [];
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentAudio = null;
        this.threeRenderer = null;
        this.avatar = null;

        this.init();
    }

    init() {
        this.createDOM();
        this.bindEvents();
        this.initThreeJS();

        // Add welcome message
        setTimeout(() => {
            this.addMessage(this.options.welcomeMessage, 'assistant');
        }, 500);
    }

    createDOM() {
        // Create container
        const container = document.createElement('div');
        container.id = this.options.containerId;
        container.className = `ai-agent-container ${this.options.theme === 'knight' ? 'knight-theme' : ''}`;

        container.innerHTML = `
            <!-- Avatar Button -->
            <div class="ai-agent-avatar" id="agentAvatar">
                <div class="ai-agent-avatar-3d" id="agentAvatar3D"></div>
                <div class="ai-agent-avatar-fallback" id="agentAvatarFallback">⚔️</div>
                <div class="ai-agent-status" id="agentStatus"></div>
            </div>

            <!-- Chatbox -->
            <div class="ai-agent-chatbox" id="agentChatbox">
                <!-- Header -->
                <div class="ai-agent-header">
                    <div class="ai-agent-header-avatar">🛡️</div>
                    <div class="ai-agent-header-info">
                        <div class="ai-agent-header-name">${this.options.agentName}</div>
                        <div class="ai-agent-header-status">${this.options.agentTitle}</div>
                    </div>
                    <button class="ai-agent-close" id="agentClose">&times;</button>
                </div>

                <!-- Messages -->
                <div class="ai-agent-messages" id="agentMessages">
                    <!-- Messages will be added here -->
                </div>

                <!-- Quick Actions -->
                <div class="ai-agent-quick-actions" id="agentQuickActions">
                    ${this.options.quickActions.map(action =>
            `<button class="ai-agent-quick-btn" data-action="${action.action}">${action.text}</button>`
        ).join('')}
                </div>

                <!-- Input Area -->
                <div class="ai-agent-input-area">
                    <div class="ai-agent-input-row">
                        <input type="text" class="ai-agent-input" id="agentInput" 
                               placeholder="輸入訊息或點擊麥克風說話..." />
                        <button class="ai-agent-btn ai-agent-btn-voice" id="agentVoiceBtn">
                            🎤
                        </button>
                        <button class="ai-agent-btn ai-agent-btn-send" id="agentSendBtn">
                            ➤
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        // Store references
        this.container = container;
        this.avatarEl = container.querySelector('#agentAvatar');
        this.avatar3DEl = container.querySelector('#agentAvatar3D');
        this.avatarFallbackEl = container.querySelector('#agentAvatarFallback');
        this.statusEl = container.querySelector('#agentStatus');
        this.chatboxEl = container.querySelector('#agentChatbox');
        this.messagesEl = container.querySelector('#agentMessages');
        this.inputEl = container.querySelector('#agentInput');
        this.voiceBtnEl = container.querySelector('#agentVoiceBtn');
        this.sendBtnEl = container.querySelector('#agentSendBtn');
        this.quickActionsEl = container.querySelector('#agentQuickActions');
    }

    bindEvents() {
        // Toggle chatbox
        this.avatarEl.addEventListener('click', () => this.toggle());
        this.container.querySelector('#agentClose').addEventListener('click', () => this.close());

        // Send message
        this.sendBtnEl.addEventListener('click', () => this.sendMessage());
        this.inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Voice input
        this.voiceBtnEl.addEventListener('click', () => this.toggleRecording());

        // Quick actions
        this.quickActionsEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('ai-agent-quick-btn')) {
                const action = e.target.dataset.action;
                this.inputEl.value = action;
                this.sendMessage();
            }
        });

        // Update send button state
        this.inputEl.addEventListener('input', () => {
            this.sendBtnEl.disabled = !this.inputEl.value.trim();
        });
    }

    initThreeJS() {
        // Load Three.js dynamically if not already loaded
        if (typeof THREE === 'undefined') {
            this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js')
                .then(() => this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js'))
                .then(() => this.setup3DAvatar())
                .catch(err => {
                    console.warn('Failed to load Three.js, using fallback avatar:', err);
                    this.avatarFallbackEl.style.display = 'flex';
                });
        } else {
            this.setup3DAvatar();
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    setup3DAvatar() {
        try {
            const width = 80;
            const height = 80;

            // Create scene
            this.scene = new THREE.Scene();
            this.scene.background = null; // Transparent

            // Create camera
            this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
            this.camera.position.z = 3;
            this.camera.position.y = 0.5;

            // Create renderer
            this.threeRenderer = new THREE.WebGLRenderer({
                alpha: true,
                antialias: true
            });
            this.threeRenderer.setSize(width, height);
            this.threeRenderer.setPixelRatio(window.devicePixelRatio);
            this.avatar3DEl.appendChild(this.threeRenderer.domElement);

            // Add lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            this.scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(2, 2, 2);
            this.scene.add(directionalLight);

            // Create a simple knight character (placeholder)
            this.createKnightPlaceholder();

            // Hide fallback
            this.avatarFallbackEl.style.display = 'none';

            // Start animation loop
            this.animate();

        } catch (err) {
            console.error('3D Avatar setup failed:', err);
            this.avatarFallbackEl.style.display = 'flex';
        }
    }

    createKnightPlaceholder() {
        // Create a stylized knight head
        const group = new THREE.Group();

        // Helmet
        const helmetGeometry = new THREE.SphereGeometry(0.6, 32, 32);
        const helmetMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a5568,
            metalness: 0.8,
            roughness: 0.2
        });
        const helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
        helmet.scale.set(1, 1.1, 0.9);
        group.add(helmet);

        // Visor
        const visorGeometry = new THREE.BoxGeometry(0.8, 0.15, 0.5);
        const visorMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a202c,
            metalness: 0.9,
            roughness: 0.1
        });
        const visor = new THREE.Mesh(visorGeometry, visorMaterial);
        visor.position.set(0, 0.1, 0.3);
        group.add(visor);

        // Plume (decorative)
        const plumeGeometry = new THREE.ConeGeometry(0.15, 0.8, 8);
        const plumeMaterial = new THREE.MeshStandardMaterial({
            color: 0x9f1239,
            metalness: 0.2,
            roughness: 0.8
        });
        const plume = new THREE.Mesh(plumeGeometry, plumeMaterial);
        plume.position.set(0, 0.8, 0);
        plume.rotation.z = 0.2;
        group.add(plume);

        // Eyes (glowing effect)
        const eyeGeometry = new THREE.SphereGeometry(0.08, 16, 16);
        const eyeMaterial = new THREE.MeshBasicMaterial({
            color: 0x60a5fa,
            emissive: 0x60a5fa
        });

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.18, 0.15, 0.45);
        group.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.18, 0.15, 0.45);
        group.add(rightEye);

        this.avatar = group;
        this.scene.add(group);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.avatar) {
            // Idle animation - gentle floating
            const time = Date.now() * 0.001;
            this.avatar.rotation.y = Math.sin(time * 0.5) * 0.1;
            this.avatar.position.y = Math.sin(time * 2) * 0.02;

            // Speaking animation - more movement
            if (this.isSpeaking) {
                this.avatar.rotation.x = Math.sin(time * 8) * 0.05;
                this.avatar.scale.setScalar(1 + Math.sin(time * 10) * 0.02);
            } else {
                this.avatar.rotation.x = 0;
                this.avatar.scale.setScalar(1);
            }
        }

        if (this.threeRenderer && this.scene && this.camera) {
            this.threeRenderer.render(this.scene, this.camera);
        }
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.isOpen = true;
        this.chatboxEl.classList.add('open');
        this.inputEl.focus();
    }

    close() {
        this.isOpen = false;
        this.chatboxEl.classList.remove('open');
    }

    addMessage(content, role) {
        const messageEl = document.createElement('div');
        messageEl.className = `ai-agent-message ${role}`;
        messageEl.textContent = content;
        this.messagesEl.appendChild(messageEl);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

        this.messages.push({ role, content });

        // Hide quick actions after first user message
        if (role === 'user' && this.quickActionsEl) {
            this.quickActionsEl.style.display = 'none';
        }
    }

    showTyping() {
        const typingEl = document.createElement('div');
        typingEl.className = 'ai-agent-message assistant typing';
        typingEl.id = 'agentTyping';
        typingEl.innerHTML = '<span></span><span></span><span></span>';
        this.messagesEl.appendChild(typingEl);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    hideTyping() {
        const typingEl = document.getElementById('agentTyping');
        if (typingEl) {
            typingEl.remove();
        }
    }

    setStatus(status) {
        this.statusEl.className = 'ai-agent-status';
        if (status === 'thinking') {
            this.statusEl.classList.add('thinking');
        } else if (status === 'offline') {
            this.statusEl.classList.add('offline');
        }
    }

    async sendMessage() {
        const text = this.inputEl.value.trim();
        if (!text) return;

        // Clear input
        this.inputEl.value = '';
        this.sendBtnEl.disabled = true;

        // Add user message
        this.addMessage(text, 'user');

        // Show typing indicator
        this.showTyping();
        this.setStatus('thinking');

        try {
            // Call chat API
            const response = await fetch('/api/agent/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    message: text,
                    history: this.messages.slice(-10)
                })
            });

            if (!response.ok) {
                throw new Error('Chat API error');
            }

            const data = await response.json();

            // Hide typing
            this.hideTyping();
            this.setStatus('online');

            // Add assistant message
            this.addMessage(data.reply, 'assistant');

            // Speak the response
            await this.speak(data.reply);

        } catch (err) {
            console.error('Send message error:', err);
            this.hideTyping();
            this.setStatus('online');
            this.addMessage('抱歉，我遇到了一些問題。請稍後再試。', 'assistant');
        }
    }

    async speak(text) {
        if (!text) return;

        try {
            this.isSpeaking = true;
            this.avatarEl.classList.add('speaking');

            // Try server TTS first, fallback to browser Web Speech API
            let usedServerTTS = false;

            try {
                // Call TTS API
                const response = await fetch('/api/agent/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, voice: 'nova' })
                });

                if (response.ok) {
                    // Play audio from server
                    const audioBlob = await response.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    
                    this.currentAudio = new Audio(audioUrl);
                    
                    this.currentAudio.onended = () => {
                        this.isSpeaking = false;
                        this.avatarEl.classList.remove('speaking');
                        URL.revokeObjectURL(audioUrl);
                    };

                    this.currentAudio.onerror = () => {
                        this.isSpeaking = false;
                        this.avatarEl.classList.remove('speaking');
                    };

                    await this.currentAudio.play();
                    usedServerTTS = true;
                }
            } catch (serverErr) {
                console.warn('Server TTS failed, using browser TTS:', serverErr);
            }

            // Fallback to browser's Web Speech API (free!)
            if (!usedServerTTS && 'speechSynthesis' in window) {
                await this.speakWithBrowserTTS(text);
            } else if (!usedServerTTS) {
                // No TTS available, just animate briefly
                setTimeout(() => {
                    this.isSpeaking = false;
                    this.avatarEl.classList.remove('speaking');
                }, 2000);
            }

            return;

        } catch (err) {
            console.error('Speech error:', err);
            this.isSpeaking = false;
            this.avatarEl.classList.remove('speaking');
        }
    }

    // Browser's free Web Speech API
    speakWithBrowserTTS(text) {
        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Try to find a Chinese voice
            const voices = speechSynthesis.getVoices();
            const chineseVoice = voices.find(v => 
                v.lang.includes('zh') || v.lang.includes('cmn')
            );
            if (chineseVoice) {
                utterance.voice = chineseVoice;
            }
            
            utterance.rate = 1.0;
            utterance.pitch = 1.1;
            
            utterance.onend = () => {
                this.isSpeaking = false;
                this.avatarEl.classList.remove('speaking');
                resolve();
            };
            
            utterance.onerror = () => {
                this.isSpeaking = false;
                this.avatarEl.classList.remove('speaking');
                resolve();
            };
            
            speechSynthesis.speak(utterance);
        });
    }

    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (e) => {
                this.audioChunks.push(e.data);
            };

            this.mediaRecorder.onstop = async () => {
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());

                // Create blob and send to STT
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                await this.transcribeAudio(audioBlob);
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.voiceBtnEl.classList.add('recording');
            this.voiceBtnEl.textContent = '⏹️';

        } catch (err) {
            console.error('Recording error:', err);
            alert('無法存取麥克風。請確保已授予錄音權限。');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.voiceBtnEl.classList.remove('recording');
            this.voiceBtnEl.textContent = '🎤';
        }
    }

    async transcribeAudio(audioBlob) {
        try {
            this.setStatus('thinking');

            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');

            const response = await fetch('/api/agent/stt', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('STT API error');
            }

            const data = await response.json();

            if (data.text && data.text.trim()) {
                this.inputEl.value = data.text;
                this.sendMessage();
            } else {
                this.setStatus('online');
            }

        } catch (err) {
            console.error('Transcription error:', err);
            this.setStatus('online');
            this.addMessage('抱歉，我無法識別你說的話。請再試一次或輸入文字。', 'assistant');
        }
    }

    destroy() {
        if (this.currentAudio) {
            this.currentAudio.pause();
        }
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
        }
        if (this.threeRenderer) {
            this.threeRenderer.dispose();
        }
        if (this.container) {
            this.container.remove();
        }
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize AI Agent
    window.aiAgent = new AIAgent({
        theme: 'knight',
        agentName: 'Lancelot',
        agentTitle: '物理學習助手',
        welcomeMessage: '你好！我是 Lancelot，你的物理學習助手。有什麼可以幫你的嗎？⚔️',
        quickActions: [
            { text: '如何使用 AI Tutor？', action: '請問如何使用 AI Tutor 功能？' },
            { text: '開始練習題', action: '我想開始做練習題，該怎麼操作？' },
            { text: '物理問題', action: '我有一個物理問題想問你' }
        ]
    });
});

