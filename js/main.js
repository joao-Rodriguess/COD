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

    addMoney(amount) {
        this.money += amount;
        localStorage.setItem('cod_money', this.money);
        if (typeof HUD !== 'undefined') HUD.updateMoney(this.money);
    },

    spendMoney(amount) {
        if (this.money >= amount) {
            this.money -= amount;
            localStorage.setItem('cod_money', this.money);
            if (typeof HUD !== 'undefined') HUD.updateMoney(this.money);
            return true;
        }
        return false;
    },

    init() {
        // Three.js setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
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
        GameMap.createExplosiveBarrels();
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
            this.showIntro();
        });

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
        document.getElementById('death-screen').style.display = 'none';
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('hud').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';
        document.exitPointerLock();
    }
};

// Start when page loads
window.addEventListener('load', () => {
    Game.init();
});
