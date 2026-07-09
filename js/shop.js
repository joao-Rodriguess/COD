// ============================
// SHOP SYSTEM - Handling weapon purchases
// ============================

const Shop = {
    init() {
        const grid = document.getElementById('shop-grid');
        if (!grid) return;

        // Clear existing
        grid.innerHTML = '';

        if (typeof WeaponSystem === 'undefined' || !WeaponSystem.weapons) return;

        WeaponSystem.weapons.forEach((weapon, index) => {
            // Faca e Pistola (unlocked defaults) don't need to show price or be bought, but we can show them as purchased
            const isDefault = weapon.price === 0 || weapon.type === 'knife' || weapon.type === 'pistol';
            const purchased = weapon.unlocked;

            const div = document.createElement('div');
            div.className = `shop-item ${purchased ? 'purchased' : ''}`;
            
            const btnText = purchased ? 'ADQUIRIDO' : `COMPRAR ($${weapon.price})`;
            const btnState = purchased ? 'disabled' : '';

            div.innerHTML = `
                <h3>${weapon.name}</h3>
                <div class="price">${purchased ? '✓' : '$' + weapon.price}</div>
                <button ${btnState} data-index="${index}">${btnText}</button>
            `;

            grid.appendChild(div);
        });

        // Add event listeners
        const btns = grid.querySelectorAll('button');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                this.purchase(idx);
            });
        });
        
        const closeBtn = document.getElementById('btn-close-shop');
        if (closeBtn && !closeBtn.dataset.listener) {
            closeBtn.addEventListener('click', () => {
                this.close();
            });
            closeBtn.dataset.listener = "true";
        }
    },

    open() {
        this.init(); // Refresh grid
        document.getElementById('shop-panel').style.display = 'flex';
        if (typeof Game !== 'undefined') {
            document.getElementById('shop-money-display').textContent = Game.money;
        }
    },

    close() {
        document.getElementById('shop-panel').style.display = 'none';
    },

    purchase(index) {
        const weapon = WeaponSystem.weapons[index];
        if (!weapon || weapon.unlocked) return;

        if (Game.spendMoney(weapon.price)) {
            weapon.unlocked = true;
            this.saveUnlocks();
            this.init(); // Refresh the UI to show purchased
            if (typeof AudioManager !== 'undefined') AudioManager.playReload(); // simple sound for purchase
            if (typeof HUD !== 'undefined') HUD.addKillFeed(`Arma desbloqueada: ${weapon.name}`);
        }
    },

    saveUnlocks() {
        const unlocked = WeaponSystem.weapons.map(w => w.unlocked);
        localStorage.setItem('cod_weapons', JSON.stringify(unlocked));
        if (typeof FirebaseService !== 'undefined') {
            FirebaseService.syncData({ unlockedWeapons: unlocked });
        }
    }
};

window.Shop = Shop;
