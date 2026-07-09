// ============================
// MULTIPLAYER SYSTEM - Firebase Realtime Online Play
// ============================

const MultiplayerSystem = {
    active: false,
    myUid: null,
    myCodename: "Soldado",
    otherPlayers: {}, // UID -> { mesh, sprite, data, collisionBox }
    cleanupInterval: null,
    lastUpdate: 0,
    dbRef: null,
    unsubscribe: null,
    playerGroup: null,

    init() {
        // Remover grupo antigo se existir
        if (this.playerGroup) {
            Game.scene.remove(this.playerGroup);
        }
        this.playerGroup = new THREE.Group();
        Game.scene.add(this.playerGroup);
    },

    async startOnline() {
        if (!FirebaseService.user) {
            alert("VOCÊ PRECISA CONECTAR UMA CONTA NO PERFIL TÁTICO PARA ENTRAR NO COMBATE ONLINE!");
            return false;
        }

        this.active = true;
        this.myUid = FirebaseService.user.uid;
        
        // Inicializar grupo de jogadores online na cena atual do jogo
        this.init();

        // Obter codinome tático do Firestore
        const doc = await db.collection("players").doc(this.myUid).get();
        if (doc.exists && doc.data().codename) {
            this.myCodename = doc.data().codename;
        } else {
            this.myCodename = FirebaseService.user.email ? FirebaseService.user.email.split('@')[0] : `Operador_${this.myUid.slice(0, 5)}`;
        }

        // Criar ou atualizar documento na sala online
        this.dbRef = db.collection("online_players").doc(this.myUid);
        await this.dbRef.set({
            codename: this.myCodename,
            x: 0, y: 1.7, z: 0,
            rotY: 0,
            activeWeapon: "M4A1",
            isShooting: false,
            isDead: false,
            damageReceived: 0,
            shooterName: "",
            lastSeen: Date.now()
        });

        // Escutar alterações nos jogadores online
        this.unsubscribe = db.collection("online_players").onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                const data = change.doc.data();
                const uid = change.doc.id;

                if (uid === this.myUid) {
                    // Tratar dano recebido
                    if (change.type === "modified" && data.damageReceived > 0) {
                        this.handleDamageReceived(data.damageReceived, data.shooterName);
                    }
                    return;
                }

                if (change.type === "removed" || data.isDead || (Date.now() - data.lastSeen > 15000)) {
                    this.removePlayer(uid);
                } else {
                    this.updatePlayer(uid, data);
                }
            });
        }, error => {
            console.error("Erro na escuta do Firestore:", error);
        });

        // Loop de limpeza de inativos e envio de sinal (batimento cardíaco)
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const uid in this.otherPlayers) {
                const p = this.otherPlayers[uid];
                if (now - p.data.lastSeen > 12000) {
                    this.removePlayer(uid);
                }
            }
            this.sendMyState();
        }, 3000);

        if (typeof HUD !== 'undefined') {
            HUD.addKillFeed(`📡 CONECTADO AO COMBATE MULTIPLAYER!`);
        }
        return true;
    },

    stopOnline() {
        if (!this.active) return;
        this.active = false;
        
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        if (this.dbRef) {
            this.dbRef.delete().catch(e => console.error("Erro ao remover registro online:", e));
            this.dbRef = null;
        }

        // Remover todas as malhas dos outros jogadores
        for (const uid in this.otherPlayers) {
            this.removePlayer(uid);
        }

        this.otherPlayers = {};
        if (this.playerGroup) {
            Game.scene.remove(this.playerGroup);
            this.playerGroup = null;
        }
    },

    sendMyState() {
        if (!this.active || !this.dbRef || !PlayerController.isAlive) return;

        const pos = PlayerController.getPosition();
        const rotY = PlayerController.rotation ? PlayerController.rotation.y : 0;
        const weapon = WeaponSystem.weapons[WeaponSystem.currentIndex] ? WeaponSystem.weapons[WeaponSystem.currentIndex].name : "M4A1";

        this.dbRef.update({
            x: pos.x,
            y: pos.y,
            z: pos.z,
            rotY: rotY,
            activeWeapon: weapon,
            isShooting: WeaponSystem.isFiring || false,
            lastSeen: Date.now()
        }).catch(e => console.error("Erro ao enviar estado:", e));
    },

    handleDamageReceived(damageVal, shooter) {
        if (!PlayerController.isAlive) return;

        PlayerController.takeDamage(damageVal, { x: 0, z: 0 });
        if (typeof HUD !== 'undefined') {
            HUD.addKillFeed(`💥 Atingido por ${shooter}!`);
        }
        
        // Limpar dano local no Firestore
        this.dbRef.update({
            damageReceived: 0,
            shooterName: ""
        }).catch(e => console.error("Erro ao limpar dano:", e));
    },

    updatePlayer(uid, data) {
        let player = this.otherPlayers[uid];

        if (!player) {
            const group = new THREE.Group();
            
            // Corpo e Cabeça do modelo do Outro Jogador
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x116633, roughness: 0.8, metalness: 0.2 }); // Verde militar
            const headMat = new THREE.MeshStandardMaterial({ color: 0xcc3333 }); // Capacete vermelho
            
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.4, 8), bodyMat);
            body.position.y = 0.7;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), headMat);
            head.position.y = 1.5;
            head.castShadow = true;
            group.add(head);

            // Cano da arma apontado para frente
            const gunGeo = new THREE.BoxGeometry(0.1, 0.1, 0.55);
            const gunMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
            const gun = new THREE.Mesh(gunGeo, gunMat);
            gun.position.set(0.2, 0.9, -0.35);
            group.add(gun);

            // Sprite do Codinome flutuante
            const nameCanvas = document.createElement('canvas');
            nameCanvas.width = 256;
            nameCanvas.height = 64;
            const ctx = nameCanvas.getContext('2d');
            ctx.fillStyle = 'rgba(10, 10, 15, 0.6)';
            ctx.fillRect(0, 0, 256, 64);
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, 256, 64);
            
            ctx.font = 'bold 20px Orbitron, sans-serif';
            ctx.fillStyle = '#00ff88';
            ctx.textAlign = 'center';
            ctx.fillText(data.codename.toUpperCase(), 128, 38);

            const nameTex = new THREE.CanvasTexture(nameCanvas);
            const spriteMat = new THREE.SpriteMaterial({ map: nameTex, transparent: true });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.position.y = 2.0;
            sprite.scale.set(1.4, 0.35, 1);
            group.add(sprite);

            this.playerGroup.add(group);

            player = {
                mesh: group,
                sprite: sprite,
                data: data,
                collisionBox: null
            };

            this.otherPlayers[uid] = player;

            if (typeof HUD !== 'undefined') {
                HUD.addKillFeed(`📡 ${data.codename.toUpperCase()} conectou ao lobby!`);
            }
        }

        // Atualizar coordenadas e rotação do modelo
        player.mesh.position.set(data.x, data.y - 1.0, data.z); // Compensar altura do pivô do chão
        player.mesh.rotation.y = data.rotY;
        player.data = data;

        // Atualizar a caixa de colisão lógica
        const w = 0.8, h = 1.8, d = 0.8;
        const x = data.x, y = data.y - 0.2, z = data.z;

        if (player.collisionBox) {
            player.collisionBox.min.set(x - w/2, y - h/2, z - d/2);
            player.collisionBox.max.set(x + w/2, y + h/2, z + d/2);
        } else {
            player.collisionBox = {
                min: new THREE.Vector3(x - w/2, y - h/2, z - d/2),
                max: new THREE.Vector3(x + w/2, y + h/2, z + d/2),
                isOtherPlayer: true,
                playerUid: uid,
                playerData: data
            };
            GameMap.collisionBoxes.push(player.collisionBox);
        }

        // Criar flash de tiro
        if (data.isShooting && Math.random() < 0.3) {
            const barrelTip = new THREE.Vector3(0.2, 0.9, -0.65);
            barrelTip.applyQuaternion(player.mesh.quaternion);
            barrelTip.add(player.mesh.position);
            EffectsManager.createMuzzleFlash(barrelTip);
            if (Math.random() < 0.2 && typeof AudioManager !== 'undefined') {
                AudioManager.playShot('m4a1'); // som simulado
            }
        }
    },

    removePlayer(uid) {
        const player = this.otherPlayers[uid];
        if (!player) return;

        this.playerGroup.remove(player.mesh);
        player.mesh.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });

        // Remover colisão
        if (player.collisionBox) {
            GameMap.collisionBoxes = GameMap.collisionBoxes.filter(box => box !== player.collisionBox);
        }

        if (typeof HUD !== 'undefined') {
            HUD.addKillFeed(`📡 ${player.data.codename.toUpperCase()} desconectou.`);
        }
        delete this.otherPlayers[uid];
    },

    damageOtherPlayer(uid, damage) {
        const player = this.otherPlayers[uid];
        if (!player) return;

        db.collection("online_players").doc(uid).update({
            damageReceived: firebase.firestore.FieldValue.increment(damage),
            shooterName: this.myCodename
        }).then(() => {
            if (typeof HUD !== 'undefined') {
                HUD.addKillFeed(`🎯 Dano causado em ${player.data.codename.toUpperCase()}!`);
            }
        }).catch(e => console.error("Erro ao enviar dano:", e));
    }
};

window.MultiplayerSystem = MultiplayerSystem;
