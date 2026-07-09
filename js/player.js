// ============================
// PLAYER CONTROLLER - First-person movement, health, pointer lock
// ============================

const PlayerController = {
    camera: null,
    scene: null,
    position: new THREE.Vector3(0, 1.7, 0),
    velocity: new THREE.Vector3(),
    euler: new THREE.Euler(0, 0, 0, 'YXZ'),
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    isSprinting: false,
    isCrouching: false,
    isJumping: false,
    onGround: true,
    health: 100,
    maxHealth: 100,
    isAlive: true,
    lastDamageTime: 0,
    regenDelay: 3,      // seconds before regen starts
    regenRate: 15,       // health per second
    mouseSensitivity: 0.002,
    walkSpeed: 30,
    sprintSpeed: 13.5,
    crouchSpeed: 2.5,
    jumpForce: 80,
    gravity: 20,
    standHeight: 1.7,
    crouchHeight: 1.0,
    currentHeight: 1.7,
    footstepTimer: 0,
    footstepInterval: 0.45,
    locked: false,

    // Novas mecânicas de movimento
    isSliding: false,
    slideTimer: 0,
    slideDuration: 0.6,
    slideSpeed: 20,
    slideDirection: new THREE.Vector3(),
    slideCooldown: 0,
    isDashing: false,
    dashTimer: 0,
    dashDuration: 0.22,
    dashSpeed: 180,
    dashDirection: new THREE.Vector3(),
    dashCooldown: 0,
    maxDashCooldown: 1.2,
    doubleJumpAvailable: true,
    isWallRunning: false,
    wallRunSide: '', // 'left', 'right'
    wallRunTimer: 0,
    wallRunDuration: 1.2,
    wallRunCooldown: 0,
    wallNormal: new THREE.Vector3(),
    cameraRoll: 0,
    targetCameraRoll: 0,
    nightVisionActive: true,


    init(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        const spawn = GameMap.getPlayerSpawn();
        this.position.copy(spawn);
        camera.position.copy(this.position);

        this._setupPointerLock();
        this._setupInputs();
    },

    _setupPointerLock() {
        const canvas = document.getElementById('game-canvas');

        canvas.addEventListener('click', () => {
            if (typeof Game !== 'undefined' && Game.state === 'playing') {
                canvas.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.locked = document.pointerLockElement === canvas;
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.locked || !this.isAlive) return;

            this.mouseMoveX = (this.mouseMoveX || 0) + e.movementX;
            this.mouseMoveY = (this.mouseMoveY || 0) + e.movementY;

            this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');

            this.euler.y -= e.movementX * this.mouseSensitivity;
            this.euler.x -= e.movementY * this.mouseSensitivity;

            // Clamp vertical look
            this.euler.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.euler.x));

            // Manter a inclinação da câmera lateral
            this.euler.z = this.cameraRoll || 0;

            this.camera.quaternion.setFromEuler(this.euler);
        });
    },

    _setupInputs() {
        document.addEventListener('keydown', (e) => {
            if (typeof Game === 'undefined' || Game.state !== 'playing') return;

            switch(e.code) {
                case 'KeyW': this.moveForward = true; break;
                case 'KeyS': this.moveBackward = true; break;
                case 'KeyA': this.moveLeft = true; break;
                case 'KeyD': this.moveRight = true; break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.isSprinting = true;
                    if (this.isCrouching) {
                        this.isCrouching = false;
                    }
                    break;
                case 'KeyC':
                    if (this.isSprinting && this.onGround && !this.isSliding && (this.moveForward || this.moveBackward || this.moveLeft || this.moveRight)) {
                        const forward = new THREE.Vector3();
                        const right = new THREE.Vector3();
                        this.camera.getWorldDirection(forward);
                        forward.y = 0;
                        forward.normalize();
                        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
                        
                        const slideDir = new THREE.Vector3();
                        if (this.moveForward) slideDir.add(forward);
                        if (this.moveBackward) slideDir.sub(forward);
                        if (this.moveLeft) slideDir.sub(right);
                        if (this.moveRight) slideDir.add(right);
                        slideDir.normalize();
                        
                        this.isSliding = true;
                        this.slideTimer = this.slideDuration;
                        this.slideDirection.copy(slideDir);
                        this.isCrouching = true;
                        this.isSprinting = false;
                        AudioManager.playSlide();
                    } else {
                        if (this.isSliding) {
                            this.isSliding = false;
                            this.isCrouching = false;
                        } else {
                            this.isCrouching = !this.isCrouching;
                        }
                        if (this.isCrouching) this.isSprinting = false;
                    }
                    break;
                case 'Space':
                    if (this.isOnLadder) {
                        // Pulo de escada (salta para trás da direção que olha)
                        this.isOnLadder = false;
                        this.velocity.y = this.jumpForce * 0.8;
                        const lookDir = new THREE.Vector3();
                        this.camera.getWorldDirection(lookDir);
                        lookDir.y = 0;
                        lookDir.normalize().negate().multiplyScalar(4.0);
                        this.velocity.x = lookDir.x;
                        this.velocity.z = lookDir.z;
                        
                        this.doubleJumpAvailable = true;
                        this.isJumping = true;
                        this.onGround = false;
                        AudioManager.playFootstep();
                    } else if (this.isWallRunning) {
                        // Pulo de parede
                        this.isWallRunning = false;
                        this.velocity.y = this.jumpForce * 0.95;
                        
                        // Empurra o jogador na direção da normal da parede
                        this.velocity.x = this.wallNormal.x * this.walkSpeed * 1.6;
                        this.velocity.z = this.wallNormal.z * this.walkSpeed * 1.6;
                        
                        // Adicionar também o vetor de frente para não perder momentum
                        const forward = new THREE.Vector3();
                        this.camera.getWorldDirection(forward);
                        forward.y = 0;
                        forward.normalize();
                        this.velocity.addScaledVector(forward, this.walkSpeed * 0.5);
                        
                        this.doubleJumpAvailable = true;
                        this.isJumping = true;
                        this.onGround = false;
                        AudioManager.playFootstep();
                    } else if (this.onGround) {
                        this.velocity.y = this.jumpForce;
                        this.onGround = false;
                        this.isJumping = true;
                        this.isCrouching = false;
                        this.isSliding = false;
                    } else if (this.doubleJumpAvailable) {
                        // Pulo duplo
                        this.velocity.y = this.jumpForce * 0.8;
                        this.doubleJumpAvailable = false;
                        this.isJumping = true;
                        AudioManager.playFootstep();
                        EffectsManager.screenShake(0.5);
                    }
                    break;
                case 'KeyQ':
                    if (this.dashCooldown <= 0 && this.isAlive) {
                        const forward = new THREE.Vector3();
                        const right = new THREE.Vector3();
                        this.camera.getWorldDirection(forward);
                        forward.y = 0;
                        forward.normalize();
                        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
                        
                        const dashDir = new THREE.Vector3();
                        if (this.moveForward) dashDir.add(forward);
                        if (this.moveBackward) dashDir.sub(forward);
                        if (this.moveLeft) dashDir.sub(right);
                        if (this.moveRight) dashDir.add(right);
                        
                        if (dashDir.lengthSq() === 0) {
                            dashDir.copy(forward); // Se não estiver apertando nada, vai pra frente
                        }
                        dashDir.normalize();
                        
                        this.isDashing = true;
                        this.dashTimer = this.dashDuration;
                        this.dashDirection.copy(dashDir);
                        this.dashCooldown = this.maxDashCooldown;
                        this.isSliding = false; // Cancela slide se dashar
                        
                        AudioManager.playDash();
                        EffectsManager.screenShake(1.2);
                    }
                    break;
                case 'KeyR':
                    WeaponSystem.reload();
                    break;
                case 'Digit1': WeaponSystem.switchWeapon(0); break;
                case 'Digit2': WeaponSystem.switchWeapon(1); break;
                case 'Digit3': WeaponSystem.switchWeapon(2); break;
                case 'Digit4': WeaponSystem.switchWeapon(3); break;
                case 'Digit5': WeaponSystem.switchWeapon(4); break;
                case 'KeyG':
                    if (typeof GrenadeSystem !== 'undefined') {
                        GrenadeSystem.throwGrenade(
                            this.position.clone(),
                            this.camera.quaternion.clone()
                        );
                    }
                    break;
                case 'KeyN':
                    this.nightVisionActive = !this.nightVisionActive;
                    this._toggleNightVision(this.nightVisionActive);
                    break;
                case 'KeyE':
                case 'KeyF':
                    if (typeof GameMap !== 'undefined' && GameMap.chests) {
                        for (const chest of GameMap.chests) {
                            if (!chest.opened) {
                                const dist = this.position.distanceTo(new THREE.Vector3(chest.x, this.position.y, chest.z));
                                if (dist < 3.0) {
                                    chest.opened = true;
                                    chest.group.children[1].rotation.x = -Math.PI / 4;
                                    chest.group.children[1].position.z -= 0.2;
                                    chest.group.children[1].position.y += 0.2;
                                    
                                    if (typeof Game !== 'undefined') {
                                        Game.addMoney(200);
                                        if (typeof HUD !== 'undefined') HUD.addKillFeed('+$200');
                                    }
                                    
                                    AudioManager.playReload();
                                    break;
                                }
                            }
                        }
                    }
                    break;
                case 'Escape':
                    if (Game.state === 'playing') Game.pause();
                    break;
            }
        });

        document.addEventListener('keyup', (e) => {
            switch(e.code) {
                case 'KeyW': this.moveForward = false; break;
                case 'KeyS': this.moveBackward = false; break;
                case 'KeyA': this.moveLeft = false; break;
                case 'KeyD': this.moveRight = false; break;
            }
        });

        // Mouse buttons
        document.addEventListener('mousedown', (e) => {
            if (typeof Game === 'undefined' || Game.state !== 'playing' || !this.locked) return;
            if (e.button === 0) { // Left click - fire
                WeaponSystem.isFiring = true;
                const hitInfo = WeaponSystem.tryFire();
                if (hitInfo) {
                    if (Array.isArray(hitInfo)) {
                        hitInfo.forEach(h => this._processHit(h));
                    } else {
                        this._processHit(hitInfo);
                    }
                }
            }
            if (e.button === 2) { // Right click - ADS
                WeaponSystem.toggleADS();
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                WeaponSystem.isFiring = false;
            }
            if (e.button === 2) {
                if (WeaponSystem.isADS) WeaponSystem.toggleADS();
            }
        });

        // Prevent context menu
        document.addEventListener('contextmenu', (e) => e.preventDefault());

        // Scroll wheel - weapon switch
        document.addEventListener('wheel', (e) => {
            if (typeof Game === 'undefined' || Game.state !== 'playing') return;
            if (e.deltaY > 0) WeaponSystem.nextWeapon();
            else WeaponSystem.prevWeapon();
        });
    },

    _processHit(hitInfo) {
        const { raycaster, damage, headshotMult } = hitInfo;

        // Check map hits for distance checking
        const mapIntersects = raycaster.intersectObjects(
            GameMap.collisionBoxes.filter(b => b.mesh).map(b => b.mesh),
            false
        );
        const wallDist = mapIntersects.length > 0 ? mapIntersects[0].distance : Infinity;

        // Check barrel hit
        if (typeof GameMap !== 'undefined' && GameMap.checkBarrelHit) {
            GameMap.checkBarrelHit(raycaster, wallDist);
        }

        // Check online players hits (restricted by wall distance)
        if (typeof MultiplayerSystem !== 'undefined' && MultiplayerSystem.active) {
            const playerBoxes = GameMap.collisionBoxes.filter(b => b.isOtherPlayer);
            if (playerBoxes.length > 0) {
                for (const box of playerBoxes) {
                    const boundingBox = new THREE.Box3(box.min, box.max);
                    const intersectPoint = new THREE.Vector3();
                    if (raycaster.ray.intersectBox(boundingBox, intersectPoint)) {
                        const hitDist = raycaster.ray.origin.distanceTo(intersectPoint);
                        if (hitDist < wallDist) {
                            const isHeadshot = intersectPoint.y > (box.min.y + (box.max.y - box.min.y) * 0.75);
                            const finalDamage = isHeadshot ? damage * headshotMult : damage;
                            
                            MultiplayerSystem.damageOtherPlayer(box.playerUid, finalDamage);
                            
                            AudioManager.playHitmarker();
                            HUD.showHitmarker(isHeadshot);
                            return;
                        }
                    }
                }
            }
        }

        // Check enemy hits (restricted by wall distance)
        const enemyHit = EnemyManager.checkHit(raycaster, damage, headshotMult, wallDist);
        if (enemyHit) {
            if (enemyHit.killed) {
                AudioManager.playKill();
                HUD.showHitmarker(true);

                const scoreBase = 100;
                const headshotBonus = enemyHit.headshot ? 50 : 0;
                Game.addScore(scoreBase + headshotBonus);
                Game.kills++;

                let killText = `Você eliminou ${enemyHit.type.toUpperCase()}`;
                if (enemyHit.headshot) killText += ' 🎯 HEADSHOT';
                HUD.addKillFeed(killText);

                // Kill streak
                const streak = EnemyManager.getKillStreak();
                if (streak >= 3) {
                    HUD.showKillStreak(streak);
                }
            } else {
                AudioManager.playHitmarker();
                HUD.showHitmarker(false);
            }
            return;
        }

        // If no enemy hit, show wall impact if we hit a wall
        if (mapIntersects.length > 0) {
            EffectsManager.impact(mapIntersects[0].point, mapIntersects[0].face ? mapIntersects[0].face.normal : null);
        }
    },

    _toggleNightVision(on) {
        AudioManager.playNVToggle(on);

        const nvOverlay = document.getElementById('nv-overlay');
        const nvGrain = document.getElementById('nv-grain');

        if (on) {
            if (nvOverlay) nvOverlay.classList.add('active');
            if (nvGrain) nvGrain.classList.add('active');

            // Darken scene, boost exposure
            if (Game.renderer) {
                Game.renderer.toneMappingExposure = 2.5;
            }
            if (Game.scene && Game.scene.fog) {
                Game.scene.fog.color.setHex(0x001a00);
            }
        } else {
            if (nvOverlay) nvOverlay.classList.remove('active');
            if (nvGrain) nvGrain.classList.remove('active');

            // Restore scene
            if (Game.renderer) {
                Game.renderer.toneMappingExposure = 1.1;
            }
            if (Game.scene && Game.scene.fog) {
                Game.scene.fog.color.setHex(0x1a1a2e);
            }
        }
    },

    update(dt) {
        if (!this.isAlive) return;

        // Decair o acúmulo de movimento do mouse (para o sway da arma)
        this.mouseMoveX = THREE.MathUtils.lerp(this.mouseMoveX || 0, 0, dt * 10);
        this.mouseMoveY = THREE.MathUtils.lerp(this.mouseMoveY || 0, 0, dt * 10);

        // Decrescer cooldowns
        this.dashCooldown = Math.max(0, this.dashCooldown - dt);
        this.slideCooldown = Math.max(0, this.slideCooldown - dt);
        this.wallRunCooldown = Math.max(0, this.wallRunCooldown - dt);

        this.targetCameraRoll = 0;

        // Direção de movimento padrão
        const direction = new THREE.Vector3();
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();

        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        if (this.moveForward) direction.add(forward);
        if (this.moveBackward) direction.sub(forward);
        if (this.moveLeft) direction.sub(right);
        if (this.moveRight) direction.add(right);
        direction.normalize();

        // Cancelar corrida automaticamente se parar de mover, se mover para trás, se mirar ou se agachar
        if (this.isSprinting) {
            if (direction.lengthSq() === 0 || this.moveBackward || (typeof WeaponSystem !== 'undefined' && WeaponSystem.isADS) || this.isCrouching) {
                this.isSprinting = false;
            }
        }

        // Inclinação lateral da câmera baseada em movimento lateral
        if (this.isCrouching && this.moveLeft) this.targetCameraRoll = 0.04;
        else if (this.isCrouching && this.moveRight) this.targetCameraRoll = -0.04;

        let speed = this.walkSpeed;
        const moveVec = new THREE.Vector3();

        // Verificar Escada (Ladder Climbing)
        this.isOnLadder = false;
        const playerBoundingBox = new THREE.Box3(
            new THREE.Vector3(this.position.x - 0.45, this.position.y - this.currentHeight, this.position.z - 0.45),
            new THREE.Vector3(this.position.x + 0.45, this.position.y + 0.15, this.position.z + 0.45)
        );

        if (typeof GameMap !== 'undefined' && GameMap.ladders) {
            for (const ladder of GameMap.ladders) {
                if (ladder.box.intersectsBox(playerBoundingBox)) {
                    this.isOnLadder = true;
                    break;
                }
            }
        }

        // Verificar Wall Run
        if (!this.onGround && !this.isSliding && !this.isDashing && this.moveForward && this.wallRunCooldown <= 0) {
            // Fazer raycasting para a esquerda e direita
            const origin = this.position.clone();
            origin.y = 1.0; // Altura do torso

            const leftRay = right.clone().negate();
            const collisionMeshes = GameMap.collisionBoxes.filter(b => b.mesh).map(b => b.mesh);

            const raycasterL = new THREE.Raycaster(origin, leftRay, 0.1, 1.2);
            const raycasterR = new THREE.Raycaster(origin, right, 0.1, 1.2);

            const intersectsL = raycasterL.intersectObjects(collisionMeshes);
            const intersectsR = raycasterR.intersectObjects(collisionMeshes);

            let isWallNear = false;
            let normal = null;
            let side = '';

            if (intersectsL.length > 0) {
                isWallNear = true;
                normal = intersectsL[0].face.normal;
                side = 'left';
            } else if (intersectsR.length > 0) {
                isWallNear = true;
                normal = intersectsR[0].face.normal;
                side = 'right';
            }

            if (isWallNear && normal) {
                if (!this.isWallRunning) {
                    this.isWallRunning = true;
                    this.wallRunSide = side;
                    this.wallNormal.copy(normal);
                    this.wallRunTimer = this.wallRunDuration;
                    this.doubleJumpAvailable = true;
                    this.velocity.y = 0;
                }
            } else {
                this.isWallRunning = false;
            }
        } else {
            this.isWallRunning = false;
        }

        // Executar movimento baseado nos estados (Escada, Dash, Slide, Wall Run, Padrão)
        if (this.isOnLadder) {
            this.isWallRunning = false;
            this.isSliding = false;
            this.isDashing = false;

            // Anular gravidade e aplicar velocidade vertical
            this.velocity.y = 0;
            const climbSpeed = 3.5;
            if (this.moveForward) {
                this.velocity.y = climbSpeed;
            } else if (this.moveBackward) {
                this.velocity.y = -climbSpeed;
            }

            // Permitir movimento lateral sutil para se soltar
            let sideSpeed = 1.5;
            if (this.moveLeft) {
                moveVec.addScaledVector(right.clone().negate(), sideSpeed * dt);
            }
            if (this.moveRight) {
                moveVec.addScaledVector(right, sideSpeed * dt);
            }

            // Som de passos rítmico ao subir escada
            if (this.moveForward || this.moveBackward) {
                this.footstepTimer -= dt;
                if (this.footstepTimer <= 0) {
                    AudioManager.playFootstep();
                    this.footstepTimer = 0.35;
                }
            }

            moveVec.y = this.velocity.y * dt;
        }
        else if (this.isDashing) {
            this.dashTimer -= dt;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
            
            // Velocidade constante do dash
            moveVec.copy(this.dashDirection).multiplyScalar(this.dashSpeed * dt);
            this.velocity.y = 0;
            
            // FOV Dinâmico para o Dash
            const targetFOV = 90;
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, dt * 15);
            this.camera.updateProjectionMatrix();
        } 
        else if (this.isSliding) {
            this.slideTimer -= dt;
            if (this.slideTimer <= 0) {
                this.isSliding = false;
                this.slideCooldown = 0.5;
            }
            
            // Velocidade decrescente do slide
            const ratio = this.slideTimer / this.slideDuration;
            const currentSlideSpeed = this.crouchSpeed + (this.slideSpeed - this.crouchSpeed) * ratio;
            moveVec.copy(this.slideDirection).multiplyScalar(currentSlideSpeed * dt);
            
            // Altura abaixada e inclinação da câmera no slide
            this.targetCameraRoll = this.slideDirection.dot(right) > 0.1 ? -0.08 : (this.slideDirection.dot(right) < -0.1 ? 0.08 : -0.04);
            
            // Partículas de poeira sob o jogador
            if (Math.random() < 0.3) {
                const particlePos = this.position.clone();
                particlePos.y = 0.05;
                EffectsManager.impact(particlePos, new THREE.Vector3(0, 1, 0));
            }
        } 
        else if (this.isWallRunning) {
            this.wallRunTimer -= dt;
            if (this.wallRunTimer <= 0) {
                this.isWallRunning = false;
                this.wallRunCooldown = 1.0;
            }
            
            // Queda fixa suave no Wall Run
            this.velocity.y = -1.0;
            
            // Direção paralela à parede
            const upVec = new THREE.Vector3(0, 1, 0);
            const wallTangent = new THREE.Vector3().crossVectors(this.wallNormal, upVec).normalize();
            
            if (wallTangent.dot(forward) < 0) {
                wallTangent.negate();
            }
            
            moveVec.copy(wallTangent).multiplyScalar(this.sprintSpeed * dt);
            
            // Roll da câmera
            this.targetCameraRoll = this.wallRunSide === 'left' ? -0.18 : 0.18;
            
            // Som procedural de passos na parede
            if (Math.random() < 0.15) {
                AudioManager.playWallRun();
            }
        } 
        else {
            // Movimentação normal
            if (this.isSprinting && !this.isCrouching && direction.lengthSq() > 0) {
                speed = this.sprintSpeed;
                WeaponSystem.isADS = false;
            }
            if (this.isCrouching) speed = this.crouchSpeed;
            if (WeaponSystem.isADS) speed *= 0.7;

            moveVec.copy(direction).multiplyScalar(speed * dt);
            
            // FOV Dinâmico baseado na velocidade
            let targetFOV = WeaponSystem.defaultFOV;
            if (WeaponSystem.isADS) {
                targetFOV = WeaponSystem.adsFOV;
            } else if (this.isSprinting && direction.lengthSq() > 0) {
                targetFOV = WeaponSystem.defaultFOV + 8;
            }
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, dt * 8);
            this.camera.updateProjectionMatrix();
        }

        // Aplicar movimento com colisão deslizante (sliding collision) e Step Climbing
        const newPos = this.position.clone().add(moveVec);
        const collision = GameMap.checkCollision(newPos);

        if (!collision.collided) {
            // Sem colisão, move livremente
            this.position.x = newPos.x;
            this.position.z = newPos.z;
        } else {
            // Colidiu! Verificar se é um degrau baixo (Step Climbing)
            const footHeight = this.position.y - this.currentHeight;
            if (collision.box && collision.box.max.y <= (footHeight + 1.25) && (this.onGround || this.isWallRunning)) {
                this.position.x = newPos.x;
                this.position.z = newPos.z;
                this.position.y = collision.box.max.y + 0.01;
                this.velocity.y = 0;
                this.onGround = true;
            } else {
                // Parede alta: empurrar para fora para deslizar suavemente
                const slidPos = newPos.clone();
                slidPos.x += collision.pushX;
                slidPos.z += collision.pushZ;

                const secondCollision = GameMap.checkCollision(slidPos);
                if (!secondCollision.collided) {
                    this.position.x = slidPos.x;
                    this.position.z = slidPos.z;
                } else {
                    // Tenta mover apenas no eixo livre (X ou Z) para evitar travamento total
                    const testPosX = this.position.clone();
                    testPosX.x = newPos.x;
                    if (!GameMap.checkCollision(testPosX).collided) {
                        this.position.x = newPos.x;
                    } else {
                        const testPosZ = this.position.clone();
                        testPosZ.z = newPos.z;
                        if (!GameMap.checkCollision(testPosZ).collided) {
                            this.position.z = newPos.z;
                        }
                    }
                }
            }
        }

        // Limites do mapa (Removidos para exploração infinita estilo Minecraft)
        // const bound = 38;
        // this.position.x = Math.max(-bound, Math.min(bound, this.position.x));
        // this.position.z = Math.max(-bound, Math.min(bound, this.position.z));

        // Gravidade e Pulo
        if (!this.isDashing && !this.isWallRunning && !this.isOnLadder) {
            this.velocity.y -= this.gravity * dt;
            this.position.y += this.velocity.y * dt;
        } else if (this.isWallRunning || this.isOnLadder) {
            this.position.y += this.velocity.y * dt;
        }

        // Ajustar altura do jogador (Crouching, Sliding e Standing)
        let targetHeight = this.standHeight;
        if (this.isCrouching) targetHeight = this.crouchHeight;
        if (this.isSliding) targetHeight = 0.8;

        this.currentHeight = THREE.MathUtils.lerp(this.currentHeight, targetHeight, dt * 12);

        // Detecção de colisão com o chão (incluindo topo de prédios/caixas)
        let groundY = 0; // Chão base do mapa

        // Verificar se o jogador está em cima de alguma collision box
        const footX = this.position.x;
        const footZ = this.position.z;
        const footY = this.position.y - this.currentHeight;
        const playerRadius = 0.3;

        for (const box of GameMap.collisionBoxes) {
            // Verificar se o jogador está dentro dos limites XZ da caixa (com margem)
            if (footX + playerRadius > box.min.x && footX - playerRadius < box.max.x &&
                footZ + playerRadius > box.min.z && footZ - playerRadius < box.max.z) {
                
                // Verificar se os pés estão perto do topo da caixa (descendo sobre ela)
                const boxTop = box.max.y;
                
                // Se os pés estão acima do topo (ou ligeiramente abaixo) E descendo
                if (footY >= boxTop - 0.3 && footY <= boxTop + 0.5 && this.velocity.y <= 0) {
                    if (boxTop > groundY) {
                        groundY = boxTop;
                    }
                }
            }
        }

        const groundLevel = groundY + this.currentHeight;
        if (this.position.y <= groundLevel) {
            this.position.y = groundLevel;
            this.velocity.y = 0;
            this.onGround = true;
            this.isJumping = false;
            this.doubleJumpAvailable = true;
        }

        // Atualizar câmera
        this.camera.position.copy(this.position);

        // Aplicar Roll (inclinação lateral) na rotação da câmera
        this.cameraRoll = THREE.MathUtils.lerp(this.cameraRoll, this.targetCameraRoll, dt * 10);
        this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');

        // Aplicar recuo físico ativo (camera kick)
        const recoil = WeaponSystem.getRecoilOffset();
        if (recoil.y > 0.001 || Math.abs(recoil.x) > 0.001) {
            this.euler.x += recoil.y * dt * 2.5;
            this.euler.y -= recoil.x * dt * 1.8;
            this.euler.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.euler.x));
        }

        this.euler.z = this.cameraRoll;
        this.camera.quaternion.setFromEuler(this.euler);

        // Head bobbing normal
        const isMoving = direction.lengthSq() > 0 && this.onGround && !this.isSliding;
        if (isMoving && !WeaponSystem.isADS) {
            const bobSpeed = this.isSprinting ? 12 : 8;
            const bobAmount = this.isSprinting ? 0.04 : 0.025;
            const bobX = Math.sin(performance.now() * 0.001 * bobSpeed) * bobAmount * 0.5;
            const bobY = Math.abs(Math.sin(performance.now() * 0.001 * bobSpeed)) * bobAmount;
            this.camera.position.x += bobX;
            this.camera.position.y += bobY;
        }

        // Sons de passos
        if (isMoving) {
            this.footstepTimer -= dt;
            const interval = this.isSprinting ? this.footstepInterval * 0.6 : this.footstepInterval;
            if (this.footstepTimer <= 0) {
                AudioManager.playFootstep();
                this.footstepTimer = interval;
            }
        }

        // Regeneração de vida
        const now = performance.now() / 1000;
        if (this.health < this.maxHealth && now - this.lastDamageTime > this.regenDelay) {
            this.health = Math.min(this.maxHealth, this.health + this.regenRate * dt);
        }

        // Fogo automático contínuo
        if (WeaponSystem.isFiring && WeaponSystem.weapons[WeaponSystem.currentIndex].auto) {
            const hitInfo = WeaponSystem.tryFire();
            if (hitInfo) {
                if (Array.isArray(hitInfo)) {
                    hitInfo.forEach(h => this._processHit(h));
                } else {
                    this._processHit(hitInfo);
                }
            }
        }

        // Chest proximity
        if (typeof GameMap !== 'undefined' && GameMap.chests && typeof HUD !== 'undefined' && HUD.showTooltip) {
            let nearChest = false;
            for (const chest of GameMap.chests) {
                if (!chest.opened) {
                    const dist = this.position.distanceTo(new THREE.Vector3(chest.x, this.position.y, chest.z));
                    if (dist < 3.0) { nearChest = true; break; }
                }
            }
            HUD.showTooltip(nearChest ? 'PRESSIONE E PARA ABRIR O BAÚ (+$200)' : '');
        }
    },

    takeDamage(amount, direction) {
        if (!this.isAlive) return;

        this.health -= amount;
        this.lastDamageTime = performance.now() / 1000;

        AudioManager.playDamage();
        EffectsManager.screenShake(1.5);
        HUD.showDamage(direction);

        if (this.health <= 0) {
            this.health = 0;
            this.isAlive = false;
            Game.gameOver();
        }
    },

    getPosition() {
        return this.position.clone();
    },

    reset() {
        const spawn = GameMap.getPlayerSpawn();
        this.position.copy(spawn);
        this.velocity.set(0, 0, 0);
        this.health = this.maxHealth;
        this.isAlive = true;
        this.isSprinting = false;
        this.isCrouching = false;
        this.currentHeight = this.standHeight;
        this.camera.position.copy(this.position);
        this.camera.rotation.set(0, 0, 0);
        this.euler.set(0, 0, 0);
        this.camera.quaternion.setFromEuler(this.euler);
    }
};
