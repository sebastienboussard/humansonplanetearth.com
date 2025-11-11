// Enhanced user experience for Humans on Planet Earth

document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add loading states to links
    document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', function() {
            if (this.href && this.href !== window.location.href) {
                this.style.opacity = '0.7';
                this.style.pointerEvents = 'none';
            }
        });
    });

    // Enhanced focus management for accessibility
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            document.body.classList.add('keyboard-navigation');
        }
    });

    document.addEventListener('mousedown', function() {
        document.body.classList.remove('keyboard-navigation');
    });

    // Add skip link for accessibility
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.textContent = 'Skip to main content';
    skipLink.className = 'skip-link';
    skipLink.style.cssText = `
        position: absolute;
        top: -40px;
        left: 6px;
        background: #8c7b6b;
        color: white;
        padding: 8px;
        text-decoration: none;
        border-radius: 4px;
        z-index: 10000;
        transition: top 0.3s;
    `;
    
    skipLink.addEventListener('focus', function() {
        this.style.top = '6px';
    });
    
    skipLink.addEventListener('blur', function() {
        this.style.top = '-40px';
    });

    document.body.insertBefore(skipLink, document.body.firstChild);

    // Add main content ID for skip link
    const mainContent = document.querySelector('main');
    if (mainContent) {
        mainContent.id = 'main-content';
    }

    // Performance optimization: Intersection Observer for animations
    if ('IntersectionObserver' in window) {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);

        // Observe elements that should animate on scroll
        document.querySelectorAll('.blog-post, .blog-post-container').forEach(el => {
            observer.observe(el);
        });
    }

    // Add CSS for keyboard navigation indicator
    const style = document.createElement('style');
    style.textContent = `
        .keyboard-navigation *:focus {
            outline: 2px solid #8c7b6b !important;
            outline-offset: 2px !important;
        }
        
        .blog-post:not(.visible) {
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.6s ease, transform 0.6s ease;
        }
        
        .blog-post.visible {
            opacity: 1;
            transform: translateY(0);
        }
        
        .blog-post-container:not(.visible) {
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.6s ease, transform 0.6s ease;
        }
        
        .blog-post-container.visible {
            opacity: 1;
            transform: translateY(0);
        }
    `;
    document.head.appendChild(style);

    // Service Worker registration for PWA features
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
            navigator.serviceWorker.register('/sw.js')
                .then(function(registration) {
                    console.log('ServiceWorker registration successful');
                })
                .catch(function(err) {
                    console.log('ServiceWorker registration failed');
                });
        });
    }

    // Add reading time estimation for blog posts
    function addReadingTime() {
        const articles = document.querySelectorAll('.blog-post-container');
        articles.forEach(article => {
            const text = article.textContent || article.innerText;
            const wordCount = text.trim().split(/\s+/).length;
            const readingTime = Math.ceil(wordCount / 200); // Average reading speed
            
            const readingTimeElement = document.createElement('div');
            readingTimeElement.className = 'reading-time';
            readingTimeElement.textContent = `${readingTime} min read`;
            readingTimeElement.style.cssText = `
                color: #8c7b6b;
                font-size: 0.9rem;
                margin-top: 10px;
                font-style: italic;
            `;
            
            const meta = article.querySelector('.blog-meta');
            if (meta) {
                meta.appendChild(readingTimeElement);
            }
        });
    }

    // Only add reading time on blog post pages
    if (document.body.classList.contains('blog-post')) {
        addReadingTime();
    }
});

// Add error handling for images
document.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG') {
        e.target.style.display = 'none';
    }
}, true); 