// Create popup element
function createPopup(abbreviation, data) {
  const popup = document.createElement('div');
  popup.className = 'abbreviation-popup';
  popup.innerHTML = `
    <div class="popup-content">
      <div class="popup-header">
        <strong>${abbreviation}</strong> - ${data.meaning}
      </div>
      <div class="popup-description">
        ${data.description}
      </div>
      <div class="popup-close">×</div>
    </div>
  `;
  
  // Add styles
  popup.style.cssText = `
    position: absolute;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 0;
    z-index: 10000;
    max-width: 300px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    line-height: 1.4;
  `;
  
  const content = popup.querySelector('.popup-content');
  content.style.cssText = `
    padding: 12px;
    position: relative;
  `;
  
  const header = popup.querySelector('.popup-header');
  header.style.cssText = `
    font-weight: bold;
    margin-bottom: 8px;
    color: #333;
  `;
  
  const description = popup.querySelector('.popup-description');
  description.style.cssText = `
    color: #666;
    margin-bottom: 8px;
  `;
  
  const close = popup.querySelector('.popup-close');
  close.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    cursor: pointer;
    font-size: 18px;
    color: #999;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Close popup when clicking the X
  close.addEventListener('click', () => {
    popup.remove();
  });
  
  // Close popup when clicking outside
  document.addEventListener('click', (e) => {
    if (!popup.contains(e.target)) {
      popup.remove();
    }
  });
  
  return popup;
}

// Show popup at the specified position
function showPopup(popup, element) {
  // Remove any existing popups
  document.querySelectorAll('.abbreviation-popup').forEach(p => p.remove());
  
  document.body.appendChild(popup);
  
  const rect = element.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();
  
  // Position popup above the element if there's not enough space below
  let top = rect.bottom + window.scrollY + 5;
  if (rect.bottom + popupRect.height > window.innerHeight) {
    top = rect.top + window.scrollY - popupRect.height - 5;
  }
  
  // Adjust horizontal position to keep popup in view
  let left = rect.left + window.scrollX;
  if (left + popupRect.width > window.innerWidth) {
    left = window.innerWidth - popupRect.width - 10;
  }
  if (left < 10) {
    left = 10;
  }
  
  popup.style.top = top + 'px';
  popup.style.left = left + 'px';
}

// Process text node and wrap abbreviations
function processTextNode(textNode, abbreviations) {
  const text = textNode.textContent;
  let hasAbbreviations = false;
  let newHTML = text;
  
  // Create a regex pattern for all abbreviations (case-sensitive by default)
  const abbreviationPattern = new RegExp(
    '\\b(' + Object.keys(abbreviations).join('|') + ')\\b',
    'g'
  );
  
  newHTML = newHTML.replace(abbreviationPattern, (match) => {
    // Case-sensitive matching - check for exact match
    if (abbreviations[match]) {
      hasAbbreviations = true;
      return `<span class="abbreviation" data-abbr="${match}">${match}</span>`;
    }
    
    return match;
  });
  
  if (hasAbbreviations) {
    const wrapper = document.createElement('span');
    wrapper.innerHTML = newHTML;
    
    // Replace the text node with the wrapper
    textNode.parentNode.replaceChild(wrapper, textNode);
    
    // Add event listeners to abbreviation spans
    wrapper.querySelectorAll('.abbreviation').forEach(span => {
      span.style.cssText = `
        border-bottom: 2px dotted #007acc;
        cursor: pointer;
        position: relative;
      `;
      
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        const abbreviation = span.getAttribute('data-abbr');
        const data = abbreviations[abbreviation];
        const popup = createPopup(abbreviation, data);
        showPopup(popup, span);
      });
      
      // Add hover effect
      span.addEventListener('mouseenter', () => {
        span.style.backgroundColor = '#f0f8ff';
      });
      
      span.addEventListener('mouseleave', () => {
        span.style.backgroundColor = 'transparent';
      });
    });
  }
}

// Walk through DOM tree and process text nodes
function walkNode(node, abbreviations) {
  if (node.nodeType === Node.TEXT_NODE) {
    // Skip if the text node is inside a script, style, or already processed abbreviation
    const parent = node.parentNode;
    if (parent && 
        parent.tagName !== 'SCRIPT' && 
        parent.tagName !== 'STYLE' && 
        !parent.classList.contains('abbreviation') &&
        !parent.classList.contains('abbreviation-popup')) {
      processTextNode(node, abbreviations);
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    // Skip certain elements
    if (node.tagName === 'SCRIPT' || 
        node.tagName === 'STYLE' || 
        node.classList.contains('abbreviation-popup')) {
      return;
    }
    
    // Process child nodes
    const childNodes = Array.from(node.childNodes);
    childNodes.forEach(child => walkNode(child, abbreviations));
  }
}

function addAbbreviationMeaning(abbreviations, node) {
  // If no specific node is provided, process the entire document
  const targetNode = node || document.body;
  
  if (!targetNode) {
    console.warn('No target node found for abbreviation processing');
    return;
  }
  
  // Process the node and its descendants
  walkNode(targetNode, abbreviations);
  
  // Set up a MutationObserver to handle dynamically added content
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((addedNode) => {
        if (addedNode.nodeType === Node.ELEMENT_NODE || addedNode.nodeType === Node.TEXT_NODE) {
          walkNode(addedNode, abbreviations);
        }
      });
    });
  });
  
  observer.observe(targetNode, {
    childList: true,
    subtree: true
  });
}

async function getAbbreviations() {
  const storageKey = 'abr-ez';
  const result = await chrome.storage.local.get([storageKey]);
  const userAbbreviations = result[storageKey] || {};
  return userAbbreviations
}


// Auto-initialize when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    getAbbreviations().then((res) => {
      console.log(res)
      addAbbreviationMeaning(res)
    })
  });
} else {
  getAbbreviations().then((res) => {
    addAbbreviationMeaning(res)
  })
}