/**
 * DRS Support Bookings - Professional Backend Service
 * Version: 2.1.0 (2026 Stable)
 * Dependencies: express, axios, cors, express-session, dotenv, helmet, morgan
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const session = require('express-session');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();

// --- CONFIGURATION & ENV CHECK ---
const PORT = process.env.PORT || 10000;
const {
    TRELLO_KEY,
    TRELLO_TOKEN,
    TRELLO_LIST_ID,
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI,
    SESSION_SECRET = 'DRS_FALLBACK_SECRET_2026'
} = process.env;

const MY_ROBLOX_GROUP_ID = 12734419;
const MIN_RANK = 45;

// --- MIDDLEWARE STACK ---

// 1. Security Headers
app.use(helmet({
    contentSecurityPolicy: false, // Allows GitHub Pages to communicate
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

// 2. Request Logging
app.use(morgan('dev'));

// 3. Body Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Advanced CORS
app.use(cors({
    origin: 'https://cookiedev7457.github.io',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 5. Session Management (The "Loop Fixer")
app.set('trust proxy', 1); // Crucial for Render/Heroku
app.use(session({
    name: 'DRS_Auth_Identifier',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        secure: true,
        sameSite: 'none',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24 Hours
    }
}));

// --- HELPER FUNCTIONS ---

/**
 * Validates Trello Response Data
 */
const validateTrelloData = (data) => {
    return Array.isArray(data) ? data : [];
};

/**
 * Extracts Session Data from Trello Card Description
 */
const parseDescription = (desc) => {
    if (!desc) return { host: "TBD", reqs: "N/A" };
    const clean = desc.replace(/\*\*/g, '');
    const hostMatch = clean.match(/Host:\s*(.*)/i);
    const reqMatch = clean.match(/Requirements:\s*(.*)/i);
    return {
        host: hostMatch ? hostMatch[1].trim() : "TBD",
        reqs: reqMatch ? reqMatch[1].trim() : "N/A"
    };
};

// --- API ROUTES ---

/**
 * @route   GET /api/me
 * @desc    Checks if the user session is active
 */
app.get('/api/me', (req, res) => {
    console.log(`[Auth Check] Session ID: ${req.sessionID}`);
    if (req.session && req.session.user) {
        return res.status(200).json({
            success: true,
            loggedIn: true,
            user: req.session.user
        });
    }
    res.status(200).json({
        success: true,
        loggedIn: false,
        message: "No active session found"
    });
});

/**
 * @route   GET /api/sessions
 * @desc    Fetches and parses training sessions from Trello
 */
app.get('/api/sessions', async (req, res) => {
    try {
        const trelloUrl = `https://api.trello.com/1/lists/${TRELLO_LIST_ID}/cards`;
        const response = await axios.get(trelloUrl, {
            params: {
                key: TRELLO_KEY,
                token: TRELLO_TOKEN,
                checklists: 'all',
                fields: 'name,desc,labels'
            }
        });

        const rawCards = validateTrelloData(response.data);
        const processedSessions = rawCards.map(card => {
            const details = parseDescription(card.desc);
            return {
                id: card.id,
                checklistId: card.checklists[0]?.id || null,
                name: card.name,
                host: details.host,
                requirements: details.reqs,
                attendees: card.checklists[0]?.checkItems.map(item => item.name) || [],
                tags: card.labels.map(l => ({ name: l.name, color: l.color }))
            };
        });

        res.status(200).json(processedSessions);
    } catch (error) {
        console.error(`[Trello Error] ${error.message}`);
        res.status(500).json({ error: "Failed to sync with Trello" });
    }
});

/**
 * @route   POST /api/join
 * @desc    Adds a user to a specific session checklist
 */
app.post('/api/join', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: "Authentication required" });
    }

    const { checklistId, sessionName } = req.body;
    const username = req.session.user.username;

    if (!checklistId) {
        return res.status(400).json({ error: "Invalid session target" });
    }

    try {
        const joinUrl = `https://api.trello.com/1/checklists/${checklistId}/checkItems`;
        await axios.post(joinUrl, null, {
            params: {
                name: username,
                key: TRELLO_KEY,
                token: TRELLO_TOKEN
            }
        });

        console.log(`[Booking] ${username} joined ${sessionName}`);
        res.status(200).json({ success: true, message: "Spot reserved" });
    } catch (error) {
        console.error(`[Join Error] ${error.message}`);
        res.status(500).json({ error: "Could not update Trello" });
    }
});

/**
 * @route   GET /callback
 * @desc    Roblox OAuth2 Exchange
 */
app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("Authorization code missing");

    try {
        // 1. Exchange Code for Token
        const tokenResponse = await axios.post('https://apis.roblox.com/oauth/v1/token', 
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI
            })
        );

        const accessToken = tokenResponse.data.access_token;

        // 2. Fetch User Profile
        const userProfile = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const { sub: userId, preferred_username: username } = userProfile.data;

        // 3. Check Group Membership & Rank
        const groupUrl = `https://groups.roblox.com/v1/users/${userId}/groups/roles`;
        const groupRes = await axios.get(groupUrl);
        const membership = groupRes.data.data.find(g => g.group.id === MY_ROBLOX_GROUP_ID);
        const userRank = membership ? membership.role.rank : 0;

        if (userRank < MIN_RANK) {
            console.warn(`[Access Denied] ${username} (Rank ${userRank})`);
            return res.redirect(`
