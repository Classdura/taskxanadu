const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e7 // Увеличиваем лимит для загрузки картинок (10MB)
});

app.use(express.static(path.join(__dirname, 'public')));

// In-memory БД
let users = {};
let rooms = {
    'general-chan': { id: 'general-chan', name: '📢 важные-новости', type: 'channel', creator: 'system' },
    'general-group': { id: 'general-group', name: '💬 Флудилка', type: 'group', creator: 'system' }
};
let messages = {};

io.on('connection', (socket) => {
    console.log(`Пользователь подключился: ${socket.id}`);

    // Инициализация дефолтного профиля
    users[socket.id] = {
        id: socket.id,
        username: `User_${socket.id.substring(0, 5)}`,
        avatar: '',
        statusEmoji: '🐱',
        nameColor: '#ffffff',
        borderColor: '#5865f2'
    };

    // Отправляем базовые данные подключенному юзеру
    socket.emit('init', { currentUser: users[socket.id], users, rooms });

    // Обновление профиля
    socket.on('update_profile', (data) => {
        if (users[socket.id]) {
            users[socket.id] = { ...users[socket.id], ...data };
            io.emit('user_updated', users[socket.id]);
        }
    });

    // Создание новой комнаты/чата
    socket.on('create_room', ({ name, type }) => {
        const roomId = '_' + Math.random().toString(36).substr(2, 9);
        rooms[roomId] = {
            id: roomId,
            name: type === 'channel' ? `📢 ${name}` : (type === 'group' ? `💬 ${name}` : `🔒 ${name}`),
            type,
            creator: socket.id
        };
        io.emit('room_created', rooms[roomId]);
    });

    // Вход в комнату
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        if (!messages[roomId]) messages[roomId] = [];
        socket.emit('chat_history', messages[roomId]);
    });

    // Отправка сообщения
    socket.on('send_message', ({ roomId, text, media }) => {
        const room = rooms[roomId];
        if (!room) return;

        // Проверка прав для каналов
        if (room.type === 'channel' && room.creator !== socket.id) {
            socket.emit('error_message', 'Только администраторы могут писать в этот канал!');
            return;
        }

        const msg = {
            id: '_' + Math.random().toString(36).substr(2, 9),
            user: users[socket.id],
            text,
            media, // base64 или url
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (!messages[roomId]) messages[roomId] = [];
        messages[roomId].push(msg);

        io.to(roomId).emit('new_message', { roomId, msg });
    });

    socket.on('disconnect', () => {
        console.log(`Пользователь отключился: ${socket.id}`);
        delete users[socket.id];
        io.emit('user_disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
