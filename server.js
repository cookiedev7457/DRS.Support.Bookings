const express = require('express');
const axios = require('axios');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();

const app = express();

// 1. DYNAMIC CORS: Crucial for cross-site cookies
app.use(cors({ 
    origin: 'https://cookiedev7457.github.io', 
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS']
}));

// 2. TRUST PROXY: Required for Render's HTTPS to work with cookies
app.set('trust proxy', 1); 

// 3. SECURE SESSION CONFIG
app.use(session({
    secret: 'DRS_ULTIMATE_SECURE_KEY_2026', 
    resave: false,
    saveUninitialized: false,
    proxy: true,
    name: 'DRS_Auth', // Custom name to avoid generic detection
    cookie: { 
        secure: true, 
        sameSite: 'none', // MUST be 'none' for GitHub + Render
        httpOnly: true,
        maxAge: 3600000 * 24 // 24 Hours
    }
}));

const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_LIST_ID, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, DISCORD_WEBHOOK_URL } = process.env;
const MY_ROBLOX_GROUP_ID = 12734419;

// Discord Webhook with Rate Limit Protection
async function sendDiscordAlert(title, message, color = 0x0084ff) {
    if (!DISCORD_WEBHOOK_URL) return;
    try {
        await axios.post(DISCORD_WEBHOOK_URL, {
            embeds: [{ title, description: message, color, timestamp: new Date() }]
        });
    } catch (err) { 
        if (err.response && err.response.status === 429) console.log("Discord Busy - Alert skipped.");
    }
}

// ROUTE: Check Login Status
app.get('/api/me', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// ROUTE: Fetch Sessions
app.get('/api/sessions', async (req, res) => {
    try {
        const url = `https://api.trello.com/1/lists/${TRELLO_LIST_ID}/cards?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}&checklists=all`;
        const response = await axios.get(url);
        const sessions = response.data.map(card => {
            const cleanDesc = card.desc.replace(/\*\*/g, '');
            return {
                id: card.id,
                sessionName: card.name,
                hostName: (cleanDesc.match(/Host:\s*(.*)/i) || [])[1]?.trim() || "TBD",
                requirements: (cleanDesc.match(/Requirements:\s*(.*)/i) || [])[1]?.trim() || "N/A",
                participants: card.checklists[0]?.checkItems.map(item => item.name) || [],
                tags: card.labels.map(l => ({ name: l.name, color: l.color }))
            };
        });
        res.json(sessions);
    } catch (err) { res.status(500).json({ error: "Fetch Failed" }); }
});

// ROUTE: OAuth Callback (THE FIX)
app.get('/callback', async (req, res) => {
    try {
        const code = req.query.code;
        const tokenRes = await axios.post('https://apis.roblox.com/oauth/v1/token', new URLSearchParams({
            client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI
        }));

        const userRes = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        const userId = userRes.data.sub;
        const username = userRes.data.preferred_username;

        const groupRes = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
        const groupData = groupRes.data.data.find(g => g.group.id === MY_ROBLOX_GROUP_ID); 
        const rank = groupData ? groupData.role.rank : 0;

        if (rank < 45) {
            return res.redirect(`https://cookiedev7457.github.io/DRS.Support.Bookings/public/index.html?error=unauthorized`);
        }

        // STORE IN SESSION
        req.session.user = { username, rank };

        // THE FIX: Manually save before redirecting to clear the URL
        req.session.save(() => {
            res.redirect(`https://cookiedev7457.github.io/DRS.Support.Bookings/public/index.html`);
        });

    } catch (err) { res.status(500).send("Auth Failed"); }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect(`https://cookiedev7457.github.io/DRS.Support.Bookings/public/index.html`);
});

app.listen(10000, () => console.log("System Online"));
