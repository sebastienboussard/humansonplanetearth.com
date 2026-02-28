/**
 * Monthly Writing Challenge - Admin Dashboard
 * 
 * Provides manual controls for:
 * - Toggling Writing/Voting phases
 * - Setting the Monthly Word
 * - Viewing vote tallies
 * - Declaring winners
 * - Archiving and resetting challenges
 */

class AdminDashboard {
    constructor() {
        this.db = db;
        this.init();
    }

    init() {
        // Check if user is logged in and is admin
        const user = this.db.getCurrentUser();
        
        if (!user) {
            this.showLoginRequired();
            return;
        }
        
        if (!user.isAdmin) {
            this.showAccessDenied();
            return;
        }
        
        this.render();
    }

    showLoginRequired() {
        const container = document.getElementById('admin-app');
        container.innerHTML = `
            <div class="admin-message">
                <h2>🔐 Login Required</h2>
                <p>You must be logged in as an administrator to access this page.</p>
                <a href="/challenge/" class="btn btn-primary">Go to Challenge</a>
            </div>
        `;
    }

    showAccessDenied() {
        const container = document.getElementById('admin-app');
        container.innerHTML = `
            <div class="admin-message error">
                <h2>⛔ Access Denied</h2>
                <p>You do not have administrator privileges.</p>
                <a href="/challenge/" class="btn btn-secondary">Back to Challenge</a>
            </div>
        `;
    }

    render() {
        const config = this.db.getConfig();
        const user = this.db.getCurrentUser();
        const container = document.getElementById('admin-app');

        container.innerHTML = `
            <div class="admin-header">
                <h2>Welcome, ${user.username}</h2>
                <p>Last updated: ${new Date(config.lastUpdated).toLocaleString()}</p>
                <button class="btn btn-secondary btn-small" onclick="admin.logout()">Logout</button>
            </div>

            ${this.renderPhaseControls(config)}
            ${this.renderWordControls(config)}
            ${this.renderVoteTally()}
            ${this.renderWinnerControls()}
            ${this.renderResetControls()}
            ${this.renderArchives()}
            ${this.renderUserManagement()}
        `;
    }

    renderPhaseControls(config) {
        return `
            <section class="admin-section">
                <h3>📊 Phase Controls</h3>
                <div class="phase-info">
                    <div class="current-phase">
                        <strong>Current Phase:</strong>
                        <span class="phase-badge ${this.getPhaseClass(config)}">
                            ${this.getPhaseName(config)}
                        </span>
                    </div>
                </div>
                
                <div class="phase-toggles">
                    <div class="toggle-group">
                        <label>Writing Phase</label>
                        <button class="toggle-btn ${config.isWritingActive ? 'active' : ''}" 
                                onclick="admin.toggleWriting()">
                            ${config.isWritingActive ? '✅ ACTIVE' : '⏹️ INACTIVE'}
                        </button>
                        <p class="toggle-desc">When active, users can submit their writing.</p>
                    </div>
                    
                    <div class="toggle-group">
                        <label>Voting Phase</label>
                        <button class="toggle-btn ${config.isVotingActive ? 'active' : ''}" 
                                onclick="admin.toggleVoting()">
                            ${config.isVotingActive ? '✅ ACTIVE' : '⏹️ INACTIVE'}
                        </button>
                        <p class="toggle-desc">When active, users can vote on submissions.</p>
                    </div>
                </div>
                
                <div class="quick-actions">
                    <h4>Quick Actions</h4>
                    <button class="btn btn-secondary" onclick="admin.setPhase('writing')">
                        Start Writing Phase
                    </button>
                    <button class="btn btn-secondary" onclick="admin.setPhase('voting')">
                        Start Voting Phase
                    </button>
                    <button class="btn btn-secondary" onclick="admin.setPhase('results')">
                        Show Results Only
                    </button>
                </div>
            </section>
        `;
    }

    renderWordControls(config) {
        return `
            <section class="admin-section">
                <h3>📝 Monthly Word</h3>
                <div class="current-word-display">
                    <span class="label">Current Word:</span>
                    <span class="word">"${config.currentWord}"</span>
                    <span class="month">(${config.challengeMonth})</span>
                </div>
                
                <form id="word-form" class="word-form" onsubmit="admin.updateWord(event)">
                    <div class="form-group">
                        <label for="new-word">Set New Word</label>
                        <input type="text" id="new-word" name="word" 
                               placeholder="Enter the new word..." 
                               required minlength="2" maxlength="50">
                    </div>
                    <button type="submit" class="btn btn-primary">Update Word</button>
                </form>
                
                <div class="word-suggestions">
                    <h4>Word Suggestions</h4>
                    <div class="suggestion-chips">
                        ${this.getWordSuggestions().map(word => `
                            <button class="chip" onclick="document.getElementById('new-word').value='${word}'">
                                ${word}
                            </button>
                        `).join('')}
                    </div>
                </div>
            </section>
        `;
    }

