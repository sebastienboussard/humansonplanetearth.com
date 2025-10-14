// Open Questions System
class QuestionsSystem {
    constructor() {
        this.questions = this.loadQuestions();
    }

    // Load questions from localStorage
    loadQuestions() {
        const stored = localStorage.getItem('openQuestions');
        if (stored) {
            return JSON.parse(stored);
        }
        
        // Default questions
        return [
            {
                id: 1,
                question: 'What does it mean to live authentically in a world of curated identities?',
                author: 'Admin',
                date: new Date('2024-10-14').toISOString(),
                answers: [
                    {
                        id: 1,
                        content: 'Living authentically means honoring your internal experience even when it contradicts external expectations. In a world where we constantly perform for algorithms and audiences, authenticity becomes an act of quiet rebellion.',
                        author: 'Admin',
                        date: new Date('2024-10-14').toISOString(),
                        likes: 3,
                        dislikes: 0
                    }
                ],
                views: 0
            },
            {
                id: 2,
                question: 'How do we maintain human connection in an increasingly digital world?',
                author: 'Admin',
                date: new Date('2024-10-14').toISOString(),
                answers: [
                    {
                        id: 1,
                        content: 'Perhaps the question is not about maintaining old forms of connection, but discovering new ones. Digital tools can enhance human connection when used intentionally, not as replacements for presence but as bridges between presences.',
                        author: 'Admin',
                        date: new Date('2024-10-14').toISOString(),
                        likes: 2,
                        dislikes: 0
                    }
                ],
                views: 0
            },
            {
                id: 3,
                question: 'What responsibilities do we have to future generations?',
                author: 'Admin',
                date: new Date('2024-10-14').toISOString(),
                answers: [],
                views: 0
            }
        ];
    }

    // Save questions to localStorage
    saveQuestions() {
        localStorage.setItem('openQuestions', JSON.stringify(this.questions));
    }

    // Get all questions
    getQuestions() {
        return this.questions;
    }

    // Get a specific question by ID
    getQuestion(id) {
        return this.questions.find(q => q.id === id);
    }

    // Add a new answer to a question
    addAnswer(questionId, content, author) {
        const question = this.getQuestion(questionId);
        if (!question) return false;

        const answer = {
            id: question.answers.length + 1,
            content,
            author: author || 'Anonymous',
            date: new Date().toISOString(),
            likes: 0,
            dislikes: 0
        };

        question.answers.push(answer);
        this.saveQuestions();
        return answer;
    }

    // Vote on an answer
    vote(questionId, answerId, voteType) {
        const question = this.getQuestion(questionId);
        if (!question) return false;

        const answer = question.answers.find(a => a.id === answerId);
        if (!answer) return false;

        // Check if user already voted
        const voteKey = `vote_q${questionId}_a${answerId}`;
        const existingVote = localStorage.getItem(voteKey);

        if (existingVote === voteType) {
            // Remove vote
            if (voteType === 'like') {
                answer.likes = Math.max(0, answer.likes - 1);
            } else {
                answer.dislikes = Math.max(0, answer.dislikes - 1);
            }
            localStorage.removeItem(voteKey);
        } else {
            // Change or add vote
            if (existingVote) {
                // Remove previous vote
                if (existingVote === 'like') {
                    answer.likes = Math.max(0, answer.likes - 1);
                } else {
                    answer.dislikes = Math.max(0, answer.dislikes - 1);
                }
            }
            
            // Add new vote
            if (voteType === 'like') {
                answer.likes++;
            } else {
                answer.dislikes++;
            }
            localStorage.setItem(voteKey, voteType);
        }

        this.saveQuestions();
        return true;
    }

    // Get user's vote on an answer
    getUserVote(questionId, answerId) {
        const voteKey = `vote_q${questionId}_a${answerId}`;
        return localStorage.getItem(voteKey);
    }

    // Increment question views
    incrementViews(questionId) {
        const question = this.getQuestion(questionId);
        if (question) {
            question.views++;
            this.saveQuestions();
        }
    }

