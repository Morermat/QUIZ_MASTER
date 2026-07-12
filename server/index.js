require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { allowedOrigins } = require("./config");
const { loadUsers } = require('./store');
(async () => {
  try {
    await loadUsers();
  } catch (err) {
    console.error('Failed to load users from DB:', err.message);
  }
})();

const authRoutes = require("./routes/auth");
const quizRoutes = require("./routes/quizzes");
const profileRoutes = require("./routes/profile");

const setupSocket = require("./socket");

const app = express();

app.disable("x-powered-by");

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

app.use(express.json({
    limit: "5mb"
}));

app.use(express.urlencoded({
    extended: true
}));

app.get("/", (_, res) => {
    res.json({
        name: "Quiz Master API",
        version: "2.0.0",
        status: "online",
        uptime: process.uptime()
    });
});

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use("/auth", authRoutes);
app.use("/quizzes", quizRoutes);
app.use("/profile", profileRoutes);

app.use((req, res) => {
    res.status(404).json({
        error: "Route not found"
    });
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({
        error: "Internal server error"
    });
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true
    },
    pingInterval: 10000,
    pingTimeout: 5000,
    transports: [
        "websocket",
        "polling"
    ]
});

setupSocket(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log("");
    console.log("======================================");
    console.log(" Quiz Master Server");
    console.log("======================================");
    console.log("PORT:", PORT);
    console.log("MODE:", process.env.NODE_ENV || "development");
    console.log("======================================");
    console.log("");
});