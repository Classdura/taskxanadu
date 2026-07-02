const socket = io();

// Глобальное состояние на клиенте
let myId = null;
let currentRoomId = null;
let allUsers = {};

const emojis = ['😀','😂','🥰','😎','🔥','👍','🎉','🚀','👀','💩','👑','💡'];

// Элементы DOM
const roomsList = document.getElementById('rooms-list');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const currentRoomTitle = document.getElementById('current-room-title');
const membersList = document.getElementById('members-list');
const emojiPicker = document.getElementById('emoji-picker');

// Инициализация
socket.on('init', ({ currentUser, users, rooms }) => {
    myId = currentUser.id;
    allUsers = users;
    
    updateMyProfileUI(currentUser);
    
    // Рендер комнат
    roomsList.innerHTML = '';
    Object.values(rooms).forEach(room => renderRoom(room));
    
    // Рендер мемберов
    renderMembers();

    // Авто-вход в первую комнату
    const firstRoom = Object.keys(rooms)[0];
    if (firstRoom) selectRoom(firstRoom, rooms[firstRoom].name);
});

// Обновление списка юзеров
socket.on('user_updated', (user) => {
    allUsers[user.id] = user;
    if (user.id === myId) updateMyProfileUI(user);
    renderMembers();
});

socket.on('user_disconnected', (id) => {
    delete allUsers[id];
    renderMembers();
});

// Работа с комнатами
function renderRoom(room) {
    const div = document.createElement('div');
    div.className = `room-item ${room.id === currentRoomId ? 'active' : ''}`;
    div.id = `room-${room.id}`;
    div.innerText = room.name;
    div.onclick = () => selectRoom(room.id, room.name);
    roomsList.appendChild(div);
}

function selectRoom(roomId, roomName) {
    currentRoomId = roomId;
    currentRoomTitle.innerText = roomName;
    
    document.querySelectorAll('.room-item').forEach(el => el.classList.remove('active'));
    const activeRoomEl = document.getElementById(`room-${roomId}`);
    if (activeRoomEl) activeRoomEl.classList.add('active');

    messagesContainer.innerHTML = '';
    socket.emit('join_room', roomId);
    
    // Закрываем шторку на мобилках при выборе чата
    document.getElementById('sidebar').classList.remove('open');
}

socket.on('room_created', (room) => {
    renderRoom(room);
});

// Сообщения
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && !selectedMedia) return;

    socket.emit('send_message', {
        roomId: currentRoomId,
        text: text,
        media: selectedMedia || null
    });

    messageInput.value = '';
    selectedMedia = null;
}

sendBtn.onclick = sendMessage;
messageInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

socket.on('new_message', ({ roomId, msg }) => {
    if (roomId === currentRoomId) {
        renderMessage(msg);
    }
});

socket.on('chat_history', (history) => {
    messagesContainer.innerHTML = '';
    history.forEach(msg => renderMessage(msg));
});

socket.on('error_message', (alertText) => {
    alert(alertText);
});

function renderMessage(msg) {
    // Получаем актуальные данные автора из локальной памяти
    const author = allUsers[msg.user.id] || msg.user;
    
    const card = document.createElement('div');
    card.className = 'message-card';
    
    let mediaHtml = '';
    if (msg.media) {
        mediaHtml = `<img src="${msg.media}" class="msg-media" />`;
    }

    card.innerHTML = `
        <div class="avatar-wrapper" style="border-color: ${author.borderColor}">
            <img src="${author.avatar || 'https://via.placeholder.com/40'}" alt="av">
        </div>
        <div class="msg-content">
            <div class="msg-header">
                <span class="msg-username" style="color: ${author.nameColor}">${author.username} ${author.statusEmoji || ''}</span>
                <span class="msg-time">${msg.timestamp}</span>
            </div>
            <div class="msg-text">${msg.text}</div>
            ${mediaHtml}
        </div>
    `;
    messagesContainer.appendChild(card);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Рендер участников
function renderMembers() {
    membersList.innerHTML = '';
    Object.values(allUsers).forEach(user => {
        const div = document.createElement('div');
        div.className = 'member-item';
        div.innerHTML = `
            <div class="avatar-wrapper" style="border-color: ${user.borderColor}; width: 28px; height: 28px;">
                <img src="${user.avatar || 'https://via.placeholder.com/40'}" alt="av">
            </div>
            <span style="color: ${user.nameColor}; font-weight: 500;">${user.username} ${user.statusEmoji}</span>
        `;
        membersList.appendChild(div);
    });
}

function updateMyProfileUI(user) {
    document.getElementById('my-username').innerText = user.username;
    document.getElementById('my-avatar').src = user.avatar || 'https://via.placeholder.com/40';
    document.getElementById('my-avatar-wrapper').style.borderColor = user.borderColor;
    document.getElementById('my-status').innerText = `${user.statusEmoji} Настройки`;
}

// Работа с медиа (Картинки / GIF)
let selectedMedia = null;
document.getElementById('file-input').onchange = function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            selectedMedia = event.target.result; // Base64 строка контента
            sendMessage(); // Отправляем сразу после выбора файла
        };
        reader.readAsDataURL(file);
    }
};

// Модальное окно профиля
const settingsModal = document.getElementById('settings-modal');
document.getElementById('open-settings-btn').onclick = () => {
    const me = allUsers[myId];
    document.getElementById('settings-username').value = me.username;
    document.getElementById('settings-avatar-url').value = me.avatar;
    document.getElementById('settings-emoji').value = me.statusEmoji;
    document.getElementById('settings-name-color').value = me.nameColor;
    document.getElementById('settings-border-color').value = me.borderColor;
    settingsModal.classList.remove('hidden');
};

document.getElementById('close-settings-modal').onclick = () => settingsModal.classList.add('hidden');

document.getElementById('save-settings-btn').onclick = () => {
    const data = {
        username: document.getElementById('settings-username').value,
        avatar: document.getElementById('settings-avatar-url').value,
        statusEmoji: document.getElementById('settings-emoji').value,
        nameColor: document.getElementById('settings-name-color').value,
        borderColor: document.getElementById('settings-border-color').value
    };
    socket.emit('update_profile', data);
    settingsModal.classList.add('hidden');
};

// Модальное окно создания комнат
const roomModal = document.getElementById('room-modal');
document.getElementById('add-room-btn').onclick = () => roomModal.classList.remove('hidden');
document.getElementById('close-room-modal').onclick = () => roomModal.classList.add('hidden');
document.getElementById('confirm-room-btn').onclick = () => {
    const name = document.getElementById('new-room-name').value.trim();
    const type = document.getElementById('new-room-type').value;
    if(name) {
        socket.emit('create_room', { name, type });
        roomModal.classList.add('hidden');
        document.getElementById('new-room-name').value = '';
    }
};

// Смайлики для инпута сообщений
emojis.forEach(emoji => {
    const span = document.createElement('span');
    span.className = 'emoji-item';
    span.innerText = emoji;
    span.onclick = () => {
        messageInput.value += emoji;
        emojiPicker.classList.add('hidden');
        messageInput.focus();
    };
    emojiPicker.appendChild(span);
});
document.getElementById('emoji-trigger').onclick = () => emojiPicker.classList.toggle('hidden');

// Адаптивное Бургер-меню
document.getElementById('menu-btn').onclick = () => document.getElementById('sidebar').classList.add('open');
document.getElementById('close-sidebar-btn').onclick = () => document.getElementById('sidebar').classList.remove('open');
