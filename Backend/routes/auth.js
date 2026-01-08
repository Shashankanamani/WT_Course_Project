const express = require("express");
const fs = require("fs");
const router = express.Router();

const path = require("path");
const DB_PATH = path.join(__dirname, "../db/database.json");


// Helper: read DB
function readDB() {
    return JSON.parse(fs.readFileSync(DB_PATH));
}

// Helper: write DB
function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ================================
// USER REGISTER
// ================================
router.post("/register", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "All fields required" });
    }

    const db = readDB();

    const exists = db.users.find(u => u.username === username);
    if (exists) {
        return res.status(409).json({ message: "User already exists" });
    }

    db.users.push({ username, password });
    writeDB(db);

    res.json({ message: "User registered successfully" });
});

// ================================
// USER LOGIN
// ================================
router.post("/login", (req, res) => {
    const { username, password } = req.body;
    const db = readDB();

    const user = db.users.find(
        u => u.username === username && u.password === password
    );

    if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({ message: "Login successful", username });
});

// ================================
// ADMIN LOGIN
// ================================
router.post("/admin-login", (req, res) => {
    const { username, password } = req.body;
    const db = readDB();

    const admin = db.admins.find(
        a => a.username === username && a.password === password
    );

    if (!admin) {
        return res.status(401).json({ message: "Invalid admin credentials" });
    }

    res.json({ message: "Admin login successful" });
});

module.exports = router;
