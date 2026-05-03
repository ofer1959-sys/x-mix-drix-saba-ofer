// סיום תחרות מסונכרן
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
