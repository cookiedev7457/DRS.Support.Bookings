const express = require('express');
const axios = require('axios');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();

const app = express();

// 1. MIDDLEWARE SETUP
app.use(express.json());
app.use(cors({ 
    origin: 'https://cookiedev7457.github.io', 
    credentials: true // Crucial for session cookies to work
}));

// 2. SESSION CONFIGURATION
app.use(session({
    secret: 'drs_secure_session_key_99', // Change this to a random string
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: true, // Set to true if using HTTPS (Render provides this)
        sameSite: 'none', // Required for cross-site cookies between Render and GitHub
        maxAge: 3600000 * 24 // 24 hours
    }
}));

const { 
    TRELLO_KEY, TRELLO_TOKEN, TRELLO_LIST_ID, 
    CLIENT_ID, CLIENT_SECRET, REDIRECT_URI,
    DISCORD_WEBHOOK_URL 
} = process.env;

const MY_ROBLOX_GROUP_ID = 12734419;

// 3. DISCORD WEBHOOK HELPER
async function sendDiscordAlert(title, message, color = 0x0084ff) {
    if (!DISCORD_WEBHOOK_URL) return;
    try {
        await axios.post(DISCORD_WEBHOOK_URL, {
            embeds: [{ title, description: message, color, timestamp: new Date() }]
        });
    } catch (err) { console.error("Webhook Error:", err.message); }
}

// 4. SECURE USER CHECK (Frontend asks: "Who am I?")
app.get('/api/me', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// 5. FETCH SESSIONS
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
    } catch (err) { res.status(500).json({ error: "Fetch Failed" }); }
});

// 6. JOIN SESSION (Checks session user)
app.post('/api/join', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Not logged in" });

    const { cardId, sessionName, hostName } = req.body;
    const { username } = req.session.user;

    if (username === hostName) return res.status(400).json({ error: "You are the host!" });

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

// 7. UNBOOK SESSION
app.post('/api/unbook', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
    const { cardId, sessionName } = req.body;
    const { username } = req.session.user;

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

// 8. OAUTH CALLBACK (Saves Session)
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
            return res.redirect(`https://cookiedev7457.github.io/DRS.Support.Bookings/public/index.html?error=unauthorized`);
        }

        // SAVE TO SESSION
        req.session.user = { username, rank };

        await sendDiscordAlert("🔑 System Login", `**${username}** (Rank ${rank}) logged in.`, 0x0084ff);
        res.redirect(`https://cookiedev7457.github.io/DRS.Support.Bookings/public/index.html`);
    } catch (err) { res.status(500).send("Auth Failed"); }
});

// 9. LOGOUT
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect(`https://cookiedev7457.github.io/DRS.Support.Bookings/public/index.html`);
});

app.listen(10000, () => console.log("System Online"));
