// chat-widget.js
(function () {
  const styles = `
    #qc-chat-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      width: 60px; height: 60px; border-radius: 50%;
      background: #1E4D2B; color: white; border: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; box-shadow: 0 8px 24px rgba(30,77,43,0.3);
      transition: transform 0.2s, background 0.2s;
    }
    #qc-chat-btn:hover { background: #2D5A3D; transform: scale(1.05); }
    #qc-chat-btn svg { width: 28px; height: 28px; }

    #qc-chat-badge {
      position: absolute; top: -2px; right: -2px;
      background: #DC2626; color: white; font-size: 11px; font-weight: 800;
      width: 20px; height: 20px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #F9F7F2; z-index: 2;
    }

    #qc-chat-box {
      position: fixed; bottom: 100px; right: 24px; z-index: 9999;
      width: 360px; max-width: calc(100vw - 48px); height: 550px; max-height: calc(100vh - 120px);
      background: #FFFFFF; border-radius: 16px; border: 1px solid #E0DDD6;
      box-shadow: 0 12px 40px rgba(0,0,0,0.15);
      display: none; flex-direction: column; overflow: hidden;
      font-family: 'Plus Jakarta Sans', sans-serif;
      animation: qc-fade-in 0.2s ease-out;
    }

    @keyframes qc-fade-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    #qc-chat-header {
      background: #1E4D2B; color: white; padding: 16px;
      display: flex; justify-content: space-between; align-items: center;
      flex-shrink: 0;
    }
    #qc-chat-header-title { display: flex; align-items: center; gap: 10px; }
    
    .qc-avatar {
      width: 32px; height: 32px; border-radius: 50%; background: #C4943A;
      display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;
    }
    
    #qc-chat-header-text { display: flex; flex-direction: column; }
    #qc-chat-header-text strong { font-family: 'Fraunces', serif; font-weight: 600; font-size: 16px; line-height: 1.1; }
    #qc-chat-header-text small { font-size: 10px; color: #C8E6D0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }

    #qc-chat-close { background: none; border: none; color: white; font-size: 24px; cursor: pointer; line-height: 1; padding: 0; opacity: 0.8; transition: opacity 0.2s; }
    #qc-chat-close:hover { opacity: 1; }

    #qc-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
      background: #F9F7F2;
    }
    .qc-msg {
      max-width: 85%; padding: 12px 14px; border-radius: 12px;
      font-size: 13.5px; line-height: 1.5;
    }
    .qc-msg.bot { background: #FFFFFF; color: #1A1916; align-self: flex-start; border-bottom-left-radius: 4px; border: 1px solid #E0DDD6; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
    .qc-msg.user { background: #1E4D2B; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
    
    .qc-msg.bot p { margin-bottom: 8px; }
    .qc-msg.bot p:last-child { margin-bottom: 0; }
    .qc-msg.bot ul { margin-left: 20px; margin-bottom: 8px; }
    .qc-msg.bot strong { color: #1E4D2B; font-weight: 700; }

    #qc-chat-input-area {
      display: flex; padding: 14px; gap: 10px;
      background: #FFFFFF; border-top: 1px solid #E0DDD6;
      flex-shrink: 0;
    }
    #qc-chat-input {
      flex: 1; border: 1px solid #E0DDD6; border-radius: 8px;
      padding: 10px 14px; font-size: 14px; outline: none;
      font-family: inherit; background: #FAFAF8; transition: border-color 0.2s;
    }
    #qc-chat-input:focus { border-color: #1E4D2B; }
    #qc-chat-send {
      background: #C4943A; color: white; border: none;
      border-radius: 8px; padding: 0 16px; cursor: pointer;
      font-size: 14px; font-weight: 700; transition: background 0.2s;
      display: flex; align-items: center; justify-content: center;
    }
    #qc-chat-send:hover { background: #b0822e; }
    #qc-chat-send:disabled { background: #E0DDD6; cursor: not-allowed; }

    @media (max-width: 480px) {
      #qc-chat-box {
        bottom: 85px; right: 16px; left: 16px;
        width: auto; max-width: none;
        height: 70vh; max-height: 500px;
      }
      #qc-chat-btn { bottom: 16px; right: 16px; width: 56px; height: 56px; }
    }
  `;

  const styleEl = document.createElement("style");
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <button id="qc-chat-btn" title="Hablar con soporte">
      <span id="qc-chat-badge">1</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
    </button>
    <div id="qc-chat-box">
      <div id="qc-chat-header">
        <div id="qc-chat-header-title">
          <div class="qc-avatar">D</div>
          <div id="qc-chat-header-text">
            <strong>Diego</strong>
            <small>Soporte y Rentabilidad</small>
          </div>
        </div>
        <button id="qc-chat-close">×</button>
      </div>
      <div id="qc-chat-messages">
        </div>
      <div id="qc-chat-input-area">
        <input id="qc-chat-input" type="text" placeholder="Escribe tu mensaje..." autocomplete="off" />
        <button id="qc-chat-send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    </div>
  `
  );

  const btn = document.getElementById("qc-chat-btn");
  const badge = document.getElementById("qc-chat-badge");
  const box = document.getElementById("qc-chat-box");
  const closeBtn = document.getElementById("qc-chat-close");
  const input = document.getElementById("qc-chat-input");
  const sendBtn = document.getElementById("qc-chat-send");
  const messages = document.getElementById("qc-chat-messages");

  function parseMarkdown(text) {
    let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  // MEMORIA DEL NAVEGADOR
  let history = JSON.parse(sessionStorage.getItem('qc_chat_history')) || [];
  let hasOpened = sessionStorage.getItem('qc_chat_opened') === 'true';

  // Controlar la notificación roja al cargar la página
  badge.style.display = hasOpened ? 'none' : 'flex';

  // Cargar el historial si existe, si no, poner el saludo por defecto
  if (history.length > 0) {
    history.forEach(msg => {
      const div = document.createElement("div");
      div.className = \`qc-msg \${msg.role === 'user' ? 'user' : 'bot'}\`;
      if (msg.role === "user") {
        div.textContent = msg.content;
      } else {
        div.innerHTML = parseMarkdown(msg.content);
      }
      messages.appendChild(div);
    });
    setTimeout(() => messages.scrollTop = messages.scrollHeight, 100);
  } else {
    const defaultGreeting = "¡Hola, chef! Soy Diego, del equipo de QuantiChef. 👋 <br><br>Estoy aquí para ayudarte a sacarle el máximo partido a tu carta o resolverte cualquier duda sobre cómo mejorar tus márgenes. ¿En qué te puedo echar una mano hoy?";
    const div = document.createElement("div");
    div.className = "qc-msg bot";
    div.innerHTML = defaultGreeting;
    messages.appendChild(div);
  }

  function openChat() {
    box.style.display = "flex";
    badge.style.display = "none";
    sessionStorage.setItem('qc_chat_opened', 'true'); // Guardar que ya lo ha abierto
    window.history.pushState({ widget: 'chat' }, '');
    if(window.innerWidth > 480) input.focus();
  }

  function closeChat() {
    box.style.display = "none";
  }

  btn.addEventListener("click", () => {
    if (box.style.display === "flex") {
      window.history.back();
    } else {
      openChat();
    }
  });

  closeBtn.addEventListener("click", () => {
    window.history.back();
  });

  window.addEventListener("popstate", () => {
    if (box.style.display === "flex") {
      closeChat();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) sendMessage();
  });

  sendBtn.addEventListener("click", sendMessage);

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    // Guardar mensaje del usuario en la pantalla y en memoria
    addMessageToScreen(text, "user");
    history.push({ role: "user", content: text });
    sessionStorage.setItem('qc_chat_history', JSON.stringify(history));
    
    input.value = "";
    sendBtn.disabled = true;

    const typing = addMessageToScreen("Escribiendo...", "bot");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      const data = await res.json();
      const formattedReply = data.reply ? parseMarkdown(data.reply) : "Perdona, no he podido enviar el mensaje. ¿Me lo repites?";
      
      // Actualizar pantalla y memoria con la respuesta de Diego
      typing.innerHTML = formattedReply;
      history.push({ role: "assistant", content: data.reply });
      sessionStorage.setItem('qc_chat_history', JSON.stringify(history));

    } catch {
      typing.textContent = "Uy, parece que hay un fallo de conexión. Inténtalo de nuevo.";
    }

    sendBtn.disabled = false;
    messages.scrollTop = messages.scrollHeight;
    
    if(window.innerWidth > 480) {
      input.focus();
    }
  }

  function addMessageToScreen(text, type) {
    const div = document.createElement("div");
    div.className = \`qc-msg \${type}\`;
    if (type === "user") {
      div.textContent = text; 
    } else {
      div.innerHTML = text; 
    }
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }
})();
