const express = require('express');
const axios = require('axios');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cors({ 
    origin: 'https://cookiedev7457.github.io', 
    credentials: true 
}));

app.set('trust proxy', 1); 
app.use(session({
    secret: 'DRS_BRAND_SECURE_2026',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: { 
        secure: true, 
        sameSite: 'none', 
        httpOnly: true,
        maxAge: 3600000 * 24 
    }
}));

const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_LIST_ID, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = process.env;
const MY_ROBLOX_GROUP_ID = 12734419;

app.get('/api/me', (req, res) => {
    res.json(req.session.user ? { loggedIn: true, user: req.session.user } : { loggedIn: false });
});

app.get('/api/sessions', async (req, res) => {
    try {
        const url = `https://api.trello.com/1/lists/${TRELLO_LIST_ID}/cards?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}&checklists=all`;
        const { data } = await axios.get(url);
        const sessions = data.map(card => {
            const desc = card.desc.replace(/\*\*/g, '');
            return {
                id: card.id,
                sessionName: card.name,
                hostName: (desc.match(/Host:\s*(.*)/i) || [])[1]?.trim() || "TBD",
                requirements: (desc.match(/Requirements:\s*(.*)/i) || [])[1]?.trim() || "N/A",
                participants: card.checklists[0]?.checkItems.map(i => i.name) || [],
                tags: card.labels.map(l => ({ name: l.name, color: l.color }))
            };
        });
        res.json(sessions);
    } catch (err) { res.status(500).json({ error: "API Error" }); }
});

app.get('/callback', async (req, res) => {
    try {
        const code = req.query.code;
        const tokenRes = await axios.post('https://apis.roblox.com/oauth/v1/token', new URLSearchParams({
            client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI
        }));
        const userRes = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });
        const groupRes = await axios.get(`https://groups.roblox.com/v1/users/${userRes.data.sub}/groups/roles`);
        const group = groupRes.data.data.find(g => g.group.id === MY_ROBLOX_GROUP_ID);
        
        if (!group || group.role.rank < 45) {
            return res.redirect(`https://cookiedev7457.github.io/DRS.Support.Bookings/public/index.html?error=unauthorized`);
        }

        req.session.user = { username: userRes.data.preferred_username, rank: group.role.rank };
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
