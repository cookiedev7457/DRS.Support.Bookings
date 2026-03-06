const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({ origin: 'https://cookiedev7457.github.io' }));

const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_LIST_ID, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = process.env;

// 1. FETCH SESSIONS FROM TRELLO
app.get('/api/sessions', async (req, res) => {
    try {
        const url = `https://api.trello.com/1/lists/${TRELLO_LIST_ID}/cards?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}&checklists=all`;
        const response = await axios.get(url);
        
        const sessions = response.data.map(card => {
            // Regex to find "Host:" and "Requirements:" in the Trello description
            const hostMatch = card.desc.match(/Host:\s*(.*)/i);
            const reqMatch = card.desc.match(/Requirements:\s*(.*)/i);
            
            return {
                id: card.id,
                sessionName: card.name,
                hostName: hostMatch ? hostMatch[1].trim() : "TBD",
                requirements: reqMatch ? reqMatch[1].trim() : "No requirements listed",
                participants: card.checklists[0] ? card.checklists[0].checkItems.length : 0
            };
        });
        res.json(sessions);
    } catch (err) {
        console.error("Trello Error:", err.message);
        res.status(500).json({ error: "Trello connection failed" });
    }
});

// 2. BOOKING: Adds user to Trello checklist
app.post('/api/join', async (req, res) => {
    const { cardId, username } = req.body;
    try {
        const checkUrl = `https://api.trello.com/1/cards/${cardId}/checklists?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
        const checkRes = await axios.get(checkUrl);
        let checklistId = checkRes.data[0]?.id;

        if (!checklistId) {
            const newCheck = await axios.post(checkUrl, { name: "Booked Staff" });
            checklistId = newCheck.data.id;
        }

        await axios.post(`https://api.trello.com/1/checklists/${checklistId}/checkItems?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`, {
            name: username
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Trello booking failed" });
    }
});

// 3. ROBLOX LOGIN CALLBACK
app.get('/callback', async (req, res) => {
    try {
        const code = req.query.code;
        const tokenRes = await axios.post('https://apis.roblox.com/oauth/v1/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const userRes = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        // Redirect back to GitHub with user info
        const githubUrl = `https://cookiedev7457.github.io/DRS.Support.Bookings/public/index.html?username=${userRes.data.preferred_username}&userId=${userRes.data.sub}`;
        res.redirect(githubUrl);
    } catch (err) {
        res.status(500).send("Login failed. Check Render logs.");
    }
});

app.listen(10000, () => console.log("Trello Brain is Online"));
