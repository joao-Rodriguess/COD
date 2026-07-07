// ============================
// EFFECTS MANAGER - Particles, Tracers, Screen Effects
// ============================

const EffectsManager = {
    scene: null,
    camera: null,
    particles: [],
    tracers: [],
    screenShakeIntensity: 0,
    screenShakeDecay: 0.9,
    originalCameraPos: null,

    init(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.originalCameraPos = new THREE.Vector3();
    },

    update(dt) {
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                if (p.mesh.geometry) p.mesh.geometry.dispose();
                if (p.mesh.material) p.mesh.material.dispose();
                this.particles.splice(i, 1);
                continue;
            }
            p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
            p.velocity.y -= p.gravity * dt;
            const alpha = p.life / p.maxLife;
            p.mesh.material.opacity = alpha;
            p.mesh.scale.setScalar(p.scale * alpha);
        }

        // Update tracers
        for (let i = this.tracers.length - 1; i >= 0; i--) {
            const t = this.tracers[i];
            t.life -= dt;
            if (t.life <= 0) {
                this.scene.remove(t.line);
                if (t.line.geometry) t.line.geometry.dispose();
                if (t.line.material) t.line.material.dispose();
                this.tracers.splice(i, 1);
                continue;
            }
            t.line.material.opacity = t.life / t.maxLife;
        }

        // Screen shake
        if (this.screenShakeIntensity > 0.001) {
            this.screenShakeIntensity *= this.screenShakeDecay;
            const shakeX = (Math.random() - 0.5) * this.screenShakeIntensity;
            const shakeY = (Math.random() - 0.5) * this.screenShakeIntensity;
            this.camera.rotation.x += shakeX * 0.01;
            this.camera.rotation.y += shakeY * 0.01;
        } else {
            this.screenShakeIntensity = 0;
        }
    },

    muzzleFlash(position, direction) {
        // Create bright flash
        const flashGeo = new THREE.SphereGeometry(0.08, 6, 6);
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 1
        });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(position);
        this.scene.add(flash);

        this.particles.push({
            mesh: flash,
            velocity: direction.clone().multiplyScalar(2),
            life: 0.05,
            maxLife: 0.05,
            gravity: 0,
            scale: 1
        });

        // Sparks
        for (let i = 0; i < 4; i++) {
            const sparkGeo = new THREE.SphereGeometry(0.02, 4, 4);
            const sparkMat = new THREE.MeshBasicMaterial({
                color: 0xffcc00,
                transparent: true,
                opacity: 1
            });
            const spark = new THREE.Mesh(sparkGeo, sparkMat);
            spark.position.copy(position);
            this.scene.add(spark);

            const vel = direction.clone().multiplyScalar(5 + Math.random() * 5);
            vel.x += (Math.random() - 0.5) * 4;
            vel.y += (Math.random() - 0.5) * 4;
            vel.z += (Math.random() - 0.5) * 4;

            this.particles.push({
                mesh: spark,
                velocity: vel,
                life: 0.1 + Math.random() * 0.1,
                maxLife: 0.15,
                gravity: 10,
                scale: 1
            });
        }

        // Point light flash
        const light = new THREE.PointLight(0xffaa00, 3, 8);
        light.position.copy(position);
        this.scene.add(light);
        setTimeout(() => this.scene.remove(light), 50);
    },

    bulletTracer(start, end) {
        const points = [start.clone(), end.clone()];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
            color: 0xffee88,
            transparent: true,
            opacity: 0.6,
            linewidth: 1
        });
        const line = new THREE.Line(geo, mat);
        this.scene.add(line);

        this.tracers.push({
            line: line,
            life: 0.1,
            maxLife: 0.1
        });
    },

    impact(position, normal) {
        // Debris particles
        for (let i = 0; i < 6; i++) {
            const debrisGeo = new THREE.BoxGeometry(0.03, 0.03, 0.03);
            const debrisMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0.08, 0.2, 0.3 + Math.random() * 0.2),
                transparent: true,
                opacity: 1
            });
            const debris = new THREE.Mesh(debrisGeo, debrisMat);
            debris.position.copy(position);
            this.scene.add(debris);

            const vel = normal ? normal.clone().multiplyScalar(2) : new THREE.Vector3(0, 1, 0);
            vel.x += (Math.random() - 0.5) * 3;
            vel.y += Math.random() * 3;
            vel.z += (Math.random() - 0.5) * 3;

            this.particles.push({
                mesh: debris,
                velocity: vel,
                life: 0.3 + Math.random() * 0.3,
                maxLife: 0.5,
                gravity: 15,
                scale: 1
            });
        }

        // Impact mark (small dark circle on surface)
        if (normal) {
            const markGeo = new THREE.CircleGeometry(0.06, 8);
            const markMat = new THREE.MeshBasicMaterial({
                color: 0x111111,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide
            });
            const mark = new THREE.Mesh(markGeo, markMat);
            mark.position.copy(position).add(normal.clone().multiplyScalar(0.01));
            mark.lookAt(position.clone().add(normal));
            this.scene.add(mark);

            this.particles.push({
                mesh: mark,
                velocity: new THREE.Vector3(),
                life: 5,
                maxLife: 5,
                gravity: 0,
                scale: 1
            });
        }
    },

    bloodSplat(position) {
        for (let i = 0; i < 8; i++) {
            const bloodGeo = new THREE.SphereGeometry(0.03 + Math.random() * 0.04, 4, 4);
            const bloodMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0, 0.8, 0.2 + Math.random() * 0.15),
                transparent: true,
                opacity: 1
            });
            const blood = new THREE.Mesh(bloodGeo, bloodMat);
            blood.position.copy(position);
            this.scene.add(blood);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                Math.random() * 3,
                (Math.random() - 0.5) * 5
            );

            this.particles.push({
                mesh: blood,
                velocity: vel,
                life: 0.4 + Math.random() * 0.3,
                maxLife: 0.6,
                gravity: 12,
                scale: 1
            });
        }
    },

    screenShake(intensity = 1) {
        this.screenShakeIntensity = Math.max(this.screenShakeIntensity, intensity);
    },

    grenadeExplosion(position) {
        // Shockwave sphere (expands and fades)
        const shockGeo = new THREE.SphereGeometry(0.5, 16, 16);
        const shockMat = new THREE.MeshBasicMaterial({
            color: 0xff8800,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        const shockwave = new THREE.Mesh(shockGeo, shockMat);
        shockwave.position.copy(position);
        this.scene.add(shockwave);

        let shockScale = 0.5;
        const shockInterval = setInterval(() => {
            shockScale += 0.8;
            shockwave.scale.setScalar(shockScale);
            shockMat.opacity -= 0.04;
            if (shockMat.opacity <= 0) {
                clearInterval(shockInterval);
                this.scene.remove(shockwave);
                shockGeo.dispose();
                shockMat.dispose();
            }
        }, 16);

        // Bright flash
        const flashGeo = new THREE.SphereGeometry(1.5, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xffee88,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending
        });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(position);
        this.scene.add(flash);

        this.particles.push({
            mesh: flash,
            velocity: new THREE.Vector3(),
            life: 0.15,
            maxLife: 0.15,
            gravity: 0,
            scale: 2
        });

        // Explosion light
        const expLight = new THREE.PointLight(0xff6600, 15, 20);
        expLight.position.copy(position);
        this.scene.add(expLight);

        let lightDecay = 15;
        const lightInterval = setInterval(() => {
            lightDecay -= 1;
            expLight.intensity = Math.max(0, lightDecay);
            if (lightDecay <= 0) {
                clearInterval(lightInterval);
                this.scene.remove(expLight);
            }
        }, 16);

        // Fire particles
        for (let i = 0; i < 25; i++) {
            const fireGeo = new THREE.SphereGeometry(0.08 + Math.random() * 0.12, 6, 6);
            const hue = 0.05 + Math.random() * 0.08;
            const fireMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(hue, 1.0, 0.5 + Math.random() * 0.3),
                transparent: true,
                opacity: 1,
                blending: THREE.AdditiveBlending
            });
            const fire = new THREE.Mesh(fireGeo, fireMat);
            fire.position.copy(position);
            this.scene.add(fire);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 12,
                Math.random() * 10 + 3,
                (Math.random() - 0.5) * 12
            );

            this.particles.push({
                mesh: fire,
                velocity: vel,
                life: 0.3 + Math.random() * 0.5,
                maxLife: 0.6,
                gravity: 8,
                scale: 1.5
            });
        }

        // Debris particles
        for (let i = 0; i < 18; i++) {
            const debrisGeo = new THREE.BoxGeometry(0.05 + Math.random() * 0.08, 0.05, 0.05);
            const debrisMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0.08, 0.3, 0.15 + Math.random() * 0.2),
                transparent: true,
                opacity: 1
            });
            const debris = new THREE.Mesh(debrisGeo, debrisMat);
            debris.position.copy(position);
            this.scene.add(debris);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 15,
                Math.random() * 12 + 2,
                (Math.random() - 0.5) * 15
            );

            this.particles.push({
                mesh: debris,
                velocity: vel,
                life: 0.6 + Math.random() * 0.8,
                maxLife: 1.2,
                gravity: 15,
                scale: 1
            });
        }

        // Smoke puffs (slower, longer lasting)
        for (let i = 0; i < 8; i++) {
            const smokeGeo = new THREE.SphereGeometry(0.3 + Math.random() * 0.4, 6, 6);
            const smokeMat = new THREE.MeshBasicMaterial({
                color: 0x444444,
                transparent: true,
                opacity: 0.5
            });
            const smoke = new THREE.Mesh(smokeGeo, smokeMat);
            smoke.position.copy(position);
            smoke.position.y += Math.random() * 0.5;
            this.scene.add(smoke);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                1 + Math.random() * 2,
                (Math.random() - 0.5) * 3
            );

            this.particles.push({
                mesh: smoke,
                velocity: vel,
                life: 1.5 + Math.random() * 1.5,
                maxLife: 2.5,
                gravity: -0.5, // Rises
                scale: 2
            });
        }
    },

    barrelExplosion(position) {
        // Similar to grenade but with more fire
        this.grenadeExplosion(position);

        // Extra fire glow that persists
        for (let i = 0; i < 10; i++) {
            const fireGeo = new THREE.SphereGeometry(0.15, 6, 6);
            const fireMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0.06, 1.0, 0.6),
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending
            });
            const fire = new THREE.Mesh(fireGeo, fireMat);
            fire.position.copy(position);
            fire.position.y += Math.random() * 1.5;
            this.scene.add(fire);

            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                1.5 + Math.random() * 3,
                (Math.random() - 0.5) * 2
            );

            this.particles.push({
                mesh: fire,
                velocity: vel,
                life: 1.0 + Math.random() * 1.5,
                maxLife: 2.0,
                gravity: -1,
                scale: 2
            });
        }
    },

    cleanup() {
        for (const p of this.particles) {
            this.scene.remove(p.mesh);
            if (p.mesh.geometry) p.mesh.geometry.dispose();
            if (p.mesh.material) p.mesh.material.dispose();
        }
        for (const t of this.tracers) {
            this.scene.remove(t.line);
            if (t.line.geometry) t.line.geometry.dispose();
            if (t.line.material) t.line.material.dispose();
        }
        this.particles = [];
        this.tracers = [];
    }
};
