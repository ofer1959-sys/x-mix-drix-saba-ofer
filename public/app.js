const socket = io();
let mySymbol = ''; 
let currentRoomCode = '';
let roomData = null;

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// כפתורי בית
document.querySelectorAll('.btn-home').forEach(btn => {
    btn.onclick = () => location.href = '/';
});

// לובי
document.getElementById('btnChooseLocal').onclick = () => {
    const section = document.getElementById('localPlaySection');
    // הופך לנראה בצורה מפורשת
    section.style.display = (section.style.display === 'block') ? 'none' : 'block';
};

document.getElementById('btnChooseRemote').onclick = () => {
    const name = document.getElementById('playerName').value.trim() || 'סבא עופר';
    socket.emit('createRoom', name);
};

document.getElementById('inviteWhatsAppBtn').onclick = () => {
    const url = `${window.location.origin}?room=${currentRoomCode}`;
    const text = `בוא לשחק איתי איקס מיקס דריקס! 🎮\n${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
};

document.getElementById('localPlayBtn').onclick = () => {
    const p1 = document.getElementById('playerName').value.trim() || 'סבא עופר';
    const p2 = document.getElementById('localPlayer2Name').value.trim() || 'נכד/ה';
    socket.emit('createLocalRoom', { p1Name: p1, p2Name: p2 });
};

document.getElementById('joinBtn').onclick = () => {
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    const name = document.getElementById('playerName').value.trim() || 'אורח';
    if(code) socket.emit('joinRoom', { roomCode: code, playerName: name });
};

document.getElementById('inviteJoinBtn').onclick = () => {
    const name = document.getElementById('invitePlayerName').value.trim() || 'אורח/ת';
    socket.emit('joinRoom', { roomCode: currentRoomCode, playerName: name });
};

// Events
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
        const cell = document.querySelector(`.cell-3d[data-index="${i}"]`);
        if (cell) {
            cell.innerText = val;
            cell.className = `cell-3d ${val ? val.toLowerCase() : ''}`;
        }
    });

    const turnInd = document.getElementById('turnIndicator');
    const currentPlayer = roomData.players.find(p => p.symbol === roomData.turn);

    if (mySymbol === 'BOTH') {
        turnInd.innerText = `תור: ${currentPlayer.name}`;
    } else {
        turnInd.innerText = (roomData.turn === mySymbol) ? "תורך! ✨" : `התור של ${currentPlayer.name}...`;
    }

    const p1 = roomData.players[0], p2 = roomData.players[1];
    if (p1 && p2) {
        document.getElementById('scoreText').innerText = `${p1.name} ${p1.score} - ${p2.score} ${p2.name}`;
    }
}

document.querySelectorAll('.cell-3d').forEach(cell => {
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
        setTimeout(() => { document.getElementById('winPopup').classList.add('hidden'); updateUI(); }, 3000);
    } else {
        alert("תיקו!");
        updateUI();
    }
});

socket.on('gameOver', ({ room, endTime }) => {
    roomData = room;
    const p1 = room.players[0], p2 = room.players[1];
    document.getElementById('finalStats').innerHTML = `
        <p>📅 ${room.startDate} | ⏰ ${room.startTime} - ${endTime}</p>
        <hr><p>${p1.name}: ${p1.score}</p><p>${p2.name}: ${p2.score}</p><p>תיקו: ${room.draws}</p>
    `;
    document.getElementById('finalWhatsAppBtn').onclick = () => {
        const text = `🎮 סיכום איקס מיקס דריקס!\n${p1.name} ${p1.score} - ${p2.score} ${p2.name}`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    };
    showScreen('resultsScreen');
});

document.getElementById('requestEndBtn').onclick = () => {
    socket.emit('requestEndGame', currentRoomCode);
};

window.addEventListener('load', () => {
    const r = new URLSearchParams(window.location.search).get('room');
    if (r) {
        currentRoomCode = r.toUpperCase();
        document.getElementById('invitedRoomDisplay').innerText = currentRoomCode;
        showScreen('inviteJoinScreen');
    }
});
