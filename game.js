const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 설정 ---
const tileSize = 40;
const MONSTER_RESPAWN_TIME = 10000;

// --- 키 설정 ---
const defaultKeyMap = {
    up: 'w',
    down: 's',
    left: 'a',
    right: 'd',
    attack: 'mouse0',
    interact: 'e',
    potion: 'p',
    weakSkill: '1',
    strongSkill: '2',
    ultimateSkill: '3'
};
let keyMap = { ...defaultKeyMap };
const actionState = {};

const actionTranslations = {
    up: '위로',
    down: '아래로',
    left: '왼쪽',
    right: '오른쪽',
    attack: '공격',
    interact: '상호작용',
    potion: '물약',
    weakSkill: '약한 스킬',
    strongSkill: '강한 스킬',
    ultimateSkill: '궁극기'
};

function getKeyDisplayName(key) {
    if (key === 'mouse0') return '좌클릭';
    if (key === 'mouse2') return '우클릭';
    return key.toUpperCase();
}

// --- 게임 데이터 ---
let currentMapId = 'overworld';
let gamePaused = false;

const player = {
    x: 0, y: 0, // 시작 위치는 init에서 설정
    width: 32, height: 32, color: 'white', speed: 4, hp: 100, maxHp: 100, 
    mana: 50, maxMana: 50, manaRegenTimer: 0,
    ultimateGauge: 0, maxUltimateGauge: 100,
    level: 1,
    maxLevel: 50,
    exp: 0,
    requiredExp: 10,
    job: '무직',
    nickname: 'Player',
    attack: 1, 
    gold: 0, 
    inventory: { potion: 0, smallPotion: 0 }, 
    lastDirection: 'right', 
    attackCooldown: 0, 
    damageCooldown: 0,
    returnPos: { x: 0, y: 0 }, // 던전에서 돌아올 위치
    skills: { weak: null, strong: null, ultimate: null },
    skillCooldowns: { weak: 0, strong: 0, ultimate: 0 },
    buffs: []
};

let monsters = [];
const deadMonsters = [];
const activeAttacks = [];
const activeGroundEffects = [];
const camera = { x: 0, y: 0, width: canvas.width, height: canvas.height };
let backgroundCanvas = null; // 오버월드 배경용



function createMap(cols, rows, wallProbability = 0) {
    const map = [];
    for (let y = 0; y < rows; y++) {
        const row = [];
        for (let x = 0; x < cols; x++) {
            if (y === 0 || y === rows - 1 || x === 0 || x === cols - 1 || (wallProbability > 0 && Math.random() < wallProbability)) {
                row.push(1); // Wall
            } else {
                row.push(0); // Floor
            }
        }
        map.push(row);
    }
    return map;
}

const maps = {
    overworld: {
        layout: createMap(100, 100),
        npcs: [
            { id: 1, name: '상인', x: (50 + 2) * tileSize, y: 50 * tileSize, width: 32, height: 32, color: 'purple', lastDirection: 'down' },
            { id: 2, name: '전직관', x: (50 + 8) * tileSize, y: 50 * tileSize, width: 32, height: 32, color: 'cyan', lastDirection: 'down' },
            { id: 4, name: '스킬관', x: (50 + 5) * tileSize, y: 50 * tileSize, width: 32, height: 32, color: 'yellow', lastDirection: 'down' },
            { id: 3, name: '삭제관', x: (50 + 14) * tileSize, y: 50 * tileSize, width: 32, height: 32, color: 'orange', lastDirection: 'down' }
        ],
        monsters: [],
        portals: [
            { name: '슬라임 동굴', x: (50 + 20) * tileSize, y: 50 * tileSize, targetMapId: 'slimeDungeon', targetX: 2 * tileSize, targetY: 17 * tileSize, color: '#696969' },
            { name: '고블린 동굴', x: (50 + 22) * tileSize, y: 50 * tileSize, targetMapId: 'goblinDungeon', targetX: 2 * tileSize, targetY: 17 * tileSize, color: '#696969' },
            { name: '오크 동굴', x: (50 + 24) * tileSize, y: 50 * tileSize, targetMapId: 'orcDungeon', targetX: 2 * tileSize, targetY: 17 * tileSize, color: '#696969' },
            { name: '아종의 동굴', x: (50 + 26) * tileSize, y: 50 * tileSize, targetMapId: 'subspeciesDungeon', targetX: 2 * tileSize, targetY: 22 * tileSize, color: 'black' },
        ]
    },
    slimeDungeon: {
        layout: createMap(20, 20, 0),
        npcs: [],
        monsters: [{ type: initialMonsters.slime, count: 5 }],
        portals: [{ name: '출구', x: 2 * tileSize, y: 18 * tileSize, targetMapId: 'overworld', targetX: -1, targetY: -1, color: 'lightblue' }]
    },
    goblinDungeon: {
        layout: createMap(20, 20, 0),
        npcs: [],
        monsters: [{ type: initialMonsters.goblin, count: 5 }],
        portals: [{ name: '출구', x: 2 * tileSize, y: 18 * tileSize, targetMapId: 'overworld', targetX: -1, targetY: -1, color: 'lightblue' }]
    },
    orcDungeon: {
        layout: createMap(20, 20, 0),
        npcs: [],
        monsters: [{ type: initialMonsters.orc, count: 5 }],
        portals: [{ name: '출구', x: 2 * tileSize, y: 18 * tileSize, targetMapId: 'overworld', targetX: -1, targetY: -1, color: 'lightblue' }]
    },
    subspeciesDungeon: {
        layout: createMap(25, 25, 0),
        npcs: [],
        monsters: [
            { type: subspeciesMonsters.slime, count: 1 },
            { type: subspeciesMonsters.goblin, count: 1 },
            { type: subspeciesMonsters.orc, count: 1 }
        ],
        portals: [{ name: '출구', x: 2 * tileSize, y: 23 * tileSize, targetMapId: 'overworld', targetX: -1, targetY: -1, color: 'lightblue' }]
    }
};

