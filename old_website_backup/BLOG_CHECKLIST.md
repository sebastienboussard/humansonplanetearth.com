# Blog Post Checklist

## 🚀 Quick Start (3 Steps)

### 1. Create the Post
- [ ] Copy `blog-template.html` to `blog/your-post-name.html`
- [ ] Update the title in the `<title>` tag
- [ ] Update the main `<h1>` heading
- [ ] Set the date in the blog-meta section
- [ ] Write your content (replace all placeholder text)

### 2. Add to Blog List
- [ ] Open `blog.html`
- [ ] Add your new post to the blog-list section:
```html
<article class="blog-post">
  <a href="blog/your-post-name.html">
    <h2>Your Post Title</h2>
    <p>Brief description of your post</p>
  </a>
</article>
```

### 3. Update SEO
- [ ] Open `config/sitemap.xml`
- [ ] Add your new post URL:
```xml
<url>
  <loc>https://humansonplanetearth.com/blog/your-post-name.html</loc>
  <lastmod>2025-01-27</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.6</priority>
</url>
```

## 📝 Content Guidelines

### Writing Tips
- Keep paragraphs short and readable
- Use headings to break up content
- Include blockquotes for important points
- Add lists when appropriate
- End with a thought-provoking conclusion

### HTML Elements You Can Use
- `<h2>` for main sections
- `<h3>` for subsections
- `<p>` for paragraphs
- `<blockquote>` for quotes
- `<ul>` and `<ol>` for lists
- `<em>` for emphasis
- `<strong>` for important text

### Example Structure
```html
<h2>Main Section</h2>
<p>Your content here...</p>

<blockquote>
An important quote or thought
</blockquote>

<h3>Subsection</h3>
<p>More content...</p>

<ul>
  <li>Point one</li>
  <li>Point two</li>
  <li>Point three</li>
</ul>
```

## 🎯 Publishing Checklist

Before publishing, make sure:
- [ ] All placeholder text is replaced
- [ ] Title and date are correct
- [ ] Post is added to blog.html
- [ ] Sitemap is updated
- [ ] Links work correctly
- [ ] Content is proofread

## 💡 Pro Tips

1. **Use the Blog Creator Script**: Run `create-post.js` in your browser console for automated post creation
2. **Keep Filenames Simple**: Use lowercase with hyphens (e.g., `my-awesome-post.html`)
3. **Write Descriptions**: Create compelling descriptions for the blog list
4. **Update Stats**: Remember to update the post count in blog.html when you add posts

## 🔧 Troubleshooting

**Post not showing up?**
- Check that the filename in the link matches your actual file
- Make sure the file is in the `blog/` folder
- Verify the HTML structure is correct

**Styling looks wrong?**
- Ensure the CSS path is correct: `../assets/css/style.css`
- Check that all HTML tags are properly closed

**Links broken?**
- Test all internal links
- Make sure the back link points to `../blog.html` 