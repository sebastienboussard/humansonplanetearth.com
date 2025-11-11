// Essay Hub - Main JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // Mobile menu functionality
  initMobileMenu();
  
  // Smooth scrolling for anchor links
  initSmoothScrolling();
  
  // Form enhancements
  initFormEnhancements();
  
  // Search functionality
  initSearchFunctionality();
  
  // Animation on scroll
  initScrollAnimations();
  
  // Theme and accessibility
  initAccessibilityFeatures();
});

// Mobile Menu
function initMobileMenu() {
  const mobileToggle = document.querySelector('.mobile-menu-toggle');
  const mainNav = document.querySelector('.main-nav');
  
  if (mobileToggle && mainNav) {
    mobileToggle.addEventListener('click', function() {
      mainNav.classList.toggle('active');
      mobileToggle.classList.toggle('active');
      
      // Update aria-expanded attribute
      const isExpanded = mainNav.classList.contains('active');
      mobileToggle.setAttribute('aria-expanded', isExpanded);
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      if (!mobileToggle.contains(e.target) && !mainNav.contains(e.target)) {
        mainNav.classList.remove('active');
        mobileToggle.classList.remove('active');
        mobileToggle.setAttribute('aria-expanded', 'false');
      }
    });
    
    // Close menu on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && mainNav.classList.contains('active')) {
        mainNav.classList.remove('active');
        mobileToggle.classList.remove('active');
        mobileToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

// Smooth Scrolling
function initSmoothScrolling() {
  const links = document.querySelectorAll('a[href^="#"]');
  
  links.forEach(link => {
    link.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        e.preventDefault();
        
        const headerHeight = document.querySelector('.site-header')?.offsetHeight || 0;
        const targetPosition = targetElement.offsetTop - headerHeight - 20;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// Form Enhancements
function initFormEnhancements() {
  // File upload validation
  const fileInputs = document.querySelectorAll('input[type="file"]');
  
  fileInputs.forEach(input => {
    input.addEventListener('change', function() {
      validateFileUpload(this);
    });
  });
  
  // Form submission handling
  const forms = document.querySelectorAll('form');
  
  forms.forEach(form => {
    form.addEventListener('submit', function(e) {
      if (!validateForm(this)) {
        e.preventDefault();
      }
    });
  });
  
  // Real-time validation
  const inputs = document.querySelectorAll('input[required], textarea[required]');
  
  inputs.forEach(input => {
    input.addEventListener('blur', function() {
      validateField(this);
    });
    
    input.addEventListener('input', function() {
      clearFieldError(this);
    });
  });
}

// File Upload Validation
function validateFileUpload(input) {
  const file = input.files[0];
  if (!file) return true;
  
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['.pdf', '.docx', '.doc'];
  const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
  
  // Check file type
  if (!allowedTypes.includes(fileExtension)) {
    showFieldError(input, 'Please upload a PDF, DOCX, or DOC file.');
    input.value = '';
    return false;
  }
  
  // Check file size
  if (file.size > maxSize) {
    showFieldError(input, 'File size must be less than 5MB.');
    input.value = '';
    return false;
  }
  
  clearFieldError(input);
  return true;
}

// Form Validation
function validateForm(form) {
  let isValid = true;
  const requiredFields = form.querySelectorAll('[required]');
  
  requiredFields.forEach(field => {
    if (!validateField(field)) {
      isValid = false;
    }
  });
  
  return isValid;
}

// Field Validation
function validateField(field) {
  const value = field.value.trim();
  
  // Check if required field is empty
  if (field.hasAttribute('required') && !value) {
    showFieldError(field, 'This field is required.');
    return false;
  }
  
  // Email validation
  if (field.type === 'email' && value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      showFieldError(field, 'Please enter a valid email address.');
      return false;
    }
  }
  
  // File validation
  if (field.type === 'file' && field.files.length > 0) {
    return validateFileUpload(field);
  }
  
  clearFieldError(field);
  return true;
}

// Show Field Error
function showFieldError(field, message) {
  clearFieldError(field);
  
  field.classList.add('error');
  field.style.borderColor = '#e74c3c';
  
  const errorElement = document.createElement('div');
  errorElement.className = 'field-error';
  errorElement.textContent = message;
  errorElement.style.color = '#e74c3c';
  errorElement.style.fontSize = '0.9rem';
  errorElement.style.marginTop = '0.25rem';
  
  field.parentNode.appendChild(errorElement);
}

// Clear Field Error
function clearFieldError(field) {
  field.classList.remove('error');
  field.style.borderColor = '';
  
  const existingError = field.parentNode.querySelector('.field-error');
  if (existingError) {
    existingError.remove();
  }
}

// Search Functionality
function initSearchFunctionality() {
  const searchInputs = document.querySelectorAll('[data-search]');
  
  searchInputs.forEach(input => {
    let searchTimeout;
    
    input.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        performSearch(this);
      }, 300);
    });
  });
}

