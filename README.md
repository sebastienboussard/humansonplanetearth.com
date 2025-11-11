# Essay Hub

**Monthly essay challenges exploring humanity through single words**

Essay Hub is a community-driven platform where writers explore the depths of human experience through monthly essay challenges. Each month, we announce a single word, and writers have until the 25th to submit essays exploring that theme. The community then votes for the most compelling piece.

## 🌟 Features

- **Monthly Challenges**: New word announced on the 1st of each month
- **Community Voting**: Democratic selection of winning essays (26th-30th)
- **Essay Archive**: Searchable collection of all submissions organized by word and date
- **Winners Gallery**: Showcase of award-winning essays with author recognition
- **Responsive Design**: Optimized for all devices with accessibility features
- **Jekyll-Powered**: Fast, secure static site generation

## 🚀 Quick Start

### Prerequisites

- Ruby 2.7+ and Bundler
- Git
- Text editor

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/essay-hub.git
   cd essay-hub
   ```

2. **Install dependencies**
   ```bash
   bundle install
   ```

3. **Start the development server**
   ```bash
   bundle exec jekyll serve
   ```

4. **Open your browser**
   Navigate to `http://localhost:4000`

### Adding New Essays

1. **Create a new essay file**
   ```bash
   touch _essays/YYYY-MM-DD-word-essay-title.md
   ```

2. **Add frontmatter and content**
   ```yaml
   ---
   layout: essay
   title: "Your Essay Title"
   author: "Author Name"
   date: YYYY-MM-DD
   word: "MonthlyWord"
   winner: false  # Set to true for winners
   excerpt: "Brief description of the essay..."
   ---
   
   Your essay content here...
   ```

3. **Commit and push**
   ```bash
   git add _essays/your-new-essay.md
   git commit -m "Add new essay: Your Essay Title"
   git push
   ```

## 📁 Project Structure

```
essay-hub/
├── _config.yml              # Jekyll configuration
├── _layouts/                # Page templates
│   ├── default.html         # Base layout
│   └── essay.html          # Essay-specific layout
├── _includes/               # Reusable components
│   ├── header.html         # Site header
│   └── footer.html         # Site footer
├── _essays/                 # Essay collection
│   └── YYYY-MM-DD-word-title.md
├── assets/                  # Static assets
│   ├── css/
│   │   └── main.css        # Main stylesheet
│   └── js/
│       └── main.js         # JavaScript functionality
├── pages/                   # Static pages
│   ├── index.html          # Homepage
│   ├── essays.html         # Essays archive
│   ├── winners.html        # Winners gallery
│   ├── about.html          # About page
│   └── submit.html         # Submission page
├── .github/workflows/       # GitHub Actions
│   └── jekyll.yml          # Auto-deployment
└── old_website_backup/      # Previous site backup
```

## 🎯 Monthly Workflow

### Day 1: New Month Setup
1. Update `_config.yml` with new month's word and dates:
   ```yaml
   current_month: "December 2024"
   current_word: "GRATITUDE"
   submission_deadline: "December 25, 2024"
   voting_period: "December 26-30, 2024"
   ```

2. Announce the new word via email/social media
3. Update submission form with new word

### Days 1-25: Submission Period
1. Review incoming submissions daily
2. Convert accepted essays to Markdown format
3. Publish 2-3 essays per day to maintain engagement
4. Send mid-month reminder emails

### Day 25: Close Submissions
1. Final review of remaining submissions
2. Publish all accepted essays
3. Prepare voting system

### Days 26-30: Voting Period
1. Open community voting
2. Monitor vote counts
3. Send voting reminder emails

### Day 1 (Next Month): Winner Announcement
1. Calculate and verify results
2. Update winner's essay (`winner: true`)
3. Announce winner via email/social media
4. Start new month cycle

## 📝 Content Management

### Essay Submission Process

1. **Receive Submission** (Google Form or Email)
   - Author name/pseudonym
   - Essay title
   - Email address
   - Essay file (PDF/DOCX/DOC)
   - Confirmations (length, originality)

2. **Review Checklist**
   - [ ] Length: 1 page or less (~500 words)
   - [ ] Theme relevance to monthly word
   - [ ] Original work (basic plagiarism check)
   - [ ] Appropriate content (respectful, constructive)
   - [ ] Proper formatting and readability

