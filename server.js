/**
 * ==============================================================================
 * DRS SUPPORT BOOKINGS - Server Script (v1.1.9)
 * ==============================================================================
 * DESCRIPTION:
 * This system allows users to book their trainings insted of waiting longer.
 * It connects to Trello Developer API via another hosing platform.
 * ==============================================================================
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// --- CONFIGURATION ---
const PORT = process.env.PORT || 10000;

// Standard Trello Hex Colors
const TAG_COLORS = {
    green:  '#61bd4f',
    yellow: '#f2d600',
    orange: '#ff9f1a',
    red:    '#eb5a46',
    purple: '#c377e0',
    blue:   '#0079bf',
    sky:    '#00c2e0',
    lime:   '#51e898',
    black:  '#344563'
};

// --- MIDDLEWARE ---
app.use(morgan('dev'));
app.use(express.json());
app.use(cors({
    origin: 'https://cookiedev7457.github.io',
    methods: ['GET', 'POST']
}));

// --- UTILITIES ---

/**
 * Parses card descriptions for Host and Requirements fields.
 */
function getCardMetaData(desc) {
    if (!desc) return { host: 'TBD', reqs: 'Standard' };
    const clean = desc.replace(/\*\*/g, '');
    const host = clean.match(/Host:\s*(.*)/i);
    const reqs = clean.match(/Requirements:\s*(.*)/i);
    return {
        host: host ? host[1].trim() : 'TBD',
        reqs: reqs ? reqs[1].trim() : 'Standard'
    };
}

// --- API ROUTES ---

/**
 * GET /api/sessions
 * Fetches training cards from Trello.
 */
app.get('/api/sessions', async (req, res) => {
    const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_LIST_ID } = process.env;
    
    if (!TRELLO_KEY || !TRELLO_TOKEN) {
        return res.status(500).json({ error: "Server credentials missing" });
    }

    try {
        const url = `https://api.trello.com/1/lists/${TRELLO_LIST_ID}/cards?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}&checklists=all&labels=true`;
        const response = await axios.get(url);
        
        const sessions = response.data.map(card => {
            const meta = getCardMetaData(card.desc);
            return {
                id: card.id,
                name: card.name,
                checklistId: card.checklists[0]?.id || null,
                host: meta.host,
                requirements: meta.reqs,
                participants: card.checklists[0]?.checkItems.map(item => item.name.toLowerCase()) || [],
                tags: card.labels.map(l => ({ name: l.name, color: TAG_COLORS[l.color] || '#888' }))
            };
        });

        res.json(sessions);
    } catch (err) {
        console.error("Trello Fetch Error:", err.message);
        res.status(500).json({ error: "Failed to load sessions" });
    }
});

/**
 * POST /api/join
 * Adds a provided username to the Trello checklist.
 */
app.post('/api/join', async (req, res) => {
    const { username, checklistId } = req.body;
    const { TRELLO_KEY, TRELLO_TOKEN } = process.env;

    if (!username || !checklistId) {
        return res.status(400).json({ error: "Username and Session ID required" });
    }

    try {
        // Validate the user isn't already on the list (Case-Insensitive)
        const checkUrl = `https://api.trello.com/1/checklists/${checklistId}?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
        const checkData = await axios.get(checkUrl);
        const exists = checkData.data.checkItems.some(item => 
            item.name.toLowerCase() === username.toLowerCase()
        );

        if (exists) {
            return res.status(400).json({ error: "You are already booked for this session." });
        }

        // Add to Trello
        const joinUrl = `https://api.trello.com/1/checklists/${checklistId}/checkItems`;
        await axios.post(joinUrl, null, {
            params: {
                name: username,
                key: TRELLO_KEY,
                token: TRELLO_TOKEN
            }
        });

        console.log(`[BOOKING] ${username} successfully joined ${checklistId}`);
        res.json({ success: true });
    } catch (err) {
        console.error("Booking Error:", err.message);
        res.status(500).json({ error: "Trello rejected the booking." });
    }
});

// Root Route
app.get('/', (req, res) => {
    res.send("DRS Booking API is Online.");
});

// Error handling
app.use((err, req, res, next) => {
    res.status(500).send("Something went wrong on the server.");
});

// Initialize
app.listen(PORT, () => {
    console.log(`DRS Server running on port ${PORT}`);
});
