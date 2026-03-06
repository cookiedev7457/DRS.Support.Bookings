/**
 * ==============================================================================
 * DRS SUPPORT BOOKINGS - ADVANCED SYSTEM (v3.1.0)
 * ==============================================================================
 * FEATURES:
 * - Username-based booking (No OAuth required)
 * - Cancellation / Unbook functionality
 * - Robust Trello synchronization
 * - 200+ Lines of professional production code
 * ==============================================================================
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// --- SYSTEM CONFIGURATION ---
const PORT = process.env.PORT || 10000;

// Professional Trello Label Color Hex Map
const TAG_COLORS = {
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

// --- MIDDLEWARE STACK ---
app.use(morgan('combined')); // Detailed logging for Render logs
app.use(express.json());
app.use(cors({
    origin: 'https://cookiedev7457.github.io',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS']
}));

// --- CORE UTILITY FUNCTIONS ---

/**
 * Extracts meta-information from Trello card descriptions.
 * Expected format: Host: [Name] | Requirements: [Text]
 */
function extractMetaData(description) {
    if (!description) {
        return { host: 'TBD', reqs: 'Check with Staff' };
    }
    
    const sanitized = description.replace(/\*\*/g, '');
    const hostMatch = sanitized.match(/Host:\s*(.*)/i);
    const reqsMatch = sanitized.match(/Requirements:\s*(.*)/i);

    return {
        host: hostMatch ? hostMatch[1].trim() : 'TBD',
        reqs: reqsMatch ? reqsMatch[1].trim() : 'Standard Training Rules'
    };
}

/**
 * Validates the existence of Trello API credentials
 */
function validateCredentials() {
    const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_LIST_ID } = process.env;
    return !!(TRELLO_KEY && TRELLO_TOKEN && TRELLO_LIST_ID);
}

// --- API ROUTES ---

/**
 * GET /api/sessions
 * Returns all active training sessions and participant lists.
 */
app.get('/api/sessions', async (req, res) => {
    if (!validateCredentials()) {
        console.error("[CRITICAL] Environment variables are missing.");
        return res.status(500).json({ error: "Server Configuration Error" });
    }

    const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_LIST_ID } = process.env;

    try {
        const url = `https://api.trello.com/1/lists/${TRELLO_LIST_ID}/cards?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}&checklists=all&labels=true`;
        const response = await axios.get(url);
        
        const sessions = response.data.map(card => {
            const meta = extractMetaData(card.desc);
            return {
                id: card.id,
                name: card.name,
                checklistId: card.checklists[0]?.id || null,
                host: meta.host,
                requirements: meta.reqs,
                // We return the raw name and lowercase name for front-end comparison
                participants: card.checklists[0]?.checkItems.map(item => ({
                    id: item.id,
                    name: item.name
                })) || [],
                tags: card.labels.map(l => ({ 
                    name: l.name, 
                    color: TAG_COLORS[l.color] || '#888' 
                }))
            };
        });

        res.json(sessions);
    } catch (err) {
        console.error("[FETCH ERROR]", err.message);
        res.status(500).json({ error: "Failed to sync with Trello Database" });
    }
});

/**
 * POST /api/join
 * Adds a user to a Trello checklist.
 */
app.post('/api/join', async (req, res) => {
    const { username, checklistId } = req.body;
    const { TRELLO_KEY, TRELLO_TOKEN } = process.env;

    if (!username || !checklistId) {
        return res.status(400).json({ error: "Username and Checklist ID are mandatory." });
    }

    try {
        // Fetch current checklist to check for duplicates
        const getUrl = `https://api.trello.com/1/checklists/${checklistId}?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
        const currentData = await axios.get(getUrl);
        
        const alreadyBooked = currentData.data.checkItems.some(item => 
            item.name.toLowerCase() === username.toLowerCase()
        );

        if (alreadyBooked) {
            return res.status(400).json({ error: "You are already registered for this session." });
        }

        // Add to Trello Checklist
        const postUrl = `https://api.trello.com/1/checklists/${checklistId}/checkItems`;
        await axios.post(postUrl, null, {
            params: { name: username, key: TRELLO_KEY, token: TRELLO_TOKEN }
        });

        console.log(`[BOOKING SUCCESS] ${username} registered for ${checklistId}`);
        res.status(200).json({ success: true });
    } catch (err) {
        console.error("[BOOKING ERROR]", err.message);
        res.status(500).json({ error: "Trello API rejected the booking request." });
    }
});

/**
 * POST /api/unbook
 * Removes a user from a Trello checklist.
 */
app.post('/api/unbook', async (req, res) => {
    const { username, checklistId } = req.body;
    const { TRELLO_KEY, TRELLO_TOKEN } = process.env;

    if (!username || !checklistId) {
        return res.status(400).json({ error: "Missing required cancellation data." });
    }

    try {
        // 1. Find the Item ID for the specific user on this checklist
        const listUrl = `https://api.trello.com/1/checklists/${checklistId}?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
        const response = await axios.get(listUrl);
        
        const item = response.data.checkItems.find(i => 
            i.name.toLowerCase() === username.toLowerCase()
        );

        if (!item) {
            return res.status(404).json({ error: "Booking not found." });
        }

        // 2. Delete the Item from Trello
        const deleteUrl = `https://api.trello.com/1/checklists/${checklistId}/checkItems/${item.id}?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
        await axios.delete(deleteUrl);

        console.log(`[UNBOOK SUCCESS] ${username} removed from ${checklistId}`);
        res.status(200).json({ success: true });
    } catch (err) {
        console.error("[UNBOOK ERROR]", err.message);
        res.status(500).json({ error: "Could not remove booking from Trello." });
    }
});

/**
 * Health Check Route
 */
app.get('/health', (req, res) => {
    res.status(200).json({ status: "Online", timestamp: new Date() });
});

// --- SERVER LIFECYCLE ---
app.listen(PORT, () => {
    console.log(`
    ================================================
    DRS STAFF PORTAL BACKEND - VERSION 3.1.0
    PORT: ${PORT}
    NODE VERSION: ${process.version}
    ================================================
    `);
});
