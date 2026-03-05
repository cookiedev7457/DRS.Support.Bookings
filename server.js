const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());

// 1. ALLOW GITHUB TO TALK TO RENDER
app.use(cors({
    origin: 'https://cookiedev7457.github.io'
}));

// MongoDB Setup
mongoose.connect(process.env.MONGO_URI);
const Booking = mongoose.model('Booking', new mongoose.Schema({
    sessionName: String,
    hostName: String,
    hostId: String,
    participants: [{ userId: String, username: String }],
    status: { type: String, default: 'active' }
}));

// --- AUTH ROUTES ---

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

        // REDIRECT TO GITHUB (Notice: No rank or admin status in URL)
        const githubUrl = `https://cookiedev7457.github.io/DRS.Support.Bookings/index.html?username=${userRes.data.preferred_username}&userId=${userRes.data.sub}`;
        res.redirect(githubUrl);
    } catch (err) {
        res.status(500).send("Login failed");
    }
});

// --- SECURITY: RANK CHECK API ---

app.get('/api/check-rank', async (req, res) => {
    const { userId } = req.query;
    try {
        const response = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
        const group = response.data.data.find(g => g.group.id == 12734419);
        const rank = group ? group.role.rank : 0;
        res.json({ isAdmin: rank >= 98, rank: rank });
    } catch (err) {
        res.json({ isAdmin: false, rank: 0 });
    }
});

// --- SESSION APIS (With Server-Side Verification) ---

app.get('/api/sessions', async (req, res) => {
    const sessions = await Booking.find({ status: 'active' });
    res.json(sessions);
});

app.post('/api/create', async (req, res) => {
    // Double check rank on server for safety
    const rankCheck = await axios.get(`https://groups.roblox.com/v1/users/${req.body.userId}/groups/roles`);
    const group = rankCheck.data.data.find(g => g.group.id == 12734419);
    if (!group || group.role.rank < 98) return res.status(403).send("Unauthorized");

    const session = new Booking({ sessionName: req.body.name, hostName: req.body.username, hostId: req.body.userId });
    await session.save();
    res.json({ success: true });
});

app.post('/api/join', async (req, res) => {
    const { sessionId, userId, username } = req.body;
    await Booking.findByIdAndUpdate(sessionId, { $addToSet: { participants: { userId, username } } });
    res.json({ success: true });
});

app.post('/api/cancel', async (req, res) => {
    const rankCheck = await axios.get(`https://groups.roblox.com/v1/users/${req.body.userId}/groups/roles`);
    const group = rankCheck.data.data.find(g => g.group.id == 12734419);
    if (!group || group.role.rank < 98) return res.status(403).send("Unauthorized");

    await Booking.findByIdAndUpdate(req.body.id, { status: 'cancelled' });
    res.json({ success: true });
});

app.listen(10000, () => console.log("Brain is live on port 10000"));
