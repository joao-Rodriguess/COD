// ============================
// AUDIO MANAGER - Procedural Audio via Web Audio API
// ============================

const AudioManager = {
    ctx: null,
    masterGain: null,
    initialized: false,

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn('Audio not available:', e);
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    _noise(duration, volume = 0.3, filterFreq = 3000) {
        if (!this.initialized) return;
        const ctx = this.ctx;
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1);
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        source.start();
        return source;
    },

    _tone(freq, duration, type = 'square', volume = 0.2) {
        if (!this.initialized) return;
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    },

    playShot(weaponType) {
        if (!this.initialized) return;
        this.resume();
        const ctx = this.ctx;

        switch (weaponType) {
            case 'ar': // Assault Rifle - punchy
                this._noise(0.12, 0.5, 4000);
                this._tone(150, 0.08, 'sawtooth', 0.3);
                this._tone(80, 0.06, 'square', 0.2);
                break;
            case 'smg': // SMG - faster, lighter
                this._noise(0.08, 0.35, 5000);
                this._tone(200, 0.05, 'sawtooth', 0.25);
                break;
            case 'sniper': // Sniper - heavy, booming
                this._noise(0.3, 0.7, 2000);
                this._tone(60, 0.2, 'sawtooth', 0.4);
                this._tone(40, 0.3, 'sine', 0.3);
                setTimeout(() => this._noise(0.2, 0.15, 800), 100);
                break;
            case 'pistol': // Pistol - sharp, quick
                this._noise(0.1, 0.35, 3500);
                this._tone(180, 0.06, 'square', 0.2);
                break;
            case 'knife': // Knife - quick swipe
                this._noise(0.1, 0.25, 6000);
                this._tone(350, 0.08, 'sawtooth', 0.15);
                break;
        }
    },

    playReload() {
        if (!this.initialized) return;
        this.resume();
        // Magazine out
        setTimeout(() => {
            this._tone(800, 0.05, 'sine', 0.15);
            this._noise(0.04, 0.1, 6000);
        }, 0);
        // Magazine in
        setTimeout(() => {
            this._tone(1200, 0.04, 'sine', 0.2);
            this._noise(0.03, 0.15, 8000);
        }, 300);
        // Bolt
        setTimeout(() => {
            this._tone(600, 0.03, 'square', 0.15);
            this._noise(0.05, 0.12, 5000);
        }, 500);
    },

    playHitmarker() {
        if (!this.initialized) return;
        this.resume();
        this._tone(1800, 0.06, 'sine', 0.15);
        this._tone(2200, 0.04, 'sine', 0.1);
    },

    playKill() {
        if (!this.initialized) return;
        this.resume();
        this._tone(1000, 0.1, 'sine', 0.2);
        setTimeout(() => this._tone(1500, 0.1, 'sine', 0.15), 60);
        setTimeout(() => this._tone(2000, 0.08, 'sine', 0.12), 120);
    },

    playFootstep() {
        if (!this.initialized) return;
        this._noise(0.05, 0.04 + Math.random() * 0.02, 1500 + Math.random() * 500);
    },

    playDamage() {
        if (!this.initialized) return;
        this.resume();
        this._tone(200, 0.15, 'sawtooth', 0.15);
        this._noise(0.1, 0.1, 2000);
    },

    playEmpty() {
        if (!this.initialized) return;
        this.resume();
        this._tone(2000, 0.03, 'sine', 0.1);
        this._tone(1500, 0.03, 'sine', 0.08);
    },

    playWeaponSwitch() {
        if (!this.initialized) return;
        this.resume();
        this._tone(600, 0.04, 'sine', 0.1);
        setTimeout(() => this._tone(900, 0.03, 'sine', 0.08), 50);
    },

    playExplosion() {
        if (!this.initialized) return;
        this.resume();
        this._noise(0.5, 0.6, 800);
        this._tone(30, 0.4, 'sine', 0.5);
        this._tone(50, 0.3, 'sawtooth', 0.3);
    },

    playSlide() {
        if (!this.initialized) return;
        this.resume();
        // Ruído de fricção no chão para deslizar
        this._noise(0.5, 0.08, 800);
    },

    playDash() {
        if (!this.initialized) return;
        this.resume();
        // Som rápido de vento e impulso mecânico
        this._noise(0.18, 0.22, 5000);
        this._tone(350, 0.12, 'sawtooth', 0.08);
    },

    playWallRun() {
        if (!this.initialized) return;
        // Som rápido de fricção de parede
        this._noise(0.06, 0.03, 1600);
    },

    playWaveStart() {
        if (!this.initialized) return;
        this.resume();
        this._tone(400, 0.2, 'sine', 0.15);
        setTimeout(() => this._tone(600, 0.2, 'sine', 0.15), 200);
        setTimeout(() => this._tone(800, 0.3, 'sine', 0.2), 400);
    },

    // --- GRENADE SOUNDS ---
    playGrenadeThrow() {
        if (!this.initialized) return;
        this.resume();
        this._noise(0.15, 0.12, 3000);
        this._tone(250, 0.1, 'sawtooth', 0.08);
    },

    playGrenadeBounce() {
        if (!this.initialized) return;
        this.resume();
        this._tone(400 + Math.random() * 200, 0.06, 'sine', 0.1);
        this._noise(0.04, 0.08, 5000);
    },

    playGrenadeExplosion() {
        if (!this.initialized) return;
        this.resume();
        // Massive boom
        this._noise(0.8, 0.8, 600);
        this._tone(25, 0.6, 'sine', 0.6);
        this._tone(40, 0.5, 'sawtooth', 0.4);
        this._tone(60, 0.4, 'square', 0.3);
        // Delayed echo
        setTimeout(() => {
            this._noise(0.5, 0.2, 400);
            this._tone(30, 0.4, 'sine', 0.15);
        }, 150);
        // Ringing (tinnitus effect)
        setTimeout(() => this._tone(3500, 0.8, 'sine', 0.06), 100);
    },

    // --- NIGHT VISION SOUNDS ---
    playNVToggle(on) {
        if (!this.initialized) return;
        this.resume();
        if (on) {
            // Mechanical click + power up whine
            this._tone(1200, 0.04, 'square', 0.12);
            this._tone(800, 0.03, 'sine', 0.08);
            setTimeout(() => this._tone(2000, 0.15, 'sine', 0.04), 50);
        } else {
            // Power down
            this._tone(2000, 0.03, 'sine', 0.04);
            this._tone(600, 0.05, 'square', 0.1);
        }
    },

    // --- WEATHER SOUNDS ---
    playThunder() {
        if (!this.initialized) return;
        this.resume();
        // Deep rumble
        this._noise(1.5, 0.45, 200);
        this._tone(20, 1.0, 'sine', 0.35);
        this._tone(35, 0.8, 'sawtooth', 0.2);
        // Crackle
        setTimeout(() => {
            this._noise(0.3, 0.15, 3000);
            this._tone(50, 0.5, 'sine', 0.15);
        }, 200);
        // Distant rumble
        setTimeout(() => this._noise(1.0, 0.08, 150), 800);
    },

    // --- BARREL EXPLOSION ---
    playBarrelExplosion() {
        if (!this.initialized) return;
        this.resume();
        this._noise(0.6, 0.7, 800);
        this._tone(35, 0.5, 'sine', 0.5);
        this._tone(55, 0.4, 'sawtooth', 0.35);
        setTimeout(() => {
            this._noise(0.4, 0.3, 500);
            this._tone(80, 0.3, 'sine', 0.2);
        }, 100);
    }
};
