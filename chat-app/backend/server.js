const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");

const app = express();

// MIDDLEWARE 
app.use(cors());
app.use(express.json());

// DATA 
let messages = [];

// GET ALL MESSAGES
app.get("/api/messages", (req, res) => {
  res.json(messages);
});

// SEND MESSAGE 
app.post("/api/messages", (req, res) => {
  const { text, author } = req.body;

  // ✅ validation: username
  if (!author || typeof author !== "string" || !author.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }

  // ✅ validation: message
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  const newMessage = {
    id: crypto.randomUUID(),
    text: text.trim(),
    author: author.trim(),
    timestamp: Date.now()
  };

  messages.push(newMessage);

  // ✅ send to all users
  broadcast(newMessage);

  res.status(201).json(newMessage);
});

// SERVER
const server = app.listen(3000, () => {
  console.log("✅ Server running on http://localhost:3000");
});

// WEBSOCKET    
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("🔌 New client connected");

  ws.send(JSON.stringify({ type: "info", message: "Connected to server" }));
});

// BROADCAST FUNCTION
function broadcast(message) {
  const data = JSON.stringify(message);

  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}
