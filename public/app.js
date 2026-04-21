const socket = io();

const screens = {
    lobby: document.getElementById('lobby'),
    waiting: document.getElementById('waitingScreen'),
    game: document.getElementById('gameScreen')
};

let mySymbol = '';
let currentRoomCode = '';
let roomData = null;

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function playDynamicAudio(name) {
    if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance(`כל הכבוד ${name}!`);
        msg.lang = 'he-IL';
        msg.rate = 1.0;
        window.speechSynthesis.speak(msg);
    }
}

document.getElementById('createBtn').addEventListener('click', () => {
    const name = document.getElementById('playerName').value.trim() || 'שחקן 1';
    socket.emit('createRoom', name);
});

document.getElementById('joinBtn').addEventListener('click', () => {
    const name = document.getElementById('playerName').value.trim() || 'שחקן 2';
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (code) socket.emit('joinRoom', { roomCode: code, playerName: name });
});

document.getElementById('inviteWhatsAppBtn').addEventListener('click', () => {
    const gameUrl = window.location.origin;
    const msg = `בוא לשחק איתי איקס מיקס דריקס של סבא עופר! 🎮\nקוד החדר שלנו הוא: *${currentRoomCode}*\nהיכנס לקישור והצטרף:\n${gameUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
});

socket.on('roomCreated', ({ roomCode, symbol }) => {
    mySymbol = symbol;
    currentRoomCode = roomCode;
    document.getElementById('inviteCode').innerText = roomCode;
    showScreen('waiting');
});

socket.on('roomJoined', ({ roomCode, symbol }) => {
    mySymbol = symbol;
    currentRoomCode = roomCode;
    document.getElementById('displayRoomCode').innerText = roomCode;
    showScreen('game');
});

socket.on('gameStarted', (room) => {
    roomData = room;
    document.getElementById('displayRoomCode').innerText = currentRoomCode;
    showScreen('game');
    updateUI();
});

const cells = document.querySelectorAll('.cell');
cells.forEach((cell, index) => {
    cell.addEventListener('click', () => {
        if (roomData && roomData.turn === mySymbol && roomData.board[index] === '') {
            socket.emit('makeMove', { roomCode: currentRoomCode, index });
        }
    });
});

socket.on('updateBoard', (room) => {
    roomData = room;
    updateUI();
    checkWinLocally();
});

function updateUI() {
    if (!roomData) return;
    
    roomData.board.forEach((val, i) => {
        cells[i].innerText = val;
        cells[i].className = `cell ${val ? val.toLowerCase() : ''}`;
    });

    const turnInd = document.getElementById('turnIndicator');
    if (roomData.turn === mySymbol) {
        turnInd.innerText = "התור שלך!";
        turnInd.style.color = "var(--secondary)";
    } else {
        const otherPlayer = roomData.players.find(p => p.symbol !== mySymbol);
        turnInd.innerText = `תור של ${otherPlayer ? otherPlayer.name : 'השחקן השני'}...`;
        turnInd.style.color = "#999";
    }

    const p1 = roomData.players[0];
    const p2 = roomData.players[1];
    if (p1 && p2) {
        document.getElementById('scoreText').innerHTML = `
            ${p1.name}: ${p1.score} <br>
            ${p2.name}: ${p2.score} <br>
            תיקו: ${roomData.draws || 0}
        `;
    }
}

const winningCombos = [
    [0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]
];

function checkWinLocally() {
    let hasWinner = false;
    for (let combo of winningCombos) {
        const [a, b, c] = combo;
        if (roomData.board[a] && roomData.board[a] === roomData.board[b] && roomData.board[a] === roomData.board[c]) {
            if (roomData.board[a] === mySymbol) {
                socket.emit('playerWon', { roomCode: currentRoomCode, symbol: mySymbol });
            }
            hasWinner = true;
            break;
        }
    }
    if (!hasWinner && !roomData.board.includes('')) {
        if (roomData.turn === mySymbol) socket.emit('draw', currentRoomCode);
    }
}

socket.on('roundEnded', ({ room, winnerName }) => {
    roomData = room;
    if (winnerName) {
        document.getElementById('winMessage').innerText = `כל הכבוד ${winnerName}!`;
        const popup = document.getElementById('winPopup');
        popup.classList.remove('hidden');
        
        confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 } });
        playDynamicAudio(winnerName);
        
        setTimeout(() => {
            popup.classList.add('hidden');
            updateUI();
        }, 3500);
    } else {
        alert("תיקו! מנקים את הלוח לסיבוב נוסף.");
        updateUI();
    }
});

document.getElementById('endGameBtn').addEventListener('click', () => {
    if (!roomData || roomData.players.length < 2) return;
    
    const endTime = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    const p1 = roomData.players[0];
    const p2 = roomData.players[1];
    const totalGames = p1.score + p2.score + (roomData.draws || 0);

    let winnerText = "";
    if (p1.score > p2.score) {
        winnerText = `המנצח הוא: ${p1.name}`;
    } else if (p2.score > p1.score) {
        winnerText = `המנצח הוא: ${p2.name}`;
    } else {
        winnerText = "המנצח הוא שנינו, שנהנינו לשחק באיקס מיקס דריקס של סבא עופר";
    }
    
    const msg = `שיחקנו עד עכשיו ${totalGames} משחקים באיקס מיקס דריקס של סבא עופר! 🎮
התחלנו ב-${roomData.startTime} וסיימנו ב-${endTime}.

${p1.name} ניצח ב-${p1.score} משחקים.
${p2.name} ניצח ב-${p2.score} משחקים.
תיקו יצא ב-${roomData.draws || 0} משחקים.

${winnerText}.`;
    
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
    window.location.reload();
});
