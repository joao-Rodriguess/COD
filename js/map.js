// ============================
// GAME MAP - 3D Infinite Procedural Environment (Chunk-based with Canvas Textures)
// ============================

const GameMap = {
    scene: null,
    collisionBoxes: [],
    enemySpawnPoints: [],
    playerSpawn: new THREE.Vector3(0, 1.7, 0),
    mapSize: 450, // Mantido para compatibilidade
    chunkSize: 150,
    loadedChunks: {},
    currentChunkX: null,
    currentChunkZ: null,
    mapGroup: null,
    skyMesh: null,
    sunLight: null,
    materials: null,
    currentTheme: 'urban',

    init(scene) {
        this.scene = scene;
        this.collisionBoxes = [];
        this.enemySpawnPoints = [];
        this.ladders = [];
        this.chests = [];
        this.explosiveBarrels = [];
        this.loadedChunks = {};
        this.currentChunkX = null;
        this.currentChunkZ = null;
        this.mapGroup = null;
        this.skyMesh = null;
        this.sunLight = null;
        this.materials = {
            ground: new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.95, metalness: 0.05 }),
            sky: new THREE.MeshBasicMaterial({ color: 0x1a1a2e, side: THREE.BackSide }),
            bldg1: this._mat(0x4a4a55),
            bldg2: this._mat(0x555560),
            bldg3: this._mat(0x3d3d48),
            window: new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.05, metalness: 0.95 })
        };
    },

    _cleanup() {
        if (this.skyMesh) {
            this.scene.remove(this.skyMesh);
            if (this.skyMesh.geometry) this.skyMesh.geometry.dispose();
            if (this.skyMesh.material) this.skyMesh.material.dispose();
            this.skyMesh = null;
        }

        if (this.mapGroup) {
            this.scene.remove(this.mapGroup);
            this.mapGroup.traverse(child => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
            this.mapGroup = null;
        }

        // Dispose procedural textures
        for (const matKey in this.materials) {
            const mat = this.materials[matKey];
            if (mat && mat.map) {
                mat.map.dispose();
                mat.map = null;
            }
        }
        
        this.collisionBoxes = [];
        this.enemySpawnPoints = [];
        this.ladders = [];
        this.chests = [];
        this.explosiveBarrels = [];
        this.loadedChunks = {};
        this.currentChunkX = null;
        this.currentChunkZ = null;
        this.sunLight = null;
    },

    _add(obj) {
        if (this.mapGroup) {
            this.mapGroup.add(obj);
        } else {
            this.scene.add(obj);
        }
        return obj;
    },

    _addBox(w, h, d, x, y, z, material, parentGroup, addCollision = true) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parentGroup.add(mesh);

        const colBox = {
            min: new THREE.Vector3(x - w/2, y - h/2, z - d/2),
            max: new THREE.Vector3(x + w/2, y + h/2, z + d/2),
            mesh: mesh
        };

        if (addCollision) {
            this.collisionBoxes.push(colBox);
        }
        return colBox;
    },

    _createProceduralTexture(type, baseColorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Pinta a cor base
        ctx.fillStyle = baseColorHex;
        ctx.fillRect(0, 0, 512, 512);

        if (type === 'asphalt') {
            // Asfalto áspero granulado com rachaduras sutis
            const imgData = ctx.getImageData(0, 0, 512, 512);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const noise = (Math.random() - 0.5) * 15;
                data[i] = Math.max(0, Math.min(255, data[i] + noise));
                data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
                data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
            }
            ctx.putImageData(imgData, 0, 0);

            // Desenhar ranhuras e rachaduras
            ctx.strokeStyle = 'rgba(20, 20, 20, 0.4)';
            ctx.lineWidth = 1.5;
            for (let j = 0; j < 5; j++) {
                ctx.beginPath();
                let x = Math.random() * 512;
                let y = Math.random() * 512;
                ctx.moveTo(x, y);
                for (let k = 0; k < 6; k++) {
                    x += (Math.random() - 0.5) * 35;
                    y += (Math.random() - 0.5) * 35;
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
        } 
        else if (type === 'sand') {
            // Areia com grãos finos dourados e variações onduladas
            const grad = ctx.createLinearGradient(0, 0, 512, 512);
            grad.addColorStop(0, baseColorHex);
            grad.addColorStop(0.5, '#dccb99');
            grad.addColorStop(1, '#baaa72');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 512, 512);

            const imgData = ctx.getImageData(0, 0, 512, 512);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const noise = (Math.random() - 0.5) * 10;
                data[i] = Math.max(0, Math.min(255, data[i] + noise));
                data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise * 0.9));
                data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise * 0.7));
            }
            ctx.putImageData(imgData, 0, 0);
        } 
        else if (type === 'snow') {
            // Neve compacta e brilhante
            const grad = ctx.createRadialGradient(256, 256, 10, 256, 256, 360);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(1, '#f0f0fb');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 512, 512);

            // Brilhos
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            for (let j = 0; j < 300; j++) {
                ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
            }
        } 
        else if (type === 'building') {
            // Painéis retangulares de concreto pré-moldado / revestimento de prédios
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.lineWidth = 2;
            
            const spacingX = 64;
            const spacingY = 32;
            ctx.beginPath();
            for (let y = 0; y < 512; y += spacingY) {
                ctx.moveTo(0, y);
                ctx.lineTo(512, y);
            }
            let row = 0;
            for (let y = 0; y < 512; y += spacingY) {
                const offset = (row % 2) * (spacingX / 2);
                for (let x = offset; x < 512 + spacingX; x += spacingX) {
                    ctx.moveTo(x, y);
                    ctx.lineTo(x, y + spacingY);
                }
                row++;
            }
            ctx.stroke();

            // Sombra interna sutil para relevo (bevel)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            row = 0;
            for (let y = 1; y < 512; y += spacingY) {
                ctx.moveTo(0, y);
                ctx.lineTo(512, y);
                const offset = (row % 2) * (spacingX / 2);
                for (let x = offset + 1; x < 512 + spacingX; x += spacingX) {
                    ctx.moveTo(x, y);
                    ctx.lineTo(x, y + spacingY - 1);
                }
                row++;
            }
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    },

    applyTheme(theme) {
        this.currentTheme = theme;
        this._cleanup();

        this.mapGroup = new THREE.Group();
        this.scene.add(this.mapGroup);

        let groundColor, skyColor, fogColor, bldg1, bldg2, bldg3;
        let fogNear = 100, fogFar = 350;
        let groundTexType = 'asphalt';
        let groundColorStr = '#3a3a3a';
        let groundTextureRepeat = 25;

        if (theme === 'desert') {
            groundColor = 0xc2b280; skyColor = 0xffcc99; fogColor = 0xffcc99;
            bldg1 = 0xd2c290; bldg2 = 0xb2a270; bldg3 = 0xc2b280;
            fogNear = 60;
            fogFar = 280;
            groundTexType = 'sand';
            groundColorStr = '#c2b280';
            groundTextureRepeat = 12;
        } else if (theme === 'snow') {
            groundColor = 0xddddff; skyColor = 0x99aadd; fogColor = 0xaabbdd;
            bldg1 = 0x8899aa; bldg2 = 0x778899; bldg3 = 0x99aabb;
            fogNear = 50;
            fogFar = 240;
            groundTexType = 'snow';
            groundColorStr = '#ddddff';
            groundTextureRepeat = 15;
        } else { // urban
            groundColor = 0x3a3a3a; skyColor = 0x1a1a2e; fogColor = 0x1a1a2e;
            bldg1 = 0x4a4a55; bldg2 = 0x555560; bldg3 = 0x3d3d48;
            fogNear = 100;
            fogFar = 350;
            groundTexType = 'asphalt';
            groundColorStr = '#3a3a3a';
            groundTextureRepeat = 25;
        }
        
        if (this.scene.fog) {
            this.scene.fog.color.setHex(fogColor);
            this.scene.fog.near = fogNear;
            this.scene.fog.far = fogFar;
        }

        // Criar texturas do solo
        const groundTex = this._createProceduralTexture(groundTexType, groundColorStr);
        groundTex.repeat.set(groundTextureRepeat, groundTextureRepeat);
        
        this.materials.ground.color.setHex(groundColor);
        this.materials.ground.map = groundTex;
        this.materials.ground.needsUpdate = true;

        this.materials.sky.color.setHex(skyColor);

        // Criar texturas dos prédios
        const hexStr = (num) => '#' + num.toString(16).padStart(6, '0');
        const bldg1Tex = this._createProceduralTexture('building', hexStr(bldg1));
        bldg1Tex.repeat.set(2, 4);
        const bldg2Tex = this._createProceduralTexture('building', hexStr(bldg2));
        bldg2Tex.repeat.set(3, 5);
        const bldg3Tex = this._createProceduralTexture('building', hexStr(bldg3));
        bldg3Tex.repeat.set(2, 3);

        this.materials.bldg1.color.setHex(bldg1);
        this.materials.bldg1.map = bldg1Tex;
        this.materials.bldg1.needsUpdate = true;

        this.materials.bldg2.color.setHex(bldg2);
        this.materials.bldg2.map = bldg2Tex;
        this.materials.bldg2.needsUpdate = true;

        this.materials.bldg3.color.setHex(bldg3);
        this.materials.bldg3.map = bldg3Tex;
        this.materials.bldg3.needsUpdate = true;

        // 1. Criar o Skybox global
        this._createSkybox();

        // 2. Criar iluminação global
        this._createLighting();

        // 3. Gerar os chunks iniciais (grade 3x3 ao redor de 0,0)
        this._updateChunks(new THREE.Vector3(0, 0, 0), true);
    },

    _mat(color, roughness = 0.8) {
        return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.1 });
    },

    _hash(x, z, seed = 0) {
        const sx = Math.sin((x + seed) * 12.9898 + (z - seed) * 78.233) * 43758.5453;
        return sx - Math.floor(sx);
    },

    _createSkybox() {
        const skyGeo = new THREE.SphereGeometry(600, 32, 32);
        this.skyMesh = new THREE.Mesh(skyGeo, this.materials.sky);
        this.scene.add(this.skyMesh);
    },

    _createLighting() {
        const ambient = new THREE.AmbientLight(0x404060, 0.6);
        this._add(ambient);

        this.sunLight = new THREE.DirectionalLight(0xffeedd, 1.2);
        this.sunLight.position.set(30, 50, 20);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 150;
        this.sunLight.shadow.camera.left = -50;
        this.sunLight.shadow.camera.right = 50;
        this.sunLight.shadow.camera.top = 50;
        this.sunLight.shadow.camera.bottom = -50;
        this.sunLight.shadow.bias = -0.001;
        this._add(this.sunLight);

        const hemi = new THREE.HemisphereLight(0x6688cc, 0x443322, 0.4);
        this._add(hemi);
    },

    _updateChunks(playerPos, force = false) {
        const chunkX = Math.floor((playerPos.x + this.chunkSize / 2) / this.chunkSize);
        const chunkZ = Math.floor((playerPos.z + this.chunkSize / 2) / this.chunkSize);

        if (this.skyMesh) {
            this.skyMesh.position.set(playerPos.x, 0, playerPos.z);
        }
        if (this.sunLight) {
            this.sunLight.position.set(playerPos.x + 30, 50, playerPos.z + 20);
            this.sunLight.target.position.set(playerPos.x, 0, playerPos.z);
        }

        if (this.currentChunkX === chunkX && this.currentChunkZ === chunkZ && !force) {
            return;
        }

        this.currentChunkX = chunkX;
        this.currentChunkZ = chunkZ;

        const activeKeys = new Set();
        const renderDist = 1; // Grade 3x3

        for (let dx = -renderDist; dx <= renderDist; dx++) {
            for (let dz = -renderDist; dz <= renderDist; dz++) {
                const cx = chunkX + dx;
                const cz = chunkZ + dz;
                const key = `${cx},${cz}`;
                activeKeys.add(key);
                this._generateChunk(cx, cz);
            }
        }

        for (const key in this.loadedChunks) {
            if (!activeKeys.has(key)) {
                const [cx, cz] = key.split(',').map(Number);
                this._unloadChunk(cx, cz);
            }
        }
    },

    _generateChunk(cx, cz) {
        const key = `${cx},${cz}`;
        if (this.loadedChunks[key]) return;

        const chunkGroup = new THREE.Group();
        this.mapGroup.add(chunkGroup);

        const chunkCollisionBoxes = [];
        const chunkLadders = [];
        const chunkChests = [];
        const chunkBarrels = [];

        // 1. Chão local
        const groundGeo = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize);
        const ground = new THREE.Mesh(groundGeo, this.materials.ground);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(cx * this.chunkSize, 0, cz * this.chunkSize);
        ground.receiveShadow = true;
        chunkGroup.add(ground);

        // 2. Estradas (Centralizadas)
        if (cx === 0 || cz === 0) {
            let roadMat;
            let roadW = 6;
            if (this.currentTheme === 'desert') {
                roadMat = new THREE.MeshStandardMaterial({ color: 0xa58a55, roughness: 1.0, metalness: 0.0 });
                roadW = 8;
            } else if (this.currentTheme === 'snow') {
                roadMat = new THREE.MeshStandardMaterial({ color: 0xb5c5d5, roughness: 0.9, metalness: 0.1 });
                roadW = 7;
            } else {
                roadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 });
            }

            // Estrada vertical
            if (cx === 0) {
                const roadGeo = new THREE.PlaneGeometry(roadW, this.chunkSize);
                const road = new THREE.Mesh(roadGeo, roadMat);
                road.rotation.x = -Math.PI / 2;
                road.position.set(0, 0.01, cz * this.chunkSize);
                chunkGroup.add(road);

                if (this.currentTheme === 'urban') {
                    for (let i = -this.chunkSize/2; i < this.chunkSize/2; i += 4) {
                        const lineGeo = new THREE.PlaneGeometry(0.15, 2);
                        const lineMat = new THREE.MeshBasicMaterial({ color: 0x888833 });
                        const line = new THREE.Mesh(lineGeo, lineMat);
                        line.rotation.x = -Math.PI / 2;
                        line.position.set(0, 0.02, cz * this.chunkSize + i);
                        chunkGroup.add(line);
                    }
                }
            }

            // Estrada horizontal
            if (cz === 0) {
                const roadGeo = new THREE.PlaneGeometry(roadW, this.chunkSize);
                const road = new THREE.Mesh(roadGeo, roadMat);
                road.rotation.x = -Math.PI / 2;
                road.rotation.z = Math.PI / 2;
                road.position.set(cx * this.chunkSize, 0.01, 0);
                chunkGroup.add(road);

                if (this.currentTheme === 'urban' && cx !== 0) {
                    for (let i = -this.chunkSize/2; i < this.chunkSize/2; i += 4) {
                        const lineGeo = new THREE.PlaneGeometry(0.15, 2);
                        const lineMat = new THREE.MeshBasicMaterial({ color: 0x888833 });
                        const line = new THREE.Mesh(lineGeo, lineMat);
                        line.rotation.x = -Math.PI / 2;
                        line.rotation.z = Math.PI / 2;
                        line.position.set(cx * this.chunkSize + i, 0.02, 0);
                        chunkGroup.add(line);
                    }
                }
            }
        }

        // Materiais para construções
        const roofMat = this._mat(0x2a2a35);
        const houseRoofMat = new THREE.MeshStandardMaterial({ color: 0x8b3a3a, roughness: 0.9 });
        const desertHouseRoofMat = new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 0.9 });
        const snowHouseRoofMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.9 });
        const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });

        // 3. Gerar Prédios e Casas (2 a 4 por chunk)
        const numBldgs = Math.floor(this._hash(cx, cz, 100) * 3) + 2;
        for (let i = 0; i < numBldgs; i++) {
            const bSeed = i * 20;
            const isHouse = this._hash(cx, cz, bSeed + 1) < 0.45;

            let w, h, d;
            if (isHouse) {
                w = 7 + this._hash(cx, cz, bSeed + 2) * 5;
                h = 3.2 + this._hash(cx, cz, bSeed + 3) * 2.5;
                d = 7 + this._hash(cx, cz, bSeed + 4) * 5;
            } else {
                w = 8 + this._hash(cx, cz, bSeed + 2) * 11;
                h = 5 + this._hash(cx, cz, bSeed + 3) * 13;
                d = 8 + this._hash(cx, cz, bSeed + 4) * 11;
            }

            const maxOffset = this.chunkSize / 2 - Math.max(w, d) / 2 - 10;
            const localX = (this._hash(cx, cz, bSeed + 5) - 0.5) * 2 * maxOffset;
            const localZ = (this._hash(cx, cz, bSeed + 6) - 0.5) * 2 * maxOffset;

            const x = cx * this.chunkSize + localX;
            const z = cz * this.chunkSize + localZ;

            // Evitar spawns e estradas
            if (cx === 0 && cz === 0 && Math.abs(x) < 25 && Math.abs(z) < 25) continue;
            if (cx === 0 && Math.abs(x) < 10) continue;
            if (cz === 0 && Math.abs(z) < 10) continue;

            const mat = [this.materials.bldg1, this.materials.bldg2, this.materials.bldg3][Math.floor(this._hash(cx, cz, bSeed + 7) * 3)];
            
            // Adicionar bloco de prédio/casa
            const buildingCol = this._addBox(w, h, d, x, h/2, z, mat, chunkGroup, true);
            chunkCollisionBoxes.push(buildingCol);

            if (isHouse) {
                // Telhado
                let rMat = houseRoofMat;
                if (this.currentTheme === 'desert') rMat = desertHouseRoofMat;
                else if (this.currentTheme === 'snow') rMat = snowHouseRoofMat;

                const roofHeight = 2.0 + this._hash(cx, cz, bSeed + 8) * 1.0;
                const roofGeo = new THREE.ConeGeometry(w * 0.73, roofHeight, 4);
                const roof = new THREE.Mesh(roofGeo, rMat);
                roof.position.set(x, h + roofHeight / 2, z);
                roof.rotation.y = Math.PI / 4;
                roof.scale.set(1, 1, d / w);
                roof.castShadow = true;
                chunkGroup.add(roof);

                if (this.currentTheme === 'snow') {
                    const snowRoof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.75, roofHeight, 4), snowMat);
                    snowRoof.position.set(x, h + roofHeight / 2 + 0.05, z);
                    snowRoof.rotation.y = Math.PI / 4;
                    snowRoof.scale.set(1, 1, d / w);
                    chunkGroup.add(snowRoof);
                }

                // Porta
                const doorMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
                const door = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.0), doorMat);
                door.position.set(x, 1.0, z + d/2 + 0.02);
                chunkGroup.add(door);

                // Janelas
                const winGeo = new THREE.PlaneGeometry(0.8, 1.0);

                const leftWin = new THREE.Mesh(winGeo, this.materials.window);
                leftWin.position.set(x - w/2 - 0.02, h * 0.6, z);
                leftWin.rotation.y = -Math.PI / 2;
                chunkGroup.add(leftWin);

                const rightWin = leftWin.clone();
                rightWin.position.x = x + w/2 + 0.02;
                rightWin.rotation.y = Math.PI / 2;
                chunkGroup.add(rightWin);
            } else {
                // Cobertura do prédio
                const over = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.3, d + 0.5), roofMat);
                over.position.set(x, h, z);
                chunkGroup.add(over);

                // Janelas espelhadas verticais
                const stripWidth = 0.8;
                const numStrips = Math.max(1, Math.floor(w / 4));
                const stripGap = w / (numStrips + 1);

                for (let j = 1; j <= numStrips; j++) {
                    const winStrip = new THREE.Mesh(new THREE.PlaneGeometry(stripWidth, h - 2), this.materials.window);
                    winStrip.position.set(x - w/2 + j * stripGap, h / 2, z + d/2 + 0.01);
                    chunkGroup.add(winStrip);

                    const winStripBack = winStrip.clone();
                    winStripBack.position.z = z - d/2 - 0.01;
                    winStripBack.rotation.y = Math.PI;
                    chunkGroup.add(winStripBack);
                }
            }
        }

        // 4. Postes de Luz na estrada
        if (cx === 0 || cz === 0) {
            let lampColor = 0x333333;
            let lightColor = 0xffcc88;
            if (this.currentTheme === 'desert') {
                lampColor = 0x6b4c35;
                lightColor = 0xff6600;
            } else if (this.currentTheme === 'snow') {
                lampColor = 0x2c3e50;
                lightColor = 0xddedff;
            }
            const lampMat = this._mat(lampColor);

            const lampInterval = 50;
            for (let offset = -this.chunkSize/2 + 25; offset < this.chunkSize/2; offset += lampInterval) {
                let lx = 0, lz = 0;
                if (cx === 0) {
                    lx = 4.2;
                    lz = cz * this.chunkSize + offset;
                } else {
                    lx = cx * this.chunkSize + offset;
                    lz = 4.2;
                }

                if (Math.abs(lx) < 20 && Math.abs(lz) < 20) continue;

                const lampGroup = new THREE.Group();

                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 6), lampMat);
                pole.position.y = 2.5;
                pole.castShadow = true;
                lampGroup.add(pole);

                const fix = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.15, 0.2, 6), lampMat);
                fix.position.y = 5;
                lampGroup.add(fix);

                if (this.currentTheme === 'snow') {
                    const snowCap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 6), snowMat);
                    snowCap.position.y = 5.1;
                    lampGroup.add(snowCap);
                }

                const light = new THREE.PointLight(lightColor, 0.8, 15);
                light.position.y = 4.8;
                lampGroup.add(light);

                lampGroup.position.set(lx, 0, lz);
                chunkGroup.add(lampGroup);

                chunkCollisionBoxes.push({
                    min: new THREE.Vector3(lx - 0.15, 0, lz - 0.15),
                    max: new THREE.Vector3(lx + 0.15, 5, lz + 0.15)
                });
            }
        }

        // 5. Decorações temáticas
        if (this.currentTheme === 'desert') {
            const cactusGreen = new THREE.MeshStandardMaterial({ color: 0x3b6b2f, roughness: 0.9 });
            const sandDuneMat = new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 1.0 });

            for (let j = 0; j < 5; j++) {
                const localX = (this._hash(cx, cz, j * 15 + 1) - 0.5) * (this.chunkSize - 20);
                const localZ = (this._hash(cx, cz, j * 15 + 2) - 0.5) * (this.chunkSize - 20);
                const x = cx * this.chunkSize + localX;
                const z = cz * this.chunkSize + localZ;

                if (Math.abs(x) < 25 && Math.abs(z) < 25) continue;
                if (cx === 0 && Math.abs(x) < 10) continue;
                if (cz === 0 && Math.abs(z) < 10) continue;

                const cacto = new THREE.Group();
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.8, 8), cactusGreen);
                trunk.position.y = 1.4;
                trunk.castShadow = true;
                cacto.add(trunk);

                const arm1H = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.7, 8), cactusGreen);
                arm1H.rotation.z = Math.PI / 2;
                arm1H.position.set(-0.4, 1.6, 0);
                cacto.add(arm1H);

                const arm1V = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.8, 8), cactusGreen);
                arm1V.position.set(-0.7, 2.0, 0);
                cacto.add(arm1V);

                cacto.position.set(x, 0, z);
                chunkGroup.add(cacto);

                chunkCollisionBoxes.push({
                    min: new THREE.Vector3(x - 0.8, 0, z - 0.4),
                    max: new THREE.Vector3(x + 0.8, 2.8, z + 0.4)
                });
            }

            if (this._hash(cx, cz, 99) < 0.6) {
                const localX = (this._hash(cx, cz, 97) - 0.5) * (this.chunkSize - 40);
                const localZ = (this._hash(cx, cz, 98) - 0.5) * (this.chunkSize - 40);
                const x = cx * this.chunkSize + localX;
                const z = cz * this.chunkSize + localZ;

                if (Math.abs(x) < 30 && Math.abs(z) < 30) {
                    // Ignora
                } else {
                    const duneGeo = new THREE.SphereGeometry(6, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
                    const dune = new THREE.Mesh(duneGeo, sandDuneMat);
                    dune.position.set(x, -0.5, z);
                    dune.scale.set(2.5, 0.8, 1.2);
                    dune.rotation.y = this._hash(cx, cz, 96) * Math.PI;
                    dune.receiveShadow = true;
                    dune.castShadow = true;
                    chunkGroup.add(dune);

                    chunkCollisionBoxes.push({
                        min: new THREE.Vector3(x - 6, 0, z - 3),
                        max: new THREE.Vector3(x + 6, 2.5, z + 3)
                    });
                }
            }
        } else if (this.currentTheme === 'snow') {
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2f13, roughness: 0.95 });
            const pineMat = new THREE.MeshStandardMaterial({ color: 0x1e3f20, roughness: 0.9 });

            for (let j = 0; j < 5; j++) {
                const localX = (this._hash(cx, cz, j * 15 + 1) - 0.5) * (this.chunkSize - 20);
                const localZ = (this._hash(cx, cz, j * 15 + 2) - 0.5) * (this.chunkSize - 20);
                const x = cx * this.chunkSize + localX;
                const z = cz * this.chunkSize + localZ;

                if (Math.abs(x) < 25 && Math.abs(z) < 25) continue;
                if (cx === 0 && Math.abs(x) < 10) continue;
                if (cz === 0 && Math.abs(z) < 10) continue;

                const pinheiro = new THREE.Group();
                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.8, 8), trunkMat);
                trunk.position.y = 0.9;
                trunk.castShadow = true;
                pinheiro.add(trunk);

                const baseCone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 8), pineMat);
                baseCone.position.y = 2.4;
                baseCone.castShadow = true;
                pinheiro.add(baseCone);

                const baseSnow = new THREE.Mesh(new THREE.ConeGeometry(1.65, 0.5, 8), snowMat);
                baseSnow.position.set(0, 1.6, 0);
                pinheiro.add(baseSnow);

                const midCone = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.8, 8), pineMat);
                midCone.position.y = 3.6;
                midCone.castShadow = true;
                pinheiro.add(midCone);

                const midSnow = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.4, 8), snowMat);
                midSnow.position.set(0, 2.9, 0);
                pinheiro.add(midSnow);

                pinheiro.position.set(x, 0, z);
                chunkGroup.add(pinheiro);

                chunkCollisionBoxes.push({
                    min: new THREE.Vector3(x - 0.8, 0, z - 0.8),
                    max: new THREE.Vector3(x + 0.8, 4.0, z + 0.8)
                });
            }
        }

        // 6. Barris Explosivos procedurais
        const numBarrels = Math.floor(this._hash(cx, cz, 40) * 3);
        for (let j = 0; j < numBarrels; j++) {
            const localX = (this._hash(cx, cz, j * 12 + 41) - 0.5) * (this.chunkSize - 30);
            const localZ = (this._hash(cx, cz, j * 12 + 42) - 0.5) * (this.chunkSize - 30);
            const x = cx * this.chunkSize + localX;
            const z = cz * this.chunkSize + localZ;

            if (Math.abs(x) < 25 && Math.abs(z) < 25) continue;
            if (cx === 0 && Math.abs(x) < 8) continue;
            if (cz === 0 && Math.abs(z) < 8) continue;

            const barrelGroup = new THREE.Group();

            const barrelGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.3, 10);
            const barrelMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.5, metalness: 0.6 });
            const barrel = new THREE.Mesh(barrelGeo, barrelMat);
            barrel.position.y = 0.65;
            barrel.castShadow = true;
            barrelGroup.add(barrel);

            const stripeGeo = new THREE.PlaneGeometry(0.35, 0.25);
            const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, side: THREE.DoubleSide });
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            stripe.position.set(0, 0.7, 0.46);
            barrelGroup.add(stripe);

            const warnLight = new THREE.PointLight(0xff4400, 0.3, 4);
            warnLight.position.set(0, 1.4, 0);
            barrelGroup.add(warnLight);

            barrelGroup.position.set(x, 0, z);
            chunkGroup.add(barrelGroup);

            const barrelData = {
                x: x,
                z: z,
                mesh: barrelGroup,
                light: warnLight,
                exploded: false,
                respawnTimer: 0
            };

            chunkBarrels.push(barrelData);

            chunkCollisionBoxes.push({
                min: new THREE.Vector3(x - 0.45, 0, z - 0.45),
                max: new THREE.Vector3(x + 0.45, 1.3, z + 0.45),
                mesh: barrel,
                isExplosiveBarrel: true,
                barrelData: barrelData
            });
        }

        // 7. Baús procedurais
        if (this._hash(cx, cz, 70) < 0.4) {
            const localX = (this._hash(cx, cz, 71) - 0.5) * (this.chunkSize - 30);
            const localZ = (this._hash(cx, cz, 72) - 0.5) * (this.chunkSize - 30);
            const x = cx * this.chunkSize + localX;
            const z = cz * this.chunkSize + localZ;

            if (Math.abs(x) < 25 && Math.abs(z) < 25) {
                // Ignora
            } else {
                const chestGroup = new THREE.Group();
                const chestMat = new THREE.MeshStandardMaterial({ color: 0x553311, roughness: 0.9 });
                const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.0), chestMat);
                base.position.y = 0.5;
                base.castShadow = true;
                chestGroup.add(base);

                const lid = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 1.0), new THREE.MeshStandardMaterial({ color: 0x664422, roughness: 0.9 }));
                lid.position.y = 1.1;
                lid.castShadow = true;
                chestGroup.add(lid);

                chestGroup.position.set(x, 0, z);
                chunkGroup.add(chestGroup);

                chunkCollisionBoxes.push({
                    min: new THREE.Vector3(x - 0.75, 0, z - 0.5),
                    max: new THREE.Vector3(x + 0.75, 1.2, z + 0.5)
                });

                chunkChests.push({
                    x: x, z: z, group: chestGroup, opened: false
                });
            }
        }

        this.loadedChunks[key] = {
            group: chunkGroup,
            collisionBoxes: chunkCollisionBoxes,
            ladders: chunkLadders,
            chests: chunkChests,
            barrels: chunkBarrels
        };

        this.collisionBoxes.push(...chunkCollisionBoxes);
        this.ladders.push(...chunkLadders);
        this.chests.push(...chunkChests);
        this.explosiveBarrels.push(...chunkBarrels);
    },

    _unloadChunk(cx, cz) {
        const key = `${cx},${cz}`;
        const chunk = this.loadedChunks[key];
        if (!chunk) return;

        this.mapGroup.remove(chunk.group);

        chunk.group.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            }
        });

        this.collisionBoxes = this.collisionBoxes.filter(b => !chunk.collisionBoxes.includes(b));
        this.ladders = this.ladders.filter(l => !chunk.ladders.includes(l));
        this.chests = this.chests.filter(c => !chunk.chests.includes(c));
        this.explosiveBarrels = this.explosiveBarrels.filter(b => !chunk.barrels.includes(b));

        delete this.loadedChunks[key];
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

    getCollisionBoxes() { return this.collisionBoxes; },
    getSpawnPoints() {
        const points = [];
        if (typeof PlayerController !== 'undefined') {
            const playerPos = PlayerController.getPosition();
            for (let i = 0; i < 15; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = 45 + Math.random() * 55;
                points.push(new THREE.Vector3(
                    playerPos.x + Math.cos(angle) * distance,
                    1.7,
                    playerPos.z + Math.sin(angle) * distance
                ));
            }
        } else {
            for (let i = 0; i < 15; i++) {
                points.push(new THREE.Vector3((Math.random() - 0.5) * 80, 1.7, (Math.random() - 0.5) * 80));
            }
        }
        return points;
    },
    getPlayerSpawn() { return this.playerSpawn.clone(); },

    detonateBarrel(barrel) {
        if (barrel.exploded) return;
        barrel.exploded = true;

        const pos = new THREE.Vector3(barrel.x, 0.65, barrel.z);

        if (barrel.mesh && barrel.mesh.parent) {
            barrel.mesh.parent.remove(barrel.mesh);
        }

        barrel.mesh.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });

        EffectsManager.barrelExplosion(pos);
        EffectsManager.screenShake(5);
        AudioManager.playBarrelExplosion();

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

        if (typeof PlayerController !== 'undefined' && PlayerController.isAlive) {
            const playerPos = PlayerController.getPosition();
            const dist = new THREE.Vector3(playerPos.x, 0, playerPos.z).distanceTo(new THREE.Vector3(pos.x, 0, pos.z));
            if (dist < radius) {
                const falloff = 1 - (dist / radius);
                const damage = (30 + 100 * falloff) * 0.7;
                PlayerController.takeDamage(damage, { x: pos.x - playerPos.x, z: pos.z - playerPos.z });
            }
        }

        for (const other of this.explosiveBarrels) {
            if (other === barrel || other.exploded) continue;
            const dist = Math.sqrt(
                (other.x - barrel.x) ** 2 + (other.z - barrel.z) ** 2
            );
            if (dist < radius * 0.8) {
                setTimeout(() => this.detonateBarrel(other), 200 + Math.random() * 400);
            }
        }

        barrel.respawnTimer = setTimeout(() => {
            barrel.exploded = false;
            this._respawnBarrel(barrel);
        }, 30000);
    },

    _respawnBarrel(barrel) {
        const cx = Math.floor((barrel.x + this.chunkSize / 2) / this.chunkSize);
        const cz = Math.floor((barrel.z + this.chunkSize / 2) / this.chunkSize);
        const key = `${cx},${cz}`;
        const chunk = this.loadedChunks[key];
        if (!chunk) return;

        this.collisionBoxes = this.collisionBoxes.filter(b => !b.barrelData || b.barrelData !== barrel);

        const barrelGroup = new THREE.Group();
        const barrelGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.3, 10);
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.5, metalness: 0.6 });
        const mesh = new THREE.Mesh(barrelGeo, barrelMat);
        mesh.position.y = 0.65;
        mesh.castShadow = true;
        barrelGroup.add(mesh);

        const stripeGeo = new THREE.PlaneGeometry(0.35, 0.25);
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, side: THREE.DoubleSide });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(0, 0.7, 0.46);
        barrelGroup.add(stripe);

        const warnLight = new THREE.PointLight(0xff4400, 0.3, 4);
        warnLight.position.set(0, 1.4, 0);
        barrelGroup.add(warnLight);

        barrelGroup.position.set(barrel.x, 0, barrel.z);
        chunk.group.add(barrelGroup);

        barrel.mesh = barrelGroup;
        barrel.light = warnLight;

        this.collisionBoxes.push({
            min: new THREE.Vector3(barrel.x - 0.45, 0, barrel.z - 0.45),
            max: new THREE.Vector3(barrel.x + 0.45, 1.3, barrel.z + 0.45),
            mesh: mesh,
            isExplosiveBarrel: true,
            barrelData: barrel
        });
    },

    update(dt, playerPos) {
        if (playerPos) {
            this._updateChunks(playerPos);
        }

        const time = performance.now() * 0.003;
        for (const barrel of this.explosiveBarrels) {
            if (barrel.exploded || !barrel.light) continue;
            barrel.light.intensity = 0.2 + Math.sin(time + barrel.x) * 0.15;
        }
    },

    updateBarrels(dt) {
        let playerPos = null;
        if (typeof PlayerController !== 'undefined' && PlayerController.isAlive) {
            playerPos = PlayerController.getPosition();
        }
        this.update(dt, playerPos);
    },

    checkBarrelHit(raycaster, wallDist = Infinity) {
        for (const barrel of this.explosiveBarrels) {
            if (barrel.exploded) continue;
            const barrelPos = new THREE.Vector3(barrel.x, 0.65, barrel.z);
            const dist = raycaster.ray.origin.distanceTo(barrelPos);
            if (dist > 80 || dist > wallDist) continue;

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
