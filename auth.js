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
            alert(getTranslation('enter_username_password'));
            return;
        }

        const users = JSON.parse(localStorage.getItem('users')) || {};
        if (users[username]) {
            alert(getTranslation('username_exists'));
            return;
        }

        users[username] = { password: password };
        localStorage.setItem('users', JSON.stringify(users));
        alert(getTranslation('register_success'));
    }

    function loginUser(username, password) {
        if (!username || !password) {
            alert(getTranslation('enter_username_password'));
            return;
        }

        const users = JSON.parse(localStorage.getItem('users')) || {};
        if (!users[username] || users[username].password !== password) {
            alert(getTranslation('login_fail'));
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