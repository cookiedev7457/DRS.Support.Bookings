const express = require('express');
const axios = require('axios');
const cors = require('cors');
const session = require('express-session'); // NEW: For secure sessions
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({ origin: 'https://cookiedev7457.github.io', credentials: true }));

// NEW: Configure secure session storage
app.use(session({
    secret: 'super-secret-key-change-this', // Change this to a random string
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true, maxAge: 3600000 } // 1 hour session
}));

const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_LIST_ID, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, DISCORD_WEBHOOK_URL } = process.env;
const MY_ROBLOX_GROUP_ID = 12734419;

async function sendDiscordAlert(title, message, color = 0x0084ff) {
    if (!DISCORD_WEBHOOK_URL) return;
    try {
        await axios.post(DISCORD_WEBHOOK_URL, {
            embeds: [{ title, description: message, color, timestamp: new Date() }]
        });
    } catch (err) { console.error("Webhook Error"); }
}

// NEW: Route for the frontend to ask "Who am I?" securely
app.get('/api/me', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

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
            await sendDiscordAlert("🚫 Unauthorized Access", `**${username}** (Rank ${rank}) was blocked.`, 0xff4747);
            // Redirect to a specific error page or just the home page with a flag
            return res.redirect(`https://cookiedev7457.github.io/DRS.Support.Bookings/public/index.html?error=unauthorized`);
        }

        // SECURE: Save user info in the server session, NOT the URL
        req.session.user = { username, rank };

        await sendDiscordAlert("🔑 System Login", `**${username}** (Rank ${rank}) logged in.`, 0x0084ff);
        
        // Redirect to the clean URL
        res.redirect(`https://cookiedev7457.github.io/DRS.Support.Bookings/public/index.html`);
    } catch (err) { res.status(500).send("Auth Failed"); }
});

// JOIN SESSION (Now checks the session for security)
app.post('/api/join', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Please log in" });
    
    const { cardId, sessionName, hostName } = req.body;
    const { username } = req.session.user;

    if (username === hostName) return res.status(400).json({ error: "You are the host!" });

    try {
        // ... (Trello Join Logic)
        await sendDiscordAlert("📅 Session Booked", `**${username}** joined **${sessionName}**`, 0x00ff00);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Join Failed" }); }
});

app.listen(10000);
