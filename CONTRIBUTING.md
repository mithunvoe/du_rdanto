# Contributing Guide

Thank you for contributing to the Delineate Hackathon Challenge project! This guide will help you get started.

## Getting Started

### Prerequisites

- Node.js >= 24.10.0
- npm >= 10.x
- Docker >= 24.x
- Docker Compose >= 2.x
- Git

### Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/cuet-micro-ops-hackthon-2025.git
   cd cuet-micro-ops-hackthon-2025
   ```

3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/bongodev/cuet-micro-ops-hackthon-2025.git
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Create your environment file:
   ```bash
   cp .env.example .env
   ```

## Development Workflow

### 1. Create a Feature Branch

Always create a new branch for your work:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or updates
- `chore/` - Maintenance tasks

### 2. Make Your Changes

Write clean, maintainable code following the project's style guide.

### 3. Test Your Changes

Before committing, ensure all checks pass:

```bash
# Run linting
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Check code formatting
npm run format:check

# Fix formatting issues
npm run format

# Run E2E tests
npm run test:e2e

# Test with Docker
npm run docker:dev
```

### 4. Commit Your Changes

Write clear, descriptive commit messages following the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
git add .
git commit -m "feat: add new download status endpoint"
```

Commit message format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Test additions or updates
- `chore` - Maintenance tasks
- `perf` - Performance improvements

Examples:
```bash
feat(api): add webhook callback support for downloads
fix(docker): resolve S3 connection timeout issue
docs(readme): update installation instructions
test(e2e): add tests for long-running downloads
```

### 5. Push Your Changes

```bash
git push origin feature/your-feature-name
```

### 6. Create a Pull Request

1. Go to the repository on GitHub
2. Click "New Pull Request"
3. Select your branch
4. Fill in the PR template with:
   - Description of changes
   - Related issue numbers
   - Testing performed
   - Screenshots (if applicable)

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Avoid `any` types - use proper typing
- Use interfaces for object shapes
- Use enums for constants with multiple values

### Formatting

- Use Prettier for code formatting (configured in the project)
- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in multi-line objects/arrays

### Naming Conventions

- `camelCase` for variables and functions
- `PascalCase` for classes and types
- `UPPER_SNAKE_CASE` for constants
- Descriptive names that explain purpose

### Comments

- Write self-documenting code when possible
- Add comments for complex logic
- Use JSDoc for function documentation
- Keep comments up-to-date with code changes

## Testing Guidelines

### E2E Tests

- Test happy paths and error cases
- Use descriptive test names
- Clean up resources after tests
- Mock external dependencies when appropriate

### Test Structure

```typescript
// Good test structure
describe('Download API', () => {
  it('should return 200 for valid file_id', async () => {
    // Arrange
    const fileId = 70000;
    
    // Act
    const response = await fetch('/v1/download/check', {
      method: 'POST',
      body: JSON.stringify({ file_id: fileId })
    });
    
    // Assert
    expect(response.status).toBe(200);
  });
});
```

## Docker Guidelines

### Dockerfile Best Practices

- Use multi-stage builds
- Minimize layer count
- Use specific base image versions
- Don't run as root user
- Clean up in the same layer

### Docker Compose

- Use environment variables for configuration
- Define health checks
- Use named volumes for persistence
- Document service dependencies

## Pull Request Guidelines

### Before Submitting

- [ ] Code follows the style guidelines
- [ ] All tests pass locally
- [ ] Linting passes without errors
- [ ] Code is properly formatted
- [ ] Commit messages follow conventions
- [ ] Documentation is updated (if needed)
- [ ] No sensitive data in commits

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Testing
Describe testing performed

## Screenshots (if applicable)
Add screenshots here

## Checklist
- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

## CI/CD Pipeline

All pull requests must pass the CI/CD pipeline before merging:

1. **Lint & Format Check** - Code style validation
2. **E2E Tests** - Functional testing
3. **Build Docker Images** - Build verification
4. **Security Scanning** - Vulnerability detection

If any stage fails, fix the issues and push again.

## Getting Help

- Check existing issues and PRs
- Read the documentation
- Ask questions in discussions
- Join the community chat (if available)

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
