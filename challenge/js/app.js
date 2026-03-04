/**
 * Monthly Writing Challenge - Frontend Application Logic
 * 
 * This module handles:
 * - State-based UI rendering
 * - Anonymous submissions (no account required)
 * - Anonymous voting
 * - Gallery display
 */

class ChallengeApp {
    constructor() {
        this.db = db; // Global database instance
    }

    init() {
        this.render();
        this.setupEventListeners();
    }

    // ==================== RENDERING ====================

    render() {
        const config = this.db.getConfig();
        const container = document.getElementById('challenge-app');
        
        if (!container) return;

        container.innerHTML = `
            ${this.renderAdminLink()}
            ${this.renderPhaseIndicator(config)}
            ${this.renderWordOfMonth(config)}
            ${this.renderMainContent(config)}
            ${this.renderGallery(config)}
            ${this.renderWinner(config)}
        `;
        
        this.setupEventListeners();
    }

    renderAdminLink() {
        const user = this.db.getCurrentUser();
        if (user && user.isAdmin) {
            return `
                <div class="admin-bar">
                    <a href="/challenge/admin.html" class="admin-link">⚙️ Admin Dashboard</a>
                    <button class="btn btn-small btn-secondary" onclick="app.handleLogout()">Logout</button>
                </div>
            `;
        }
        return '';
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

    renderMainContent(config) {
        // Writing Phase - Show submission form
        if (config.isWritingActive) {
            return this.renderSubmissionForm();
        }
        
        // Voting Phase - Instructions
        if (config.isVotingActive) {
            return this.renderVotingInstructions();
        }
        
        // Results Phase
        return '';
    }

    renderSubmissionForm() {
        return `
            <div class="action-section">
                <form id="submission-form" class="submission-form" onsubmit="app.handleSubmit(event)">
                    <h3>📝 Submit Your Writing</h3>
                    <p class="form-subtitle">No account needed. Share your words anonymously.</p>
                    
                    <div class="form-group">
                        <label for="submission-name">Display Name <span class="optional">(optional)</span></label>
                        <input type="text" id="submission-name" name="displayName" 
                               placeholder="Anonymous" maxlength="50">
                    </div>
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

    renderVotingInstructions() {
        const hasVoted = this.db.hasVotedThisRound();
        
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

    renderGallery(config) {
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
        
        const hasVoted = this.db.hasVotedThisRound();
        
        return `
            <div class="gallery-section">
                <h3>📚 Submissions Gallery (${submissions.length})</h3>
                <div class="submissions-grid">
                    ${submissions.map(sub => this.renderSubmissionCard(sub, config, hasVoted)).join('')}
                </div>
            </div>
        `;
    }

    renderSubmissionCard(submission, config, hasVoted) {
        const showVoteButton = config.isVotingActive && !hasVoted;
        const truncatedContent = submission.content.length > 300 
            ? submission.content.substring(0, 300) + '...' 
            : submission.content;
        
        return `
            <article class="submission-card ${submission.isWinner ? 'winner' : ''}">
                ${submission.isWinner ? '<div class="winner-badge">🏆 Winner</div>' : ''}
                <h4 class="submission-title">${this.escapeHtml(submission.title)}</h4>
                <p class="submission-author">by ${this.escapeHtml(submission.displayName || 'Anonymous')}</p>
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
                    <p class="winner-author">by ${this.escapeHtml(winner.displayName || 'Anonymous')}</p>
                    <div class="winner-content">
                        ${this.escapeHtml(winner.content).split('\n').map(p => `<p>${p}</p>`).join('')}
                    </div>
                    <p class="winner-votes">Received ${winner.votes} votes</p>
                </div>
            </div>
        `;
    }

    // ==================== MODALS ====================

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
                <p class="submission-author">by ${this.escapeHtml(submission.displayName || 'Anonymous')}</p>
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

    handleSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const displayName = form.displayName.value.trim();
        const title = form.title.value.trim();
        const content = form.content.value.trim();
        
        try {
            this.db.createSubmission(displayName, title, content);
            this.render();
            this.showNotification('Your submission has been received! Thank you for sharing.', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    handleVote(submissionId) {
        try {
            this.db.voteForSubmission(submissionId);
            this.render();
            this.showNotification('Vote recorded! Thank you for participating.', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    handleLogout() {
        this.db.logout();
        this.render();
        this.showNotification('Logged out successfully', 'success');
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
