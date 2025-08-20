const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 설정 ---
const tileSize = 40;
const MONSTER_RESPAWN_TIME = 10000;
let currentLanguage = 'ko';

function getTranslation(key, replacements = {}) {
    let translation = languages[currentLanguage][key] || key;
    for (const placeholder in replacements) {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    return translation;
}

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
    up: 'up',
    down: 'down',
    left: 'left',
    right: 'right',
    attack: 'attack',
    interact: 'interact',
    potion: 'potion',
    weakSkill: 'weak_skill',
    strongSkill: 'strong_skill',
    ultimateSkill: 'ultimate_skill'
};

function getKeyDisplayName(key) {
    if (key === 'mouse0') return getTranslation('left_click');
    if (key === 'mouse2') return getTranslation('right_click');
    return key.toUpperCase();
}

// --- 게임 데이터 ---
let currentMapId = 'overworld';
let gamePaused = false;
let gameMode = 'normal'; // 'easy' or 'normal'

const player = {
    x: 0, y: 0, // 시작 위치는 init에서 설정
    width: 32, height: 32, color: 'white', speed: 4, hp: 100, maxHp: 100, 
    mana: 50, maxMana: 50, manaRegenTimer: 0,
    ultimateGauge: 0, maxUltimateGauge: 100,
    level: 1,
    maxLevel: 50,
    exp: 0,
    requiredExp: 10,
    job: 'no_job',
    nickname: 'Player',
    physicalAttack: 1, // Base physical attack
    magicAttack: 0,    // Base magic attack
    gold: 0, 
    inventory: { potion: 0, smallPotion: 0 }, 
    lastDirection: 'right', 
    attackCooldown: 0, 
    damageCooldown: 0,
    isStealthed: false,
    returnPos: { x: 0, y: 0 }, // 던전에서 돌아올 위치
    skills: { weak: null, strong: null, ultimate: null },
    skillCooldowns: { weak: 0, strong: 0, ultimate: 0 },
    buffs: [],
    isReturning: false,
    returnTimer: 0,
    returnEffect: null
};

