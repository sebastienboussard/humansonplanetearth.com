# Essay Hub Deployment Guide

This guide covers the complete deployment process for Essay Hub, from initial setup to ongoing maintenance.

## 🚀 Initial Deployment

### Prerequisites

- GitHub account
- Domain name (optional)
- Google account (for forms and analytics)
- Email service (Mailchimp, ConvertKit, etc.)

### Step 1: Repository Setup

1. **Create GitHub Repository**
   ```bash
   # If starting fresh
   git init
   git add .
   git commit -m "Initial Essay Hub setup"
   git branch -M main
   git remote add origin https://github.com/yourusername/essay-hub.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**
   - Go to repository Settings → Pages
   - Source: GitHub Actions
   - The Jekyll workflow will automatically deploy

### Step 2: Domain Configuration (Optional)

1. **Add CNAME file**
   ```bash
   echo "yourdomain.com" > CNAME
   git add CNAME
   git commit -m "Add custom domain"
   git push
   ```

2. **Configure DNS**
   - Add A records pointing to GitHub Pages IPs:
     - 185.199.108.153
     - 185.199.109.153
     - 185.199.110.153
     - 185.199.111.153
   - Or add CNAME record pointing to `yourusername.github.io`

3. **Enable HTTPS**
   - In repository Settings → Pages
   - Check "Enforce HTTPS"

### Step 3: Google Form Setup

1. **Create Submission Form**
   - Go to Google Forms
   - Create new form with these fields:
     - Author Name/Pseudonym (Short answer, Required)
     - Essay Title (Short answer, Required)
     - Email Address (Short answer, Required, Email validation)
     - Current Month's Word (Short answer, Pre-filled, Disabled)
     - Essay File (File upload, Required, Accept .pdf,.docx,.doc)
     - Word Count Confirmation (Checkbox, Required)
     - Original Work Declaration (Checkbox, Required)

2. **Configure Form Settings**
   - Limit to 1 response per person
   - Collect email addresses
   - Send confirmation email
   - Set up email notifications for new responses

3. **Get Embed Code**
   - Click "Send" → "Embed HTML"
   - Copy iframe code
   - Update `submit.html` with your form URL

4. **Set Up Response Sheet**
   - Link form to Google Sheets
   - Add columns: Status, Notes, Publication Date
   - Set up conditional formatting for easy review

### Step 4: Email System Setup

Choose one of these email platforms:

#### Option A: Mailchimp (Recommended for beginners)

1. **Create Account**
   - Sign up at mailchimp.com
   - Create audience for Essay Hub subscribers

2. **Design Templates**
   - Monthly word announcement
   - Mid-month check-in
   - Final week reminder
   - Voting announcement
   - Winner announcement

3. **Set Up Automation**
   - Welcome series for new subscribers
   - Monthly campaign schedule

#### Option B: ConvertKit (Better for advanced users)

1. **Create Account**
   - Sign up at convertkit.com
   - Import any existing subscribers

2. **Create Sequences**
   - Onboarding sequence
   - Monthly challenge sequence
   - Winner announcement sequence

3. **Set Up Forms**
   - Newsletter signup form
   - Embed on website

### Step 5: Analytics Setup

1. **Google Analytics**
   - Create GA4 property
   - Add tracking code to `_includes/head.html`
   - Set up goals for form submissions

2. **Google Search Console**
   - Add and verify your domain
   - Submit sitemap: `yourdomain.com/sitemap.xml`

3. **Form Analytics**
   - Monitor Google Form responses
   - Track submission success rates
   - Identify common issues

## 📅 Monthly Deployment Workflow

### Day 1: New Month Setup

1. **Update Configuration**
   ```yaml
   # _config.yml
   current_month: "January 2025"
   current_word: "RENEWAL"
   submission_deadline: "January 25, 2025"
   voting_period: "January 26-30, 2025"
   ```

2. **Update Google Form**
   - Change pre-filled word field
   - Update form title and description

3. **Deploy Changes**
   ```bash
   git add _config.yml
   git commit -m "Update for January 2025: RENEWAL"
   git push
   ```

4. **Send Announcement Email**
   - Use prepared template
   - Include word, deadline, submission link
   - Schedule social media posts

### Days 1-25: Content Management

1. **Daily Review Process**
   - Check Google Form responses
   - Review submissions against guidelines
   - Convert accepted essays to Markdown

2. **Essay Conversion Workflow**
   ```bash
   # Create new essay file
   touch _essays/2025-01-15-renewal-second-chances.md
   
   # Add frontmatter and content
   # Example:
   ---
   layout: essay
   title: "Second Chances"
   author: "Alex Thompson"
   date: 2025-01-15
   word: "Renewal"
   winner: false
   excerpt: "Sometimes renewal means letting go of who we used to be..."
   ---
   
   [Essay content here]
   ```

3. **Publishing Schedule**
   - Publish 2-3 essays per day
   - Maintain consistent timing
   - Share on social media

4. **Email Communications**
   - Day 10: Mid-month check-in
   - Day 20: Final week reminder
   - Include essay highlights and submission link

### Day 25: Submission Deadline

1. **Final Review**
   - Process remaining submissions
   - Publish all accepted essays
   - Send rejection/revision emails if needed

2. **Prepare Voting**
   - Create voting form/poll
   - Test voting system
   - Prepare voting announcement

### Days 26-30: Voting Period

1. **Open Voting**
   - Send voting announcement email
   - Include links to all essays
   - Share on social media

2. **Monitor Progress**
   - Check vote counts daily
   - Send reminder emails
   - Engage community on social media

3. **Voting Platforms**

   **Option A: Google Forms**
   ```
   - Create new form for each month
   - List all essay titles with links
   - Radio button selection
   - Require email for verification
   ```

   **Option B: Strawpoll**
   ```
   - Create poll at strawpoll.com
   - Add essay titles as options
   - Enable duplicate checking
   - Share poll link
   ```

### Day 1 (Next Month): Winner Announcement

1. **Calculate Results**
   - Tally votes from all sources
   - Verify winner (handle ties if needed)
   - Update winner's essay file

2. **Update Winner Status**
   ```yaml
   # In winner's essay file
   winner: true
   ```

3. **Deploy Winner Update**
   ```bash
   git add _essays/winning-essay.md
   git commit -m "Mark November winner: The Quiet Strength Within"
   git push
   ```

4. **Send Announcement**
   - Congratulate winner
   - Link to winning essay
   - Announce next month's word
   - Thank all participants

## 🔧 Technical Maintenance

### Weekly Tasks

- [ ] Monitor site performance and uptime
- [ ] Check for broken links
- [ ] Review form submissions
- [ ] Backup important data
- [ ] Update social media

### Monthly Tasks

- [ ] Review Google Analytics data
- [ ] Update email subscriber lists
- [ ] Check SEO performance
- [ ] Review and respond to feedback
- [ ] Plan next month's promotion

### Quarterly Tasks

- [ ] Review submission guidelines
- [ ] Update email templates
- [ ] Analyze community growth
- [ ] Plan feature improvements
- [ ] Review hosting and tool costs

## 🛠️ Troubleshooting

### Common Issues

**Site Not Updating**
- Check GitHub Actions for build errors
- Verify Jekyll syntax in modified files
- Clear browser cache

**Form Not Working**
- Check Google Form sharing settings
- Verify iframe embed code
- Test form submission process

**Email Issues**
- Check email platform delivery rates
- Verify subscriber list health
- Test email templates across clients

**Performance Problems**
- Optimize images and assets
- Review JavaScript performance
- Check hosting resource usage

### Emergency Procedures

**Site Down**
1. Check GitHub Pages status
2. Verify DNS settings
3. Roll back recent changes if needed
4. Contact hosting support

**Form Compromised**
1. Disable form immediately
2. Review submissions for spam
3. Create new form with better security
4. Update website with new form

**Email Issues**
1. Check email platform status
2. Verify sender reputation
3. Review recent campaign performance
4. Contact email platform support

## 📊 Performance Monitoring

### Key Metrics

**Website Analytics**
- Monthly unique visitors
- Page views per session
- Bounce rate
- Mobile vs desktop usage

**Content Performance**
- Most popular essays
- Search queries bringing traffic
- Time spent reading essays
- Social media engagement

**Community Engagement**
- Monthly essay submissions
- Voting participation rates
- Email open/click rates
- Subscriber growth

**Technical Performance**
- Page load speeds
- Core Web Vitals scores
- Uptime percentage
- Form completion rates

### Monitoring Tools

**Free Options**
- Google Analytics
- Google Search Console
- Google PageSpeed Insights
- Uptime Robot (basic plan)

**Paid Options**
- Hotjar (user behavior)
- SEMrush (SEO monitoring)
- Pingdom (advanced uptime monitoring)
- ConvertKit/Mailchimp analytics

## 🔒 Security & Backup

### Security Best Practices

1. **Repository Security**
   - Never commit sensitive data
   - Use environment variables for API keys
   - Enable two-factor authentication
   - Review collaborator access regularly

2. **Form Security**
   - Enable spam protection
   - Limit file upload sizes
   - Monitor for suspicious submissions
   - Regular security reviews

3. **Email Security**
   - Use reputable email platforms
   - Monitor sender reputation
   - Implement double opt-in
   - Regular list cleaning

### Backup Strategy

1. **Code Backup**
   - Git repository (automatic)
   - Local development copy
   - Quarterly full backup

2. **Content Backup**
   - Export Google Form responses monthly
   - Backup email subscriber lists
   - Save email templates and campaigns

3. **Analytics Backup**
   - Export Google Analytics data quarterly
   - Save performance reports
   - Document key insights

## 📈 Growth Strategies

### Content Marketing

1. **SEO Optimization**
   - Optimize essay titles and descriptions
   - Create topic clusters around themes
   - Build quality backlinks
   - Regular content audits

2. **Social Media**
   - Share essay highlights
   - Behind-the-scenes content
   - Author spotlights
   - Community engagement

3. **Partnerships**
   - Collaborate with writing communities
   - Guest posts on relevant blogs
   - Cross-promotion with similar platforms
   - Author interviews and features

### Community Building

1. **Engagement Initiatives**
   - Monthly author spotlights
   - Community challenges
   - Reader feedback features
   - Social media contests

2. **Quality Improvements**
   - Regular guideline updates
   - Enhanced submission process
   - Better voting experience
   - Mobile optimization

3. **Feature Expansion**
   - Comment systems
   - Author profiles
   - Essay categories
   - Advanced search features

---

## 🆘 Support Resources

- **Jekyll Documentation**: https://jekyllrb.com/docs/
- **GitHub Pages Help**: https://docs.github.com/en/pages
- **Google Forms Help**: https://support.google.com/forms/
- **Mailchimp Resources**: https://mailchimp.com/help/
- **Web Analytics**: https://analytics.google.com/analytics/academy/

**Need help?** Contact the development team or create an issue in the GitHub repository.
