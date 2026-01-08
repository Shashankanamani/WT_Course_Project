const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

// Test route
app.get("/", (req, res) => {
    res.send("EV Charging Backend is running 🚗⚡");
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
const path = require("path");

app.use(express.static(path.join(__dirname, "../frontend")));
