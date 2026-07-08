// ============================
// ENEMY MANAGER - AI with state machine, wave system
// ============================

const EnemyManager = {
    scene: null,
    enemies: [],
    enemyMeshes: [],   // For raycasting
    waveNumber: 0,
    waveActive: false,
    timeSinceLastSpawn: 0,
    killCount: 0,
    killStreak: 0,
    lastKillTime: 0,

    init(scene) {
        this.scene = scene;
        this.enemies = [];
        this.enemyMeshes = [];
        this.waveNumber = 0;
        this.killCount = 0;
        this.killStreak = 0;
    },

    _createEnemyModel(type) {
        const group = new THREE.Group();
        let bodyColor, headColor;

        switch(type) {
            case 'rusher':
                bodyColor = 0x8b0000;
                headColor = 0x661111;
                break;
            case 'sniper':
                bodyColor = 0x2d4a2d;
                headColor = 0x1a331a;
                break;
            default: // soldier
                bodyColor = 0x4a4a3a;
                headColor = 0x3a3a2a;
        }

        const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.8 });
        const headMat = new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.7 });
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xc4956a, roughness: 0.9 });
        const bootMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

        // Body (torso)
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), bodyMat);
        torso.position.y = 1.1;
        torso.castShadow = true;
        group.add(torso);

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.28, 0.25), skinMat);
        head.position.y = 1.6;
        head.castShadow = true;
        head.name = 'head';
        group.add(head);

        // Helmet
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), headMat);
        helmet.position.y = 1.68;
        helmet.scale.y = 0.7;
        group.add(helmet);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.13, 0.5, 0.13);
        const leftArm = new THREE.Mesh(armGeo, bodyMat);
        leftArm.position.set(-0.35, 1.05, 0);
        leftArm.castShadow = true;
        group.add(leftArm);

        const rightArm = new THREE.Mesh(armGeo, bodyMat);
        rightArm.position.set(0.35, 1.05, 0);
        rightArm.castShadow = true;
        group.add(rightArm);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.16, 0.5, 0.16);
        const leftLeg = new THREE.Mesh(legGeo, bodyMat);
        leftLeg.position.set(-0.12, 0.45, 0);
        leftLeg.castShadow = true;
        group.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeo, bodyMat);
        rightLeg.position.set(0.12, 0.45, 0);
        rightLeg.castShadow = true;
        group.add(rightLeg);

        // Boots
        const bootGeo = new THREE.BoxGeometry(0.18, 0.15, 0.22);
        const leftBoot = new THREE.Mesh(bootGeo, bootMat);
        leftBoot.position.set(-0.12, 0.08, 0.02);
        group.add(leftBoot);

        const rightBoot = new THREE.Mesh(bootGeo, bootMat);
        rightBoot.position.set(0.12, 0.08, 0.02);
        group.add(rightBoot);

        // Weapon (simple)
        const weaponGeo = new THREE.BoxGeometry(0.04, 0.04, 0.3);
        const weaponMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, metalness: 0.7 });
        const weapon = new THREE.Mesh(weaponGeo, weaponMat);
        weapon.position.set(0.35, 1.0, -0.2);
        group.add(weapon);

        return group;
    },

    spawnWave(waveNum) {
        this.waveNumber = waveNum;
        this.waveActive = true;

        let count = waveNum;
        const spawnPoints = GameMap.getSpawnPoints();

        const types = ['soldier', 'soldier', 'soldier', 'rusher', 'sniper'];
        // More variety in later waves
        if (waveNum >= 3) types.push('rusher', 'rusher');
        if (waveNum >= 5) types.push('sniper', 'sniper');

        for (let i = 0; i < count; i++) {
            const spawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)].clone();
            spawn.x += (Math.random() - 0.5) * 8;
            spawn.z += (Math.random() - 0.5) * 8;

            const type = types[Math.floor(Math.random() * types.length)];
            this._spawnEnemy(spawn, type, waveNum);
        }
    },

    _spawnEnemy(position, type, wave) {
        const model = this._createEnemyModel(type);
        model.position.copy(position);
        model.position.y = 0;
        this.scene.add(model);

        const healthMult = 1 + (wave - 1) * 0.15;
        let health, speed, accuracy, damage, fireRate;

        switch(type) {
            case 'rusher':
                health = 60 * healthMult;
                speed = 6;
                accuracy = 0.3;
                damage = 12;
                fireRate = 0.3;
                break;
            case 'sniper':
                health = 50 * healthMult;
                speed = 2;
                accuracy = 0.8;
                damage = 30;
                fireRate = 2.0;
                break;
            default: // soldier
                health = 80 * healthMult;
                speed = 3.5;
                accuracy = 0.5;
                damage = 15;
                fireRate = 0.5;
                break;
        }

        const enemy = {
            model: model,
            type: type,
            health: health,
            maxHealth: health,
            speed: speed,
            accuracy: accuracy,
            damage: damage,
            fireRate: fireRate,
            lastFireTime: 0,
            state: 'patrol',      // patrol, alert, combat, dead
            alertTimer: 0,
            patrolTarget: null,
            detectionRange: type === 'sniper' ? 50 : 30,
            attackRange: type === 'sniper' ? 45 : (type === 'rusher' ? 12 : 20),
            stateTimer: 0,
            strafeDir: Math.random() > 0.5 ? 1 : -1,
            strafeTimer: 0,
            
            // Novas propriedades de feedback de combate
            recoilOffset: 0,
            ammo: type === 'sniper' ? 5 : (type === 'rusher' ? 20 : 30),
            maxAmmo: type === 'sniper' ? 5 : (type === 'rusher' ? 20 : 30),
            isReloading: false,
            reloadTimer: 0,
            reloadDuration: type === 'sniper' ? 2.5 : 1.8,
        };

        this.enemies.push(enemy);
        // Add all child meshes to enemyMeshes for raycasting
        model.traverse((child) => {
            if (child.isMesh) {
                child.userData.enemy = enemy;
                this.enemyMeshes.push(child);
            }
        });
    },

    update(dt, playerPos, playerHealth) {
        if (!playerPos) return;

        for (const enemy of this.enemies) {
            if (enemy.state === 'dead') continue;

            const pos = enemy.model.position;
            const distToPlayer = pos.distanceTo(new THREE.Vector3(playerPos.x, 0, playerPos.z));

            // Inicializar estados de animação suavizados persistentes
            if (enemy.animState === undefined) {
                enemy.animState = {
                    rightArmRotX: 0,
                    rightArmPosZ: 0,
                    leftArmRotX: 0,
                    weaponPosZ: -0.2,
                    weaponRotX: 0,
                    headRotX: 0,
                    torsoRotX: 0,
                    torsoRotZ: 0,
                    bodyBobY: 0
                };
            }

            // Animate walk cycle
            const isMoving = enemy.state === 'patrol' || (enemy.state === 'combat' && distToPlayer > 3.5);
            const walkSpeed = enemy.state === 'combat' || enemy.state === 'alert' ? 6 : 2.5;
            const cycleTime = performance.now() * 0.005 * walkSpeed;
            const walkCycle = isMoving ? Math.sin(cycleTime) : 0;
            const bobCycle = isMoving ? Math.abs(Math.sin(cycleTime * 2)) : 0;

            // Gerenciar recarga do inimigo
            if (enemy.isReloading) {
                enemy.reloadTimer -= dt;
                if (enemy.reloadTimer <= 0) {
                    enemy.ammo = enemy.maxAmmo;
                    enemy.isReloading = false;
                }
            }

            // Decair recuo físico
            enemy.recoilOffset = THREE.MathUtils.lerp(enemy.recoilOffset, 0, dt * 10);

            // Determinar alvos (targets) para cada parte do corpo
            let targetRightArmRotX = walkCycle * 0.3;
            let targetRightArmPosZ = 0;
            let targetLeftArmRotX = -walkCycle * 0.3;
            let targetWeaponPosZ = -0.2;
            let targetWeaponRotX = 0;
            let targetHeadRotX = 0;
            let targetTorsoRotX = 0;
            let targetTorsoRotZ = 0;
            let targetBodyBobY = bobCycle * 0.05;

            if (enemy.isReloading) {
                // Pose de recarga: braços abaixados, cabeça inclinada olhando para a arma, torso inclinado para frente
                targetRightArmRotX = Math.PI / 3.2;
                targetRightArmPosZ = 0.04;
                targetLeftArmRotX = Math.PI / 4.5;
                targetWeaponPosZ = -0.12;
                targetWeaponRotX = Math.PI / 5;
                targetHeadRotX = 0.22;
                targetTorsoRotX = 0.08;
            } else if (enemy.state === 'combat' || enemy.state === 'alert') {
                // Pose de combate/alerta: braço direito estendido segurando a arma
                targetRightArmRotX = -Math.PI / 2.2;
                targetLeftArmRotX = -Math.PI / 4;
                targetHeadRotX = -0.05;
                
                // Inclinação do corpo (leaning) lateral dependendo do strafe
                if (enemy.state === 'combat') {
                    targetTorsoRotZ = -enemy.strafeDir * 0.08;
                    targetTorsoRotX = 0.06;
                }
                
                // Aplicar tranco de recuo físico nos targets
                if (enemy.recoilOffset > 0.01) {
                    targetRightArmPosZ += enemy.recoilOffset * 0.55;
                    targetWeaponPosZ += enemy.recoilOffset * 0.95;
                    targetRightArmRotX -= enemy.recoilOffset * 0.85;
                    targetWeaponRotX -= enemy.recoilOffset * 0.75;
                    targetHeadRotX -= enemy.recoilOffset * 0.35;
                    targetTorsoRotX -= enemy.recoilOffset * 0.25;
                }
            }

            // Lerpar todas as posições/rotações para máxima fluidez
            const lerpSpeed = 12;
            const s = enemy.animState;
            s.rightArmRotX = THREE.MathUtils.lerp(s.rightArmRotX, targetRightArmRotX, dt * lerpSpeed);
            s.rightArmPosZ = THREE.MathUtils.lerp(s.rightArmPosZ, targetRightArmPosZ, dt * lerpSpeed);
            s.leftArmRotX = THREE.MathUtils.lerp(s.leftArmRotX, targetLeftArmRotX, dt * lerpSpeed);
            s.weaponPosZ = THREE.MathUtils.lerp(s.weaponPosZ, targetWeaponPosZ, dt * lerpSpeed);
            s.weaponRotX = THREE.MathUtils.lerp(s.weaponRotX, targetWeaponRotX, dt * lerpSpeed);
            s.headRotX = THREE.MathUtils.lerp(s.headRotX, targetHeadRotX, dt * lerpSpeed);
            s.torsoRotX = THREE.MathUtils.lerp(s.torsoRotX, targetTorsoRotX, dt * lerpSpeed);
            s.torsoRotZ = THREE.MathUtils.lerp(s.torsoRotZ, targetTorsoRotZ, dt * lerpSpeed);
            s.bodyBobY = THREE.MathUtils.lerp(s.bodyBobY, targetBodyBobY, dt * lerpSpeed);

            // Aplicar os estados suavizados nas partes do modelo
            // Pernas (swing)
            const legSwing = walkCycle * 0.32;
            if (enemy.model.children[5]) enemy.model.children[5].rotation.x = legSwing;
            if (enemy.model.children[6]) enemy.model.children[6].rotation.x = -legSwing;
            if (enemy.model.children[7]) enemy.model.children[7].rotation.x = legSwing * 0.15;
            if (enemy.model.children[8]) enemy.model.children[8].rotation.x = -legSwing * 0.15;

            // Braço esquerdo
            if (enemy.model.children[3]) {
                enemy.model.children[3].rotation.x = s.leftArmRotX;
                enemy.model.children[3].rotation.z = -0.1 - Math.abs(walkCycle) * 0.05;
            }

            // Braço direito
            if (enemy.model.children[4]) {
                enemy.model.children[4].rotation.x = s.rightArmRotX;
                enemy.model.children[4].position.z = s.rightArmPosZ;
                enemy.model.children[4].rotation.z = 0.08;
            }

            // Arma
            if (enemy.model.children[9]) {
                enemy.model.children[9].rotation.x = s.weaponRotX;
                enemy.model.children[9].position.z = s.weaponPosZ;
            }

            // Cabeça e Capacete
            if (enemy.model.children[1]) enemy.model.children[1].rotation.x = s.headRotX;
            if (enemy.model.children[2]) {
                enemy.model.children[2].rotation.x = s.headRotX;
                enemy.model.children[2].position.z = -s.headRotX * 0.04;
            }

            // Torso (Gingado e Bobbing)
            if (enemy.model.children[0]) {
                enemy.model.children[0].rotation.x = s.torsoRotX;
                enemy.model.children[0].rotation.z = s.torsoRotZ;
                enemy.model.children[0].position.y = 1.1 - s.bodyBobY;
            }

            // State machine
            switch(enemy.state) {
                case 'patrol':
                    this._updatePatrol(enemy, dt, distToPlayer);
                    break;
                case 'alert':
                    this._updateAlert(enemy, dt, playerPos, distToPlayer);
                    break;
                case 'combat':
                    this._updateCombat(enemy, dt, playerPos, distToPlayer);
                    break;
            }

            // Check detection
            if (enemy.state === 'patrol' && distToPlayer < enemy.detectionRange) {
                enemy.state = 'alert';
                enemy.alertTimer = 0.5 + Math.random() * 0.5;
            }
        }

        // Check if wave complete
        if (this.waveActive && this.getAliveCount() === 0) {
            this.waveActive = false;
        }
    },

    _updatePatrol(enemy, dt) {
        if (!enemy.patrolTarget) {
            enemy.patrolTarget = new THREE.Vector3(
                (Math.random() - 0.5) * 60,
                0,
                (Math.random() - 0.5) * 60
            );
        }

        const pos = enemy.model.position;
        const dir = enemy.patrolTarget.clone().sub(pos).normalize();
        pos.x += dir.x * enemy.speed * 0.3 * dt;
        pos.z += dir.z * enemy.speed * 0.3 * dt;

        // Face movement direction
        enemy.model.rotation.y = Math.atan2(dir.x, dir.z);

        // Collision check
        const collision = GameMap.checkCollision(new THREE.Vector3(pos.x, 1, pos.z), 0.5);
        if (collision.collided) {
            pos.x += collision.pushX;
            pos.z += collision.pushZ;
            enemy.patrolTarget = null;
            return;
        }

        if (enemy.patrolTarget && pos.distanceTo(enemy.patrolTarget) < 2) {
            enemy.patrolTarget = null;
        }
    },

    _updateAlert(enemy, dt, playerPos, dist) {
        enemy.alertTimer -= dt;

        // Face player
        const dir = new THREE.Vector3(playerPos.x - enemy.model.position.x, 0, playerPos.z - enemy.model.position.z).normalize();
        enemy.model.rotation.y = Math.atan2(dir.x, dir.z);

        if (enemy.alertTimer <= 0) {
            enemy.state = 'combat';
        }
    },

    _updateCombat(enemy, dt, playerPos, dist) {
        const pos = enemy.model.position;
        const dir = new THREE.Vector3(playerPos.x - pos.x, 0, playerPos.z - pos.z).normalize();

        // Face player
        const targetRot = Math.atan2(dir.x, dir.z);
        enemy.model.rotation.y = THREE.MathUtils.lerp(enemy.model.rotation.y, targetRot, dt * 5);

        // Movement behavior based on type
        if (enemy.type === 'rusher') {
            // Rush towards player
            if (dist > 3) {
                pos.x += dir.x * enemy.speed * dt;
                pos.z += dir.z * enemy.speed * dt;
            }
        } else if (enemy.type === 'sniper') {
            // Stay at range, strafe
            if (dist < 15) {
                pos.x -= dir.x * enemy.speed * dt;
                pos.z -= dir.z * enemy.speed * dt;
            }
            enemy.strafeTimer -= dt;
            if (enemy.strafeTimer <= 0) {
                enemy.strafeDir *= -1;
                enemy.strafeTimer = 1.5 + Math.random() * 2;
            }
            const strafe = new THREE.Vector3(-dir.z, 0, dir.x);
            pos.x += strafe.x * enemy.speed * 0.5 * enemy.strafeDir * dt;
            pos.z += strafe.z * enemy.speed * 0.5 * enemy.strafeDir * dt;
        } else {
            // Soldier: advance and strafe
            if (dist > 8) {
                pos.x += dir.x * enemy.speed * dt;
                pos.z += dir.z * enemy.speed * dt;
            }
            enemy.strafeTimer -= dt;
            if (enemy.strafeTimer <= 0) {
                enemy.strafeDir *= -1;
                enemy.strafeTimer = 1 + Math.random() * 1.5;
            }
            const strafe = new THREE.Vector3(-dir.z, 0, dir.x);
            pos.x += strafe.x * enemy.speed * 0.4 * enemy.strafeDir * dt;
            pos.z += strafe.z * enemy.speed * 0.4 * enemy.strafeDir * dt;
        }

        // Collision check
        const collision = GameMap.checkCollision(new THREE.Vector3(pos.x, 1, pos.z), 0.5);
        if (collision.collided) {
            pos.x += collision.pushX;
            pos.z += collision.pushZ;
        }

        // Keep in bounds
        const bound = 38;
        pos.x = Math.max(-bound, Math.min(bound, pos.x));
        pos.z = Math.max(-bound, Math.min(bound, pos.z));

        // Shooting
        const now = performance.now() / 1000;
        if (dist < enemy.attackRange && !enemy.isReloading && now - enemy.lastFireTime > enemy.fireRate) {
            enemy.lastFireTime = now;
            this._enemyShoot(enemy, playerPos, dist);
        }

        // If player too far, go back to alert
        if (dist > enemy.detectionRange * 1.5) {
            enemy.state = 'patrol';
            enemy.patrolTarget = null;
        }
    },

    _enemyShoot(enemy, playerPos, dist) {
        // Reduzir munição
        enemy.ammo--;
        if (enemy.ammo <= 0) {
            enemy.isReloading = true;
            enemy.reloadTimer = enemy.reloadDuration;
            return;
        }

        // Aplicar recoil visual no objeto do inimigo
        enemy.recoilOffset = 0.22;

        // Calcular a posição da ponta da arma globalmente
        const gunTip = new THREE.Vector3(0.35, 1.0, -0.35);
        gunTip.applyMatrix4(enemy.model.matrixWorld);

        // Direção do disparo (rumo à altura da câmera do player)
        const playerEyePos = playerPos.clone();
        playerEyePos.y += 0.5;
        const fireDir = new THREE.Vector3().subVectors(playerEyePos, gunTip).normalize();

        // Muzzle Flash na arma do inimigo
        EffectsManager.muzzleFlash(gunTip, fireDir);

        // Raycast do tiro do inimigo para detecção de obstáculos (paredes)
        const enemyRaycaster = new THREE.Raycaster(
            gunTip.clone(),
            fireDir.clone(),
            0.1,
            dist + 5
        );

        const mapIntersects = enemyRaycaster.intersectObjects(
            GameMap.collisionBoxes.filter(b => b.mesh).map(b => b.mesh),
            false
        );

        const isBlockedByWall = mapIntersects.length > 0 && mapIntersects[0].distance < dist;

        if (isBlockedByWall) {
            // Tiro bateu na parede antes de chegar ao jogador
            const hitPoint = mapIntersects[0].point;
            EffectsManager.bulletTracer(gunTip, hitPoint);
            EffectsManager.impact(hitPoint, mapIntersects[0].face ? mapIntersects[0].face.normal : null);
        } else {
            // Caminho livre
            // Accuracy check - mais longe = menos preciso
            const accuracyMod = Math.max(0.1, enemy.accuracy - dist * 0.005);
            const hit = Math.random() < accuracyMod;

            if (hit && typeof Game !== 'undefined' && Game.player && Game.player.isAlive) {
                // Se acertar o jogador, o traçador vai para a posição dele
                const hitPoint = playerPos.clone().setY(playerPos.y - 0.3 + Math.random() * 0.6);
                EffectsManager.bulletTracer(gunTip, hitPoint);

                // Determinar direção para o indicador de dano
                const dx = enemy.model.position.x - playerPos.x;
                const dz = enemy.model.position.z - playerPos.z;
                Game.player.takeDamage(enemy.damage, { x: dx, z: dz });
            } else {
                // Se errar, o traçador vai para uma posição ligeiramente dispersada (de raspão)
                const spread = 2.5 + Math.random() * 3.5;
                const missOffset = new THREE.Vector3(
                    (Math.random() - 0.5) * spread,
                    (Math.random() - 0.5) * spread,
                    (Math.random() - 0.5) * spread
                );
                const missPoint = playerEyePos.clone().add(missOffset);
                
                // Raycast para ver se a bala perdida bate em alguma parede atrás
                const missDir = new THREE.Vector3().subVectors(missPoint, gunTip).normalize();
                const missRay = new THREE.Raycaster(gunTip.clone(), missDir, 0.1, 100);
                const missIntersects = missRay.intersectObjects(
                    GameMap.collisionBoxes.filter(b => b.mesh).map(b => b.mesh),
                    false
                );
                
                let tracerEnd = missPoint;
                if (missIntersects.length > 0) {
                    tracerEnd = missIntersects[0].point;
                    EffectsManager.impact(missIntersects[0].point, missIntersects[0].face ? missIntersects[0].face.normal : null);
                }
                EffectsManager.bulletTracer(gunTip, tracerEnd);
            }
        }

        // Som de disparo do inimigo
        AudioManager.playShot(enemy.type === 'sniper' ? 'sniper' : 'ar');
    },

    checkHit(raycaster, damage, headshotMult, wallDist = Infinity) {
        const intersects = raycaster.intersectObjects(this.enemyMeshes, false);
        if (intersects.length === 0) return null;

        const hit = intersects[0];
        if (hit.distance > wallDist) return null;

        const enemy = hit.object.userData.enemy;
        if (!enemy || enemy.state === 'dead') return null;

        // Check headshot
        const isHeadshot = hit.object.name === 'head';
        const finalDamage = isHeadshot ? damage * headshotMult : damage;

        enemy.health -= finalDamage;

        // Flash enemy red
        hit.object.material._origColor = hit.object.material._origColor || hit.object.material.color.getHex();
        hit.object.material.color.setHex(0xff0000);
        setTimeout(() => {
            if (hit.object.material._origColor !== undefined) {
                hit.object.material.color.setHex(hit.object.material._origColor);
            }
        }, 100);

        // Alert the enemy
        if (enemy.state === 'patrol') {
            enemy.state = 'combat';
        }

        // Blood effect
        EffectsManager.bloodSplat(hit.point);

        if (enemy.health <= 0) {
            this._killEnemy(enemy);
            return { killed: true, headshot: isHeadshot, point: hit.point, type: enemy.type };
        }

        return { killed: false, headshot: isHeadshot, point: hit.point, type: enemy.type };
    },

    _killEnemy(enemy) {
        enemy.state = 'dead';
        this.killCount++;
        
        // Add money
        if (typeof Game !== 'undefined') {
            Game.addMoney(100);
            if (typeof HUD !== 'undefined') HUD.addKillFeed('+ $100');
        }

        // Kill streak
        const now = performance.now() / 1000;
        if (now - this.lastKillTime < 3) {
            this.killStreak++;
        } else {
            this.killStreak = 1;
        }
        this.lastKillTime = now;

        // Death animation - fall over with ragdoll style rotation
        const deathAnim = () => {
            let angle = 0;
            const fallSpeed = 0.055;
            const rotDirY = (Math.random() - 0.5) * 0.4;
            const rotDirZ = (Math.random() - 0.5) * 0.45;
            
            const interval = setInterval(() => {
                angle += fallSpeed;
                
                // Queda física com rotações combinadas
                enemy.model.rotation.x = angle * 0.92;
                enemy.model.rotation.y += rotDirY * 0.04;
                enemy.model.rotation.z += rotDirZ * 0.04;
                
                // Afundamento de altura do corpo
                enemy.model.position.y = -Math.sin(angle) * 0.42;
                
                // Relaxar braços ao morrer
                if (enemy.model.children[3]) enemy.model.children[3].rotation.x = THREE.MathUtils.lerp(enemy.model.children[3].rotation.x, 0, 0.12);
                if (enemy.model.children[4]) enemy.model.children[4].rotation.x = THREE.MathUtils.lerp(enemy.model.children[4].rotation.x, 0, 0.12);
                
                if (angle >= Math.PI / 2) {
                    clearInterval(interval);
                    // Remove after delay
                    setTimeout(() => {
                        this.scene.remove(enemy.model);
                        // Clean up meshes from raycasting array
                        enemy.model.traverse((child) => {
                            if (child.isMesh) {
                                const idx = this.enemyMeshes.indexOf(child);
                                if (idx > -1) this.enemyMeshes.splice(idx, 1);
                            }
                        });
                    }, 5000);
                }
            }, 16);
        };
        deathAnim();

        AudioManager.playKill();
    },

    getAliveCount() {
        return this.enemies.filter(e => e.state !== 'dead').length;
    },

    getKillStreak() {
        const now = performance.now() / 1000;
        if (now - this.lastKillTime > 3) this.killStreak = 0;
        return this.killStreak;
    },

    // Generic damage method for explosions (grenades, barrels)
    damageEnemy(enemy, damage, explosionPos) {
        if (!enemy || enemy.state === 'dead') return;

        enemy.health -= damage;

        // Flash enemy red
        enemy.model.traverse(child => {
            if (child.isMesh) {
                child.material._origColor = child.material._origColor || child.material.color.getHex();
                child.material.color.setHex(0xff4400);
                setTimeout(() => {
                    if (child.material._origColor !== undefined) {
                        child.material.color.setHex(child.material._origColor);
                    }
                }, 200);
            }
        });

        // Alert enemy
        if (enemy.state === 'patrol') {
            enemy.state = 'combat';
        }

        // Blood effect at enemy position
        EffectsManager.bloodSplat(enemy.model.position.clone().setY(1.0));

        // Knockback from explosion
        if (explosionPos) {
            const dir = enemy.model.position.clone().sub(explosionPos).normalize();
            enemy.model.position.x += dir.x * 1.5;
            enemy.model.position.z += dir.z * 1.5;
        }

        if (enemy.health <= 0) {
            this._killEnemy(enemy);

            // Score and kill feed
            if (typeof Game !== 'undefined') {
                Game.kills++;
                Game.addScore(100);
                HUD.addKillFeed(`💥 Inimigo eliminado pela explosão!`);

                const streak = this.getKillStreak();
                if (streak >= 3) {
                    HUD.showKillStreak(streak);
                }
            }
        }
    },

    cleanup() {
        for (const enemy of this.enemies) {
            this.scene.remove(enemy.model);
        }
        this.enemies = [];
        this.enemyMeshes = [];
    }
};
