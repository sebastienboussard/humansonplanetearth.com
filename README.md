# Humans on Planet Earth

**Help humans live the best human experience**

Education is Power

## About

Humans on Planet Earth (HOPE) is a website dedicated to sharing reflections, questions, and stories that explore what it means to be human. Through thoughtful content and philosophical exploration, we aim to help humans live their best human experience.

## Directory Structure

```
humansonplanetearth.com/
├── assets/
│   ├── css/
│   │   └── style.css          # Main stylesheet
│   ├── js/
│   │   ├── script.js          # Main JavaScript functionality
│   │   └── sw.js              # Service worker for PWA
│   └── images/                # Image assets (future use)
├── blog/
│   ├── why-we-listen.html     # Blog post template
│   └── the-picky-activist.html # Sample blog post
├── config/
│   ├── manifest.json          # PWA manifest
│   ├── robots.txt             # Search engine directives
│   ├── sitemap.xml            # Site structure for SEO
│   └── .htaccess              # Server configuration
├── index.html                 # Homepage
├── blog.html                  # Blog listing page
├── literature.html            # Literature page
├── 404.html                   # Custom error page
├── blog-template.html         # Template for new blog posts
├── CNAME                      # Domain configuration
└── README.md                  # This file
```

## Features

- **Responsive Design**: Optimized for all device sizes
- **Progressive Web App**: Installable with offline functionality
- **SEO Optimized**: Meta tags, sitemap, and structured data
- **Accessibility**: WCAG compliant with keyboard navigation
- **Performance**: Optimized loading with service worker caching
- **Modern Standards**: HTML5, CSS3, and ES6+ JavaScript

## Technical Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Styling**: CSS Custom Properties, Flexbox, Grid
- **Performance**: Service Worker, Resource preloading
- **SEO**: Meta tags, Open Graph, Twitter Cards
- **Accessibility**: ARIA labels, keyboard navigation, reduced motion

## Development

### Adding New Blog Posts

1. Copy `blog-template.html` to `blog/your-post-name.html`
2. Update the title, date, and content
3. Add the post to `blog.html` listing
4. Update `sitemap.xml` with the new URL

### Styling

The site uses CSS Custom Properties for consistent theming. Main variables are defined in `assets/css/style.css`:

```css
:root {
  --primary-color: #8c7b6b;
  --primary-dark: #5f4b3b;
  --background-light: #f0e6d2;
  /* ... more variables */
}
```

### Deployment

The site is configured for deployment on GitHub Pages or any static hosting service. The `.htaccess` file provides additional server optimizations for Apache servers.

## License

This project is open source and available under the [MIT License](LICENSE).

## Contact

For questions or contributions, please reach out through the website or GitHub repository.
