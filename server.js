const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingTimeout: 30000, cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

io.on('connection', (socket) => {
    socket.on('createRoom', (playerName) => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[roomCode] = {
            players: [{ id: socket.id, name: playerName, symbol: 'X', score: 0 }],
            board: Array(9).fill(''),
            turn: 'X',
            draws: 0,
            startTime: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, symbol: 'X' });
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms[roomCode];
        if (room && room.players.length === 1) {
            room.players.push({ id: socket.id, name: playerName, symbol: 'O', score: 0 });
            socket.join(roomCode);
            socket.emit('roomJoined', { roomCode, symbol: 'O' });
            io.to(roomCode).emit('gameStarted', room);
        } else {
            socket.emit('errorMsg', 'חדר לא נמצא או מלא');
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
            room.turn = 'X'; // תמיד X מתחיל סיבוב חדש כדי למנוע בלבול
            io.to(roomCode).emit('roundEnded', { room, winnerName: winner.name });
            // שליחת עדכון לוח נוסף אחרי חצי שנייה כדי לוודא סנכרון
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

    socket.on('disconnect', () => {
        for (const code in rooms) {
            rooms[code].players = rooms[code].players.filter(p => p.id !== socket.id);
            if (rooms[code].players.length === 0) delete rooms[code];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server on ${PORT}`));
