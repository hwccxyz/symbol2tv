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
        // 第一種情況：格式化數據
        if (text.startsWith('###')) {
            const parts = text.split(',');
            if (parts.length > 1) {
                return parts.slice(1).filter(symbol => symbol.trim());
            }
        }

        // 第二種情況：非格式化數據
        const lines = text.split('\n');
        let firstDate = null;
        const allSymbols = new Set();

        // 首先尋找第一個日期
        for (const line of lines) {
            const dateMatch = line.match(/(?:🗓️|🗓|:spiral_calendar_pad:)[\s\n]*(\d{8})/);
            if (dateMatch) {
                firstDate = dateMatch[1];
                break;  // 只取第一個日期
            }
        }

        if (!firstDate) return [];

        // 處理所有行，收集所有符號
        for (const line of lines) {
            // 清理行內容
            let cleanLine = line
                .replace(/[🔸🗓️]|:[a-z_]+:|族群：|強勢|次強勢|標的篩選/g, '')
                .replace(/[，]/g, ',')
                .trim();

            if (!cleanLine) continue;

            // 分割並處理每個交易對
            const pairs = cleanLine.split(/[,\s]+/)
                .map(p => p.trim())
                .filter(p => p && 
                       p !== 'RS' && 
                       !/^###\d{8}$/.test(p) && 
                       !/^\d{8}$/.test(p));  // 排除純數字（日期）

            for (const pair of pairs) {
                if (pair && 
                    pair.length >= 2 && 
                    /^[A-Z0-9]+$/.test(pair)) {
                    const formattedSymbol = `BINANCE:${pair}USDT.P`;
                    allSymbols.add(formattedSymbol);
                    console.log(`添加符號: ${formattedSymbol}`);
                }
            }
        }

        console.log(`使用日期: ${firstDate}`);
        console.log(`總共找到 ${allSymbols.size} 個符號`);
        
        return Array.from(allSymbols);
    }

    static formatOutput(date, symbols) {
        return `###${date},${symbols.join(',')}`;
    }

    static splitMultipleRecords(text) {
        // 使用正則表達式找出所有以 ### 開頭的記錄
        const records = text.split(/(?=###\d{8})/);
        // 過濾掉空記錄並去除前後空白
        return records
            .map(record => record.trim())
            .filter(record => record && record.startsWith('###'));
    }

    static processInput(inputText) {
        try {
            const records = this.splitMultipleRecords(inputText);
            const results = [];
            
            // 如果不是以 ### 開頭的格式，將整個輸入視為單個記錄
            if (!inputText.trim().startsWith('###')) {
                try {
                    const date = this.extractDate(inputText);
                    const symbols = this.extractSymbols(inputText);
                    console.log('提取的日期:', date); // 調試信息
                    console.log('提取的符號:', symbols); // 調試信息
                    
                    if (symbols && symbols.length > 0) {
                        const output = this.formatOutput(date, symbols);
                        results.push({ output, date });
                    }
                } catch (error) {
                    console.error('處理輸入時發生錯誤:', error); // 調試信息
                    throw error;
                }
            } else {
                // 處理多個記錄的情況
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
                        console.error('處理單筆記錄時發生錯���:', recordError);
                        continue;
                    }
                }
            }
            
            if (results.length === 0) {
                throw new Error("沒有找到有效的交易數據");
            }
            
            return { outputs: results, warning: "" };
        } catch (e) {
            console.error('處理過程中發生錯誤:', e); // 調試信息
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

function formatDate(dateString) {
    // 將 YYYYMMDD 格式轉換為 YYYY-MM-DD
    return `${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6, 8)}`;
}

function updateHistoryDisplay() {
    // 首先對歷史記錄進行排序
    history.sort((a, b) => parseInt(b.date) - parseInt(a.date));
    
    historyList.innerHTML = '';
    downloadLatestBtn.disabled = history.length === 0;
    downloadCustomBtn.disabled = history.length === 0;

    history.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        // 使用新的日期格式
        const formattedDate = formatDate(item.date);
        const highlightedDate = `<span class="date-highlight">${formattedDate}</span>`;
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


