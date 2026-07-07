// ============================
// WEATHER SYSTEM - Dynamic weather: rain, lightning, fog, puddles
// ============================

const WeatherSystem = {
    scene: null,
    camera: null,
    active: false,
    rainParticles: null,
    rainCount: 3000,
    rainGeo: null,
    rainPositions: null,
    rainVelocities: [],
    lightningTimer: 0,
    lightningCooldown: 8,
    thunderTimeout: null,
    ambientRainNode: null,
    fogDensityBase: 0.012,
    fogDensityRain: 0.022,
    currentFogDensity: 0.012,
    puddles: [],
    splashParticles: [],
    flashLight: null,
    transitionProgress: 0,

    init(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.active = false;
        this.transitionProgress = 0;

        // Create flash light for lightning
        this.flashLight = new THREE.DirectionalLight(0xeeeeff, 0);
        this.flashLight.position.set(0, 100, 0);
        this.scene.add(this.flashLight);
    },

    start() {
        if (this.active) return;
        this.active = true;
        this._createRain();
        this._createPuddles();
        this._startAmbientRain();

        // Show rain overlay
        const overlay = document.getElementById('rain-overlay');
        if (overlay) overlay.classList.add('active');
    },

    stop() {
        if (!this.active) return;
        this.active = false;

        // Remove rain
        if (this.rainParticles) {
            this.scene.remove(this.rainParticles);
            if (this.rainGeo) this.rainGeo.dispose();
            if (this.rainParticles.material) this.rainParticles.material.dispose();
            this.rainParticles = null;
        }

        // Remove puddles
        for (const puddle of this.puddles) {
            this.scene.remove(puddle);
            if (puddle.geometry) puddle.geometry.dispose();
            if (puddle.material) puddle.material.dispose();
        }
        this.puddles = [];

        // Stop ambient rain
        if (this.ambientRainNode) {
            try { this.ambientRainNode.stop(); } catch (e) {}
            this.ambientRainNode = null;
        }

        // Reset fog
        if (this.scene.fog) {
            this.scene.fog.density = this.fogDensityBase;
        }

        // Hide rain overlay
        const overlay = document.getElementById('rain-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    _createRain() {
        this.rainGeo = new THREE.BufferGeometry();
        this.rainPositions = new Float32Array(this.rainCount * 3);
        this.rainVelocities = [];

        for (let i = 0; i < this.rainCount; i++) {
            // Spread rain around the player in a 80x80 area
            this.rainPositions[i * 3] = (Math.random() - 0.5) * 80;      // x
            this.rainPositions[i * 3 + 1] = Math.random() * 40 + 5;      // y
            this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 80;  // z

            this.rainVelocities.push({
                y: -(15 + Math.random() * 10),  // Fall speed
                x: -1.5 + Math.random() * 0.5,  // Wind drift
            });
        }

        this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

        const rainMat = new THREE.PointsMaterial({
            color: 0xaaccff,
            size: 0.15,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.rainParticles = new THREE.Points(this.rainGeo, rainMat);
        this.scene.add(this.rainParticles);
    },

    _createPuddles() {
        const puddleMat = new THREE.MeshStandardMaterial({
            color: 0x334455,
            transparent: true,
            opacity: 0.3,
            roughness: 0.05,
            metalness: 0.9,
            side: THREE.DoubleSide
        });

        // Random puddle positions on the ground
        const puddleSpots = [
            { x: 2, z: 3, r: 2.5 },
            { x: -8, z: -3, r: 1.8 },
            { x: 12, z: 8, r: 3 },
            { x: -15, z: 12, r: 2.2 },
            { x: 7, z: -12, r: 1.5 },
            { x: -3, z: -18, r: 2.8 },
            { x: 22, z: -10, r: 2 },
            { x: -22, z: 8, r: 1.6 },
            { x: 15, z: 20, r: 2.4 },
            { x: -10, z: -25, r: 1.9 },
        ];

        puddleSpots.forEach(p => {
            const geo = new THREE.CircleGeometry(p.r, 16);
            const puddle = new THREE.Mesh(geo, puddleMat.clone());
            puddle.rotation.x = -Math.PI / 2;
            puddle.position.set(p.x, 0.02, p.z);
            this.scene.add(puddle);
            this.puddles.push(puddle);
        });
    },

    _startAmbientRain() {
        if (!AudioManager.initialized) return;
        const ctx = AudioManager.ctx;

        // Create continuous rain noise
        const bufferSize = ctx.sampleRate * 4;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.3;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const gain = ctx.createGain();
        gain.gain.value = 0.04;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 600;

        const filter2 = ctx.createBiquadFilter();
        filter2.type = 'highpass';
        filter2.frequency.value = 100;

        source.connect(filter);
        filter.connect(filter2);
        filter2.connect(gain);
        gain.connect(AudioManager.masterGain);
        source.start();

        this.ambientRainNode = source;
    },

    update(dt) {
        if (!this.active) return;

        // Update rain positions
        if (this.rainParticles && this.rainPositions) {
            const playerPos = PlayerController ? PlayerController.getPosition() : { x: 0, z: 0 };

            for (let i = 0; i < this.rainCount; i++) {
                const idx = i * 3;
                this.rainPositions[idx] += this.rainVelocities[i].x * dt;         // x wind
                this.rainPositions[idx + 1] += this.rainVelocities[i].y * dt;     // y fall
                this.rainPositions[idx + 2] += this.rainVelocities[i].x * 0.3 * dt; // z wind

                // Reset rain drop when it hits ground
                if (this.rainPositions[idx + 1] < 0) {
                    this.rainPositions[idx] = playerPos.x + (Math.random() - 0.5) * 80;
                    this.rainPositions[idx + 1] = 30 + Math.random() * 15;
                    this.rainPositions[idx + 2] = playerPos.z + (Math.random() - 0.5) * 80;
                }
            }
            this.rainGeo.attributes.position.needsUpdate = true;
        }

        // Puddle shimmer animation
        const time = performance.now() * 0.001;
        for (const puddle of this.puddles) {
            puddle.material.opacity = 0.25 + Math.sin(time * 2 + puddle.position.x) * 0.08;
        }

        // Lightning
        this.lightningTimer -= dt;
        if (this.lightningTimer <= 0) {
            this._triggerLightning();
            this.lightningTimer = this.lightningCooldown + Math.random() * 10;
        }

        // Fade flash light
        if (this.flashLight.intensity > 0) {
            this.flashLight.intensity *= 0.85;
            if (this.flashLight.intensity < 0.1) this.flashLight.intensity = 0;
        }

        // Fog transition
        if (this.scene.fog) {
            this.transitionProgress = Math.min(1, this.transitionProgress + dt * 0.3);
            const targetDensity = this.fogDensityRain;
            this.currentFogDensity = THREE.MathUtils.lerp(this.fogDensityBase, targetDensity, this.transitionProgress);
            this.scene.fog.density = this.currentFogDensity;
        }
    },

    _triggerLightning() {
        // Visual flash
        this.flashLight.intensity = 8 + Math.random() * 5;
        this.flashLight.position.set(
            (Math.random() - 0.5) * 60,
            100,
            (Math.random() - 0.5) * 60
        );

        // Lightning overlay flash
        const overlay = document.getElementById('lightning-flash');
        if (overlay) {
            overlay.classList.add('flash');
            setTimeout(() => overlay.classList.remove('flash'), 150);
        }

        // Screen shake
        EffectsManager.screenShake(1.5);

        // Delayed thunder sound
        const thunderDelay = 300 + Math.random() * 1500;
        this.thunderTimeout = setTimeout(() => {
            AudioManager.playThunder();
        }, thunderDelay);
    },

    cleanup() {
        this.stop();
        if (this.thunderTimeout) clearTimeout(this.thunderTimeout);
    }
};
