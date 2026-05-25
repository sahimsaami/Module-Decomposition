const BASE = "http://a13384i9tazulc92qxt50ssf.178.105.39.91.sslip.io";
const API = BASE + "/api/messages";
const WS = BASE.replace("http", "ws") + "/ws";

const list = document.getElementById("messages");
const usernameInput = document.getElementById("username");
const messageInput = document.getElementById("message");
const schedulePanel = document.getElementById("schedule-panel");
const scheduleTimeInput = document.getElementById("schedule-time");
const scheduledListEl = document.getElementById("scheduled-list");

const REACTIONS = ["👍", "👎", "❤️", "😂", "😮"];

// Load saved username on startup
const savedUser = localStorage.getItem("chat_username");
if (savedUser) {
  usernameInput.value = savedUser;
  usernameInput.disabled = true; // lock it until user clicks edit
}

// Save when user types & presses Enter or leaves the field
function saveUsername() {
  const name = usernameInput.value.trim();
  if (name) {
    localStorage.setItem("chat_username", name);
    usernameInput.disabled = true;
    show(`Welcome, ${name}!`);
  }
}

// Allow user to change name manually
function changeUser() {
  usernameInput.disabled = false;
  usernameInput.focus();
  usernameInput.select();
}

usernameInput.addEventListener("blur", saveUsername);

// ---------- SCHEDULED MESSAGES PERSISTENCE ----------
let scheduledMessages = JSON.parse(
  localStorage.getItem("scheduled_messages") || "[]",
);

function saveScheduled() {
  localStorage.setItem("scheduled_messages", JSON.stringify(scheduledMessages));
}

function renderScheduled() {
  scheduledListEl.innerHTML = "";
  const now = Date.now();
  // Remove already-sent ones
  scheduledMessages = scheduledMessages.filter(
    (m) => m.sendAt > now || m.pending,
  );

  scheduledMessages.forEach((m, idx) => {
    const div = document.createElement("div");
    div.className = "scheduled-item";
    const date = new Date(m.sendAt);
    const timeStr = date.toLocaleString();
    div.innerHTML = `
      <span>⏰ <b>${escapeHtml(m.text)}</b> → ${timeStr}</span>
      <button onclick="cancelScheduledMessage(${idx})">❌</button>
    `;
    scheduledListEl.appendChild(div);
  });
}

function cancelScheduledMessage(idx) {
  scheduledMessages.splice(idx, 1);
  saveScheduled();
  renderScheduled();
  show("Scheduled message cancelled");
}

// Check every second if any scheduled message should be sent
setInterval(() => {
  const now = Date.now();
  scheduledMessages.forEach((m) => {
    if (!m.pending && m.sendAt <= now) {
      m.pending = true;
      sendScheduled(m);
    }
  });
}, 1000);

async function sendScheduled(m) {
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: m.text, author: m.author }),
    });
    if (res.ok) {
      scheduledMessages = scheduledMessages.filter((x) => x !== m);
      saveScheduled();
      renderScheduled();
      show("⏰ Scheduled message sent!");
    } else {
      m.pending = false; // retry next cycle
    }
  } catch {
    m.pending = false;
  }
}

// ---------- SCHEDULE PANEL ----------
function toggleSchedule() {
  schedulePanel.classList.toggle("hidden");
  if (!schedulePanel.classList.contains("hidden")) {
    // Default value: 1 minute from now
    const d = new Date(Date.now() + 60000);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    scheduleTimeInput.value = local;
  }
}

function cancelSchedule() {
  schedulePanel.classList.add("hidden");
  scheduleTimeInput.value = "";
}

