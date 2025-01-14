class CryptoProcessor {
    static extractDate(text) {
        // Support three formats: 
        // 1. Format with emoji 
        // 2. ###YYYYMMDD format
        // 3. ###YYYYMMDD HH:MM format
        const emojiMatch = text.match(/(?:🗓️|🗓|:spiral_calendar_pad:)[\s\n]*(\d{8})/);
        const hashMatchWithTime = text.match(/###(\d{8})\s+\d{2}:\d{2}/);
        const hashMatch = text.match(/###(\d{8})/);
        
        if (emojiMatch) {
            return emojiMatch[1];
        } else if (hashMatchWithTime) {
            return hashMatchWithTime[1];
        } else if (hashMatch) {
            return hashMatch[1];
        }
        
        throw new Error("Invalid date format. Supported formats:\n1. 🗓️/🗓 YYYYMMDD\n2. ###YYYYMMDD\n3. ###YYYYMMDD HH:MM");
    }

    static extractSymbols(text) {
        // Case 1: Categorized format with ###90+, ###80+, etc.
        if (text.includes('###') && text.match(/###\d+\+/)) {
            const lines = text.split('\n');
            const allSymbols = [];
            
            for (const line of lines) {
                // Skip empty lines, date lines, and category headers
                if (!line.trim() || 
                    line.match(/###\d{8}/) || 
                    line.match(/^###(?:\d+\+|others)$/)) continue;
                
                // Get symbols from the line
                const symbols = line.split(',')
                    .map(s => s.trim())
                    .filter(s => s && s.startsWith('BINANCE:') && s.endsWith('USDT.P'));
                
                symbols.forEach(s => {
                    if (!allSymbols.includes(s)) {
                        allSymbols.push(s);
                        console.log(`Added symbol: ${s}`);
                    }
                });
            }
            
            console.log(`Found total ${allSymbols.length} symbols in categorized format`);
            return allSymbols;
        }

        // Case 2: Pre-formatted TradingView symbols
        if (text.includes('BINANCE:') && text.includes('USDT.P')) {
            const lines = text.split('\n');
            const allSymbols = [];
            
            for (const line of lines) {
                if (!line.trim()) continue;
                
                // Get symbols from the line
                const symbols = line.split(',')
                    .map(s => s.trim())
                    .filter(s => s && s.startsWith('BINANCE:') && s.endsWith('USDT.P'));
                
                symbols.forEach(s => {
                    if (!allSymbols.includes(s)) {
                        allSymbols.push(s);
                        console.log(`Added symbol: ${s}`);
                    }
                });
            }
            
            console.log(`Found total ${allSymbols.length} pre-formatted symbols`);
            return allSymbols;
        }

        // Case 3: Formats starting with ### (Simple date format, Categorized format, Original formatted data)
        if (text.startsWith('###')) {
            const allSymbols = [];  // Changed from Set to Array
            const lines = text.split('\n');
            
            for (const line of lines) {
                // Skip empty lines and date lines
                if (!line.trim() || line.startsWith('###')) continue;
                
                // Process line content
                let processLine = line;
                
                // If line starts with category (#), remove the category part
                if (line.trim().startsWith('#')) {
                    const categoryParts = line.split(',');
                    // Remove the category part (first element)
                    processLine = categoryParts.slice(1).join(',');
                }
                
                // Process symbols in the line
                const symbols = processLine.split(',')
                    .map(s => s.trim())
                    .filter(s => s && s.length >= 2 && /^[A-Z0-9]+$/.test(s))
                    .map(s => `BINANCE:${s}USDT.P`);
                
                symbols.forEach(s => {
                    if (!allSymbols.includes(s)) {
                        allSymbols.push(s);
                        console.log(`Added symbol: ${s}`);
                    }
                });
            }
            
            console.log(`Found total ${allSymbols.length} symbols in ### format`);
            return allSymbols;
        }

        // Case 4: Original unformatted data (with emoji)
        const lines = text.split('\n');
        let firstDate = null;
        const allSymbols = [];  // Changed from Set to Array

        // First find the first date
        for (const line of lines) {
            const dateMatch = line.match(/(?:🗓️|🗓|:spiral_calendar_pad:)[\s\n]*(\d{8})/);
            if (dateMatch) {
                firstDate = dateMatch[1];
                break;  // Only take the first date
            }
        }

        if (!firstDate) return [];

        // Process all lines and collect all symbols
        for (const line of lines) {
            // Clean line content
            let cleanLine = line
                .replace(/[🔸🗓️]|:[a-z_]+:|族群：|強勢|次強勢|標的篩選/g, '')
                .replace(/[，]/g, ',')
                .trim();

            if (!cleanLine) continue;

            // Split and process each trading pair
            const pairs = cleanLine.split(/[,\s]+/)
                .map(p => p.trim())
                .filter(p => p && 
                       p !== 'RS' && 
                       !/^###\d{8}$/.test(p) && 
                       !/^\d{8}$/.test(p));  // Exclude pure numbers (dates)

            for (const pair of pairs) {
                if (pair && 
                    pair.length >= 2 && 
                    /^[A-Z0-9]+$/.test(pair)) {
                    const formattedSymbol = `BINANCE:${pair}USDT.P`;
                    if (!allSymbols.includes(formattedSymbol)) {
                        allSymbols.push(formattedSymbol);
                        console.log(`Added symbol: ${formattedSymbol}`);
                    }
                }
            }
        }

        console.log(`Using date: ${firstDate}`);
        console.log(`Found total ${allSymbols.length} symbols`);
        
        return allSymbols;
    }

    static formatOutput(date, symbols) {
        // Remove sorting, just join the symbols with commas
        return `###${date},${symbols.join(',')}`;
    }

    static splitMultipleRecords(text) {
        // Use regex to find all records starting with ###
        const records = text.split(/(?=###\d{8})/);
        // Filter out empty records and trim whitespace
        return records
            .map(record => record.trim())
            .filter(record => record && record.startsWith('###'));
    }

    static processInput(inputText) {
        try {
            const records = this.splitMultipleRecords(inputText);
            const results = [];
            
            // If input contains multiple records with ###YYYYMMDD format and pre-formatted symbols
            if (records.length > 0 && records.every(record => 
                record.match(/^###\d{8}/) && 
                !record.match(/###\d+\+/) &&  // Not a categorized format
                record.includes('BINANCE:') && 
                record.includes('USDT.P'))) {
                // Keep original format for each record
                records.forEach(record => {
                    try {
                        const date = this.extractDate(record);
                        // For pre-formatted records, just clean up the format
                        const cleanedRecord = record
                            .split('\n')
                            .map(line => line.trim())
                            .filter(line => line)
                            .join(',')
                            .replace(/###\d{8}(?:\s+\d{2}:\d{2})?/, `###${date}`);
                        results.push({ output: cleanedRecord, date });
                    } catch (recordError) {
                        console.error('Error processing record:', recordError);
                    }
                });
            }
            // Handle categorized format
            else if (inputText.match(/###\d+\+/)) {
                try {
                    const date = this.extractDate(inputText);
                    const symbols = this.extractSymbols(inputText);
                    
                    if (symbols && symbols.length > 0) {
                        const output = this.formatOutput(date, symbols);
                        results.push({ output, date });
                    }
                } catch (error) {
                    console.error('Error processing categorized input:', error);
                    throw error;
                }
            }
            // Handle other existing formats
            else if (!inputText.trim().startsWith('###')) {
                try {
                    const date = this.extractDate(inputText);
                    const symbols = this.extractSymbols(inputText);
                    console.log('Extracted date:', date);
                    console.log('Extracted symbols:', symbols);
                    
                    if (symbols && symbols.length > 0) {
                        const output = this.formatOutput(date, symbols);
                        results.push({ output, date });
                    }
                } catch (error) {
                    console.error('Error processing input:', error);
                    throw error;
                }
            } else {
                // Handle single record with ### format
                try {
                    const date = this.extractDate(inputText);
                    const symbols = this.extractSymbols(inputText);
                    
                    if (symbols && symbols.length > 0) {
                        const output = this.formatOutput(date, symbols);
                        results.push({ output, date });
                    }
                } catch (recordError) {
                    console.error('Error processing record:', recordError);
                }
            }
            
            if (results.length === 0) {
                throw new Error("No valid trading data found");
            }
            
            return { outputs: results, warning: "" };
        } catch (e) {
            console.error('Error during processing:', e);
            return { outputs: [], warning: `Error: ${e.message}` };
        }
    }
}

// Handle form submission
const form = document.getElementById('processorForm');
const historyList = document.getElementById('historyList');
const downloadLatestBtn = document.getElementById('downloadLatest');
const downloadCustomBtn = document.getElementById('downloadCustom');
const downloadDaysInput = document.getElementById('downloadDays');

// Load history from localStorage
let history = JSON.parse(localStorage.getItem('history') || '[]');
updateHistoryDisplay();

const fileInput = document.getElementById('fileInput');
fileInput.accept = '.txt';

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        if (!file.name.toLowerCase().endsWith('.txt')) {
            alert('Please upload a text (.txt) file only');
            fileInput.value = '';
            return;
        }
        try {
            const text = await file.text();
            document.getElementById('inputText').value = text;
        } catch (error) {
            alert('Error reading file: ' + error.message);
        }
    }
});

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputText = document.getElementById('inputText').value;

    if (!inputText) {
        alert('Please enter text content or upload a file');
        return;
    }

    const { outputs, warning } = CryptoProcessor.processInput(inputText);

    if (warning) {
        alert(warning);
    }

    if (outputs.length > 0) {
        // Add each record to history separately
        outputs.forEach(({ output, date }) => {
            // Check if record with same date exists
            const existingIndex = history.findIndex(item => item.date === date);
            if (existingIndex !== -1) {
                // Update existing record
                history[existingIndex] = { date, output };
            } else {
                // Add new record
                history.unshift({ date, output });
            }
        });
        
        localStorage.setItem('history', JSON.stringify(history));
        updateHistoryDisplay();
        form.reset();
        fileInput.value = '';
    }
});

function formatDate(dateString) {
    // Convert YYYYMMDD format to YYYY-MM-DD
    return `${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6, 8)}`;
}

function updateHistoryDisplay() {
    // Sort history records first
    history.sort((a, b) => parseInt(b.date) - parseInt(a.date));
    
    historyList.innerHTML = '';
    downloadLatestBtn.disabled = history.length === 0;
    downloadCustomBtn.disabled = history.length === 0;

    history.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        const formattedDate = formatDate(item.date);
        const highlightedDate = `<span class="date-highlight">${formattedDate}</span>`;
        
        // Improve symbol highlighting logic
        const highlightedOutput = item.output.replace(
            /(###\d{8},|BINANCE:)([A-Z0-9]+)(USDT\.P)/g, 
            (match, prefix, symbol, suffix) => {
                if (prefix === '###' + item.date + ',') {
                    return match;
                }
                return `${prefix}<span class="crypto-highlight">${symbol}</span>${suffix}`;
            }
        );

        historyItem.innerHTML = `
            <div class="history-item-header">
                <strong>${highlightedDate}</strong>
                <button class="delete-btn" onclick="deleteHistory(${index})">刪除</button>
            </div>
            <pre><code>${highlightedOutput}</code></pre>
        `;
        historyList.appendChild(historyItem);
    });
}

// Add to window object for onclick handler
window.deleteHistory = function(index) {
    history.splice(index, 1);
    localStorage.setItem('history', JSON.stringify(history));
    updateHistoryDisplay();
};

downloadLatestBtn.addEventListener('click', () => {
    if (history.length > 0) {
        downloadFile(`tv_${history[0].date}.txt`, history[0].output);
    }
});

downloadCustomBtn.addEventListener('click', () => {
    if (history.length > 0) {
        const days = parseInt(downloadDaysInput.value) || 14;
        if (days < 1 || days > 365) {
            alert('Please enter a valid number of days (1-365)');
            return;
        }
        
        // Check if we have enough data
        if (history.length < days) {
            const proceed = confirm(`You requested ${days} days of data, but only ${history.length} days are available. Do you want to proceed with the available ${history.length} days?`);
            if (!proceed) {
                return;
            }
        }
        
        const customData = history.slice(0, Math.min(days, history.length));
        if (customData.length === 0) {
            alert('No historical data available');
            return;
        }
        
        const combinedOutput = customData.map(item => item.output).join('\n');
        const startDate = customData[customData.length - 1].date;
        const endDate = customData[0].date;
        downloadFile(`tv_${startDate}-${endDate}.txt`, combinedOutput);
    } else {
        alert('No historical data available');
    }
});

function downloadFile(filename, content) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

// Add clear history functionality
document.getElementById('clearHistory').addEventListener('click', () => {
    if (confirm('確定要清除所有歷史記錄嗎？此操作無法復原。')) {
        localStorage.removeItem('history');
        history = [];
        updateHistoryDisplay();
    }
});