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

// פונקציית העזר לשליחת המייל 
async function sendResultsEmail(room, endTime) {
    console.log(`[מייל] מתחיל בדיקה לחדר ${room.roomCode}...`);
    
    if (room.emailSent) {
        console.log(`[מייל] בוטל: המייל כבר נשלח עבור חדר זה.`);
        return; 
    }

    const p1 = room.players[0];
    const p2 = room.players[1] || { name: 'שחקן 2', score: 0 };
    const totalGames = p1.score + p2.score + room.draws;

    console.log(`[מייל] סך הכל משחקים שהסתיימו: ${totalGames}`);

    if (totalGames === 0) {
        console.log(`[מייל] בוטל: לא שוחקו משחקים מלאים (0 ניצחונות/תיקו).`);
        return; 
    }

    let winnerName = "תיקו - כולם נהנו!";
    if (p1.score > p2.score) winnerName = p1.name;
    else if (p2.score > p1.score) winnerName = p2.name;

    // התיקון: הגדרה מפורשת וקשוחה של שרתי גוגל
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // שימוש באבטחה מלאה
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER, 
        subject: 'תוצאות משחק איקס מיקס דריקס',
        text: `
שלום עופר, 

להלן סיכום התחרות שהסתיימה זה עתה:

שמות השחקנים: ${p1.name} ו-${p2.name}
כמות משחקים ששוחקו: ${totalGames}
-------------------------------
ניצחונות ל-${p1.name}: ${p1.score}
ניצחונות ל-${p2.name}: ${p2.score}
תוצאות תיקו: ${room.draws}
-------------------------------
המנצח הגדול: ${winnerName}

תאריך: ${room.startDate}
שעת התחלה: ${room.startTime}
שעת סיום: ${endTime || new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}

בברכה,
מערכת איקס מיקס דריקס
        `
    };

    try {
        console.log(`[מייל] מנסה לשלוח הודעה לכתובת: ${process.env.EMAIL_USER}...`);
        await transporter.sendMail(mailOptions);
        room.emailSent = true;
        console.log("[מייל] ✅ נשלח בהצלחה!");
    } catch (error) {
        console.error("[מייל] ❌ שגיאה בשליחת המייל:", error);
    }
}

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
            draws: 0, firstPlayerOfRound: 'X', emailSent: false,
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
            draws: 0, firstPlayerOfRound: 'X', emailSent: false,
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

    // התיקון: מחכים לשליחת המייל לפני מחיקת החדר (async/await)
    socket.on('requestEndGame', async (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            const endTime = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            await sendResultsEmail(room, endTime); 
            io.to(roomCode).emit('gameOver', { room, endTime });
            delete rooms[roomCode];
        }
    });

    socket.on('disconnect', async () => {
        for (const code in rooms) {
            const room = rooms[code];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                await sendResultsEmail(room, null);
                delete rooms[code];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
