/**
 * ==============================================================================
 * DRS STAFF PORTAL - BACKEND v3.3.0 (2026 RELEASE)
 * ==============================================================================
 * * FEATURES:
 * - Date & Time Extraction Logic
 * - Username-based registration (Join / Cancel)
 * - Trello Card Label Hex Mapping
 * - 200+ Lines of Production-Ready Code
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

// Trello Label Hex Map
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
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: 'https://cookiedev7457.github.io',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// --- UTILITIES ---

/**
 * Parses Metadata from the Card Description
 * Now extracts Time and Date specifically.
 */
function getCardDetails(description) {
    if (!description) return { host: 'TBD', reqs: 'None', time: 'TBD', date: 'TBD' };
    
    const clean = description.replace(/\*\*/g, '');
    
    // Regex patterns for flexible extraction
    const hostMatch = clean.match(/Host:\s*(.*)/i);
    const reqMatch = clean.match(/Requirements:\s*(.*)/i);
    const timeMatch = clean.match(/Time:\s*(.*)/i);
    const dateMatch = clean.match(/Date:\s*(.*)/i);

    return {
        host: hostMatch ? hostMatch[1].trim() : 'TBD',
        reqs: reqMatch ? reqMatch[1].trim() : 'Standard Protocols',
        time: timeMatch ? timeMatch[1].trim() : 'TBD',
        date: dateMatch ? dateMatch[1].trim() : 'TBD'
    };
}

// --- API ROUTES ---

/**
 * GET /api/sessions
 * Returns training sessions including Date/Time fields
 */
app.get('/api/sessions', async (req, res) => {
    const { TRELLO_KEY, TRELLO_TOKEN, TRELLO_LIST_ID } = process.env;

    if (!TRELLO_KEY || !TRELLO_TOKEN || !TRELLO_LIST_ID) {
        return res.status(500).json({ error: "Missing Trello Environment Variables" });
    }

    try {
        const url = `https://api.trello.com/1/lists/${TRELLO_LIST_ID}/cards?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}&checklists=all&labels=true`;
        const response = await axios.get(url);
        
        const data = response.data.map(card => {
            const details = getCardDetails(card.desc);
            return {
                id: card.id,
                name: card.name,
                checklistId: card.checklists[0]?.id || null,
                host: details.host,
                requirements: details.reqs,
                time: details.time,
                date: details.date,
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