// --- 입력 처리 ---
let changingKeyFor = null;

function handleInput(key, isDown) {
    for (const action in keyMap) {
        if (key === keyMap[action]) {
            actionState[action] = isDown;
        }
    }
}

window.addEventListener('keydown', (e) => {
    if (changingKeyFor) {
        e.preventDefault();
        const newKey = e.key.toLowerCase();
        if (Object.values(keyMap).includes(newKey)) {
            alert('이미 사용 중인 키입니다!');
            populateKeybindList();
            changingKeyFor = null;
            return;
        }
        keyMap[changingKeyFor] = newKey;
        saveKeyMap();
        changingKeyFor = null;
        populateKeybindList();
    } else {
        handleInput(e.key.toLowerCase(), true);
    }
});

window.addEventListener('keyup', (e) => {
    if (!changingKeyFor) {
        handleInput(e.key.toLowerCase(), false);
    }
});

window.addEventListener('mousedown', (e) => {
    // Prevent context menu everywhere, especially for keybinding
    if (e.button === 2) {
        e.preventDefault();
    }

    if (changingKeyFor) {
        // We are waiting for a keybind change
        e.preventDefault();
        const newKey = `mouse${e.button}`;
        if (Object.values(keyMap).includes(newKey)) {
            alert('이미 사용 중인 키입니다!');
            populateKeybindList(); // Reset button text
            changingKeyFor = null;
            return;
        }
        keyMap[changingKeyFor] = newKey;
        saveKeyMap();
        changingKeyFor = null;
        populateKeybindList();
    } else {
        // Not changing a key, handle as game input only if clicking on the canvas
        if (e.target === canvas) {
            handleInput(`mouse${e.button}`, true);
        }
    }
});

window.addEventListener('mouseup', (e) => {
    // Only handle game input if releasing on the canvas
    if (e.target === canvas) {
        handleInput(`mouse${e.button}`, false);
    }
});

// Prevent context menu on canvas, though handled in mousedown now
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// --- 그리기 함수 ---
function createOverworldBackground() {
    const map = maps.overworld;
    const mapWidth = map.layout[0].length * tileSize;
    const mapHeight = map.layout.length * tileSize;
    backgroundCanvas = document.createElement('canvas');
    backgroundCanvas.width = mapWidth;
    backgroundCanvas.height = mapHeight;
    const bgCtx = backgroundCanvas.getContext('2d');
    const lightGreen = '#90EE90';
    const darkGreen = '#90EE90';
    for (let y = 0; y < mapHeight; y += 4) {
        for (let x = 0; x < mapWidth; x += 4) {
            bgCtx.fillStyle = Math.random() < 0.5 ? lightGreen : darkGreen;
            bgCtx.fillRect(x, y, 4, 4);
        }
    }
}

function drawDirectionDots(ctx, character) {
    ctx.fillStyle = 'black';
    const dotSize = 3;
    const gap = 5;
    const spread = 8;
    let x1, y1, x2, y2;
    switch (character.lastDirection) {
        case 'up': x1 = character.x + character.width / 2 - spread / 2; y1 = character.y + gap; x2 = character.x + character.width / 2 + spread / 2; y2 = character.y + gap; break;
        case 'down': x1 = character.x + character.width / 2 - spread / 2; y1 = character.y + character.height - gap; x2 = character.x + character.width / 2 + spread / 2; y2 = character.y + character.height - gap; break;
        case 'left': x1 = character.x + gap; y1 = character.y + character.height / 2 - spread / 2; x2 = character.x + gap; y2 = character.y + character.height / 2 + spread / 2; break;
        case 'right': x1 = character.x + character.width - gap; y1 = character.y + character.height / 2 - spread / 2; x2 = character.x + character.width - gap; y2 = character.y + character.height / 2 + spread / 2; break;
        default: return;
    }
    ctx.fillRect(x1 - dotSize / 2, y1 - dotSize / 2, dotSize, dotSize);
    ctx.fillRect(x2 - dotSize / 2, y2 - dotSize / 2, dotSize, dotSize);
}

function drawWindow(x, y, size) {
    const frameColor = '#654321';
    const glassColor = '#ADD8E6';
    ctx.fillStyle = glassColor;
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = 5;
    ctx.strokeRect(x, y, size, size);
    ctx.beginPath();
    ctx.moveTo(x + size / 2, y);
    ctx.lineTo(x + size / 2, y + size);
    ctx.moveTo(x, y + size / 2);
    ctx.lineTo(x + size, y + size / 2);
    ctx.stroke();
}

function drawHouse(npc) {
    const houseWidth = tileSize * 4;
    const houseHeight = tileSize * 3;
    const houseX = npc.x + npc.width / 2 - houseWidth / 2;
    const houseY = npc.y + npc.height / 2 - houseHeight / 1.5;
    ctx.fillStyle = '#FBCEB1';
    ctx.fillRect(houseX, houseY, houseWidth, houseHeight);
    const roofHeight = tileSize * 2;
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.moveTo(houseX - 10, houseY);
    ctx.lineTo(houseX + houseWidth + 10, houseY);
    ctx.lineTo(houseX + houseWidth / 2, houseY - roofHeight);
    ctx.closePath();
    ctx.fill();
    const doorWidth = tileSize;
    const doorHeight = tileSize * 1.5;
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(houseX + houseWidth * 0.25 - doorWidth / 2, houseY + houseHeight - doorHeight, doorWidth, doorHeight);
    const windowSize = tileSize * 0.8;
    drawWindow(houseX + houseWidth * 0.75 - windowSize / 2, houseY + tileSize * 0.5, windowSize);
}

