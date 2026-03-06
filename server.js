const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({ origin: 'https://cookiedev7457.github.io' }));

// Securely pull variables from the server environment
const { 
    TRELLO_KEY, 
    TRELLO_TOKEN, 
    TRELLO_LIST_ID, 
    CLIENT_ID, 
    CLIENT_SECRET, 
    REDIRECT_URI,
    DISCORD_WEBHOOK_URL 
} = process.env;

// Helper function for Discord alerts
async function sendDiscordAlert(title, message, color = 0x0084ff) {
    if (!DISCORD_WEBHOOK_URL) return;
    try {
        await axios.post(DISCORD_WEBHOOK_URL, {
            embeds: [{
                title: title,
                description: message,
                color: color,
                timestamp: new Date()
            }]
        });
    } catch (err) { console.error("Webhook failed"); }
}

// FETCH SESSIONS + CLEAN TEXT + TAGS
app.get('/api/sessions', async (req, res) => {
    try {
        const url = `https://api.trello.com/1/lists/${TRELLO_LIST_ID}/cards?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}&checklists=all`;
        const response = await axios.get(url);
        
        const sessions = response.data.map(card => {
            // Remove ** from description
            const cleanDesc = card.desc.replace(/\*\*/g, '');
            const hostMatch = cleanDesc.match(/Host:\s*(.*)/i);
            const reqMatch = cleanDesc.match(/Requirements:\s*(.*)/i);
            
            return {
                id: card.id,
                sessionName: card.name,
                hostName: hostMatch ? hostMatch[1].trim() : "TBD",
                requirements: reqMatch ? reqMatch[1].trim() : "No requirements listed",
                participants: card.checklists[0] ? card.checklists[0].checkItems.map(item => item.name) : [],
                tags: card.labels.map(l => ({ name: l.name, color: l.color })) //
            };
        });
        res.json(sessions);
    } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

// JOIN SESSION + WEBHOOK
app.post('/api/join', async (req, res) => {
    const { cardId, username, sessionName } = req.body;
    try {
        const checkUrl = `https://api.trello.com/1/cards/${cardId}/checklists?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
        const checkRes = await axios.get(checkUrl);
        let checklistId = checkRes.data[0]?.id;

        if (!checklistId) {
            const newCheck = await axios.post(checkUrl, { name: "Confirmed Staff" });
            checklistId = newCheck.data.id;
        }

        await axios.post(`https://api.trello.com/1/checklists/${checklistId}/checkItems?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`, {
            name: username
        });

        await sendDiscordAlert("📅 Session Booked", `**${username}** has joined **${sessionName}**.`, 0x00ff00); //
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Booking failed" }); }
});

// UNBOOK SESSION + WEBHOOK
app.post('/api/unbook', async (req, res) => {
    const { cardId, username, sessionName } = req.body;
    try {
        const checkUrl = `https://api.trello.com/1/cards/${cardId}/checklists?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
        const checkRes = await axios.get(checkUrl);
        const checklist = checkRes.data[0];
        
        if (checklist) {
            const item = checklist.checkItems.find(i => i.name === username);
            if (item) {
                await axios.delete(`https://api.trello.com/1/checklists/${checklist.id}/checkItems/${item.id}?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`);
                await sendDiscordAlert("❌ Session Unbooked", `**${username}** has left **${sessionName}**.`, 0xffaa00); //
            }
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Unbook failed" }); }
});

// CALLBACK + RANK CHECK
app.get('/callback', async (req, res) => {
    try {
        const code = req.query.code;
        const tokenRes = await axios.post('https://apis.roblox.com/oauth/v1/token', new URLSearchParams({
            client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const userRes = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        const username = userRes.data.preferred_username;
        const userId = userRes.data.sub;

        // Fetch Rank (Update 1234567 to your actual Roblox Group ID)
        const groupRes = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
        const group = groupRes.data.data.find(g => g.group.id === 1234567); 
        const rank = group ? group.role.rank : 0;

        if (rank < 45) {
            await sendDiscordAlert("🚫 Unauthorized Access", `**${username}** (Rank ${rank}) tried to log in but was blocked.`, 0xff4747); //
        } else {
            await sendDiscordAlert("🔑 System Login", `**${username}** (Rank ${rank}) has logged in.`, 0x0084ff); //
        }

        res.redirect(`https://cookiedev7457.github.io/DRS.Support.Bookings/public/index.html?username=${username}&rank=${rank}`);
    } catch (err) { res.status(500).send("Auth Error"); }
});

app.listen(10000, () => console.log("Trello Brain is Online"));