let monsters = [];
const deadMonsters = [];
let nextMonsterId = 1;
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
            { id: 1, name: 'merchant', x: (50 + 2) * tileSize, y: 50 * tileSize, width: 32, height: 32, color: 'purple', lastDirection: 'down' },
            { id: 2, name: 'job_master', x: (50 + 8) * tileSize, y: 50 * tileSize, width: 32, height: 32, color: 'cyan', lastDirection: 'down' },
            { id: 4, name: 'skill_master', x: (50 + 5) * tileSize, y: 50 * tileSize, width: 32, height: 32, color: 'yellow', lastDirection: 'down' },
            { id: 3, name: 'reset_master', x: (50 + 14) * tileSize, y: 50 * tileSize, width: 32, height: 32, color: 'orange', lastDirection: 'down' }
        ],
        monsters: [],
        portals: [
            { name: 'slime_dungeon', x: (50 + 20) * tileSize, y: 50 * tileSize, targetMapId: 'slimeDungeon', targetX: 2 * tileSize, targetY: 17 * tileSize, color: '#696969' },
            { name: 'goblin_dungeon', x: (50 + 22) * tileSize, y: 50 * tileSize, targetMapId: 'goblinDungeon', targetX: 2 * tileSize, targetY: 17 * tileSize, color: '#696969' },
            { name: 'orc_dungeon', x: (50 + 24) * tileSize, y: 50 * tileSize, targetMapId: 'orcDungeon', targetX: 2 * tileSize, targetY: 17 * tileSize, color: '#696969' },
            { name: 'subspecies_dungeon', x: (50 + 26) * tileSize, y: 50 * tileSize, targetMapId: 'subspeciesDungeon', targetX: 2 * tileSize, targetY: 22 * tileSize, color: 'black' },
        ]
    },
    slimeDungeon: {
        layout: createMap(20, 20, 0),
        npcs: [],
        monsters: [{ type: initialMonsters.slime, count: 5 }],
        portals: [{ name: 'exit', x: 2 * tileSize, y: 18 * tileSize, targetMapId: 'overworld', targetX: -1, targetY: -1, color: 'lightblue' }]
    },
    goblinDungeon: {
        layout: createMap(20, 20, 0),
        npcs: [],
        monsters: [{ type: initialMonsters.goblin, count: 5 }],
        portals: [{ name: 'exit', x: 2 * tileSize, y: 18 * tileSize, targetMapId: 'overworld', targetX: -1, targetY: -1, color: 'lightblue' }]
    },
    orcDungeon: {
        layout: createMap(20, 20, 0),
        npcs: [],
        monsters: [{ type: initialMonsters.orc, count: 5 }],
        portals: [{ name: 'exit', x: 2 * tileSize, y: 18 * tileSize, targetMapId: 'overworld', targetX: -1, targetY: -1, color: 'lightblue' }]
    },
    subspeciesDungeon: {
        layout: createMap(25, 25, 0),
        npcs: [],
        monsters: [
            { type: subspeciesMonsters.slime, count: 1 },
            { type: subspeciesMonsters.goblin, count: 1 },
            { type: subspeciesMonsters.orc, count: 1 }
        ],
        portals: [{ name: 'exit', x: 2 * tileSize, y: 23 * tileSize, targetMapId: 'overworld', targetX: -1, targetY: -1, color: 'lightblue' }]
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
            alert(getTranslation('key_in_use'));
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
    if (e.button === 2) {
        e.preventDefault();
    }

    if (changingKeyFor) {
        e.preventDefault();
        const newKey = `mouse${e.button}`;
        if (Object.values(keyMap).includes(newKey)) {
            alert(getTranslation('key_in_use'));
            populateKeybindList();
            changingKeyFor = null;
            return;
        }
        keyMap[changingKeyFor] = newKey;
        saveKeyMap();
        changingKeyFor = null;
        populateKeybindList();
    } else {
        if (e.target === canvas) {
            handleInput(`mouse${e.button}`, true);
        }
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.target === canvas) {
        handleInput(`mouse${e.button}`, false);
    }
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

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

    map.portals.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, tileSize, tileSize);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(getTranslation(p.name), p.x + tileSize / 2, p.y - 5);
    });

    if (map.npcs) {
        const npcsWithHouses = ['merchant', 'job_master', 'reset_master'];
        map.npcs.forEach(npc => {
            if (npcsWithHouses.includes(npc.name)) drawHouse(npc);
        });
    }

    activeAttacks.forEach(attack => {
        ctx.fillStyle = attack.color || `rgba(255, 0, 0, ${attack.alpha})`;
        if (attack.isCircular) {
            ctx.beginPath();
            ctx.arc(attack.x + attack.width / 2, attack.y + attack.height / 2, attack.width / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (attack.isProjectile && attack.rotationSpeed) { // 단검던지기
            ctx.save();
            ctx.translate(attack.x + attack.width / 2, attack.y + attack.height / 2);
            ctx.rotate(attack.rotation * Math.PI / 180);
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
            ctx.fillText(getTranslation(npc.name), npc.x + npc.width / 2, npc.y - 5);
        });
    }

    // Draw return effect if active
    if (player.isReturning && player.returnEffect) {
        const effect = player.returnEffect;
        ctx.save();
        ctx.globalAlpha = effect.alpha;
        ctx.fillStyle = effect.color;
        ctx.beginPath();
        // Draw ellipse: ctx.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle)
        ctx.ellipse(effect.x, effect.y, effect.width / 2, effect.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw countdown timer
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = '24px Arial';
        const timeLeft = (player.returnTimer / 1000).toFixed(1);
        ctx.fillText(timeLeft, player.x + player.width / 2, player.y - 30);
    }

    if (player.isStealthed) {
        ctx.globalAlpha = 0.5;
    }

    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    drawDirectionDots(ctx, player);

    if (player.isStealthed) {
        ctx.globalAlpha = 1.0;
    }

    if (player.nickname) {
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = '14px Arial';
        ctx.fillText(player.nickname, player.x + player.width / 2, player.y - 10);
    }

    ctx.restore();

    ctx.fillStyle = 'white';
    ctx.font = '18px Arial';
    let uiY = 35;
    const uiX = 10;
    const lineHeight = 35;
    ctx.fillText(`${getTranslation('level')}: ${player.level}`, uiX, uiY);
    uiY += lineHeight;
    ctx.fillText(`${getTranslation('exp')}: ${player.exp} / ${player.requiredExp}`, uiX, uiY);
    uiY += lineHeight;
    ctx.fillText(`${getTranslation('hp')}: ${player.hp} / ${player.maxHp}`, uiX, uiY);
    uiY += 10;
    ctx.fillStyle = 'gray';
    ctx.fillRect(uiX, uiY, 200, 10);
    ctx.fillStyle = 'red';
    ctx.fillRect(uiX, uiY, 200 * (player.hp / player.maxHp), 10);
    uiY += 25;
    ctx.fillStyle = 'white';
    ctx.fillText(`${getTranslation('mana')}: ${player.mana} / ${player.maxMana}`, uiX, uiY);
    uiY += 10;
    ctx.fillStyle = 'gray';
    ctx.fillRect(uiX, uiY, 200, 10);
    ctx.fillStyle = 'blue';
    ctx.fillRect(uiX, uiY, 200 * (player.mana / player.maxMana), 10);
    uiY += 25;
    ctx.fillStyle = 'white';
    ctx.fillText(`${getTranslation('ultimate')}: ${player.ultimateGauge} / ${player.maxUltimateGauge}`, uiX, uiY);
    uiY += 10;
    ctx.fillStyle = 'gray';
    ctx.fillRect(uiX, uiY, 200, 10);
    ctx.fillStyle = 'yellow';
    ctx.fillRect(uiX, uiY, 200 * (player.ultimateGauge / player.maxUltimateGauge), 10);
    uiY += 25;
    uiY += lineHeight;
    ctx.fillText(`${getTranslation('gold')}: ${player.gold}`, uiX, uiY);
    uiY += lineHeight;
    ctx.fillText(`${getTranslation('job')}: ${getTranslation(player.job)}`, uiX, uiY);
    uiY += lineHeight;
    ctx.fillText(`${getTranslation('potions')}: ${getKeyDisplayName(keyMap.potion)} key`, uiX, uiY);
}

function levelUp() {
    if (player.level >= player.maxLevel) {
        player.exp = 0;
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
            const newMonster = { ...monsterInfo.type, id: nextMonsterId++ };
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

    if (player.isReturning) {
        player.returnTimer -= 16; // Decrement by game loop interval (approx 16ms)
        if (player.returnTimer <= 0) {
            player.isReturning = false;
            player.returnEffect = null; // Clear the effect
            // Teleport to overworld center
            player.x = (maps.overworld.layout[0].length / 2) * tileSize;
            player.y = (maps.overworld.layout.length / 2) * tileSize;
            currentMapId = 'overworld';
            spawnMonsters(); // Respawns monsters in the new map
        } else {
            // Update effect position to follow player
            if (player.returnEffect) {
                player.returnEffect.x = player.x + player.width / 2;
                player.returnEffect.y = player.y + player.height / 2;
                player.returnEffect.alpha = 0.7 * (player.returnTimer / 1000); // Fade out
            }
        }
    }

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

    for (let i = activeAttacks.length - 1; i >= 0; i--) {
        const attack = activeAttacks[i];
        const elapsed = now - attack.createdAt;

        if (attack.isProjectile) {
            attack.x += attack.dx;
            attack.y += attack.dy;
            if (attack.rotationSpeed) {
                attack.rotation += attack.rotationSpeed * 16;
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

    for (let i = activeGroundEffects.length - 1; i >= 0; i--) {
        const effect = activeGroundEffects[i];
        const elapsed = now - effect.createdAt;
        effect.alpha = 0.5 * (1 - elapsed / effect.duration);

        if (elapsed >= effect.duration) {
            activeGroundEffects.splice(i, 1);
        } else {
            if (now - effect.lastDamageTime >= 1000) { 
                monsters.forEach(monster => {
                    const effectCenterX = effect.x;
                    const effectCenterY = effect.y;
                    const monsterCenterX = monster.x + monster.width / 2;
                    const monsterCenterY = monster.y + monster.height / 2;
                    const distance = Math.sqrt(Math.pow(effectCenterX - monsterCenterX, 2) + Math.pow(effectCenterY - monsterCenterY, 2));

                    if (distance < (effect.radius + monster.width / 2)) {
                        const lastHit = effect.hitMonsters.find(h => h.id === monster.id);
                        if (!lastHit || (now - lastHit.time) >= effect.dotDuration) { 
                            monster.hp -= effect.damagePerSecond;
                            if (lastHit) {
                                lastHit.time = now;
                            }
                            if (monster.hp <= 0) {
                                player.gold += monster.gold;
                                gainExp(monster.exp);
                                deadMonsters.push({ ...monster, diedAt: now });
                                monsters = monsters.filter(m => m.id !== monster.id);
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

        if (!player.isStealthed && distance < monster.detectionRange) {
            monster.x += (dx / distance) * monster.speed;
            monster.y += (dy / distance) * monster.speed;
        }

        if (isColliding(player, monster) && player.damageCooldown <= 0) {
            let damageTaken = monster.attack;
            const holyArmorBuff = player.buffs.find(buff => buff.type === 'holyArmor');
            if (holyArmorBuff) {
                damageTaken *= (1 - holyArmorBuff.damageReduction);
            }
            player.hp -= damageTaken;
            player.damageCooldown = 1000;
            if (player.hp <= 0) {
                if (gameMode === 'easy') {
                    player.exp = Math.max(0, player.exp - Math.floor(player.exp * 0.10));
                    player.hp = player.maxHp;
                    player.x = (maps.overworld.layout[0].length / 2) * tileSize;
                    player.y = (maps.overworld.layout.length / 2) * tileSize;
                    currentMapId = 'overworld';
                    spawnMonsters();
                    alert(getTranslation('death_penalty'));
                } else { 
                    alert(getTranslation('game_over'));
                    document.location.reload();
                }
            }
        }
    });

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
    
    savePlayerState(currentUser);
}

function handlePlayerAttack() {
    if (player.attackCooldown > 0) return;
    player.attackCooldown = 500;
    const attackRange = 100, attackSize = 30;
    let attack = { x: player.x + player.width / 2 - attackSize / 2, y: player.y + player.height / 2 - attackSize / 2, width: attackSize, height: attackSize, alpha: 0.5, createdAt: Date.now(), duration: 200, damage: player.physicalAttack, damageType: 'physical', hitMonsters: [] };
    switch (player.lastDirection) {
        case 'up': attack.y -= attackRange / 2; attack.width = attackSize * 2; attack.height = attackRange; break;
        case 'down': attack.y += attackRange / 2; attack.width = attackSize * 2; attack.height = attackRange; break;
        case 'left': attack.x -= attackRange / 2; attack.width = attackRange; attack.height = attackSize * 2; break;
        case 'right': attack.x += attackRange / 2; attack.width = attackRange; attack.height = attackSize * 2; break;
    }
    activeAttacks.push(attack);
    player.ultimateGauge = Math.min(player.maxUltimateGauge, player.ultimateGauge + 1);
}

function startReturnToTown() {
    if (player.isReturning) return; // Prevent multiple activations
    if (currentMapId === 'overworld') { // Already in town
        alert(getTranslation('already_in_town')); // Need to add this translation
        return;
    }

    player.isReturning = true;
    player.returnTimer = 1000; // 1 second countdown
    player.returnEffect = {
        x: player.x + player.width / 2,
        y: player.y + player.height / 2,
        width: player.width * 0.8, // Ellipse width
        height: player.height * 2, // Ellipse height (long vertically)
        color: 'rgba(128, 0, 128, 0.7)', // Purple with some transparency
        createdAt: Date.now(),
        duration: 1000, // Duration of the effect
        alpha: 0.7 // Initial alpha
    };
}

function useSkill(skillType) {
    const skill = player.skills[skillType];
    if (!skill) return;
    if (player.skillCooldowns[skillType] > 0) return;
    if (player.mana < skill.manaCost) {
        alert(getTranslation('no_mana'));
        return;
    }

    if (skillType === 'ultimate' && player.ultimateGauge < player.maxUltimateGauge) {
        alert(getTranslation('no_ultimate'));
        return;
    }

    player.mana -= skill.manaCost;
    player.skillCooldowns[skillType] = skill.cooldown;

    if (skillType === 'weak') {
        player.ultimateGauge = Math.min(player.maxUltimateGauge, player.ultimateGauge + 5);
    } else if (skillType === 'strong') {
        player.ultimateGauge = Math.min(player.maxUltimateGauge, player.ultimateGauge + 20);
    } else if (skillType === 'ultimate') {
        player.ultimateGauge = 0;
    }

    if (skill.heal) {
        player.hp = Math.min(player.maxHp, player.hp + skill.heal);
    }

    if (skill.damage) {
        let attack = {};
        const baseAttackSize = 30;
        const baseAttackRange = 100;

        let baseDamage = 0;
        if (skill.damageType === 'physical') {
            baseDamage = player.physicalAttack;
        } else if (skill.damageType === 'magic') {
            baseDamage = player.magicAttack;
        }

        if (player.job === 'warrior') {
            if (skillType === 'weak') { 
                attack = {
                    x: player.x + player.width / 2 - baseAttackSize * 1.5,
                    y: player.y + player.height / 2 - baseAttackSize * 1.5,
                    width: baseAttackSize * 3,
                    height: baseAttackSize * 3,
                    alpha: 0.8,
                    createdAt: Date.now(),
                    duration: 200,
                    hitMonsters: [],
                    damage: baseDamage + skill.damage,
                    damageType: skill.damageType,
                    isSkill: true,
                    color: 'rgba(255, 165, 0, 0.8)'
                };
                switch (player.lastDirection) {
                    case 'up': attack.y -= baseAttackSize * 2; attack.height = baseAttackSize * 4; break;
                    case 'down': attack.y += baseAttackSize * 2; attack.height = baseAttackSize * 4; break;
                    case 'left': attack.x -= baseAttackSize * 2; attack.width = baseAttackSize * 4; break;
                    case 'right': attack.x += baseAttackSize * 2; attack.width = baseAttackSize * 4; break;
                }
            } else if (skillType === 'strong') { 
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
                        damage: baseDamage + skill.damage,
                        damageType: skill.damageType,
                        isSkill: true,
                        color: 'rgba(255, 0, 0, 0.9)'
                    };
                } else {
                    player.mana += skill.manaCost;
                    player.skillCooldowns[skillType] = 0;
                    return;
                }
            } else if (skillType === 'ultimate') { 
                attack = {
                    x: player.x - baseAttackSize * 2,
                    y: player.y - baseAttackSize * 2,
                    width: baseAttackSize * 5,
                    height: baseAttackSize * 5,
                    alpha: 0.7,
                    createdAt: Date.now(),
                    duration: 400,
                    hitMonsters: [],
                    damage: baseDamage + skill.damage,
                    isSkill: true,
                    color: 'rgba(100, 0, 255, 0.7)',
                    isCircular: true,
                    damageType: skill.damageType
                };
            }
        } else if (player.job === 'mage') {
            if (skillType === 'weak') { 
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
                    duration: 1000,
                    hitMonsters: [],
                    damage: baseDamage + skill.damage,
                    damageType: skill.damageType,
                    isSkill: true,
                    color: 'orange',
                    isProjectile: true,
                    dx: dx,
                    dy: dy,
                    piercing: false
                };
            } else if (skillType === 'strong') { 
                const lightningRadius = tileSize * 1.5;
                const offset = tileSize * 2;
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
                    damage: baseDamage + skill.damage,
                    damageType: skill.damageType,
                    isSkill: true,
                    color: 'rgba(0, 255, 255, 0.8)',
                    isCircular: true
                };
            } else if (skillType === 'ultimate') { 
                const meteorRadius = tileSize * 4.5;
                const targetX = player.x + player.width / 2;
                const targetY = player.y + player.height / 2;

                attack = {
                    x: targetX - meteorRadius,
                    y: targetY - meteorRadius,
                    width: meteorRadius * 2,
                    height: meteorRadius * 2,
                    alpha: 0.8,
                    createdAt: Date.now(),
                    duration: 500,
                    hitMonsters: [],
                    damage: baseDamage + skill.damage,
                    damageType: skill.damageType,
                    isSkill: true,
                    color: 'rgba(255, 69, 0, 0.8)',
                    isCircular: true
                };

                activeGroundEffects.push({
                    x: targetX,
                    y: targetY,
                    radius: meteorRadius,
                    duration: 10000,
                    createdAt: Date.now(),
                    color: 'rgba(128, 128, 128, 0.5)',
                    damagePerSecond: 2,
                    lastDamageTime: Date.now(),
                    hitMonsters: [],
                    damageType: skill.damageType
                });
            }
        } else if (player.job === 'priest') {
                if (skillType === 'weak') { 
                } else if (skillType === 'strong') { 
                    player.buffs.push({
                        type: 'holyArmor',
                        duration: skill.duration,
                        createdAt: Date.now(),
                        damageReduction: skill.damageReduction
                    });
                } else if (skillType === 'ultimate') { 
                    const holyLightRadius = tileSize * 4.5;
                    const targetX = player.x + player.width / 2;
                    const targetY = player.y + player.height / 2;

                    attack = {
                        x: targetX - holyLightRadius,
                        y: targetY - holyLightRadius,
                        width: holyLightRadius * 2,
                        height: holyLightRadius * 2,
                        alpha: 0.8,
                        createdAt: Date.now(),
                        duration: 500,
                        hitMonsters: [],
                        damage: baseDamage + skill.damage,
                        damageType: skill.damageType,
                        isSkill: true,
                        color: 'rgba(255, 255, 150, 0.8)',
                        isCircular: true
                    };

                    activeGroundEffects.push({
                        x: targetX,
                        y: targetY,
                        radius: holyLightRadius,
                        duration: 5000,
                        createdAt: Date.now(),
                        color: 'rgba(255, 255, 150, 0.5)',
                        damagePerSecond: 2,
                        dotDuration: 3000,
                        lastDamageTime: Date.now(),
                        hitMonsters: []
                    });
                }
            } else if (player.job === 'thief') {
                if (skillType === 'weak') { 
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
                        duration: 3000,
                        hitMonsters: [],
                        damage: baseDamage + skill.damage,
                        damageType: skill.damageType,
                        isSkill: true,
                        color: 'silver',
                        isProjectile: true,
                        dx: dx,
                        dy: dy,
                        rotation: 0,
                        rotationSpeed: 360 / 3000,
                        piercing: true
                    };
                } else if (skillType === 'strong') { 
                    if (player.isStealthed) return; // Prevent re-stealthing while already stealthed
                    player.isStealthed = true;
                    setTimeout(() => {
                        player.isStealthed = false;
                    }, skill.duration);
                } else if (skillType === 'ultimate') { 
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
                            damage: baseDamage + skill.damage,
                            damageType: skill.damageType,
                            isSkill: true,
                            color: 'rgba(50, 50, 50, 0.9)'
                        };
                    } else {
                        player.mana += skill.manaCost;
                        player.skillCooldowns[skillType] = 0;
                        return;
                    }
                }
            }
        if (Object.keys(attack).length > 0) {
            activeAttacks.push(attack);
        }
    }
}

function interactWithNpc(npc) {
    if (npc.name === 'merchant') openShop();
    else if (npc.name === 'job_master') {
        if (player.job !== 'no_job') alert(getTranslation('already_have_job'));
        else if (player.level < 3) alert(getTranslation('need_level_3_for_job'));
        else if (player.gold < 50) alert(getTranslation('need_50_gold_for_job'));
        else {
            player.gold -= 50;
            const newJob = jobs[Math.floor(Math.random() * jobs.length)];
            player.job = newJob;
            switch (newJob) {
                case 'warrior': player.maxMana = 50; break;
                case 'mage': player.maxMana = 200; break;
                case 'priest': player.maxMana = 150; break;
                case 'thief': player.maxMana = 100; break;
            }
            player.mana = player.maxMana;
            alert(getTranslation('job_change_complete', { job: getTranslation(newJob) }));
        }
    } else if (npc.name === 'reset_master') {
        if (player.job === 'no_job') alert(getTranslation('no_job'));
        else if (player.gold < 50) alert(getTranslation('need_50_gold_for_job'));
        else if (confirm(getTranslation('job_reset_confirm'))) {
            player.gold -= 50;
            player.job = 'no_job';
            player.skills = { weak: null, strong: null, ultimate: null };
            // Reset job-specific items in inventory
            shopItems.forEach(item => {
                if (item.job && player.inventory[item.id] > 0) {
                    player.inventory[item.id] = 0;
                }
            });
            alert(getTranslation('job_reset_complete'));
        }
    } else if (npc.name === 'skill_master') {
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

const potionModal = document.getElementById('potion-modal');
const potionList = document.getElementById('potion-list');
const closePotionBtn = document.getElementById('close-potion-btn');

function openPotionModal() {
    const hasAnyPotion = shopItems.some(item => 
        (item.type === 'hp' || item.type === 'mana') && player.inventory[item.id] > 0
    );

    if (!hasAnyPotion) {
        alert(getTranslation('no_potions'));
        return;
    }
    if (player.hp === player.maxHp && player.mana === player.maxMana) {
        alert(getTranslation('hp_and_mana_full'));
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
    if (!item) return;

    if (player.inventory[potionId] <= 0) {
        alert(getTranslation('no_potions'));
        return;
    }

    if (item.type === 'hp') {
        if (player.hp === player.maxHp) {
            alert(getTranslation('hp_full'));
            return;
        }
        player.hp = Math.min(player.maxHp, player.hp + item.heal);
    } else if (item.type === 'mana') {
        if (player.mana === player.maxMana) {
            alert(getTranslation('mana_full'));
            return;
        }
        player.mana = Math.min(player.maxMana, player.mana + item.heal);
    }

    player.inventory[potionId]--;
    savePlayerState(currentUser);
    populatePotionList();
    closePotionModal();
}

function populatePotionList() {
    potionList.innerHTML = '';
    const availablePotions = shopItems.filter(item => 
        (item.type === 'hp' || item.type === 'mana') && player.inventory[item.id] > 0
    );

    if (availablePotions.length === 0) {
        potionList.innerHTML = `<p>${getTranslation('no_potions')}</p>`;
        return;
    }

    availablePotions.forEach(item => {
        const potionItem = document.createElement('div');
        potionItem.className = 'potion-item';
        potionItem.innerHTML = `<span>${item.name} (${player.inventory[item.id]}) - ${item.type === 'hp' ? 'HP' : 'Mana'} ${item.heal}</span>`;
        const useBtn = document.createElement('button');
        useBtn.textContent = getTranslation('use');
        useBtn.onclick = () => usePotion(item.id);
        potionItem.appendChild(useBtn);
        potionList.appendChild(potionItem);
    });
}

const skillModal = document.getElementById('skill-modal');
const skillList = document.getElementById('skill-list');
const closeSkillBtn = document.getElementById('close-skill-btn');

function openSkillModal() {
    if (player.job === 'no_job') {
        alert(getTranslation('need_job_for_skill'));
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
    if (player.gold < skill.manaCost * 100) {
        alert(getTranslation('not_enough_gold'));
        return;
    }

    if (player.skills[skillType]) {
        alert(getTranslation('already_learned_skill'));
        return;
    }

    player.gold -= skill.manaCost * 100;
    player.skills[skillType] = skill;
    alert(getTranslation('skill_learned', { skillName: skill.name }));
    savePlayerState(currentUser);
    populateSkillList();
}

function populateSkillList() {
    skillList.innerHTML = '';
    const jobSkills = skills[player.job];
    if (!jobSkills) return;

    for (const skillType in jobSkills) {
        const skill = jobSkills[skillType];
        const skillItem = document.createElement('div');
        skillItem.className = 'skill-item';

        let buttonHtml;
        if (player.skills[skillType] && player.skills[skillType].name === skill.name) {
            buttonHtml = `<button class="learn-btn" disabled>${getTranslation('in_possession')}</button>`;
        } else {
            buttonHtml = `<button class="learn-btn" onclick="learnSkill('${skillType}', skills['${player.job}']['${skillType}'])">${getTranslation('learn')} (${skill.manaCost * 100}G)</button>`;
        }

        skillItem.innerHTML = `
            <h3>${skill.name} (${getTranslation(actionTranslations[skillType])})</h3>
            <p>${skill.description}</p>
            <p>Damage: ${skill.damage || 0} / Heal: ${skill.heal || 0} / Cooldown: ${skill.cooldown / 1000}s</p>
            ${buttonHtml}
        `;
        skillList.appendChild(skillItem);
    }
}

function savePlayerState(currentUser) { 
    if (!currentUser) return;
    localStorage.setItem(`playerState_${currentUser}`, JSON.stringify(player)); 
}

function loadPlayerState(currentUser) {
    if (!currentUser) return;
    const saved = localStorage.getItem(`playerState_${currentUser}`);
    if (saved) {
        const savedPlayer = JSON.parse(saved);
        Object.assign(player, savedPlayer);
        player.isStealthed = false; // 불러올 때 은신 상태 초기화
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

function updateUIText() {
    document.getElementById('settings-button').textContent = getTranslation('settings');
    document.querySelector('#settings-modal h2').textContent = getTranslation('settings');
    document.querySelector('#potion-modal h2').textContent = getTranslation('potions');
    document.querySelector('#skill-modal h2').textContent = 'Skills'; // TODO: Add to languages.js
    document.querySelector('#shop-modal h2').textContent = getTranslation('merchant');
    populateKeybindList();
}

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
    loadPlayerState(currentUser); // Load saved state first

    if (player.hp <= 0) {
        player.hp = player.maxHp;
    }

    // Now, explicitly set player position to village, overriding saved position if it exists
    player.x = (maps.overworld.layout[0].length / 2) * tileSize;
    player.y = (maps.overworld.layout.length / 2) * tileSize;
    currentMapId = 'overworld'; // Ensure map is overworld
    createOverworldBackground();
    spawnMonsters();
    gameLoop();
    updateUIText(); 
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

const settingsButton = document.getElementById('settings-button');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const keybindList = document.getElementById('keybind-list');
const languageSelect = document.getElementById('language-select');

languageSelect.addEventListener('change', (e) => {
    currentLanguage = e.target.value;
    updateUIText();
});

function openSettingsModal() {
    populateKeybindList();
    settingsModal.style.display = 'flex';
}

function closeSettingsModal() {
    settingsModal.style.display = 'none';
    changingKeyFor = null;
}

function populateKeybindList() {
    keybindList.innerHTML = '';
    for (const action in keyMap) {
        const div = document.createElement('div');
        div.innerHTML = `<span>${getTranslation(actionTranslations[action])}: </span><button class="keybind-button" data-action="${action}">${getKeyDisplayName(keyMap[action])}</button>`;
        keybindList.appendChild(div);
    }
    document.querySelectorAll('.keybind-button').forEach(button => {
        button.addEventListener('click', (e) => {
            if (changingKeyFor) return;
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
    document.getElementById('return-to-town-button').addEventListener('click', startReturnToTown); // New line

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const settingsModal = document.getElementById('settings-modal');
            const potionModal = document.getElementById('potion-modal');
            const skillModal = document.getElementById('skill-modal');
            const shopModal = document.getElementById('shop-modal');

            if (settingsModal.style.display === 'flex') closeSettingsModal();
            if (potionModal.style.display === 'flex') closePotionModal();
            if (skillModal.style.display === 'flex') closeSkillModal();
            if (shopModal.style.display === 'flex') closeShop();
        }
    });
});