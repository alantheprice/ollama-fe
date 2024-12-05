(function(){const buildUtils=(document)=>{const virtualProps=["onAttach","onUpdate"];const isObj=(val)=>typeof val=="object"&&val!==null;const isFunc=(val)=>typeof val=="function";const handleChildren=(children,element,childElements)=>{children.forEach((child)=>{typeof child=="string"?element.appendChild(document.createTextNode(child)):isFunc(child)&&childElements.push(child(element))})};const attributeList="textContent|innerText|innerHTML|className|value|style|checked|selected|src|srcdoc|srcset|tabindex|target".split("|").reduce((result,attribute)=>(result[attribute]=1,result),{});const createElement=(namespace)=>(elementName)=>(attributes,children)=>{const eventListeners=[];let ref={};const element=document.createElementNS(namespace,elementName);const childElements=[];const update=(data)=>{if(attributes.onUpdate&&attributes.onUpdate(data,ref)===!1)return;childElements.forEach((child)=>{isFunc(child.update)&&child.update(data)})};const remove=()=>{eventListeners.forEach((remover)=>remover());element.remove();childElements.forEach((child)=>child.remove())};const setChildren=(newChildren)=>{childElements.forEach((child)=>child.remove());handleChildren(newChildren,element,childElements)};ref={current:element,update,setChildren,remove};Object.entries(attributes||{}).forEach((entry)=>{const[attributeName,attributeValue]=entry;if(attributeName=="style"&&isObj(attributeValue))Object.entries(attributeValue).forEach(([styleName,styleValue])=>{element.style[styleName]=styleValue});else if(!virtualProps.includes(attributeName)){if(attributeName=="ref"&&isObj(attributeValue))Object.assign(attributeValue,ref);else if(attributeName.indexOf("on")===0){const eventName=attributeName.slice(2).toLowerCase();element.addEventListener(eventName,attributeValue);eventListeners.push(()=>element.removeEventListener(eventName,attributeValue))}else attributeList[attributeName]||typeof attributeValue=="boolean"?element[attributeName]=attributeValue:element.setAttribute(attributeName,attributeValue)}});return(parent)=>{const parentNode=parent||document.body;parentNode.appendChild(element);children&&handleChildren(children,element,childElements);attributes.onAttach&&attributes.onAttach(ref);return ref}};return{create:createElement("http://www.w3.org/1999/xhtml"),createSvg:createElement("http://www.w3.org/2000/svg"),qs:(selector)=>document.querySelector(selector),qsAll:(selector)=>Array.from(document.querySelectorAll(selector))}};const utils=buildUtils(document);const elements="a|abbr|address|area|article|aside|audio|b|base|bdi|bdo|blockquote|body|br|button|canvas|caption|cite|code|col|colgroup|data|datalist|dd|del|details|dfn|div|dl|dt|em|embed|fieldset|figcaption|figure|footer|form|h1|h2|h3|h4|h5|h6|head|header|hr|html|i|iframe|img|input|ins|kbd|label|legend|li|link|main|map|mark|meta|meter|nav|noscript|object|ol|optgroup|option|output|p|param|picture|pre|progress|q|ruby|rt|ruby|s|samp|script|section|select|small|source|span|strong|style|sub|summary|sup|table|tbody|td|template|textarea|tfoot|th|thead|time|title|tr|track|u|ul|var|video|wbr".split("|").reduce((agg,next)=>(agg[next]=utils.create(next),agg),{});const svgElements="svg|path|rect".split("|").reduce((agg,next)=>(agg[next]=utils.createSvg(next),agg),{});window.fmk={...utils,elements,svgElements}})();


const onload = () => {

    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendButton = document.getElementById("send-button");
    const toggleButton = document.getElementById("toggle-mode");
    const modelSelect = document.getElementById("model-select");
    const highlightTheme = document.getElementById("highlight-theme");

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
    let firstMessageTime = Date.now();
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
        const modelSelect = document.getElementById("model-select");
        models.forEach(model => {
            const option = document.createElement("option");
            console.log(model)
            option.value = model.model;
            option.textContent = model.model;
            modelSelect.appendChild(option);
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

    function appendPartialMessage(sender, message) {
        let lastMessageElement = chatBox.querySelector(".message.bot:last-child");
        if (accumulatedMessage === placeholderMessage) {
            accumulatedMessage = ""; // Clear the placeholder message
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
            lastMessageElement.innerHTML = md.render(accumulatedMessage);
            lastMessageElement.querySelectorAll("pre code").forEach((block) => {
                hljs.highlightElement(block);
            });
        }
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
