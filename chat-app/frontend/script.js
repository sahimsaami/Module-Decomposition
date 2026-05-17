const API = "http://zqmukdlt7gt071q4ssw7jzxb.178.105.39.91.sslip.io/api/messages";
const WS = "ws://zqmukdlt7gt071q4ssw7jzxb.178.105.39.91.sslip.io";

const list = document.getElementById("messages");

// generate color from name
function getColorFromName(name) {
  let hash = 0;

  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 30) - hash);
  }

  return `hsl(${hash % 360}, 80%, 70%)`;
}

// load initial messages
async function loadMessages() {
  const res = await fetch(API);
  const data = await res.json();

  data.forEach(addMessage);
}

// add message to list
function addMessage(msg) {
  const color = getColorFromName(msg.author);

  const li = document.createElement("li");

  li.innerHTML = `
    <strong style="color:${color}">
      ${msg.author}
    </strong>: ${msg.text}
  `;

  list.appendChild(li);

  // scroll auto
  list.scrollTop = list.scrollHeight;
}

// Send massage
async function send() {
  const text = document.getElementById("message").value;
  const author = document.getElementById("username").value;

  if (!author || !author.trim()) {
    show("❌ Please enter your name");
    return;
  }
  if (!text.trim()) {
    show("❌ Message empty");
    return;
  }

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, author }),
    });

    const data = await res.json();

    if (!res.ok) {
      show("❌ " + data.error);
      return;
    }

    document.getElementById("message").value = "";
    show("✅ Sent");
  } catch {
    show("❌ Server error");
  }
}

// status
function show(msg) {
  document.getElementById("status").textContent = msg;
}

// WebSocket
const socket = new WebSocket(WS);

socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  addMessage(msg);
};

//init
loadMessages();

const usernameInput = document.getElementById("username");
const messageInput = document.getElementById("message");

// Enter to focus message input
usernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    messageInput.focus();
  }
});

// Enter to send message
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    send();
  }
});
