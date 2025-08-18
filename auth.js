document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('login-screen');
    const startScreen = document.getElementById('start-screen');
    const usernameInput = document.getElementById('username-input');
    const passwordInput = document.getElementById('password-input');
    const loginButton = document.getElementById('login-button');
    const registerButton = document.getElementById('register-button');

    let currentUser = null;

    function registerUser(username, password) {
        if (!username || !password) {
            alert('사용자 이름과 비밀번호를 모두 입력해주세요.');
            return;
        }

        const users = JSON.parse(localStorage.getItem('users')) || {};
        if (users[username]) {
            alert('이미 존재하는 사용자 이름입니다.');
            return;
        }

        users[username] = { password: password };
        localStorage.setItem('users', JSON.stringify(users));
        alert('회원가입이 완료되었습니다. 이제 로그인해주세요.');
    }

    function loginUser(username, password) {
        if (!username || !password) {
            alert('사용자 이름과 비밀번호를 모두 입력해주세요.');
            return;
        }

        const users = JSON.parse(localStorage.getItem('users')) || {};
        if (!users[username] || users[username].password !== password) {
            alert('사용자 이름 또는 비밀번호가 올바르지 않습니다.');
            return;
        }

        currentUser = username;
        sessionStorage.setItem('currentUser', currentUser);
        loginScreen.style.display = 'none';
        startScreen.style.display = 'block';
    }

    loginButton.addEventListener('click', () => {
        loginUser(usernameInput.value.trim(), passwordInput.value.trim());
    });

    registerButton.addEventListener('click', () => {
        registerUser(usernameInput.value.trim(), passwordInput.value.trim());
    });
});