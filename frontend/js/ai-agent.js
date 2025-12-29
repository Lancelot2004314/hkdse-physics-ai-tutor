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

        // Stick Knight Scene System
        this.currentScene = 'idle';
        this.sceneTimer = null;
        this.scenes = ['idle', 'sleep', 'practice', 'combat', 'rest'];
        this.sceneWeights = { idle: 1, sleep: 1, practice: 1.5, combat: 2.5, rest: 1 };

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
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ai-agent.js:t', message: 'Translation lookup', data: { key, hasT, result, isKeyReturned: result === key }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'F,G,H' }) }).catch(() => { });
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
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ai-agent.js:init', message: 'AIAgent initializing', data: { detectedLang: initLang, translationTest: this.t('aiAgent.welcome') }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'C,D' }) }).catch(() => { });
        // #endregion

        this.createDOM();
        this.bindEvents();
        this.initPhysicsAvatar();
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
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ai-agent.js:getCurrentLanguage:entry', message: 'Checking language sources', data: debugData, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'A,B' }) }).catch(() => { });
        // #endregion

        // Try i18n system first
        if (window.i18n && typeof window.i18n.getLanguage === 'function') {
            const i18nLang = window.i18n.getLanguage();
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ai-agent.js:getCurrentLanguage:i18n', message: 'Got language from i18n', data: { i18nLang }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'A,D' }) }).catch(() => { });
            // #endregion
            return i18nLang;
        }
        // Try localStorage
        const stored = localStorage.getItem('language') || localStorage.getItem('lang');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ai-agent.js:getCurrentLanguage:localStorage', message: 'Checking localStorage', data: { stored, allKeys: Object.keys(localStorage) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'B,E' }) }).catch(() => { });
        // #endregion
        if (stored) return stored;
        // Fall back to browser language
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ai-agent.js:getCurrentLanguage:fallback', message: 'Using browser language', data: { navigatorLang: navigator.language }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'D' }) }).catch(() => { });
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

    /**
     * Initialize the Physics Avatar System (Matter.js powered)
     */
    initPhysicsAvatar() {
        try {
            // Check if PhysicsAvatar class is available
            if (typeof PhysicsAvatar !== 'undefined') {
                this.physicsAvatar = new PhysicsAvatar(this.avatar3DEl, {
                    size: 80,
                    combatOnly: true,
                    enemyCount: 1,
                    enemyMaxAliveMs: 6000
                });
                this.avatarFallbackEl.style.display = 'none';
                console.log('PhysicsAvatar initialized!');
            } else {
                // Fallback to loading script dynamically
                this.loadPhysicsAvatarScript().then(() => {
                    this.physicsAvatar = new PhysicsAvatar(this.avatar3DEl, {
                        size: 80,
                        combatOnly: true,
                        enemyCount: 1,
                        enemyMaxAliveMs: 6000
                    });
                    this.avatarFallbackEl.style.display = 'none';
                    console.log('PhysicsAvatar initialized (dynamic load)!');
                }).catch(err => {
                    console.error('Failed to load PhysicsAvatar:', err);
                    this.avatarFallbackEl.style.display = 'flex';
                });
            }
        } catch (err) {
            console.error('PhysicsAvatar setup failed:', err);
            this.avatarFallbackEl.style.display = 'flex';
        }
    }

    /**
     * Load PhysicsAvatar script dynamically
     */
    loadPhysicsAvatarScript() {
        return new Promise((resolve, reject) => {
            if (typeof PhysicsAvatar !== 'undefined') {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = '/js/physics-avatar.js?v=6.2';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Create the SVG Stick Knight scene - CENTERED in circle with professional animations
     */
    createStickKnightSVG() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'stick-knight-scene scene-idle');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');

        // Center is at 50,50. Circle radius is ~45, so knight must stay within
        svg.innerHTML = `
            <defs>
                <!-- Clip path to keep everything inside the circle -->
                <clipPath id="circleClip">
                    <circle cx="50" cy="50" r="44"/>
                </clipPath>
                <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="0.8" result="blur"/>
                    <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                <linearGradient id="swordShine" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#FFFFFF"/>
                    <stop offset="50%" style="stop-color:#E0E0E0"/>
                    <stop offset="100%" style="stop-color:#B0B0B0"/>
                </linearGradient>
            </defs>
            
            <!-- All content clipped to circle boundary -->
            <g clip-path="url(#circleClip)">
                
                <!-- Ground indicator -->
                <ellipse cx="50" cy="85" rx="35" ry="5" fill="none" stroke="rgba(255,215,0,0.2)" stroke-width="1" stroke-dasharray="3,3"/>
                
                <!-- Enemies - Multiple for Marvel-style combat -->
                <g class="enemies">
                    <!-- Enemy 1 - Main opponent -->
                    <g class="enemy enemy-1" style="opacity:0;">
                        <g transform="translate(72, 48)">
                            <circle r="3.5" fill="#FFF" stroke="#AAA" stroke-width="0.5"/>
                            <line y1="3.5" y2="14" stroke="#FFF" stroke-width="2.5" stroke-linecap="round"/>
                            <line y1="6" x2="-6" y2="11" stroke="#FFF" stroke-width="2" stroke-linecap="round"/>
                            <line y1="6" x2="5" y2="10" stroke="#FFF" stroke-width="2" stroke-linecap="round"/>
                            <line y1="14" x2="-4" y2="23" stroke="#FFF" stroke-width="2" stroke-linecap="round"/>
                            <line y1="14" x2="4" y2="23" stroke="#FFF" stroke-width="2" stroke-linecap="round"/>
                            <line x1="-6" y1="11" x2="-11" y2="6" stroke="#CCC" stroke-width="1.5"/>
                        </g>
                    </g>
                    <!-- Enemy 2 - Background enemy -->
                    <g class="enemy enemy-2" style="opacity:0;">
                        <g transform="translate(80, 42) scale(0.8)">
                            <circle r="3" fill="#EEE" stroke="#BBB" stroke-width="0.5"/>
                            <line y1="3" y2="12" stroke="#EEE" stroke-width="2" stroke-linecap="round"/>
                            <line y1="5" x2="-5" y2="9" stroke="#EEE" stroke-width="1.5" stroke-linecap="round"/>
                            <line y1="5" x2="4" y2="8" stroke="#EEE" stroke-width="1.5" stroke-linecap="round"/>
                            <line y1="12" x2="-3" y2="20" stroke="#EEE" stroke-width="1.5" stroke-linecap="round"/>
                            <line y1="12" x2="3" y2="20" stroke="#EEE" stroke-width="1.5" stroke-linecap="round"/>
                        </g>
                    </g>
                </g>
                
                <!-- LANCELOT - Centered at 50,50, small and cute -->
                <g class="lancelot" filter="url(#goldGlow)">
                    <g class="knight-body" transform="translate(50, 52)">
                        
                        <!-- Cape behind -->
                        <path class="cape" d="M -2 5 Q -6 12 -5 22 Q 0 24 5 22 Q 6 12 2 5" 
                              fill="#DC143C" stroke="#8B0000" stroke-width="0.5"/>
                        
                        <!-- Body -->
                        <line class="body-line" y1="3" y2="15" stroke="#FFD700" stroke-width="2.5" stroke-linecap="round"/>
                        
                        <!-- Armor vest -->
                        <path d="M -3 5 L 3 5 L 4 11 L -4 11 Z" fill="#FFD700" stroke="#B8860B" stroke-width="0.5"/>
                        
                        <!-- Legs -->
                        <g class="legs">
                            <line class="leg-l" y1="15" x2="-4" y2="25" stroke="#FFD700" stroke-width="2" stroke-linecap="round"/>
                            <line class="leg-r" y1="15" x2="4" y2="25" stroke="#FFD700" stroke-width="2" stroke-linecap="round"/>
                        </g>
                        
                        <!-- Left arm + Shield -->
                        <g class="shield-arm">
                            <line y1="6" x2="-6" y2="11" stroke="#FFD700" stroke-width="2" stroke-linecap="round"/>
                            <ellipse cx="-8" cy="12" rx="3" ry="4" fill="#FFD700" stroke="#B8860B" stroke-width="0.5"/>
                        </g>
                        
                        <!-- Right arm + Sword -->
                        <g class="sword-arm">
                            <line y1="6" x2="6" y2="3" stroke="#FFD700" stroke-width="2" stroke-linecap="round"/>
                            <g class="sword" transform="translate(6, 3) rotate(-30)">
                                <rect x="0" y="-1" width="2" height="2" fill="#FFD700" stroke="#B8860B" stroke-width="0.3"/>
                                <rect x="2" y="-0.5" width="10" height="1" fill="url(#swordShine)" stroke="#888" stroke-width="0.2"/>
                            </g>
                        </g>
                        
                        <!-- Head + Helmet -->
                        <g class="head" transform="translate(0, -2)">
                            <ellipse rx="5" ry="4.5" fill="#FFD700" stroke="#B8860B" stroke-width="0.8"/>
                            <path d="M -3.5 -3 Q 0 -7 3.5 -3" fill="#FFD700" stroke="#B8860B" stroke-width="0.5"/>
                            <path class="plume" d="M 0 -6 Q 5 -9 4 -3" fill="#DC143C" stroke="#8B0000" stroke-width="0.3"/>
                            <rect x="-3.5" y="-0.5" width="7" height="2" rx="0.8" fill="#1a1a2e"/>
                            <circle class="eye-l" cx="-1.8" cy="0.5" r="0.8" fill="#60a5fa"/>
                            <circle class="eye-r" cx="1.8" cy="0.5" r="0.8" fill="#60a5fa"/>
                        </g>
                    </g>
                </g>
                
                <!-- Marvel-style Effects -->
                <g class="effects">
                    <!-- Full-screen impact flash (clipped in circle) -->
                    <rect class="impact-flash" x="0" y="0" width="100" height="100" fill="#ffffff" opacity="0"/>

                    <!-- Shockwave ring at hit point -->
                    <circle class="shockwave" cx="70" cy="48" r="0" fill="none" stroke="#ffffff" stroke-width="2" opacity="0"/>

                    <!-- Comic text -->
                    <g class="comic-text" style="opacity:0;">
                        <text class="comic-bam" x="60" y="32" font-family="Impact, Arial Black, sans-serif" font-size="10" fill="#FFD700" stroke="#111827" stroke-width="0.8">BAM</text>
                        <text class="comic-kapow" x="55" y="62" font-family="Impact, Arial Black, sans-serif" font-size="9" fill="#FF4D4D" stroke="#111827" stroke-width="0.8">KAPOW</text>
                    </g>

                    <!-- Combo counter -->
                    <text class="combo-counter" x="8" y="18" font-family="Arial Black, Arial, sans-serif" font-size="7" fill="#FFD700" stroke="#111827" stroke-width="0.6" opacity="0">COMBO x5</text>

                    <!-- Multiple slash trails -->
                    <g class="slash-effects" style="opacity:0;">
                        <path d="M 52 48 Q 65 42 72 52" stroke="#FFD700" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.9"/>
                        <path d="M 50 50 Q 68 45 75 48" stroke="#FFA500" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>
                        <path d="M 54 52 Q 70 48 78 55" stroke="#FFFF00" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.5"/>
                    </g>
                    <!-- Impact sparkles -->
                    <g class="sparkles" style="opacity:0;">
                        <circle cx="70" cy="48" r="4" fill="#FFF"/>
                        <circle cx="68" cy="45" r="2.5" fill="#FFD700"/>
                        <circle cx="72" cy="50" r="2" fill="#FFA500"/>
                        <circle cx="66" cy="52" r="1.5" fill="#FFD700"/>
                        <circle cx="74" cy="46" r="1" fill="#FFF"/>
                    </g>
                    <!-- Speed lines for motion -->
                    <g class="speed-lines" style="opacity:0;">
                        <line x1="30" y1="50" x2="45" y2="50" stroke="#FFD700" stroke-width="1" opacity="0.6"/>
                        <line x1="28" y1="54" x2="42" y2="54" stroke="#FFD700" stroke-width="0.8" opacity="0.4"/>
                        <line x1="32" y1="46" x2="44" y2="46" stroke="#FFD700" stroke-width="0.8" opacity="0.4"/>
                    </g>
                </g>
                
                <!-- Sleep ZZZ -->
                <g class="zzz-group" style="opacity:0;">
                    <text x="58" y="40" fill="#60a5fa" font-size="8" font-weight="bold" font-family="Arial">Z</text>
                    <text x="64" y="35" fill="#60a5fa" font-size="6" font-weight="bold" font-family="Arial">z</text>
                    <text x="69" y="31" fill="#60a5fa" font-size="5" font-weight="bold" font-family="Arial">z</text>
                </g>
                
            </g>
        `;

        this.avatar3DEl.appendChild(svg);
        this.knightSVG = svg;
        this.knightEl = svg.querySelector('.lancelot');
        this.enemiesEl = svg.querySelector('.enemies');
        this.zzzGroup = svg.querySelector('.zzz-group');
    }

    /**
     * Start the scene cycling loop
     */
    startSceneCycle() {
        // Start with idle for a few seconds
        this.setScene('idle');

        // Then start cycling
        this.scheduleNextScene();
    }

    /**
     * Schedule the next scene change
     */
    scheduleNextScene() {
        // Get duration based on current scene
        const durations = {
            idle: 3000,      // 3 seconds
            sleep: 6000,     // 6 seconds  
            practice: 5000,  // 5 seconds
            // Combat animation is 10s in CSS (marvel-style), keep in sync to avoid cutting climax
            combat: 10000,   // 10 seconds (full combat animation)
            rest: 4000       // 4 seconds
        };

        const duration = durations[this.currentScene] || 3000;

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ai-agent.js:scheduleNextScene', message: 'Scene duration scheduled', data: { scene: this.currentScene, durationMs: duration, runId: 'v5' }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H1' }) }).catch(() => { });
        // #endregion

        this.sceneTimer = setTimeout(() => {
            // Pick next scene (weighted random)
            const nextScene = this.pickNextScene();
            this.setScene(nextScene);
            this.scheduleNextScene();
        }, duration);
    }

    /**
     * Pick next scene with weighted randomness
     */
    pickNextScene() {
        // Don't repeat the same scene (except idle can follow anything)
        const availableScenes = this.scenes.filter(s => s !== this.currentScene || s === 'idle');

        // Calculate total weight
        let totalWeight = 0;
        for (const scene of availableScenes) {
            totalWeight += this.sceneWeights[scene] || 1;
        }

        // Pick random weighted scene
        let random = Math.random() * totalWeight;
        for (const scene of availableScenes) {
            random -= this.sceneWeights[scene] || 1;
            if (random <= 0) {
                return scene;
            }
        }

        return 'idle';
    }

    /**
     * Set the current scene
     */
    setScene(sceneName) {
        if (!this.knightSVG) return;

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ai-agent.js:setScene', message: 'Scene changing', data: { from: this.currentScene, to: sceneName }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'E' }) }).catch(() => { });
        // #endregion

        // Remove all scene classes
        this.knightSVG.classList.remove('scene-idle', 'scene-sleep', 'scene-practice', 'scene-combat', 'scene-rest');

        // Add transition class briefly
        this.knightSVG.classList.add('scene-transition');

        setTimeout(() => {
            this.knightSVG.classList.remove('scene-transition');
            this.knightSVG.classList.add(`scene-${sceneName}`);

            // Handle ZZZ for sleep
            if (this.zzzGroup) {
                this.zzzGroup.style.display = sceneName === 'sleep' ? 'block' : 'none';
            }

            this.currentScene = sceneName;
            console.log('Scene changed to:', sceneName);
        }, 200);
    }

    /**
     * Force a specific scene (e.g., when speaking)
     */
    forceScene(sceneName) {
        if (this.sceneTimer) {
            clearTimeout(this.sceneTimer);
        }
        this.setScene(sceneName);
    }

    /**
     * Resume normal scene cycling
     */
    resumeSceneCycle() {
        this.scheduleNextScene();
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
        if (this.physicsAvatar) {
            this.physicsAvatar.destroy();
        }
        if (this.container) {
            this.container.remove();
        }
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('AI Agent JS loaded - PHYSICS AVATAR VERSION 6.0');

    // Initialize AI Agent (translations loaded from i18n system)
    window.aiAgent = new AIAgent({
        theme: 'knight'
    });
});

