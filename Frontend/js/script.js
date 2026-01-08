// ================================
// GLOBAL STORAGE
// ================================
let stations = JSON.parse(localStorage.getItem("stations")) || [];
let bookings = JSON.parse(localStorage.getItem("bookings")) || [];
let pendingPayment = null;

// ================================
// DOM REFERENCES (SAFE)
// ================================
const stationName = document.getElementById("stationName");
const stationLocation = document.getElementById("stationLocation");
const stationLat = document.getElementById("stationLat");
const stationLng = document.getElementById("stationLng");
const stationPrice = document.getElementById("stationPrice");
const stationStatus = document.getElementById("stationStatus");
const chargingPointsCount = document.getElementById("chargingPointsCount");

const stationTable = document.getElementById("stationTable");
const userStationTable = document.getElementById("userStationTable");
const bookingTable = document.getElementById("bookingTable");

const bookingDate = document.getElementById("bookingDate");
const selectedStationTitle = document.getElementById("selectedStationTitle");
const chargingPointsContainer = document.getElementById("chargingPointsContainer");

const adminStationIndex = document.getElementById("adminStationIndex");
const adminPointId = document.getElementById("adminPointId");
const adminDate = document.getElementById("adminDate");
const adminTimeSlot = document.getElementById("adminTimeSlot");
// ================================
// PAYMENT CONFIG
// ================================
const ADVANCE_AMOUNT = 100; // ₹100 fixed advance

// ================================
// IST DATE UTILITIES
// ================================
function getISTDate() {
    const now = new Date();

    // Convert local time to IST
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);

    return istTime;
}

function getISTDateString(date = getISTDate()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// ================================
// USER LOCATION
// ================================
let userLat = null;
let userLng = null;

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        pos => {
            userLat = pos.coords.latitude;
            userLng = pos.coords.longitude;
            renderUserStations();
        },
        () => console.log("Location access denied")
    );
}

// ================================
// SAVE FUNCTIONS
// ================================
function saveStations() {
    localStorage.setItem("stations", JSON.stringify(stations));
}
function saveBookings() {
    localStorage.setItem("bookings", JSON.stringify(bookings));
}

// ================================
// ADMIN: ADD STATION
// ================================
function addStation() {
    if (!stationName) return;

    const name = stationName.value;
    const location = stationLocation.value;
    const lat = stationLat.value;
    const lng = stationLng.value;
    const price = stationPrice.value;
    const status = stationStatus.value;
    const points = chargingPointsCount.value;

    if (!name || !location || !lat || !lng || !price || !points) {
        alert("Fill all fields");
        return;
    }

    const timeSlots = [
        "10:00 - 10:45","10:45 - 11:30","11:30 - 12:15","12:15 - 13:00",
        "14:00 - 14:45","14:45 - 15:30","15:30 - 16:15","16:15 - 17:00"
    ];

    let chargingPoints = [];
    for (let i = 1; i <= points; i++) {
        chargingPoints.push({
            pointId: i,
            slots: timeSlots.map(t => ({
                time: t,
                bookings: [],
                blockedDates: []
            }))
        });
    }

    stations.push({
        name,
        location,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        price: parseFloat(price),
        status,
        chargingPoints
    });

    saveStations();
    renderAdminStations();
    populateAdminBlockUI();

    stationName.value = "";
    stationLocation.value = "";
    stationLat.value = "";
    stationLng.value = "";
    stationPrice.value = "";
    chargingPointsCount.value = "";
}

// ================================
// ADMIN VIEW
// ================================
function renderAdminStations() {
    if (!stationTable) return;

    stationTable.innerHTML =
        "<tr><th>Station</th><th>Location</th><th>Status</th><th>Action</th></tr>";

    stations.forEach((s, i) => {
        stationTable.insertRow().innerHTML = `
            <td>${s.name}</td>
            <td>${s.location}</td>
            <td>${s.status}</td>
            <td>
    <button class="btn" onclick="toggleStation(${i})">
        ${s.status === "Available" ? "Set Busy" : "Set Available"}
    </button>
    <br><br>
    <button class="btn admin-btn"
        onclick="openMap(${s.lat}, ${s.lng})">
        📍 View Map
    </button>
</td>
`;
    });
}

function toggleStation(i) {
    stations[i].status =
        stations[i].status === "Available" ? "Busy" : "Available";
    saveStations();
    renderAdminStations();
    renderUserStations();
}

