const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

// פונקציה חרישית לשליחת המייל
async function sendResultsEmailSilent(room, endTime) {
    if (room.emailSent || (room.players[0].score + (room.players[1]?.score || 0) + room.draws === 0)) return;

    const p1 = room.players[0];
    const p2 = room.players[1] || { name: 'שחקן 2', score: 0 };
    const winMsg = p1.score > p2.score ? p1.name : p2.score > p1.score ? p2.name : "תיקו";

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: 'תוצאות משחק איקס מיקס דריקס',
        text: `סיכום תחרות:\n\nשחקנים: ${p1.name} ו-${p2.name}\nניצחונות ${p1.name}: ${p1.score}\nניצחונות ${p2.name}: ${p2.score}\nתיקו: ${room.draws}\nהמנצח: ${winMsg}\n\nתאריך: ${room.startDate}\nזמן: ${room.startTime} - ${endTime || 'סגירת דפדפן'}`
    };

    try {
        await transporter.sendMail(mailOptions);
        room.emailSent = true;
        console.log("Email sent silently.");
    } catch (e) { console.log("Email failed silently."); }
}

const winningCombos = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function checkWin(board) {
    for (let c of winningCombos) {
        if (board[c[0]] && board[c[0]] === board[c[1]] && board[c[0]] === board[c[2]]) return board[c[0]];
    }
    return null;
}

io.on('connection', (socket) => {
    socket.on('createRoom', (name) => {
        const code = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[code] = { roomCode: code, isLocal: false, players: [{id: socket.id, name, symbol: 'X', score: 0}], board: Array(9).fill(''), turn: 'X', draws: 0, firstPlayerOfRound: 'X', emailSent: false, startTime: new Date().toLocaleTimeString('he-IL'), startDate: new Date().toLocaleDateString('he-IL') };
        socket.join(code);
        socket.emit('roomCreated', { roomCode: code });
    });

    socket.on('createLocalRoom', ({ p1Name, p2Name }) => {
        const code = 'LOCAL_' + Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[code] = { roomCode: code, isLocal: true, hostSocket: socket.id, players: [{id: socket.id, name: p1Name, symbol: 'X', score: 0}, {id: socket.id, name: p2Name, symbol: 'O', score: 0}], board: Array(9).fill(''), turn: 'X', draws: 0, firstPlayerOfRound: 'X', emailSent: false, startTime: new Date().toLocaleTimeString('he-IL'), startDate: new Date().toLocaleDateString('he-IL') };
        socket.join(code);
        socket.emit('localGameStarted', rooms[code]);
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms[roomCode.toUpperCase()];
        if (room && room.players.length === 1) {
            room.players.push({id: socket.id, name: playerName, symbol: 'O', score: 0});
            socket.join(roomCode.toUpperCase());
            socket.emit('roomJoined', {roomCode: roomCode.toUpperCase()});
            io.to(roomCode.toUpperCase()).emit('gameStarted', room);
        }
    });

    socket.on('makeMove', ({ roomCode, index }) => {
        const room = rooms[roomCode];
        if (room && room.board[index] === '') {
            room.board[index] = room.turn;
            const win = checkWin(room.board);
            if (win) {
                const winner = room.players.find(p => p.symbol === win);
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

    socket.on('requestEndGame', (code) => {
        const room = rooms[code];
        if (room) {
            const endTime = new Date().toLocaleTimeString('he-IL');
            sendResultsEmailSilent(room, endTime);
            io.to(code).emit('gameOver', { room, endTime });
            delete rooms[code];
        }
    });

    socket.on('disconnect', () => {
        for (const code in rooms) {
            if (rooms[code].players.some(p => p.id === socket.id)) {
                sendResultsEmailSilent(rooms[code], null);
                delete rooms[code];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running`));
