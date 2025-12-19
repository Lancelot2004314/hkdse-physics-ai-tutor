/**
 * HKDSE Physics AI Tutor - Admin Panel
 */

// State
let currentUser = null;
let usersPage = 1;
let historyPage = 1;
let deleteTarget = null;

// DOM Elements
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const adminMain = document.getElementById('adminMain');
const adminEmail = document.getElementById('adminEmail');

// Stats elements
const totalUsers = document.getElementById('totalUsers');
const todayUsers = document.getElementById('todayUsers');
const totalHistory = document.getElementById('totalHistory');
const todayHistory = document.getElementById('todayHistory');
const deepseekTokens = document.getElementById('deepseekTokens');
const todayDeepseek = document.getElementById('todayDeepseek');
const qwenTokens = document.getElementById('qwenTokens');
const todayQwen = document.getElementById('todayQwen');

// Table elements
const usersTableBody = document.getElementById('usersTableBody');
const historyTableBody = document.getElementById('historyTableBody');
const usersPagination = document.getElementById('usersPagination');
const historyPagination = document.getElementById('historyPagination');

// Modals
const deleteModal = document.getElementById('deleteModal');
const deleteMessageEl = document.getElementById('deleteMessage');
const detailModal = document.getElementById('detailModal');
const detailContent = document.getElementById('detailContent');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Check auth first
    const authResult = await checkAuth();
    if (!authResult) return;

    // Load data
    await Promise.all([
        loadStats(),
        loadUsers(),
        loadHistory()
    ]);

    // Setup event listeners
    setupEventListeners();
}

async function checkAuth() {
    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'include'
        });

        if (!response.ok) {
            showError('請先登入');
            return false;
        }

        const data = await response.json();
        currentUser = data.user;

        // Try to access admin stats (will fail if not admin)
        const statsResponse = await fetch('/api/admin/stats', {
            credentials: 'include'
        });

        if (!statsResponse.ok) {
            const error = await statsResponse.json();
            showError(error.error || '無權限訪問');
            return false;
        }

        // Success - show main content
        loadingState.hidden = true;
        adminMain.hidden = false;
        adminEmail.textContent = currentUser.email;
        return true;

    } catch (err) {
        console.error('Auth check failed:', err);
        showError('驗證失敗');
        return false;
    }
}

function showError(message) {
    loadingState.hidden = true;
    errorMessage.textContent = message;
    errorState.hidden = false;
}

async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats', {
            credentials: 'include'
        });

        if (!response.ok) return;

        const data = await response.json();

        // Update stats display
        totalUsers.textContent = formatNumber(data.users.total);
        todayUsers.textContent = formatNumber(data.users.today);
        totalHistory.textContent = formatNumber(data.history.total);
        todayHistory.textContent = formatNumber(data.history.today);

        // Token stats by model
        const deepseekTotal = data.tokens.byModel.find(m => m.model === 'deepseek');
        const qwenTotal = data.tokens.byModel.find(m => m.model === 'qwen-vl');
        const deepseekToday = data.tokens.todayByModel.find(m => m.model === 'deepseek');
        const qwenToday = data.tokens.todayByModel.find(m => m.model === 'qwen-vl');

        deepseekTokens.textContent = formatNumber(deepseekTotal?.total_tokens || 0);
        todayDeepseek.textContent = formatNumber(deepseekToday?.total_tokens || 0);
        qwenTokens.textContent = formatNumber(qwenTotal?.total_tokens || 0);
        todayQwen.textContent = formatNumber(qwenToday?.total_tokens || 0);

    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