function draw() {
    if (gamePaused) return;
    const map = maps[currentMapId];
    const mapHeight = map.layout.length * tileSize;
    const mapWidth = map.layout[0].length * tileSize;

    camera.x = player.x - (canvas.width / 2);
    camera.y = player.y - (canvas.height / 2);
    camera.x = Math.max(0, Math.min(camera.x, mapWidth - canvas.width));
    camera.y = Math.max(0, Math.min(camera.y, mapHeight - canvas.height));

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Draw background & map
    if (currentMapId === 'overworld' && backgroundCanvas) {
        ctx.drawImage(backgroundCanvas, 0, 0);
    } else {
        const wallColor = '#5C4033';
        const floorColor = '#90EE90';
        const startCol = Math.floor(camera.x / tileSize), endCol = Math.min(startCol + (canvas.width / tileSize) + 2, map.layout[0].length);
        const startRow = Math.floor(camera.y / tileSize), endRow = Math.min(startRow + (canvas.height / tileSize) + 2, map.layout.length);
        for (let row = startRow; row < endRow; row++) {
            for (let col = startCol; col < endCol; col++) {
                if (map.layout[row] && map.layout[row][col] === 1) {
                    ctx.fillStyle = wallColor;
                } else {
                    ctx.fillStyle = floorColor;
                }
                ctx.fillRect(col * tileSize, row * tileSize, tileSize, tileSize);
            }
        }
    }

    // Draw portals
    map.portals.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, tileSize, tileSize);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, p.x + tileSize / 2, p.y - 5);
    });

    // Draw houses
    if (map.npcs) {
        const npcsWithHouses = ['상인', '전직관', '삭제관'];
        map.npcs.forEach(npc => {
            if (npcsWithHouses.includes(npc.name)) drawHouse(npc);
        });
    }

    // Draw game objects
    activeAttacks.forEach(attack => {
        ctx.fillStyle = attack.color || `rgba(255, 0, 0, ${attack.alpha})`;
        if (attack.isCircular) {
            ctx.beginPath();
            ctx.arc(attack.x + attack.width / 2, attack.y + attack.height / 2, attack.width / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (attack.isProjectile && attack.rotationSpeed) { // 단검던지기
            ctx.save();
            ctx.translate(attack.x + attack.width / 2, attack.y + attack.height / 2);
            ctx.rotate(attack.rotation * Math.PI / 180); // Convert degrees to radians
            ctx.fillRect(-attack.width / 2, -attack.height / 2, attack.width, attack.height);
            ctx.restore();
        } else {
            ctx.fillRect(attack.x, attack.y, attack.width, attack.height);
        }
    });
    activeGroundEffects.forEach(effect => {
        ctx.fillStyle = effect.color;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.fill();
    });
    monsters.forEach(m => {
        ctx.fillStyle = m.color;
        ctx.fillRect(m.x, m.y, m.width, m.height);
        drawDirectionDots(ctx, m);
        ctx.fillStyle = 'red';
        ctx.fillRect(m.x, m.y - 10, m.width, 5);
        ctx.fillStyle = 'lime';
        ctx.fillRect(m.x, m.y - 10, m.width * (m.hp / m.maxHp), 5);
    });
    if (map.npcs) {
        map.npcs.forEach(npc => {
            ctx.fillStyle = npc.color;
            ctx.fillRect(npc.x, npc.y, npc.width, npc.height);
            drawDirectionDots(ctx, npc);
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.fillText(npc.name, npc.x + npc.width / 2, npc.y - 5);
        });
    }
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    drawDirectionDots(ctx, player);

    // Draw nickname
    if (player.nickname) {
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = '14px Arial';
        ctx.fillText(player.nickname, player.x + player.width / 2, player.y - 10);
    }

    ctx.restore();

    // Draw UI
    ctx.fillStyle = 'white';
    ctx.font = '18px Arial';
    let uiY = 35;
    const uiX = 10;
    const lineHeight = 35;
    ctx.fillText(`Level: ${player.level}`, uiX, uiY);
    uiY += lineHeight;
    ctx.fillText(`EXP: ${player.exp} / ${player.requiredExp}`, uiX, uiY);
    uiY += lineHeight;
    ctx.fillText(`HP: ${player.hp} / ${player.maxHp}`, uiX, uiY);
    uiY += 10;
    ctx.fillStyle = 'gray';
    ctx.fillRect(uiX, uiY, 200, 10);
    ctx.fillStyle = 'red';
    ctx.fillRect(uiX, uiY, 200 * (player.hp / player.maxHp), 10);
    uiY += 25;
    ctx.fillStyle = 'white';
    ctx.fillText(`Mana: ${player.mana} / ${player.maxMana}`, uiX, uiY);
    uiY += 10;
    ctx.fillStyle = 'gray';
    ctx.fillRect(uiX, uiY, 200, 10);
    ctx.fillStyle = 'blue';
    ctx.fillRect(uiX, uiY, 200 * (player.mana / player.maxMana), 10);
    uiY += 25;
    ctx.fillStyle = 'white';
    ctx.fillText(`Ultimate: ${player.ultimateGauge} / ${player.maxUltimateGauge}`, uiX, uiY);
    uiY += 10;
    ctx.fillStyle = 'gray';
    ctx.fillRect(uiX, uiY, 200, 10);
    ctx.fillStyle = 'yellow';
    ctx.fillRect(uiX, uiY, 200 * (player.ultimateGauge / player.maxUltimateGauge), 10);
    uiY += 25;
    uiY += lineHeight;
    ctx.fillText(`Gold: ${player.gold}`, uiX, uiY);
    uiY += lineHeight;
    ctx.fillText(`직업: ${player.job}`, uiX, uiY);
    uiY += lineHeight;
    ctx.fillText(`Potions: ${getKeyDisplayName(keyMap.potion)} key`, uiX, uiY);
}

// --- 업데이트 로직 ---
function levelUp() {
    if (player.level >= player.maxLevel) {
        player.exp = 0; // 만렙이면 경험치 초기화 또는 최대치로 고정
        return;
    }
    while (player.exp >= player.requiredExp && player.level < player.maxLevel) {
        player.level++;
        player.attack++;
        player.exp -= player.requiredExp;
        player.requiredExp = Math.floor(player.requiredExp * 1.5);
    }
    if (player.level >= player.maxLevel) {
        player.exp = 0;
    }
}

function gainExp(amount) {
    player.exp += amount;
    if (player.exp >= player.requiredExp) levelUp();
}

function changeMap(portal) {
    if (portal.targetMapId === 'overworld') {
        player.x = (maps.overworld.layout[0].length / 2) * tileSize;
        player.y = (maps.overworld.layout.length / 2) * tileSize;
    } else {
        player.returnPos = { x: player.x, y: player.y };
        player.x = portal.targetX;
        player.y = portal.targetY;
    }
    currentMapId = portal.targetMapId;
    spawnMonsters();
}

function spawnMonsters() {
    monsters = [];
    deadMonsters.length = 0;
    const map = maps[currentMapId];
    if (!map.monsters) return;

    map.monsters.forEach(monsterInfo => {
        for (let i = 0; i < monsterInfo.count; i++) {
            const newMonster = { ...monsterInfo.type };
            let placed = false;
            while (!placed) {
                const x = Math.floor(Math.random() * map.layout[0].length) * tileSize;
                const y = Math.floor(Math.random() * map.layout.length) * tileSize;
                const tileX = Math.floor(x / tileSize);
                const tileY = Math.floor(y / tileSize);
                if (map.layout[tileY][tileX] === 0) {
                    newMonster.x = x;
                    newMonster.y = y;
                    placed = true;
                }
            }
            monsters.push(newMonster);
        }
    });
}

function update() {
    if (gamePaused) return;
    const now = Date.now();

    // Cooldowns & Regen
    if (player.attackCooldown > 0) player.attackCooldown -= 16;
    for (const type in player.skillCooldowns) {
        if (player.skillCooldowns[type] > 0) {
            player.skillCooldowns[type] -= 16;
        }
    }
    player.manaRegenTimer += 16;
    if (player.manaRegenTimer >= 3000) {
        if (player.mana < player.maxMana) {
            player.mana++;
        }
        player.manaRegenTimer = 0;
    }

    // Player Movement & Portal Collision
    let nextX = player.x, nextY = player.y;
    if (actionState.up) { nextY -= player.speed; player.lastDirection = 'up'; }
    if (actionState.down) { nextY += player.speed; player.lastDirection = 'down'; }
    if (actionState.left) { nextX -= player.speed; player.lastDirection = 'left'; }
    if (actionState.right) { nextX += player.speed; player.lastDirection = 'right'; }

    const currentMap = maps[currentMapId];
    const targetTileX = Math.floor((nextX + player.width / 2) / tileSize);
    const targetTileY = Math.floor((nextY + player.height / 2) / tileSize);

    if (currentMap.layout[targetTileY] && currentMap.layout[targetTileY][targetTileX] === 0) {
        player.x = nextX;
        player.y = nextY;
    }

    currentMap.portals.forEach(p => {
        if (isColliding(player, {x: p.x, y: p.y, width: tileSize, height: tileSize})) {
            changeMap(p);
        }
    });

    // Other updates
    if (actionState.interact) {
        if(currentMap.npcs) {
            for (const npc of currentMap.npcs) {
                if (isNear(player, npc, 20)) {
                    interactWithNpc(npc);
                    break;
                }
            }
        }
        actionState.interact = false;
    }
    if (actionState.attack) {
        handlePlayerAttack();
        actionState.attack = false;
    }
    if (actionState.potion) {
        openPotionModal();
        actionState.potion = false;
    }

    if (actionState.weakSkill) {
        useSkill('weak');
        actionState.weakSkill = false;
    }
    if (actionState.strongSkill) {
        useSkill('strong');
        actionState.strongSkill = false;
    }
    if (actionState.ultimateSkill) {
        useSkill('ultimate');
        actionState.ultimateSkill = false;
    }

    // Update and apply attacks
    for (let i = activeAttacks.length - 1; i >= 0; i--) {
        const attack = activeAttacks[i];
        const elapsed = now - attack.createdAt;

        if (attack.isProjectile) {
            attack.x += attack.dx;
            attack.y += attack.dy;
            if (attack.rotationSpeed) {
                attack.rotation += attack.rotationSpeed * 16; // 16ms per frame
            }
        }

        monsters.forEach(monster => {
            if (isColliding(attack, monster) && !attack.hitMonsters.includes(monster.id)) {
                monster.hp -= attack.damage;
                if (!attack.piercing) {
                    attack.hitMonsters.push(monster.id);
                }
                if (monster.hp <= 0) {
                    player.gold += monster.gold;
                    gainExp(monster.exp);
                    deadMonsters.push({ ...monster, diedAt: now });
                    monsters = monsters.filter(m => m.id !== monster.id);
                }
            }
        });

        if (elapsed >= attack.duration) {
            activeAttacks.splice(i, 1);
        }
    }

    // Update and apply ground effects
    for (let i = activeGroundEffects.length - 1; i >= 0; i--) {
        const effect = activeGroundEffects[i];
        const elapsed = now - effect.createdAt;
        effect.alpha = 0.5 * (1 - elapsed / effect.duration); // Fade out

        if (elapsed >= effect.duration) {
            activeGroundEffects.splice(i, 1);
        } else {
            // Apply DoT
            if (now - effect.lastDamageTime >= 1000) { // Every 1 second
                monsters.forEach(monster => {
                    const effectCenterX = effect.x;
                    const effectCenterY = effect.y;
                    const monsterCenterX = monster.x + monster.width / 2;
                    const monsterCenterY = monster.y + monster.height / 2;
                    const distance = Math.sqrt(Math.pow(effectCenterX - monsterCenterX, 2) + Math.pow(effectCenterY - monsterCenterY, 2));

                    if (distance < (effect.radius + monster.width / 2)) {
                        // Check if monster has been hit by this specific DoT instance recently
                        const lastHit = effect.hitMonsters.find(h => h.id === monster.id);
                        if (!lastHit || (now - lastHit.time) >= effect.dotDuration) { // Reset duration if hit again
                            monster.hp -= effect.damagePerSecond;
                            if (lastHit) {
                                lastHit.time = now;
                            }
                            if (monster.hp <= 0) {
                                player.gold += monster.gold;
                                gainExp(monster.exp);
                                deadMonsters.push({ ...monster, diedAt: now });
                                monsters = monsters.filter(m => m.id !== monster.id); // Remove dead monster
                            }
                        }
                    }
                });
                effect.lastDamageTime = now;
            }
        }
    }

    if (player.damageCooldown > 0) player.damageCooldown -= 16;
    monsters.forEach(monster => {
        const dx = player.x - monster.x, dy = player.y - monster.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const stealthBuff = player.buffs.find(buff => buff.type === 'stealth');
        if (stealthBuff) {
            // 몬스터가 플레이어를 무시
            return;
        }

        if (distance < monster.detectionRange) {
            monster.x += (dx / distance) * monster.speed;
            monster.y += (dy / distance) * monster.speed;
        }
        if (isColliding(player, monster) && player.damageCooldown <= 0) {
            let damageTaken = monster.attack;
            // Apply Holy Armor buff
            const holyArmorBuff = player.buffs.find(buff => buff.type === 'holyArmor');
            if (holyArmorBuff) {
                damageTaken *= (1 - holyArmorBuff.damageReduction);
            }
            player.hp -= damageTaken;
            player.damageCooldown = 1000;
            if (player.hp <= 0) { alert("게임 오버"); document.location.reload(); }
        }
    });

    // Update and draw buffs
    for (let i = player.buffs.length - 1; i >= 0; i--) {
        const buff = player.buffs[i];
        if (Date.now() - buff.createdAt >= buff.duration) {
            player.buffs.splice(i, 1);
        }
    }

    for (let i = deadMonsters.length - 1; i >= 0; i--) {
        if (now - deadMonsters[i].diedAt >= MONSTER_RESPAWN_TIME) {
            const monsterToRespawn = { ...deadMonsters[i] };
            monsterToRespawn.hp = monsterToRespawn.maxHp;
            monsters.push(monsterToRespawn);
            deadMonsters.splice(i, 1);
        }
    }
    
    savePlayerState();
}

function handlePlayerAttack() {
    if (player.attackCooldown > 0) return;
    player.attackCooldown = 500;
    const attackRange = 100, attackSize = 30;
    let attack = { x: player.x + player.width / 2 - attackSize / 2, y: player.y + player.height / 2 - attackSize / 2, width: attackSize, height: attackSize, alpha: 0.5, createdAt: Date.now(), duration: 200, damage: player.attack, hitMonsters: [] };
    switch (player.lastDirection) {
        case 'up': attack.y -= attackRange / 2; attack.width = attackSize * 2; attack.height = attackRange; break;
        case 'down': attack.y += attackRange / 2; attack.width = attackSize * 2; attack.height = attackRange; break;
        case 'left': attack.x -= attackRange / 2; attack.width = attackRange; attack.height = attackSize * 2; break;
        case 'right': attack.x += attackRange / 2; attack.width = attackRange; attack.height = attackSize * 2; break;
    }
    activeAttacks.push(attack);
    player.ultimateGauge = Math.min(player.maxUltimateGauge, player.ultimateGauge + 1);
}

function useSkill(skillType) {
    const skill = player.skills[skillType];
    if (!skill) return; // 스킬을 배우지 않음
    if (player.skillCooldowns[skillType] > 0) return; // 쿨타임
    if (player.mana < skill.manaCost) {
        alert('마나가 부족합니다!');
        return;
    }

    if (skillType === 'ultimate' && player.ultimateGauge < player.maxUltimateGauge) {
        alert('궁극기 게이지가 부족합니다!');
        return;
    }

    player.mana -= skill.manaCost;
    player.skillCooldowns[skillType] = skill.cooldown;

    if (skillType === 'weak') {
        player.ultimateGauge = Math.min(player.maxUltimateGauge, player.ultimateGauge + 5);
    } else if (skillType === 'strong') {
        player.ultimateGauge = Math.min(player.maxUltimateGauge, player.ultimateGauge + 20);
    } else if (skillType === 'ultimate') {
        player.ultimateGauge = 0; // 궁극기 사용 시 게이지 소모
    }

    if (skill.heal) {
        player.hp = Math.min(player.maxHp, player.hp + skill.heal);
    }

    if (skill.damage) {
        let attack = {};
        const baseAttackSize = 30;
        const baseAttackRange = 100;

        if (player.job === '검사') {
            if (skillType === 'weak') { // 가로배기
                attack = {
                    x: player.x + player.width / 2 - baseAttackSize * 1.5,
                    y: player.y + player.height / 2 - baseAttackSize * 1.5,
                    width: baseAttackSize * 3,
                    height: baseAttackSize * 3,
                    alpha: 0.8,
                    createdAt: Date.now(),
                    duration: 200,
                    hitMonsters: [],
                    damage: player.attack + skill.damage,
                    isSkill: true,
                    color: 'rgba(255, 165, 0, 0.8)' // 주황색
                };
                // Adjust for direction
                switch (player.lastDirection) {
                    case 'up': attack.y -= baseAttackSize * 2; attack.height = baseAttackSize * 4; break;
                    case 'down': attack.y += baseAttackSize * 2; attack.height = baseAttackSize * 4; break;
                    case 'left': attack.x -= baseAttackSize * 2; attack.width = baseAttackSize * 4; break;
                    case 'right': attack.x += baseAttackSize * 2; attack.width = baseAttackSize * 4; break;
                }
            } else if (skillType === 'strong') { // 강타
                // Find closest monster
                let closestMonster = null;
                let minDistance = Infinity;
                monsters.forEach(m => {
                    const dist = Math.sqrt(Math.pow(player.x - m.x, 2) + Math.pow(player.y - m.y, 2));
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestMonster = m;
                    }
                });

                if (closestMonster) {
                    attack = {
                        x: closestMonster.x,
                        y: closestMonster.y,
                        width: closestMonster.width,
                        height: closestMonster.height,
                        alpha: 0.9,
                        createdAt: Date.now(),
                        duration: 150,
                        hitMonsters: [],
                        damage: player.attack + skill.damage,
                        isSkill: true,
                        color: 'rgba(255, 0, 0, 0.9)' // 빨간색
                    };
                } else {
                    // No monster to hit, refund mana and cooldown
                    player.mana += skill.manaCost;
                    player.skillCooldowns[skillType] = 0;
                    return;
                }
            } else if (skillType === 'ultimate') { // 회전베기
                attack = {
                    x: player.x - baseAttackSize * 2,
                    y: player.y - baseAttackSize * 2,
                    width: baseAttackSize * 5,
                    height: baseAttackSize * 5,
                    alpha: 0.7,
                    createdAt: Date.now(),
                    duration: 400,
                    hitMonsters: [],
                    damage: player.attack + skill.damage,
                    isSkill: true,
                    color: 'rgba(100, 0, 255, 0.7)', // 보라색
                    isCircular: true // 원형 공격임을 표시
                };
            }
        } else if (player.job === '마법사') {
            if (skillType === 'weak') { // 파이어볼
                const projectileSpeed = 10;
                let dx = 0, dy = 0;
                switch (player.lastDirection) {
                    case 'up': dy = -projectileSpeed; break;
                    case 'down': dy = projectileSpeed; break;
                    case 'left': dx = -projectileSpeed; break;
                    case 'right': dx = projectileSpeed; break;
                }
                attack = {
                    x: player.x + player.width / 2 - 10,
                    y: player.y + player.height / 2 - 10,
                    width: 20,
                    height: 20,
                    alpha: 1,
                    createdAt: Date.now(),
                    duration: 1000, // Projectile lifetime
                    hitMonsters: [],
                    damage: player.attack + skill.damage,
                    isSkill: true,
                    color: 'orange',
                    isProjectile: true,
                    dx: dx,
                    dy: dy
                };
            } else if (skillType === 'strong') { // 라이트닝
                const lightningRadius = tileSize * 1.5; // 2인 간격
                const offset = tileSize * 2; // 플레이어로부터의 거리
                let targetX = player.x, targetY = player.y;
                switch (player.lastDirection) {
                    case 'up': targetY -= offset; break;
                    case 'down': targetY += offset; break;
                    case 'left': targetX -= offset; break;
                    case 'right': targetX += offset; break;
                }
                attack = {
                    x: targetX + player.width / 2 - lightningRadius,
                    y: targetY + player.height / 2 - lightningRadius,
                    width: lightningRadius * 2,
                    height: lightningRadius * 2,
                    alpha: 0.8,
                    createdAt: Date.now(),
                    duration: 200,
                    hitMonsters: [],
                    damage: player.attack + skill.damage,
                    isSkill: true,
                    color: 'rgba(0, 255, 255, 0.8)', // 청록색
                    isCircular: true
                };
            } else if (skillType === 'ultimate') { // 메테오
                const meteorRadius = tileSize * 4.5; // 라이트닝 범위의 3배 (1.5 * 3)
                const targetX = player.x + player.width / 2;
                const targetY = player.y + player.height / 2;

                attack = {
                    x: targetX - meteorRadius,
                    y: targetY - meteorRadius,
                    width: meteorRadius * 2,
                    height: meteorRadius * 2,
                    alpha: 0.8,
                    createdAt: Date.now(),
                    duration: 500, // 짧은 공격 지속 시간
                    hitMonsters: [],
                    damage: player.attack + skill.damage,
                    isSkill: true,
                    color: 'rgba(255, 69, 0, 0.8)', // 주황색
                    isCircular: true
                };

                // 지면 효과 추가
                activeGroundEffects.push({
                    x: targetX,
                    y: targetY,
                    radius: meteorRadius,
                    duration: 10000, // 10초 지속
                    createdAt: Date.now(),
                    color: 'rgba(128, 128, 128, 0.5)', // 회색
                    damagePerSecond: 2, // 초당 2 데미지
                    lastDamageTime: Date.now(),
                    hitMonsters: [] // 장판에 맞은 몬스터 기록
                });
            }
        } else if (player.job === '성직자') {
                if (skillType === 'weak') { // 힐
                    // Handled by skill.heal, no attack object needed
                } else if (skillType === 'strong') { // 홀리아머
                    player.buffs.push({
                        type: 'holyArmor',
                        duration: skill.duration,
                        createdAt: Date.now(),
                        damageReduction: skill.damageReduction
                    });
                } else if (skillType === 'ultimate') { // 홀리라이트
                    const holyLightRadius = tileSize * 4.5; // 메테오와 같은 범위
                    const targetX = player.x + player.width / 2;
                    const targetY = player.y + player.height / 2;

                    attack = {
                        x: targetX - holyLightRadius,
                        y: targetY - holyLightRadius,
                        width: holyLightRadius * 2,
                        height: holyLightRadius * 2,
                        alpha: 0.8,
                        createdAt: Date.now(),
                        duration: 500, // 짧은 공격 지속 시간
                        hitMonsters: [],
                        damage: player.attack + skill.damage,
                        isSkill: true,
                        color: 'rgba(255, 255, 150, 0.8)', // 연노랑색
                        isCircular: true
                    };

                    // 지면 효과 추가
                    activeGroundEffects.push({
                        x: targetX,
                        y: targetY,
                        radius: holyLightRadius,
                        duration: 5000, // 5초 지속
                        createdAt: Date.now(),
                        color: 'rgba(255, 255, 150, 0.5)', // 연노랑색
                        damagePerSecond: 2, // 초당 2 데미지
                        dotDuration: 3000, // 3초간 도트 데미지
                        lastDamageTime: Date.now(),
                        hitMonsters: [] // 장판에 맞은 몬스터 기록
                    });
                }
            } else if (player.job === '도적') {
                if (skillType === 'weak') { // 단검던지기
                    const projectileSpeed = 15;
                    let dx = 0, dy = 0;
                    switch (player.lastDirection) {
                        case 'up': dy = -projectileSpeed; break;
                        case 'down': dy = projectileSpeed; break;
                        case 'left': dx = -projectileSpeed; break;
                        case 'right': dx = projectileSpeed; break;
                    }
                    attack = {
                        x: player.x + player.width / 2 - 5,
                        y: player.y + player.height / 2 - 5,
                        width: 10,
                        height: 10,
                        alpha: 1,
                        createdAt: Date.now(),
                        duration: 3000, // 3초 지속
                        hitMonsters: [], // 관통이므로 hitMonsters는 사용하지 않음
                        damage: player.attack + skill.damage,
                        isSkill: true,
                        color: 'silver',
                        isProjectile: true,
                        dx: dx,
                        dy: dy,
                        rotation: 0, // 초기 회전 각도
                        rotationSpeed: 360 / 3000, // 3초에 360도 회전 (ms당 각도)
                        piercing: true
                    };
                } else if (skillType === 'strong') { // 은신
                    player.buffs.push({
                        type: 'stealth',
                        duration: skill.duration,
                        createdAt: Date.now()
                    });
                } else if (skillType === 'ultimate') { // 암살
                    // Find closest monster
                    let closestMonster = null;
                    let minDistance = Infinity;
                    monsters.forEach(m => {
                        const dist = Math.sqrt(Math.pow(player.x - m.x, 2) + Math.pow(player.y - m.y, 2));
                        if (dist < minDistance) {
                            minDistance = dist;
                            closestMonster = m;
                        }
                    });

                    if (closestMonster) {
                        attack = {
                            x: closestMonster.x,
                            y: closestMonster.y,
                            width: closestMonster.width,
                            height: closestMonster.height,
                            alpha: 0.9,
                            createdAt: Date.now(),
                            duration: 150,
                            hitMonsters: [],
                            damage: player.attack + skill.damage,
                            isSkill: true,
                            color: 'rgba(50, 50, 50, 0.9)' // 어두운 색
                        };
                    } else {
                        // No monster to hit, refund mana and cooldown
                        player.mana += skill.manaCost;
                        player.skillCooldowns[skillType] = 0;
                        return;
                    }
                }
            }
        activeAttacks.push(attack);
    }
}