    renderVoteTally() {
        const tally = this.db.getVoteTally();
        
        return `
            <section class="admin-section">
                <h3>🗳️ Vote Tally</h3>
                ${tally.length === 0 ? `
                    <p class="no-data">No submissions for the current word yet.</p>
                ` : `
                    <table class="vote-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Title</th>
                                <th>Author</th>
                                <th>Votes</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tally.map((sub, index) => `
                                <tr class="${sub.isWinner ? 'winner-row' : ''}">
                                    <td>${index + 1}</td>
                                    <td>${this.escapeHtml(sub.title)}</td>
                                    <td>${this.escapeHtml(sub.username)}</td>
                                    <td><strong>${sub.votes}</strong></td>
                                    <td>
                                        ${sub.isWinner ? 
                                            '<span class="winner-tag">🏆 Winner</span>' :
                                            `<button class="btn btn-small" onclick="admin.declareWinner('${sub.id}')">
                                                Declare Winner
                                            </button>`
                                        }
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="tally-summary">
                        <p>Total Submissions: <strong>${tally.length}</strong></p>
                        <p>Total Votes Cast: <strong>${tally.reduce((sum, s) => sum + s.votes, 0)}</strong></p>
                    </div>
                `}
            </section>
        `;
    }

    renderWinnerControls() {
        const winner = this.db.getWinner();
        
        return `
            <section class="admin-section">
                <h3>🏆 Winner Declaration</h3>
                ${winner ? `
                    <div class="current-winner">
                        <p>Current Winner:</p>
                        <div class="winner-card">
                            <h4>"${this.escapeHtml(winner.title)}"</h4>
                            <p>by ${this.escapeHtml(winner.username)}</p>
                            <p class="votes">${winner.votes} votes</p>
                        </div>
                        <button class="btn btn-secondary" onclick="admin.clearWinner()">
                            Clear Winner
                        </button>
                    </div>
                ` : `
                    <p>No winner declared yet. Use the vote tally above to declare a winner.</p>
                `}
                
                <div class="auto-winner">
                    <button class="btn btn-primary" onclick="admin.declareTopVoted()">
                        Auto-Declare Top Voted as Winner
                    </button>
                </div>
            </section>
        `;
    }

    renderResetControls() {
        return `
            <section class="admin-section danger-zone">
                <h3>🔄 Reset & Archive</h3>
                <div class="warning-box">
                    <p><strong>⚠️ Warning:</strong> These actions cannot be undone!</p>
                </div>
                
                <form id="reset-form" onsubmit="admin.handleReset(event)">
                    <div class="form-group">
                        <label for="reset-word">New Word for Next Challenge</label>
                        <input type="text" id="reset-word" name="word" 
                               placeholder="Enter word for the next challenge..." 
                               required minlength="2" maxlength="50">
                    </div>
                    <button type="submit" class="btn btn-danger">
                        Archive Current & Start New Challenge
                    </button>
                </form>
                
                <div class="database-controls">
                    <h4>Database Controls</h4>
                    <button class="btn btn-danger-outline" onclick="admin.exportData()">
                        📥 Export All Data (JSON)
                    </button>
                    <button class="btn btn-danger" onclick="admin.resetDatabase()">
                        🗑️ Reset Entire Database
                    </button>
                </div>
            </section>
        `;
    }

    renderArchives() {
        const archives = this.db.getArchives() || [];
        
        return `
            <section class="admin-section">
                <h3>📚 Challenge Archives</h3>
                ${archives.length === 0 ? `
                    <p class="no-data">No archived challenges yet.</p>
                ` : `
                    <table class="archive-table">
                        <thead>
                            <tr>
                                <th>Month</th>
                                <th>Word</th>
                                <th>Winner</th>
                                <th>Submissions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${archives.map(arch => `
                                <tr>
                                    <td>${arch.month}</td>
                                    <td>"${this.escapeHtml(arch.word)}"</td>
                                    <td>${arch.winnerUsername} - "${this.escapeHtml(arch.winnerTitle || 'N/A')}"</td>
                                    <td>${arch.totalSubmissions}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `}
            </section>
        `;
    }

    renderUserManagement() {
        const users = this.db.getUsers() || [];
        
        return `
            <section class="admin-section">
                <h3>👥 Registered Users</h3>
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Admin</th>
                            <th>Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr>
                                <td>${this.escapeHtml(user.username)}</td>
                                <td>${this.escapeHtml(user.email)}</td>
                                <td>${user.isAdmin ? '✅' : '—'}</td>
                                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <p class="user-count">Total Users: <strong>${users.length}</strong></p>
            </section>
        `;
    }

    // ==================== ACTIONS ====================

    toggleWriting() {
        const config = this.db.getConfig();
        this.db.setWritingPhase(!config.isWritingActive);
        this.render();
        this.showNotification('Writing phase ' + (!config.isWritingActive ? 'activated' : 'deactivated'), 'success');
    }

    toggleVoting() {
        const config = this.db.getConfig();
        this.db.setVotingPhase(!config.isVotingActive);
        this.render();
        this.showNotification('Voting phase ' + (!config.isVotingActive ? 'activated' : 'deactivated'), 'success');
    }

    setPhase(phase) {
        switch (phase) {
            case 'writing':
                this.db.updateConfig({ isWritingActive: true, isVotingActive: false });
                break;
            case 'voting':
                this.db.updateConfig({ isWritingActive: false, isVotingActive: true });
                break;
            case 'results':
                this.db.updateConfig({ isWritingActive: false, isVotingActive: false });
                break;
        }
        this.render();
        this.showNotification(`Phase changed to: ${phase}`, 'success');
    }

    updateWord(event) {
        event.preventDefault();
        const word = event.target.word.value.trim();
        
        if (word) {
            this.db.setMonthlyWord(word);
            event.target.reset();
            this.render();
            this.showNotification(`Monthly word updated to "${word}"`, 'success');
        }
    }

    declareWinner(submissionId) {
        if (confirm('Declare this submission as the winner?')) {
            this.db.declareWinner(submissionId);
            this.render();
            this.showNotification('Winner declared!', 'success');
        }
    }

    declareTopVoted() {
        const tally = this.db.getVoteTally();
        if (tally.length === 0) {
            this.showNotification('No submissions to choose from', 'error');
            return;
        }
        
        const topVoted = tally[0];
        if (confirm(`Declare "${topVoted.title}" by ${topVoted.username} (${topVoted.votes} votes) as winner?`)) {
            this.db.declareWinner(topVoted.id);
            this.render();
            this.showNotification('Winner declared!', 'success');
        }
    }

    clearWinner() {
        if (confirm('Clear the current winner?')) {
            const submissions = this.db.getSubmissions();
            submissions.forEach(s => s.isWinner = false);
            this.db.saveSubmissions(submissions);
            this.render();
            this.showNotification('Winner cleared', 'success');
        }
    }

    handleReset(event) {
        event.preventDefault();
        const word = event.target.word.value.trim();
        
        if (!confirm('This will archive the current challenge and start a new one. Continue?')) {
            return;
        }
        
        this.db.resetForNewChallenge(word);
        event.target.reset();
        this.render();
        this.showNotification(`New challenge started with word: "${word}"`, 'success');
    }

    exportData() {
        const data = {
            config: this.db.getConfig(),
            users: this.db.getUsers(),
            submissions: this.db.getSubmissions(),
            archives: this.db.getArchives(),
            exportedAt: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `challenge-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('Data exported successfully', 'success');
    }

    resetDatabase() {
        if (!confirm('⚠️ This will DELETE ALL DATA. Are you absolutely sure?')) {
            return;
        }
        if (!confirm('This is your last chance to cancel. All users, submissions, and archives will be lost.')) {
            return;
        }
        
        this.db.resetDatabase();
        this.showNotification('Database reset. Redirecting...', 'success');
        setTimeout(() => window.location.href = '/challenge/', 2000);
    }

    logout() {
        this.db.logout();
        window.location.href = '/challenge/';
    }

    // ==================== HELPERS ====================

    getPhaseName(config) {
        if (config.isWritingActive) return 'Writing';
        if (config.isVotingActive) return 'Voting';
        return 'Results';
    }

    getPhaseClass(config) {
        if (config.isWritingActive) return 'writing';
        if (config.isVotingActive) return 'voting';
        return 'results';
    }

    getWordSuggestions() {
        return [
            'Resilience', 'Home', 'Growth', 'Silence', 'Journey',
            'Memory', 'Light', 'Change', 'Connection', 'Hope',
            'Courage', 'Wonder', 'Truth', 'Freedom', 'Balance'
        ];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 5000);
    }
}

// Initialize admin dashboard
const admin = new AdminDashboard();
