document.addEventListener('DOMContentLoaded', () => {
    const shopModal = document.getElementById('shop-modal');
    const closeShopBtn = document.getElementById('close-shop-btn');
    const playerGoldEl = document.getElementById('player-gold');
    const itemListEl = document.getElementById('item-list');
    const buyTab = document.getElementById('buy-tab');
    const sellTab = document.getElementById('sell-tab');
    const buyView = document.getElementById('item-list');
    const sellView = document.getElementById('sell-view');
    const sellInventoryList = document.getElementById('sell-inventory-list');
    const sellDetails = document.getElementById('sell-details');
    const selectedSellItemName = document.getElementById('selected-sell-item-name');
    const sellPriceEl = document.getElementById('sell-price');
    const sellItemBtn = document.getElementById('sell-item-btn');
    const bargainBtn = document.getElementById('bargain-btn');

    const inventoryModal = document.getElementById('inventory-modal');
    const closeInventoryBtn = document.getElementById('close-inventory-btn');
    const inventoryList = document.getElementById('inventory-list');
    const backpackIcon = document.getElementById('backpack-icon');

    const shopItems = window.shopItems || [];
    let selectedSellItem = null;
    let currentSellPrice = 0;
    let bargainCount = 0;

    function updateShopUI() {
        if (typeof player !== 'undefined') {
            playerGoldEl.textContent = player.gold || 0;
        }
    }

    function renderBuyItems() {
        buyView.innerHTML = '';
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
            buyView.appendChild(itemDiv);
        });
    }

    function renderSellItems() {
        sellInventoryList.innerHTML = '';
        if (player.inventory.weapons.length === 0) {
            sellInventoryList.innerHTML = '<p>판매할 무기가 없습니다.</p>';
            return;
        }

        player.inventory.weapons.forEach((itemId, index) => {
            const item = shopItems.find(i => i.id === itemId);
            if (item) {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'sell-item';
                itemDiv.textContent = item.name;
                itemDiv.dataset.itemId = itemId;
                itemDiv.dataset.itemIndex = index;
                itemDiv.addEventListener('click', () => selectItemToSell(item, index));
                sellInventoryList.appendChild(itemDiv);
            }
        });
    }

    function selectItemToSell(item, index) {
        selectedSellItem = { ...item, index };
        bargainCount = 0;
        currentSellPrice = Math.floor(item.price / 2);

        selectedSellItemName.textContent = item.name;
        sellPriceEl.textContent = currentSellPrice;

        document.querySelectorAll('.sell-item').forEach(el => el.classList.remove('selected'));
        sellInventoryList.querySelector(`[data-item-index='${index}']`).classList.add('selected');

        sellDetails.style.display = 'block';
        bargainBtn.disabled = false;
    }

    function buyItem(itemId) {
        if (player.tradeBlockedUntil > Date.now()) {
            alert(`상인이 화가 나서 ${Math.ceil((player.tradeBlockedUntil - Date.now()) / 60000)}분 동안 거래를 거부합니다.`);
            return;
        }

        const item = shopItems.find(i => i.id === itemId);
        if (!item || typeof player === 'undefined') return;

        if (player.gold < item.price) {
            alert(getTranslation('not_enough_gold'));
            return;
        }

        if (item.id === 'blueGem') {
            player.gold -= item.price;
            player.unlocked_blue_jewel = true;
            alert(getTranslation('item_purchased', { itemName: item.name }));
        } else if (item.job) { // 무기 구매
            if (player.inventory.weapons.length >= 10) {
                alert('무기 인벤토리가 가득 찼습니다.');
                return;
            }
            player.gold -= item.price;
            player.inventory.weapons.push(item.id);
            alert(getTranslation('item_purchased', { itemName: item.name }));
        } else { // 포션 등 기타 아이템 구매
            player.gold -= item.price;
            player.inventory[item.id] = (player.inventory[item.id] || 0) + 1;
            alert(getTranslation('item_purchased', { itemName: item.name }));
        }

        savePlayerState();
        updateShopUI();
        renderInventory();
    }

    function sellItem() {
        if (!selectedSellItem) return;

        if (player.tradeBlockedUntil > Date.now()) {
            alert(`상인이 화가 나서 ${Math.ceil((player.tradeBlockedUntil - Date.now()) / 60000)}분 동안 거래를 거부합니다.`);
            return;
        }

        player.gold += currentSellPrice;
        player.inventory.weapons.splice(selectedSellItem.index, 1);

        alert(`${selectedSellItem.name}을(를) ${currentSellPrice} 골드에 판매했습니다.`);

        selectedSellItem = null;
        sellDetails.style.display = 'none';
        renderSellItems();
        updateShopUI();
        renderInventory();
        savePlayerState();
    }

    function bargain() {
        if (!selectedSellItem) return;

        const successChance = 1 / (2 ** (bargainCount + 1));

        if (Math.random() < successChance) {
            const newPrice = Math.floor(currentSellPrice * 1.2);

            if (newPrice > selectedSellItem.price * 1.05) {
                alert('상인이 당신의 탐욕에 화가 나 거래를 거부합니다! (10분간 거래 불가)');
                player.tradeBlockedUntil = Date.now() + 10 * 60 * 1000;
                closeShop();
                return;
            }

            currentSellPrice = newPrice;
            sellPriceEl.textContent = currentSellPrice;
            bargainCount++;
            alert(`흥정 성공! 새로운 가격: ${currentSellPrice} 골드 (다음 성공 확률: ${((1 / (2 ** (bargainCount + 1)))*100).toFixed(2)}%)`);
        } else {
            alert('흥정에 실패했습니다. 더 이상 이 아이템에 대해 흥정할 수 없습니다.');
            bargainBtn.disabled = true;
        }
    }

    function switchTab(tab) {
        if (tab === 'buy') {
            buyTab.classList.add('active');
            sellTab.classList.remove('active');
            buyView.style.display = 'block';
            sellView.style.display = 'none';
            renderBuyItems();
        } else {
            sellTab.classList.add('active');
            buyTab.classList.remove('active');
            sellView.style.display = 'block';
            buyView.style.display = 'none';
            selectedSellItem = null;
            sellDetails.style.display = 'none';
            renderSellItems();
        }
    }

    function renderInventory() {
        inventoryList.innerHTML = '';
        // 무기 아이템 채우기
        for (let i = 0; i < 10; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            const itemId = player.inventory.weapons[i];
            if (itemId) {
                const item = shopItems.find(shopItem => shopItem.id === itemId);
                if (item) {
                    // 아이콘이 있다면 아이콘 표시, 없다면 이름 표시
                    // 예시로 그냥 이름만 표시합니다.
                    slot.innerHTML = `<span class="item-name">${item.name}</span>`;
                }
            } else {
                slot.innerHTML = `(비어 있음)`;
            }
            inventoryList.appendChild(slot);
        }
    }

    function openInventory() {
        gamePaused = true;
        renderInventory();
        inventoryModal.style.display = 'flex';
    }

    function closeInventory() {
        inventoryModal.style.display = 'none';
        gamePaused = false;
    }

    function initShop() {
        if (player.tradeBlockedUntil > Date.now()) {
            alert(`상인이 화가 나서 ${Math.ceil((player.tradeBlockedUntil - Date.now()) / 60000)}분 동안 거래를 거부합니다.`);
            closeShop();
            return;
        }
        updateShopUI();
        switchTab('buy');
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

    buyView.addEventListener('click', (e) => {
        if (e.target.classList.contains('buy-btn')) {
            buyItem(e.target.dataset.itemId);
        }
    });

    sellItemBtn.addEventListener('click', sellItem);
    bargainBtn.addEventListener('click', bargain);

    buyTab.addEventListener('click', () => switchTab('buy'));
    sellTab.addEventListener('click', () => switchTab('sell'));

    if (closeShopBtn) {
        closeShopBtn.addEventListener('click', closeShop);
    }

    // 인벤토리 관련 이벤트
    if (backpackIcon) {
        backpackIcon.addEventListener('click', openInventory);
    }
    if (closeInventoryBtn) {
        closeInventoryBtn.addEventListener('click', closeInventory);
    }
});
