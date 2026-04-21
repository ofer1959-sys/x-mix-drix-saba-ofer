const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    pingTimeout: 60000,
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));

// זיכרון חדרים עמיד
let rooms = {};

io.on('connection', (socket) => {
    socket.on('createRoom', (playerName) => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[roomCode] = {
            players: [{ id: socket.id, name: playerName, symbol: 'X', score: 0 }],
            board: Array(9).fill(''),
            turn: 'X',
            draws: 0,
            active: true
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, symbol: 'X' });
        console.log(`חדר נוצר: ${roomCode}`);
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const cleanCode = roomCode.trim().toUpperCase();
        const room = rooms[cleanCode];

        if (room) {
            if (room.players.length === 1) {
                room.players.push({ id: socket.id, name: playerName, symbol: 'O', score: 0 });
                socket.join(cleanCode);
                socket.emit('roomJoined', { roomCode: cleanCode, symbol: 'O' });
                io.to(cleanCode).emit('gameStarted', room);
            } else if (room.players.length >= 2) {
                // מאפשר לשחקן שהתנתק לחזור לאותו חדר (לפי ה-ID או פשוט לאפשר כניסה)
                socket.emit('errorMsg', 'החדר מלא. צרו חדר חדש.');
            }
        } else {
            socket.emit('errorMsg', 'החדר לא נמצא. וודאו שהקישור תקין.');
        }
    });

    socket.on('makeMove', ({ roomCode, index }) => {
        const room = rooms[roomCode];
        if (room && room.board[index] === '' && room.turn) {
            const player = room.players.find(p => p.id === socket.id);
            if (player && player.symbol === room.turn) {
                room.board[index] = player.symbol;
                room.turn = room.turn === 'X' ? 'O' : 'X';
                io.to(roomCode).emit('updateBoard', room);
            }
        }
    });

    socket.on('playerWon', ({ roomCode, symbol }) => {
        const room = rooms[roomCode];
        if (room) {
            const winner = room.players.find(p => p.symbol === symbol);
            if (winner) winner.score += 1;
            room.board = Array(9).fill('');
            room.turn = 'X'; 
            io.to(roomCode).emit('roundEnded', { room, winnerName: winner.name });
            setTimeout(() => io.to(roomCode).emit('updateBoard', room), 500);
        }
    });

    socket.on('draw', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            room.draws += 1;
            room.board = Array(9).fill('');
            room.turn = 'X';
            io.to(roomCode).emit('roundEnded', { room, winnerName: null });
            setTimeout(() => io.to(roomCode).emit('updateBoard', room), 500);
        }
    });
});

// ניקוי חדרים ישנים רק פעם בשעה
setInterval(() => {
    rooms = {}; 
    console.log("ניקוי זיכרון תקופתי בוצע");
}, 1000 * 60 * 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`שרת רץ על פורט ${PORT}`));
