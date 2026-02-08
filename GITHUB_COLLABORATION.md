# GitHub Team Collaboration Setup Guide

## 📌 Step 1: Create GitHub Repository

### Option A: Via GitHub Website
1. Go to https://github.com
2. Log in to your account
3. Click the "+" icon in the top right
4. Select "New repository"
5. Fill in the details:
   - **Repository name**: `booking-system` (or your preferred name)
   - **Description**: "Full-stack booking management system with React and Node.js"
   - **Visibility**: Choose "Private" for private project or "Public"
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### Option B: Via GitHub CLI (if installed)
```bash
gh repo create booking-system --private --source=. --remote=origin
```

## 📌 Step 2: Connect Local Repository to GitHub

After creating the repository on GitHub, you'll see a page with commands. Use these:

```bash
# Add GitHub remote
git remote add origin https://github.com/YOUR-USERNAME/booking-system.git

# For SSH (if you have SSH keys set up):
# git remote add origin git@github.com:YOUR-USERNAME/booking-system.git

# Rename branch to main (if needed)
git branch -M main

# Push code to GitHub
git push -u origin main
```

**Replace `YOUR-USERNAME` with your actual GitHub username!**

## 📌 Step 3: Invite Team Members

### Adding Collaborators (For Private Repositories)

1. Go to your repository on GitHub
2. Click "Settings" tab
3. Click "Collaborators" in the left sidebar (or "Collaborators and teams")
4. Click "Add people"
5. Enter teammate's GitHub username or email
6. Select the person from the dropdown
7. Choose their permission level:
   - **Read**: Can view and clone
   - **Triage**: Can manage issues and pull requests
   - **Write**: Can push to the repository
   - **Maintain**: Can manage repository settings
   - **Admin**: Full access including deletion
8. Click "Add [username] to this repository"

### Team Members Accept Invitation
1. Invited members will receive an email
2. They need to accept the invitation
3. Then they can clone the repository

## 📌 Step 4: Clone Repository (For Team Members)

Team members should clone the repository:

```bash
# HTTPS method
git clone https://github.com/YOUR-USERNAME/booking-system.git
cd booking-system

# SSH method (if SSH keys configured)
git clone git@github.com:YOUR-USERNAME/booking-system.git
cd booking-system

# Configure Git identity (first time only)
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Install dependencies
cd booking-system-backend
npm install
cd ../booking-system-frontend
npm install
```

## 📌 Step 5: Set Up Branch Protection Rules

Protect your main branch from accidental changes:

1. Go to repository **Settings** > **Branches**
2. Click "Add branch protection rule"
3. Branch name pattern: `main`
4. Enable these options:
   - ✅ Require a pull request before merging
   - ✅ Require approvals (at least 1)
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require review from Code Owners (optional)
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Require conversation resolution before merging
5. Click "Create" or "Save changes"

## 📌 Step 6: Team Workflow

### Creating a Development Branch

```bash
# Create and switch to develop branch
git checkout -b develop
git push -u origin develop
```

### Working on Features

```bash
# 1. Update your local repository
git checkout develop
git pull origin develop

# 2. Create a feature branch
git checkout -b feature/your-feature-name

# 3. Make your changes and commit
git add .
git commit -m "Add: description of your feature"

# 4. Push your branch
git push -u origin feature/your-feature-name

# 5. Create Pull Request on GitHub
# Go to repository page, click "Compare & pull request"
```

### Pull Request Process

1. **Create PR**: Push your branch and create PR on GitHub
2. **Add Description**: Explain what changes you made
3. **Request Reviewers**: Select team members to review
4. **Address Feedback**: Make changes based on comments
5. **Get Approval**: Wait for approval from reviewers
6. **Merge**: Click "Merge pull request" after approval
7. **Delete Branch**: Delete the feature branch after merging

### Commit Message Convention

Use clear, descriptive commit messages:

