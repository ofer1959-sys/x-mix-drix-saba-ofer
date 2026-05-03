const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

const winningCombos = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function checkWin(board) {
    for (let combo of winningCombos) {
        const [a, b, c] = combo;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return null;
}

io.on('connection', (socket) => {
    socket.on('createRoom', (playerName) => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[roomCode] = {
            roomCode, isLocal: false, board: Array(9).fill(''), turn: 'X',
            players: [{ id: socket.id, name: playerName, symbol: 'X', score: 0 }],
            draws: 0, firstPlayerOfRound: 'X',
            startTime: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
            startDate: new Date().toLocaleDateString('he-IL')
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode });
    });

    socket.on('createLocalRoom', ({ p1Name, p2Name }) => {
        const roomCode = 'LOCAL_' + Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[roomCode] = {
            roomCode, isLocal: true, hostSocket: socket.id, board: Array(9).fill(''), turn: 'X',
            players: [{ id: socket.id, name: p1Name, symbol: 'X', score: 0 }, { id: socket.id, name: p2Name, symbol: 'O', score: 0 }],
            draws: 0, firstPlayerOfRound: 'X',
            startTime: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
            startDate: new Date().toLocaleDateString('he-IL')
        };
        socket.join(roomCode);
        socket.emit('localGameStarted', rooms[roomCode]);
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms[roomCode.toUpperCase()];
        if (room && room.players.length === 1) {
            room.players.push({ id: socket.id, name: playerName, symbol: 'O', score: 0 });
            socket.join(roomCode.toUpperCase());
            socket.emit('roomJoined', { roomCode: roomCode.toUpperCase() });
            io.to(roomCode.toUpperCase()).emit('gameStarted', room);
        }
    });

    socket.on('makeMove', ({ roomCode, index }) => {
        const room = rooms[roomCode];
        if (room && room.board[index] === '') {
            room.board[index] = room.turn;
            const winnerSymbol = checkWin(room.board);
            if (winnerSymbol) {
                const winner = room.players.find(p => p.symbol === winnerSymbol);
                winner.score++;
                room.firstPlayerOfRound = room.firstPlayerOfRound === 'X' ? 'O' : 'X';
                room.turn = room.firstPlayerOfRound;
                room.board = Array(9).fill('');
                io.to(roomCode).emit('roundEnded', { room, winnerName: winner.name });
            } else if (!room.board.includes('')) {
                room.draws++;
                room.firstPlayerOfRound = room.firstPlayerOfRound === 'X' ? 'O' : 'X';
                room.turn = room.firstPlayerOfRound;
                room.board = Array(9).fill('');
                io.to(roomCode).emit('roundEnded', { room, winnerName: null });
            } else {
                room.turn = room.turn === 'X' ? 'O' : 'X';
                io.to(roomCode).emit('updateBoard', room);
            }
        }
    });

    socket.on('requestEndGame', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            const endTime = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            io.to(roomCode).emit('gameOver', { room, endTime });
            delete rooms[roomCode];
        }
    });

    socket.on('disconnect', () => {
        for (const code in rooms) {
            if (rooms[code].players.some(p => p.id === socket.id)) {
                delete rooms[code];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
