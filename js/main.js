// ============================
// MAIN GAME - Initialization, game loop, state management
// ============================

const Game = {
    scene: null,
    camera: null,
    renderer: null,
    clock: null,
    state: 'loading',   // loading, menu, playing, paused, dead
    score: 0,
    kills: 0,
    wave: 0,
    waveDelay: 0,
    player: null,
    maxWaveDelay: 5,
    money: 0,
    highScore: 0,

    addMoney(amount) {
        this.money += amount;
        localStorage.setItem('cod_money', this.money);
        if (typeof HUD !== 'undefined') HUD.updateMoney(this.money);
        if (typeof FirebaseService !== 'undefined') {
            FirebaseService.syncData({ money: this.money });
        }
    },

    spendMoney(amount) {
        if (this.money >= amount) {
            this.money -= amount;
            localStorage.setItem('cod_money', this.money);
            if (typeof HUD !== 'undefined') HUD.updateMoney(this.money);
            if (typeof FirebaseService !== 'undefined') {
                FirebaseService.syncData({ money: this.money });
            }
            return true;
        }
        return false;
    },

    init() {
        // Three.js setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 700);
        this.scene.add(this.camera); // Add camera to scene so children like weapon models are rendered
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('game-canvas'),
            antialias: true,
            alpha: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        this.clock = new THREE.Clock();

        // Init subsystems
        AudioManager.init();
        GameMap.init(this.scene);
        EffectsManager.init(this.scene, this.camera);
        WeaponSystem.init(this.scene, this.camera);
        EnemyManager.init(this.scene);
        PlayerController.init(this.camera, this.scene);
        GrenadeSystem.init(this.scene, this.camera);
        WeatherSystem.init(this.scene, this.camera);
        HUD.init();

        this.player = PlayerController;

        const savedMoney = localStorage.getItem('cod_money');
        if (savedMoney !== null) {
            this.money = parseInt(savedMoney);
            if (typeof HUD !== 'undefined') HUD.updateMoney(this.money);
        }

        // Window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Setup UI buttons
        this._setupUI();
        this._setupFirebaseUI();

        // Loading simulation
        this._simulateLoading();
    },

    _simulateLoading() {
        const bar = document.getElementById('loading-bar');
        const text = document.getElementById('loading-text');
        let progress = 0;

        const messages = [
            'INITIALIZING SYSTEMS...',
            'LOADING MAP DATA...',
            'GENERATING TERRAIN...',
            'LOADING WEAPONS...',
            'INITIALIZING AI...',
            'CONFIGURING AUDIO...',
            'PREPARING HUD...',
            'FINALIZING...',
            'READY'
        ];

        const interval = setInterval(() => {
            progress += 5 + Math.random() * 10;
            if (progress > 100) progress = 100;
            bar.style.width = progress + '%';

            const msgIndex = Math.min(Math.floor(progress / 12), messages.length - 1);
            text.textContent = messages[msgIndex];

            if (progress >= 100) {
                clearInterval(interval);
                setTimeout(() => {
                    document.getElementById('loading-screen').style.display = 'none';
                    document.getElementById('main-menu').style.display = 'block';
                    this.state = 'menu';
                    // Start render loop even in menu (for background)
                    this._gameLoop();
                }, 500);
            }
        }, 150);
    },

    _setupUI() {
        // Start button
        document.getElementById('btn-start').addEventListener('click', () => {
            if (typeof MultiplayerSystem !== 'undefined') {
                MultiplayerSystem.stopOnline();
            }
            this.showIntro();
        });

        // Start online multiplayer button
        const btnStartOnline = document.getElementById('btn-start-online');
        if (btnStartOnline) {
            btnStartOnline.addEventListener('click', async () => {
                const success = await MultiplayerSystem.startOnline();
                if (success) {
                    this.showIntro();
                }
            });
        }

        // Shop button
        const btnShop = document.getElementById('btn-shop');
        if (btnShop) {
            btnShop.addEventListener('click', () => {
                if (typeof Shop !== 'undefined') Shop.open();
            });
        }

        // Controls button
        document.getElementById('btn-controls').addEventListener('click', () => {
            document.getElementById('controls-panel').style.display = 'flex';
        });
        document.getElementById('btn-close-controls').addEventListener('click', () => {
            document.getElementById('controls-panel').style.display = 'none';
        });

        // Pause buttons
        document.getElementById('btn-resume').addEventListener('click', () => {
            this.resume();
        });
        document.getElementById('btn-restart').addEventListener('click', () => {
            this.restart();
        });
        document.getElementById('btn-quit').addEventListener('click', () => {
            this.quitToMenu();
        });

        // Death buttons
        document.getElementById('btn-respawn').addEventListener('click', () => {
            this.restart();
        });
        document.getElementById('btn-death-quit').addEventListener('click', () => {
            this.quitToMenu();
        });
    },

    showIntro() {
        document.getElementById('main-menu').style.display = 'none';
        const intro = document.getElementById('intro-screen');
        const textEl = document.getElementById('intro-text');
        const skipEl = document.getElementById('intro-skip');
        
        intro.style.display = 'flex';
        intro.style.opacity = '1';
        
        const storyLines = [
            "Um soldado solitário...",
            "Foi enviado para a zona de guerra...",
            "Sua missão: sobreviver, recuperar recursos e eliminar a ameaça.",
            "Mas o campo de batalha está cheio de perigos..."
        ];
        
        let currentLine = 0;
        let isSkipped = false;
        let timeoutIds = [];

        const finishIntro = () => {
            if (isSkipped) return;
            isSkipped = true;
            timeoutIds.forEach(id => clearTimeout(id));
            window.removeEventListener('keydown', skipHandler);
            
            intro.style.transition = 'opacity 1s ease';
            intro.style.opacity = '0';
            
            setTimeout(() => {
                intro.style.display = 'none';
                this.startGame();
            }, 1000);
        };

        const skipHandler = (e) => {
            if (e.code === 'Space') {
                finishIntro();
            }
        };

        window.addEventListener('keydown', skipHandler);

        const showNextLine = () => {
            if (isSkipped) return;
            if (currentLine >= storyLines.length) {
                timeoutIds.push(setTimeout(finishIntro, 2000));
                return;
            }

            textEl.style.opacity = '0';
            
            timeoutIds.push(setTimeout(() => {
                if (isSkipped) return;
                textEl.textContent = storyLines[currentLine];
                textEl.style.opacity = '1';
                
                if (currentLine === 0) skipEl.style.display = 'block';
                
                currentLine++;
                timeoutIds.push(setTimeout(showNextLine, 3000));
            }, 1000));
        };

        showNextLine();
    },

    startGame() {
        const mapSelect = document.getElementById('map-select');
        const skinSelect = document.getElementById('skin-select');
        const theme = mapSelect ? mapSelect.value : 'urban';
        const skin = skinSelect ? skinSelect.value : 'default';
        
        GameMap.applyTheme(theme);
        WeaponSystem.applySkin(skin);

        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('hud').style.display = 'block';
        document.getElementById('death-screen').style.display = 'none';
        document.getElementById('pause-menu').style.display = 'none';

        this.state = 'playing';
        this.score = 0;
        this.kills = 0;
        this.wave = 0;
        this.waveDelay = 2;

        PlayerController.reset();
        WeaponSystem.resetAmmo();
        WeaponSystem.switchWeapon(0);
        EnemyManager.cleanup();
        EffectsManager.cleanup();
        GrenadeSystem.reset();
        WeatherSystem.cleanup();
        EnemyManager.killCount = 0;
        EnemyManager.killStreak = 0;

        // Ensure night vision is off
        PlayerController.nightVisionActive = false;
        PlayerController._toggleNightVision(false);

        AudioManager.resume();

        // Request pointer lock
        document.getElementById('game-canvas').requestPointerLock();

        // Start first wave after delay
        this.waveDelay = 3;
    },

    _gameLoop() {
        requestAnimationFrame(() => this._gameLoop());

        const dt = Math.min(this.clock.getDelta(), 0.05); // Cap delta time

        if (this.state === 'playing') {
            // Update game systems
            PlayerController.update(dt);
            WeaponSystem.update(dt);
            EnemyManager.update(dt, PlayerController.getPosition(), PlayerController.health);
            EffectsManager.update(dt);
            GrenadeSystem.update(dt);
            WeatherSystem.update(dt);
            GameMap.updateBarrels(dt);

            // Sincronizar multiplayer online se ativo
            if (typeof MultiplayerSystem !== 'undefined' && MultiplayerSystem.active) {
                const now = Date.now();
                if (now - MultiplayerSystem.lastUpdate > 80) { // A cada 80ms
                    MultiplayerSystem.sendMyState();
                    MultiplayerSystem.lastUpdate = now;
                }
            }

            // Wave management
            this._updateWaves(dt);

            // Update HUD
            HUD.update({
                health: PlayerController.health,
                maxHealth: PlayerController.maxHealth,
                weapon: WeaponSystem.getCurrentWeapon(),
                currentWeaponIndex: WeaponSystem.currentIndex,
                isADS: WeaponSystem.isADS,
                wave: this.wave,
                enemiesAlive: EnemyManager.getAliveCount(),
                score: this.score,
                kills: this.kills,
                isCrouching: PlayerController.isCrouching,
                isSprinting: PlayerController.isSprinting,
                isMoving: PlayerController.moveForward || PlayerController.moveBackward || PlayerController.moveLeft || PlayerController.moveRight,
                playerPos: PlayerController.getPosition(),
                playerRotY: PlayerController.euler.y,
            });
        }

        // Render
        this.renderer.render(this.scene, this.camera);
    },

    _updateWaves(dt) {
        // Wave delay countdown
        if (this.waveDelay > 0) {
            this.waveDelay -= dt;
            if (this.waveDelay <= 0) {
                this.wave++;
                EnemyManager.spawnWave(this.wave);
                AudioManager.playWaveStart();
                HUD.showWaveAnnouncement(this.wave, this.wave === 1 ? 'ELIMINE TODOS OS INIMIGOS' : 'INIMIGOS MAIS FORTES');

                // Start weather at wave 3
                if (this.wave >= 3 && !WeatherSystem.active) {
                    WeatherSystem.start();
                    HUD.addKillFeed('🌧️ Tempestade se aproximando...');
                }
            }
            return;
        }

        // Check if all enemies are dead
        if (!EnemyManager.waveActive && EnemyManager.getAliveCount() === 0 && this.wave > 0) {
            // Wave complete! Give bonus
            this.addScore(this.wave * 200);
            HUD.addKillFeed(`✓ WAVE ${this.wave} COMPLETA! +${this.wave * 200} pts`);
            this.waveDelay = this.maxWaveDelay;
        }
    },

    addScore(amount) {
        this.score += amount;
    },

    pause() {
        if (this.state !== 'playing') return;
        this.state = 'paused';
        document.getElementById('pause-menu').style.display = 'flex';
        document.exitPointerLock();
    },

    resume() {
        if (this.state !== 'paused') return;
        this.state = 'playing';
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('game-canvas').requestPointerLock();
    },

    gameOver() {
        this.state = 'dead';
        document.getElementById('death-screen').style.display = 'flex';
        document.getElementById('death-kills').textContent = this.kills;
        document.getElementById('death-score').textContent = this.score;
        document.getElementById('death-wave').textContent = this.wave;
        document.exitPointerLock();

        // Salvar Recorde no Firebase se superado
        if (this.score > this.highScore) {
            this.highScore = this.score;
            if (typeof FirebaseService !== 'undefined') {
                FirebaseService.syncData({
                    highScore: this.highScore,
                    maxWave: this.wave
                });
            }
        }
        
        // Incrementar o total de kills geral no Firestore
        if (typeof FirebaseService !== 'undefined' && FirebaseService.user && !FirebaseService.isGuest) {
            db.collection("players").doc(FirebaseService.user.uid).update({
                totalKills: firebase.firestore.FieldValue.increment(this.kills)
            }).catch(e => console.error("Erro ao incrementar mortes:", e));
        }
    },

    restart() {
        document.getElementById('death-screen').style.display = 'none';
        document.getElementById('pause-menu').style.display = 'none';
        EnemyManager.cleanup();
        EffectsManager.cleanup();
        this.startGame();
    },

    quitToMenu() {
        this.state = 'menu';
        EnemyManager.cleanup();
        EffectsManager.cleanup();
        if (typeof MultiplayerSystem !== 'undefined') {
            MultiplayerSystem.stopOnline();
        }
        document.getElementById('death-screen').style.display = 'none';
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('hud').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';
        document.exitPointerLock();
    },

    _setupFirebaseUI() {
        const authPanel = document.getElementById('auth-panel');
        const userInfo = document.getElementById('auth-user-info');
        const authBtn = document.getElementById('auth-btn');

        const authModal = document.getElementById('auth-modal');
        const modalTitle = document.getElementById('auth-modal-title');
        const emailInput = document.getElementById('auth-email');
        const passwordInput = document.getElementById('auth-password');
        const codenameGroup = document.getElementById('auth-group-codename');
        const codenameInput = document.getElementById('auth-codename');
        const errorMsg = document.getElementById('auth-error-msg');
        const btnSubmit = document.getElementById('auth-btn-submit');
        const btnGoogle = document.getElementById('auth-btn-google');
        const btnSwitch = document.getElementById('auth-btn-switch');
        const btnAnon = document.getElementById('auth-btn-anonymous');
        const btnCancel = document.getElementById('auth-btn-cancel');

        let isRegisterMode = false;

        // Atualizar painel operacional com base no estado do login
        const updatePanel = (user) => {
            if (user) {
                const name = user.codename || (user.isAnonymous ? 'Anônimo' : user.email);
                userInfo.textContent = `OPERADOR: ${name.toUpperCase()}`;
                authBtn.textContent = "DESCONECTAR";
            } else {
                userInfo.textContent = "MODO LOCAL (CONVIDADO)";
                authBtn.textContent = "CONECTAR CONTA";
            }
        };

        // Inicializar Firebase Service
        if (typeof FirebaseService !== 'undefined') {
            FirebaseService.init(updatePanel);
        }

        // Abrir/Fechar modal ou desconectar
        authBtn.addEventListener('click', () => {
            if (FirebaseService.user) {
                FirebaseService.logout();
                updatePanel(null);
            } else {
                isRegisterMode = false;
                modalTitle.textContent = "CONEXÃO OPERACIONAL";
                btnSwitch.textContent = "CRIAR NOVA CONTA";
                codenameGroup.style.display = 'none';
                errorMsg.style.display = 'none';
                emailInput.value = '';
                passwordInput.value = '';
                codenameInput.value = '';
                authModal.style.display = 'flex';
            }
        });

        // Alternar modo Login / Registro
        btnSwitch.addEventListener('click', () => {
            isRegisterMode = !isRegisterMode;
            if (isRegisterMode) {
                modalTitle.textContent = "REGISTRO OPERACIONAL";
                btnSwitch.textContent = "JÁ TENHO CONTA (ENTRAR)";
                codenameGroup.style.display = 'block';
            } else {
                modalTitle.textContent = "CONEXÃO OPERACIONAL";
                btnSwitch.textContent = "CRIAR NOVA CONTA";
                codenameGroup.style.display = 'none';
            }
        });

        // Submeter formulário (Confirmar Credenciais)
        btnSubmit.addEventListener('click', async () => {
            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) {
                errorMsg.textContent = "Preencha todos os campos.";
                errorMsg.style.display = 'block';
                return;
            }

            errorMsg.style.display = 'none';
            btnSubmit.disabled = true;
            btnSubmit.textContent = "CONECTANDO...";

            let result;
            if (isRegisterMode) {
                const codename = codenameInput.value.trim();
                result = await FirebaseService.registerEmail(email, password, codename);
            } else {
                result = await FirebaseService.loginEmail(email, password);
            }

            btnSubmit.disabled = false;
            btnSubmit.textContent = "CONFIRMAR CREDENCIAIS";

            if (result.success) {
                authModal.style.display = 'none';
            } else {
                errorMsg.textContent = result.error || "Erro de autenticação.";
                errorMsg.style.display = 'block';
            }
        });

        // Entrar com Google
        btnGoogle.addEventListener('click', async () => {
            errorMsg.style.display = 'none';
            btnGoogle.disabled = true;
            const originalText = btnGoogle.innerHTML;
            btnGoogle.innerHTML = "CONECTANDO AO GOOGLE...";
            
            const result = await FirebaseService.loginGoogle();
            
            btnGoogle.disabled = false;
            btnGoogle.innerHTML = originalText;
            
            if (result.success) {
                authModal.style.display = 'none';
            } else {
                errorMsg.textContent = result.error || "Erro de login com Google.";
                errorMsg.style.display = 'block';
            }
        });

        // Entrar anonimamente
        btnAnon.addEventListener('click', async () => {
            errorMsg.style.display = 'none';
            btnAnon.disabled = true;
            btnAnon.textContent = "CONECTANDO NA NUVEM...";
            const result = await FirebaseService.loginAnonymous();
            btnAnon.disabled = false;
            btnAnon.textContent = "ENTRAR ANÔNIMO (SALVAR NA NUVEM)";
            
            if (result.success) {
                authModal.style.display = 'none';
            } else {
                errorMsg.textContent = result.error || "Erro ao conectar anonimamente.";
                errorMsg.style.display = 'block';
            }
        });

        // Cancelar modal
        btnCancel.addEventListener('click', () => {
            authModal.style.display = 'none';
        });
    }
};

// Start when page loads
window.addEventListener('load', () => {
    Game.init();
});
