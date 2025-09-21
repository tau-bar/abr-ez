// DOM elements
let abbreviationInput, meaningInput, descriptionInput, addBtn;
let abbreviationsContainer, loadingDiv, emptyStateDiv, messageContainer;
let csvFileInput, importBtn, downloadTemplateBtn, exportBtn, importMessageContainer;
let overwriteDuplicatesCheckbox, importProgressDiv, progressBar, progressText;
let resetBtn, resetMessageContainer, searchInput, noResultsDiv;
let listMenuBtn, listMenu;
const STORAGE_KEY = 'abr-ez';

// Global storage for all abbreviations (for search functionality)
let allAbbreviations = {};

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
  
  // CSV import elements
  csvFileInput = document.getElementById('csv-file');
  importBtn = document.getElementById('import-btn');
  downloadTemplateBtn = document.getElementById('download-template-btn');
  exportBtn = document.getElementById('export-btn');
  importMessageContainer = document.getElementById('import-message-container');
  overwriteDuplicatesCheckbox = document.getElementById('overwrite-duplicates');
  importProgressDiv = document.getElementById('import-progress');
  progressBar = document.getElementById('progress-bar');
  progressText = document.getElementById('progress-text');
  
  // Reset elements
  resetBtn = document.getElementById('reset-btn');
  resetMessageContainer = document.getElementById('reset-message-container');
  
  // Search elements
  searchInput = document.getElementById('search-input');
  noResultsDiv = document.getElementById('no-results');
  
  // Menu elements
  listMenuBtn = document.getElementById('list-menu-btn');
  listMenu = document.getElementById('list-menu');
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
  
  // CSV import/export event listeners
  csvFileInput.addEventListener('change', handleFileSelection);
  importBtn.addEventListener('click', importCSV);
  downloadTemplateBtn.addEventListener('click', downloadTemplate);
  
  // Reset event listener
  resetBtn.addEventListener('click', resetAllAbbreviations);
  
  // Search event listener
  searchInput.addEventListener('input', handleSearch);
  
  // Menu event listeners
  listMenuBtn.addEventListener('click', toggleListMenu);
  exportBtn.addEventListener('click', handleExportClick);
  
  // Close menu when clicking outside
  document.addEventListener('click', (event) => {
    if (!listMenuBtn.contains(event.target) && !listMenu.contains(event.target)) {
      listMenu.classList.add('hidden');
    }
  });
}

// Storage functions
async function loadAbbreviations() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const userAbbreviations = result[STORAGE_KEY] || {};
    
    // Store globally for search functionality
    allAbbreviations = userAbbreviations;
    
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
    noResultsDiv.classList.add('hidden');
    abbreviationsContainer.innerHTML = '';
    return;
  }
  
  emptyStateDiv.classList.add('hidden');
  noResultsDiv.classList.add('hidden');
  
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
      // Update global storage for search
      allAbbreviations = userAbbreviations;
      showMessage('Abbreviation added successfully!', 'success');
      clearForm();
      displayAbbreviations(userAbbreviations);
    }
  });
}

