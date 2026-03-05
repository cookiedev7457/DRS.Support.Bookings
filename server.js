// ... (Keep existing imports and MongoDB connection)

// Updated API: Edit an existing session
app.post('/api/edit', async (req, res) => {
    if (req.body.rank < 98) return res.status(403).send("Unauthorized");
    try {
        const { id, newName } = req.body;
        await Booking.findByIdAndUpdate(id, { sessionName: newName });
        res.json({ success: true });
    } catch (err) {
        res.status(500).send("Error updating session");
    }
});

// Admin/Public API: Get all active sessions including participants
app.get('/api/sessions', async (req, res) => {
    try {
        const sessions = await Booking.find({ status: 'active' });
        res.json(sessions);
    } catch (err) {
        res.status(500).send("Error fetching sessions");
    }
});

// ... (Keep existing join and create routes)
