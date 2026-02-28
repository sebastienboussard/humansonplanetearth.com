/**
 * Monthly Writing Challenge - Frontend Application Logic
 * 
 * This module handles:
 * - State-based UI rendering
 * - User authentication flow
 * - Submission handling
 * - Voting functionality
 * - Gallery display
 */

class ChallengeApp {
    constructor() {
        this.db = db; // Global database instance
        this.currentView = 'main';
        
        // Bind methods
        this.init = this.init.bind(this);
        this.render = this.render.bind(this);
        this.handleLogin = this.handleLogin.bind(this);
        this.handleRegister = this.handleRegister.bind(this);
        this.handleLogout = this.handleLogout.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleVote = this.handleVote.bind(this);
    }

    init() {
        this.render();
        this.setupEventListeners();
    }

    // ==================== RENDERING ====================

    render() {
        const config = this.db.getConfig();
        const user = this.db.getCurrentUser();
        const container = document.getElementById('challenge-app');
        
        if (!container) return;

        container.innerHTML = `
            ${this.renderHeader(config, user)}
            ${this.renderPhaseIndicator(config)}
            ${this.renderWordOfMonth(config)}
            ${this.renderMainContent(config, user)}
            ${this.renderGallery(config, user)}
            ${this.renderWinner(config)}
        `;
        
        this.setupEventListeners();
    }

    renderHeader(config, user) {
        return `
            <div class="challenge-header">
                <h1>Monthly Writing Challenge</h1>
                <p class="challenge-month">${config.challengeMonth}</p>
                <div class="user-section">
                    ${user ? `
                        <span class="user-greeting">Welcome, <strong>${user.username}</strong></span>
                        ${user.isAdmin ? '<a href="/challenge/admin.html" class="admin-link">⚙️ Admin</a>' : ''}
                        <button class="btn btn-secondary btn-small" onclick="app.handleLogout()">Logout</button>
                    ` : `
                        <button class="btn btn-primary btn-small" onclick="app.showLoginModal()">Login</button>
                        <button class="btn btn-secondary btn-small" onclick="app.showRegisterModal()">Register</button>
                    `}
                </div>
            </div>
        `;
    }

    renderPhaseIndicator(config) {
        let phase = 'Results';
        let phaseClass = 'results';
        let phaseDesc = 'The challenge has ended. Check out the winner!';
        
        if (config.isWritingActive) {
            phase = 'Writing Phase';
            phaseClass = 'writing';
            phaseDesc = 'Submit your piece inspired by the word of the month!';
        } else if (config.isVotingActive) {
            phase = 'Voting Phase';
            phaseClass = 'voting';
            phaseDesc = 'Read the submissions and vote for your favorite!';
        }
        
        return `
            <div class="phase-indicator phase-${phaseClass}">
                <div class="phase-badge">${phase}</div>
                <p class="phase-description">${phaseDesc}</p>
            </div>
        `;
    }

    renderWordOfMonth(config) {
        return `
            <div class="word-of-month">
                <span class="word-label">Word of the Month</span>
                <h2 class="the-word">"${config.currentWord}"</h2>
                <p class="word-instruction">
                    Write a piece—poem, short story, essay, or reflection—inspired by this word.
                </p>
            </div>
        `;
    }

    renderMainContent(config, user) {
        // Writing Phase - Show submission form
        if (config.isWritingActive) {
            return this.renderSubmissionForm(user);
        }
        
        // Voting Phase - Instructions
        if (config.isVotingActive) {
            return this.renderVotingInstructions(user);
        }
        
        // Results Phase
        return '';
    }

