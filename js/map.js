// ============================
// GAME MAP - 3D Urban Environment
// ============================

const GameMap = {
    scene: null,
    collisionBoxes: [],
    enemySpawnPoints: [],
    playerSpawn: new THREE.Vector3(0, 1.7, 0),
    mapSize: 300,

    init(scene) {
        this.scene = scene;
        this.collisionBoxes = [];
        this.enemySpawnPoints = [];
        this.ladders = [];
        this.materials = {
            ground: new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.95, metalness: 0.05 }),
            sky: new THREE.MeshBasicMaterial({ color: 0x1a1a2e, side: THREE.BackSide }),
            bldg1: this._mat(0x4a4a55),
            bldg2: this._mat(0x555560),
            bldg3: this._mat(0x3d3d48)
        };
        this._createGround();
        this._createSkybox();
        this._createBuildings();
        this._createWalls();
        this._createCover();
        this._createLighting();
        this._createDetails();
        this._defineSpawnPoints();
        this._createLadders();
        this._createChests();
    },

    applyTheme(theme) {
        let groundColor, skyColor, fogColor, bldg1, bldg2, bldg3, fogDensity;
        if (theme === 'desert') {
            groundColor = 0xc2b280; skyColor = 0xffcc99; fogColor = 0xffcc99;
            bldg1 = 0xd2c290; bldg2 = 0xb2a270; bldg3 = 0xc2b280;
            fogDensity = 0.015; // Dust storm
        } else if (theme === 'snow') {
            groundColor = 0xddddff; skyColor = 0x99aadd; fogColor = 0xaabbdd;
            bldg1 = 0x8899aa; bldg2 = 0x778899; bldg3 = 0x99aabb;
            fogDensity = 0.02; // Blizzard
        } else { // urban
            groundColor = 0x3a3a3a; skyColor = 0x1a1a2e; fogColor = 0x1a1a2e;
            bldg1 = 0x4a4a55; bldg2 = 0x555560; bldg3 = 0x3d3d48;
            fogDensity = 0.01; // Dense urban fog
        }
        
        if (this.scene.fog) {
            this.scene.fog.color.setHex(fogColor);
            this.scene.fog.density = fogDensity;
        }
        this.materials.ground.color.setHex(groundColor);
        this.materials.sky.color.setHex(skyColor);
        this.materials.bldg1.color.setHex(bldg1);
        this.materials.bldg2.color.setHex(bldg2);
        this.materials.bldg3.color.setHex(bldg3);
    },

    _mat(color, roughness = 0.8) {
        return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.1 });
    },

    _addBox(w, h, d, x, y, z, material, addCollision = true) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        if (addCollision) {
            this.collisionBoxes.push({
                min: new THREE.Vector3(x - w/2, y - h/2, z - d/2),
                max: new THREE.Vector3(x + w/2, y + h/2, z + d/2),
                mesh: mesh
            });
        }
        return mesh;
    },

    _createGround() {
        // Main ground
        const groundGeo = new THREE.PlaneGeometry(this.mapSize, this.mapSize, 20, 20);
        const ground = new THREE.Mesh(groundGeo, this.materials.ground);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Road markings
        const roadGeo = new THREE.PlaneGeometry(6, this.mapSize);
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 });
        const road1 = new THREE.Mesh(roadGeo, roadMat);
        road1.rotation.x = -Math.PI / 2;
        road1.position.y = 0.01;
        this.scene.add(road1);

        const road2 = road1.clone();
        road2.rotation.z = Math.PI / 2;
        road2.position.y = 0.01;
        this.scene.add(road2);

        // Road center lines
        for (let i = -this.mapSize/2; i < this.mapSize/2; i += 4) {
            const lineGeo = new THREE.PlaneGeometry(0.15, 2);
            const lineMat = new THREE.MeshBasicMaterial({ color: 0x888833 });
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(0, 0.02, i);
            this.scene.add(line);
        }
    },

    _createSkybox() {
        const skyGeo = new THREE.SphereGeometry(200, 32, 32);
        const sky = new THREE.Mesh(skyGeo, this.materials.sky);
        this.scene.add(sky);

        // Fog
        this.scene.fog = new THREE.FogExp2(0x1a1a2e, 0.012);
    },

    _createBuildings() {
        const roofMat = this._mat(0x2a2a35);

        const buildings = [];
        
        for (let i = 0; i < 150; i++) {
            const w = 5 + Math.random() * 15;
            const h = 4 + Math.random() * 15;
            const d = 5 + Math.random() * 15;
            
            const x = (Math.random() - 0.5) * (this.mapSize - 20);
            const z = (Math.random() - 0.5) * (this.mapSize - 20);
            
            // Keep center area clear for plaza/spawn
            if (Math.abs(x) < 40 && Math.abs(z) < 40) continue;
            
            buildings.push({ w, h, d, x, z });
        }

        buildings.forEach((b, i) => {
            const mat = [this.materials.bldg1, this.materials.bldg2, this.materials.bldg3][i % 3];
            this._addBox(b.w, b.h, b.d, b.x, b.h / 2, b.z, mat);

            // Roof overhang
            this._addBox(b.w + 0.5, 0.3, b.d + 0.5, b.x, b.h, b.z, roofMat, false);

            // Windows
            const winMat = new THREE.MeshBasicMaterial({ color: 0x334455 });
            const winSize = 0.8;
            const winGap = 2.5;
            for (let wy = 2; wy < b.h - 1; wy += winGap) {
                // Front face
                for (let wx = -b.w/2 + 1.5; wx < b.w/2 - 1; wx += winGap) {
                    const win = new THREE.Mesh(
                        new THREE.PlaneGeometry(winSize, winSize * 1.4),
                        winMat
                    );
                    win.position.set(b.x + wx, wy, b.z + b.d/2 + 0.01);
                    this.scene.add(win);
                }
                // Back face
                for (let wx = -b.w/2 + 1.5; wx < b.w/2 - 1; wx += winGap) {
                    const win = new THREE.Mesh(
                        new THREE.PlaneGeometry(winSize, winSize * 1.4),
                        winMat
                    );
                    win.position.set(b.x + wx, wy, b.z - b.d/2 - 0.01);
                    win.rotation.y = Math.PI;
                    this.scene.add(win);
                }
            }
        });
    },

    _createWalls() {
        const wallMat = this._mat(0x505058);
        const concMat = this._mat(0x484850);

        // Boundary walls
        const halfSize = this.mapSize / 2;
        this._addBox(this.mapSize, 5, 0.5, 0, 2.5, -halfSize, wallMat);
        this._addBox(this.mapSize, 5, 0.5, 0, 2.5, halfSize, wallMat);
        this._addBox(0.5, 5, this.mapSize, -halfSize, 2.5, 0, wallMat);
        this._addBox(0.5, 5, this.mapSize, halfSize, 2.5, 0, wallMat);

        // Interior walls/barriers
        const walls = [
            { w: 8, h: 3, d: 0.3, x: -5, z: -10 },
            { w: 0.3, h: 3, d: 6, x: 8, z: -8 },
            { w: 6, h: 2.5, d: 0.3, x: 0, z: 8 },
            { w: 0.3, h: 2.5, d: 8, x: -12, z: 10 },
            { w: 10, h: 3, d: 0.3, x: 15, z: -12 },
            { w: 0.3, h: 2, d: 5, x: -18, z: -8 },
        ];

        walls.forEach(w => {
            this._addBox(w.w, w.h, w.d, w.x, w.h/2, w.z, concMat);
        });
    },

    _createCover() {
        const crateMat = this._mat(0x6b5b3a);
        const metalMat = this._mat(0x5a5a60);
        const barrierMat = this._mat(0x666666);

        // Crate clusters
        const cratePositions = [
            { x: 5, z: 5 }, { x: 6.2, z: 5 }, { x: 5.6, z: 5, y: 1.2 },
            { x: -10, z: -5 }, { x: -11.2, z: -5 },
            { x: 15, z: 10 },
            { x: -3, z: -15 }, { x: -1.8, z: -15 },
            { x: 20, z: -15 },
            { x: -25, z: 15 },
        ];

        cratePositions.forEach(p => {
            this._addBox(1.2, 1.2, 1.2, p.x, (p.y || 0) + 0.6, p.z, crateMat);
        });

        // Jersey barriers
        const barriers = [
            { x: -5, z: 3, rot: 0 },
            { x: -7, z: 3, rot: 0 },
            { x: 12, z: 0, rot: Math.PI/2 },
            { x: 12, z: 2, rot: Math.PI/2 },
            { x: -3, z: -22, rot: 0.3 },
            { x: 20, z: 8, rot: -0.5 },
        ];

        barriers.forEach(b => {
            const geo = new THREE.BoxGeometry(2, 1, 0.6);
            const mesh = new THREE.Mesh(geo, barrierMat);
            mesh.position.set(b.x, 0.5, b.z);
            mesh.rotation.y = b.rot;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);

            // Simplified AABB collision
            const halfW = 1, halfD = 0.3;
            this.collisionBoxes.push({
                min: new THREE.Vector3(b.x - halfW, 0, b.z - halfD),
                max: new THREE.Vector3(b.x + halfW, 1, b.z + halfD)
            });
        });

        // Metal barrels
        const barrelPositions = [
            { x: 8, z: -3 }, { x: -14, z: 7 }, { x: 22, z: 18 },
            { x: -27, z: -10 }, { x: 3, z: 20 },
        ];

        barrelPositions.forEach(p => {
            const barrelGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8);
            const barrel = new THREE.Mesh(barrelGeo, metalMat);
            barrel.position.set(p.x, 0.6, p.z);
            barrel.castShadow = true;
            this.scene.add(barrel);

            this.collisionBoxes.push({
                min: new THREE.Vector3(p.x - 0.4, 0, p.z - 0.4),
                max: new THREE.Vector3(p.x + 0.4, 1.2, p.z + 0.4)
            });
        });
    },

    _createLighting() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0x404060, 0.6);
        this.scene.add(ambient);

        // Directional sun
        const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
        sun.position.set(30, 50, 20);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 150;
        sun.shadow.camera.left = -50;
        sun.shadow.camera.right = 50;
        sun.shadow.camera.top = 50;
        sun.shadow.camera.bottom = -50;
        sun.shadow.bias = -0.001;
        this.scene.add(sun);

        // Hemisphere light for sky color
        const hemi = new THREE.HemisphereLight(0x6688cc, 0x443322, 0.4);
        this.scene.add(hemi);

        // Some point lights near buildings
        const lightPositions = [
            { x: -25, z: -20, color: 0xffaa66 },
            { x: 28, z: -18, color: 0xff8844 },
            { x: 25, z: 25, color: 0xffaa66 },
            { x: -15, z: 3, color: 0xff9955 },
        ];

        lightPositions.forEach(l => {
            const pl = new THREE.PointLight(l.color, 0.5, 15);
            pl.position.set(l.x, 4, l.z);
            this.scene.add(pl);
        });
    },

    _createDetails() {
        // Street lamps
        const lampMat = this._mat(0x333333);
        const lampPositions = [
            { x: 4, z: -8 }, { x: -4, z: 8 },
            { x: 4, z: 12 }, { x: -4, z: -18 },
            { x: 20, z: 4 }, { x: -20, z: -4 },
        ];

        lampPositions.forEach(p => {
            // Pole
            const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 5, 6);
            const pole = new THREE.Mesh(poleGeo, lampMat);
            pole.position.set(p.x, 2.5, p.z);
            pole.castShadow = true;
            this.scene.add(pole);

            // Light fixture
            const fixGeo = new THREE.CylinderGeometry(0.3, 0.15, 0.2, 6);
            const fix = new THREE.Mesh(fixGeo, lampMat);
            fix.position.set(p.x, 5, p.z);
            this.scene.add(fix);

            // Light
            const light = new THREE.PointLight(0xffcc88, 0.6, 12);
            light.position.set(p.x, 4.8, p.z);
            this.scene.add(light);

            this.collisionBoxes.push({
                min: new THREE.Vector3(p.x - 0.15, 0, p.z - 0.15),
                max: new THREE.Vector3(p.x + 0.15, 5, p.z + 0.15)
            });
        });

        // Sandbag positions
        const sandMat = this._mat(0x7a6b50);
        const sandbagPositions = [
            { x: 0, z: 0 },
            { x: -10, z: 12 },
            { x: 18, z: -8 },
        ];

        sandbagPositions.forEach(p => {
            for (let row = 0; row < 2; row++) {
                for (let i = 0; i < 3; i++) {
                    const sbGeo = new THREE.BoxGeometry(1.2, 0.4, 0.5);
                    const sb = new THREE.Mesh(sbGeo, sandMat);
                    sb.position.set(p.x + i * 1.1 - 1.1, row * 0.4 + 0.2, p.z);
                    sb.castShadow = true;
                    this.scene.add(sb);
                }
            }
            this.collisionBoxes.push({
                min: new THREE.Vector3(p.x - 1.8, 0, p.z - 0.3),
                max: new THREE.Vector3(p.x + 2.2, 0.8, p.z + 0.3)
            });
        });
    },

    _defineSpawnPoints() {
        this.playerSpawn = new THREE.Vector3(0, 1.7, 0);

        this.enemySpawnPoints = [];
        for (let i = 0; i < 30; i++) {
            let x = (Math.random() - 0.5) * (this.mapSize - 20);
            let z = (Math.random() - 0.5) * (this.mapSize - 20);
            if (Math.abs(x) < 30 && Math.abs(z) < 30) {
                // Afastar do centro
                x += Math.sign(x) * 30;
                z += Math.sign(z) * 30;
            }
            this.enemySpawnPoints.push(new THREE.Vector3(x, 1.7, z));
        }
    },

    checkCollision(position, radius = 0.4) {
        for (const box of this.collisionBoxes) {
            const closestX = Math.max(box.min.x, Math.min(position.x, box.max.x));
            const closestZ = Math.max(box.min.z, Math.min(position.z, box.max.z));

            const dx = position.x - closestX;
            const dz = position.z - closestZ;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < radius && position.y < box.max.y && position.y - 1.7 < box.max.y) {
                return {
                    collided: true,
                    pushX: dx === 0 ? 0 : (radius - dist) * (dx / Math.abs(dx)),
                    pushZ: dz === 0 ? 0 : (radius - dist) * (dz / Math.abs(dz)),
                    box: box
                };
            }
        }
        return { collided: false };
    },

    _createLadders() {
        // Escada 1: Large building 1 (x: -25, z: -25, h: 8) -> encostada na face leste (x: -18.9, z: -25, rot: -PI/2)
        this._createLadderMesh(-18.9, -25, 8, -Math.PI / 2);

        // Escada 2: Large building 2 (x: 28, z: -22, h: 10) -> encostada na face oeste (x: 22.9, z: -22, rot: PI/2)
        this._createLadderMesh(22.9, -22, 10, Math.PI / 2);

        // Escada 3: Large building 3 (x: -20, z: 25, h: 7) -> encostada na face leste (x: -12.9, z: 25, rot: -Math.PI / 2)
        this._createLadderMesh(-12.9, 25, 7, -Math.PI / 2);

        // Escada 4: Medium building (x: -15, z: 0, h: 6) -> encostada na face leste (x: -10.9, z: 0, rot: -Math.PI / 2)
        this._createLadderMesh(-10.9, 0, 6, -Math.PI / 2);
    },

    _createLadderMesh(x, z, h, rotationY) {
        const group = new THREE.Group();
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.2 });
        const stepMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.6, roughness: 0.3 });

        // Trilhos verticais
        const rail1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h, 8), metalMat);
        rail1.position.set(-0.25, h / 2, 0);
        group.add(rail1);

        const rail2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h, 8), metalMat);
        rail2.position.set(0.25, h / 2, 0);
        group.add(rail2);

        // Degraus
        const stepGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8);
        for (let sy = 0.2; sy < h; sy += 0.35) {
            const step = new THREE.Mesh(stepGeo, stepMat);
            step.rotation.z = Math.PI / 2;
            step.position.set(0, sy, 0);
            group.add(step);
        }

        group.position.set(x, 0, z);
        group.rotation.y = rotationY;
        this.scene.add(group);

        // Criar Box3 de colisão/gatilho
        const ladderBox = new THREE.Box3();
        const triggerWidth = 1.0;
        const triggerDepth = 1.0;

        const isXAligned = Math.abs(Math.sin(rotationY)) > 0.5;
        const wX = isXAligned ? triggerDepth : triggerWidth;
        const wZ = isXAligned ? triggerWidth : triggerDepth;

        ladderBox.set(
            new THREE.Vector3(x - wX/2, 0, z - wZ/2),
            new THREE.Vector3(x + wX/2, h + 0.5, z + wZ/2)
        );

        this.ladders.push({
            box: ladderBox,
            x: x,
            z: z,
            h: h
        });
    },

    getCollisionBoxes() { return this.collisionBoxes; },
    getSpawnPoints() { return this.enemySpawnPoints; },
    getPlayerSpawn() { return this.playerSpawn.clone(); },

    // ============================
    // CHESTS
    // ============================
    chests: [],
    _createChests() {
        this.chests = [];
        const chestPositions = [];
        
        // Random chests across the expanded map
        for (let i = 0; i < 20; i++) {
            const x = (Math.random() - 0.5) * (this.mapSize - 10);
            const z = (Math.random() - 0.5) * (this.mapSize - 10);
            // Evitar nascer exatamente no centro
            if (Math.abs(x) < 20 && Math.abs(z) < 20) continue;
            chestPositions.push({ x, z });
        }
        
        const chestMat = new THREE.MeshStandardMaterial({ color: 0x553311, roughness: 0.9 });
        const lidMat = new THREE.MeshStandardMaterial({ color: 0x664422, roughness: 0.9 });
        
        chestPositions.forEach(p => {
            const group = new THREE.Group();
            
            const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.0), chestMat);
            base.position.y = 0.5;
            base.castShadow = true;
            group.add(base);
            
            const lid = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 1.0), lidMat);
            lid.position.y = 1.1;
            lid.castShadow = true;
            group.add(lid);
            
            group.position.set(p.x, 0, p.z);
            this.scene.add(group);
            
            this.collisionBoxes.push({
                min: new THREE.Vector3(p.x - 0.75, 0, p.z - 0.5),
                max: new THREE.Vector3(p.x + 0.75, 1.2, p.z + 0.5)
            });
            
            this.chests.push({
                x: p.x, z: p.z, group: group, opened: false
            });
        });
    },

    // ============================
    // EXPLOSIVE BARRELS
    // ============================
    explosiveBarrels: [],

    createExplosiveBarrels() {
        this.explosiveBarrels = [];

        const barrelPositions = [
            { x: -7, z: -6 },
            { x: 14, z: 3 },
            { x: -18, z: 15 },
            { x: 25, z: -12 },
            { x: 3, z: 22 },
        ];

        barrelPositions.forEach(p => {
            this._createExplosiveBarrel(p.x, p.z);
        });
    },

    _createExplosiveBarrel(x, z) {
        const group = new THREE.Group();

        // Barrel body - red danger color
        const barrelGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.3, 10);
        const barrelMat = new THREE.MeshStandardMaterial({
            color: 0xcc2222,
            roughness: 0.5,
            metalness: 0.6
        });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.y = 0.65;
        barrel.castShadow = true;
        group.add(barrel);

        // Top rim
        const rimGeo = new THREE.TorusGeometry(0.45, 0.03, 6, 10);
        const rimMat = new THREE.MeshStandardMaterial({ color: 0x881111, metalness: 0.8, roughness: 0.3 });
        const topRim = new THREE.Mesh(rimGeo, rimMat);
        topRim.position.y = 1.3;
        topRim.rotation.x = Math.PI / 2;
        group.add(topRim);

        // Bottom rim
        const bottomRim = topRim.clone();
        bottomRim.position.y = 0.05;
        group.add(bottomRim);

        // Middle band
        const bandGeo = new THREE.TorusGeometry(0.46, 0.02, 6, 10);
        const band = new THREE.Mesh(bandGeo, rimMat);
        band.position.y = 0.65;
        band.rotation.x = Math.PI / 2;
        group.add(band);

        // Hazard stripe (yellow triangle on barrel)
        const stripeGeo = new THREE.PlaneGeometry(0.35, 0.25);
        const stripeMat = new THREE.MeshBasicMaterial({
            color: 0xffcc00,
            side: THREE.DoubleSide
        });
        const stripe1 = new THREE.Mesh(stripeGeo, stripeMat);
        stripe1.position.set(0, 0.7, 0.46);
        group.add(stripe1);

        const stripe2 = stripe1.clone();
        stripe2.position.set(0, 0.7, -0.46);
        stripe2.rotation.y = Math.PI;
        group.add(stripe2);

        // Warning glow light
        const warnLight = new THREE.PointLight(0xff4400, 0.3, 4);
        warnLight.position.set(0, 1.4, 0);
        group.add(warnLight);

        group.position.set(x, 0, z);
        this.scene.add(group);

        const barrelData = {
            x: x,
            z: z,
            mesh: group,
            light: warnLight,
            exploded: false,
            respawnTimer: 0
        };

        this.explosiveBarrels.push(barrelData);

        // Add collision
        this.collisionBoxes.push({
            min: new THREE.Vector3(x - 0.45, 0, z - 0.45),
            max: new THREE.Vector3(x + 0.45, 1.3, z + 0.45),
            mesh: barrel,
            isExplosiveBarrel: true,
            barrelData: barrelData
        });
    },

    detonateBarrel(barrel) {
        if (barrel.exploded) return;
        barrel.exploded = true;

        const pos = new THREE.Vector3(barrel.x, 0.65, barrel.z);

        // Remove barrel mesh
        this.scene.remove(barrel.mesh);
        barrel.mesh.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });

        // Explosion effects
        EffectsManager.barrelExplosion(pos);
        EffectsManager.screenShake(5);
        AudioManager.playBarrelExplosion();

        // Damage enemies in radius (6m)
        const radius = 6;
        if (typeof EnemyManager !== 'undefined') {
            for (const enemy of EnemyManager.enemies) {
                if (enemy.state === 'dead') continue;
                const dist = enemy.model.position.distanceTo(pos);
                if (dist < radius) {
                    const falloff = 1 - (dist / radius);
                    const damage = 30 + 100 * falloff;
                    EnemyManager.damageEnemy(enemy, damage, pos);
                }
            }
        }

        // Damage player if close
        if (typeof PlayerController !== 'undefined' && PlayerController.isAlive) {
            const playerPos = PlayerController.getPosition();
            const dist = new THREE.Vector3(playerPos.x, 0, playerPos.z).distanceTo(new THREE.Vector3(pos.x, 0, pos.z));
            if (dist < radius) {
                const falloff = 1 - (dist / radius);
                const damage = (30 + 100 * falloff) * 0.7;
                PlayerController.takeDamage(damage, { x: pos.x - playerPos.x, z: pos.z - playerPos.z });
            }
        }

        // Chain reaction - detonate other nearby barrels
        for (const other of this.explosiveBarrels) {
            if (other === barrel || other.exploded) continue;
            const dist = Math.sqrt(
                (other.x - barrel.x) ** 2 + (other.z - barrel.z) ** 2
            );
            if (dist < radius * 0.8) {
                setTimeout(() => this.detonateBarrel(other), 200 + Math.random() * 400);
            }
        }

        // Respawn barrel after 30 seconds
        barrel.respawnTimer = setTimeout(() => {
            barrel.exploded = false;
            this._respawnBarrel(barrel);
        }, 30000);
    },

    _respawnBarrel(barrel) {
        // Recreate barrel at same position
        const oldBarrels = this.explosiveBarrels;
        const idx = oldBarrels.indexOf(barrel);
        if (idx === -1) return;

        // Remove old collision box
        this.collisionBoxes = this.collisionBoxes.filter(b => !b.barrelData || b.barrelData !== barrel);

        // Create new barrel at same position
        this._createExplosiveBarrel(barrel.x, barrel.z);

        // Replace in array
        oldBarrels[idx] = this.explosiveBarrels[this.explosiveBarrels.length - 1];
        this.explosiveBarrels.pop();
    },

    updateBarrels(dt) {
        // Animate warning lights on barrels
        const time = performance.now() * 0.003;
        for (const barrel of this.explosiveBarrels) {
            if (barrel.exploded || !barrel.light) continue;
            barrel.light.intensity = 0.2 + Math.sin(time + barrel.x) * 0.15;
        }
    },

    checkBarrelHit(raycaster, wallDist = Infinity) {
        // Check if a bullet hit an explosive barrel
        for (const barrel of this.explosiveBarrels) {
            if (barrel.exploded) continue;
            const barrelPos = new THREE.Vector3(barrel.x, 0.65, barrel.z);
            const dist = raycaster.ray.origin.distanceTo(barrelPos);
            if (dist > 80 || dist > wallDist) continue;

            // Simple sphere intersection check
            const sphere = new THREE.Sphere(barrelPos, 0.5);
            const intersectPoint = raycaster.ray.intersectSphere(sphere, new THREE.Vector3());
            if (intersectPoint) {
                const hitDist = raycaster.ray.origin.distanceTo(intersectPoint);
                if (hitDist <= wallDist) {
                    this.detonateBarrel(barrel);
                    return true;
                }
            }
        }
        return false;
    }
};

