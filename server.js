const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({ origin: 'https://cookiedev7457.github.io' }));

const { 
    TRELLO_KEY, TRELLO_TOKEN, TRELLO_LIST_ID, 
    CLIENT_ID, CLIENT_SECRET, REDIRECT_URI,
    DISCORD_WEBHOOK_URL 
} = process.env;

const MY_ROBLOX_GROUP_ID = 12734419;

// Helper: Discord Webhook Sender
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
    } catch (err) { console.error("Webhook Error:", err.message); }
}

// 1. GET SESSIONS (Cleans ** and fetches Tags)
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
                requirements: reqMatch ? reqMatch[1].trim() : "No requirements listed",
                participants: card.checklists[0] ? card.checklists[0].checkItems.map(item => item.name) : [],
                tags: card.labels.map(l => ({ name: l.name, color: l.color }))
            };
        });
        res.json(sessions);
    } catch (err) { res.status(500).json({ error: "Trello Fetch Failed" }); }
});

// 2. JOIN SESSION (Anti-Self Book + Webhook)
app.post('/api/join', async (req, res) => {
    const { cardId, username, sessionName, hostName } = req.body;
    
    if (username === hostName) {
        return res.status(400).json({ error: "You cannot book your own training!" });
    }

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

        await sendDiscordAlert("📅 Session Booked", `**${username}** joined **${sessionName}**\n**Host:** ${hostName}`, 0x00ff00);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Join Failed" }); }
});

// 3. UNBOOK SESSION
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
                await sendDiscordAlert("❌ Session Unbooked", `**${username}** left **${sessionName}**`, 0xffaa00);
            }
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Unbook Failed" }); }
});

// 4. OAUTH CALLBACK (Rank Gate 45)
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

        const groupRes = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
        const groupData = groupRes.data.data.find(g => g.group.id === MY_ROBLOX_GROUP_ID); 
        const rank = groupData ? groupData.role.rank : 0;

        if (rank < 45) {
            await sendDiscordAlert("🚫 Access Denied", `**${username}** (Rank ${rank}) was blocked.`, 0xff4747);
        } else {
            await sendDiscordAlert("🔑 System Login", `**${username}** (Rank ${rank}) logged in.`, 0x0084ff);
        }

        res.redirect(`https://cookiedev7457.github.io/DRS.Support.Bookings/public/index.html?username=${username}&rank=${rank}`);
    } catch (err) { res.status(500).send("Auth Failed"); }
});

app.listen(10000, () => console.log("System Online"));