// ================================
// USER STATION VIEW
// ================================
function renderUserStations() {
    if (!userStationTable) return;

    userStationTable.innerHTML = `
        <tr>
            <th>Station</th><th>Location</th><th>Status</th>
            <th>Price</th><th>Distance</th><th>ETA</th><th>Action</th>
        </tr>`;

    stations.forEach((s, i) => {
        let dist = "Calculating...", eta = "-";
        if (userLat && userLng) {
            const d = calculateDistance(userLat, userLng, s.lat, s.lng).toFixed(2);
            dist = `${d} km`;
            eta = `${Math.round(d * 3)} mins`;
        }

        userStationTable.insertRow().innerHTML = `
            <td>${s.name}</td>
            <td>${s.location}</td>
            <td>${s.status}</td>
            <td>₹${s.price}</td>
            <td>${dist}</td>
            <td>${eta}</td>
            <td>
    <button class="btn" onclick="viewChargingPoints(${i})">
        View Charging Points
    </button>
    <br><br>
    <button class="btn admin-btn"
        onclick="openMap(${s.lat}, ${s.lng})">
        📍 View on Map
    </button>
</td>
`;
    });
}

// ================================
// USER: VIEW POINTS & SLOTS
// ================================
function viewChargingPoints(stationIndex) {
    const station = stations[stationIndex];
    if (!chargingPointsContainer || !selectedStationTitle) return;

    selectedStationTitle.innerText = `Charging Points – ${station.name}`;
    chargingPointsContainer.innerHTML = "";

    if (station.status === "Busy") {
        chargingPointsContainer.innerHTML =
            "<p style='color:red;font-weight:bold'>Station under maintenance</p>";
        return;
    }

    const date = bookingDate.value;

    station.chargingPoints.forEach(point => {
        let html = `<h3>Charging Point ${point.pointId}</h3>`;

        point.slots.forEach((slot, idx) => {
            if (!date) {
                html += `<p>${slot.time} : <span style="color:gray">Select date</span></p>`;
            } else if (slot.blockedDates.includes(date)) {
                html += `<p>${slot.time} : <span style="color:orange">Unavailable</span></p>`;
            } else if (slot.bookings.includes(date)) {
                html += `<p>${slot.time} : <span style="color:red">Booked</span></p>`;
            } else {
    html += `<p>${slot.time} :
        <button onclick="startPayment(${stationIndex}, ${point.pointId}, ${idx})">
            Pay ₹100 & Book
        </button>
    </p>`;
}

        });

        const div = document.createElement("div");
        div.style.border = "1px solid #ccc";
        div.style.padding = "10px";
        div.style.marginBottom = "15px";
        div.innerHTML = html;
        chargingPointsContainer.appendChild(div);
    });
}

// ================================
// RE-RENDER WHEN DATE CHANGES (FIX)
// ================================
if (bookingDate) {
    bookingDate.addEventListener("change", () => {
        if (!selectedStationTitle.innerText) return;
        const name = selectedStationTitle.innerText.split("–")[1]?.trim();
        const index = stations.findIndex(s => s.name === name);
        if (index !== -1) viewChargingPoints(index);
    });
}

function initiatePayment(stationIndex, pointId, slotIndex) {
    const date = bookingDate.value;
    if (!date) {
        alert("Please select booking date first");
        return;
    }

    pendingPayment = { stationIndex, pointId, slotIndex };

    document.getElementById("payAmount").innerText = ADVANCE_AMOUNT;
    document.getElementById("paymentModal").classList.remove("hidden");
}

function confirmPayment() {
    if (!pendingPayment) return;

    const { stationIndex, pointId, slotIndex } = pendingPayment;

    const slot = stations[stationIndex]
        .chargingPoints.find(p => p.pointId === pointId)
        .slots[slotIndex];

    const date = bookingDate.value;

    // Safety check
    if (slot.bookings.includes(date)) {
        alert("Slot already booked");
        closePayment();
        return;
    }

    // Book slot
    slot.bookings.push(date);

    bookings.push({
        username: localStorage.getItem("loggedInUser"),
        stationName: stations[stationIndex].name,
        chargingPoint: pointId,
        date,
        timeSlot: slot.time,

        payment: {
            advanceAmount: ADVANCE_AMOUNT,
            paymentStatus: "PAID",
            paymentMethod: "UPI",
            transactionId: "TXN" + Date.now()
        },

        bookingStatus: "ACTIVE"
    });

    saveStations();
    saveBookings();

    closePayment();
    viewChargingPoints(stationIndex);
    renderMyBookings();

    alert("Payment successful! Slot booked.");
}


