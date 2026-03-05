const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Connected to MongoDB Atlas"))
    .catch(err => console.error("Database connection error:", err));

// Database Schema
const Booking = mongoose.model('Booking', new mongoose.Schema({
    sessionName: String,
    hostName: String,
    hostId: Number,
    status: { type: String, default: 'active' },
    participants: { type: [Object], default: [] }, // Stores {userId, username}
    createdAt: { type: Date, default: Date.now }
}));

// Roblox OAuth Login Route
app.get('/auth/roblox', (req, res) => {
    const url = `https://apis.roblox.com/oauth/v1/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=openid+profile&response_type=code`;
    res.redirect(url);
});

// Callback Route
app.get('/callback', async (req, res) => {
    try {
        const code = req.query.code;
        const tokenToken = Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString('base64');
        
        const tokenRes = await axios.post('https://apis.roblox.com/oauth/v1/token', 
            `grant_type=authorization_code&code=${code}&redirect_uri=${process.env.REDIRECT_URI}`, 
            { headers: { 'Authorization': `Basic ${tokenToken}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const userRes = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        const rankRes = await axios.get(`https://groups.roblox.com/v1/users/${userRes.data.sub}/groups/roles`);
        const group = rankRes.data.data.find(g => g.group.id == 12734419);
        const rank = group ? group.role.rank : 0;

        res.redirect(`/?username=${userRes.data.preferred_username}&userId=${userRes.data.sub}&rank=${rank}`);
    } catch (err) {
        res.status(500).send("Login failed. Check your environment variables.");
    }
});

// Admin API: Create
app.post('/api/create', async (req, res) => {
    if (req.body.rank < 98) return res.status(403).send("Unauthorized");
    const session = new Booking({ 
        sessionName: req.body.name, 
        hostName: req.body.username,
        hostId: req.body.userId 
    });
    await session.save();
    res.json({ success: true });
});

// Staff API: Join Session
app.post('/api/join', async (req, res) => {
    const { sessionId, userId, username } = req.body;
    const session = await Booking.findById(sessionId);
    if (!session) return res.status(404).send("Not found");
    
    // Check if already joined
    const alreadyJoined = session.participants.some(p => p.userId == userId);
    if (!alreadyJoined) {
        session.participants.push({ userId, username });
        await session.save();
    }
    res.json({ success: true });
});

// Admin API: Cancel
app.post('/api/cancel', async (req, res) => {
    if (req.body.rank < 98) return res.status(403).send("Unauthorized");
    await Booking.findByIdAndUpdate(req.body.id, { status: 'cancelled' });
    res.json({ success: true });
});

// Public API: Get Sessions
app.get('/api/sessions', async (req, res) => {
    const sessions = await Booking.find({ status: 'active' });
    res.json(sessions);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));