function interactWithNpc(npc) {
    if (npc.name === '상인') openShop();
    else if (npc.name === '전직관') {
        if (player.job !== '무직') alert("이미 직업이 있습니다.");
        else if (player.level < 3) alert("레벨 3 이상만 전직할 수 있습니다.");
        else if (player.gold < 50) alert("전직하려면 50골드가 필요합니다.");
        else {
            player.gold -= 50;
            const newJob = jobs[Math.floor(Math.random() * jobs.length)];
            player.job = newJob;
            switch (newJob) {
                case '검사': player.maxMana = 50; break;
                case '마법사': player.maxMana = 200; break;
                case '성직자': player.maxMana = 150; break;
                case '도적': player.maxMana = 100; break;
            }
            player.mana = player.maxMana; // 전직 시 마나 채워주기
            alert(`전직 완료! 당신은 이제 '${player.job}'입니다!`);
        }
    } else if (npc.name === '삭제관') {
        if (player.job === '무직') alert("현재 직업이 없습니다.");
        else if (player.gold < 50) alert("직업을 초기화하려면 50골드가 필요합니다.");
        else if (confirm(`정말로 50골드를 지불하고 직업을 초기화하시겠습니까?`)) {
            player.gold -= 50;
            player.job = '무직';
            alert("직업이 초기화되었습니다.");
        }
    } else if (npc.name === '스킬관') {
        openSkillModal();
    }
}

