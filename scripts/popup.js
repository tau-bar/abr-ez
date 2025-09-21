// DOM elements
let abbreviationInput, meaningInput, descriptionInput, addBtn;
let abbreviationsContainer, loadingDiv, emptyStateDiv, messageContainer;
const STORAGE_KEY = 'abr-ez';

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  initializeElements();
  setupEventListeners();
  loadAbbreviations();
});

function initializeElements() {
  abbreviationInput = document.getElementById('abbreviation');
  meaningInput = document.getElementById('meaning');
  descriptionInput = document.getElementById('description');
  addBtn = document.getElementById('add-btn');
  abbreviationsContainer = document.getElementById('abbreviations-container');
  loadingDiv = document.getElementById('loading');
  emptyStateDiv = document.getElementById('empty-state');
  messageContainer = document.getElementById('message-container');
}

function setupEventListeners() {
  addBtn.addEventListener('click', addAbbreviation);
  
  // Allow Enter key to submit form
  [abbreviationInput, meaningInput, descriptionInput].forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addAbbreviation();
      }
    });
  });
}

// Storage functions
async function loadAbbreviations() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const userAbbreviations = result[STORAGE_KEY] || {};
    
    displayAbbreviations(userAbbreviations);
  } catch (error) {
    console.error('Error loading abbreviations:', error);
    showMessage('Error loading abbreviations' + error, 'error');
    displayAbbreviations({});
  }
}

async function saveAbbreviations(abbreviations) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: abbreviations });
    return true;
  } catch (error) {
    console.error('Error saving abbreviations:', error);
    showMessage('Error saving abbreviations', 'error');
    return false;
  }
}

// UI functions
function displayAbbreviations(abbreviations) {
  loadingDiv.classList.add('hidden');
  
  const abbreviationKeys = Object.keys(abbreviations).sort();
  
  if (abbreviationKeys.length === 0) {
    emptyStateDiv.classList.remove('hidden');
    abbreviationsContainer.innerHTML = '';
    return;
  }
  
  emptyStateDiv.classList.add('hidden');
  
  abbreviationsContainer.innerHTML = abbreviationKeys.map(key => {
    const data = abbreviations[key];
    const meaning = typeof data === 'string' ? data : data.meaning;
    const description = typeof data === 'object' ? data.description : '';
    
    return `
      <div class="abbreviation-item" data-abbr="${key}">
        <div class="abbreviation-content">
          <div class="abbreviation-title">${escapeHtml(key)}</div>
          <div class="abbreviation-meaning">${escapeHtml(meaning)}</div>
          ${description ? `<div class="abbreviation-description">${escapeHtml(description)}</div>` : ''}
        </div>
        <div class="abbreviation-actions">
          <button class="btn btn-small btn-danger delete-btn" data-abbr-key="${key}">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  // Add the event listeners after the content is rendered
  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', (event) => {
      const abbreviation = event.target.dataset.abbrKey;
      deleteAbbreviation(abbreviation);
    });
  });
}

function addAbbreviation() {
  const abbreviation = abbreviationInput.value.trim().toUpperCase();
  const meaning = meaningInput.value.trim();
  const description = descriptionInput.value.trim();
  
  // Validation
  if (!abbreviation) {
    showMessage('Please enter an abbreviation', 'error');
    abbreviationInput.focus();
    return;
  }
  
  if (!meaning) {
    showMessage('Please enter the full meaning', 'error');
    meaningInput.focus();
    return;
  }
  
  if (abbreviation.length > 20) {
    showMessage('Abbreviation must be 20 characters or less', 'error');
    abbreviationInput.focus();
    return;
  }
  
  if (meaning.length > 100) {
    showMessage('Full meaning must be 100 characters or less', 'error');
    meaningInput.focus();
    return;
  }
  
  // Check for duplicates
  chrome.storage.local.get([STORAGE_KEY], async (result) => {
    const userAbbreviations = result[STORAGE_KEY] || {};
    
    if (userAbbreviations[abbreviation]) {
      showMessage('This abbreviation already exists', 'error');
      abbreviationInput.focus();
      return;
    }
    
    // Add new abbreviation
    userAbbreviations[abbreviation] = {
      meaning: meaning,
      description: description
    };
    
    const success = await saveAbbreviations(userAbbreviations);
    if (success) {
      showMessage('Abbreviation added successfully!', 'success');
      clearForm();
      displayAbbreviations(userAbbreviations);
    }
  });
}

async function deleteAbbreviation(abbreviation) {
  console.log(abbreviation)
  if (!confirm(`Are you sure you want to delete "${abbreviation}"?`)) {
    return;
  }
  
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const userAbbreviations = result[STORAGE_KEY] || {};
    
    delete userAbbreviations[abbreviation];
    
    const success = await saveAbbreviations(userAbbreviations);
    if (success) {
      showMessage('Abbreviation deleted successfully!', 'success');
      displayAbbreviations(userAbbreviations);
    }
  } catch (error) {
    console.error('Error deleting abbreviation:', error);
    showMessage('Error deleting abbreviation', 'error');
  }
}

function clearForm() {
  abbreviationInput.value = '';
  meaningInput.value = '';
  descriptionInput.value = '';
  abbreviationInput.focus();
}

function showMessage(message, type = 'info') {
  messageContainer.innerHTML = `<div class="${type}-message">${escapeHtml(message)}</div>`;
  
  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      messageContainer.innerHTML = '';
    }, 3000);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
} 