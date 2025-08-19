// Blog Parser - Converts text files, Word docs, and PDFs to HTML blog posts
class BlogParser {
    constructor() {
        this.posts = [];
        this.postsLoaded = false;
    }

    // Parse front matter (metadata between ---)
    parseFrontMatter(content) {
        const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
        const match = content.match(frontMatterRegex);
        
        if (!match) {
            return {
                metadata: {},
                content: content
            };
        }

        const frontMatter = match[1];
        const bodyContent = match[2];
        const metadata = {};

        // Parse YAML-like front matter
        frontMatter.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
                const value = valueParts.join(':').trim();
                metadata[key.trim()] = value;
            }
        });

        return { metadata, content: bodyContent };
    }

    // Extract metadata from Word document title and content
    extractMetadataFromContent(content, filename) {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length === 0) return { metadata: {}, content };

        // Assume first line is title
        const title = lines[0].replace(/^#+\s*/, '').trim();
        const slug = filename.replace(/\.(txt|docx|pdf)$/i, '').toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-');

        const metadata = {
            title,
            slug,
            date: new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }),
            description: lines.slice(1, 3).join(' ').substring(0, 150) + '...',
            tags: 'imported'
        };

        // Remove title from content if it's the first line
        const bodyContent = lines.slice(1).join('\n\n');

        return { metadata, content: bodyContent };
    }

    // Convert markdown-like syntax to HTML
    parseContent(content) {
        let html = content;

        // Headers
        html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

        // Bold and italic
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Blockquotes
        html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');

        // Lists
        html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

        // Paragraphs (convert double newlines to paragraph breaks)
        const paragraphs = html.split('\n\n').map(p => {
            p = p.trim();
            if (!p) return '';
            
            // Don't wrap headers, lists, or blockquotes in paragraphs
            if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<blockquote')) {
                return p;
            }
            
            return `<p>${p.replace(/\n/g, '<br>')}</p>`;
        }).filter(p => p);

        return paragraphs.join('\n\n');
    }

    // Parse Word document (.docx)
    async parseWordDocument(file) {
        try {
            // Load mammoth.js library for Word parsing
            if (!window.mammoth) {
                await this.loadMammothJS();
            }

            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            
            return result.value; // Plain text content
        } catch (error) {
            console.error('Error parsing Word document:', error);
            throw new Error('Failed to parse Word document. Please ensure it\'s a valid .docx file.');
        }
    }

    // Parse PDF document
    async parsePDF(file) {
        try {
            // Load PDF.js library
            if (!window.pdfjsLib) {
                await this.loadPDFJS();
            }

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            let fullText = '';
            
            // Extract text from all pages
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n\n';
            }
            
            return fullText.trim();
        } catch (error) {
            console.error('Error parsing PDF:', error);
            throw new Error('Failed to parse PDF document. Please ensure it\'s a valid PDF file.');
        }
    }

    // Load mammoth.js library for Word document parsing
    async loadMammothJS() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Load PDF.js library for PDF parsing
    async loadPDFJS() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                // Set worker path
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Process uploaded file (Word, PDF, or text)
    async processUploadedFile(file) {
        const filename = file.name;
        const extension = filename.split('.').pop().toLowerCase();
        
        let content = '';
        
        try {
            switch (extension) {
                case 'docx':
                    content = await this.parseWordDocument(file);
                    break;
                case 'pdf':
                    content = await this.parsePDF(file);
                    break;
                case 'txt':
                    content = await file.text();
                    break;
                default:
                    throw new Error('Unsupported file type. Please upload .txt, .docx, or .pdf files.');
            }

            // Check if content has front matter, if not extract from content
            const { metadata, content: bodyContent } = content.includes('---') 
                ? this.parseFrontMatter(content)
                : this.extractMetadataFromContent(content, filename);

            return {
                filename,
                slug: metadata.slug || filename.replace(/\.(txt|docx|pdf)$/i, ''),
                title: metadata.title || 'Untitled',
                date: metadata.date || new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                }),
                description: metadata.description || '',
                tags: metadata.tags ? (typeof metadata.tags === 'string' ? metadata.tags.split(',').map(t => t.trim()) : metadata.tags) : [],
                content: this.parseContent(bodyContent),
                rawContent: bodyContent,
                isUploaded: true
            };
        } catch (error) {
            console.error('Error processing file:', error);
            throw error;
        }
    }

    // Load a single post from text file
    async loadPost(filename) {
        try {
            const response = await fetch(`posts/${filename}`);
            if (!response.ok) throw new Error(`Failed to load ${filename}`);
            
            const content = await response.text();
            const { metadata, content: bodyContent } = this.parseFrontMatter(content);
            
            return {
                filename,
                slug: metadata.slug || filename.replace('.txt', ''),
                title: metadata.title || 'Untitled',
                date: metadata.date || 'No date',
                description: metadata.description || '',
                tags: metadata.tags ? metadata.tags.split(',').map(t => t.trim()) : [],
                content: this.parseContent(bodyContent),
                rawContent: bodyContent,
                isUploaded: false
            };
        } catch (error) {
            console.error(`Error loading post ${filename}:`, error);
            return null;
        }
    }

    // Load all posts
    async loadAllPosts() {
        // For now, we'll manually list the posts
        // In a real system, you'd have an index file or API endpoint
        const postFiles = [
            'the-first-human.txt',
            'humanitys-greatest-weapon.txt'
        ];

        const postPromises = postFiles.map(filename => this.loadPost(filename));
        const posts = await Promise.all(postPromises);
        
        this.posts = posts.filter(post => post !== null);
        this.postsLoaded = true;
        
        // Sort by date (newest first)
        this.posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return this.posts;
    }

    // Add uploaded post to the collection
    addUploadedPost(post) {
        // Remove any existing post with the same slug
        this.posts = this.posts.filter(p => p.slug !== post.slug);
        
        // Add the new post
        this.posts.unshift(post);
        
        // Sort by date
        this.posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // Get all posts
    async getPosts() {
        if (!this.postsLoaded) {
            await this.loadAllPosts();
        }
        return this.posts;
    }

    // Get a specific post by slug
    async getPost(slug) {
        const posts = await this.getPosts();
        return posts.find(post => post.slug === slug);
    }

    // Generate HTML for blog list
    generateBlogListHTML(posts) {
        return posts.map(post => `
            <article class="blog-post">
                <a href="javascript:void(0)" onclick="viewPost('${post.slug}')">
                    <h2>${post.title}</h2>
                    <p>${post.description}</p>
                    <div class="post-meta">
                        <span class="post-date">${post.date}</span>
                        ${post.tags.length > 0 ? `<span class="post-tags">${post.tags.map(tag => `#${tag}`).join(' ')}</span>` : ''}
                        ${post.isUploaded ? '<span class="upload-badge">📄 Uploaded</span>' : ''}
                    </div>
                </a>
            </article>
        `).join('');
    }

    // Generate HTML for a single post
    generatePostHTML(post) {
        return `
            <div class="blog-post-container fade-in">
                <h1>${post.title}</h1>
                <div class="blog-meta">
                    <span class="blog-date">${post.date}</span>
                    ${post.tags.length > 0 ? `<div class="post-tags">${post.tags.map(tag => `<span class="tag">#${tag}</span>`).join(' ')}</div>` : ''}
                    ${post.isUploaded ? '<div class="upload-info">📄 Created from uploaded document</div>' : ''}
                </div>
                <div class="post-content">
                    ${post.content}
                </div>
                <div class="back-link">
                    <a href="javascript:void(0)" onclick="showBlogList()">← Back to Thoughts</a>
                </div>
            </div>
        `;
    }
}