function isColliding(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y;
}
function isNear(rect1, rect2, distance) {
    const dx = (rect1.x + rect1.width / 2) - (rect2.x + rect2.width / 2);
    const dy = (rect1.y + rect1.height / 2) - (rect2.y + rect2.height / 2);
    return Math.sqrt(dx * dx + dy * dy) < (rect1.width / 2 + rect2.width / 2 + distance);
}

// --- Potion Modal ---
const potionModal = document.getElementById('potion-modal');
const potionList = document.getElementById('potion-list');
const closePotionBtn = document.getElementById('close-potion-btn');

function openPotionModal() {
    // Check if player has any HP or Mana potions
    const hasAnyPotion = shopItems.some(item => 
        (item.type === 'hp' || item.type === 'mana') && player.inventory[item.id] > 0
    );

    if (!hasAnyPotion) {
        alert("보유한 물약이 없습니다.");
        return;
    }
    if (player.hp === player.maxHp && player.mana === player.maxMana) {
        alert("HP와 마나가 모두 가득 찼습니다!");
        return;
    }
    gamePaused = true;
    populatePotionList();
    potionModal.style.display = 'flex';
}

function closePotionModal() {
    potionModal.style.display = 'none';
    gamePaused = false;
}

function usePotion(potionId) {
    const item = shopItems.find(i => i.id === potionId);
    if (!item) return; // Item not found in shopItems

    if (player.inventory[potionId] <= 0) {
        alert("보유한 물약이 없습니다!");
        return;
    }

    if (item.type === 'hp') {
        if (player.hp === player.maxHp) {
            alert("HP가 이미 가득 찼습니다!");
            return;
        }
        player.hp = Math.min(player.maxHp, player.hp + item.heal);
    } else if (item.type === 'mana') {
        if (player.mana === player.maxMana) {
            alert("마나가 이미 가득 찼습니다!");
            return;
        }
        player.mana = Math.min(player.maxMana, player.mana + item.heal);
    }

    player.inventory[potionId]--;
    savePlayerState(currentUser);
    populatePotionList(); // Refresh list after use
    // Always close the modal after an action
    closePotionModal();
}

