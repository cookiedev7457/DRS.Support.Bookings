const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({ origin: 'https://cookiedev7457.github.io' }));

const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_LIST_ID, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = process.env;
const WEBHOOK_URL = "https://discord.com/api/webhooks/1479281011849298024/diDs1hwNcA5UFcxaotywq02UV_TJqVnB_TVuiXj-xl4a-8GpX-Vtim3Cc9RmPH7mlfRW";

// Helper function for Discord logs
async function sendDiscordAlert(title, message, color = 0x0084ff) {
    try {
        await axios.post(WEBHOOK_URL, {
            embeds: [{
                title: title,
                description: message,
                color: color,
                timestamp: new Date()
            }]
        });
    } catch (err) { console.error("Webhook failed"); }
}

// FETCH SESSIONS + CLEAN TEXT
app.get('/api/sessions', async (req, res) => {
    try {
        const url = `https://api.trello.com/1/lists/${TRELLO_LIST_ID}/cards?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}&checklists=all`;
        const response = await axios.get(url);
        const sessions = response.data.map(card => {
            const cleanDesc = card.desc.replace(/\*\*/g, '');
            const hostMatch = cleanDesc.match(/Host:\s*(.*)/i);
            const reqMatch = cleanDesc.match(/Requirements:\s*(.*)/i);
            return {
                id: card.id,
                sessionName: card.name,
                hostName: hostMatch ? hostMatch[1].trim() : "TBD",
                requirements: reqMatch ? reqMatch[1].trim() : "Standard Requirements",
                participants: card.checklists[0] ? card.checklists[0].checkItems.map(item => item.name) : [],
                tags: card.labels.map(l => ({ name: l.name, color: l.color }))
            };
        });
        res.json(sessions);
    } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

// JOIN + WEBHOOK
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
        await axios.post(`https://api.trello.com/1/checklists/${checklistId}/checkItems?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`, { name: username });
        
        await sendDiscordAlert("📅 Session Booked", `**${username}** has joined **${sessionName}**.`, 0x00ff00);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Booking failed" }); }
});

// UNBOOK + WEBHOOK
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
                await sendDiscordAlert("❌ Session Unbooked", `**${username}** has left **${sessionName}**.`, 0xffaa00);
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

        // Fetch Rank (Replace with your actual Group ID)
        const groupRes = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
        const group = groupRes.data.data.find(g => g.group.id === 69aa181c004ed43f3d1389c3); // Enter your actual Group ID number
        const rank = group ? group.role.rank : 0;

        if (rank < 45) {
            await sendDiscordAlert("🚫 Unauthorized Access", `**${username}** (Rank ${rank}) was blocked for being below Rank 45.`, 0xff4747);
        } else {
            await sendDiscordAlert("🔑 System Login", `**${username}** (Rank ${rank}) has logged in.`, 0x0084ff);
        }

        res.redirect(`https://cookiedev7457.github.io/DRS.Support.Bookings/public/index.html?username=${username}&rank=${rank}`);
    } catch (err) { res.status(500).send("Auth Error"); }
});

app.listen(10000, () => console.log("Trello Brain is Online"));
