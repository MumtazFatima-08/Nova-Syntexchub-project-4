(() => {
  "use strict";

  const API_URL = "/api/chat";
  const HISTORY_KEY = "nova-history";
  const SETTINGS_KEY = "nova-settings";

  const chatArea = document.getElementById("chatArea");
  const greetingScreen = document.getElementById("greetingScreen");
  const messagesEl = document.getElementById("messages");
  const textInput = document.getElementById("textInput");
  const sendBtn = document.getElementById("sendBtn");
  const micBtn = document.getElementById("micBtn");
  const statusPill = document.getElementById("statusPill");
  const statusText = document.getElementById("statusText");
  const statusDot = statusPill.querySelector(".status-dot");
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const newChatBtn = document.getElementById("newChatBtn");
  const historyList = document.getElementById("historyList");
  const suggestionCards = document.querySelectorAll(".suggestion-card");
  const settingsModal = document.getElementById("settingsModal");
  const aboutModal = document.getElementById("aboutModal");
  const speechRateInput = document.getElementById("speechRate");
  const speechRateValue = document.getElementById("speechRateValue");
  const voiceToggle = document.getElementById("voiceToggle");
  const themeToggle = document.getElementById("themeToggle");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");

  const synth = window.speechSynthesis;
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

  const defaultSettings = {
    speechRate: 1,
    voiceEnabled: true,
    darkTheme: true,
  };

  let settings = loadSettings();
  let history = [];
  let activeConversation = null;
  let isListening = false;
  let recognizer = null;
  let isProcessing = false;

  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
      return { ...defaultSettings, ...(stored || {}) };
    } catch (error) {
      return { ...defaultSettings };
    }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    applyTheme();
  }

  function applyTheme() {
    document.body.dataset.theme = settings.darkTheme ? "dark" : "light";
  }

  function loadHistory() {
    try {
      history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch (error) {
      history = [];
    }
  }

  function saveHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
  }

  function createConversation() {
    return {
      id: `conv-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: "New chat",
      messages: [],
    };
  }

  function updateConversationTitle() {
    if (!activeConversation || !activeConversation.messages.length) {
      activeConversation.title = "New chat";
      return;
    }

    const firstUserMessage = activeConversation.messages.find((item) => item.role === "user");
    const title = firstUserMessage ? firstUserMessage.text : "New chat";
    activeConversation.title = title.length > 34 ? `${title.slice(0, 34)}…` : title;
  }

  function persistConversation() {
    if (!activeConversation) return;
    updateConversationTitle();
    const existing = history.findIndex((item) => item.id === activeConversation.id);

    if (existing >= 0) {
      history[existing] = { ...history[existing], title: activeConversation.title, messages: activeConversation.messages };
    } else {
      history.unshift({ id: activeConversation.id, title: activeConversation.title, messages: activeConversation.messages });
    }

    history = history.slice(0, 20);
    saveHistory();
  }

  function renderHistory() {
    historyList.innerHTML = "";

    if (!history.length) {
      const placeholder = document.createElement("div");
      placeholder.className = "history-item";
      placeholder.textContent = "No saved chats yet";
      historyList.appendChild(placeholder);
      return;
    }

    history.forEach((conversation) => {
      const item = document.createElement("button");
      item.className = "history-item";
      item.textContent = conversation.title;
      item.type = "button";
      if (activeConversation && conversation.id === activeConversation.id) {
        item.classList.add("active");
      }
      item.addEventListener("click", () => {
        const restored = history.find((entry) => entry.id === conversation.id);
        if (restored) {
          activeConversation = { ...restored, messages: [...restored.messages] };
          renderConversation();
          renderHistory();
          closeModal();
        }
      });
      historyList.appendChild(item);
    });
  }

  function revealChatMode() {
    greetingScreen.classList.add("hidden");
  }

  function showGreeting() {
    greetingScreen.classList.remove("hidden");
  }

  function scrollToBottom() {
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function addMessageToUI(role, text, timestamp) {
    const wrapper = document.createElement("div");
    wrapper.className = `msg ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.textContent = role === "user" ? "You" : "✦";

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.textContent = text;

    const meta = document.createElement("div");
    meta.className = "msg-meta";
    meta.textContent = new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    const content = document.createElement("div");
    content.appendChild(bubble);
    content.appendChild(meta);

    wrapper.appendChild(avatar);
    wrapper.appendChild(content);
    messagesEl.appendChild(wrapper);
    scrollToBottom();
  }

  function renderConversation() {
    messagesEl.innerHTML = "";
    if (!activeConversation || !activeConversation.messages.length) {
      showGreeting();
      return;
    }
    revealChatMode();
    activeConversation.messages.forEach((message) => {
      addMessageToUI(message.role, message.text, message.timestamp);
    });
  }

  function addTypingIndicator() {
    const wrapper = document.createElement("div");
    wrapper.className = "msg nova";
    wrapper.id = "typingIndicator";

    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.textContent = "✦";

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble typing";
    bubble.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';

    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    messagesEl.appendChild(wrapper);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    const indicator = document.getElementById("typingIndicator");
    if (indicator) {
      indicator.remove();
    }
  }

  function setStatus(state) {
    const map = {
      ready: "Ready",
      listening: "Listening…",
      thinking: "Thinking…",
      speaking: "Speaking…",
    };
    statusText.textContent = map[state] || "Ready";
    statusDot.classList.toggle("listening", state === "listening");
  }

  function speak(text) {
    if (!settings.voiceEnabled || !synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = Number(settings.speechRate || 1);
    utterance.pitch = 1;
    utterance.onstart = () => setStatus("speaking");
    utterance.onend = () => setStatus("ready");
    utterance.onerror = () => setStatus("ready");
    synth.speak(utterance);
  }

  function openAction(action, url, query) {
    if (!action) return;

    if (action === "search" && query) {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      window.open(searchUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const urlMap = {
      google: "https://www.google.com",
      youtube: "https://www.youtube.com",
      github: "https://github.com",
      linkedin: "https://www.linkedin.com",
      gmail: "https://mail.google.com",
    };

    if (action in urlMap) {
      window.open(urlMap[action], "_blank", "noopener,noreferrer");
      return;
    }

    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  async function sendToBackend(message) {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.reply || `Server error (${response.status})`);
    }

    return response.json();
  }

  async function handleUserMessage(text) {
    const trimmed = (text || "").trim();
    if (!trimmed || isProcessing) return;

    isProcessing = true;
    revealChatMode();
    if (!activeConversation) {
      activeConversation = createConversation();
    }

    activeConversation.messages.push({ role: "user", text: trimmed, timestamp: new Date().toISOString() });
    addMessageToUI("user", trimmed, new Date().toISOString());
    persistConversation();
    textInput.value = "";
    setStatus("thinking");
    addTypingIndicator();

    try {
      const data = await sendToBackend(trimmed);
      removeTypingIndicator();
      const reply = (data.reply || "").trim();
      activeConversation.messages.push({ role: "nova", text: reply, timestamp: new Date().toISOString() });
      addMessageToUI("nova", reply, new Date().toISOString());
      persistConversation();
      speak(reply);
      openAction(data.action, data.url, data.query);
    } catch (error) {
      removeTypingIndicator();
      const fallback = `I couldn't reach the server. ${error.message}`;
      activeConversation.messages.push({ role: "nova", text: fallback, timestamp: new Date().toISOString() });
      addMessageToUI("nova", fallback, new Date().toISOString());
      persistConversation();
      speak("Sorry, I couldn't reach the server.");
    } finally {
      isProcessing = false;
      setStatus("ready");
    }
  }

  function initSpeechRecognition() {
    if (!SpeechRecognitionAPI) {
      micBtn.disabled = true;
      micBtn.title = "Voice recognition is not supported in this browser.";
      return;
    }

    recognizer = new SpeechRecognitionAPI();
    recognizer.continuous = false;
    recognizer.interimResults = false;
    recognizer.lang = "en-US";

    recognizer.onstart = () => {
      isListening = true;
      micBtn.classList.add("listening");
      setStatus("listening");
    };

    recognizer.onend = () => {
      isListening = false;
      micBtn.classList.remove("listening");
      if (statusText.textContent === "Listening…") {
        setStatus("ready");
      }
    };

    recognizer.onerror = (event) => {
      isListening = false;
      micBtn.classList.remove("listening");
      const messages = {
        "no-speech": "I didn't catch anything. Try again.",
        "audio-capture": "No microphone was detected. Check your input device.",
        "not-allowed": "Microphone access was blocked. Please allow access and try again.",
        network: "There was a network issue during speech recognition.",
      };
      const fallback = messages[event.error] || `Speech recognition error: ${event.error}`;
      if (activeConversation) {
        activeConversation.messages.push({ role: "nova", text: fallback, timestamp: new Date().toISOString() });
        addMessageToUI("nova", fallback, new Date().toISOString());
        persistConversation();
      }
      speak(fallback);
      setStatus("ready");
    };

    recognizer.onresult = (event) => {
      const transcript = event.results[event.resultIndex][0].transcript;
      textInput.value = transcript;
      handleUserMessage(transcript);
    };
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove("hidden");
    }
  }

  function closeModal() {
    document.querySelectorAll(".modal-backdrop").forEach((modal) => modal.classList.add("hidden"));
  }

  function bindEvents() {
    sendBtn.addEventListener("click", () => handleUserMessage(textInput.value));

    textInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleUserMessage(textInput.value);
      }
    });

    suggestionCards.forEach((card) => {
      card.addEventListener("click", () => {
        handleUserMessage(card.dataset.prompt);
      });
    });

    micBtn.addEventListener("click", () => {
      if (!recognizer) return;
      if (isListening) {
        recognizer.stop();
        return;
      }
      if (synth) synth.cancel();
      try {
        recognizer.start();
      } catch (error) {
        // ignore duplicate-start errors
      }
    });

    newChatBtn.addEventListener("click", () => {
      if (activeConversation && activeConversation.messages.length) {
        persistConversation();
      }
      activeConversation = createConversation();
      renderConversation();
      textInput.value = "";
      setStatus("ready");
    });

    menuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });

    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        const view = button.getAttribute("data-view");
        if (view === "settings") {
          openModal("settingsModal");
        } else if (view === "about") {
          openModal("aboutModal");
        } else if (view === "history") {
          historyList.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });
    });

    document.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", () => closeModal());
    });

    document.querySelectorAll(".modal-backdrop").forEach((modal) => {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) {
          closeModal();
        }
      });
    });

    speechRateInput.addEventListener("input", () => {
      settings.speechRate = Number(speechRateInput.value);
      speechRateValue.textContent = `${settings.speechRate.toFixed(1)}×`;
      saveSettings();
    });

    voiceToggle.addEventListener("change", () => {
      settings.voiceEnabled = voiceToggle.checked;
      saveSettings();
    });

    themeToggle.addEventListener("change", () => {
      settings.darkTheme = themeToggle.checked;
      saveSettings();
    });

    clearHistoryBtn.addEventListener("click", () => {
      history = [];
      localStorage.removeItem(HISTORY_KEY);
      activeConversation = createConversation();
      renderConversation();
      renderHistory();
      closeModal();
    });
  }

  function initializeSettingsUI() {
    speechRateInput.value = settings.speechRate;
    speechRateValue.textContent = `${Number(settings.speechRate).toFixed(1)}×`;
    voiceToggle.checked = settings.voiceEnabled;
    themeToggle.checked = settings.darkTheme;
    applyTheme();
  }

  function init() {
    loadHistory();
    applyTheme();
    initializeSettingsUI();
    activeConversation = createConversation();
    renderConversation();
    renderHistory();
    initSpeechRecognition();
    bindEvents();
    setStatus("ready");
    if (window.innerWidth <= 860) {
      sidebar.classList.add("collapsed");
    }
  }

  init();
})();

