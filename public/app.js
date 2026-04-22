const socket = io();
let mySymbol = '';
let currentRoomCode = '';
let roomData = null;

// תיקון אודיו לאייפון: "פתיחת" האודיו בלחיצה הראשונה של המשתמש
function unlockAudio() {
    if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(msg);
    }
}

const screens = {
    lobby: document.getElementById('lobby'),
    invite: document.getElementById('inviteJoinScreen'),
    waiting: document.getElementById('waitingScreen'),
    game: document.getElementById('gameScreen'),
    results: document.getElementById('resultsScreen')
};

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

document.getElementById('createBtn').onclick = () => {
    unlockAudio();
    const name = document.getElementById('playerName').value || 'סבא עופר';
    socket.emit('createRoom', name);
};

document.getElementById('inviteJoinBtn').onclick = () => {
    unlockAudio();
    const name = document.getElementById('invitePlayerName').value || 'אורח/ת';
    socket.emit('joinRoom', { roomCode: currentRoomCode, playerName: name });
};

// קבלת תוצאות סופיות לשני השחקנים
socket.on('gameOver', ({ room, endTime }) => {
    roomData = room;
    const p1 = room.players[0], p2 = room.players[1];
    const total = p1.score + p2.score + room.draws;
    let winLine = p1.score > p2.score ? `המנצח: ${p1.name}` : p2.score > p1.score ? `המנצחת: ${p2.name}` : "התוצאה: תיקו - כולנו נהנינו!";

    const resultsHtml = `
        <p>תאריך: ${room.startDate}</p>
        <p>זמן: ${room.startTime} - ${endTime}</p>
        <hr>
        <p><strong>${p1.name}:</strong> ${p1.score} ניצחונות</p>
        <p><strong>${p2.name}:</strong> ${p2.score} ניצחונות</p>
        <p><strong>תיקו:</strong> ${room.draws}</p>
        <hr>
        <h3>${winLine}</h3>
    `;
    document.getElementById('finalStats').innerHTML = resultsHtml;
    
    // הגדרת כפתור הווטסאפ עם הנוסח המלא
    document.getElementById('finalWhatsAppBtn').onclick = () => {
        const msg = `🎮 סיכום איקס מיקס דריקס של סבא עופר!\n` +
                    `📅 תאריך: ${room.startDate}\n` +
                    `⏰ שעות: ${room.startTime} - ${endTime}\n` +
                    `-------------------\n` +
                    `🏆 ${p1.name}: ${p1.score}\n` +
                    `🏆 ${p2.name}: ${p2.score}\n` +
                    `🤝 תיקו: ${room.draws}\n` +
                    `-------------------\n` +
                    `${winLine}. ✨`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`);
    };
    
    showScreen('results');
});

document.getElementById('requestEndBtn').onclick = () => {
    socket.emit('requestEndGame', currentRoomCode);
};

// שאר הפונקציות (updateUI, makeMove וכו') נשארות כפי שהיו
socket.on('roomCreated', (data) => { mySymbol = 'X'; currentRoomCode = data.roomCode; document.getElementById('inviteCode').innerText = currentRoomCode; showScreen('waiting'); });
socket.on('roomJoined', (data) => { mySymbol = 'O'; currentRoomCode = data.roomCode; showScreen('game'); });
socket.on('gameStarted', (room) => { roomData = room; showScreen('game'); updateUI(); });
socket.on('updateBoard', (room) => { roomData = room; updateUI(); });

function updateUI() {
    if (!roomData) return;
    roomData.board.forEach((val, i) => {
        const cell = document.querySelector(`.cell[data-index="${i}"]`);
        cell.innerText = val;
        cell.className = `cell ${val ? val.toLowerCase() : ''}`;
    });
    const turnInd = document.getElementById('turnIndicator');
    if (roomData.turn === mySymbol) {
        turnInd.innerText = "תורך!"; turnInd.style.color = "#2ecc71";
    } else {
        const other = roomData.players.find(p => p.symbol !== mySymbol);
        turnInd.innerText = `התור של ${other ? other.name : 'השני'}...`; turnInd.style.color = "#95a5a6";
    }
    const p1 = roomData.players[0], p2 = roomData.players[1];
    if (p1 && p2) document.getElementById('scoreText').innerText = `${p1.name} ${p1.score} - ${p2.score} ${p2.name}`;
}

document.querySelectorAll('.cell').forEach(cell => {
    cell.onclick = () => {
        const idx = cell.getAttribute('data-index');
        if (roomData && roomData.turn === mySymbol && roomData.board[idx] === '') {
            socket.emit('makeMove', { roomCode: currentRoomCode, index: parseInt(idx) });
        }
    };
});

socket.on('roundEnded', ({ room, winnerName }) => {
    roomData = room; updateUI();
    if (winnerName) {
        document.getElementById('winMessage').innerText = `כל הכבוד ${winnerName}!`;
        document.getElementById('winPopup').classList.remove('hidden');
        confetti({ particleCount: 150, spread: 70 });
        if ('speechSynthesis' in window) {
            const ut = new SpeechSynthesisUtterance(`כל הכבוד ${winnerName}`);
            ut.lang = 'he-IL'; window.speechSynthesis.speak(ut);
        }
        setTimeout(() => document.getElementById('winPopup').classList.add('hidden'), 3000);
    } else { alert("תיקו!"); }
});

socket.on('errorMsg', (m) => alert(m));
window.addEventListener('load', () => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get('room');
    if (r) { currentRoomCode = r.toUpperCase(); document.getElementById('invitedRoomDisplay').innerText = currentRoomCode; showScreen('invite'); }
});
document.getElementById('inviteWhatsAppBtn').onclick = () => {
    const url = `${window.location.origin}?room=${currentRoomCode}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent('בוא לשחק איתי! ' + url)}`);
};
