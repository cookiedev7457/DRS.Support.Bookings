// ... (Your existing imports and MongoDB setup)

// Middleware to verify if a user is actually an Admin
// This prevents people from "faking" admin status in the URL
async function isAdmin(userId) {
    try {
        const rankRes = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
        const group = rankRes.data.data.find(g => g.group.id == 12734419);
        return group && group.role.rank >= 98;
    } catch (err) {
        return false;
    }
}

// SECURE CREATE ROUTE
app.post('/api/create', async (req, res) => {
    const authorized = await isAdmin(req.body.userId);
    if (!authorized) return res.status(403).send("Nice try, but you aren't an admin.");
    
    const session = new Booking({ 
        sessionName: req.body.name, 
        hostName: req.body.username,
        hostId: req.body.userId 
    });
    await session.save();
    res.json({ success: true });
});

// SECURE EDIT ROUTE
app.post('/api/edit', async (req, res) => {
    const authorized = await isAdmin(req.body.userId);
    if (!authorized) return res.status(403).send("Unauthorized");

    await Booking.findByIdAndUpdate(req.body.id, { sessionName: req.body.newName });
    res.json({ success: true });
});

// SECURE CANCEL ROUTE
app.post('/api/cancel', async (req, res) => {
    const authorized = await isAdmin(req.body.userId);
    if (!authorized) return res.status(403).send("Unauthorized");

    await Booking.findByIdAndUpdate(req.body.id, { status: 'cancelled' });
    res.json({ success: true });
});