    renderSubmissionForm(user) {
        if (!user) {
            return `
                <div class="action-section">
                    <div class="auth-prompt">
                        <h3>Want to participate?</h3>
                        <p>Login or create an account to submit your writing.</p>
                        <button class="btn btn-primary" onclick="app.showLoginModal()">Login to Submit</button>
                    </div>
                </div>
            `;
        }
        
        const config = this.db.getConfig();
        const hasSubmitted = this.db.hasUserSubmittedForWord(user.id, config.currentWord);
        
        if (hasSubmitted) {
            return `
                <div class="action-section">
                    <div class="submitted-notice">
                        <h3>✅ You've Already Submitted!</h3>
                        <p>Your piece has been received. You can see it in the gallery below.</p>
                        <p>Come back during the voting phase to vote for your favorite!</p>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="action-section">
                <form id="submission-form" class="submission-form" onsubmit="app.handleSubmit(event)">
                    <h3>📝 Submit Your Writing</h3>
                    <div class="form-group">
                        <label for="submission-title">Title</label>
                        <input type="text" id="submission-title" name="title" required 
                               placeholder="Give your piece a title..." maxlength="100">
                    </div>
                    <div class="form-group">
                        <label for="submission-content">Your Writing</label>
                        <textarea id="submission-content" name="content" required 
                                  placeholder="Write your piece here... Let the word inspire you."
                                  rows="12" minlength="100" maxlength="10000"></textarea>
                        <div class="char-count">
                            <span id="char-count">0</span> / 10,000 characters
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary btn-large">Submit Entry</button>
                </form>
            </div>
        `;
    }

    renderVotingInstructions(user) {
        if (!user) {
            return `
                <div class="action-section">
                    <div class="auth-prompt">
                        <h3>Ready to Vote?</h3>
                        <p>Login or create an account to cast your vote.</p>
                        <button class="btn btn-primary" onclick="app.showLoginModal()">Login to Vote</button>
                    </div>
                </div>
            `;
        }
        
        const hasVoted = this.db.hasUserVotedThisRound(user.id);
        
        if (hasVoted) {
            return `
                <div class="action-section">
                    <div class="voted-notice">
                        <h3>🗳️ Vote Recorded!</h3>
                        <p>Thank you for voting! Check back soon to see the results.</p>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="action-section">
                <div class="voting-instructions">
                    <h3>🗳️ Cast Your Vote</h3>
                    <p>Read through the submissions below and click "Vote" on your favorite piece.</p>
                    <p class="voting-note">You can only vote once per challenge.</p>
                </div>
            </div>
        `;
    }

    renderGallery(config, user) {
        const submissions = this.db.getSubmissionsForCurrentWord();
        
        if (submissions.length === 0) {
            return `
                <div class="gallery-section">
                    <h3>📚 Submissions Gallery</h3>
                    <div class="empty-gallery">
                        <p>No submissions yet for "${config.currentWord}".</p>
                        ${config.isWritingActive ? '<p>Be the first to submit!</p>' : ''}
                    </div>
                </div>
            `;
        }
        
        const hasVoted = user ? this.db.hasUserVotedThisRound(user.id) : false;
        
        return `
            <div class="gallery-section">
                <h3>📚 Submissions Gallery (${submissions.length})</h3>
                <div class="submissions-grid">
                    ${submissions.map(sub => this.renderSubmissionCard(sub, config, user, hasVoted)).join('')}
                </div>
            </div>
        `;
    }

    renderSubmissionCard(submission, config, user, hasVoted) {
        const isOwnSubmission = user && user.id === submission.userId;
        const showVoteButton = config.isVotingActive && user && !hasVoted && !isOwnSubmission;
        const truncatedContent = submission.content.length > 300 
            ? submission.content.substring(0, 300) + '...' 
            : submission.content;
        
        return `
            <article class="submission-card ${submission.isWinner ? 'winner' : ''}">
                ${submission.isWinner ? '<div class="winner-badge">🏆 Winner</div>' : ''}
                <h4 class="submission-title">${this.escapeHtml(submission.title)}</h4>
                <p class="submission-author">by ${this.escapeHtml(submission.username)}</p>
                <div class="submission-content">
                    <p>${this.escapeHtml(truncatedContent)}</p>
                </div>
                <div class="submission-footer">
                    <span class="vote-count">${submission.votes} vote${submission.votes !== 1 ? 's' : ''}</span>
                    ${showVoteButton ? `
                        <button class="btn btn-vote" onclick="app.handleVote('${submission.id}')">
                            Vote for This
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary btn-small" onclick="app.showFullSubmission('${submission.id}')">
                        Read Full
                    </button>
                </div>
            </article>
        `;
    }

    renderWinner(config) {
        const winner = this.db.getWinner();
        
        if (!winner || config.isWritingActive || config.isVotingActive) {
            return '';
        }
        
        return `
            <div class="winner-section">
                <h2>🏆 This Month's Winner</h2>
                <div class="winner-showcase">
                    <h3 class="winner-title">"${this.escapeHtml(winner.title)}"</h3>
                    <p class="winner-author">by ${this.escapeHtml(winner.username)}</p>
                    <div class="winner-content">
                        ${this.escapeHtml(winner.content).split('\n').map(p => `<p>${p}</p>`).join('')}
                    </div>
                    <p class="winner-votes">Received ${winner.votes} votes</p>
                </div>
            </div>
        `;
    }

    // ==================== MODALS ====================

    showLoginModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'auth-modal';
        modal.innerHTML = `
            <div class="modal">
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
                <h2>Login</h2>
                <form id="login-form" onsubmit="app.handleLogin(event)">
                    <div class="form-group">
                        <label for="login-email">Email</label>
                        <input type="email" id="login-email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label for="login-password">Password</label>
                        <input type="password" id="login-password" name="password" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Login</button>
                </form>
                <p class="modal-footer">
                    Don't have an account? 
                    <a href="#" onclick="app.closeModal(); app.showRegisterModal();">Register</a>
                </p>
            </div>
        `;
        document.body.appendChild(modal);
    }

    showRegisterModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'auth-modal';
        modal.innerHTML = `
            <div class="modal">
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
                <h2>Create Account</h2>
                <form id="register-form" onsubmit="app.handleRegister(event)">
                    <div class="form-group">
                        <label for="reg-username">Display Name</label>
                        <input type="text" id="reg-username" name="username" required minlength="2" maxlength="50">
                    </div>
                    <div class="form-group">
                        <label for="reg-email">Email</label>
                        <input type="email" id="reg-email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label for="reg-password">Password</label>
                        <input type="password" id="reg-password" name="password" required minlength="6">
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Create Account</button>
                </form>
                <p class="modal-footer">
                    Already have an account? 
                    <a href="#" onclick="app.closeModal(); app.showLoginModal();">Login</a>
                </p>
            </div>
        `;
        document.body.appendChild(modal);
    }

    showFullSubmission(submissionId) {
        const submission = this.db.getSubmissionById(submissionId);
        if (!submission) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'submission-modal';
        modal.innerHTML = `
            <div class="modal modal-large">
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
                <h2>${this.escapeHtml(submission.title)}</h2>
                <p class="submission-author">by ${this.escapeHtml(submission.username)}</p>
                <div class="full-submission-content">
                    ${this.escapeHtml(submission.content).split('\n').map(p => `<p>${p}</p>`).join('')}
                </div>
                <div class="submission-meta">
                    <span>${submission.votes} votes</span>
                    <span>Submitted ${new Date(submission.submittedAt).toLocaleDateString()}</span>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    closeModal() {
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(m => m.remove());
    }

    // ==================== EVENT HANDLERS ====================

    setupEventListeners() {
        // Character counter for submission form
        const contentField = document.getElementById('submission-content');
        if (contentField) {
            contentField.addEventListener('input', () => {
                const count = contentField.value.length;
                const counter = document.getElementById('char-count');
                if (counter) counter.textContent = count;
            });
        }
        
        // Close modal on overlay click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.closeModal();
            }
        });
        
        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    handleLogin(event) {
        event.preventDefault();
        const form = event.target;
        const email = form.email.value;
        const password = form.password.value;
        
        const user = this.db.authenticateUser(email, password);
        
        if (user) {
            this.db.setCurrentUser(user);
            this.closeModal();
            this.render();
            this.showNotification('Welcome back, ' + user.username + '!', 'success');
        } else {
            this.showNotification('Invalid email or password', 'error');
        }
    }

    handleRegister(event) {
        event.preventDefault();
        const form = event.target;
        const username = form.username.value;
        const email = form.email.value;
        const password = form.password.value;
        
        try {
            const user = this.db.createUser(username, email, password);
            this.db.setCurrentUser(user);
            this.closeModal();
            this.render();
            this.showNotification('Account created! Welcome, ' + user.username + '!', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    handleLogout() {
        this.db.logout();
        this.render();
        this.showNotification('Logged out successfully', 'success');
    }

    handleSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const title = form.title.value.trim();
        const content = form.content.value.trim();
        const user = this.db.getCurrentUser();
        
        if (!user) {
            this.showNotification('Please login to submit', 'error');
            return;
        }
        
        try {
            this.db.createSubmission(user.id, user.username, title, content);
            this.render();
            this.showNotification('Your submission has been received!', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    handleVote(submissionId) {
        const user = this.db.getCurrentUser();
        
        if (!user) {
            this.showNotification('Please login to vote', 'error');
            return;
        }
        
        try {
            this.db.voteForSubmission(user.id, submissionId);
            this.render();
            this.showNotification('Vote recorded! Thank you for participating.', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    // ==================== UTILITIES ====================

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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app
const app = new ChallengeApp();
document.addEventListener('DOMContentLoaded', () => app.init());
