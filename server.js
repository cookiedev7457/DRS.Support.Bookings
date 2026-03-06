/**
 * ==============================================================================
 * DRS STAFF PORTAL - BACKEND v3.2.0 (2026 RELEASE)
 * ==============================================================================
 * * CORE FEATURES:
 * - Direct Trello API Integration (Cards & Checklists)
 * - Username-based registration (Bypass OAuth Cookie Loops)
 * - Bidirectional Booking (Join / Cancel)
 * - Robust Error Logging & Request Middleware
 * * ==============================================================================
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// --- ENVIRONMENT CONFIG ---
const PORT = process.env.PORT || 10000;
const GROUP_ID = 12734419; // DRS Main Group

// Trello Label Hex Map (Matches Trello UI exactly)
const COLORS = {
    green:  '#61bd4f',
    yellow: '#f2d600',
    orange: '#ff9f1a',
    red:    '#eb5a46',
    purple: '#c377e0',
    blue:   '#0079bf',
    sky:    '#00c2e0',
    lime:   '#51e898',
    pink:   '#ff80ce',
    black:  '#344563'
};

// --- MIDDLEWARE ---

// Standard logging to help diagnose Render issues
app.use(morgan('combined'));

// Standard body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Secure CORS for GitHub Pages
app.use(cors({
    origin: 'https://cookiedev7457.github.io',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// --- UTILITY LOGIC ---

/**
 * Validates Trello Response Data Structure
 */
const isValidCard = (card) => {
    return card && card.id && card.name && Array.isArray(card.checklists);
};

/**
 * Parses Metadata from the Card Description
 * Matches: "Host: Username" and "Requirements: Text"
 */
function getMetaData(description) {
    if (!description) return { host: 'TBD', requirements: 'None' };
    
    const clean = description.replace(/\*\*/g, '');
    const h = clean.match(/Host:\s*(.*)/i);
    const r = clean.match(/Requirements:\s*(.*)/i);

    return {
        host: h ? h[1].trim() : 'TBD',
        requirements: r ? r[1].trim() : 'Standard Protocols'
    };
}

// --- API ROUTES ---

/**
 * GET /api/sessions
 * Returns formatted training data for the UI
 */
app.get('/api/sessions', async (req, res) => {
    const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_LIST_ID } = process.env;

    if (!TRELLO_KEY || !TRELLO_TOKEN || !TRELLO_LIST_ID) {
        return res.status(500).json({ error: "Missing Trello Environment Variables" });
    }

    try {
        const url = `https://api.trello.com/1/lists/${TRELLO_LIST_ID}/cards?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}&checklists=all&labels=true`;
        const response = await axios.get(url);
        
        const data = response.data.filter(isValidCard).map(card => {
            const meta = getMetaData(card.desc);
            return {
                id: card.id,
                name: card.name,
                checklistId: card.checklists[0]?.id || null,
                host: meta.host,
                requirements: meta.requirements,
                participants: card.checklists[0]?.checkItems.map(item => ({
                    id: item.id,
                    name: item.name
                })) || [],
                tags: card.labels.map(l => ({ 
                    name: l.name, 
                    color: COLORS[l.color] || '#888' 
                }))
            };
        });

        res.status(200).json(data);
    } catch (err) {
        console.error(`[TRELLO FETCH ERROR]: ${err.message}`);
        res.status(500).json({ error: "Trello Sync Failed" });
    }
});

/**
 * POST /api/join
 * Registers a username to a session checklist
 */
app.post('/api/join', async (req, res) => {
    const { username, checklistId } = req.body;
    const { TRELLO_KEY, TRELLO_TOKEN } = process.env;

    if (!username || !checklistId) {
        return res.status(400).json({ error: "Invalid Request: Username/ID Missing" });
    }

    try {
        // Prevent Duplicate Entries
        const fetchUrl = `https://api.trello.com/1/checklists/${checklistId}?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
        const check = await axios.get(fetchUrl);
        const exists = check.data.checkItems.some(i => i.name.toLowerCase() === username.toLowerCase());

        if (exists) {
            return res.status(400).json({ error: "You are already signed up for this session." });
        }

        // Add User
        const joinUrl = `https://api.trello.com/1/checklists/${checklistId}/checkItems`;
        await axios.post(joinUrl, null, {
            params: { name: username, key: TRELLO_KEY, token: TRELLO_TOKEN }
        });

        console.log(`[ACTION] ${username} JOINED session ${checklistId}`);
        res.status(200).json({ success: true });
    } catch (err) {
        console.error(`[JOIN FAILED]: ${err.message}`);
        res.status(500).json({ error: "Trello declined the booking." });
    }
});

/**
 * POST /api/unbook
 * Removes a username from a session checklist
 */
app.post('/api/unbook', async (req, res) => {
    const { username, checklistId } = req.body;
    const { TRELLO_KEY, TRELLO_TOKEN } = process.env;

    if (!username || !checklistId) {
        return res.status(400).json({ error: "Missing Cancellation Data" });
    }

    try {
        // Find the user's specific Item ID on the Trello Checklist
        const url = `https://api.trello.com/1/checklists/${checklistId}?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
        const checkRes = await axios.get(url);
        
        const item = checkRes.data.checkItems.find(i => i.name.toLowerCase() === username.toLowerCase());

        if (!item) {
            return res.status(404).json({ error: "No existing booking found for this username." });
        }

        // Delete from Trello
        const delUrl = `https://api.trello.com/1/checklists/${checklistId}/checkItems/${item.id}?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
        await axios.delete(delUrl);

        console.log(`[ACTION] ${username} UNBOOKED session ${checklistId}`);
        res.status(200).json({ success: true });
    } catch (err) {
        console.error(`[UNBOOK FAILED]: ${err.message}`);
        res.status(500).json({ error: "Failed to remove booking from Trello." });
    }
});

/**
 * Health Check for Render Monitor
 */
app.get('/health', (req, res) => {
    res.status(200).send("System Operational");
});

// --- SERVER INITIALIZATION ---

app.listen(PORT, () => {
    console.log(`
    ================================================
    DRS STAFF PORTAL BACKEND - VERSION 3.2.0
    PORT: ${PORT}
    SYSTEM TIME: ${new Date().toISOString()}
    STATUS: ONLINE
    ================================================
    `);
});
