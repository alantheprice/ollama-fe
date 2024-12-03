const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const md = window.markdownit();

const socket = new WebSocket("ws://localhost:8000/ws");

let accumulatedMessage = "";
let placeholderMessageElement = null;

socket.onopen = () => {
    appendMessage("System", "Connected to the server.");
};

socket.onmessage = (event) => {
    if (event.data === "[END_OF_MESSAGE]") {
        // Message is complete
        finalizeMessage();
    } else {
        appendPartialMessage("Bot", event.data);
    }
};

socket.onclose = () => {
    appendMessage("System", "Disconnected from the server.");
};

userInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && userInput.value && !event.shiftKey) {
        event.preventDefault(); // Prevent newline in textarea
        sendButton.click();
    }
});

sendButton.addEventListener("click", () => {
    const message = userInput.value;
    appendMessage("You", message);
    socket.send(message);
    userInput.value = "";

    // Add a placeholder message from the bot
    placeholderMessageElement = appendMessage("Bot", "Processing your request...");
});

function appendMessage(sender, message) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", sender.toLowerCase());

    // Render Markdown for all messages
    messageElement.innerHTML = md.render(message);
    messageElement.querySelectorAll("pre code").forEach((block) => {
        hljs.highlightElement(block);
    });

    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to the latest message

    return messageElement;
}

let firstMessageTime = Date.now();

function appendPartialMessage(sender, message) {
    let lastMessageElement = chatBox.querySelector(".message.bot:last-child");

    if (placeholderMessageElement) {
        // Remove the placeholder message
        placeholderMessageElement.remove();
        placeholderMessageElement = null;
    }

    if (!lastMessageElement || lastMessageElement.classList.contains("you")) {
        lastMessageElement = document.createElement("div");
        lastMessageElement.classList.add("message", sender.toLowerCase());
        chatBox.appendChild(lastMessageElement);
        accumulatedMessage = ""; // Reset accumulated message
    }

    // Accumulate the partial message content
    accumulatedMessage += message;

    // Render the accumulated content using markdown-it
    lastMessageElement.innerHTML = md.render(accumulatedMessage);

    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to the latest message
}

function finalizeMessage() {
    console.log("finalizing Message")
    console.log("Time taken to complete message in seconds:", (Date.now() - firstMessageTime) / 1000);
    let lastMessageElement = chatBox.querySelector(".message.bot:last-child");
    if (lastMessageElement) {
        // Parse the entire accumulated message
        lastMessageElement.innerHTML = marked.parse(accumulatedMessage);
        hljs.highlightAll();
    }
    accumulatedMessage = ""; // Reset for next message
    lastParsedIndex = 0;
}