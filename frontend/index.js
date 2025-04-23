
  // Global variable to store code artifacts
  const codeArtifacts = [];
  let artifactCounter = 0;

  // --- Get references to elements ---
  const userInput = document.getElementById("user-input");
  const sendButton = document.getElementById("send-btn");
  const chatBox = document.getElementById('chat-box');
  const artifactPanel = document.querySelector('.artifact-panel');
  // ---------------------------------

  // Handle Enter key press for sending message
  userInput.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent default newline/submit
      sendMessage();         // Call the send function
    }
  });

  // --- ADD THIS: Handle Send button click ---
  sendButton.addEventListener("click", sendMessage);
  // ---------------------------------------

  async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return; // Don't send empty messages

    // Add user message to chat box
    addMessageToChat('user', message);

    // Clear input field
    userInput.value = '';

    // Show loading indicator
    showLoadingIndicator();

    try {
      // Send message to backend
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      // Remove loading indicator AFTER getting response
      removeLoadingIndicator();

      if (!response.ok) {
        // Try to get error details from backend response body
        let errorDetails = `API returned status ${response.status}`;
        try {
            const errorData = await response.json();
            if (errorData.error) {
                errorDetails += `: ${errorData.error}`;
            }
        } catch (e) { /* Ignore if response body isn't valid JSON */ }
        throw new Error(errorDetails);
      }

      const data = await response.json();

      if (data.reply !== undefined) { // Check if reply exists
        // Add AI response to chat box
        addMessageToChat('ai', data.reply);
      } else {
        console.error("Invalid API response format:", data);
        throw new Error("Missing 'reply' key in API response");
      }
    } catch (error) {
      console.error("Error sending/receiving chat message:", error);
      removeLoadingIndicator(); // Ensure loading is removed on error
      // Add more informative error message to chat
      const errorMsg = `Sorry, something went wrong: ${error.message}`;
      addMessageToChat('ai', errorMsg); // Display error in chat
    }
  }

  function showLoadingIndicator() {
    // Avoid adding multiple indicators
    if (document.getElementById('loading-indicator')) return;

    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-indicator';
    // Apply multiple classes correctly
    loadingDiv.className = 'loading chat-bubble ai';
    loadingDiv.innerHTML = 'Thinking<span></span><span></span><span></span>';
    chatBox.appendChild(loadingDiv);

    // Scroll to bottom
    scrollToBottom();
  }

  function removeLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  }

  function addMessageToChat(sender, text) {
    const bubble = document.createElement('div');
    bubble.classList.add('chat-bubble', sender);

    const label = sender === 'user' ? 'You' : 'Mistral';

    // Process text for code blocks BEFORE formatting the rest
    let processedResult = processCodeBlocks(text);
    let remainingText = processedResult.text; // Text without the code blocks
    let extractedCodeBlocks = processedResult.codeBlocks;

    // Format the non-code parts of the message
    let formattedText = formatMessage(remainingText);

    // Add code artifacts if code blocks were found (only for AI)
    if (extractedCodeBlocks.length > 0 && sender === 'ai') {
      // Clear the "No artifacts" message if it exists
      const noArtifactsMsg = artifactPanel.querySelector('.no-artifacts');
      if (noArtifactsMsg) {
        noArtifactsMsg.remove();
      }

      // Add each code block as an artifact
      extractedCodeBlocks.forEach((block, index) => {
        const artifactId = `artifact-${artifactCounter}`;
        const currentArtifactNum = artifactCounter + 1; // User-friendly 1-based index
        artifactCounter++;

        // Add reference in the chat, replacing the placeholder
        formattedText = formattedText.replace(
          `__CODE_BLOCK_${index}__`,
          `<div class="code-reference" data-artifact-id="${artifactId}">
             <strong>Code Block ${currentArtifactNum}</strong> (Click to view)
           </div>`
        );

        // Create artifact in side panel
        const artifactElement = createCodeArtifact(block.code, block.language, artifactId, currentArtifactNum);
        artifactPanel.appendChild(artifactElement);

        // Store artifact info (optional, if needed later)
        codeArtifacts.push({
          id: artifactId,
          code: block.code,
          language: block.language
        });
      });
    }

    // Add timestamp
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Set the main bubble content AFTER processing code blocks and formatting
    bubble.innerHTML = `<p><strong>${label}:</strong> ${formattedText}</p><div class="timestamp">${time}</div>`;

    // Add copy button for AI responses (copies the original, unprocessed text)
    if (sender === 'ai') {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.innerText = 'Copy Text'; // More specific label
      copyBtn.onclick = function() {
        navigator.clipboard.writeText(text) // Copy original text
          .then(() => {
            copyBtn.innerText = 'Copied!';
            setTimeout(() => {
              copyBtn.innerText = 'Copy Text';
            }, 2000);
          })
          .catch(err => {
            console.error('Failed to copy text: ', err);
          });
      };
      // Append copy button *after* setting innerHTML or find paragraph to append to
      const pElement = bubble.querySelector('p');
        if (pElement) {
           pElement.insertAdjacentElement('afterend', copyBtn); // Place it after the main text paragraph
        } else {
           bubble.appendChild(copyBtn); // Fallback
        }

    }

    chatBox.appendChild(bubble);

    // Scroll to bottom
    scrollToBottom();

    // Add event listeners to NEW code references just added
    bubble.querySelectorAll('.code-reference').forEach(ref => {
      ref.addEventListener('click', function() {
        const artifactId = this.getAttribute('data-artifact-id');
        const artifactElement = document.getElementById(artifactId); // Corrected variable name
        if (artifactElement) { // Corrected variable name
          artifactElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); // Adjusted scroll behavior
          // Simple highlight effect
          artifactElement.style.transition = 'background-color 0.3s ease-out';
          artifactElement.style.backgroundColor = '#e0e0e0'; // Temporary highlight color
          setTimeout(() => {
            artifactElement.style.backgroundColor = ''; // Reset background
          }, 1500);
        }
      });
    });
  }

  function processCodeBlocks(text) {
    let codeBlocks = [];
    let processedText = text;

    // Find all code blocks with triple backticks, handle potential language hints
    const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g; // Made newline optional after lang hint
    let match;
    let index = 0;
    const placeholders = []; // Store placeholders to ensure correct replacement order

    // First pass: Extract blocks and create placeholders
    while ((match = codeBlockRegex.exec(text)) !== null) {
        const language = match[1] || 'plaintext'; // Default to plaintext if no language hint
        const code = match[2].trim(); // Trim whitespace around the code block content
        const placeholder = `__CODE_BLOCK_${index}__`;

        codeBlocks.push({
            language: language,
            code: code
        });
        placeholders.push({ original: match[0], placeholder: placeholder });
        index++;
    }

    // Second pass: Replace original blocks with placeholders in order
    placeholders.forEach(p => {
        processedText = processedText.replace(p.original, p.placeholder);
    });


    return {
      text: processedText, // Text with placeholders
      codeBlocks: codeBlocks // Array of extracted {language, code} objects
    };
  }

  function createCodeArtifact(code, language, artifactId, artifactNumber) {
    const artifactElement = document.createElement('div');
    artifactElement.className = 'code-artifact';
    artifactElement.id = artifactId;
  
    // Create header with language, artifact number and copy button
    const header = document.createElement('div');
    header.className = 'code-artifact-header';
  
    const langSpan = document.createElement('span');
    // Display number and language
    langSpan.textContent = `Block ${artifactNumber}: ${language || 'Code'}`;
  
    const copyBtn = document.createElement('button');
    copyBtn.className = 'artifact-copy-btn';
    copyBtn.textContent = 'Copy Code'; // More specific
    copyBtn.onclick = function() {
      navigator.clipboard.writeText(code)
        .then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.textContent = 'Copy Code';
          }, 2000);
        })
        .catch(err => {
          console.error('Failed to copy code: ', err);
        });
    };
  
    header.appendChild(langSpan);
    header.appendChild(copyBtn);
  
    // Create body with code inside <pre><code>
    const body = document.createElement('div');
    body.className = 'code-artifact-body';
  
    const pre = document.createElement('pre');
    const codeElement = document.createElement('code'); // Use <code> inside <pre>
    codeElement.className = `language-${language}`; // Add language class for Prism
    codeElement.textContent = code; // Use textContent for security and correct rendering
  
    pre.appendChild(codeElement);
    body.appendChild(pre);
  
    // Add header and body to artifact
    artifactElement.appendChild(header);
    artifactElement.appendChild(body);
  
    // Trigger Prism.js to highlight the code element
    Prism.highlightElement(codeElement);
  
    return artifactElement;
  }

  function formatMessage(text) {
    // Escape HTML first for security - prevent XSS
    let escapedText = escapeHTML(text);

    // --- Apply formatting AFTER escaping ---

    // Process inline code blocks (`code`) - capture content non-greedily
    escapedText = escapedText.replace(
      /`([^`]+?)`/g, // Use non-greedy +?
      '<code>$1</code>'
    );

    // Bold (**text**) - capture content non-greedily
    escapedText = escapedText.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic (*text* or _text_) - capture content non-greedily
    escapedText = escapedText.replace(/([^*])\*([^*]+?)\*([^*])/g, '$1<em>$2</em>$3'); // Avoid **
    escapedText = escapedText.replace(/(^|\s)_([^_]+?)_($|\s)/g, '$1<em>$2</em>$3'); // Underscore italics

    // Convert URLs to links
    // Basic URL regex, might need refinement for complex cases
    const urlRegex = /(https?:\/\/[^\s<>"'`]+)/g;
     escapedText = escapedText.replace(urlRegex, (url) => {
         // Ensure the URL doesn't end with punctuation incorrectly captured
         let cleanUrl = url;
         const trailingChars = /[.,!?)\];:]+$/;
         const match = url.match(trailingChars);
         if (match) {
             cleanUrl = url.slice(0, -match[0].length);
         }
         return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>` + (match ? match[0] : '');
     });


    // Convert line breaks to <br> (important for paragraphs)
    escapedText = escapedText.replace(/\n/g, '<br>');

    return escapedText;
  }


  function escapeHTML(str) {
    // More robust check for non-string input
    if (typeof str !== 'string') {
        // Handle non-string input gracefully, e.g., convert to string or return empty
        str = String(str);
    }
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;', // More common than &#039;
        "/": '&#x2F;' // Helps prevent closing script tags
    };
    return str.replace(/[&<>"'/]/g, function(m) { return map[m]; });
  }


  function scrollToBottom() {
    // Slight delay can sometimes help ensure rendering is complete
    setTimeout(() => {
        chatBox.scrollTo({
            top: chatBox.scrollHeight,
            behavior: 'smooth'
        });
    }, 0);
  }

  // Initial setup when page loads
  window.addEventListener('load', () => {
      // Maybe add an initial greeting?
      // addMessageToChat('ai', 'Hello! How can I help you today?');
      scrollToBottom(); // Ensure scroll is correct on load
  });