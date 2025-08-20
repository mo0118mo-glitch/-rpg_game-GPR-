const jobs = ['warrior', 'mage', 'priest', 'thief'];

const initialMonsters = {
    slime: { id: 1, name: '슬라임', width: 32, height: 32, color: 'red', hp: 6, maxHp: 6, attack: 5, gold: 10, speed: 1, detectionRange: 200, exp: 3, lastDirection: 'down' },
    goblin: { id: 2, name: '고블린', width: 32, height: 32, color: 'green', hp: 10, maxHp: 10, attack: 8, gold: 20, speed: 1.5, detectionRange: 250, exp: 5, lastDirection: 'down' },
    orc: { id: 3, name: '오크', width: 32, height: 32, color: 'blue', hp: 16, maxHp: 16, attack: 12, gold: 50, speed: 1, detectionRange: 300, exp: 10, lastDirection: 'down' }
};

const subspeciesMonsters = {
    slime: { ...initialMonsters.slime, name: '아종 슬라임', color: '#FF7F7F', hp: initialMonsters.slime.hp * 3, maxHp: initialMonsters.slime.hp * 3, gold: Math.floor(initialMonsters.slime.gold * 3.5), exp: Math.floor(initialMonsters.slime.exp * 3.5) },
    goblin: { ...initialMonsters.goblin, name: '아종 고블린', color: '#7FFF7F', hp: initialMonsters.goblin.hp * 3, maxHp: initialMonsters.goblin.hp * 3, gold: Math.floor(initialMonsters.goblin.gold * 3.5), exp: Math.floor(initialMonsters.goblin.exp * 3.5) },
    orc: { ...initialMonsters.orc, name: '아종 오크', color: '#7F7FFF', hp: initialMonsters.orc.hp * 3, maxHp: initialMonsters.orc.hp * 3, gold: Math.floor(initialMonsters.orc.gold * 3.5), exp: Math.floor(initialMonsters.orc.exp * 3.5) }
};

const skills = {
    'warrior': {
        weak: { name: '가로배기', manaCost: 3, damage: 3, cooldown: 5000, description: '전방에 있는 적에게 3의 물리 데미지를 줍니다.', damageType: 'physical' },
        strong: { name: '강타', manaCost: 8, damage: 5, cooldown: 10000, range: 120, description: '사거리 내 한 적에게 5의 물리 데미지를 줍니다.', damageType: 'physical' },
        ultimate: { name: '회전베기', manaCost: 20, damage: 10, cooldown: 0, description: '전방위의 적들에게 10의 물리 데미지를 줍니다.', damageType: 'physical' }
    },
    'mage': {
        weak: { name: '파이어볼', manaCost: 10, damage: 4, cooldown: 5000, description: '전방의 적에게 4의 마법 데미지를 줍니다.', damageType: 'magic' },
        strong: { name: '라이트닝', manaCost: 20, damage: 8, cooldown: 10000, description: '원형 범위의 적들에게 8의 마법 데미지를 줍니다.', damageType: 'magic' },
        ultimate: { name: '메테오', manaCost: 100, damage: 20, cooldown: 0, description: '거대한 운석을 떨어뜨려 20의 마법 데미지를 주고 땅을 불태웁니다.', damageType: 'magic' }
    },
    'priest': {
        weak: { name: '힐', manaCost: 8, heal: 10, cooldown: 5000, description: '자신의 HP를 10 회복합니다.' },
        strong: { name: '홀리아머', manaCost: 25, duration: 5000, damageReduction: 0.3, cooldown: 10000, description: '5초간 받는 피해량을 30% 감소시킵니다.' },
        ultimate: { name: '홀리라이트', manaCost: 75, damage: 15, cooldown: 0, description: '성스러운 빛으로 15의 마법 피해를 주고 장판을 생성합니다.', damageType: 'magic' }
    },
    'thief': {
        weak: { name: '단검던지기', manaCost: 7, damage: 3, cooldown: 5000, description: '적을 관통하는 단검을 던져 3의 물리 데미지를 줍니다.', damageType: 'physical' },
        strong: { name: '은신', manaCost: 15, duration: 5000, cooldown: 10000, description: '5초간 몬스터에게 어그로가 끌리지 않습니다.' },
        ultimate: { name: '암살', manaCost: 30, damage: 30, cooldown: 0, description: '단일 대상에게 30의 치명적인 물리 데미지를 입힙니다.', damageType: 'physical' }
    }
};

const shopItems = [
    { id: 'potion', name: 'HP 물약', description: 'HP를 50 회복합니다.', price: 50, type: 'hp', heal: 50 },
    { id: 'smallPotion', name: '작은 HP 물약', description: 'HP를 10 회복합니다.', price: 10, type: 'hp', heal: 10 },
    { id: 'manaPotionSmall', name: '작은 마나 물약', description: '마나를 5 회복합니다.', price: 5, type: 'mana', heal: 5 },
    { id: 'manaPotionMedium', name: '중간 마나 물약', description: '마나를 50 회복합니다.', price: 20, type: 'mana', heal: 50 },
    { id: 'manaPotionLarge', name: '큰 마나 물약', description: '마나를 100 회복합니다.', price: 50, type: 'mana', heal: 100 },
    { id: 'sword', name: '낡은 검', description: '검사 전용. 물리 공격력 7.', price: 100, job: 'warrior', attack: 7, damageType: 'physical', bonusMultiplier: 1.5 },
    { id: 'staff', name: '낡은 지팡이', description: '마법사 전용. 마법 공격력 7.', price: 100, job: 'mage', attack: 7, damageType: 'magic', bonusMultiplier: 1.2 },
    { id: 'cross', name: '낡은 십자가', description: '성직자 전용. 공격력 7.', price: 100, job: 'priest', attack: 7, damageType: 'hybrid', bonusMultiplier: 1.3 },
    { id: 'dagger', name: '낡은 단검', description: '도적 전용. 물리 공격력 7.', price: 100, job: 'thief', attack: 7, damageType: 'physical', bonusMultiplier: 1.5 }
];

window.shopItems = shopItems;