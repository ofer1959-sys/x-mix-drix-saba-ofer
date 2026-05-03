const socket = io();
let mySymbol = ''; 
let currentRoomCode = '';
let roomData = null;

// פתיחת אודיו לאייפון
function unlockAudio() {
    if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(msg);
    }
}

function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(name).classList.add('active');
}

// === התיקון: הכרחת פתיחת חלון המשחק המקומי ===
document.getElementById('btnChooseLocal').onclick = function() {
    const section = document.getElementById('localPlaySection');
    
    // מוודא שהחלון נפתח ישירות ללא תלות בעיצוב הקודם
    if (section.style.display === 'block') {
        section.style.display = 'none';
    } else {
        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth' });
    }
};

document.getElementById('btnChooseRemote').onclick = function() {
    unlockAudio();
    const name = document.getElementById('playerName').value.trim() || 'סבא עופר';
    socket.emit('createRoom', name);
};

document.getElementById('localPlayBtn').onclick = function() {
    unlockAudio();
    const p1 = document.getElementById('playerName').value.trim() || 'סבא עופר';
    const p2 = document.getElementById('localPlayer2Name').value.trim() || 'נכד/ה';
    socket.emit('createLocalRoom', { p1Name: p1, p2Name: p2 });
};

document.getElementById('joinBtn').onclick = function() {
    unlockAudio();
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    const name = document.getElementById('playerName').value.trim() || 'אורח';
    if(code) socket.emit('joinRoom', { roomCode: code, playerName: name });
};

// --- אירועי רשת ---

socket.on('roomCreated', (data) => {
    mySymbol = 'X';
    currentRoomCode = data.roomCode;
    document.getElementById('inviteCode').innerText = currentRoomCode;
    showScreen('waitingScreen');
});

socket.on('localGameStarted', (room) => {
    mySymbol = 'BOTH';
    currentRoomCode = room.roomCode;
    roomData = room;
    showScreen('gameScreen');
    updateUI();
});

socket.on('gameStarted', (room) => {
    roomData = room;
    showScreen('gameScreen');
    updateUI();
});

socket.on('updateBoard', (room) => {
    roomData = room;
    updateUI();
});

function updateUI() {
    if (!roomData) return;
    roomData.board.forEach((val, i) => {
        const cell = document.querySelector(`.cell[data-index="${i}"]`);
        cell.innerText = val;
        cell.className = `cell ${val ? val.toLowerCase() : ''}`;
    });

    const turnInd = document.getElementById('turnIndicator');
    const currentPlayer = roomData.players.find(p => p.symbol === roomData.turn);

    if (mySymbol === 'BOTH') {
        turnInd.innerText = `תור: ${currentPlayer.name}`;
        turnInd.style.color = roomData.turn === 'X' ? '#e74c3c' : '#3498db';
    } else {
        if (roomData.turn === mySymbol) {
            turnInd.innerText = "תורך! ✨";
            turnInd.style.color = "#2ecc71";
        } else {
            turnInd.innerText = `התור של ${currentPlayer.name}...`;
            turnInd.style.color = "#95a5a6";
        }
    }

    const p1 = roomData.players[0], p2 = roomData.players[1];
    if (p1 && p2) {
        document.getElementById('scoreText').innerText = `${p1.name} ${p1.score} - ${p2.score} ${p2.name}`;
    }
}

document.querySelectorAll('.cell').forEach(cell => {
    cell.onclick = () => {
        const idx = cell.getAttribute('data-index');
        if (roomData && roomData.board[idx] === '') {
            if (mySymbol === 'BOTH' || roomData.turn === mySymbol) {
                socket.emit('makeMove', { roomCode: currentRoomCode, index: parseInt(idx) });
            }
        }
    };
});

socket.on('roundEnded', ({ room, winnerName }) => {
    roomData = room;
    updateUI();
    if (winnerName) {
        document.getElementById('winMessage').innerText = `כל הכבוד ${winnerName}!`;
        document.getElementById('winPopup').classList.remove('hidden');
        confetti({ particleCount: 200, spread: 80, origin: { y: 0.6 } });
        
        if ('speechSynthesis' in window) {
            const ut = new SpeechSynthesisUtterance(`כל הכבוד ${winnerName}`);
            ut.lang = 'he-IL';
            window.speechSynthesis.speak(ut);
        }
        setTimeout(() => { document.getElementById('winPopup').classList.add('hidden'); updateUI(); }, 3000);
    } else {
        alert("תיקו!");
        updateUI();
    }
});

// סיום תחרות מסונכרן וקריינות
socket.on('gameOver', ({ room, endTime }) => {
    roomData = room;
    const p1 = room.players[0], p2 = room.players[1];
    
    // הכנת הטקסט להקראה קולית
    let audioMsg = "";
    if (p1.score > p2.score) {
        audioMsg = `הניצחון של ${p1.name}`;
    } else if (p2.score > p1.score) {
        audioMsg = `הניצחון של ${p2.name}`;
    } else {
        audioMsg = "כל הכבוד לכולם, התוצאה שוויון";
    }

    // הפעלת האודיו
    if ('speechSynthesis' in window) {
        const ut = new SpeechSynthesisUtterance(audioMsg);
        ut.lang = 'he-IL'; 
        window.speechSynthesis.speak(ut);
    }

    const winMsg = p1.score > p2.score ? `המנצח: ${p1.name}` : p2.score > p1.score ? `המנצחת: ${p2.name}` : "תיקו!";

    document.getElementById('finalStats').innerHTML = `
        <p>📅 ${room.startDate} | ⏰ ${room.startTime} - ${endTime}</p>
        <hr>
        <p>${p1.name}: ${p1.score}</p>
        <p>${p2.name}: ${p2.score}</p>
        <p>תיקו: ${room.draws}</p>
        <h3>${winMsg}</h3>
    `;

    document.getElementById('finalWhatsAppBtn').onclick = () => {
        const text = `🎮 סיכום איקס מיקס דריקס!\n${p1.name} ${p1.score} - ${p2.score} ${p2.name}\n${winMsg}`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`);
    };

    showScreen('resultsScreen');
});

document.getElementById('requestEndBtn').onclick = () => {
    socket.emit('requestEndGame', currentRoomCode);
};

// טיפול בקישור הזמנה ישיר
window.addEventListener('load', () => {
    const r = new URLSearchParams(window.location.search).get('room');
    if (r) {
        currentRoomCode = r.toUpperCase();
        document.getElementById('invitedRoomDisplay').innerText = currentRoomCode;
        showScreen('inviteJoinScreen');
    }
});
