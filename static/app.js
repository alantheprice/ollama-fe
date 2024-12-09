const getDB = async () => {
    let _db = null;

    const _getDB = async () => {
        if (_db) {
            return _db;
        }
        _db = await new Yexed('chats', 1, [
            {
                name: 'sessions',
                options: { keyPath: 'id', autoIncrement: true },
                indexes: [
                    { name: 'title', keyPath: 'title', options: { unique: false } },
                    { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } }
                ]
            },
            {
                name: 'messages',
                options: { keyPath: 'id', autoIncrement: true },
                indexes: [
                    { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } },
                    { name: 'session', keyPath: 'session', options: { unique: false } },
                    { name: 'sender', keyPath: 'sender', options: { unique: false } }
                ]
            }
        ]);
        return _db;
    };

    return await _getDB();
};


const onload = () => {
    const { div, option, button } = fmk.elements;

    const chatBox = fmk.qs("#chat-box");
    const userInput = fmk.qs("#user-input");
    const sendButton = fmk.qs("#send-button");
    const toggleButton = fmk.qs("#toggle-mode");
    const modelSelect = fmk.qs("#model-select");
    const highlightTheme = fmk.qs("#highlight-theme");
    let currentSession = null;
    
    const saveMessage = async (message, sender) => {
        const chat = {message, sender, session: null, timestamp: Date.now()};
        const db = await getDB();
        if (currentSession) {
            chat.session = currentSession;
        } else {
            const title = message.length > 20 ? message.substring(0, 20) : message;
            chat.session = await db.addData('sessions',  {'title': title, 'timestamp': Date.now()});
            currentSession = chat.session;
        }
        await db.addData('messages', chat);
    }

    toggleButton.addEventListener("click", () => {
        document.body.classList.toggle("light-mode");
        document.body.classList.toggle("dark-mode");
        saveThemePreference();
        updateHighlightTheme();
    });

    const md = window.markdownit();

    const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`);
    const placeholderMessage = "Processing your request...";

    let accumulatedMessage = "";
    let requestSentTime = Date.now();
    let selectedUserMessageIndex = -1;
    let userMessages = [];
    let Disconnected = true;

    socket.onopen = () => {
        appendMessage("System", "Connected to the server.");
        Disconnected = false;
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
        Disconnected = true;
    };


    userInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && userInput.value && !event.shiftKey) {
            event.preventDefault(); // Prevent newline in textarea
            submitMessage();
        } else if (event.key === "ArrowUp" && (!userInput.value || userMessages.includes(userInput.value))) {
            // Retrieve the last user message when the up arrow key is pressed and the input is empty
            if (userMessages.length > 0) {
                if (selectedUserMessageIndex === -1) {
                    selectedUserMessageIndex = userMessages.length - 1;
                } else if (selectedUserMessageIndex > 0) {
                    selectedUserMessageIndex--;
                }
                userInput.value = userMessages[selectedUserMessageIndex];
            }
        } else if (event.key === "ArrowDown" && (!userInput.value || userMessages.includes(userInput.value))) {
            // Retrieve the next user message when the down arrow key is pressed and the input is empty
            if (userMessages.length > 0 && selectedUserMessageIndex !== -1) {
                if (selectedUserMessageIndex < userMessages.length - 1) {
                    selectedUserMessageIndex++;
                    userInput.value = userMessages[selectedUserMessageIndex];
                } else {
                    userInput.value = "";
                    selectedUserMessageIndex = -1;
                }
            }
        }
    });

    sendButton.addEventListener("click", submitMessage);

    initialize();

    async function fetchModels() {
        const response = await fetch('/models');
        const data = await response.json();
        return data.models;
    }

    async function initialize() {
        loadUserMessages();
        const models = await fetchModels();

        const modelSelect = fmk.qs("#model-select")

        models.forEach(model => {
            option({
                value: model.model,
                textContent: model.model
            })(modelSelect);
        });
    }

    function submitMessage() {
        if (Disconnected) {
            appendMessage("System", "Disconnected from the server. Please refresh the page to reconnect.");
            return;
        }
        const message = userInput.value;
        const model = modelSelect.value; // Get the selected model
        const data = JSON.stringify({ model: model, prompt: message });

        appendMessage("You", message);
        socket.send(data);
        userInput.value = "";
        requestSentTime = Date.now();
        saveUserMessage(message);
        // Add a placeholder message from the bot
        appendMessage("Bot", placeholderMessage);
    }

    function saveUserMessage(message) {
        userMessages.push(message);
        localStorage.setItem("userMessages", JSON.stringify(userMessages));
    }

    function loadUserMessages() {
        const userMessagesString = localStorage.getItem("userMessages");
        if (userMessagesString) {
            userMessages = JSON.parse(userMessagesString);
        }
    }

    function appendMessage(sender, message) {
        return div({
            className: `message ${sender.toLowerCase()}`,
            onAttach: (ref) => {
                ref.current.innerHTML = md.render(message);
                ref.current.querySelectorAll("pre code").forEach((block) => {
                    hljs.highlightElement(block);
                });
                chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to the latest message
            }

        })(chatBox);
    }

    function appendPartialMessage(sender, message) {
        let lastMessageElement = chatBox.querySelector(".message.bot:last-child");
        if (accumulatedMessage === placeholderMessage) {
            accumulatedMessage = ""; // Clear the placeholder message
        }

        if (!lastMessageElement || lastMessageElement.classList.contains("you")) {
            lastMessageElement = div({
                className: `message ${sender.toLowerCase()}`,
            })(chatBox).current;
        }

        // Accumulate the partial message content
        accumulatedMessage += message;

        // Render the accumulated content using markdown-it
        lastMessageElement.innerHTML = md.render(accumulatedMessage);

        chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to the latest message
    }

    function finalizeMessage() {
        console.log("finalizing Message")
        console.log("Time taken to complete message in seconds:", (Date.now() - requestSentTime) / 1000);
        let lastMessageElement = chatBox.querySelector(".message.bot:last-child");
        if (lastMessageElement) {
            // Parse the entire accumulated message
            lastMessageElement.innerHTML = md.render(accumulatedMessage);
            lastMessageElement.querySelectorAll("pre code").forEach((block) => {
                hljs.highlightElement(block);
            });
        }
        // TODO: Before we reset, save the message to the user's chat history
        accumulatedMessage = ""; // Reset for next message
    }


    function saveThemePreference() {
        const theme = document.body.classList.contains("light-mode") ? "light" : "dark";
        localStorage.setItem("theme", theme);
    }

    function loadThemePreference() {
        const theme = localStorage.getItem("theme");
        if (theme) {
            document.body.classList.add(theme === "light" ? "light-mode" : "dark-mode");
            updateHighlightTheme();
        } else {
            // Set initial mode based on user preference or default to dark mode
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                document.body.classList.add("light-mode");
            } else {
                document.body.classList.add("dark-mode");
            }
            updateHighlightTheme();
        }
    }

    function updateHighlightTheme() {
        if (document.body.classList.contains("light-mode")) {
            highlightTheme.href = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github.min.css";
        } else {
            highlightTheme.href = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css";
        }
    }

    // Load theme preference on page load
    loadThemePreference();
};

document.addEventListener("DOMContentLoaded", onload);