function populatePotionList() {
    potionList.innerHTML = '';
    // Filter shopItems to only include potions and check if player has them
    const availablePotions = shopItems.filter(item => 
        (item.type === 'hp' || item.type === 'mana') && player.inventory[item.id] > 0
    );

    if (availablePotions.length === 0) {
        potionList.innerHTML = '<p>보유한 물약이 없습니다.</p>';
        return;
    }

    availablePotions.forEach(item => {
        const potionItem = document.createElement('div');
        potionItem.className = 'potion-item';
        potionItem.innerHTML = `<span>${item.name} (${player.inventory[item.id]}개) - ${item.type === 'hp' ? 'HP' : '마나'} ${item.heal} 회복</span>`;
        const useBtn = document.createElement('button');
        useBtn.textContent = '사용';
        useBtn.onclick = () => usePotion(item.id);
        potionItem.appendChild(useBtn);
        potionList.appendChild(potionItem);
    });
}

// --- Skill Modal ---
const skillModal = document.getElementById('skill-modal');
const skillList = document.getElementById('skill-list');
const closeSkillBtn = document.getElementById('close-skill-btn');

function openSkillModal() {
    if (player.job === '무직') {
        alert('먼저 전직을 해야 스킬을 배울 수 있습니다.');
        return;
    }
    gamePaused = true;
    populateSkillList();
    skillModal.style.display = 'flex';
}