// Global blog parser instance
const blogParser = new BlogParser();

// Global functions for navigation
async function viewPost(slug) {
    const post = await blogParser.getPost(slug);
    if (!post) {
        console.error('Post not found:', slug);
        return;
    }

    const container = document.querySelector('.blog-container');
    container.innerHTML = blogParser.generatePostHTML(post);
    
    // Update URL without page reload
    history.pushState({ view: 'post', slug }, post.title, `#${slug}`);
    document.title = `${post.title} – Humans on Planet Earth`;
}

async function showBlogList() {
    const posts = await blogParser.getPosts();
    const container = document.querySelector('.blog-container');
    
    container.innerHTML = `
        <div class="blog-header fade-in">
            <h2>Reflections & Stories</h2>
            <p>
                A collection of thoughts, questions, and stories that explore what it means to be human. 
                Each post is a window into the human experience, inviting reflection and conversation.
            </p>
        </div>

        <div class="blog-stats fade-in">
            <div class="stat">
                <span class="stat-number">${posts.length}</span>
                <span class="stat-label">Posts</span>
            </div>
            <div class="stat">
                <span class="stat-number">∞</span>
                <span class="stat-label">Possibilities</span>
            </div>
        </div>

        <div class="new-post-section fade-in">
            <h3>📝 Want to Add a New Post?</h3>
            <p>Creating a new blog post is simple with multiple options:</p>
            
            <div class="new-post-steps">
                <div class="step">
                    <div class="step-number">1</div>
                    <h4>Upload Document</h4>
                    <p>Upload a Word (.docx), PDF, or text file directly.</p>
                </div>
                
                <div class="step">
                    <div class="step-number">2</div>
                    <h4>Use Creator Tool</h4>
                    <p>Use our web-based creator for guided post creation.</p>
                </div>
                
                <div class="step">
                    <div class="step-number">3</div>
                    <h4>Create Text File</h4>
                    <p>Manually create a .txt file in the posts/ folder.</p>
                </div>
                
                <div class="step">
                    <div class="step-number">4</div>
                    <h4>Auto-Publish</h4>
                    <p>Uploaded files appear instantly, text files need to be added to the list.</p>
                </div>
            </div>
            
            <div style="margin-top: 20px; display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                <input type="file" id="fileUpload" accept=".txt,.docx,.pdf" style="display: none;">
                <button onclick="document.getElementById('fileUpload').click()" class="upload-btn">
                    📄 Upload Document
                </button>
                <a href="/create-blog-post.html" class="template-link">
                    ✏️ Use Creator Tool
                </a>
            </div>
        </div>

        <section class="blog-list fade-in">
            <h3 style="text-align: center; color: var(--primary-dark); margin-bottom: 30px;">Latest Posts</h3>
            ${blogParser.generateBlogListHTML(posts)}
        </section>

        <nav class="back-link">
            <a href="/">← Back to Home</a>
        </nav>
    `;
    
    // Add file upload handler
    document.getElementById('fileUpload').addEventListener('change', handleFileUpload);
    
    // Update URL and title
    history.pushState({ view: 'list' }, 'Human Thoughts – Humans on Planet Earth', '/blog.html');
    document.title = 'Human Thoughts – Humans on Planet Earth';
}

// Handle file upload
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const uploadBtn = document.querySelector('.upload-btn');
    const originalText = uploadBtn.textContent;
    
    try {
        uploadBtn.textContent = '⏳ Processing...';
        uploadBtn.disabled = true;
        
        const post = await blogParser.processUploadedFile(file);
        blogParser.addUploadedPost(post);
        
        // Refresh the blog list to show the new post
        showBlogList();
        
        // Show success message
        setTimeout(() => {
            alert(`✅ Successfully added "${post.title}" to your blog!`);
        }, 100);
        
    } catch (error) {
        alert(`❌ Error processing file: ${error.message}`);
        uploadBtn.textContent = originalText;
        uploadBtn.disabled = false;
    }
    
    // Reset file input
    event.target.value = '';
}

// Handle browser back/forward
window.addEventListener('popstate', (event) => {
    if (event.state) {
        if (event.state.view === 'post') {
            viewPost(event.state.slug);
        } else {
            showBlogList();
        }
    }
});

// Initialize blog when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the blog page
    if (document.body.classList.contains('blog')) {
        // Check for hash in URL
        const hash = window.location.hash.slice(1);
        if (hash) {
            viewPost(hash);
        } else {
            showBlogList();
        }
    }
}); 