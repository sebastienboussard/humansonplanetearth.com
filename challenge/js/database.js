/**
 * Monthly Writing Challenge - Database Schema & Data Layer
 * 
 * This module provides a localStorage-based database for the writing challenge.
 * For production use with larger communities, replace with a real backend.
 * 
 * Database Schema:
 * ================
 * 
 * AppConfig: {
 *   currentWord: string,           // The current monthly word/theme
 *   isWritingActive: boolean,      // Whether submissions are allowed
 *   isVotingActive: boolean,       // Whether voting is allowed
 *   challengeMonth: string,        // Current challenge month (e.g., "March 2025")
 *   lastUpdated: timestamp         // Last config update time
 * }
 * 
 * Users: [{
 *   id: string,                    // Unique user ID
 *   username: string,              // Display name
 *   email: string,                 // Email (for login)
 *   passwordHash: string,          // Hashed password (simple hash for demo)
 *   isAdmin: boolean,              // Admin privileges
 *   createdAt: timestamp           // Account creation time
 * }]
 * 
 * Submissions: [{
 *   id: string,                    // Unique submission ID
 *   displayName: string,           // Optional author display name (anonymous if not provided)
 *   word: string,                  // The monthly word this was submitted for
 *   title: string,                 // Submission title
 *   content: string,               // The written content
 *   votes: number,                 // Vote count
 *   voterIds: [string],            // Array of anonymous voter IDs (stored in localStorage)
 *   submittedAt: timestamp,        // Submission time
 *   isWinner: boolean              // Winner flag
 * }]
 * 
 * ArchivedChallenges: [{
 *   word: string,                  // The challenge word
 *   month: string,                 // Challenge month
 *   winnerId: string,              // Winning submission ID
 *   winnerName: string,            // Winner's display name
 *   winnerTitle: string,           // Winning piece title
 *   totalSubmissions: number,      // Total submissions that month
 *   archivedAt: timestamp          // Archive time
 * }]
 */

class ChallengeDatabase {
    constructor() {
        this.KEYS = {
            CONFIG: 'challenge_config',
            USERS: 'challenge_users',
            SUBMISSIONS: 'challenge_submissions',
            ARCHIVES: 'challenge_archives',
            CURRENT_USER: 'challenge_current_user',
            VOTER_ID: 'challenge_voter_id'
        };
        
        this.initializeDatabase();
    }

    // Initialize database with default values if empty
    initializeDatabase() {
        if (!this.getConfig()) {
            this.setConfig({
                currentWord: 'Resilience',
                isWritingActive: true,
                isVotingActive: false,
                challengeMonth: this.getCurrentMonth(),
                lastUpdated: Date.now()
            });
        }
        
        if (!this.getUsers()) {
            // Create default admin user
            const adminUser = {
                id: this.generateId(),
                username: 'Admin',
                email: 'admin@humansonplanetearth.com',
                passwordHash: this.hashPassword('admin123'), // Change in production!
                isAdmin: true,
                createdAt: Date.now()
            };
            this.saveUsers([adminUser]);
        }
        
        if (!this.getSubmissions()) {
            this.saveSubmissions([]);
        }
        
        if (!this.getArchives()) {
            this.saveArchives([]);
        }
        
        // Generate or retrieve anonymous voter ID
        if (!this.getVoterId()) {
            this.setVoterId(this.generateId());
        }
    }

    // ==================== CONFIG METHODS ====================
    
    getConfig() {
        const data = localStorage.getItem(this.KEYS.CONFIG);
        return data ? JSON.parse(data) : null;
    }
    
    setConfig(config) {
        config.lastUpdated = Date.now();
        localStorage.setItem(this.KEYS.CONFIG, JSON.stringify(config));
        return config;
    }
    
    updateConfig(updates) {
        const config = this.getConfig();
        const updated = { ...config, ...updates, lastUpdated: Date.now() };
        return this.setConfig(updated);
    }

    // ==================== USER METHODS (Admin only) ====================
    