```bash
# Good examples:
git commit -m "Add: user authentication endpoint"
git commit -m "Fix: booking date validation error"
git commit -m "Update: improve dashboard UI layout"
git commit -m "Remove: deprecated API endpoints"
git commit -m "Refactor: optimize database queries"

# Prefixes to use:
# Add: new feature
# Fix: bug fix
# Update: modify existing feature
# Remove: delete code/feature
# Refactor: code improvement without changing functionality
# Docs: documentation changes
# Style: formatting, missing semicolons, etc.
# Test: adding tests
```

## 📌 Step 7: GitHub Issues & Project Management

### Using Issues

1. Click "Issues" tab
2. Click "New issue"
3. Add title and description
4. Assign to team member
5. Add labels (bug, enhancement, documentation, etc.)
6. Link to milestone or project

### Using Projects (Kanban Board)

1. Click "Projects" tab
2. Click "New project"
3. Choose "Board" template
4. Create columns: To Do, In Progress, Review, Done
5. Add issues and pull requests to the board
6. Drag items between columns as work progresses

## 📌 Step 8: Code Review Guidelines

### For Reviewers:
- ✅ Check code quality and style
- ✅ Test the changes locally if possible
- ✅ Ensure no security vulnerabilities
- ✅ Verify functionality works as expected
- ✅ Provide constructive feedback
- ✅ Approve if everything looks good

### For Contributors:
- ✅ Keep PRs small and focused
- ✅ Write clear descriptions
- ✅ Test your code before submitting
- ✅ Respond to feedback promptly
- ✅ Update PR if changes requested

## 📌 Step 9: Syncing Your Fork (If Using Fork Model)

```bash
# Add upstream remote (original repository)
git remote add upstream https://github.com/ORIGINAL-OWNER/booking-system.git

# Fetch upstream changes
git fetch upstream

# Merge upstream changes into your branch
git checkout main
git merge upstream/main

# Push updates to your fork
git push origin main
```

## 📌 Step 10: Useful Git Commands

```bash
# Check repository status
git status

# View commit history
git log --oneline --graph --all

# View remote repositories
git remote -v

# Switch branches
git checkout branch-name

# Update your branch with latest changes
git pull origin branch-name

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes) - CAREFUL!
git reset --hard HEAD~1

# See differences before committing
git diff

# Stash changes temporarily
git stash
git stash pop

# Delete local branch
git branch -d branch-name

# Delete remote branch
git push origin --delete branch-name
```

## 📌 Best Practices

1. **Commit Often**: Small, frequent commits are better than large ones
2. **Pull Before Push**: Always pull latest changes before pushing
3. **Write Clear Messages**: Your future self will thank you
4. **Use Branches**: Never work directly on main
5. **Review Code**: Always review PRs carefully
6. **Communicate**: Use PR comments and issues to discuss
7. **Test First**: Test your code before committing
8. **Document**: Keep documentation up to date
9. **Protect Secrets**: Never commit .env files or passwords
10. **Be Respectful**: Provide constructive feedback

## 🔒 Security Notes

- ❌ Never commit `.env` files
- ❌ Never commit API keys or passwords
- ❌ Never commit sensitive user data
- ✅ Use `.gitignore` properly
- ✅ Review commits before pushing
- ✅ Use environment variables for secrets
- ✅ Enable GitHub security features

## 📚 Additional Resources

- [GitHub Docs](https://docs.github.com)
- [Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Branching Model](https://nvie.com/posts/a-successful-git-branching-model/)

## 🆘 Troubleshooting

### Can't push to repository
```bash
# Check remote URL
git remote -v

# Set correct remote URL
git remote set-url origin https://github.com/YOUR-USERNAME/booking-system.git
```

### Merge conflicts
```bash
# Pull latest changes
git pull origin branch-name

# Resolve conflicts in your editor
# Look for <<<<<<< markers

# After resolving
git add .
git commit -m "Resolve merge conflicts"
git push
```

### Accidentally committed to wrong branch
```bash
# Undo commit but keep changes
git reset --soft HEAD~1

# Switch to correct branch
git checkout correct-branch

# Commit again
git add .
git commit -m "Your message"
```

---

**Need Help?** Contact the team lead or check GitHub documentation.
