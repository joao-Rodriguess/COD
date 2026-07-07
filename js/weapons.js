// ============================
// WEAPON SYSTEM - Multiple weapons with ADS, recoil, reload
// ============================

const WeaponSystem = {
    scene: null,
    camera: null,
    weapons: [],
    currentIndex: 0,
    weaponGroup: null,
    isFiring: false,
    isReloading: false,
    isADS: false,
    lastFireTime: 0,
    recoilOffset: { x: 0, y: 0 },
    recoilRecovery: 5,
    switchCooldown: 0,
    defaultFOV: 75,
    adsFOV: 45,

    init(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.weaponGroup = new THREE.Group();
        this.camera.add(this.weaponGroup);

        this.weapons = [
            {
                name: 'M4A1',
                type: 'ar',
                damage: 28,
                headshotMult: 2.5,
                fireRate: 0.1,    // seconds between shots
                reloadTime: 2.2,
                magSize: 30,
                maxAmmo: 210,
                currentMag: 30,
                reserveAmmo: 210,
                recoil: 0.025,
                spread: 0.015,
                adsSpread: 0.003,
                range: 80,
                auto: true,
                fireMode: 'AUTO',
                model: null,
                posDefault: new THREE.Vector3(0.25, -0.18, -0.45),
                posADS: new THREE.Vector3(0, -0.14, -0.3),
            },
            {
                name: 'MP5',
                type: 'smg',
                damage: 22,
                headshotMult: 2,
                fireRate: 0.07,
                reloadTime: 1.8,
                magSize: 35,
                maxAmmo: 245,
                currentMag: 35,
                reserveAmmo: 245,
                recoil: 0.018,
                spread: 0.025,
                adsSpread: 0.008,
                range: 50,
                auto: true,
                fireMode: 'AUTO',
                model: null,
                posDefault: new THREE.Vector3(0.22, -0.17, -0.4),
                posADS: new THREE.Vector3(0, -0.13, -0.28),
            },
            {
                name: 'SNIPER',
                type: 'sniper',
                damage: 95,
                headshotMult: 3,
                fireRate: 1.2,
                reloadTime: 3.0,
                magSize: 5,
                maxAmmo: 30,
                currentMag: 5,
                reserveAmmo: 30,
                recoil: 0.08,
                spread: 0.005,
                adsSpread: 0.001,
                range: 150,
                auto: false,
                fireMode: 'BOLT',
                model: null,
                posDefault: new THREE.Vector3(0.28, -0.2, -0.5),
                posADS: new THREE.Vector3(0, -0.14, -0.3),
            },
            {
                name: 'P226',
                type: 'pistol',
                damage: 35,
                headshotMult: 2,
                fireRate: 0.15,
                reloadTime: 1.5,
                magSize: 12,
                maxAmmo: 84,
                currentMag: 12,
                reserveAmmo: 84,
                recoil: 0.035,
                spread: 0.02,
                adsSpread: 0.006,
                range: 40,
                auto: false,
                fireMode: 'SEMI',
                model: null,
                posDefault: new THREE.Vector3(0.2, -0.16, -0.35),
                posADS: new THREE.Vector3(0, -0.12, -0.25),
            },
            {
                name: 'FACA',
                type: 'knife',
                damage: 85,
                headshotMult: 2,
                fireRate: 0.6,
                reloadTime: 0.1,
                magSize: 1,
                maxAmmo: 1,
                currentMag: 1,
                reserveAmmo: 1,
                recoil: 0.0,
                spread: 0.0,
                adsSpread: 0.0,
                range: 2.2,
                auto: false,
                fireMode: 'MELEE',
                model: null,
                posDefault: new THREE.Vector3(0.18, -0.22, -0.32),
                posADS: new THREE.Vector3(0.18, -0.22, -0.32),
            }
        ];

        this.weapons.forEach((w, i) => {
            w.model = this._createWeaponModel(w.type);
            w.model.visible = (i === 0);
            this.weaponGroup.add(w.model);
            w.model.position.copy(w.posDefault);
        });
    },

    _createWeaponModel(type) {
        const group = new THREE.Group();
        const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.4, metalness: 0.8 });
        const lightMetal = new THREE.MeshStandardMaterial({ color: 0x3d3d42, roughness: 0.3, metalness: 0.7 });
        const gripMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.1 });
        const magMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.5, metalness: 0.6 });

        switch(type) {
            case 'ar': {
                // Receiver
                const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.22), darkMetal);
                group.add(receiver);
                // Barrel
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.3, 8), lightMetal);
                barrel.rotation.x = Math.PI / 2;
                barrel.position.z = -0.25;
                group.add(barrel);
                // Handguard
                const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 0.18), darkMetal);
                handguard.position.z = -0.15;
                group.add(handguard);
                // Stock
                const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 0.14), gripMat);
                stock.position.z = 0.16;
                stock.position.y = 0.005;
                group.add(stock);
                // Magazine
                const mag = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.1, 0.06), magMat);
                mag.position.y = -0.07;
                mag.position.z = 0.02;
                mag.rotation.x = -0.15;
                group.add(mag);
                // Grip
                const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.03), gripMat);
                grip.position.y = -0.05;
                grip.position.z = 0.06;
                grip.rotation.x = -0.2;
                group.add(grip);
                // Sight rail
                const rail = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.012, 0.14), lightMetal);
                rail.position.y = 0.035;
                group.add(rail);
                // Front sight
                const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.02, 0.006), lightMetal);
                frontSight.position.set(0, 0.05, -0.08);
                group.add(frontSight);
                // Rear sight
                const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.018, 0.006), lightMetal);
                rearSight.position.set(0, 0.048, 0.05);
                group.add(rearSight);
                break;
            }
            case 'smg': {
                const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.16), darkMetal);
                group.add(receiver);
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.15, 8), lightMetal);
                barrel.rotation.x = Math.PI / 2;
                barrel.position.z = -0.15;
                group.add(barrel);
                const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 8), darkMetal);
                suppressor.rotation.x = Math.PI / 2;
                suppressor.position.z = -0.22;
                group.add(suppressor);
                const stock = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 0.1), gripMat);
                stock.position.z = 0.12;
                group.add(stock);
                const mag = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.1, 0.04), magMat);
                mag.position.y = -0.07;
                mag.position.z = 0.01;
                group.add(mag);
                const grip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.06, 0.025), gripMat);
                grip.position.y = -0.045;
                grip.position.z = 0.05;
                grip.rotation.x = -0.15;
                group.add(grip);
                break;
            }
            case 'sniper': {
                const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.28), darkMetal);
                group.add(receiver);
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.4, 8), lightMetal);
                barrel.rotation.x = Math.PI / 2;
                barrel.position.z = -0.32;
                group.add(barrel);
                const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.2), gripMat);
                stock.position.z = 0.22;
                stock.position.y = 0.01;
                group.add(stock);
                // Scope
                const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 8), darkMetal);
                scope.rotation.x = Math.PI / 2;
                scope.position.y = 0.055;
                scope.position.z = -0.02;
                group.add(scope);
                // Scope lenses
                const lensMat = new THREE.MeshBasicMaterial({ color: 0x3366aa, transparent: true, opacity: 0.5 });
                const lensFront = new THREE.Mesh(new THREE.CircleGeometry(0.02, 8), lensMat);
                lensFront.position.set(0, 0.055, -0.09);
                group.add(lensFront);
                const mag = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.08, 0.06), magMat);
                mag.position.y = -0.06;
                mag.position.z = 0.04;
                group.add(mag);
                const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.065, 0.03), gripMat);
                grip.position.y = -0.05;
                grip.position.z = 0.08;
                grip.rotation.x = -0.2;
                group.add(grip);
                // Bipod
                const bipodMat = lightMetal;
                const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4), bipodMat);
                leg1.position.set(-0.02, -0.06, -0.16);
                leg1.rotation.z = 0.3;
                group.add(leg1);
                const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4), bipodMat);
                leg2.position.set(0.02, -0.06, -0.16);
                leg2.rotation.z = -0.3;
                group.add(leg2);
                break;
            }
            case 'pistol': {
                const slide = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.035, 0.14), darkMetal);
                slide.position.y = 0.01;
                group.add(slide);
                const frame = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.025, 0.1), lightMetal);
                frame.position.y = -0.01;
                frame.position.z = 0.01;
                group.add(frame);
                const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.06, 6), lightMetal);
                barrel.rotation.x = Math.PI / 2;
                barrel.position.z = -0.1;
                barrel.position.y = 0.01;
                group.add(barrel);
                const grip = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.07, 0.03), gripMat);
                grip.position.y = -0.045;
                grip.position.z = 0.02;
                grip.rotation.x = -0.25;
                group.add(grip);
                const mag = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.04, 0.025), magMat);
                mag.position.y = -0.06;
                mag.position.z = 0.02;
                group.add(mag);
                // Front sight
                const fs = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.004), lightMetal);
                fs.position.set(0, 0.035, -0.06);
                group.add(fs);
                break;
            }
            case 'knife': {
                // Cabo (grip)
                const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), gripMat);
                grip.rotation.x = Math.PI / 2;
                group.add(grip);

                // Guarda-mão (guard)
                const guard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.015, 0.015), darkMetal);
                guard.position.z = -0.05;
                group.add(guard);

                // Lâmina (blade)
                const bladeGeo = new THREE.BoxGeometry(0.006, 0.03, 0.16);
                const bladeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.15 });
                const blade = new THREE.Mesh(bladeGeo, bladeMat);
                blade.position.z = -0.13;
                blade.position.y = 0.008;
                group.add(blade);
                break;
            }
        }
        return group;
    },

    update(dt) {
        const weapon = this.weapons[this.currentIndex];
        if (!weapon) return;

        // Weapon switch cooldown
        if (this.switchCooldown > 0) {
            this.switchCooldown -= dt;
        }

        // 1. Weapon Sway (Mouse movement lag)
        let swayX = 0;
        let swayY = 0;
        if (typeof PlayerController !== 'undefined') {
            const sens = this.isADS ? 0.0003 : 0.0012;
            swayX = -(PlayerController.mouseMoveX || 0) * sens;
            swayY = (PlayerController.mouseMoveY || 0) * sens;
        }
        const maxSway = this.isADS ? 0.008 : 0.035;
        const targetSwayPos = new THREE.Vector3(
            Math.max(-maxSway, Math.min(maxSway, swayX)),
            Math.max(-maxSway, Math.min(maxSway, swayY)),
            0
        );
        this.weaponGroup.position.lerp(targetSwayPos, dt * 8);

        // 2. Weapon Bobbing (Walking/Sprinting swing)
        let bobFactor = 0;
        let bobSpeed = 0;
        if (typeof PlayerController !== 'undefined' && PlayerController.onGround && PlayerController.isAlive) {
            const velSq = PlayerController.velocity.x * PlayerController.velocity.x + PlayerController.velocity.z * PlayerController.velocity.z;
            if (velSq > 0.2) {
                bobFactor = PlayerController.isSprinting ? 0.024 : 0.012;
                bobSpeed = PlayerController.isSprinting ? 12 : 7.5;
            }
        }

        const bobTime = performance.now() * 0.001 * bobSpeed;
        const bobX = Math.sin(bobTime) * bobFactor * 0.6;
        const bobY = Math.abs(Math.sin(bobTime * 2)) * bobFactor * 0.8;
        const bobRotZ = Math.sin(bobTime) * bobFactor * 0.4;

        // ADS interpolation
        const targetPos = this.isADS ? weapon.posADS : weapon.posDefault;
        const targetFOV = this.isADS ? this.adsFOV : this.defaultFOV;

        // Combinar posição base com bobbing (somente fora do ADS)
        const finalTargetPos = targetPos.clone();
        if (!this.isADS) {
            finalTargetPos.x += bobX;
            finalTargetPos.y += bobY;
            weapon.model.rotation.z = THREE.MathUtils.lerp(weapon.model.rotation.z, bobRotZ, dt * 10);
        } else {
            weapon.model.rotation.z = THREE.MathUtils.lerp(weapon.model.rotation.z, 0, dt * 10);
        }

        weapon.model.position.lerp(finalTargetPos, dt * 12);
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, dt * 10);
        this.camera.updateProjectionMatrix();

        // Recoil recovery
        this.recoilOffset.x = THREE.MathUtils.lerp(this.recoilOffset.x, 0, dt * this.recoilRecovery);
        this.recoilOffset.y = THREE.MathUtils.lerp(this.recoilOffset.y, 0, dt * this.recoilRecovery);

        // Weapon idle breathe (sway passivo)
        const time = performance.now() * 0.001;
        const idleSwayAmount = this.isADS ? 0.0004 : 0.0015;
        weapon.model.rotation.x = Math.sin(time * 1.5) * idleSwayAmount;
        weapon.model.rotation.y = Math.cos(time * 1.2) * idleSwayAmount;

        // Auto fire
        if (this.isFiring && weapon.auto && !this.isReloading) {
            this.tryFire();
        }

        // Reload animation
        if (this.isReloading) {
            const reloadProgress = 1 - ((this._reloadEndTime - performance.now() / 1000) / weapon.reloadTime);
            if (reloadProgress < 0.3) {
                weapon.model.rotation.x = -reloadProgress * 0.5;
            } else if (reloadProgress < 0.7) {
                weapon.model.position.y = weapon.posDefault.y - 0.05;
            } else {
                weapon.model.rotation.x = -(1 - reloadProgress) * 0.3;
                weapon.model.position.y = THREE.MathUtils.lerp(weapon.model.position.y, weapon.posDefault.y, dt * 5);
            }
        }
    },

    tryFire() {
        const weapon = this.weapons[this.currentIndex];
        const now = performance.now() / 1000;

        if (this.isReloading || this.switchCooldown > 0) return null;

        // Faca não precisa de munição para atacar
        if (weapon.type !== 'knife' && weapon.currentMag <= 0) {
            AudioManager.playEmpty();
            this.reload();
            return null;
        }

        if (now - this.lastFireTime < weapon.fireRate) return null;

        this.lastFireTime = now;
        
        if (weapon.type !== 'knife') {
            weapon.currentMag--;
        }

        // Sound
        AudioManager.playShot(weapon.type);

        // Recoil (faca não tem recoil)
        if (weapon.type !== 'knife') {
            this.recoilOffset.y += weapon.recoil * (1 + Math.random() * 0.3);
            this.recoilOffset.x += (Math.random() - 0.5) * weapon.recoil * 0.5;
        }

        // Visual recoil on weapon model
        if (weapon.type === 'knife') {
            // Estocada física rápida
            weapon.model.position.z -= 0.15;
            weapon.model.rotation.y -= 0.45;
        } else {
            weapon.model.position.z += 0.02;
            weapon.model.rotation.x -= 0.03;
        }

        if (weapon.type !== 'knife') {
            // Screen shake
            EffectsManager.screenShake(weapon.type === 'sniper' ? 3 : 0.5);

            // Muzzle flash
            const muzzlePos = new THREE.Vector3(0, 0, -0.5);
            muzzlePos.applyQuaternion(this.camera.quaternion);
            muzzlePos.add(this.camera.position);
            const dir = new THREE.Vector3(0, 0, -1);
            dir.applyQuaternion(this.camera.quaternion);
            EffectsManager.muzzleFlash(muzzlePos, dir);
        }

        // Raycasting for hit detection
        const spread = this.isADS ? weapon.adsSpread : weapon.spread;
        const rayDir = new THREE.Vector3(
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread + this.recoilOffset.y * 0.1,
            -1
        ).normalize();
        rayDir.applyQuaternion(this.camera.quaternion);

        const raycaster = new THREE.Raycaster(
            this.camera.position.clone(),
            rayDir,
            0.1,
            weapon.range
        );

        if (weapon.type !== 'knife') {
            // Bullet tracer com colisão realista
            let tracerEnd = this.camera.position.clone().add(rayDir.clone().multiplyScalar(weapon.range));
            let closestDist = weapon.range;

            // Raycast contra o cenário
            if (typeof GameMap !== 'undefined' && GameMap.collisionBoxes) {
                const mapIntersects = raycaster.intersectObjects(
                    GameMap.collisionBoxes.filter(b => b.mesh).map(b => b.mesh),
                    false
                );
                if (mapIntersects.length > 0 && mapIntersects[0].distance < closestDist) {
                    closestDist = mapIntersects[0].distance;
                    tracerEnd.copy(mapIntersects[0].point);
                }
            }

            // Raycast contra inimigos
            if (typeof EnemyManager !== 'undefined' && EnemyManager.enemyMeshes) {
                const enemyIntersects = raycaster.intersectObjects(EnemyManager.enemyMeshes, false);
                if (enemyIntersects.length > 0 && enemyIntersects[0].distance < closestDist) {
                    closestDist = enemyIntersects[0].distance;
                    tracerEnd.copy(enemyIntersects[0].point);
                }
            }

            const muzzlePos = new THREE.Vector3(0, 0, -0.5);
            muzzlePos.applyQuaternion(this.camera.quaternion);
            muzzlePos.add(this.camera.position);
            EffectsManager.bulletTracer(muzzlePos, tracerEnd);
        }

        return { raycaster, damage: weapon.damage, headshotMult: weapon.headshotMult };
    },

    reload() {
        const weapon = this.weapons[this.currentIndex];
        if (this.isReloading || weapon.currentMag === weapon.magSize || weapon.reserveAmmo <= 0) return;

        this.isReloading = true;
        this.isADS = false;
        this._reloadEndTime = performance.now() / 1000 + weapon.reloadTime;

        AudioManager.playReload();

        // Show reload indicator
        const reloadEl = document.getElementById('reload-indicator');
        if (reloadEl) reloadEl.style.display = 'flex';

        setTimeout(() => {
            if (!this.isReloading) return;
            const needed = weapon.magSize - weapon.currentMag;
            const available = Math.min(needed, weapon.reserveAmmo);
            weapon.currentMag += available;
            weapon.reserveAmmo -= available;
            this.isReloading = false;

            if (reloadEl) reloadEl.style.display = 'none';
        }, weapon.reloadTime * 1000);
    },

    switchWeapon(index) {
        if (index === this.currentIndex || this.switchCooldown > 0 || index < 0 || index >= this.weapons.length) return;

        this.weapons[this.currentIndex].model.visible = false;
        this.isReloading = false;
        this.isADS = false;
        this.currentIndex = index;
        this.weapons[index].model.visible = true;
        this.switchCooldown = 0.5;

        // Reset reload indicator
        const reloadEl = document.getElementById('reload-indicator');
        if (reloadEl) reloadEl.style.display = 'none';

        AudioManager.playWeaponSwitch();

        // Weapon raise animation
        this.weapons[index].model.position.y = this.weapons[index].posDefault.y - 0.1;
        this.weapons[index].model.rotation.x = 0.3;
    },

    nextWeapon() {
        this.switchWeapon((this.currentIndex + 1) % this.weapons.length);
    },

    prevWeapon() {
        this.switchWeapon((this.currentIndex - 1 + this.weapons.length) % this.weapons.length);
    },

    toggleADS() {
        if (this.isReloading) return;
        this.isADS = !this.isADS;
    },

    getCurrentWeapon() {
        return this.weapons[this.currentIndex];
    },

    getRecoilOffset() {
        return this.recoilOffset;
    },

    resetAmmo() {
        this.weapons.forEach(w => {
            w.currentMag = w.magSize;
            w.reserveAmmo = w.maxAmmo;
        });
    }
};
