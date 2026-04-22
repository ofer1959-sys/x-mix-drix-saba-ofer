const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

// כל האפשרויות לניצחון בלוח
const winningCombos = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // שורות
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // עמודות
    [0, 4, 8], [2, 4, 6]             // אלכסונים
];

function checkWin(board) {
    for (let combo of winningCombos) {
        const [a, b, c] = combo;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a]; // מחזיר 'X' או 'O'
        }
    }
    return null;
}

io.on('connection', (socket) => {
    socket.on('createRoom', (playerName) => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[roomCode] = {
            players: [{ id: socket.id, name: playerName, symbol: 'X', score: 0 }],
            board: Array(9).fill(''),
            turn: 'X',
            firstPlayerOfRound: 'X',
            draws: 0,
            startTime: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
            startDate: new Date().toLocaleDateString('he-IL')
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode });
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const cleanCode = roomCode.trim().toUpperCase();
        const room = rooms[cleanCode];
        if (room && room.players.length === 1) {
            room.players.push({ id: socket.id, name: playerName, symbol: 'O', score: 0 });
            socket.join(cleanCode);
            socket.emit('roomJoined', { roomCode: cleanCode });
            io.to(cleanCode).emit('gameStarted', room);
        } else {
            socket.emit('errorMsg', 'החדר לא נמצא או כבר מלא.');
        }
    });

    socket.on('makeMove', ({ roomCode, index }) => {
        const room = rooms[roomCode];
        if (room && room.board[index] === '' && room.turn) {
            const player = room.players.find(p => p.id === socket.id);
            if (player && player.symbol === room.turn) {
                // 1. מבצעים את המהלך בלוח
                room.board[index] = player.symbol;

                // 2. השופט (השרת) בודק אם יש מנצח עכשיו
                const winnerSymbol = checkWin(room.board);

                if (winnerSymbol) {
                    // יש מנצח!
                    const winner = room.players.find(p => p.symbol === winnerSymbol);
                    if (winner) winner.score += 1;
                    
                    room.firstPlayerOfRound = (room.firstPlayerOfRound === 'X') ? 'O' : 'X';
                    room.turn = room.firstPlayerOfRound;
                    room.board = Array(9).fill('');
                    
                    io.to(roomCode).emit('roundEnded', { room, winnerName: winner.name });
                } 
                else if (!room.board.includes('')) {
                    // מצב של תיקו
                    room.draws += 1;
                    room.firstPlayerOfRound = (room.firstPlayerOfRound === 'X') ? 'O' : 'X';
                    room.turn = room.firstPlayerOfRound;
                    room.board = Array(9).fill('');
                    
                    io.to(roomCode).emit('roundEnded', { room, winnerName: null });
                } 
                else {
                    // המשחק ממשיך, מעבירים תור
                    room.turn = room.turn === 'X' ? 'O' : 'X';
                    io.to(roomCode).emit('updateBoard', room);
                }
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
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running`));
