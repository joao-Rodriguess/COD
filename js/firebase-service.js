// ============================
// FIREBASE SERVICE - Player Progress & Authentication
// ============================

const FirebaseService = {
    user: null,
    isGuest: false,

    init(onAuthStateChangedCallback) {
        auth.onAuthStateChanged(async (user) => {
            this.user = user;
            if (user) {
                this.isGuest = false;
                console.log("Jogador logado no Firebase:", user.uid);
                const data = await this.loadPlayerData();
                if (data && data.codename) {
                    user.codename = data.codename;
                }
            } else {
                console.log("Nenhum usuário ativo. Rodando como Guest/Convidado.");
                this.isGuest = true;
            }
            if (onAuthStateChangedCallback) {
                onAuthStateChangedCallback(user);
            }
        });
    },

    async loginAnonymous() {
        try {
            await auth.signInAnonymously();
            this.isGuest = false;
            return { success: true };
        } catch (error) {
            console.error("Erro no login anônimo:", error);
            this.isGuest = true;
            return { success: false, error: error.message };
        }
    },

    async loginGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            const result = await auth.signInWithPopup(provider);
            this.isGuest = false;
            
            // Verificar se o documento de dados do jogador já existe
            const doc = await db.collection("players").doc(result.user.uid).get();
            if (!doc.exists) {
                const codename = result.user.displayName || `Operador_${result.user.uid.slice(0, 5)}`;
                await this.saveDefaultData(result.user.uid, codename);
            }
            return { success: true };
        } catch (error) {
            console.error("Erro no login com Google:", error);
            return { success: false, error: error.message };
        }
    },

    async loginEmail(email, password) {
        try {
            await auth.signInWithEmailAndPassword(email, password);
            this.isGuest = false;
            return { success: true };
        } catch (error) {
            console.error("Erro ao fazer login:", error);
            return { success: false, error: error.message };
        }
    },

    async registerEmail(email, password, codename) {
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            this.isGuest = false;
            await this.saveDefaultData(userCredential.user.uid, codename);
            return { success: true };
        } catch (error) {
            console.error("Erro ao registrar:", error);
            return { success: false, error: error.message };
        }
    },

    logout() {
        auth.signOut();
        this.user = null;
        this.isGuest = true;
        
        // Parar o multiplayer caso esteja ativo
        if (typeof MultiplayerSystem !== 'undefined' && MultiplayerSystem.active) {
            MultiplayerSystem.stopOnline();
        }
        
        // Limpar dados na tela e carregar do localStorage
        if (typeof Game !== 'undefined') {
            Game.money = 0;
            const savedMoney = localStorage.getItem('cod_money');
            if (savedMoney) Game.money = parseInt(savedMoney);
            if (typeof HUD !== 'undefined') HUD.updateMoney(Game.money);
        }
        if (typeof WeaponSystem !== 'undefined') {
            const savedUnlocks = localStorage.getItem('cod_weapons');
            if (savedUnlocks) {
                try {
                    const unlocked = JSON.parse(savedUnlocks);
                    WeaponSystem.weapons.forEach((w, i) => {
                        w.unlocked = !!unlocked[i];
                    });
                } catch(e) {}
            }
        }
    },

    async saveDefaultData(uid, codename = null) {
        const defaultUnlocks = [true, false, false, false, false, false, false, true]; // M4A1 (0) e Faca (7)
        await db.collection("players").doc(uid).set({
            codename: codename || `Operador_${uid.slice(0, 5)}`,
            money: 0,
            highScore: 0,
            maxWave: 0,
            totalKills: 0,
            unlockedWeapons: defaultUnlocks,
            equippedSkin: "default",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    },

    async loadPlayerData() {
        if (!this.user) return null;
        try {
            const doc = await db.collection("players").doc(this.user.uid).get();
            if (doc.exists) {
                const data = doc.data();
                
                // Aplicar ao jogo local
                if (typeof Game !== 'undefined') {
                    Game.money = data.money !== undefined ? data.money : 0;
                    Game.highScore = data.highScore !== undefined ? data.highScore : 0;
                    if (typeof HUD !== 'undefined') HUD.updateMoney(Game.money);
                }

                // Sincronizar armas desbloqueadas
                if (typeof WeaponSystem !== 'undefined' && data.unlockedWeapons) {
                    WeaponSystem.weapons.forEach((w, i) => {
                        if (data.unlockedWeapons[i] !== undefined) {
                            w.unlocked = data.unlockedWeapons[i];
                        }
                    });
                    // Backup no localStorage
                    localStorage.setItem('cod_weapons', JSON.stringify(data.unlockedWeapons));
                }
                
                return data;
            } else {
                await this.saveDefaultData(this.user.uid);
                return {
                    money: 0,
                    highScore: 0,
                    unlockedWeapons: [true, false, false, false, false, false, false, true]
                };
            }
        } catch (error) {
            console.error("Erro ao carregar dados do Firestore:", error);
        }
    },

    async syncData(data) {
        if (!this.user || this.isGuest) {
            // Backup local
            if (data.money !== undefined) localStorage.setItem('cod_money', data.money);
            if (data.unlockedWeapons) localStorage.setItem('cod_weapons', JSON.stringify(data.unlockedWeapons));
            return;
        }

        try {
            const updateObj = {
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await db.collection("players").doc(this.user.uid).set(updateObj, { merge: true });
        } catch (error) {
            console.error("Erro ao sincronizar dados com o Firestore:", error);
        }
    }
};

window.FirebaseService = FirebaseService;