// ================================
// BOOK SLOT
// ================================
function bookSlotPoint(stationIndex, pointId, slotIndex) {
    const date = bookingDate.value;
    if (!date) {
        alert("Select booking date");
        return;
    }

    const slot = stations[stationIndex]
        .chargingPoints.find(p => p.pointId === pointId)
        .slots[slotIndex];

    if (slot.bookings.includes(date) || slot.blockedDates.includes(date)) {
        alert("Slot unavailable");
        return;
    }

    slot.bookings.push(date);

    bookings.push({
    id: Date.now() + Math.random(),
    username: localStorage.getItem("loggedInUser"),
    stationName: stations[stationIndex].name,
    chargingPoint: pointId,
    date,
    timeSlot: slot.time,
    bookingStatus: "ACTIVE",
    payment: {
        advanceAmount: 100,
        refundStatus: "PAID"
    }
});


    saveStations();
    saveBookings();
    viewChargingPoints(stationIndex);
    renderBookings();
}

// ================================
// ADMIN BOOKINGS VIEW
// ================================
function renderBookings() {
    if (!bookingTable) return;

    bookingTable.innerHTML =
        "<tr><th>Station</th><th>Point</th><th>Date</th><th>Time</th><th>Status</th></tr>";

    bookings.forEach(b => {
        bookingTable.insertRow().innerHTML = `
            <td>${b.stationName}</td>
            <td>${b.chargingPoint}</td>
            <td>${b.date}</td>
            <td>${b.timeSlot}</td>
            <td>${b.status}</td>`;
    });
}

// ================================
// ADMIN SLOT BLOCKING
// ================================
function populateAdminBlockUI() {
    if (!adminStationIndex) return;

    adminStationIndex.innerHTML = "<option value=''>Select Station</option>";
    adminPointId.innerHTML = "<option value=''>Select Point</option>";
    adminTimeSlot.innerHTML = "<option value=''>Select Time Slot</option>";
    adminDate.innerHTML = "<option value=''>Select Date</option>";

    stations.forEach((s, i) => {
        adminStationIndex.innerHTML += `<option value="${i}">${s.name}</option>`;
    });

    const todayIST = getISTDate();

for (let i = 0; i < 3; i++) {
    const d = new Date(todayIST);
    d.setDate(todayIST.getDate() + i);

    adminDate.innerHTML += `
        <option value="${getISTDateString(d)}">
            ${i === 0 ? "Today" : i === 1 ? "Tomorrow" : "Day After Tomorrow"}
        </option>
    `;
}

}

adminStationIndex?.addEventListener("change", () => {
    adminPointId.innerHTML = "<option value=''>Select Point</option>";
    adminTimeSlot.innerHTML = "<option value=''>Select Time Slot</option>";

    const station = stations[adminStationIndex.value];
    if (!station) return;

    station.chargingPoints.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.pointId;
        opt.textContent = "Point " + p.pointId;
        adminPointId.appendChild(opt);
    });
});

adminPointId?.addEventListener("change", () => {
    adminTimeSlot.innerHTML = "<option value=''>Select Time Slot</option>";
    const station = stations[adminStationIndex.value];
    if (!station) return;

    const point = station.chargingPoints.find(p => p.pointId == adminPointId.value);
    if (!point) return;

    point.slots.forEach(slot => {
        const opt = document.createElement("option");
        opt.value = slot.time;
        opt.textContent = slot.time;
        adminTimeSlot.appendChild(opt);
    });
});

function blockSlot() {
    const station = stations[adminStationIndex.value];
    if (!station) return alert("Select station");

    const point = station.chargingPoints.find(p => p.pointId == adminPointId.value);
    if (!point) return alert("Select point");

    const slot = point.slots.find(s => s.time == adminTimeSlot.value);
    if (!slot) return alert("Select time");

    if (!slot.blockedDates.includes(adminDate.value)) {
        slot.blockedDates.push(adminDate.value);
    }

    saveStations();
    alert("Slot blocked successfully");
}

