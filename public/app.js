socket.on('gameOver', ({ room, endTime }) => {
    roomData = room;
    const p1 = room.players[0], p2 = room.players[1];
    const totalGames = p1.score + p2.score + room.draws;
    const winText = p1.score > p2.score ? `המנצח/ת: ${p1.name}` : p2.score > p1.score ? `המנצח/ת: ${p2.name}` : "תיקו - שנינו ניצחנו!";
    
    if ('speechSynthesis' in window) {
        const ut = new SpeechSynthesisUtterance(`סיום התחרות! ${winText}`);
        ut.lang = 'he-IL'; 
        window.speechSynthesis.speak(ut);
    }

    const duration = 4000;
    const end = Date.now() + duration;
    (function frame() {
        confetti({ particleCount: 8, angle: 60, spread: 55, origin: { x: 0 }, zIndex: 9999 });
        confetti({ particleCount: 8, angle: 120, spread: 55, origin: { x: 1 }, zIndex: 9999 });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());

    const statsHtml = `
        <p>📅 תאריך: ${room.startDate}</p>
        <p>⏰ זמן: ${room.startTime} - ${endTime}</p>
        <hr>
        <p>${p1.name}: ${p1.score}</p>
        <p>${p2.name}: ${p2.score}</p>
        <p>תיקו: ${room.draws}</p>
        <hr>
        <h3>${winText}</h3>
    `;
    document.getElementById('finalStats').innerHTML = statsHtml;
    
    // נוסח ההודעה המשותף לוואטסאפ ולמייל
    const reportText = `שלום עופר,\n\nלהלן סיכום התחרות שהסתיימה זה עתה:\nשמות השחקנים: ${p1.name} ו-${p2.name}\nכמות משחקים ששוחקו: ${totalGames}\n-------------------------------\nניצחונות ל-${p1.name}: ${p1.score}\nניצחונות ל-${p2.name}: ${p2.score}\nתוצאות תיקו: ${room.draws}\n-------------------------------\nהמנצח הגדול: ${winText}\n\nתאריך: ${room.startDate}\nשעת התחלה: ${room.startTime}\nשעת סיום: ${endTime}\n\nבברכה,\nמערכת איקס מיקס דריקס`;

    // שליחה בוואטסאפ
    document.getElementById('finalWhatsAppBtn').onclick = () => {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent('🎮 סיכום תחרות איקס מיקס דריקס!\n\n' + reportText)}`);
    };

    // התיקון שלנו: שליחה במייל דרך הדפדפן (Mailto)
    document.getElementById('finalEmailBtn').onclick = () => {
        const subject = "תוצאות משחק איקס מיקס דריקס";
        window.location.href = `mailto:ofer1959@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(reportText)}`;
    };

    showScreen('results');
});
