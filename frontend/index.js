// Handle Enter key press
document.getElementById("user-input").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      document.getElementById("send-btn").click();
    }
  });
  
  async function sendMessage() {
    const input = document.getElementById('user-input');
    const message = input.value.trim();
  
    if (!message) return; // Don't send empty messages
  
    try {
      // Add user message to chat box
      addMessageToChat('user', message);
  
      // Clear input field
      input.value = '';
  
      // Send request to backend
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
  
      const data = await response.json();
  
      if (!data.choices || !data.choices[0]) {
        throw new Error("Invalid API response: " + JSON.stringify(data));
      }
  
      const reply = data.choices[0].message.content;
  
      // Add AI response to chat box
      addMessageToChat('ai', reply);
    } catch (error) {
      console.error("Chat error:", error);
      alert("Something went wrong. Check console for details.");
    }
  }
  
  function addMessageToChat(sender, text) {
    const chatBox = document.getElementById('chat-box');
    
    const bubble = document.createElement('div');
    bubble.classList.add('chat-bubble', sender);
  
    const label = sender === 'user' ? 'You' : 'Mistral';
  
    // Escape HTML entities
    const escapedText = escapeHTML(text);
  
    bubble.innerHTML = `<p><strong>${label}:</strong> ${escapedText}</p>`;
    chatBox.appendChild(bubble);
  
    // Scroll to bottom smoothly
    chatBox.scrollTo({
      top: chatBox.scrollHeight,
      behavior: 'smooth',
    });
  }
  
  function escapeHTML(str) {
    return str.replace(/[&<>"']/g, function(match) {
      const escapeChars = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return escapeChars[match];
    });
  }
  

const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
bubble.innerHTML = `<p><strong>${label}:</strong> ${escapedText}</p><div class="timestamp">${time}</div>`;
