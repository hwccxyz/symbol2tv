class CryptoProcessor {
    static extractDate(text) {
        // Support two formats: 1. Format with emoji 2. ###YYYYMMDD format
        const emojiMatch = text.match(/(?:🗓️|🗓|:spiral_calendar_pad:)[\s\n]*(\d{8})/);
        const hashMatch = text.match(/###(\d{8})/);
        
        if (emojiMatch) {
            return emojiMatch[1];
        } else if (hashMatch) {
            return hashMatch[1];
        }
        
        throw new Error("Invalid date format. Supported formats:\n1. 🗓️/🗓 YYYYMMDD\n2. ###YYYYMMDD");
    }

    static extractSymbols(text) {
        // Case 1: Simple format (date followed by symbols)
        if (text.match(/###\d{8}\s+[\w\s,]+/)) {
            const allSymbols = new Set();
            // Remove the date part and split the remaining text
            const symbolsPart = text.replace(/###\d{8}/, '').trim();
            
            const symbols = symbolsPart.split(',')
                .map(s => s.trim())
                .filter(s => s && s.length >= 2 && /^[A-Z0-9]+$/.test(s))
                .map(s => `BINANCE:${s}USDT.P`);
            
            symbols.forEach(s => {
                allSymbols.add(s);
                console.log(`Added symbol: ${s}`);
            });
            
            console.log(`Found total ${allSymbols.size} symbols in simple format`);
            return Array.from(allSymbols);
        }

        // Case 2: Format with score categories
        if (text.includes('#90+') || text.includes('#80+') || text.includes('#others')) {
            const allSymbols = new Set();
            const lines = text.split('\n');
            
            for (const line of lines) {
                // Skip empty lines and date lines
                if (!line.trim() || line.startsWith('###')) continue;
                
                // If it's a category line (starts with #), skip it
                if (line.trim().startsWith('#')) continue;
                
                // Process symbols in the line
                const symbols = line.split(',')
                    .map(s => s.trim())
                    .filter(s => s && s.length >= 2 && /^[A-Z0-9]+$/.test(s))
                    .map(s => `BINANCE:${s}USDT.P`);
                
                symbols.forEach(s => {
                    allSymbols.add(s);
                    console.log(`Added symbol: ${s}`);
                });
            }
            
            console.log(`Found total ${allSymbols.size} symbols in categorized format`);
            return Array.from(allSymbols);
        }

        // Case 3: Original formatted data
        if (text.startsWith('###')) {
            const parts = text.split(',');
            if (parts.length > 1) {
                return parts.slice(1)
                    .filter(symbol => symbol.trim())
                    .map(symbol => {
                        const formatted = `BINANCE:${symbol.trim()}USDT.P`;
                        console.log(`Added symbol: ${formatted}`);
                        return formatted;
                    });
            }
        }

        // Case 4: Original unformatted data
        const lines = text.split('\n');
        let firstDate = null;
        const allSymbols = new Set();

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
                    allSymbols.add(formattedSymbol);
                    console.log(`Added symbol: ${formattedSymbol}`);
                }
            }
        }

        console.log(`Using date: ${firstDate}`);
        console.log(`Found total ${allSymbols.size} symbols`);
        
        return Array.from(allSymbols);
    }

    static formatOutput(date, symbols) {
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
            
            // If not starting with ###, treat entire input as single record
            if (!inputText.trim().startsWith('###')) {
                try {
                    const date = this.extractDate(inputText);
                    const symbols = this.extractSymbols(inputText);
                    console.log('Extracted date:', date); // Debug info
                    console.log('Extracted symbols:', symbols); // Debug info
                    
                    if (symbols && symbols.length > 0) {
                        const output = this.formatOutput(date, symbols);
                        results.push({ output, date });
                    }
                } catch (error) {
                    console.error('Error processing input:', error); // Debug info
                    throw error;
                }
            } else {
                // Handle multiple records
                for (const record of records) {
                    if (!record || record.trim() === '') continue;
                    
                    try {
                        const date = this.extractDate(record);
                        const symbols = this.extractSymbols(record);
                        
                        if (symbols && symbols.length > 0) {
                            const output = this.formatOutput(date, symbols);
                            results.push({ output, date });
                        }
                    } catch (recordError) {
                        console.error('Error processing single record:', recordError);
                        continue;
                    }
                }
            }
            
            if (results.length === 0) {
                throw new Error("No valid trading data found");
            }
            
            return { outputs: results, warning: "" };
        } catch (e) {
            console.error('Error during processing:', e); // Debug info
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

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
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
        const customData = history.slice(0, days);
        if (customData.length === 0) {
            alert('Not enough historical data');
            return;
        }
        const combinedOutput = customData.map(item => item.output).join('\n');
        const startDate = customData[customData.length - 1].date;
        const endDate = customData[0].date;
        downloadFile(`tv_${startDate}-${endDate}.txt`, combinedOutput);
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