// ================================
// USER DATE DROPDOWN
// ================================
function populateBookingDates() {
    if (!bookingDate) return;

    bookingDate.innerHTML = "<option value=''>-- Select Date --</option>";

    const todayIST = getISTDate();

    for (let i = 0; i < 3; i++) {
        const d = new Date(todayIST);
        d.setDate(todayIST.getDate() + i);

        const value = getISTDateString(d);

        const label =
            i === 0 ? "Today" :
            i === 1 ? "Tomorrow" :
            "Day After Tomorrow";

        bookingDate.innerHTML += `
            <option value="${value}">${label}</option>
        `;
    }
}


// ================================
// DISTANCE FORMULA
// ================================
function calculateDistance(a, b, c, d) {
    const R = 6371;
    const dLat = (c - a) * Math.PI / 180;
    const dLon = (d - b) * Math.PI / 180;
    const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(a * Math.PI / 180) *
        Math.cos(c * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ================================
// INITIAL LOAD
// ================================
document.addEventListener("DOMContentLoaded", () => {
    renderAdminStations();
    renderUserStations();
    renderBookings();
    populateBookingDates();
    populateAdminBlockUI();
    renderMyBookings();
renderBookingHistory();
confirmPayment();
startPayment();
closePaymentModal();
   // 🔥 THIS LINE
});


function toggleDarkMode() {
    document.body.classList.toggle("dark");
}
function openMap(lat, lng) {
    window.open(
        `https://www.google.com/maps?q=${lat},${lng}`,
        "_blank"
    );
}
function userLogin() {
    console.log("Login button clicked"); // 👈 ADD THIS

    const username = document.getElementById("loginUsername").value;
    const password = document.getElementById("loginPassword").value;

    fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        console.log(data);   // IMPORTANT
        if (data.message === "Login successful") {
            localStorage.setItem("loggedInUser", data.username);
            window.location.href = "dashboard.html";
        } else {
            alert(data.message);
        }
    })
    .catch(err => {
        console.error(err);
        alert("Backend not reachable");
    });
}

function registerUser() {
    const username = document.getElementById("regUsername").value;
    const password = document.getElementById("regPassword").value;

    fetch("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        console.log(data);   // IMPORTANT
        alert(data.message);
        if (data.message === "User registered successfully") {
            window.location.href = "index.html";
        }
    })
    .catch(err => {
        console.error(err);
        alert("Backend not reachable");
    });
}
// ================================
// THEME MANAGEMENT (GLOBAL)
// ================================
function toggleTheme() {
    document.documentElement.classList.add("theme-transition");

    document.documentElement.classList.toggle("dark");
    document.body.classList.toggle("dark");

    const theme = document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";

    localStorage.setItem("theme", theme);

    // Remove helper class after animation
    setTimeout(() => {
        document.documentElement.classList.remove("theme-transition");
    }, 400);
}

function renderMyBookings() {
    const table = document.getElementById("myBookingsTable");
    if (!table) return;

    const currentUser = localStorage.getItem("loggedInUser");

    table.innerHTML = `
        <tr>
            <th>Station</th>
            <th>Point</th>
            <th>Date</th>
            <th>Time</th>
            <th>Advance</th>
            <th>Action</th>
        </tr>
    `;

    bookings
        .filter(b =>
            b.username === currentUser &&
            b.bookingStatus === "ACTIVE"
        )
        .forEach((b, index) => {
            const canCancel = canCancelBooking(b);

            table.insertRow().innerHTML = `
                <td>${b.stationName}</td>
                <td>${b.chargingPoint}</td>
                <td>${b.date}</td>
                <td>${b.timeSlot}</td>
                <td>₹${b.payment.advanceAmount}</td>
                <td>
                    ${
                        canCancel
                            ? `<button class="btn" onclick="cancelBooking(${b.id})">Cancel</button>
`
                            : `<span style="color:red;">Locked</span>`
                    }
                </td>
            `;
        });
}

function renderBookingHistory() {
    const table = document.getElementById("bookingHistoryTable");
    if (!table) return;

    const currentUser = localStorage.getItem("loggedInUser");

    table.innerHTML = `
        <tr>
            <th>Station</th>
            <th>Date</th>
            <th>Time</th>
            <th>Status</th>
            <th>Refund</th>
        </tr>
    `;

    bookings
        .filter(b =>
            b.username === currentUser &&
            b.bookingStatus !== "ACTIVE"
        )
        .forEach(b => {
            table.insertRow().innerHTML = `
                <td>${b.stationName}</td>
                <td>${b.date}</td>
                <td>${b.timeSlot}</td>
                <td>${b.bookingStatus}</td>
                <td>${b.payment?.refundStatus || "N/A"}
</td>
            `;
        });
}



