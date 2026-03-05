// Configuration
const ADMIN_RANK_ID = 1; // Change this to your Roblox Rank ID
let isLoggedIn = false;
let userRank = 0;

// Mock Data (In a real GitHub setup, you'd fetch this from a file)
let sessions = [
    { host: "RobloxDev_User", time: "2024-10-25T18:00", status: "Available" }
];

function renderSlots() {
    const container = document.getElementById('slot-container');
    container.innerHTML = "";

    sessions.forEach((session, index) => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div>
                <strong>Host:</strong> ${session.host}<br>
                <strong>Time:</strong> ${new Date(session.time).toLocaleString()}<br>
                <span class="status-tag">Status: ${session.status}</span>
            </div>
            ${userRank >= ADMIN_RANK_ID ? 
                `<button onclick="deleteSlot(${index})" style="background:#ff4444; border:none; color:white; padding:5px; cursor:pointer;">Remove</button>` : 
                `<button class="login-btn" onclick="bookSlot(${index})">Book</button>`}
        `;
        container.appendChild(div);
    });
}

function handleAuth() {
    // This is where you would normally integrate the Roblox Login API
    // For now, we simulate a login
    isLoggedIn = true;
    userRank = 255; // Simulating an Admin rank
    
    document.getElementById('auth-btn').innerText = "Logged In";
    
    if (userRank >= ADMIN_RANK_ID) {
        document.getElementById('admin-panel').classList.remove('hidden');
    }
    renderSlots();
}

function createNewSlot() {
    const host = document.getElementById('host-name').value;
    const time = document.getElementById('slot-time').value;
    
    if(host && time) {
        sessions.push({ host, time, status: "Available" });
        renderSlots();
    }
}

function deleteSlot(index) {
    sessions.splice(index, 1);
    renderSlots();
}

function bookSlot(index) {
    sessions[index].status = "Booked";
    renderSlots();
    alert("Training Booked!");
}

// Initial Load
renderSlots();
