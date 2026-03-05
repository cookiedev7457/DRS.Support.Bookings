const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// Points to the 'public' folder for your HTML/CSS 
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("DB Connection Error:", err));

const Booking = mongoose.model('Booking', new mongoose.Schema({
    sessionName: String,
    hostName: String,
    hostId: Number,
    status: { type: String, default: 'active' },
    createdAt: { type: Date, default: Date.now }
}));

// Roblox OAuth Callback
app.get('/callback', async (req, res) => {
    try {
        const code = req.query.code;
        const tokenRes = await axios.post('https://apis.roblox.com/oauth/v1/token', new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.REDIRECT_URI
        }));

        const userRes = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        const rankRes = await axios.get(`https://groups.roblox.com/v1/users/${userRes.data.sub}/groups/roles`);
        const group = rankRes.data.data.find(g => g.group.id == 12734419);
        const rank = group ? group.role.rank : 0;

        res.redirect(`/?username=${userRes.data.preferred_username}&userId=${userRes.data.sub}&rank=${rank}`);
    } catch (err) {
        res.status(500).send("Authentication Failed");
    }
});

// Admin API
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

app.post('/api/cancel', async (req, res) => {
    if (req.body.rank < 98) return res.status(403).send("Unauthorized");
    await Booking.findByIdAndUpdate(req.body.id, { status: 'cancelled' });
    res.json({ success: true });
});

app.get('/api/sessions', async (req, res) => {
    const sessions = await Booking.find({ status: 'active' });
    res.json(sessions);
});

// Render uses port 10000 by default
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
