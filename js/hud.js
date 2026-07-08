// ============================
// HUD MANAGER - Updates all HUD elements
// ============================

const HUD = {
    elements: {},
    killFeedItems: [],
    miniCtx: null,

    init() {
        this.elements = {
            healthBar: document.getElementById('health-bar'),
            healthText: document.getElementById('health-text'),
            ammoCurrent: document.getElementById('ammo-current'),
            ammoReserve: document.getElementById('ammo-reserve'),
            weaponName: document.getElementById('weapon-name-display'),
            fireMode: document.getElementById('fire-mode'),
            waveNumber: document.getElementById('wave-number'),
            enemiesLeft: document.getElementById('enemies-left'),
            scoreValue: document.getElementById('score-value'),
            killsValue: document.getElementById('kills-value'),
            killfeed: document.getElementById('killfeed'),
            stanceIcon: document.getElementById('stance-icon'),
            crosshair: document.getElementById('crosshair'),
            hitmarker: document.getElementById('hitmarker'),
            damageOverlay: document.getElementById('damage-overlay'),
            hud: document.getElementById('hud'),
            weaponSlots: document.querySelectorAll('.weapon-slot'),
            dashBar: document.getElementById('dash-bar'),
            grenadeCount: document.getElementById('grenade-count'),
            nvIndicator: document.getElementById('nv-indicator'),
            weatherIndicator: document.getElementById('weather-indicator'),
            tooltip: document.getElementById('tooltip'),
            moneyDisplay: document.getElementById('money-display'),
            shopMoneyDisplay: document.getElementById('shop-money-display')
        };

        // Minimap canvas
        const miniCanvas = document.getElementById('minimap-canvas');
        if (miniCanvas) {
            this.miniCtx = miniCanvas.getContext('2d');
        }
    },

    updateMoney(amount) {
        if (this.elements.moneyDisplay) {
            this.elements.moneyDisplay.textContent = amount;
        }
        if (this.elements.shopMoneyDisplay) {
            this.elements.shopMoneyDisplay.textContent = amount;
        }
    },

    update(gameState) {
        if (!gameState) return;

        // Dash Bar
        if (this.elements.dashBar && typeof PlayerController !== 'undefined') {
            const cooldown = PlayerController.dashCooldown;
            const maxCooldown = PlayerController.maxDashCooldown;
            if (cooldown <= 0) {
                this.elements.dashBar.style.width = '100%';
                this.elements.dashBar.classList.add('ready');
            } else {
                const pct = ((maxCooldown - cooldown) / maxCooldown) * 100;
                this.elements.dashBar.style.width = pct + '%';
                this.elements.dashBar.classList.remove('ready');
            }
        }

        // Health
        const healthPct = (gameState.health / gameState.maxHealth) * 100;
        this.elements.healthBar.style.width = healthPct + '%';
        this.elements.healthText.textContent = Math.ceil(gameState.health);

        // Health bar color
        this.elements.healthBar.classList.remove('low', 'medium');
        if (healthPct <= 25) {
            this.elements.healthBar.classList.add('low');
            this.elements.healthText.style.color = '#ff2244';
        } else if (healthPct <= 50) {
            this.elements.healthBar.classList.add('medium');
            this.elements.healthText.style.color = '#ffaa00';
        } else {
            this.elements.healthText.style.color = '#00ff88';
        }

        // Critical health overlay
        if (healthPct <= 20) {
            this.elements.damageOverlay.classList.add('critical');
        } else {
            this.elements.damageOverlay.classList.remove('critical');
        }

        // Ammo
        const weapon = gameState.weapon;
        if (weapon) {
            if (weapon.type === 'knife') {
                this.elements.ammoCurrent.textContent = '∞';
                this.elements.ammoReserve.textContent = '—';
                this.elements.weaponName.textContent = weapon.name;
                this.elements.fireMode.textContent = 'MELEE';
                this.elements.ammoCurrent.classList.remove('low');
            } else {
                this.elements.ammoCurrent.textContent = weapon.currentMag;
                this.elements.ammoReserve.textContent = weapon.reserveAmmo;
                this.elements.weaponName.textContent = weapon.name;
                this.elements.fireMode.textContent = weapon.fireMode;
                this.elements.ammoCurrent.classList.toggle('low', weapon.currentMag <= weapon.magSize * 0.2);
            }

            // Update weapon slots
            this.elements.weaponSlots.forEach((slot, i) => {
                slot.classList.toggle('active', i === gameState.currentWeaponIndex);
                if (typeof WeaponSystem !== 'undefined' && WeaponSystem.weapons[i]) {
                    slot.style.display = WeaponSystem.weapons[i].unlocked ? 'block' : 'none';
                }
            });
        }

        // ADS mode
        this.elements.hud.classList.toggle('ads', gameState.isADS);

        // Wave info
        this.elements.waveNumber.textContent = gameState.wave;
        this.elements.enemiesLeft.textContent = `Inimigos: ${gameState.enemiesAlive}`;

        // Score
        this.elements.scoreValue.textContent = gameState.score;
        this.elements.killsValue.textContent = gameState.kills;

        // Stance indicator
        if (gameState.isCrouching) {
            this.elements.stanceIcon.textContent = '🧎';
        } else if (gameState.isSprinting) {
            this.elements.stanceIcon.textContent = '🏃';
        } else {
            this.elements.stanceIcon.textContent = '🧍';
        }

        // Grenade counter
        if (this.elements.grenadeCount && typeof GrenadeSystem !== 'undefined') {
            this.elements.grenadeCount.textContent = GrenadeSystem.getCount();
            this.elements.grenadeCount.classList.toggle('empty', GrenadeSystem.getCount() === 0);
        }

        // Night vision indicator
        if (this.elements.nvIndicator && typeof PlayerController !== 'undefined') {
            this.elements.nvIndicator.classList.toggle('active', PlayerController.nightVisionActive);
        }

        // Weather indicator
        if (this.elements.weatherIndicator && typeof WeatherSystem !== 'undefined') {
            this.elements.weatherIndicator.classList.toggle('active', WeatherSystem.active);
        }

        // Dynamic crosshair
        const recoilWS = typeof WeaponSystem !== 'undefined' ? WeaponSystem.getRecoilOffset() : { x: 0, y: 0 };
        const recoilFactor = (recoilWS.y + Math.abs(recoilWS.x)) * 300;
        
        let spreadMult = 1.0;
        if (gameState.isSprinting) spreadMult = 2.8;
        else if (gameState.isMoving) spreadMult = 1.5;
        else if (gameState.isCrouching) spreadMult = 0.75;

        if (typeof PlayerController !== 'undefined') {
            if (PlayerController.isSliding) spreadMult = 2.2;
            if (PlayerController.isWallRunning) spreadMult = 1.8;
        }

        const crossSize = 16 + spreadMult * 10 + recoilFactor;
        this.elements.crosshair.style.width = crossSize + 'px';
        this.elements.crosshair.style.height = crossSize + 'px';

        // Update minimap
        this._updateMinimap(gameState);

        // Clean old kill feed items
        const now = performance.now();
        this.killFeedItems = this.killFeedItems.filter(item => {
            if (now - item.time > 4000) {
                if (item.el && item.el.parentNode) item.el.parentNode.removeChild(item.el);
                return false;
            }
            if (now - item.time > 3000) {
                item.el.style.opacity = '0';
            }
            return true;
        });
    },

    _updateMinimap(gameState) {
        if (!this.miniCtx) return;
        const ctx = this.miniCtx;
        const w = 180, h = 180;
        const scale = 2.2;

        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = 'rgba(10, 15, 10, 0.8)';
        ctx.fillRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.08)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < w; i += 20) {
            ctx.beginPath();
            ctx.moveTo(i, 0); ctx.lineTo(i, h);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i); ctx.lineTo(w, i);
            ctx.stroke();
        }

        const playerX = gameState.playerPos.x;
        const playerZ = gameState.playerPos.z;
        const centerX = w / 2;
        const centerY = h / 2;

        // Draw collision boxes as map geometry
        ctx.fillStyle = 'rgba(100, 100, 110, 0.4)';
        for (const box of GameMap.collisionBoxes) {
            const rx = centerX + (box.min.x - playerX) * scale;
            const ry = centerY + (box.min.z - playerZ) * scale;
            const rw = (box.max.x - box.min.x) * scale;
            const rh = (box.max.z - box.min.z) * scale;
            if (rx > -50 && rx < w + 50 && ry > -50 && ry < h + 50) {
                ctx.fillRect(rx, ry, rw, rh);
            }
        }

        // Enemy dots
        for (const enemy of EnemyManager.enemies) {
            if (enemy.state === 'dead') continue;
            const ex = centerX + (enemy.model.position.x - playerX) * scale;
            const ey = centerY + (enemy.model.position.z - playerZ) * scale;

            if (ex >= 0 && ex <= w && ey >= 0 && ey <= h) {
                ctx.fillStyle = enemy.state === 'combat' ? '#ff3344' : '#ff884488';
                ctx.beginPath();
                ctx.arc(ex, ey, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Player triangle (direction indicator)
        ctx.save();
        ctx.translate(centerX, centerY);
        const yaw = gameState.playerRotY || 0;
        ctx.rotate(-yaw);

        ctx.fillStyle = '#00ff88';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(-4, 4);
        ctx.lineTo(4, 4);
        ctx.closePath();
        ctx.fill();

        // FOV cone
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.2)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-30, -60);
        ctx.moveTo(0, 0);
        ctx.lineTo(30, -60);
        ctx.stroke();

        ctx.restore();
    },

    showHitmarker(isKill) {
        const el = this.elements.hitmarker;
        el.classList.add('show');
        if (isKill) el.classList.add('kill');
        else el.classList.remove('kill');

        clearTimeout(this._hitmarkerTimeout);
        this._hitmarkerTimeout = setTimeout(() => {
            el.classList.remove('show', 'kill');
        }, 150);
    },

    addKillFeed(text) {
        const el = document.createElement('div');
        el.className = 'killfeed-item';
        el.textContent = text;
        this.elements.killfeed.prepend(el);

        const item = { el, time: performance.now() };
        this.killFeedItems.unshift(item);

        // Limit to 5 items
        while (this.killFeedItems.length > 5) {
            const old = this.killFeedItems.pop();
            if (old.el.parentNode) old.el.parentNode.removeChild(old.el);
        }
    },

    showDamage(direction) {
        // Flash overlay
        this.elements.damageOverlay.classList.add('show');
        clearTimeout(this._damageTimeout);
        this._damageTimeout = setTimeout(() => {
            this.elements.damageOverlay.classList.remove('show');
        }, 200);

        // Direction indicator
        if (direction) {
            const angle = Math.atan2(direction.x, direction.z);
            let dirId;
            if (angle > -Math.PI/4 && angle <= Math.PI/4) dirId = 'dmg-top';
            else if (angle > Math.PI/4 && angle <= 3*Math.PI/4) dirId = 'dmg-right';
            else if (angle < -Math.PI/4 && angle >= -3*Math.PI/4) dirId = 'dmg-left';
            else dirId = 'dmg-bottom';

            const indicator = document.getElementById(dirId);
            if (indicator) {
                indicator.classList.add('show');
                setTimeout(() => indicator.classList.remove('show'), 500);
            }
        }
    },

    showWaveAnnouncement(waveNum, subtitle) {
        const el = document.getElementById('wave-announcement');
        const textEl = document.getElementById('wave-announce-text');
        const subEl = document.getElementById('wave-announce-sub');

        textEl.textContent = `WAVE ${waveNum}`;
        subEl.textContent = subtitle || 'PREPARE-SE';
        el.style.display = 'block';
        el.style.animation = 'none';
        el.offsetHeight; // Trigger reflow
        el.style.animation = 'waveAnnounce 2.5s ease-in-out forwards';

        setTimeout(() => {
            el.style.display = 'none';
        }, 2500);
    },

    showKillStreak(count) {
        const el = document.getElementById('killstreak-display');
        const textEl = document.getElementById('killstreak-text');

        const streakNames = {
            3: '🔥 MULTI KILL!',
            5: '⚡ KILLING SPREE!',
            7: '💀 RAMPAGE!',
            10: '☠️ UNSTOPPABLE!',
            15: '🌟 TACTICAL NUKE!',
        };

        let name = `🔥 ${count}x STREAK!`;
        for (const [threshold, label] of Object.entries(streakNames)) {
            if (count >= parseInt(threshold)) name = label;
        }

        textEl.textContent = name;
        el.style.display = 'block';
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = 'killstreakPop 1.5s ease forwards';

        setTimeout(() => { el.style.display = 'none'; }, 1500);
    },

    hide() {
        document.getElementById('hud').style.display = 'none';
    },

    show() {
        document.getElementById('hud').style.display = 'block';
    },

    showTooltip(text) {
        if (!this.elements.tooltip) return;
        if (text) {
            this.elements.tooltip.textContent = text;
            this.elements.tooltip.style.display = 'block';
        } else {
            this.elements.tooltip.style.display = 'none';
        }
    }
};