// ---------- HELPERS ----------
function getColorFromName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#f47fff",
    "#7289da",
    "#3ba55d",
    "#faa61a",
    "#ed4245",
    "#00b0f4",
    "#eb459e",
  ];
  return colors[Math.abs(hash) % colors.length];
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours.toString().padStart(2, "0")}:${minutes} ${ampm}`;
}

function currentUser() {
  return usernameInput.value.trim();
}

function isMine(msg) {
  const me = currentUser();
  return me && msg.author === me;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- LOAD MESSAGES ----------
async function loadMessages() {
  const res = await fetch(API);
  const data = await res.json();
  data.forEach(addMessage);
}

function addMessage(msg) {
  const color = getColorFromName(msg.author);
  const mine = isMine(msg);

  const li = document.createElement("li");
  li.id = `msg-${msg.id}`;
  li.className = mine ? "me" : "other";

  li.innerHTML = `
    <div class="msg-header">
      <span class="msg-author" style="color:${color}">${escapeHtml(msg.author)}</span>
      <span class="msg-time">${formatTime(msg.timestamp)}</span>
    </div>
    <div class="msg-text">${escapeHtml(msg.text)}</div>
    <div class="reactions-display"></div>
    <button class="reaction-trigger" onclick="togglePicker(event, '${msg.id}')">😊</button>
  `;

  list.appendChild(li);
  renderReactions(msg.id, msg.reactions || {});
  list.scrollTop = list.scrollHeight;
}

function togglePicker(event, msgId) {
  event.stopPropagation();
  document.querySelectorAll(".reaction-picker").forEach((p) => p.remove());

  const li = document.getElementById(`msg-${msgId}`);
  const trigger = li.querySelector(".reaction-trigger");

  const picker = document.createElement("div");
  picker.className = "reaction-picker";
  picker.innerHTML = REACTIONS.map(
    (e) =>
      `<button onclick="pickReaction(event, '${msgId}', '${e}')">${e}</button>`,
  ).join("");

  trigger.parentElement.style.position = "relative";
  trigger.insertAdjacentElement("beforebegin", picker);
}

async function pickReaction(event, msgId, emoji) {
  event.stopPropagation();
  document.querySelectorAll(".reaction-picker").forEach((p) => p.remove());

  const user = currentUser();
  if (!user) {
    show("Please enter your name first");
    return;
  }

  try {
    await fetch(`${API}/${msgId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji, user }),
    });
  } catch {
    show("Could not react");
  }
}

document.addEventListener("click", () => {
  document.querySelectorAll(".reaction-picker").forEach((p) => p.remove());
});

function renderReactions(msgId, reactions) {
  const li = document.getElementById(`msg-${msgId}`);
  if (!li) return;
  const container = li.querySelector(".reactions-display");
  const me = currentUser();

  container.innerHTML = "";
  for (const [emoji, users] of Object.entries(reactions)) {
    if (!users.length) continue;
    const badge = document.createElement("div");
    badge.className =
      "reaction-badge" + (me && users.includes(me) ? " mine" : "");
    badge.innerHTML = `${emoji} <span>${users.length}</span>`;
    badge.onclick = () =>
      pickReaction({ stopPropagation: () => {} }, msgId, emoji);
    container.appendChild(badge);
  }
}

function updateReaction(data) {
  renderReactions(data.id, data.reactions || {});
}

// ---------- SEND ----------
async function send() {
  const text = messageInput.value;
  const author = currentUser();

  if (!author) {
    show("Please enter your name");
    return;
  }
  if (!text.trim()) {
    show("Message empty");
    return;
  }

  // Save username if not saved yet
  if (!localStorage.getItem("chat_username")) {
    saveUsername();
  }

  // ----- If schedule panel is open, schedule instead of sending now -----
  if (!schedulePanel.classList.contains("hidden") && scheduleTimeInput.value) {
    const sendAt = new Date(scheduleTimeInput.value).getTime();
    if (sendAt <= Date.now()) {
      show("Schedule time must be in the future");
      return;
    }
    scheduledMessages.push({
      text: text.trim(),
      author,
      sendAt,
      pending: false,
    });
    saveScheduled();
    renderScheduled();
    messageInput.value = "";
    cancelSchedule();
    show(`✅ Message scheduled for ${new Date(sendAt).toLocaleString()}`);
    return;
  }

  // ----- Normal send -----
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, author }),
    });

    const data = await res.json();
    if (!res.ok) {
      show("Error: " + data.error);
      return;
    }

    messageInput.value = "";
    show("Sent");
  } catch {
    show("Server error");
  }
}

function show(msg) {
  document.getElementById("status").textContent = msg;
}

// ---------- WEBSOCKET ----------
const socket = new WebSocket(WS);
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "reaction") updateReaction(data);
  else if (data.type === "info") console.log(data.message);
  else addMessage(data);
};

async function clearMessages() {
  await fetch(API, { method: "DELETE" });
  list.innerHTML = "";
  show("Chat cleared");
}

// ---------- INIT ----------
loadMessages();
renderScheduled();

usernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    saveUsername();
    messageInput.focus();
  }
});

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    send();
  }
});