    // Add a new question
    addQuestion(questionText, author) {
        const newQuestion = {
            id: Math.max(...this.questions.map(q => q.id), 0) + 1,
            question: questionText,
            author: author || 'Anonymous',
            date: new Date().toISOString(),
            answers: [],
            views: 0
        };

        this.questions.unshift(newQuestion);
        this.saveQuestions();
        return newQuestion;
    }

    // Format date for display
    formatDate(isoDate) {
        const date = new Date(isoDate);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 30) return `${days}d ago`;
        
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    // Generate HTML for questions list
    generateQuestionsListHTML() {
        const questions = this.getQuestions();
        
        return `
            <div class="questions-intro fade-in">
                <h2>Open Questions</h2>
                <p>
                    Questions without easy answers. Questions that invite reflection, dialogue, and exploration. 
                    Share your questions and perspectives about being human in this complex world.
                </p>
            </div>

            <div class="questions-stats fade-in">
                <div class="stat">
                    <span class="stat-number">${questions.length}</span>
                    <span class="stat-label">Questions</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${questions.reduce((sum, q) => sum + q.answers.length, 0)}</span>
                    <span class="stat-label">Answers</span>
                </div>
            </div>

            <button class="ask-question-btn" onclick="showNewQuestionForm()">Ask a Question</button>

            <div class="questions-list fade-in">
                ${questions.map(question => `
                    <article class="question-card" onclick="viewQuestion(${question.id})">
                        <h3 class="question-text">${question.question}</h3>
                        <div class="question-meta">
                            <span class="question-author">Asked by ${question.author}</span>
                            <span class="question-date">${this.formatDate(question.date)}</span>
                            <div class="question-stats-inline">
                                <span>${question.answers.length} answer${question.answers.length !== 1 ? 's' : ''}</span>
                                <span>${question.views} view${question.views !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    </article>
                `).join('')}
            </div>

            <nav class="back-link">
                <a href="/">← Back to Home</a>
            </nav>
        `;
    }

    // Generate HTML for a single question view
    generateQuestionViewHTML(questionId) {
        const question = this.getQuestion(questionId);
        if (!question) return '<p>Question not found</p>';

        this.incrementViews(questionId);

        return `
            <div class="question-view fade-in">
                <button class="back-button" onclick="showQuestionsList()">← Back to Questions</button>
                
                <div class="question-header">
                    <h1>${question.question}</h1>
                    <div class="question-info">
                        <span>Asked by <strong>${question.author}</strong></span>
                        <span>${this.formatDate(question.date)}</span>
                        <span>${question.views} views</span>
                    </div>
                </div>

                <div class="answers-section">
                    <h2>Responses (${question.answers.length})</h2>
                    
                    ${question.answers.length > 0 ? `
                        <div class="answers-list">
                            ${question.answers.map(answer => this.generateAnswerHTML(questionId, answer)).join('')}
                        </div>
                    ` : `
                        <p style="text-align: center; color: var(--text-medium); font-style: italic; margin: 30px 0;">
                            No responses yet. Be the first to share your perspective.
                        </p>
                    `}

                    <div class="answer-form">
                        <h3>Share Your Perspective</h3>
                        <input type="text" 
                               id="answerAuthor" 
                               placeholder="Your name (optional)" 
                               class="form-input"
                               value="${localStorage.getItem('questionsUsername') || ''}">
                        <textarea id="answerContent" 
                                  placeholder="Share your thoughts, perspective, or answer..." 
                                  class="form-textarea"
                                  rows="5"></textarea>
                        <button onclick="submitAnswer(${questionId})" class="submit-btn">Post Response</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Generate HTML for a single answer
    generateAnswerHTML(questionId, answer) {
        const userVote = this.getUserVote(questionId, answer.id);
        
        return `
            <div class="answer-card">
                <div class="answer-header">
                    <span class="answer-author">${answer.author}</span>
                    <span class="answer-date">${this.formatDate(answer.date)}</span>
                </div>
                <div class="answer-content">
                    ${answer.content}
                </div>
                <div class="answer-actions">
                    <button class="vote-btn ${userVote === 'like' ? 'active' : ''}" 
                            onclick="voteAnswer(${questionId}, ${answer.id}, 'like')">
                        👍 ${answer.likes}
                    </button>
                    <button class="vote-btn ${userVote === 'dislike' ? 'active' : ''}" 
                            onclick="voteAnswer(${questionId}, ${answer.id}, 'dislike')">
                        👎 ${answer.dislikes}
                    </button>
                </div>
            </div>
        `;
    }
}

// Global questions instance
const questionsSystem = new QuestionsSystem();

// Global functions for navigation
function showQuestionsList() {
    const container = document.querySelector('.questions-container');
    container.innerHTML = questionsSystem.generateQuestionsListHTML();
    history.pushState({ view: 'list' }, 'Open Questions – Humans on Planet Earth', '/contact.html');
    document.title = 'Open Questions – Humans on Planet Earth';
}

function viewQuestion(questionId) {
    const container = document.querySelector('.questions-container');
    container.innerHTML = questionsSystem.generateQuestionViewHTML(questionId);
    
    const question = questionsSystem.getQuestion(questionId);
    history.pushState({ view: 'question', questionId }, `${question.question.substring(0, 50)}... – Humans on Planet Earth`, `#question-${questionId}`);
    document.title = `Question – Humans on Planet Earth`;
}

function submitAnswer(questionId) {
    const author = document.getElementById('answerAuthor').value.trim();
    const content = document.getElementById('answerContent').value.trim();
    
    if (!content) {
        alert('Please write something in your response.');
        return;
    }

    // Save username for future use
    if (author) {
        localStorage.setItem('questionsUsername', author);
    }

    questionsSystem.addAnswer(questionId, content, author || 'Anonymous');
    viewQuestion(questionId);
    
    // Scroll to the new answer
    setTimeout(() => {
        const answersList = document.querySelector('.answers-list');
        if (answersList) {
            answersList.lastElementChild.scrollIntoView({ behavior: 'smooth' });
        }
    }, 100);
}

function voteAnswer(questionId, answerId, voteType) {
    questionsSystem.vote(questionId, answerId, voteType);
    viewQuestion(questionId);
}

function showNewQuestionForm() {
    const container = document.querySelector('.questions-container');
    container.innerHTML = `
        <div class="question-view fade-in">
            <button class="back-button" onclick="showQuestionsList()">← Back to Questions</button>
            
            <div class="new-question-form">
                <h2>Ask a Question</h2>
                <p style="color: var(--text-medium); margin-bottom: 20px;">
                    Ask questions that invite reflection and dialogue. Questions about life, humanity, society, or existence.
                </p>
                <input type="text" 
                       id="questionAuthor" 
                       placeholder="Your name (optional)" 
                       class="form-input"
                       value="${localStorage.getItem('questionsUsername') || ''}">
                <textarea id="questionText" 
                          placeholder="What question would you like to explore?" 
                          class="form-textarea"
                          rows="4"></textarea>
                <button onclick="submitNewQuestion()" class="submit-btn">Ask Question</button>
            </div>
        </div>
    `;
}

function submitNewQuestion() {
    const author = document.getElementById('questionAuthor').value.trim();
    const questionText = document.getElementById('questionText').value.trim();
    
    if (!questionText) {
        alert('Please enter your question.');
        return;
    }

    // Save username for future use
    if (author) {
        localStorage.setItem('questionsUsername', author);
    }

    const newQuestion = questionsSystem.addQuestion(questionText, author || 'Anonymous');
    viewQuestion(newQuestion.id);
}

// Handle browser back/forward
window.addEventListener('popstate', (event) => {
    if (event.state) {
        if (event.state.view === 'question') {
            viewQuestion(event.state.questionId);
        } else {
            showQuestionsList();
        }
    }
});

// Initialize questions when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('blog')) {
        // Check for hash in URL
        const hash = window.location.hash;
        const questionMatch = hash.match(/#question-(\d+)/);
        
        if (questionMatch) {
            viewQuestion(parseInt(questionMatch[1]));
        } else {
            showQuestionsList();
        }
    }
});