    getUsers() {
        const data = localStorage.getItem(this.KEYS.USERS);
        return data ? JSON.parse(data) : null;
    }
    
    saveUsers(users) {
        localStorage.setItem(this.KEYS.USERS, JSON.stringify(users));
    }
    
    getUserById(id) {
        const users = this.getUsers() || [];
        return users.find(u => u.id === id);
    }
    
    getUserByEmail(email) {
        const users = this.getUsers() || [];
        return users.find(u => u.email.toLowerCase() === email.toLowerCase());
    }
    
    authenticateUser(email, password) {
        const user = this.getUserByEmail(email);
        if (!user) return null;
        
        if (user.passwordHash === this.hashPassword(password)) {
            return user;
        }
        return null;
    }

    // ==================== SESSION METHODS ====================
    
    getCurrentUser() {
        const data = localStorage.getItem(this.KEYS.CURRENT_USER);
        return data ? JSON.parse(data) : null;
    }
    
    setCurrentUser(user) {
        if (user) {
            // Don't store password hash in session
            const sessionUser = { ...user };
            delete sessionUser.passwordHash;
            localStorage.setItem(this.KEYS.CURRENT_USER, JSON.stringify(sessionUser));
        } else {
            localStorage.removeItem(this.KEYS.CURRENT_USER);
        }
    }
    
    logout() {
        this.setCurrentUser(null);
    }
    
    // Anonymous voter ID (for tracking votes without accounts)
    getVoterId() {
        return localStorage.getItem(this.KEYS.VOTER_ID);
    }
    
    setVoterId(id) {
        localStorage.setItem(this.KEYS.VOTER_ID, id);
    }

    // ==================== SUBMISSION METHODS ====================
    
    getSubmissions() {
        const data = localStorage.getItem(this.KEYS.SUBMISSIONS);
        return data ? JSON.parse(data) : null;
    }
    
    saveSubmissions(submissions) {
        localStorage.setItem(this.KEYS.SUBMISSIONS, JSON.stringify(submissions));
    }
    
    getSubmissionsForCurrentWord() {
        const config = this.getConfig();
        const submissions = this.getSubmissions() || [];
        return submissions.filter(s => s.word === config.currentWord);
    }
    
    getSubmissionById(id) {
        const submissions = this.getSubmissions() || [];
        return submissions.find(s => s.id === id);
    }
    
    // Anonymous submission - no user account required
    createSubmission(displayName, title, content) {
        const config = this.getConfig();
        const submissions = this.getSubmissions() || [];
        
        // Check if writing is active
        if (!config.isWritingActive) {
            throw new Error('Writing phase is not active');
        }
        
        const newSubmission = {
            id: this.generateId(),
            displayName: displayName.trim() || 'Anonymous',
            word: config.currentWord,
            title,
            content,
            votes: 0,
            voterIds: [],
            submittedAt: Date.now(),
            isWinner: false
        };
        
        submissions.push(newSubmission);
        this.saveSubmissions(submissions);
        return newSubmission;
    }
    
    // Admin: Delete a submission
    deleteSubmission(submissionId) {
        const submissions = this.getSubmissions() || [];
        const filtered = submissions.filter(s => s.id !== submissionId);
        this.saveSubmissions(filtered);
        return true;
    }

    // ==================== VOTING METHODS ====================
    
    hasVotedForSubmission(submissionId) {
        const voterId = this.getVoterId();
        const submission = this.getSubmissionById(submissionId);
        return submission && submission.voterIds.includes(voterId);
    }
    
    hasVotedThisRound() {
        const voterId = this.getVoterId();
        const config = this.getConfig();
        const submissions = this.getSubmissions() || [];
        const currentSubmissions = submissions.filter(s => s.word === config.currentWord);
        return currentSubmissions.some(s => s.voterIds.includes(voterId));
    }
    
