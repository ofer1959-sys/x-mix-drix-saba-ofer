const socket = io();
let mySymbol = '';
let currentRoomCode = '';
let roomData = null;

const screens = {
    lobby: document.getElementById('lobby'),
    invite: document.getElementById('inviteJoinScreen'),
    waiting: document.getElementById('waitingScreen'),
    game: document.getElementById('gameScreen')
};

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
}

// זיהוי קישור הזמנה
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
        currentRoomCode = room.toUpperCase();
        document.getElementById('invitedRoomDisplay').innerText = currentRoomCode;
        showScreen('invite');
    }
});

// כפתורי כניסה
document.getElementById('createBtn').onclick = () => {
    const name = document.getElementById('playerName').value.trim() || 'שחקן 1';
    socket.emit('createRoom', name);
};

document.getElementById('inviteJoinBtn').onclick = () => {
    const name = document.getElementById('invitePlayerName').value.trim() || 'שחקן 2';
    socket.emit('joinRoom', { roomCode: currentRoomCode, playerName: name });
};

document.getElementById('inviteWhatsAppBtn').onclick = () => {
    const url = `${window.location.origin}?room=${currentRoomCode}`;
    const msg = `בוא לשחק איתי איקס מיקס דריקס של סבא עופר! 🎮\n${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`);
};

// אירועי Socket
socket.on('roomCreated', (data) => {
    mySymbol = 'X';
    currentRoomCode = data.roomCode;
    document.getElementById('inviteCode').innerText = currentRoomCode;
    
    // תיקון: יצירת אובייקט חדר זמני כדי שהשחקן הראשון יוכל לראות את הלוח
    roomData = {
        board: Array(9).fill(''),
        turn: 'X',
        players: [{ name: document.getElementById('playerName').value || 'שחקן 1', symbol: 'X', score: 0 }],
        draws: 0
    };
    
    showScreen('waiting');
});

socket.on('roomJoined', (data) => {
    mySymbol = 'O';
    currentRoomCode = data.roomCode;
    showScreen('game');
});

socket.on('gameStarted', (room) => {
    roomData = room;
    // מוודא שהסמל מוגדר נכון לשני השחקנים
    const me = room.players.find(p => p.id === socket.id);
    if (me) mySymbol = me.symbol;
    
    showScreen('game');
    updateUI();
});

socket.on('updateBoard', (room) => {
    roomData = room;
    updateUI();
    checkWinLocally();
});

function updateUI() {
    if (!roomData) return;
    document.getElementById('displayRoomCode').innerText = currentRoomCode;
    
    roomData.board.forEach((val, i) => {
        const cell = document.querySelector(`.cell[data-index="${i}"]`);
        if (cell) {
            cell.innerText = val;
            cell.className = `cell ${val ? val.toLowerCase() : ''}`;
        }
    });

    const turnInd = document.getElementById('turnIndicator');
    if (roomData.turn === mySymbol) {
        turnInd.innerText = "התור שלך!";
        turnInd.style.color = "#2ecc71";
    } else {
        const other = roomData.players.find(p => p.symbol !== mySymbol);
        turnInd.innerText = `תור של ${other ? other.name : 'השחקן השני'}...`;
        turnInd.style.color = "#95a5a6";
    }

    const p1 = roomData.players[0], p2 = roomData.players[1];
    if (p1 && p2) {
        document.getElementById('scoreText').innerHTML = `${p1.name}: ${p1.score} | ${p2.name}: ${p2.score} | תיקו: ${roomData.draws || 0}`;
    } else {
        document.getElementById('scoreText').innerText = "ממתין לשחקן נוסף...";
    }
}

// לחיצה על תא - הוספתי הגנה למקרה שאין עדיין שחקן שני
document.querySelectorAll('.cell').forEach(cell => {
    cell.onclick = () => {
        const idx = cell.getAttribute('data-index');
        
        // בדיקה: האם המשחק התחיל (יש 2 שחקנים)?
        if (!roomData || roomData.players.length < 2) {
            alert("חכה רגע... צריך שחקן שני כדי להתחיל!");
            return;
        }

        if (roomData.turn === mySymbol && roomData.board[idx] === '') {
            socket.emit('makeMove', { roomCode: currentRoomCode, index: parseInt(idx) });
        }
    };
});

function checkWinLocally() {
    const combos = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (let c of combos) {
        const [a, b, c1] = c;
        if (roomData.board[a] && roomData.board[a] === roomData.board[b] && roomData.board[a] === roomData.board[c1]) {
            if (roomData.board[a] === mySymbol) socket.emit('playerWon', { roomCode: currentRoomCode, symbol: mySymbol });
            return;
        }
    }
    if (!roomData.board.includes('') && roomData.turn === mySymbol) socket.emit('draw', currentRoomCode);
}

socket.on('roundEnded', ({ room, winnerName }) => {
    roomData = room;
    updateUI();
    if (winnerName) {
        document.getElementById('winMessage').innerText = `כל הכבוד ${winnerName}!`;
        document.getElementById('winPopup').classList.remove('hidden');
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(`כל הכבוד ${winnerName}`);
            utterance.lang = 'he-IL';
            window.speechSynthesis.speak(utterance);
        }
        
        setTimeout(() => document.getElementById('winPopup').classList.add('hidden'), 3000);
    } else {
        alert("תיקו!");
    }
});

document.getElementById('endGameBtn').onclick = () => {
    if (!roomData || roomData.players.length < 2) return;
    const p1 = roomData.players[0], p2 = roomData.players[1];
    const draws = roomData.draws || 0;
    const total = p1.score + p2.score + draws;
    let winMsg = p1.score > p2.score ? `המנצח הוא: ${p1.name}` : p2.score > p1.score ? `המנצח הוא: ${p2.name}` : "המנצח הוא שנינו, שנהנינו לשחק באיקס מיקס דריקס של סבא עופר";
    
    const text = `שיחקנו ${total} משחקים באיקס מיקס דריקס של סבא עופר! 🎮\n\n${p1.name}: ${p1.score}\n${p2.name}: ${p2.score}\nתיקו: ${draws}\n\n${winMsg}.`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`);
    window.location.reload();
};

socket.on('errorMsg', (m) => { alert(m); window.location.href = window.location.pathname; });
