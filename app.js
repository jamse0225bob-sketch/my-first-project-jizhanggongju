/**
 * Phase 2 & 3: Foundational Logic, PWA, and Feature Implementation
 */

// --- T007: PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered'))
            .catch(err => console.error('SW Registration Failed', err));
    });
}

// --- T008: LocalStorage Wrapper ---
const STORAGE_KEY = 'accounting_records';

const Storage = {
    getRecords() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            console.error('Failed to parse storage', e);
            return [];
        }
    },
    saveRecord(record) {
        const records = this.getRecords();
        records.push({
            id: Date.now().toString(),
            ...record,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        return records;
    },
    deleteRecord(id) {
        const records = this.getRecords().filter(r => r.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        return records;
    }
};

// --- T009: State Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('App Initialized');
    renderApp();
    initForm();
});

function renderApp() {
    const records = Storage.getRecords();
    updateSummary(records);
    renderList(records);
    renderHistory(records);
}

function initForm() {
    const form = document.getElementById('record-form');
    const amountInput = document.getElementById('amount');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSave();
    });

    // 支持回车一键保存 (T006/T012)
    const inputs = [amountInput, document.getElementById('remark')];
    inputs.forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
            }
        });
    });
}

function handleSave() {
    const amountInput = document.getElementById('amount');
    const typeSelect = document.getElementById('type');
    const remarkInput = document.getElementById('remark');
    const categoryInput = document.querySelector('input[name="category"]:checked');

    const amount = parseFloat(amountInput.value);
    
    if (isNaN(amount) || amount <= 0) {
        alert('请输入有效金额');
        return;
    }

    const newRecord = {
        amount: amount.toFixed(2),
        type: typeSelect.value,
        category: categoryInput.value,
        remark: remarkInput.value.trim()
    };

    Storage.saveRecord(newRecord);
    
    // 实时更新 (T017 / T020)
    renderApp();
    
    // 重置 UI (T014)
    amountInput.value = '';
    remarkInput.value = '';
    amountInput.focus();
}

/**
 * Update the Monthly Summary UI (T016/T017)
 */
function updateSummary(records) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyRecords = records.filter(r => {
        const d = new Date(r.timestamp);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const income = monthlyRecords
        .filter(r => r.type === 'income')
        .reduce((sum, r) => sum + parseFloat(r.amount), 0);
    
    const expense = monthlyRecords
        .filter(r => r.type === 'expense')
        .reduce((sum, r) => sum + parseFloat(r.amount), 0);

    document.getElementById('total-income').textContent = income.toFixed(2);
    document.getElementById('total-expense').textContent = expense.toFixed(2);
}

/**
 * Render current month's record list (T019/T020)
 */
function renderList(records) {
    const listContainer = document.getElementById('record-list');
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyRecords = records
        .filter(r => {
            const d = new Date(r.timestamp);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (monthlyRecords.length === 0) {
        listContainer.innerHTML = '<p class="empty-msg">本月暂无明细</p>';
        return;
    }

    listContainer.innerHTML = monthlyRecords.map(r => `
        <div class="record-item" role="listitem">
            <div class="record-info">
                <div>
                    <span class="record-category">${r.category}</span>
                    <span class="record-meta">${new Date(r.timestamp).toLocaleDateString('zh-CN', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</span>
                </div>
                <div class="record-meta">${r.remark || ''}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
                <span class="record-amount ${r.type === 'expense' ? 'amount-expense' : 'amount-income'}">
                    ${r.type === 'expense' ? '-' : '+'}${r.amount}
                </span>
                <button class="delete-btn" onclick="window.confirmDelete('${r.id}')" aria-label="删除记录">删除</button>
            </div>
        </div>
    `).join('');
}

// 暴露全局删除函数以供 onclick 调用 (T020)
window.confirmDelete = (id) => {
    if (confirm('确定要删除这笔记录吗？')) {
        Storage.deleteRecord(id);
        renderApp();
    }
};

/**
 * Render history monthly summaries (T022/T023)
 */
function renderHistory(records) {
    const historyContent = document.getElementById('history-content');
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;

    // 按月分组
    const groups = records.reduce((acc, r) => {
        const d = new Date(r.timestamp);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (key === currentMonthKey) return acc; // 排除当月

        if (!acc[key]) {
            acc[key] = { label: `${d.getFullYear()}年${d.getMonth() + 1}月`, income: 0, expense: 0 };
        }

        const amt = parseFloat(r.amount);
        if (r.type === 'income') acc[key].income += amt;
        else acc[key].expense += amt;

        return acc;
    }, {});

    const groupArray = Object.values(groups).sort((a, b) => {
        // 简单按标签字符倒序，实际应用中建议存储 timestamp 排序
        return b.label.localeCompare(a.label);
    });

    if (groupArray.length === 0) {
        historyContent.innerHTML = '<p class="empty-msg">暂无历史月份数据</p>';
        return;
    }

    historyContent.innerHTML = groupArray.map(g => `
        <div class="history-item">
            <span class="history-month">${g.label}</span>
            <div>
                <span class="amount-income">+${g.income.toFixed(2)}</span>
                <span style="margin: 0 8px;">/</span>
                <span class="amount-expense">-${g.expense.toFixed(2)}</span>
            </div>
        </div>
    `).join('');
}

export { Storage, updateSummary };