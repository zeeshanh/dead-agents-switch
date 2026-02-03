# Contributing to Dead Agent's Switch

First off, thanks for taking the time to contribute! 🎉

## How Can I Contribute?

### Reporting Bugs

- Use the GitHub issue tracker
- Include steps to reproduce
- Include expected vs actual behavior
- Include your environment details

### Suggesting Features

- Open an issue with the tag `enhancement`
- Describe the use case
- Explain why it would be useful

### Pull Requests

1. Fork the repo
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Write tests for your changes
4. Make your changes
5. Run tests: `npm test`
6. Commit: `git commit -m 'Add my feature'`
7. Push: `git push origin feature/my-feature`
8. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Keep functions small and focused

### Commit Messages

Use conventional commits:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `test:` tests
- `refactor:` code refactoring

## Development Setup

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run Anchor tests (requires Solana local validator)
anchor test
```

## Questions?

Open an issue or reach out to the maintainers.

Thanks! 🙏