// Perform Search
function performSearch(input) {
  const query = input.value.toLowerCase().trim();
  const targetSelector = input.dataset.search;
  const items = document.querySelectorAll(targetSelector);
  
  items.forEach(item => {
    const searchableText = getSearchableText(item);
    const matches = !query || searchableText.includes(query);
    
    if (matches) {
      item.style.display = '';
      item.classList.remove('hidden');
    } else {
      item.style.display = 'none';
      item.classList.add('hidden');
    }
  });
  
  // Update results count if available
  updateSearchResults(items, query);
}

// Get Searchable Text
function getSearchableText(element) {
  const searchableElements = element.querySelectorAll('[data-searchable]');
  let text = element.textContent || '';
  
  searchableElements.forEach(el => {
    text += ' ' + el.textContent;
  });
  
  return text.toLowerCase();
}

// Update Search Results
function updateSearchResults(items, query) {
  const visibleItems = Array.from(items).filter(item => 
    !item.classList.contains('hidden') && item.style.display !== 'none'
  );
  
  const countElement = document.querySelector('[data-results-count]');
  if (countElement) {
    countElement.textContent = visibleItems.length;
  }
  
  const noResultsElement = document.querySelector('[data-no-results]');
  if (noResultsElement) {
    noResultsElement.style.display = visibleItems.length === 0 ? 'block' : 'none';
  }
}

// Scroll Animations
function initScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
      }
    });
  }, observerOptions);
  
  // Observe elements with animation classes
  const animatedElements = document.querySelectorAll('.fade-in, .slide-in, .scale-in');
  animatedElements.forEach(el => observer.observe(el));
}

// Accessibility Features
function initAccessibilityFeatures() {
  // Skip to main content link
  addSkipLink();
  
  // Focus management
  initFocusManagement();
  
  // Keyboard navigation
  initKeyboardNavigation();
  
  // Reduced motion preference
  respectReducedMotion();
}

// Add Skip Link
function addSkipLink() {
  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.textContent = 'Skip to main content';
  skipLink.className = 'skip-link';
  skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 6px;
    background: var(--primary-color);
    color: white;
    padding: 8px;
    text-decoration: none;
    border-radius: 4px;
    z-index: 1000;
    transition: top 0.3s;
  `;
  
  skipLink.addEventListener('focus', function() {
    this.style.top = '6px';
  });
  
  skipLink.addEventListener('blur', function() {
    this.style.top = '-40px';
  });
  
  document.body.insertBefore(skipLink, document.body.firstChild);
}

// Focus Management
function initFocusManagement() {
  // Trap focus in modals
  const modals = document.querySelectorAll('[role="dialog"]');
  
  modals.forEach(modal => {
    modal.addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        trapFocus(e, this);
      }
    });
  });
}

// Trap Focus
function trapFocus(e, container) {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  if (e.shiftKey) {
    if (document.activeElement === firstElement) {
      lastElement.focus();
      e.preventDefault();
    }
  } else {
    if (document.activeElement === lastElement) {
      firstElement.focus();
      e.preventDefault();
    }
  }
}

// Keyboard Navigation
function initKeyboardNavigation() {
  // Arrow key navigation for card grids
  const cardGrids = document.querySelectorAll('.essay-grid, .winners-grid');
  
  cardGrids.forEach(grid => {
    const cards = grid.querySelectorAll('.essay-card, .winner-card');
    
    cards.forEach((card, index) => {
      card.setAttribute('tabindex', '0');
      
      card.addEventListener('keydown', function(e) {
        let targetIndex;
        
        switch(e.key) {
          case 'ArrowRight':
            targetIndex = Math.min(index + 1, cards.length - 1);
            break;
          case 'ArrowLeft':
            targetIndex = Math.max(index - 1, 0);
            break;
          case 'ArrowDown':
            // Move to next row (approximate)
            targetIndex = Math.min(index + 3, cards.length - 1);
            break;
          case 'ArrowUp':
            // Move to previous row (approximate)
            targetIndex = Math.max(index - 3, 0);
            break;
          case 'Enter':
          case ' ':
            // Activate the card (click first link)
            const link = card.querySelector('a');
            if (link) {
              link.click();
              e.preventDefault();
            }
            break;
          default:
            return;
        }
        
        if (targetIndex !== undefined) {
          cards[targetIndex].focus();
          e.preventDefault();
        }
      });
    });
  });
}

// Respect Reduced Motion
function respectReducedMotion() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  
  if (prefersReducedMotion.matches) {
    // Disable animations
    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    `;
    document.head.appendChild(style);
  }
}

// Utility Functions

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Format date
function formatDate(date, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(date);
}

// Copy to clipboard
function copyToClipboard(text) {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return Promise.resolve();
  }
}

// Show notification
function showNotification(message, type = 'info', duration = 5000) {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--primary-color);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-hover);
    z-index: 1000;
    transform: translateX(100%);
    transition: transform 0.3s ease;
  `;
  
  if (type === 'error') {
    notification.style.background = '#e74c3c';
  } else if (type === 'success') {
    notification.style.background = '#27ae60';
  }
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 100);
  
  // Auto remove
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, duration);
}

// Export functions for use in other scripts
window.EssayHub = {
  showNotification,
  copyToClipboard,
  formatDate,
  debounce,
  throttle
};
