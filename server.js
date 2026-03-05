const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());

// ALLOW GITHUB TO TALK TO RENDER
app.use(cors({ origin: 'https://cookiedev7457.github.io' }));

mongoose.connect(process.env.MONGO_URI);
const Booking = mongoose.model('Booking', new mongoose.Schema({
    sessionName: String,
    hostName: String,
    hostId: String,
    participants: [{ userId: String, username: String }],
    status: { type: String, default: 'active' }
}));

// --- AUTH CALLBACK ---
app.get('/callback', async (req, res) => {
    try {
        const code = req.query.code;
        const tokenRes = await axios.post('https://apis.roblox.com/oauth/v1/token', new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.REDIRECT_URI
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const userRes = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        // SECURE REDIRECT: We only send the Name and ID. No "admin=true" here!
        const githubUrl = `https://cookiedev7457.github.io/DRS.Support.Bookings/public/index.html?username=${userRes.data.preferred_username}&userId=${userRes.data.sub}`;
        res.redirect(githubUrl);
    } catch (err) {
        res.status(500).send("Login failed. Check your Render Environment Variables.");
    }
});

// --- PRIVATE RANK CHECK (The Security Handshake) ---
app.get('/api/check-rank', async (req, res) => {
    try {
        const response = await axios.get(`https://groups.roblox.com/v1/users/${req.query.userId}/groups/roles`);
        const group = response.data.data.find(g => g.group.id == 12734419);
        const rank = group ? group.role.rank : 0;
        res.json({ isAdmin: rank >= 98 });
    } catch (err) {
        res.json({ isAdmin: false });
    }
});

// --- SESSION APIS ---
app.get('/api/sessions', async (req, res) => {
    res.json(await Booking.find({ status: 'active' }));
});

app.post('/api/create', async (req, res) => {
    // RE-VERIFY RANK ON SERVER: Even if a hacker forces the button to show, the server says NO.
    const rankCheck = await axios.get(`https://groups.roblox.com/v1/users/${req.body.userId}/groups/roles`);
    const group = rankCheck.data.data.find(g => g.group.id == 12734419);
    if (!group || group.role.rank < 98) return res.status(403).send("Unauthorized");

    await new Booking({ sessionName: req.body.name, hostName: req.body.username, hostId: req.body.userId }).save();
    res.json({ success: true });
});

app.listen(10000, () => console.log("Secure Brain Active"));
