document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 요소 ---
    const playerHpEl = document.getElementById('player-hp');
    const monsterNameEl = document.getElementById('monster-name');
    const monsterHpEl = document.getElementById('monster-hp');
    const logWindow = document.getElementById('log-window');
    const battleContainer = document.getElementById('battle-container'); // 전투 컨테이너

    // --- 전투 데이터 ---
    let player = {};
    let monster = {};
    let returnUrl = '';
    let isBattleOver = false;
    let isDefending = false; // 방어 상태 플래그
    let monsterAttackInterval;

    const allMonsters = {
        1: { id: 1, name: '슬라임', x: 0, y: 0, width: 32, height: 32, color: 'red', hp: 30, attack: 5, gold: 10 },
        2: { id: 2, name: '고블린', x: 0, y: 0, width: 32, height: 32, color: 'green', hp: 50, attack: 8, gold: 20 },
        3: { id: 3, name: '오크', x: 0, y: 0, width: 32, height: 32, color: 'blue', hp: 80, attack: 12, gold: 50 }
    };

    // --- 함수 ---
    function logMessage(message, color = 'white') {
        const p = document.createElement('p');
        p.textContent = message;
        p.style.color = color;
        logWindow.appendChild(p);
        logWindow.scrollTop = logWindow.scrollHeight;
    }

    function updateUI() {
        playerHpEl.textContent = Math.ceil(player.hp); // 체력은 올림하여 표시
        monsterNameEl.textContent = monster.name;
        monsterHpEl.textContent = monster.hp;
    }

    function endBattle(isVictory) {
        if (isBattleOver) return;
        isBattleOver = true;
        clearInterval(monsterAttackInterval); // 몬스터 공격 중지

        const result = {
            player: player,
            defeatedMonsterId: isVictory ? monster.id : null
        };
        localStorage.setItem('battleResult', JSON.stringify(result));
        localStorage.removeItem('battleState');

        logMessage(isVictory ? "승리! 2초 후 맵으로 돌아갑니다." : "패배... 2초 후 맵으로 돌아갑니다.", isVictory ? 'lime' : 'red');
        setTimeout(() => {
            window.location.href = returnUrl;
        }, 2000);
    }

    function playerAttack() {
        if (isBattleOver) return;

        const playerDamage = 1; // 고정 데미지 1
        monster.hp -= playerDamage;
        logMessage(`플레이어의 공격! ${monster.name}에게 ${playerDamage}의 데미지.`, 'cyan');

        if (monster.hp <= 0) {
            monster.hp = 0;
            updateUI();
            endBattle(true);
        } else {
            updateUI();
        }
    }

    function monsterAttack() {
        if (isBattleOver) return;

        let monsterDamage = monster.attack;
        if (isDefending) {
            monsterDamage *= 0.5; // 방어 시 데미지 50% 감소
            logMessage(`${monster.name}의 공격! 방어하여 ${monsterDamage.toFixed(1)}의 데미지를 받았다.`, 'yellow');
        } else {
            logMessage(`${monster.name}의 공격! 플레이어에게 ${monsterDamage}의 데미지.`, 'orange');
        }
        
        player.hp -= monsterDamage;

        if (player.hp <= 0) {
            player.hp = 0;
            updateUI();
            endBattle(false);
        } else {
            updateUI();
        }
    }

    // --- 이벤트 리스너 ---
    battleContainer.addEventListener('mousedown', (e) => {
        if (isBattleOver) return;
        if (e.button === 0) { // 좌클릭
            playerAttack();
        } else if (e.button === 2) { // 우클릭
            isDefending = true;
            logMessage("방어 자세를 취합니다.", "lightblue");
        }
    });

    battleContainer.addEventListener('mouseup', (e) => {
        if (isBattleOver) return;
        if (e.button === 2) { // 우클릭 해제
            isDefending = false;
            logMessage("방어 자세를 풉니다.", "lightblue");
        }
    });

    // 우클릭 메뉴 방지
    battleContainer.addEventListener('contextmenu', (e) => e.preventDefault());


    // --- 전투 시작 ---
    function init() {
        const battleStateJSON = localStorage.getItem('battleState');
        if (!battleStateJSON) {
            localStorage.setItem('failedBattleEntry', 'true');
            window.location.href = 'index.html';
            return;
        }

        const battleState = JSON.parse(battleStateJSON);
        player = battleState.player;
        player.hp = 100; // 플레이어 체력을 100으로 설정
        monster = { ...allMonsters[battleState.monsterId] }; // 몬스터 정보 복사
        returnUrl = battleState.returnUrl;

        logMessage(`${monster.name}과의 전투 시작!`);
        updateUI();

        // 1.5초마다 몬스터가 공격
        monsterAttackInterval = setInterval(monsterAttack, 1500);
    }

    init();
});