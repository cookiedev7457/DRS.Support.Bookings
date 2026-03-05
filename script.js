const ADMIN_RANK_ID = 200; 
let isLoggedIn = false;
let userRank = 0;

// Sessions now include a 'type' property
let sessions = [
    { host: "Chief_Developer", time: "2026-03-10T14:00", type: "Studio", status: "Available" },
    { host: "Product_Manager", time: "2026-03-12T16:00", type: "Product", status: "Available" }
];

function renderSlots() {
    const container = document.getElementById('slot-container');
    container.innerHTML = "";

    sessions.forEach((session, index) => {
        const div = document.createElement('div');
        div.className = 'card';
        
        // Determine badge color
        const typeClass = session.type === "Studio" ? "studio" : "product";

        div.innerHTML = `
            <div>
                <span class="qual-badge ${typeClass}">${session.type}</span><br>
                <strong>Host:</strong> ${session.host}<br>
                <strong>Time:</strong> ${new Date(session.time).toLocaleString()}<br>
                <small>Status: ${session.status}</small>
            </div>
            ${userRank >= ADMIN_RANK_ID ? 
                `<button onclick="deleteSlot(${index})" style="background:#ff4444; border:none; color:white; padding:8px; cursor:pointer; border-radius:4px;">Remove</button>` : 
                `<button class="login-btn" onclick="bookSlot(${index})" ${session.status === 'Booked' ? 'disabled' : ''}>
                    ${session.status === 'Booked' ? 'Full' : 'Book Now'}
                </button>`}
        `;
        container.appendChild(div);
    });
}

function handleAuth() {
    // Simulated Rank Check
    isLoggedIn = true;
    userRank = 255; 
    document.getElementById('auth-btn').innerText = "Logged In (Admin)";
    if (userRank >= ADMIN_RANK_ID) {
        document.getElementById('admin-panel').classList.remove('hidden');
    }
    renderSlots();
}

function createNewSlot() {
    const host = document.getElementById('host-name').value;
    const time = document.getElementById('slot-time').value;
    const type = document.getElementById('qual-type').value; // Get the dropdown value
    
    if(host && time) {
        sessions.push({ host, time, type, status: "Available" });
        renderSlots();
        // Clear inputs
        document.getElementById('host-name').value = "";
    } else {
        alert("Please enter a host and time.");
    }
}

function deleteSlot(index) {
    sessions.splice(index, 1);
    renderSlots();
}

function bookSlot(index) {
    if (sessions[index].status === "Available") {
        sessions[index].status = "Booked";
        renderSlots();
        alert(`Successfully booked for ${sessions[index].type} training!`);
    }
}

renderSlots();
