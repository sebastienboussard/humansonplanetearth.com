// Forum Discussion System with Topics, Replies, and Voting
class ForumSystem {
    constructor() {
        this.topics = this.loadTopics();
        this.currentTopic = null;
    }

    // Load topics from localStorage
    loadTopics() {
        const stored = localStorage.getItem('forumTopics');
        if (stored) {
            return JSON.parse(stored);
        }
        
        // Default topics
        return [
            {
                id: 1,
                title: 'AI',
                description: 'Discuss artificial intelligence, its impact on society, ethics, and the future of human-AI interaction.',
                author: 'Admin',
                date: new Date('2024-10-14').toISOString(),
                replies: [
                    {
                        id: 1,
                        content: 'AI is fundamentally changing how we work, create, and think. What concerns me most is ensuring it remains a tool that enhances human capability rather than replaces human agency.',
                        author: 'Admin',
                        date: new Date('2024-10-14').toISOString(),
                        likes: 5,
                        dislikes: 0
                    }
                ],
                views: 0
            },
            {
                id: 2,
                title: 'Curated Algorithms',
                description: 'Explore how algorithms shape our media consumption, social interactions, and understanding of the world.',
                author: 'Admin',
                date: new Date('2024-10-14').toISOString(),
                replies: [
                    {
                        id: 1,
                        content: 'The algorithms that curate our content are making invisible choices about what we see, hear, and believe. How do we reclaim agency in a world where our information diet is predetermined by machines?',
                        author: 'Admin',
                        date: new Date('2024-10-14').toISOString(),
                        likes: 3,
                        dislikes: 0
                    }
                ],
                views: 0
            }
        ];
    }

    // Save topics to localStorage
    saveTopics() {
        localStorage.setItem('forumTopics', JSON.stringify(this.topics));
    }

    // Get all topics
    getTopics() {
        return this.topics;
    }

    // Get a specific topic by ID
    getTopic(id) {
        return this.topics.find(t => t.id === id);
    }

    // Add a new reply to a topic
    addReply(topicId, content, author) {
        const topic = this.getTopic(topicId);
        if (!topic) return false;

        const reply = {
            id: topic.replies.length + 1,
            content,
            author: author || 'Anonymous',
            date: new Date().toISOString(),
            likes: 0,
            dislikes: 0
        };

        topic.replies.push(reply);
        this.saveTopics();
        return reply;
    }

    // Vote on a reply
    vote(topicId, replyId, voteType) {
        const topic = this.getTopic(topicId);
        if (!topic) return false;

        const reply = topic.replies.find(r => r.id === replyId);
        if (!reply) return false;

        // Check if user already voted
        const voteKey = `vote_${topicId}_${replyId}`;
        const existingVote = localStorage.getItem(voteKey);

        if (existingVote === voteType) {
            // Remove vote
            if (voteType === 'like') {
                reply.likes = Math.max(0, reply.likes - 1);
            } else {
                reply.dislikes = Math.max(0, reply.dislikes - 1);
            }
            localStorage.removeItem(voteKey);
        } else {
            // Change or add vote
            if (existingVote) {
                // Remove previous vote
                if (existingVote === 'like') {
                    reply.likes = Math.max(0, reply.likes - 1);
                } else {
                    reply.dislikes = Math.max(0, reply.dislikes - 1);
                }
            }
            
            // Add new vote
            if (voteType === 'like') {
                reply.likes++;
            } else {
                reply.dislikes++;
            }
            localStorage.setItem(voteKey, voteType);
        }

        this.saveTopics();
        return true;
    }

    // Get user's vote on a reply
    getUserVote(topicId, replyId) {
        const voteKey = `vote_${topicId}_${replyId}`;
        return localStorage.getItem(voteKey);
    }

    // Increment topic views
    incrementViews(topicId) {
        const topic = this.getTopic(topicId);
        if (topic) {
            topic.views++;
            this.saveTopics();
        }
    }