async function loadUsers(page = 1) {
    usersPage = page;
    usersTableBody.innerHTML = '<tr><td colspan="5" class="loading-cell">載入中...</td></tr>';

    try {
        const response = await fetch(`/api/admin/users?page=${page}&limit=20`, {
            credentials: 'include'
        });

        if (!response.ok) {
            usersTableBody.innerHTML = '<tr><td colspan="5" class="loading-cell">載入失敗</td></tr>';
            return;
        }

        const data = await response.json();

        if (data.users.length === 0) {
            usersTableBody.innerHTML = '<tr><td colspan="5" class="loading-cell">暫無用戶</td></tr>';
            usersPagination.innerHTML = '';
            return;
        }

        usersTableBody.innerHTML = data.users.map(user => `
            <tr>
                <td>${escapeHtml(user.email)}</td>
                <td>${formatDate(user.created_at)}</td>
                <td>${formatNumber(user.history_count)}</td>
                <td>${formatNumber(user.total_tokens || 0)}</td>
                <td>
                    <button class="btn-action btn-delete" onclick="confirmDeleteUser('${user.id}', '${escapeHtml(user.email)}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        renderPagination(usersPagination, data.pagination, loadUsers);

    } catch (err) {
        console.error('Failed to load users:', err);
        usersTableBody.innerHTML = '<tr><td colspan="5" class="loading-cell">載入失敗</td></tr>';
    }
}

async function loadHistory(page = 1) {
    historyPage = page;
    historyTableBody.innerHTML = '<tr><td colspan="5" class="loading-cell">載入中...</td></tr>';

    try {
        const response = await fetch(`/api/admin/history?page=${page}&limit=20`, {
            credentials: 'include'
        });

        if (!response.ok) {
            historyTableBody.innerHTML = '<tr><td colspan="5" class="loading-cell">載入失敗</td></tr>';
            return;
        }

        const data = await response.json();

        if (data.history.length === 0) {
            historyTableBody.innerHTML = '<tr><td colspan="5" class="loading-cell">暫無記錄</td></tr>';
            historyPagination.innerHTML = '';
            return;
        }

        historyTableBody.innerHTML = data.history.map(record => `
            <tr>
                <td>${escapeHtml(record.problem_summary || '無摘要')}</td>
                <td>${escapeHtml(record.user_email || '未知')}</td>
                <td><span class="badge badge-${record.kind}">${record.kind === 'image' ? '圖片' : '文字'}</span></td>
                <td>${formatDate(record.created_at)}</td>
                <td>
                    <button class="btn-action btn-view" onclick="viewHistory('${record.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-action btn-delete" onclick="confirmDeleteHistory('${record.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        renderPagination(historyPagination, data.pagination, loadHistory);

    } catch (err) {
        console.error('Failed to load history:', err);
        historyTableBody.innerHTML = '<tr><td colspan="5" class="loading-cell">載入失敗</td></tr>';
    }
}

function renderPagination(container, pagination, loadFn) {
    const { page, totalPages } = pagination;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <button ${page <= 1 ? 'disabled' : ''} onclick="window.loadPage(${page - 1}, '${loadFn.name}')">
            <i class="fas fa-chevron-left"></i> 上一頁
        </button>
        <span>第 ${page} / ${totalPages} 頁</span>
        <button ${page >= totalPages ? 'disabled' : ''} onclick="window.loadPage(${page + 1}, '${loadFn.name}')">
            下一頁 <i class="fas fa-chevron-right"></i>
        </button>
    `;
}

// Global function for pagination buttons
window.loadPage = function(page, fnName) {
    if (fnName === 'loadUsers') loadUsers(page);
    else if (fnName === 'loadHistory') loadHistory(page);
};

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update buttons
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update content
            document.querySelectorAll('.tab-content').forEach(c => {
                c.classList.remove('active');
                c.hidden = true;
            });

            const tabId = btn.dataset.tab + 'Tab';
            const tabContent = document.getElementById(tabId);
            tabContent.classList.add('active');
            tabContent.hidden = false;
        });
    });

    // Delete modal
    document.getElementById('cancelDelete').addEventListener('click', () => {
        deleteModal.hidden = true;
        deleteTarget = null;
    });

    document.getElementById('confirmDelete').addEventListener('click', executeDelete);

    // Detail modal
    document.getElementById('closeDetail').addEventListener('click', () => {
        detailModal.hidden = true;
    });

    // Close modals on background click
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) {
            deleteModal.hidden = true;
            deleteTarget = null;
        }
    });

    detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal) {
            detailModal.hidden = true;
        }
    });
}

// Delete functions
window.confirmDeleteUser = function(userId, email) {
    deleteTarget = { type: 'user', id: userId };
    deleteMessageEl.textContent = `確定要刪除用戶 ${email} 嗎？該用戶的所有數據都會被刪除。`;
    deleteModal.hidden = false;
};

window.confirmDeleteHistory = function(historyId) {
    deleteTarget = { type: 'history', id: historyId };
    deleteMessageEl.textContent = '確定要刪除這條歷史記錄嗎？';
    deleteModal.hidden = false;
};

async function executeDelete() {
    if (!deleteTarget) return;

    const { type, id } = deleteTarget;
    const endpoint = type === 'user' ? `/api/admin/users/${id}` : `/api/admin/history/${id}`;

    try {
        const response = await fetch(endpoint, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            alert(error.error || '刪除失敗');
            return;
        }

        // Refresh data
        if (type === 'user') {
            await loadUsers(usersPage);
        } else {
            await loadHistory(historyPage);
        }

        // Refresh stats
        await loadStats();

    } catch (err) {
        console.error('Delete failed:', err);
        alert('刪除失敗');
    } finally {
        deleteModal.hidden = true;
        deleteTarget = null;
    }
}

// View history detail
window.viewHistory = async function(historyId) {
    detailContent.innerHTML = '<p>載入中...</p>';
    detailModal.hidden = false;

    try {
        const response = await fetch(`/api/admin/history/${historyId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            detailContent.innerHTML = '<p>載入失敗</p>';
            return;
        }

        const data = await response.json();
        const record = data.history;

        detailContent.innerHTML = `
            <div class="detail-section">
                <h4>基本信息</h4>
                <p><strong>用戶:</strong> ${escapeHtml(record.user_email || '未知')}</p>
                <p><strong>類型:</strong> ${record.kind === 'image' ? '圖片題' : '文字題'}</p>
                <p><strong>時間:</strong> ${formatDate(record.created_at)}</p>
            </div>
            <div class="detail-section">
                <h4>題目摘要</h4>
                <p>${escapeHtml(record.problem_summary || '無')}</p>
            </div>
            ${record.request_data ? `
            <div class="detail-section">
                <h4>請求數據</h4>
                <pre>${escapeHtml(JSON.stringify(record.request_data, null, 2))}</pre>
            </div>
            ` : ''}
            ${record.response_data ? `
            <div class="detail-section">
                <h4>響應數據</h4>
                <pre>${escapeHtml(JSON.stringify(record.response_data, null, 2))}</pre>
            </div>
            ` : ''}
        `;

    } catch (err) {
        console.error('Failed to load history detail:', err);
        detailContent.innerHTML = '<p>載入失敗</p>';
    }
};

// Utility functions
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-HK', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
