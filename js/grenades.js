// ============================
// GRENADE SYSTEM - Frag grenades with physics, timer, area damage
// ============================

const GrenadeSystem = {
    scene: null,
    camera: null,
    grenades: [],       // Active grenades in the world
    maxGrenades: 2,     // Max per respawn
    currentCount: 2,
    throwForce: 22,
    throwAngle: 0.35,   // Radians upward angle
    fuseTime: 3.0,      // Seconds before detonation
    explosionRadius: 8,
    maxDamage: 120,
    minDamage: 20,
    isThrowing: false,
    throwCooldown: 0,

    init(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.grenades = [];
        this.currentCount = 2;
    },

    throwGrenade(playerPos, cameraQuat) {
        if (this.currentCount <= 0 || this.throwCooldown > 0) return false;

        this.currentCount--;
        this.throwCooldown = 0.8;

        // Calculate throw direction from camera
        const throwDir = new THREE.Vector3(0, this.throwAngle, -1).normalize();
        throwDir.applyQuaternion(cameraQuat);

        // Create grenade mesh
        const grenadeGroup = new THREE.Group();

        // Body
        const bodyGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a5a3a, roughness: 0.6, metalness: 0.4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.scale.y = 1.4;
        grenadeGroup.add(body);

        // Spoon/Lever
        const spoonGeo = new THREE.BoxGeometry(0.015, 0.08, 0.04);
        const spoonMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.3 });
        const spoon = new THREE.Mesh(spoonGeo, spoonMat);
        spoon.position.set(0.04, 0.03, 0);
        grenadeGroup.add(spoon);

        // Pin ring (visual only)
        const ringGeo = new THREE.TorusGeometry(0.02, 0.004, 6, 8);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(0, 0.06, 0);
        ring.rotation.x = Math.PI / 2;
        grenadeGroup.add(ring);

        // Start position (slightly in front and below camera)
        const startPos = playerPos.clone();
        startPos.y -= 0.3;
        const forward = new THREE.Vector3(0, 0, -0.5);
        forward.applyQuaternion(cameraQuat);
        startPos.add(forward);
        grenadeGroup.position.copy(startPos);

        this.scene.add(grenadeGroup);

        // Fuse indicator light (blinking)
        const fuseLight = new THREE.PointLight(0xff3300, 0, 3);
        fuseLight.position.copy(startPos);
        this.scene.add(fuseLight);

        const grenade = {
            mesh: grenadeGroup,
            light: fuseLight,
            position: startPos.clone(),
            velocity: throwDir.clone().multiplyScalar(this.throwForce),
            angularVel: new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            ),
            fuseTimer: this.fuseTime,
            bounced: false,
            active: true
        };

        this.grenades.push(grenade);

        // Sound
        AudioManager.playGrenadeThrow();

        return true;
    },

    update(dt) {
        if (this.throwCooldown > 0) this.throwCooldown -= dt;

        for (let i = this.grenades.length - 1; i >= 0; i--) {
            const g = this.grenades[i];
            if (!g.active) continue;

            // Physics
            g.velocity.y -= 18 * dt; // Gravity
            g.position.add(g.velocity.clone().multiplyScalar(dt));

            // Rotation (tumbling)
            g.mesh.rotation.x += g.angularVel.x * dt;
            g.mesh.rotation.y += g.angularVel.y * dt;
            g.mesh.rotation.z += g.angularVel.z * dt;

            // Ground bounce
            if (g.position.y <= 0.06) {
                g.position.y = 0.06;
                g.velocity.y = Math.abs(g.velocity.y) * 0.3; // Bounce damping
                g.velocity.x *= 0.7;
                g.velocity.z *= 0.7;
                g.angularVel.multiplyScalar(0.6);

                if (!g.bounced) {
                    g.bounced = true;
                    AudioManager.playGrenadeBounce();
                }

                // Stop if slow enough
                if (Math.abs(g.velocity.y) < 0.5) {
                    g.velocity.y = 0;
                    g.position.y = 0.06;
                }
            }

            // Wall collision
            const collision = GameMap.checkCollision(new THREE.Vector3(g.position.x, 1, g.position.z), 0.15);
            if (collision.collided) {
                g.position.x += collision.pushX * 1.5;
                g.position.z += collision.pushZ * 1.5;
                g.velocity.x *= -0.5;
                g.velocity.z *= -0.5;
                if (!g.bounced) {
                    g.bounced = true;
                    AudioManager.playGrenadeBounce();
                }
            }

            // Bounds
            g.position.x = Math.max(-39, Math.min(39, g.position.x));
            g.position.z = Math.max(-39, Math.min(39, g.position.z));

            // Update mesh position
            g.mesh.position.copy(g.position);
            g.light.position.copy(g.position);

            // Fuse countdown
            g.fuseTimer -= dt;

            // Blinking fuse light (faster as timer decreases)
            const blinkRate = Math.max(0.08, g.fuseTimer * 0.15);
            const blinkOn = (Math.floor(g.fuseTimer / blinkRate) % 2 === 0);
            g.light.intensity = blinkOn ? 2 + (3 - g.fuseTimer) * 2 : 0;
            g.light.color.setHex(g.fuseTimer < 1 ? 0xff0000 : 0xff3300);

            // Detonate!
            if (g.fuseTimer <= 0) {
                this._detonate(g);
                g.active = false;

                // Cleanup
                this.scene.remove(g.mesh);
                this.scene.remove(g.light);
                g.mesh.traverse(child => {
                    if (child.isMesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) child.material.dispose();
                    }
                });

                this.grenades.splice(i, 1);
            }
        }
    },

    _detonate(grenade) {
        const pos = grenade.position.clone();

        // Massive explosion effect
        EffectsManager.grenadeExplosion(pos);
        EffectsManager.screenShake(6);

        // Explosion sound
        AudioManager.playGrenadeExplosion();

        // Damage enemies in radius
        if (typeof EnemyManager !== 'undefined') {
            for (const enemy of EnemyManager.enemies) {
                if (enemy.state === 'dead') continue;
                const dist = enemy.model.position.distanceTo(pos);
                if (dist < this.explosionRadius) {
                    // Damage falls off linearly with distance
                    const falloff = 1 - (dist / this.explosionRadius);
                    const damage = this.minDamage + (this.maxDamage - this.minDamage) * falloff;
                    EnemyManager.damageEnemy(enemy, damage, pos);
                }
            }
        }

        // Damage player if in radius
        if (typeof PlayerController !== 'undefined' && PlayerController.isAlive) {
            const playerPos = PlayerController.getPosition();
            const dist = new THREE.Vector3(playerPos.x, 0, playerPos.z).distanceTo(new THREE.Vector3(pos.x, 0, pos.z));
            if (dist < this.explosionRadius) {
                const falloff = 1 - (dist / this.explosionRadius);
                const damage = (this.minDamage + (this.maxDamage - this.minDamage) * falloff) * 0.6; // Self-damage reduced
                PlayerController.takeDamage(damage, { x: pos.x - playerPos.x, z: pos.z - playerPos.z });
            }
        }

        // Trigger explosive barrel chain reaction
        if (typeof GameMap !== 'undefined' && GameMap.explosiveBarrels) {
            for (const barrel of GameMap.explosiveBarrels) {
                if (barrel.exploded) continue;
                const dist = new THREE.Vector3(barrel.x, 0, barrel.z).distanceTo(new THREE.Vector3(pos.x, 0, pos.z));
                if (dist < this.explosionRadius * 0.8) {
                    setTimeout(() => GameMap.detonateBarrel(barrel), 150 + Math.random() * 300);
                }
            }
        }
    },

    reset() {
        // Cleanup active grenades
        for (const g of this.grenades) {
            this.scene.remove(g.mesh);
            this.scene.remove(g.light);
        }
        this.grenades = [];
        this.currentCount = this.maxGrenades;
        this.throwCooldown = 0;
    },

    getCount() {
        return this.currentCount;
    }
};
