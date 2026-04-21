const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    pingTimeout: 30000,
    pingInterval: 10000,
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', (playerName) => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[roomCode] = {
            players: [{ id: socket.id, name: playerName, symbol: 'X', score: 0 }],
            board: Array(9).fill(''),
            turn: 'X',
            draws: 0,
            startTime: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
            date: new Date().toLocaleDateString('he-IL')
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, symbol: 'X' });
        console.log(`Room created: ${roomCode}`);
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms[roomCode];
        if (room) {
            if (room.players.length === 1) {
                room.players.push({ id: socket.id, name: playerName, symbol: 'O', score: 0 });
                socket.join(roomCode);
                socket.emit('roomJoined', { roomCode, symbol: 'O' });
                io.to(roomCode).emit('gameStarted', room);
                console.log(`${playerName} joined ${roomCode}`);
            } else {
                socket.emit('errorMsg', 'החדר כבר מלא.');
            }
        } else {
            socket.emit('errorMsg', 'החדר לא נמצא. וודאו שהעתקתם נכון או צרו חדר חדש.');
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
            io.to(roomCode).emit('roundEnded', { room, winnerName: winner.name });
        }
    });

    socket.on('draw', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            room.draws += 1;
            room.board = Array(9).fill('');
            io.to(roomCode).emit('roundEnded', { room, winnerName: null });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
