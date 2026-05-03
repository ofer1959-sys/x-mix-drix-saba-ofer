// פונקציית העזר לשליחת המייל (עם דיווחים ללוגים)
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

    const transporter = nodemailer.createTransport({
        service: 'gmail',
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