    voteForSubmission(submissionId) {
        const config = this.getConfig();
        const voterId = this.getVoterId();
        const submissions = this.getSubmissions() || [];
        
        // Check if voting is active
        if (!config.isVotingActive) {
            throw new Error('Voting phase is not active');
        }
        
        // Check if already voted this round
        if (this.hasVotedThisRound()) {
            throw new Error('You have already cast your vote this round');
        }
        
        const submissionIndex = submissions.findIndex(s => s.id === submissionId);
        if (submissionIndex === -1) {
            throw new Error('Submission not found');
        }
        
        submissions[submissionIndex].votes += 1;
        submissions[submissionIndex].voterIds.push(voterId);
        
        this.saveSubmissions(submissions);
        return submissions[submissionIndex];
    }
    
    getVoteTally() {
        const config = this.getConfig();
        const submissions = this.getSubmissions() || [];
        return submissions
            .filter(s => s.word === config.currentWord)
            .sort((a, b) => b.votes - a.votes);
    }

    // ==================== ADMIN METHODS ====================
    
    setWritingPhase(active) {
        return this.updateConfig({ 
            isWritingActive: active,
            isVotingActive: active ? false : this.getConfig().isVotingActive
        });
    }
    
    setVotingPhase(active) {
        return this.updateConfig({ 
            isVotingActive: active,
            isWritingActive: active ? false : this.getConfig().isWritingActive
        });
    }
    
    setMonthlyWord(word) {
        return this.updateConfig({ 
            currentWord: word,
            challengeMonth: this.getCurrentMonth()
        });
    }
    
    declareWinner(submissionId) {
        const submissions = this.getSubmissions() || [];
        const config = this.getConfig();
        
        // Reset all winners for current word
        submissions.forEach(s => {
            if (s.word === config.currentWord) {
                s.isWinner = false;
            }
        });
        
        // Set new winner
        const winnerIndex = submissions.findIndex(s => s.id === submissionId);
        if (winnerIndex !== -1) {
            submissions[winnerIndex].isWinner = true;
        }
        
        this.saveSubmissions(submissions);
        return submissions[winnerIndex];
    }
    
    getWinner() {
        const config = this.getConfig();
        const submissions = this.getSubmissions() || [];
        return submissions.find(s => s.word === config.currentWord && s.isWinner);
    }

    // ==================== ARCHIVE METHODS ====================
    
    getArchives() {
        const data = localStorage.getItem(this.KEYS.ARCHIVES);
        return data ? JSON.parse(data) : null;
    }
    
    saveArchives(archives) {
        localStorage.setItem(this.KEYS.ARCHIVES, JSON.stringify(archives));
    }
    
    archiveCurrentChallenge() {
        const config = this.getConfig();
        const winner = this.getWinner();
        const currentSubmissions = this.getSubmissionsForCurrentWord();
        const archives = this.getArchives() || [];
        
        const archive = {
            word: config.currentWord,
            month: config.challengeMonth,
            winnerId: winner ? winner.id : null,
            winnerName: winner ? winner.displayName : 'No winner',
            winnerTitle: winner ? winner.title : 'N/A',
            totalSubmissions: currentSubmissions.length,
            archivedAt: Date.now()
        };
        
        archives.push(archive);
        this.saveArchives(archives);
        return archive;
    }
    
    resetForNewChallenge(newWord) {
        // Archive current challenge first
        this.archiveCurrentChallenge();
        
        // Update config for new challenge
        this.updateConfig({
            currentWord: newWord,
            challengeMonth: this.getCurrentMonth(),
            isWritingActive: true,
            isVotingActive: false
        });
        
        return this.getConfig();
    }

    // ==================== UTILITY METHODS ====================
    
    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    hashPassword(password) {
        // Simple hash for demo - use bcrypt or similar in production!
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'hash_' + Math.abs(hash).toString(16);
    }
    
    getCurrentMonth() {
        return new Date().toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
        });
    }
    
    // Clear all data (for testing)
    resetDatabase() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        this.initializeDatabase();
    }
}

// Export singleton instance
const db = new ChallengeDatabase();
