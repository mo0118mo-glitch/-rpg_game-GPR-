document.addEventListener('DOMContentLoaded', () => {
    const shopModal = document.getElementById('shop-modal');
    const closeShopBtn = document.getElementById('close-shop-btn');
    const playerGoldEl = document.getElementById('player-gold');
    const itemListEl = document.getElementById('item-list');

    const shopItems = window.shopItems || [];

    function updateShopUI() {
        if (typeof player !== 'undefined') {
            playerGoldEl.textContent = player.gold || 0;
        }
    }

    function renderItems() {
        itemListEl.innerHTML = '';
        shopItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item-item';
            itemDiv.innerHTML = `
                <div>
                    <span>${item.name}</span>
                    <small>${item.description}</small>
                </div>
                <button class="buy-btn" data-item-id="${item.id}">${item.price} ${getTranslation('gold')}</button>
            `;
            itemListEl.appendChild(itemDiv);
        });
    }

    function buyItem(itemId) {
        const item = shopItems.find(i => i.id === itemId);
        if (!item || typeof player === 'undefined') return;

        if (player.gold < item.price) {
            alert(getTranslation('not_enough_gold'));
            return;
        }

        if (item.job) {
            const currentWeapon = Object.keys(player.inventory).find(key => shopItems.find(si => si.id === key && si.job === player.job));
            if (currentWeapon) {
                alert(getTranslation('already_have_weapon'));
                return;
            }
            if (player.job !== item.job) {
                alert(getTranslation('job_restricted_item', { job: getTranslation(item.job) }));
                return;
            }
            player.gold -= item.price;
            player.inventory[item.id] = 1;
            player.attack += item.attack;
            alert(getTranslation('item_purchased_attack_increase', { itemName: item.name, attack: item.attack }));
        } 
        else if (item.type === 'hp' || item.type === 'mana') {
            player.gold -= item.price;
            player.inventory[item.id] = (player.inventory[item.id] || 0) + 1;
            alert(getTranslation('item_purchased', { itemName: item.name }));
        } else {
            player.gold -= item.price;
            player.inventory[item.id] = (player.inventory[item.id] || 0) + 1;
            alert(getTranslation('item_purchased', { itemName: item.name }));
        }

        if (item.name === '진짜 GPR') {
            addOvalToWall('yellow');
        } else if (item.name === '푸른보석') {
            addOvalToWall('blue');
        }

        savePlayerState();
        updateShopUI();
    }

    function addOvalToWall(color) {
        const rightWall = document.getElementById('right-wall');
        if (rightWall) {
            const oval = document.createElement('div');
            oval.style.width = '20px';
            oval.style.height = '50px';
            oval.style.backgroundColor = color;
            oval.style.borderRadius = '50%';
            oval.style.margin = '10px';
            rightWall.appendChild(oval);
        }
    }

    function initShop() {
        updateShopUI();
        renderItems();
    }

    window.openShop = () => {
        if (typeof gamePaused !== 'undefined') gamePaused = true;
        shopModal.style.display = 'flex';
        initShop();
    };

    window.closeShop = () => {
        if (typeof gamePaused !== 'undefined') gamePaused = false;
        shopModal.style.display = 'none';
    };

    itemListEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('buy-btn')) {
            buyItem(e.target.dataset.itemId);
        }
    });

    if (closeShopBtn) {
        closeShopBtn.addEventListener('click', closeShop);
    }
});