function closeSkillModal() {
    skillModal.style.display = 'none';
    gamePaused = false;
}

function learnSkill(skillType, skill) {
    if (player.gold < skill.manaCost) {
        alert('골드가 부족합니다.');
        return;
    }

    if (player.skills[skillType]) {
        alert('이미 해당 종류의 스킬을 배웠습니다.');
        return;
    }

    player.gold -= skill.manaCost;
    player.skills[skillType] = skill;
    alert(`'${skill.name}' 스킬을 배웠습니다!`);
    savePlayerState(currentUser);
    populateSkillList(); // Refresh the list to update button states
}

function populateSkillList() {
    skillList.innerHTML = '';
    const jobSkills = skills[player.job];
    if (!jobSkills) return;

    for (const skillType in jobSkills) { // weak, strong, ultimate
        const skill = jobSkills[skillType];
        const skillItem = document.createElement('div');
        skillItem.className = 'skill-item';

        let buttonHtml;
        if (player.skills[skillType] && player.skills[skillType].name === skill.name) {
            buttonHtml = '<button class="learn-btn" disabled>보유중</button>';
        } else {
            buttonHtml = `<button class="learn-btn" onclick="learnSkill('${skillType}', skills['${player.job}']['${skillType}'])">배우기 (${skill.manaCost}G)</button>`;
        }

        skillItem.innerHTML = `
            <h3>${skill.name} (${actionTranslations[skillType]})</h3>
            <p>${skill.description}</p>
            <p>데미지: ${skill.damage || 0} / 힐: ${skill.heal || 0} / 쿨타임: ${skill.cooldown / 1000}초</p>
            ${buttonHtml}
        `;
        skillList.appendChild(skillItem);
    }
}