3. **Convert to Markdown**
   ```bash
   # Create new file
   touch _essays/2024-12-15-gratitude-small-moments.md
   
   # Add frontmatter and content
   # Commit and push to publish
   ```

4. **Email Templates**
   - **Acceptance**: Congratulations + live link + voting info
   - **Revision Request**: Specific feedback + resubmission deadline
   - **Rejection**: Respectful explanation + encouragement for next month

### Voting System Setup

**Option 1: Google Forms**
- Create new form for each month
- List all essay titles with links
- Single choice voting
- Email verification for one vote per person

**Option 2: External Voting Platform**
- Strawpoll.com for simple voting
- SurveyMonkey for more features
- Custom solution if needed

## 🛠️ Technical Details

### Jekyll Configuration

Key settings in `_config.yml`:
- **Collections**: Essays are organized as a Jekyll collection
- **Plugins**: SEO, sitemap, and feed generation
- **Markdown**: Kramdown processor with syntax highlighting
- **Permalinks**: Clean URLs for essays and pages

### Styling System

CSS architecture:
- **CSS Variables**: Consistent theming and easy customization
- **Mobile-First**: Responsive design starting from mobile
- **Accessibility**: WCAG compliant with keyboard navigation
- **Performance**: Optimized loading and minimal dependencies

### JavaScript Features

- **Search & Filter**: Real-time essay filtering and search
- **Mobile Menu**: Responsive navigation
- **Form Validation**: Client-side validation with accessibility
- **Smooth Scrolling**: Enhanced navigation experience
- **Accessibility**: Focus management and keyboard navigation

## 🚀 Deployment

### GitHub Pages (Automatic)

The site automatically deploys to GitHub Pages when you push to the `main` branch:

1. **Enable GitHub Pages**
   - Go to repository Settings → Pages
   - Source: GitHub Actions
   - The workflow will handle the rest

2. **Custom Domain** (Optional)
   - Add `CNAME` file with your domain
   - Configure DNS settings
   - Enable HTTPS in repository settings

### Manual Deployment

For other hosting providers:

1. **Build the site**
   ```bash
   bundle exec jekyll build
   ```

2. **Upload `_site` folder**
   - Upload contents to your web server
   - Ensure proper file permissions
   - Configure redirects if needed

## 📊 Analytics & Monitoring

### Recommended Tools

- **Google Analytics**: Track visitor behavior and popular content
- **Google Search Console**: Monitor search performance
- **Uptime Monitoring**: Ensure site availability
- **Form Analytics**: Track submission success rates

### Key Metrics to Track

- Monthly essay submissions
- Community voting participation
- Website traffic and engagement
- Email open/click rates
- Social media engagement

## 🔧 Maintenance

### Monthly Tasks
- [ ] Update current word and dates in `_config.yml`
- [ ] Review and publish submitted essays
- [ ] Manage voting process
- [ ] Send community emails
- [ ] Update winner status
- [ ] Backup important data

### Quarterly Tasks
- [ ] Review and update submission guidelines
- [ ] Analyze community feedback
- [ ] Update email templates
- [ ] Review site performance
- [ ] Plan feature improvements

### Annual Tasks
- [ ] Review overall strategy and goals
- [ ] Update design and branding
- [ ] Evaluate new tools and platforms
- [ ] Community survey and feedback
- [ ] Archive management

## 🤝 Contributing

We welcome contributions to improve Essay Hub:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/improvement-name
   ```
3. **Make your changes**
4. **Test thoroughly**
5. **Submit a pull request**

### Areas for Contribution
- Design improvements
- Accessibility enhancements
- New features (commenting, social sharing, etc.)
- Performance optimizations
- Documentation updates

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 📞 Support

- **Email**: contact@humansonplanetearth.com
- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Discussions**: Use GitHub Discussions for community questions

## 🙏 Acknowledgments

- Jekyll community for the excellent static site generator
- GitHub for free hosting and automation
- All the writers who share their perspectives and make this community possible

---

**Ready to explore humanity through words?** [Submit your first essay](https://humansonplanetearth.com/submit/) and join our community of writers.
