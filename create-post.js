// Blog Post Creator - Makes it easy to create new blog posts
// Run this script in your browser console or save as a bookmarklet

(function() {
    'use strict';
    
    // Blog post template
    const template = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>[BLOG TITLE] – Humans on Planet Earth</title>
<link rel="stylesheet" href="../assets/css/style.css">
</head>
<body class="blog-post">
<header class="sticky-header fade-in">
<h1>Human Thoughts</h1>
</header>
<div class="blog-post-container fade-in">
<h1>[BLOG TITLE]</h1>
<div class="blog-meta">
<span class="blog-date">[DATE]</span>
</div>

<!-- Your blog content goes here -->
<p>[First paragraph of your blog post...]</p>

<h2>[Section Heading]</h2>
<p>[Your content...]</p>

<h3>[Subsection if needed]</h3>
<p>[More content...]</p>

<!-- Optional blockquote -->
<blockquote>
[A meaningful quote or highlighted thought]
</blockquote>

<!-- Optional list -->
<ul>
<li>[List item 1]</li>
<li>[List item 2]</li>
<li>[List item 3]</li>
</ul>

<p>[Concluding paragraph...]</p>

<div class="back-link">
<a href="../blog.html">← Back to Thoughts</a>
</div>
</div>
</body>
</html>`;

    // Function to create a new blog post
    function createNewPost() {
        const title = prompt('Enter your blog post title:');
        if (!title) return;
        
        const date = prompt('Enter the date (e.g., January 27, 2025):', new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }));
        if (!date) return;
        
        const filename = prompt('Enter filename (without .html):', title.toLowerCase().replace(/[^a-z0-9]/g, '-'));
        if (!filename) return;
        
        // Create the HTML content
        let content = template
            .replace(/\[BLOG TITLE\]/g, title)
            .replace(/\[DATE\]/g, date);
        
        // Create download link
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.html`;
        a.textContent = `Download ${filename}.html`;
        a.style.cssText = `
            display: block;
            background: #8c7b6b;
            color: white;
            padding: 15px;
            text-decoration: none;
            border-radius: 8px;
            margin: 20px 0;
            text-align: center;
            font-weight: bold;
        `;
        
        // Show instructions
        const instructions = document.createElement('div');
        instructions.innerHTML = `
            <div style="background: #f0e6d2; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Next Steps:</h3>
                <ol>
                    <li>Download the HTML file above</li>
                    <li>Save it as <strong>${filename}.html</strong> in your <strong>blog/</strong> folder</li>
                    <li>Edit the content in the file</li>
                    <li>Add the post to <strong>blog.html</strong> with this code:</li>
                </ol>
                <pre style="background: white; padding: 10px; border-radius: 4px; overflow-x: auto;">
&lt;article class="blog-post"&gt;
    &lt;a href="blog/${filename}.html"&gt;
        &lt;h2&gt;${title}&lt;/h2&gt;
        &lt;p&gt;[Brief description of your post]&lt;/p&gt;
    &lt;/a&gt;
&lt;/article&gt;</pre>
                <p><strong>Don't forget to update sitemap.xml!</strong></p>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(a);
        document.body.appendChild(instructions);
        
        // Scroll to the new content
        a.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Create UI
    const button = document.createElement('button');
    button.textContent = '📝 Create New Blog Post';
    button.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #8c7b6b;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    
    button.addEventListener('click', createNewPost);
    document.body.appendChild(button);
    
    console.log('Blog Post Creator loaded! Click the button in the top-right corner to create a new post.');
})(); 