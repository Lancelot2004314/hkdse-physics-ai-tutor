/**
 * AI Agent - Lancelot Assistant
 * An interactive 3D cartoon knight assistant with voice support
 */

class AIAgent {
    constructor(options = {}) {
        this.options = {
            containerId: 'ai-agent-root',
            theme: 'knight', // 'default' or 'knight'
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
        
        // Web Speech API recognition instance
        this.recognition = null;
        this.voicesLoaded = false;
        this.cachedVoices = [];
        
        // Preferred female voices by quality (in priority order)
        this.preferredVoices = [
            // Google voices (Chrome) - high quality
            'Google 粤語（香港）',
            'Google 普通话（中国大陆）',
            'Google US English',
            // Apple voices (macOS/iOS) - high quality
            'Sinji',              // Cantonese
            'Ting-Ting',          // Mandarin
            'Mei-Jia',            // Mandarin Taiwan
            'Samantha',           // English
            // Microsoft voices (Windows/Edge)
            'Microsoft Yaoyao',   // Mandarin
            'Microsoft Huihui',   // Mandarin
            'Microsoft Tracy',    // Cantonese
            'Microsoft Zira',     // English
        ];

        this.init();
    }

    /**
     * Get translation from i18n system
     */
    t(key) {
        // #region agent log
        const hasT = window.i18n && typeof window.i18n.t === 'function';
        const result = hasT ? window.i18n.t(key) : null;
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ai-agent.js:t',message:'Translation lookup',data:{key,hasT,result,isKeyReturned:result===key},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F,G,H'})}).catch(()=>{});
        // #endregion

        if (window.i18n && typeof window.i18n.t === 'function') {
            const translated = window.i18n.t(key);
            // If i18n returns the key itself, translations not loaded yet - use fallback
            if (translated !== key) {
                return translated;
            }
        }
        // Fallback translations (used when i18n not ready or key not found)
        const fallbacks = {
            'aiAgent.name': 'Lancelot',
            'aiAgent.title': 'Physics Learning Assistant',
            'aiAgent.welcome': 'Hello! I\'m Lancelot, your physics learning assistant. How can I help you? ⚔️',
            'aiAgent.placeholder': 'Type a message or click the mic to speak...',
            'aiAgent.quickAction1': 'How to use AI Tutor?',
            'aiAgent.quickAction1Full': 'How do I use the AI Tutor feature?',
            'aiAgent.quickAction2': 'Start Practice',
            'aiAgent.quickAction2Full': 'I want to start practice questions',
            'aiAgent.quickAction3': 'Physics Question',
            'aiAgent.quickAction3Full': 'I have a physics question',
            'aiAgent.error': 'Sorry, I encountered an issue. Please try again later.',
            'aiAgent.browserNotSupported': 'Your browser does not support speech recognition.',
            'aiAgent.noSpeech': 'No speech detected, please try again.',
            'aiAgent.micError': 'Cannot access microphone. Please check permissions.',
            'aiAgent.micDenied': 'Microphone permission denied.',
            'aiAgent.networkError': 'Network error, please check connection.',
            'aiAgent.speechCancelled': 'Speech recognition cancelled.',
            'aiAgent.langNotSupported': 'Language not supported.',
            'aiAgent.speechFailed': 'Speech recognition failed. Please try again or type.'
        };
        return fallbacks[key] || key;
    }

    init() {
        // #region agent log
        const initLang = this.getCurrentLanguage();
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ai-agent.js:init',message:'AIAgent initializing',data:{detectedLang:initLang,translationTest:this.t('aiAgent.welcome')},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C,D'})}).catch(()=>{});
        // #endregion

        this.createDOM();
        this.bindEvents();
        this.initThreeJS();
        this.initWebSpeechAPI();
        this.listenForLanguageChange();

        // Add welcome message
        setTimeout(() => {
            this.addMessage(this.t('aiAgent.welcome'), 'assistant');
        }, 500);
    }

    /**
     * Listen for language changes and update UI
     */
    listenForLanguageChange() {
        window.addEventListener('languageChanged', () => {
            this.updateUILanguage();
        });
    }

    /**
     * Update all UI text when language changes
     */
    updateUILanguage() {
        // Update header
        const headerName = this.container.querySelector('.ai-agent-header-name');
        const headerStatus = this.container.querySelector('.ai-agent-header-status');
        if (headerName) headerName.textContent = this.t('aiAgent.name');
        if (headerStatus) headerStatus.textContent = this.t('aiAgent.title');

        // Update input placeholder
        if (this.inputEl) {
            this.inputEl.placeholder = this.t('aiAgent.placeholder');
        }

        // Update quick actions
        const quickBtns = this.container.querySelectorAll('.ai-agent-quick-btn');
        if (quickBtns.length >= 3) {
            quickBtns[0].textContent = this.t('aiAgent.quickAction1');
            quickBtns[0].dataset.action = this.t('aiAgent.quickAction1Full');
            quickBtns[1].textContent = this.t('aiAgent.quickAction2');
            quickBtns[1].dataset.action = this.t('aiAgent.quickAction2Full');
            quickBtns[2].textContent = this.t('aiAgent.quickAction3');
            quickBtns[2].dataset.action = this.t('aiAgent.quickAction3Full');
        }

        // Update speech recognition language
        if (this.recognition) {
            this.recognition.lang = this.getSpeechRecognitionLang();
        }
    }

    /**
     * Get current language from i18n system or browser
     */
    getCurrentLanguage() {
        // #region agent log
        const debugData = {
            hasI18n: !!window.i18n,
            i18nType: typeof window.i18n,
            hasGetLanguage: window.i18n ? typeof window.i18n.getLanguage : 'no i18n',
            localStorageKeys: Object.keys(localStorage),
            navigatorLang: navigator.language
        };
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ai-agent.js:getCurrentLanguage:entry',message:'Checking language sources',data:debugData,timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B'})}).catch(()=>{});
        // #endregion

        // Try i18n system first
        if (window.i18n && typeof window.i18n.getLanguage === 'function') {
            const i18nLang = window.i18n.getLanguage();
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ai-agent.js:getCurrentLanguage:i18n',message:'Got language from i18n',data:{i18nLang},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,D'})}).catch(()=>{});
            // #endregion
            return i18nLang;
        }
        // Try localStorage
        const stored = localStorage.getItem('language') || localStorage.getItem('lang');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ai-agent.js:getCurrentLanguage:localStorage',message:'Checking localStorage',data:{stored,allKeys:Object.keys(localStorage)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,E'})}).catch(()=>{});
        // #endregion
        if (stored) return stored;
        // Fall back to browser language
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ai-agent.js:getCurrentLanguage:fallback',message:'Using browser language',data:{navigatorLang:navigator.language},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        return navigator.language || 'zh-HK';
    }

    /**
     * Map language code to speech recognition language
     */
    getSpeechRecognitionLang() {
        const lang = this.getCurrentLanguage();
        const langMap = {
            'zh-HK': 'zh-HK',    // Cantonese
            'zh-TW': 'zh-TW',    // Traditional Chinese Taiwan
            'zh-CN': 'zh-CN',    // Simplified Chinese
            'zh': 'zh-HK',       // Default Chinese to Cantonese
            'en': 'en-US',
            'en-US': 'en-US',
            'en-GB': 'en-GB'
        };
        return langMap[lang] || langMap[lang.split('-')[0]] || 'zh-HK';
    }

    /**
     * Initialize Web Speech API for voice recognition (FREE!)
     */
    initWebSpeechAPI() {
        // Check for browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.lang = this.getSpeechRecognitionLang();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.maxAlternatives = 1;

            // Handle recognition results
            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                console.log('Speech recognized:', transcript);
                
                if (transcript && transcript.trim()) {
                    this.inputEl.value = transcript;
                    this.sendMessage();
                }
            };

            // Handle errors
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.isRecording = false;
                this.voiceBtnEl.classList.remove('recording');
                this.voiceBtnEl.textContent = '🎤';
                
                // User-friendly error messages using i18n
                const errorMessages = {
                    'no-speech': this.t('aiAgent.noSpeech'),
                    'audio-capture': this.t('aiAgent.micError'),
                    'not-allowed': this.t('aiAgent.micDenied'),
                    'network': this.t('aiAgent.networkError'),
                    'aborted': this.t('aiAgent.speechCancelled'),
                    'language-not-supported': this.t('aiAgent.langNotSupported')
                };
                
                const msg = errorMessages[event.error] || this.t('aiAgent.speechFailed');
                this.addMessage(msg, 'assistant');
            };

            // Handle end of recognition
            this.recognition.onend = () => {
                this.isRecording = false;
                this.voiceBtnEl.classList.remove('recording');
                this.voiceBtnEl.textContent = '🎤';
                this.setStatus('online');
            };

            console.log('Web Speech API initialized with language:', this.recognition.lang);
        } else {
            console.warn('Web Speech API not supported in this browser');
            // Hide voice button if not supported
            if (this.voiceBtnEl) {
                this.voiceBtnEl.style.display = 'none';
            }
        }

        // Preload voices for TTS
        this.loadVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => this.loadVoices();
        }
    }

    /**
     * Load and cache available voices
     */
    loadVoices() {
        this.cachedVoices = speechSynthesis.getVoices();
        this.voicesLoaded = this.cachedVoices.length > 0;
        console.log('Loaded', this.cachedVoices.length, 'voices');
    }

    /**
     * Find the best voice for current language
     */
    getBestVoice() {
        const lang = this.getCurrentLanguage();
        const voices = this.cachedVoices.length > 0 ? this.cachedVoices : speechSynthesis.getVoices();
        
        // First, try to find a preferred voice
        for (const preferredName of this.preferredVoices) {
            const voice = voices.find(v => v.name.includes(preferredName));
            if (voice) {
                // Check if voice language matches current language
                const voiceLang = voice.lang.toLowerCase();
                const currentLang = lang.toLowerCase();
                
                // Match logic: zh-HK matches zh, en-US matches en, etc.
                if (voiceLang.startsWith(currentLang.split('-')[0])) {
                    console.log('Using preferred voice:', voice.name);
                    return voice;
                }
            }
        }

        // Second, find any female voice for the language
        const langPrefix = lang.split('-')[0];
        const femaleKeywords = ['female', 'woman', '女', 'ting', 'mei', 'hui', 'yao', 'sinji', 'samantha', 'zira', 'tracy'];
        
        const femaleVoice = voices.find(v => {
            const voiceLang = v.lang.toLowerCase();
            const nameLower = v.name.toLowerCase();
            return voiceLang.startsWith(langPrefix) && 
                   femaleKeywords.some(kw => nameLower.includes(kw));
        });
        
        if (femaleVoice) {
            console.log('Using female voice:', femaleVoice.name);
            return femaleVoice;
        }

        // Third, find any voice for the language
        const langVoice = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
        if (langVoice) {
            console.log('Using language-matched voice:', langVoice.name);
            return langVoice;
        }

        // Last resort: use default
        console.log('Using default voice');
        return voices[0] || null;
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
                        <div class="ai-agent-header-name">${this.t('aiAgent.name')}</div>
                        <div class="ai-agent-header-status">${this.t('aiAgent.title')}</div>
                    </div>
                    <button class="ai-agent-close" id="agentClose">&times;</button>
                </div>

                <!-- Messages -->
                <div class="ai-agent-messages" id="agentMessages">
                    <!-- Messages will be added here -->
                </div>

                <!-- Quick Actions -->
                <div class="ai-agent-quick-actions" id="agentQuickActions">
                    <button class="ai-agent-quick-btn" data-action="${this.t('aiAgent.quickAction1Full')}">${this.t('aiAgent.quickAction1')}</button>
                    <button class="ai-agent-quick-btn" data-action="${this.t('aiAgent.quickAction2Full')}">${this.t('aiAgent.quickAction2')}</button>
                    <button class="ai-agent-quick-btn" data-action="${this.t('aiAgent.quickAction3Full')}">${this.t('aiAgent.quickAction3')}</button>
                </div>

                <!-- Input Area -->
                <div class="ai-agent-input-area">
                    <div class="ai-agent-input-row">
                        <input type="text" class="ai-agent-input" id="agentInput" 
                               placeholder="${this.t('aiAgent.placeholder')}" />
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
            // Call chat API with current language
            const currentLang = this.getCurrentLanguage();
            const response = await fetch('/api/agent/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    message: text,
                    history: this.messages.slice(-10),
                    language: currentLang
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
            this.addMessage(this.t('aiAgent.error'), 'assistant');
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

    /**
     * Remove emojis from text before TTS
     */
    stripEmojis(text) {
        // Remove emojis, symbols, and special characters that TTS might pronounce
        return text
            .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Emojis
            .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
            .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
            .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation selectors
            .replace(/[\u{1F000}-\u{1F02F}]/gu, '') // Mahjong tiles
            .replace(/[\u{1F0A0}-\u{1F0FF}]/gu, '') // Playing cards
            .replace(/\s+/g, ' ')                   // Collapse multiple spaces
            .trim();
    }

    /**
     * Browser's free Web Speech API with smart voice selection
     */
    speakWithBrowserTTS(text) {
        return new Promise((resolve) => {
            // Cancel any ongoing speech
            speechSynthesis.cancel();
            
            // Remove emojis before speaking
            const cleanText = this.stripEmojis(text);
            if (!cleanText) {
                this.isSpeaking = false;
                this.avatarEl.classList.remove('speaking');
                return resolve();
            }
            
            const utterance = new SpeechSynthesisUtterance(cleanText);
            
            // Get the best voice for current language
            const bestVoice = this.getBestVoice();
            if (bestVoice) {
                utterance.voice = bestVoice;
                utterance.lang = bestVoice.lang;
            } else {
                // Fallback to language-based setting
                utterance.lang = this.getSpeechRecognitionLang();
            }
            
            // Optimize speech parameters for natural sound
            utterance.rate = 0.95;   // Slightly slower for clarity
            utterance.pitch = 1.05;  // Slightly higher for friendliness
            utterance.volume = 1.0;
            
            utterance.onend = () => {
                this.isSpeaking = false;
                this.avatarEl.classList.remove('speaking');
                resolve();
            };
            
            utterance.onerror = (event) => {
                console.error('TTS error:', event.error);
                this.isSpeaking = false;
                this.avatarEl.classList.remove('speaking');
                resolve();
            };
            
            // Speak!
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
        // Use Web Speech API (FREE!) instead of server-side STT
        if (!this.recognition) {
            this.addMessage(this.t('aiAgent.browserNotSupported'), 'assistant');
            return;
        }

        try {
            // Update language before starting (in case user changed it)
            this.recognition.lang = this.getSpeechRecognitionLang();
            
            this.recognition.start();
            this.isRecording = true;
            this.voiceBtnEl.classList.add('recording');
            this.voiceBtnEl.textContent = '⏹️';
            this.setStatus('thinking');
            
            console.log('Started speech recognition with language:', this.recognition.lang);

        } catch (err) {
            console.error('Recording error:', err);
            
            // Handle already started error
            if (err.name === 'InvalidStateError') {
                this.recognition.stop();
                this.isRecording = false;
                this.voiceBtnEl.classList.remove('recording');
                this.voiceBtnEl.textContent = '🎤';
            } else {
                this.addMessage(this.t('aiAgent.micError'), 'assistant');
            }
        }
    }

    stopRecording() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
            this.isRecording = false;
            this.voiceBtnEl.classList.remove('recording');
            this.voiceBtnEl.textContent = '🎤';
            this.setStatus('online');
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
    // Initialize AI Agent (translations loaded from i18n system)
    window.aiAgent = new AIAgent({
        theme: 'knight'
    });
});

