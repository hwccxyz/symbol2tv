class CryptoProcessor {
    static extractDate(text) {
        // 支援兩種格式：1. 帶有 emoji 的格式 2. ###YYYYMMDD 格式
        const emojiMatch = text.match(/(?:🗓️|🗓|:spiral_calendar_pad:)[\s\n]*(\d{8})/);
        const hashMatch = text.match(/###(\d{8})/);
        
        if (emojiMatch) {
            return emojiMatch[1];
        } else if (hashMatch) {
            return hashMatch[1];
        }
        
        throw new Error("無效的日期格式。支援的格式：\n1. 🗓️/🗓 YYYYMMDD\n2. ###YYYYMMDD");
    }

    static extractSymbols(text) {
        const lines = text.split('\n');
        const symbols = [];
        const seenSymbols = new Set();
        let currentDate = null;
        let symbolsForCurrentDate = new Set();

        for (const line of lines) {
            // 檢查是否有新的日期標記
            const dateMatch = line.match(/(?:🗓️|🗓|:spiral_calendar_pad:)[\s\n]*(\d{8})|###(\d{8})/);
            if (dateMatch) {
                // 如果找到新日期，且與當前日期不同，則更新 currentDate
                const newDate = dateMatch[1] || dateMatch[2];
                if (newDate !== currentDate) {
                    // 將之前日期的符號加入結果
                    if (currentDate && symbolsForCurrentDate.size > 0) {
                        symbols.push(...Array.from(symbolsForCurrentDate));
                    }
                    currentDate = newDate;
                    symbolsForCurrentDate = new Set();
                }
            }

            // 移除表情符號和特殊字符，保留逗號
            const cleanLine = line.replace(/[🔸🗓️]|:[a-z_]+:/g, '').trim();
            
            // 分割並處理每個交易對
            const pairs = cleanLine.split(/[,，\s]+/).filter(p => p.trim());  // 添加中文逗號支援
            
            for (const pair of pairs) {
                const trimmedPair = pair.trim();
                
                // 跳過空字串或無效輸入
                if (!trimmedPair || trimmedPair === '#N/A' || /^###\d{8}$/.test(trimmedPair)) continue;
                
                // 如果是已格式化的交易對，直接使用
                if (trimmedPair.startsWith('BINANCE:') && trimmedPair.endsWith('USDT.P')) {
                    symbolsForCurrentDate.add(trimmedPair);
                    continue;
                }
                
                // 處理未格式化的交易對
                let symbolPart = trimmedPair;
                if (trimmedPair.includes('：') || trimmedPair.includes(':')) {
                    const parts = trimmedPair.split(/[：:]/);
                    symbolPart = parts[parts.length - 1];
                }

                const cleanSymbol = symbolPart.trim();

                // 驗證符號有效性
                if (cleanSymbol && 
                    cleanSymbol.length >= 2 &&  // 添加最小長度限制
                    !/[：:()[\]{}]/.test(cleanSymbol) && 
                    !/[一-鿿]/.test(cleanSymbol) &&
                    /^[A-Z]+$/.test(cleanSymbol) &&  // 修改為只允許大寫字母
                    !/^\d+$/.test(cleanSymbol)) {
                    
                    const formattedSymbol = `BINANCE:${cleanSymbol}USDT.P`;
                    symbolsForCurrentDate.add(formattedSymbol);
                }
            }
        }

        // 處理最後一組符號
        if (currentDate && symbolsForCurrentDate.size > 0) {
            symbols.push(...Array.from(symbolsForCurrentDate));
        }

        return symbols;
    }

    static formatOutput(date, symbols) {
        return `###${date},${symbols.join(',')}`;
    }

    static splitMultipleRecords(text) {
        // 分割多筆資料
        const records = text.split(/\n(?=###)/);
        return records.map(record => record.trim()).filter(record => record);
    }

    static processInput(inputText) {
        try {
            const records = this.splitMultipleRecords(inputText);
            const results = [];
            
            for (const record of records) {
                const date = this.extractDate(record);
                const symbols = this.extractSymbols(record);
                const output = this.formatOutput(date, symbols);
                results.push({ output, date });
            }
            
            // 如果沒有有效記錄，拋出錯誤
            if (results.length === 0) {
                throw new Error("沒有找到有效的交易數據");
            }
            
            return { outputs: results, warning: "" };
        } catch (e) {
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
            alert('讀取文件時發生錯誤：' + error.message);
        }
    }
});

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputText = document.getElementById('inputText').value;

    if (!inputText) {
        alert('請輸入文本內容或上傳文件');
        return;
    }

    const { outputs, warning } = CryptoProcessor.processInput(inputText);

    if (warning) {
        alert(warning);
    }

    if (outputs.length > 0) {
        // 將每筆資料分別加入歷史記錄
        outputs.forEach(({ output, date }) => {
            // 檢查是否已存在相同日期的記錄
            const existingIndex = history.findIndex(item => item.date === date);
            if (existingIndex !== -1) {
                // 更新既有記錄
                history[existingIndex] = { date, output };
            } else {
                // 新增記錄
                history.unshift({ date, output });
            }
        });
        
        localStorage.setItem('history', JSON.stringify(history));
        updateHistoryDisplay();
        form.reset();
        fileInput.value = '';
    }
});

function updateHistoryDisplay() {
    historyList.innerHTML = '';
    downloadLatestBtn.disabled = history.length === 0;
    downloadCustomBtn.disabled = history.length === 0;

    history.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        // 高亮顯示日期和加密貨幣符號
        const highlightedDate = `<span class="date-highlight">${item.date}</span>`;
        const highlightedOutput = item.output.replace(
            /(BINANCE:)([A-Z]+)(USDT\.P)/g, 
            '$1<span class="crypto-highlight">$2</span>$3'
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
            alert('請輸入有效的天數（1-365天）');
            return;
        }
        const customData = history.slice(0, days);
        if (customData.length === 0) {
            alert('沒有足夠的歷史資料');
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
