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
        this.initStickKnight();
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

    /**
     * Initialize the Stick Knight SVG Avatar System
     */
    initStickKnight() {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ai-agent.js:initStickKnight:entry',message:'initStickKnight called',data:{hasAvatar3DEl:!!this.avatar3DEl,hasFallbackEl:!!this.avatarFallbackEl},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        try {
            // Create SVG scene
            this.createStickKnightSVG();
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ai-agent.js:initStickKnight:afterSVG',message:'SVG created',data:{hasSVG:!!this.knightSVG,hasKnight:!!this.knightEl},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            
            // Hide fallback
            this.avatarFallbackEl.style.display = 'none';
            
            // Start scene cycling
            this.startSceneCycle();
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ai-agent.js:initStickKnight:complete',message:'Stick Knight initialized successfully',data:{currentScene:this.currentScene},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C,D,E'})}).catch(()=>{});
            // #endregion
            
            console.log('Stick Knight initialized!');
        } catch (err) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ai-agent.js:initStickKnight:error',message:'Stick Knight failed',data:{error:err.message,stack:err.stack},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            
            console.error('Stick Knight setup failed:', err);
            this.avatarFallbackEl.style.display = 'flex';
        }
    }

    /**
     * Create the SVG Stick Knight scene
     */
    createStickKnightSVG() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'stick-knight-scene scene-idle');
        svg.setAttribute('viewBox', '0 0 80 80');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        
        svg.innerHTML = `
            <!-- Background Arena -->
            <defs>
                <radialGradient id="arenaGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" style="stop-color:#1e3a5f;stop-opacity:0.2" />
                    <stop offset="100%" style="stop-color:#1e3a5f;stop-opacity:0.8" />
                </radialGradient>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            
            <!-- Arena ground line -->
            <ellipse class="arena-ground" cx="40" cy="68" rx="32" ry="6"/>
            
            <!-- Effects Layer (behind characters) -->
            <g class="effects-back">
                <!-- Sword slash trails -->
                <path class="combat-slash-effect" d="M 35 30 Q 50 25 55 40"/>
            </g>
            
            <!-- Enemies Group -->
            <g class="enemies">
                <!-- Enemy 1 -->
                <g class="enemy" transform="translate(55, 28)">
                    <circle class="head" cx="0" cy="0" r="5"/>
                    <line class="body" x1="0" y1="5" x2="0" y2="20"/>
                    <line class="arm" x1="0" y1="8" x2="-8" y2="14"/>
                    <line class="arm" x1="0" y1="8" x2="8" y2="12"/>
                    <line class="leg" x1="0" y1="20" x2="-5" y2="32"/>
                    <line class="leg" x1="0" y1="20" x2="5" y2="32"/>
                    <line class="weapon" x1="-8" y1="14" x2="-15" y2="8"/>
                </g>
                <!-- Enemy 2 -->
                <g class="enemy" transform="translate(65, 32)">
                    <circle class="head" cx="0" cy="0" r="4"/>
                    <line class="body" x1="0" y1="4" x2="0" y2="16"/>
                    <line class="arm" x1="0" y1="7" x2="-6" y2="12"/>
                    <line class="arm" x1="0" y1="7" x2="6" y2="10"/>
                    <line class="leg" x1="0" y1="16" x2="-4" y2="26"/>
                    <line class="leg" x1="0" y1="16" x2="4" y2="26"/>
                    <line class="weapon" x1="-6" y1="12" x2="-12" y2="6"/>
                </g>
            </g>
            
            <!-- Lancelot - The Gold Knight -->
            <g class="lancelot" transform="translate(25, 28)">
                <!-- Cape (behind body) -->
                <path class="cape" d="M -2 8 Q -8 20 -6 35 Q 0 38 6 35 Q 8 20 2 8"/>
                
                <!-- Armor chest piece -->
                <path class="armor-chest" d="M -6 8 L 6 8 L 8 18 L -8 18 Z"/>
                
                <!-- Body group for animations -->
                <g class="body-group">
                    <!-- Body -->
                    <line class="body" x1="0" y1="5" x2="0" y2="22"/>
                    
                    <!-- Legs -->
                    <g class="legs">
                        <line class="leg" x1="0" y1="22" x2="-6" y2="38"/>
                        <line class="leg" x1="0" y1="22" x2="6" y2="38"/>
                    </g>
                </g>
                
                <!-- Shield arm -->
                <g class="shield-arm">
                    <line class="arm" x1="0" y1="10" x2="-10" y2="18"/>
                    <ellipse class="shield" cx="-12" cy="18" rx="5" ry="7"/>
                </g>
                
                <!-- Sword arm -->
                <g class="sword-arm">
                    <line class="arm" x1="0" y1="10" x2="10" y2="6"/>
                    <!-- Sword -->
                    <g class="sword" transform="translate(10, 6)">
                        <rect class="sword-hilt" x="-2" y="-1" width="4" height="3" rx="0.5"/>
                        <rect class="sword-blade" x="2" y="-0.5" width="14" height="1.5" rx="0.5" fill="#E8E8E8" stroke="#808080" stroke-width="0.3"/>
                        <circle class="sword-hilt" cx="0" cy="0.5" r="1.5"/>
                    </g>
                </g>
                
                <!-- Head with Helmet -->
                <g class="head-group">
                    <!-- Helmet base -->
                    <ellipse class="helmet" cx="0" cy="0" rx="7" ry="6"/>
                    <!-- Helmet top -->
                    <path class="helmet" d="M -5 -4 Q 0 -10 5 -4"/>
                    <!-- Plume -->
                    <path class="helmet-plume" d="M 0 -8 Q 8 -12 6 -4 Q 4 -8 0 -6"/>
                    <!-- Visor slit -->
                    <rect class="visor" x="-5" y="-1" width="10" height="3" rx="1"/>
                    <!-- Glowing eyes -->
                    <circle class="eye" cx="-2.5" cy="0.5" r="1.2"/>
                    <circle class="eye" cx="2.5" cy="0.5" r="1.2"/>
                </g>
            </g>
            
            <!-- Effects Layer (in front) -->
            <g class="effects-front">
                <!-- Hit sparks -->
                <g class="hit-sparks">
                    <polygon class="hit-spark" points="50,25 52,28 55,25 52,22" transform="translate(0,0)"/>
                    <polygon class="hit-spark" points="50,25 52,28 55,25 52,22" transform="translate(5,10)"/>
                    <polygon class="hit-spark" points="50,25 52,28 55,25 52,22" transform="translate(-3,5)"/>
                </g>
                
                <!-- Victory sparkles -->
                <g class="victory-sparkles">
                    <polygon class="victory-sparkle" points="20,15 22,20 27,20 23,24 25,29 20,26 15,29 17,24 13,20 18,20"/>
                    <polygon class="victory-sparkle" points="50,10 51,13 54,13 52,15 53,18 50,16 47,18 48,15 46,13 49,13" transform="scale(0.7)"/>
                    <polygon class="victory-sparkle" points="60,20 61,22 63,22 62,24 62,26 60,25 58,26 58,24 57,22 59,22"/>
                </g>
            </g>
            
            <!-- Sleep ZZZ bubbles -->
            <g class="zzz-group" style="display:none;">
                <text class="zzz-bubble" x="35" y="20">Z</text>
                <text class="zzz-bubble" x="42" y="15">z</text>
                <text class="zzz-bubble" x="48" y="12">z</text>
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
            combat: 8000,    // 8 seconds (full combat animation)
            rest: 4000       // 4 seconds
        };
        
        const duration = durations[this.currentScene] || 3000;
        
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
        fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ai-agent.js:setScene',message:'Scene changing',data:{from:this.currentScene,to:sceneName},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
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
        if (this.sceneTimer) {
            clearTimeout(this.sceneTimer);
        }
        if (this.container) {
            this.container.remove();
        }
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4c569f0-6ac6-488d-aa92-c575b5a30a4c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ai-agent.js:DOMContentLoaded',message:'AI Agent JS loaded - STICK KNIGHT VERSION',data:{version:'2.0-stick-knight',timestamp:new Date().toISOString()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    
    // Initialize AI Agent (translations loaded from i18n system)
    window.aiAgent = new AIAgent({
        theme: 'knight'
    });
});