// --- 상태 저장/복원 ---
function savePlayerState() { localStorage.setItem('playerState', JSON.stringify(player)); }
function loadPlayerState() {
    const saved = localStorage.getItem('playerState');
    if (saved) {
        const savedPlayer = JSON.parse(saved);
        if (savedPlayer.hp <= 0) {
            // Reset player if dead
            player.hp = player.maxHp;
            player.x = (maps.overworld.layout[0].length / 2) * tileSize;
            player.y = (maps.overworld.layout.length / 2) * tileSize;
            currentMapId = 'overworld';
            return;
        }
        Object.assign(player, savedPlayer);
    }
}
function saveKeyMap() {
    localStorage.setItem('keyMap', JSON.stringify(keyMap));
}

function loadKeyMap() {
    const savedKeyMap = localStorage.getItem('keyMap');
    if (savedKeyMap) {
        keyMap = JSON.parse(savedKeyMap);
    }
}


// --- 게임 루프 및 시작 ---
function gameLoop() {
    if (!gamePaused) {
        update();
        draw();
    }
    requestAnimationFrame(gameLoop);
}

function init() {
    currentUser = sessionStorage.getItem('currentUser');
    loadKeyMap();
    player.x = (maps.overworld.layout[0].length / 2) * tileSize;
    player.y = (maps.overworld.layout.length / 2) * tileSize;
    loadPlayerState(currentUser);
    createOverworldBackground();
    spawnMonsters();
    gameLoop();
}

function startGame() {
    const nicknameInput = document.getElementById('nickname-input');
    const nickname = nicknameInput.value.trim();

    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-wrapper').style.display = 'block';
    init();

    if (nickname) {
        player.nickname = nickname;
    }
}

// --- Settings Modal ---
const settingsButton = document.getElementById('settings-button');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const keybindList = document.getElementById('keybind-list');

function openSettingsModal() {
    populateKeybindList();
    settingsModal.style.display = 'flex'; // Use flex to center the content
}

function closeSettingsModal() {
    settingsModal.style.display = 'none';
    changingKeyFor = null;
}

function populateKeybindList() {
    keybindList.innerHTML = '';
    for (const action in keyMap) {
        const div = document.createElement('div');
        div.innerHTML = `<span>${actionTranslations[action]}: </span><button class="keybind-button" data-action="${action}">${getKeyDisplayName(keyMap[action])}</button>`;
        keybindList.appendChild(div);
    }
    document.querySelectorAll('.keybind-button').forEach(button => {
        button.addEventListener('click', (e) => {
            if (changingKeyFor) return; // Prevent starting a new change if one is in progress
            changingKeyFor = e.target.dataset.action;
            e.target.textContent = '...';
        });
    });
}


window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('start-button').addEventListener('click', startGame);
    settingsButton.addEventListener('click', openSettingsModal);
    closeSettingsBtn.addEventListener('click', closeSettingsModal);
    closePotionBtn.addEventListener('click', closePotionModal);
    closeSkillBtn.addEventListener('click', closeSkillModal);
});