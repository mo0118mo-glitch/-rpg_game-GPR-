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
                <button class="buy-btn" data-item-id="${item.id}">${item.price} 골드</button>
            `;
            itemListEl.appendChild(itemDiv);
        });
    }

    function buyItem(itemId) {
        const item = shopItems.find(i => i.id === itemId);
        if (!item || typeof player === 'undefined') return;

        if (player.gold < item.price) {
            alert("골드가 부족합니다.");
            return;
        }

        // Handle weapons
        if (item.job) {
            // Check if player already has a weapon for this job
            const currentWeapon = Object.keys(player.inventory).find(key => shopItems.find(si => si.id === key && si.job === player.job));
            if (currentWeapon) {
                alert("이미 해당 직업의 무기를 소지하고 있습니다. 먼저 판매하거나 다른 무기를 선택하세요.");
                return;
            }
            if (player.job !== item.job) {
                alert("이 아이템은 '" + item.job + "' 직업만 구매할 수 있습니다.");
                return;
            }
            player.gold -= item.price;
            player.inventory[item.id] = 1; // Assume only one weapon of each type
            player.attack += item.attack; // Add weapon's attack to player's base attack
            alert(`${item.name}을(를) 구매했습니다! 공격력이 ${item.attack} 증가했습니다.`);
        } 
        // Handle potions
        else if (item.type === 'hp' || item.type === 'mana') {
            player.gold -= item.price;
            player.inventory[item.id] = (player.inventory[item.id] || 0) + 1;
            alert(`${item.name}을(를) 구매했습니다!`);
        }
        savePlayerState(); // Save player state after purchase
        updateShopUI();
    }

    function initShop() {
        updateShopUI();
        renderItems();
    }

    // game.js에서 호출할 수 있도록 window 객체에 함수를 할당합니다.
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