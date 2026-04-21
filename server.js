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

// זיכרון חדרים - עכשיו הוא עמיד יותר
let rooms = {};

io.on('connection', (socket) => {
    socket.on('createRoom', (playerName) => {
        // יצירת קוד ייחודי
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[roomCode] = {
            players: [{ id: socket.id, name: playerName, symbol: 'X', score: 0 }],
            board: Array(9).fill(''),
            turn: 'X',
            draws: 0,
            createdAt: Date.now()
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, symbol: 'X' });
        console.log(`חדר נוצר: ${roomCode}`);
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const cleanCode = roomCode.trim().toUpperCase();
        const room = rooms[cleanCode];

        if (room) {
            // אם השחקן השני מצטרף
            if (room.players.length === 1) {
                room.players.push({ id: socket.id, name: playerName, symbol: 'O', score: 0 });
                socket.join(cleanCode);
                socket.emit('roomJoined', { roomCode: cleanCode, symbol: 'O' });
                io.to(cleanCode).emit('gameStarted', room);
            } 
            // אם השחקן הראשון התנתק וחזר (זיהוי לפי שם או פשוט לאפשר כניסה)
            else if (room.players.length >= 2) {
                socket.emit('errorMsg', 'החדר כבר מלא. נסו ליצור חדר חדש.');
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

// ניקוי חדרים ישנים מאוד פעם בשעה (כדי לא להעמיס את השרת)
setInterval(() => {
    const now = Date.now();
    for (let code in rooms) {
        if (now - rooms[code].createdAt > 1000 * 60 * 60) { // שעה אחת
            delete rooms[code];
        }
    }
}, 1000 * 60 * 15);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
