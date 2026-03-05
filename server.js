// 1. Updated Schema to include participants
const Booking = mongoose.model('Booking', new mongoose.Schema({
    sessionName: String,
    hostName: String,
    hostId: Number,
    status: { type: String, default: 'active' },
    participants: { type: [Number], default: [] }, // Stores Roblox User IDs
    createdAt: { type: Date, default: Date.now }
}));

// 2. NEW ROUTE: Staff Join Session
app.post('/api/join', async (req, res) => {
    const { sessionId, userId } = req.body;

    try {
        // Find the session and add the userId to the participants list if not already there
        const session = await Booking.findById(sessionId);
        
        if (!session) return res.status(404).send("Session not found");
        if (session.participants.includes(userId)) {
            return res.status(400).send("You are already booked for this session.");
        }

        session.participants.push(userId);
        await session.save();
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).send("Error joining session");
    }
});
