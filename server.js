const cors = require('cors');
app.use(cors()); // Allows GitHub to talk to Render

// New Route: Check if a user is an Admin safely
app.get('/api/check-rank', async (req, res) => {
    const userId = req.query.userId;
    try {
        const response = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
        const group = response.data.data.find(g => g.group.id == 12734419);
        const rank = group ? group.role.rank : 0;
        
        // Only send back the rank, don't put it in the URL
        res.json({ isAdmin: rank >= 98, rank: rank });
    } catch (err) {
        res.status(500).json({ isAdmin: false });
    }
});
