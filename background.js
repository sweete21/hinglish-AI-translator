// Handle context menu for highlighted text translation
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "translateToHinglish",
      title: "Translate to Hinglish",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: "explainInHinglish",
      title: "Explain in Hinglish",
      contexts: ["selection"]
    });
  });
  
  // Handle messages from content script and popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translateText") {
      translateText(request.text)
        .then(sendResponse)
        .catch(error => {
          console.error("Translation error:", error);
          sendResponse("Translation error: " + error.message);
        });
      return true; // Required for async sendResponse
    }
    if (request.action === "explainText") {
      explainText(request.text)
        .then(sendResponse)
        .catch(error => {
          console.error("Explanation error:", error);
          sendResponse("Explanation error: " + error.message);
        });
      return true; // Required for async sendResponse
    }
  });
  
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "translateToHinglish" && info.selectionText) {
      try {
        // Show loading popup
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: showLoadingPopup,
          args: []
        });

        const translatedText = await translateText(info.selectionText);
        
        // Remove loading popup and show translation
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: showTranslationPopup,
          args: [info.selectionText, translatedText]
        });
      } catch (error) {
        console.error("Context menu translation error:", error);
        // Show error in popup
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: showErrorPopup,
          args: [error.message]
        });
      }
    } else if (info.menuItemId === "explainInHinglish" && info.selectionText) {
      try {
        // Show loading popup
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: showLoadingPopup,
          args: []
        });

        const explanation = await explainText(info.selectionText);
        
        // Remove loading popup and show explanation
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: showExplanationPopup,
          args: [info.selectionText, explanation]
        });
      } catch (error) {
        console.error("Context menu explanation error:", error);
        // Show error in popup
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: showErrorPopup,
          args: [error.message]
        });
      }
    }
  });
  
  // Function to get translation prompt based on style and level
  function getTranslationPrompt(style, level) {
    const prompts = {
      hinglish: {
        balanced: "You are a translator that converts English text to Hinglish (Hindi written in English letters). Keep the meaning exactly the same but make it sound natural in Hinglish. Use a balanced mix of Hindi and English words. Only respond with the translated text, no explanations.",
        moreHindi: "You are a translator that converts English text to Hinglish (Hindi written in English letters). Keep the meaning exactly the same but make it sound natural in Hinglish. Use more Hindi words than English. Only respond with the translated text, no explanations.",
        moreEnglish: "You are a translator that converts English text to Hinglish (Hindi written in English letters). Keep the meaning exactly the same but make it sound natural in Hinglish. Use more English words than Hindi. Only respond with the translated text, no explanations."
      },
      hindi: {
        balanced: "You are a translator that converts English text to Hindi (Devanagari script). Keep the meaning exactly the same but make it sound natural in Hindi. Use a balanced mix of formal and colloquial Hindi. Only respond with the translated text, no explanations.",
        moreHindi: "You are a translator that converts English text to Hindi (Devanagari script). Keep the meaning exactly the same but make it sound natural in Hindi. Use more formal Hindi words. Only respond with the translated text, no explanations.",
        moreEnglish: "You are a translator that converts English text to Hindi (Devanagari script). Keep the meaning exactly the same but make it sound natural in Hindi. Use more colloquial Hindi words. Only respond with the translated text, no explanations."
      },
      roman: {
        balanced: "You are a translator that converts Hindi text to Romanized Hindi (Hindi written in English letters). Keep the meaning exactly the same but make it sound natural. Use a balanced mix of formal and colloquial words. Only respond with the translated text, no explanations.",
        moreHindi: "You are a translator that converts Hindi text to Romanized Hindi (Hindi written in English letters). Keep the meaning exactly the same but make it sound natural. Use more formal words. Only respond with the translated text, no explanations.",
        moreEnglish: "You are a translator that converts Hindi text to Romanized Hindi (Hindi written in English letters). Keep the meaning exactly the same but make it sound natural. Use more colloquial words. Only respond with the translated text, no explanations."
      },
      formal: {
        balanced: "You are a translator that converts English text to formal Hinglish (Hindi written in English letters). Keep the meaning exactly the same but make it sound professional and formal. Use a balanced mix of Hindi and English words. Only respond with the translated text, no explanations.",
        moreHindi: "You are a translator that converts English text to formal Hinglish (Hindi written in English letters). Keep the meaning exactly the same but make it sound professional and formal. Use more Hindi words than English. Only respond with the translated text, no explanations.",
        moreEnglish: "You are a translator that converts English text to formal Hinglish (Hindi written in English letters). Keep the meaning exactly the same but make it sound professional and formal. Use more English words than Hindi. Only respond with the translated text, no explanations."
      },
      casual: {
        balanced: "You are a translator that converts English text to casual Hinglish (Hindi written in English letters). Keep the meaning exactly the same but make it sound casual and conversational. Use a balanced mix of Hindi and English words. Only respond with the translated text, no explanations.",
        moreHindi: "You are a translator that converts English text to casual Hinglish (Hindi written in English letters). Keep the meaning exactly the same but make it sound casual and conversational. Use more Hindi words than English. Only respond with the translated text, no explanations.",
        moreEnglish: "You are a translator that converts English text to casual Hinglish (Hindi written in English letters). Keep the meaning exactly the same but make it sound casual and conversational. Use more English words than Hindi. Only respond with the translated text, no explanations."
      }
    };

    return prompts[style][level] || prompts.hinglish.balanced;
  }

  // Function to translate text using Groq API
  async function translateText(text) {
    const { groqApiKey, translationSettings } = await chrome.storage.local.get(['groqApiKey', 'translationSettings']);
    
    if (!groqApiKey) {
      throw new Error("Please configure your API key first");
    }
  
    const style = translationSettings?.style || 'hinglish';
    const level = translationSettings?.level || 'balanced';
    const prompt = getTranslationPrompt(style, level);
  
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          messages: [{
            role: "system",
            content: prompt
          }, {
            role: "user",
            content: text
          }],
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          temperature: 0.7,
          max_tokens: 1000
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      const translatedText = data.choices[0].message.content.trim();
      
      if (!translatedText) {
        throw new Error("Empty translation received");
      }
      
      return translatedText;
    } catch (error) {
      console.error("Translation error:", error);
      throw error;
    }
  }

  // Function to explain text using Groq API
  async function explainText(text) {
    const { groqApiKey, translationSettings } = await chrome.storage.local.get(['groqApiKey', 'translationSettings']);
    
    if (!groqApiKey) {
      throw new Error("Please configure your API key first");
    }

    const style = translationSettings?.style || 'hinglish';
    const level = translationSettings?.level || 'balanced';
    const prompt = `You are an AI assistant that explains concepts in ${style === 'hindi' ? 'Hindi' : 'Hinglish'}. 
      Provide a clear and detailed explanation of the given text. 
      Make it easy to understand and use ${level === 'moreHindi' ? 'more Hindi words' : level === 'moreEnglish' ? 'more English words' : 'a balanced mix of Hindi and English words'}.
      Format your response in a clear, structured way with bullet points or short paragraphs.
      Only respond with the explanation, no additional text.`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          messages: [{
            role: "system",
            content: prompt
          }, {
            role: "user",
            content: text
          }],
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          temperature: 0.7,
          max_tokens: 1000
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      const explanation = data.choices[0].message.content.trim();
      
      if (!explanation) {
        throw new Error("Empty explanation received");
      }
      
      return explanation;
    } catch (error) {
      console.error("Explanation error:", error);
      throw error;
    }
  }

  // Function to show loading popup
  function showLoadingPopup() {
    const popup = document.createElement('div');
    popup.id = 'translationLoadingPopup';
    popup.style.position = 'fixed';
    popup.style.zIndex = '9999';
    popup.style.backgroundColor = '#ffffff';
    popup.style.border = '1px solid #ccc';
    popup.style.borderRadius = '5px';
    popup.style.padding = '15px';
    popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    popup.style.maxWidth = '300px';
    popup.style.fontFamily = 'Arial, sans-serif';
    popup.style.fontSize = '14px';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.textAlign = 'center';
    
    popup.innerHTML = `
      <div style="margin-bottom: 10px;">Processing...</div>
      <div class="loading-spinner" style="
        width: 30px;
        height: 30px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #1a73e8;
        border-radius: 50%;
        margin: 0 auto;
        animation: spin 1s linear infinite;
      "></div>
    `;
    
    // Add the animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(popup);
  }

  // Function to show translation popup
  function showTranslationPopup(originalText, translatedText) {
    // Remove loading popup if it exists
    const loadingPopup = document.getElementById('translationLoadingPopup');
    if (loadingPopup) {
      document.body.removeChild(loadingPopup);
    }

    const popup = document.createElement('div');
    popup.style.position = 'fixed';
    popup.style.zIndex = '9999';
    popup.style.backgroundColor = '#ffffff';
    popup.style.border = '1px solid #ccc';
    popup.style.borderRadius = '5px';
    popup.style.padding = '15px';
    popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    popup.style.maxWidth = '400px';
    popup.style.fontFamily = 'Arial, sans-serif';
    popup.style.fontSize = '14px';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    
    popup.innerHTML = `
      <div style="margin-bottom: 15px;">
        <div style="font-weight: bold; margin-bottom: 5px; color: #666;">Original Text:</div>
        <div style="background: #f5f5f5; padding: 10px; border-radius: 4px; margin-bottom: 10px;">${originalText}</div>
        <div style="font-weight: bold; margin-bottom: 5px; color: #666;">Translation:</div>
        <div style="background: #e8f0fe; padding: 10px; border-radius: 4px; margin-bottom: 15px;">${translatedText}</div>
      </div>
      <div style="text-align: right;">
        <button id="closePopup" style="
          cursor: pointer;
          padding: 8px 16px;
          background: #1a73e8;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
        ">Close</button>
      </div>
    `;
    
    document.body.appendChild(popup);
    
    // Close button functionality
    popup.querySelector('#closePopup').addEventListener('click', () => {
      document.body.removeChild(popup);
    });
    
    // Close when clicking outside
    document.addEventListener('click', function outsideClick(e) {
      if (!popup.contains(e.target)) {
        document.body.removeChild(popup);
        document.removeEventListener('click', outsideClick);
      }
    });
  }

  // Function to show explanation popup
  function showExplanationPopup(originalText, explanation) {
    // Remove loading popup if it exists
    const loadingPopup = document.getElementById('translationLoadingPopup');
    if (loadingPopup) {
      document.body.removeChild(loadingPopup);
    }

    const popup = document.createElement('div');
    popup.style.position = 'fixed';
    popup.style.zIndex = '9999';
    popup.style.backgroundColor = '#ffffff';
    popup.style.border = '1px solid #ccc';
    popup.style.borderRadius = '5px';
    popup.style.padding = '15px';
    popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    popup.style.maxWidth = '500px';
    popup.style.fontFamily = 'Arial, sans-serif';
    popup.style.fontSize = '14px';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    
    popup.innerHTML = `
      <div style="margin-bottom: 15px;">
        <div style="font-weight: bold; margin-bottom: 5px; color: #666;">Original Text:</div>
        <div style="background: #f5f5f5; padding: 10px; border-radius: 4px; margin-bottom: 10px;">${originalText}</div>
        <div style="font-weight: bold; margin-bottom: 5px; color: #666;">AI Explanation:</div>
        <div style="background: #e8f0fe; padding: 10px; border-radius: 4px; margin-bottom: 15px; white-space: pre-wrap;">${explanation}</div>
      </div>
      <div style="text-align: right;">
        <button id="closePopup" style="
          cursor: pointer;
          padding: 8px 16px;
          background: #1a73e8;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
        ">Close</button>
      </div>
    `;
    
    document.body.appendChild(popup);
    
    // Close button functionality
    popup.querySelector('#closePopup').addEventListener('click', () => {
      document.body.removeChild(popup);
    });
    
    // Close when clicking outside
    document.addEventListener('click', function outsideClick(e) {
      if (!popup.contains(e.target)) {
        document.body.removeChild(popup);
        document.removeEventListener('click', outsideClick);
      }
    });
  }

  // Function to show error popup
  function showErrorPopup(errorMessage) {
    // Remove loading popup if it exists
    const loadingPopup = document.getElementById('translationLoadingPopup');
    if (loadingPopup) {
      document.body.removeChild(loadingPopup);
    }

    const popup = document.createElement('div');
    popup.style.position = 'fixed';
    popup.style.zIndex = '9999';
    popup.style.backgroundColor = '#d93025';
    popup.style.color = 'white';
    popup.style.borderRadius = '5px';
    popup.style.padding = '15px';
    popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    popup.style.maxWidth = '300px';
    popup.style.fontFamily = 'Arial, sans-serif';
    popup.style.fontSize = '14px';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    
    popup.innerHTML = `
      <div style="margin-bottom: 10px;">
        <div style="font-weight: bold; margin-bottom: 5px;">Error:</div>
        <div style="margin-bottom: 15px;">${errorMessage}</div>
      </div>
      <div style="text-align: right;">
        <button id="closePopup" style="
          cursor: pointer;
          padding: 8px 16px;
          background: white;
          color: #d93025;
          border: none;
          border-radius: 4px;
          font-size: 14px;
        ">Close</button>
      </div>
    `;
    
    document.body.appendChild(popup);
    
    // Close button functionality
    popup.querySelector('#closePopup').addEventListener('click', () => {
      document.body.removeChild(popup);
    });
    
    // Auto close after 5 seconds
    setTimeout(() => {
      if (document.body.contains(popup)) {
        document.body.removeChild(popup);
      }
    }, 5000);
  }