    // Add a new topic
    addTopic(title, description, author) {
        const newTopic = {
            id: Math.max(...this.topics.map(t => t.id), 0) + 1,
            title,
            description,
            author: author || 'Anonymous',
            date: new Date().toISOString(),
            replies: [],
            views: 0
        };

        this.topics.unshift(newTopic);
        this.saveTopics();
        return newTopic;
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

    // Generate HTML for topics list
    generateTopicsListHTML() {
        const topics = this.getTopics();
        
        return `
            <div class="forum-header fade-in">
                <h2>Discussion Topics</h2>
                <p>Explore meaningful conversations about technology, society, and the human experience.</p>
            </div>

            <div class="forum-stats fade-in">
                <div class="stat">
                    <span class="stat-number">${topics.length}</span>
                    <span class="stat-label">Topics</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${topics.reduce((sum, t) => sum + t.replies.length, 0)}</span>
                    <span class="stat-label">Replies</span>
                </div>
            </div>

            <button class="new-topic-btn" onclick="showNewTopicForm()">+ New Topic</button>

            <div class="topics-list fade-in">
                ${topics.map(topic => `
                    <article class="topic-card" onclick="viewTopic(${topic.id})">
                        <div class="topic-main">
                            <h3 class="topic-title">${topic.title}</h3>
                            <p class="topic-description">${topic.description}</p>
                            <div class="topic-meta">
                                <span class="topic-author">by ${topic.author}</span>
                                <span class="topic-date">${this.formatDate(topic.date)}</span>
                            </div>
                        </div>
                        <div class="topic-stats">
                            <div class="topic-stat">
                                <span class="stat-value">${topic.replies.length}</span>
                                <span class="stat-label">Replies</span>
                            </div>
                            <div class="topic-stat">
                                <span class="stat-value">${topic.views}</span>
                                <span class="stat-label">Views</span>
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

    // Generate HTML for a single topic view
    generateTopicViewHTML(topicId) {
        const topic = this.getTopic(topicId);
        if (!topic) return '<p>Topic not found</p>';

        this.incrementViews(topicId);

        return `
            <div class="topic-view fade-in">
                <button class="back-button" onclick="showTopicsList()">← Back to Topics</button>
                
                <div class="topic-header">
                    <h1>${topic.title}</h1>
                    <p class="topic-description">${topic.description}</p>
                    <div class="topic-info">
                        <span>Started by <strong>${topic.author}</strong></span>
                        <span>${this.formatDate(topic.date)}</span>
                        <span>${topic.views} views</span>
                    </div>
                </div>

                <div class="replies-section">
                    <h2>Replies (${topic.replies.length})</h2>
                    
                    <div class="replies-list">
                        ${topic.replies.map(reply => this.generateReplyHTML(topicId, reply)).join('')}
                    </div>

                    <div class="reply-form">
                        <h3>Add Your Reply</h3>
                        <input type="text" 
                               id="replyAuthor" 
                               placeholder="Your name (optional)" 
                               class="reply-input"
                               value="${localStorage.getItem('forumUsername') || ''}">
                        <textarea id="replyContent" 
                                  placeholder="Share your thoughts..." 
                                  class="reply-textarea"
                                  rows="5"></textarea>
                        <button onclick="submitReply(${topicId})" class="submit-reply-btn">Post Reply</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Generate HTML for a single reply
    generateReplyHTML(topicId, reply) {
        const userVote = this.getUserVote(topicId, reply.id);
        
        return `
            <div class="reply-card">
                <div class="reply-header">
                    <span class="reply-author">${reply.author}</span>
                    <span class="reply-date">${this.formatDate(reply.date)}</span>
                </div>
                <div class="reply-content">
                    ${reply.content}
                </div>
                <div class="reply-actions">
                    <button class="vote-btn ${userVote === 'like' ? 'active' : ''}" 
                            onclick="voteReply(${topicId}, ${reply.id}, 'like')">
                        👍 ${reply.likes}
                    </button>
                    <button class="vote-btn ${userVote === 'dislike' ? 'active' : ''}" 
                            onclick="voteReply(${topicId}, ${reply.id}, 'dislike')">
                        👎 ${reply.dislikes}
                    </button>
                </div>
            </div>
        `;
    }
}

// Global forum instance
const forum = new ForumSystem();

// Global functions for navigation
function showTopicsList() {
    const container = document.querySelector('.blog-container');
    container.innerHTML = forum.generateTopicsListHTML();
    history.pushState({ view: 'list' }, 'Discussion Topics – Humans on Planet Earth', '/blog.html');
    document.title = 'Discussion Topics – Humans on Planet Earth';
}

function viewTopic(topicId) {
    const container = document.querySelector('.blog-container');
    container.innerHTML = forum.generateTopicViewHTML(topicId);
    
    const topic = forum.getTopic(topicId);
    history.pushState({ view: 'topic', topicId }, `${topic.title} – Humans on Planet Earth`, `#topic-${topicId}`);
    document.title = `${topic.title} – Humans on Planet Earth`;
}

function submitReply(topicId) {
    const author = document.getElementById('replyAuthor').value.trim();
    const content = document.getElementById('replyContent').value.trim();
    
    if (!content) {
        alert('Please write something in your reply.');
        return;
    }

    // Save username for future use
    if (author) {
        localStorage.setItem('forumUsername', author);
    }

    forum.addReply(topicId, content, author || 'Anonymous');
    viewTopic(topicId);
    
    // Scroll to the new reply
    setTimeout(() => {
        const repliesList = document.querySelector('.replies-list');
        if (repliesList) {
            repliesList.lastElementChild.scrollIntoView({ behavior: 'smooth' });
        }
    }, 100);
}

function voteReply(topicId, replyId, voteType) {
    forum.vote(topicId, replyId, voteType);
    viewTopic(topicId);
}

function showNewTopicForm() {
    const container = document.querySelector('.blog-container');
    container.innerHTML = `
        <div class="topic-view fade-in">
            <button class="back-button" onclick="showTopicsList()">← Back to Topics</button>
            
            <div class="new-topic-form">
                <h2>Create New Topic</h2>
                <input type="text" 
                       id="topicAuthor" 
                       placeholder="Your name (optional)" 
                       class="reply-input"
                       value="${localStorage.getItem('forumUsername') || ''}">
                <input type="text" 
                       id="topicTitle" 
                       placeholder="Topic title" 
                       class="reply-input">
                <textarea id="topicDescription" 
                          placeholder="Describe what this topic is about..." 
                          class="reply-textarea"
                          rows="4"></textarea>
                <button onclick="submitNewTopic()" class="submit-reply-btn">Create Topic</button>
            </div>
        </div>
    `;
}

function submitNewTopic() {
    const author = document.getElementById('topicAuthor').value.trim();
    const title = document.getElementById('topicTitle').value.trim();
    const description = document.getElementById('topicDescription').value.trim();
    
    if (!title || !description) {
        alert('Please fill in both the title and description.');
        return;
    }

    // Save username for future use
    if (author) {
        localStorage.setItem('forumUsername', author);
    }

    const newTopic = forum.addTopic(title, description, author || 'Anonymous');
    viewTopic(newTopic.id);
}

// Handle browser back/forward
window.addEventListener('popstate', (event) => {
    if (event.state) {
        if (event.state.view === 'topic') {
            viewTopic(event.state.topicId);
        } else {
            showTopicsList();
        }
    }
});

// Initialize forum when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('blog')) {
        // Check for hash in URL
        const hash = window.location.hash;
        const topicMatch = hash.match(/#topic-(\d+)/);
        
        if (topicMatch) {
            viewTopic(parseInt(topicMatch[1]));
        } else {
            showTopicsList();
        }
    }
});