function canCancelBooking(booking) {
    const now = new Date();

    const [startTime] = booking.timeSlot.split(" - ");
    const [hours, minutes] = startTime.split(":").map(Number);

    const bookingDate = new Date(booking.date);
    bookingDate.setHours(hours, minutes, 0, 0);

    const diffMinutes = (bookingDate - now) / (1000 * 60);

    return diffMinutes >= 45;
}

function isPastBooking(booking) {
    const [startTime] = booking.timeSlot.split(" - ");
    const [hours, minutes] = startTime.split(":").map(Number);

    const bookingDateTime = new Date(booking.date);
    bookingDateTime.setHours(hours, minutes, 0, 0);

    return bookingDateTime < new Date();
}

function cancelBooking(bookingId) {
    console.log("Cancel clicked for ID:", bookingId);

    if (!bookingId) {
        alert("Invalid booking reference");
        return;
    }

    const booking = bookings.find(b => b.id === bookingId);

    if (!booking) {
        alert("Booking not found");
        return;
    }
if (!booking.payment) {
    booking.payment = {
        advanceAmount: 100,
        refundStatus: "PAID"
    };
}


    if (!canCancelBooking(booking)) {
        alert("Cancellation allowed only 45 minutes before the slot.");
        return;
    }

    // 1️⃣ Free the slot
    const station = stations.find(s => s.name === booking.stationName);
    if (!station) return;

    const point = station.chargingPoints.find(p => p.pointId === booking.chargingPoint);
    if (!point) return;

    const slot = point.slots.find(s => s.time === booking.timeSlot);
    if (!slot) return;

    slot.bookings = slot.bookings.filter(d => d !== booking.date);

    // 2️⃣ Update booking status (DO NOT DELETE)
    booking.bookingStatus = "CANCELLED";
    booking.payment.refundStatus = "REFUNDED";


    saveStations();
    saveBookings();

    // 3️⃣ Re-render UI
    renderMyBookings();
    renderBookingHistory();
    renderUserStations();

    alert("Booking cancelled and refund processed.");
}



function closePayment() {
    document.getElementById("paymentModal").classList.add("hidden");
    pendingPayment = null;
}


function startPayment(stationIndex, pointId, slotIndex) {
    const date = bookingDate.value;
    if (!date) {
        alert("Select booking date first");
        return;
    }
 selectedPayment = { stationIndex, pointId, slotIndex };
    pendingPayment = { stationIndex, pointId, slotIndex, date };

    const station = stations[stationIndex];
    const slot = station.chargingPoints
        .find(p => p.pointId === pointId)
        .slots[slotIndex];

    document.getElementById("paymentAmount").innerText = ADVANCE_AMOUNT;

    document.getElementById("paymentModal").classList.remove("hidden");
}

function closePaymentModal() {
    pendingPayment = null;
    document.getElementById("paymentModal").classList.add("hidden");
}

function confirmPayment() {
    if (!pendingPayment) return;

    const { stationIndex, pointId, slotIndex, date } = pendingPayment;

    const station = stations[stationIndex];
    const point = station.chargingPoints.find(p => p.pointId === pointId);
    const slot = point.slots[slotIndex];

    // Safety check
    if (slot.bookings.includes(date)) {
        alert("Slot already booked");
        closePaymentModal();
        return;
    }

    // Book slot
    slot.bookings.push(date);

    const booking = {
        id: Date.now() + Math.random(),
        username: localStorage.getItem("loggedInUser"),
        stationName: station.name,
        chargingPoint: pointId,
        date,
        timeSlot: slot.time,
        bookingStatus: "ACTIVE",
        payment: {
            gateway: "Razorpay",
            advanceAmount: 100,
            refundStatus: "PAID"
        }
    };

    bookings.push(booking);

    saveStations();
    saveBookings();

    closePaymentModal();
    viewChargingPoints(stationIndex);
    renderMyBookings();

    alert("Payment successful! Booking confirmed.");
}