async function deleteAbbreviation(abbreviation) {
  if (!abbreviation) {
    console.error('No abbreviation provided to delete function');
    showMessage('Error: No abbreviation specified', 'error');
    return;
  }
  
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const userAbbreviations = result[STORAGE_KEY] || {};
    
    if (!userAbbreviations[abbreviation]) {
      console.error('Abbreviation not found:', abbreviation);
      showMessage('Error: Abbreviation not found', 'error');
      return;
    }
    
    delete userAbbreviations[abbreviation];
    
    const success = await saveAbbreviations(userAbbreviations);
    if (success) {
      // Update global storage for search
      allAbbreviations = userAbbreviations;
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

// CSV Import Functions
function handleFileSelection() {
  const file = csvFileInput.files[0];
  importBtn.disabled = !file;
  
  if (file && !file.name.toLowerCase().endsWith('.csv')) {
    showImportMessage('Please select a CSV file', 'error');
    importBtn.disabled = true;
  } else if (file) {
    showImportMessage('', 'clear');
  }
}

function downloadTemplate() {
  const templateData = 'abbreviation,meaning,description\nAPI,Application Programming Interface,A set of protocols for building software\nHTML,HyperText Markup Language,The standard markup language for web pages\nCSS,Cascading Style Sheets,Style sheet language for web presentation';
  
  const blob = new Blob([templateData], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'abbreviations-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportCSV() {
  try {
    // Get current abbreviations from storage
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const userAbbreviations = result[STORAGE_KEY] || {};
    
    const abbreviationKeys = Object.keys(userAbbreviations);
    
    if (abbreviationKeys.length === 0) {
      showImportMessage('No abbreviations to export', 'error');
      return;
    }
    
    // Generate CSV content
    let csvContent = 'abbreviation,meaning,description\n';
    
    abbreviationKeys.sort().forEach(key => {
      const data = userAbbreviations[key];
      const meaning = typeof data === 'string' ? data : data.meaning;
      const description = typeof data === 'object' ? (data.description || '') : '';
      
      // Escape quotes and wrap fields that contain commas or quotes
      const escapedAbbreviation = escapeCSVField(key);
      const escapedMeaning = escapeCSVField(meaning);
      const escapedDescription = escapeCSVField(description);
      
      csvContent += `${escapedAbbreviation},${escapedMeaning},${escapedDescription}\n`;
    });
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Generate filename with current date
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    a.download = `abbreviations-export-${dateStr}.csv`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showImportMessage(`Successfully exported ${abbreviationKeys.length} abbreviations!`, 'success');
    
  } catch (error) {
    console.error('Export error:', error);
    showImportMessage('Error exporting abbreviations', 'error');
  }
}

function escapeCSVField(field) {
  if (!field) return '';
  
  // Convert to string and trim
  const str = String(field).trim();
  
  // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  
  return str;
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const result = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV parsing - handles basic cases
    const columns = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        columns.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    columns.push(current.trim());
    
    // Remove quotes from columns
    const cleanColumns = columns.map(col => col.replace(/^"|"$/g, ''));
    
    if (cleanColumns.length >= 2) {
      const [abbreviation, meaning, description = ''] = cleanColumns;
      if (abbreviation && meaning) {
        result.push({
          abbreviation: abbreviation.toUpperCase(),
          meaning: meaning.trim(),
          description: description.trim()
        });
      }
    }
  }
  
  return result;
}

function validateImportData(data) {
  const errors = [];
  const validData = [];
  
  data.forEach((item, index) => {
    const lineNumber = index + 1;
    
    if (!item.abbreviation) {
      errors.push(`Line ${lineNumber}: Missing abbreviation`);
      return;
    }
    
    if (!item.meaning) {
      errors.push(`Line ${lineNumber}: Missing meaning`);
      return;
    }
    
    if (item.abbreviation.length > 20) {
      errors.push(`Line ${lineNumber}: Abbreviation too long (max 20 characters)`);
      return;
    }
    
    if (item.meaning.length > 100) {
      errors.push(`Line ${lineNumber}: Meaning too long (max 100 characters)`);
      return;
    }
    
    validData.push(item);
  });
  
  return { errors, validData };
}

async function importCSV() {
  const file = csvFileInput.files[0];
  if (!file) {
    showImportMessage('Please select a CSV file', 'error');
    return;
  }
  
  try {
    showImportProgress(true);
    updateProgress(0, 'Reading file...');
    
    const text = await readFileAsText(file);
    updateProgress(20, 'Parsing CSV...');
    
    const parsedData = parseCSV(text);
    if (parsedData.length === 0) {
      throw new Error('No valid data found in CSV file');
    }
    
    updateProgress(40, 'Validating data...');
    const { errors, validData } = validateImportData(parsedData);
    
    if (errors.length > 0) {
      throw new Error('Validation errors:\n' + errors.join('\n'));
    }
    
    updateProgress(60, 'Loading existing abbreviations...');
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const existingAbbreviations = result[STORAGE_KEY] || {};
    
    const overwrite = overwriteDuplicatesCheckbox.checked;
    let imported = 0;
    let skipped = 0;
    let overwritten = 0;
    
    updateProgress(80, 'Importing abbreviations...');
    
    validData.forEach(item => {
      const exists = existingAbbreviations[item.abbreviation];
      
      if (exists && !overwrite) {
        skipped++;
      } else {
        existingAbbreviations[item.abbreviation] = {
          meaning: item.meaning,
          description: item.description
        };
        
        if (exists) {
          overwritten++;
        } else {
          imported++;
        }
      }
    });
    
    updateProgress(90, 'Saving to storage...');
    const success = await saveAbbreviations(existingAbbreviations);
    
    if (!success) {
      throw new Error('Failed to save abbreviations');
    }
    
    updateProgress(100, 'Import complete!');
    
    // Show success message
    let message = `Import successful! `;
    if (imported > 0) message += `${imported} new abbreviations added. `;
    if (overwritten > 0) message += `${overwritten} abbreviations updated. `;
    if (skipped > 0) message += `${skipped} duplicates skipped.`;
    
    showImportMessage(message, 'success');
    
    // Reset form
    csvFileInput.value = '';
    importBtn.disabled = true;
    overwriteDuplicatesCheckbox.checked = false;
    
    // Update global storage and refresh the display
    allAbbreviations = existingAbbreviations;
    displayAbbreviations(existingAbbreviations);
    
    setTimeout(() => {
      showImportProgress(false);
    }, 2000);
    
  } catch (error) {
    console.error('Import error:', error);
    showImportMessage(error.message, 'error');
    showImportProgress(false);
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function showImportProgress(show) {
  if (show) {
    importProgressDiv.classList.remove('hidden');
  } else {
    importProgressDiv.classList.add('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = '';
  }
}

function updateProgress(percentage, message) {
  progressBar.style.width = percentage + '%';
  progressText.textContent = message;
}

function showImportMessage(message, type = 'info') {
  if (type === 'clear') {
    importMessageContainer.innerHTML = '';
    return;
  }
  
  importMessageContainer.innerHTML = `<div class="${type}-message">${escapeHtml(message)}</div>`;
  
  // Auto-hide success messages after 5 seconds
  if (type === 'success') {
    setTimeout(() => {
      importMessageContainer.innerHTML = '';
    }, 5000);
  }
}

// Reset Functions
async function resetAllAbbreviations() {
  try {
    showResetMessage('Deleting all abbreviations...', 'info');
    
    // Clear all data from storage
    await chrome.storage.local.set({ [STORAGE_KEY]: {} });
    
    showResetMessage('All abbreviations have been deleted successfully!', 'success');
    
    // Update global storage and refresh the display to show empty state
    allAbbreviations = {};
    displayAbbreviations({});
    
    // Also clear any other message containers
    messageContainer.innerHTML = '';
    importMessageContainer.innerHTML = '';
    
  } catch (error) {
    console.error('Error resetting abbreviations:', error);
    showResetMessage('Error deleting abbreviations. Please try again.', 'error');
  }
}

function showResetMessage(message, type = 'info') {
  resetMessageContainer.innerHTML = `<div class="${type}-message">${escapeHtml(message)}</div>`;
  
  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      resetMessageContainer.innerHTML = '';
    }, 3000);
  }
}

// Search Functions
function handleSearch() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  
  if (!searchTerm) {
    // Show all abbreviations when search is empty
    displayAbbreviations(allAbbreviations);
    return;
  }
  
  // Filter abbreviations based on search term
  const filteredAbbreviations = {};
  
  Object.keys(allAbbreviations).forEach(key => {
    const data = allAbbreviations[key];
    const meaning = typeof data === 'string' ? data : data.meaning;
    const description = typeof data === 'object' ? data.description : '';
    
    // Search in abbreviation, meaning, and description
    const searchableText = [
      key.toLowerCase(),
      meaning.toLowerCase(),
      description.toLowerCase()
    ].join(' ');
    
    if (searchableText.includes(searchTerm)) {
      filteredAbbreviations[key] = data;
    }
  });
  
  // Show filtered results or no results message
  if (Object.keys(filteredAbbreviations).length === 0) {
    showNoResults();
  } else {
    displayAbbreviations(filteredAbbreviations);
  }
}

function showNoResults() {
  loadingDiv.classList.add('hidden');
  emptyStateDiv.classList.add('hidden');
  noResultsDiv.classList.remove('hidden');
  abbreviationsContainer.innerHTML = '';
}

// Menu Functions
function toggleListMenu() {
  listMenu.classList.toggle('hidden');
}

function handleExportClick() {
  // Close the menu first
  listMenu.classList.add('hidden');
  // Then call the export function
  exportCSV();
} 