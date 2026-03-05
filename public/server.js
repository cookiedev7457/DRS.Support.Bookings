const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.static('public'));

const GROUP_ID = '12734419';
const MIN_ADMIN_RANK = 98;

app.get('/auth/roblox', (req, res) => {
    const url = `https://apis.roblox.com/oauth/v1/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=openid+profile&response_type=code`;
    res.redirect(url);
});

app.get('/callback', async (req, res) => {
    try {
        const code = req.query.code;
        // 1. Get Access Token
        const tokenToken = Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString('base64');
        const tokenRes = await axios.post('https://apis.roblox.com/oauth/v1/token', 
            `grant_type=authorization_code&code=${code}&redirect_uri=${process.env.REDIRECT_URI}`, 
            { headers: { 'Authorization': `Basic ${tokenToken}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        // 2. Get User Info
        const userRes = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
            headers: { 'Authorization': `Bearer ${tokenRes.data.access_token}` }
        });

        // 3. Check Rank
        const rankRes = await axios.get(`https://groups.roblox.com/v1/users/${userRes.data.sub}/groups/roles`);
        const groupData = rankRes.data.data.find(g => g.group.id == GROUP_ID);
        const userRank = groupData ? groupData.role.rank : 0;

        res.redirect(`/?user=${userRes.data.preferred_username}&admin=${userRank >= MIN_ADMIN_RANK}`);
    } catch (e) {
        res.send("Authentication Failed. Make sure your Secret Keys are correct.");
    }
});

app.listen(process.env.PORT || 3000);
