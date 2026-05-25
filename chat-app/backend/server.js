const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] ${req.method} ${req.url}`);
  next();
});

// Rate limiter middleware (prevent spam)
const userLastMessage = {};
function rateLimiter(req, res, next) {
  if (req.method === "POST" && req.body.author) {
    const now = Date.now();
    const last = userLastMessage[req.body.author] || 0;
    if (now - last < 500) {
      return res.status(429).json({ error: "Too fast! Wait a moment" });
    }
    userLastMessage[req.body.author] = now;
  }
  next();
}

// Data store
let messages = [];

// Health check
app.get("/", (req, res) => res.send("Chat backend is running"));

// Get all messages
app.get("/api/messages", (req, res) => res.json(messages));

// Send a new message
app.post("/api/messages", rateLimiter, (req, res) => {
  const { text, author } = req.body;

  if (!author || typeof author !== "string" || !author.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  const newMessage = {
    id: crypto.randomUUID(),
    text: text.trim(),
    author: author.trim(),
    timestamp: Date.now(),
    reactions: {}, // { "👍": ["alice", "bob"], "❤️": ["alice"] }
  };

  messages.push(newMessage);
  broadcast(newMessage);
  res.status(201).json(newMessage);
});

// React to a message (one reaction per user)
app.post("/api/messages/:id/react", (req, res) => {
  const { id } = req.params;
  const { emoji, user } = req.body;

  if (!user || !user.trim()) {
    return res.status(400).json({ error: "User name required" });
  }
  if (!emoji) {
    return res.status(400).json({ error: "Emoji required" });
  }

  const message = messages.find((m) => m.id === id);
  if (!message) return res.status(404).json({ error: "Message not found" });

  if (!message.reactions) message.reactions = {};

  const username = user.trim();

  // Remove user from all other reactions first (one reaction per user)
  for (const key of Object.keys(message.reactions)) {
    message.reactions[key] = message.reactions[key].filter(
      (u) => u !== username,
    );
    if (message.reactions[key].length === 0) {
      delete message.reactions[key];
    }
  }

  // Toggle: if clicked same one, remove; else add new
  if (!message.reactions[emoji]) {
    message.reactions[emoji] = [username];
  } else if (!message.reactions[emoji].includes(username)) {
    message.reactions[emoji].push(username);
  }
  // If user already had this reaction, it was removed above (toggle off)

  broadcast({
    type: "reaction",
    id: message.id,
    reactions: message.reactions,
  });

  res.json(message);
});

// Clear all messages
app.delete("/api/messages", (req, res) => {
  messages = [];
  res.json({ message: "All messages deleted" });
});

// Start server
const server = app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

// WebSocket
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("New client connected");
  ws.send(JSON.stringify({ type: "info", message: "Connected to server" }));
});

// Broadcast helper
function broadcast(message) {
  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data);
  }
}
