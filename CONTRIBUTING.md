# Contributing to Armored Archer

Thank you for contributing to Armored Archer! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites
- Godot 4.x (for game client)
- Node.js 18+ and npm (for backend server)
- Docker & Docker Compose (for database and Nakama server)
- Git

### Setting up development environment
1. Clone the repository.
2. For the Godot client, open the project in Godot 4.x editor.
3. For the backend, navigate to `backend/` and run `npm install` to install dependencies.
4. Set up environment variables for the backend (see `backend/README.md` or `backend/.env.example` if exists).
5. Start the database and Nakama server using Docker Compose: `docker-compose up -d` from the project root or backend directory.
6. Verify everything runs: open Godot editor, run the project; start backend with `npm run dev` in backend.

### Running the project locally
- **Client**: In Godot editor, press F5 to run the game.
- **Backend**: In `backend/`, run `npm run dev` to start the Nakama server in watch mode.

## Development Workflow
1. **Fork and clone** the repository.
2. **Create a feature branch** from `main`: `git checkout -b fix/issue-<number>` or `feat/<description>`.
3. **Make changes** in the appropriate subproject (client or backend).
4. **Run tests and linting**:
   - Backend: `npm test`, `npm run lint`, `npm run typecheck`.
   - Client: GDScript linting via built-in Godot tools (no automated linter currently).
5. **Commit changes** following conventional commit style: `git commit -m "Fix #<number>: <description>"`.
6. **Push and create PR**: `git push -u origin fix/issue-<number>` and open a PR on GitHub.

## Code Style
- **TypeScript**: Follow the rules in `AGENTS.md` and the ESLint configuration. Use async/await, strict typing, and JSDoc for public functions.
- **GDScript**: Follow `AGENTS.md` guidelines: snake_case for variables/functions, PascalCase for classes, use `@export` for inspector variables, use `@onready` for node references.
- **Naming**: Use descriptive names. Constants in UPPER_SNAKE_CASE. Private members prefixed with `_`.
- **File organization**: Keep scripts organized in `scripts/` and scenes in `scenes/`. Use autoloads for singletons.

## Testing
- **Backend tests**: Jest tests are located in `backend/src/**/__tests__/`. Run `npm test` to execute all tests. Aim for high coverage.
- **Writing new tests**: Place tests alongside modules or in `__tests__` folders. Mock external dependencies.
- **Coverage requirements**: New code should include tests for critical paths.

## Pull Requests
- **PR template**: Use the provided template when creating a PR. Include a clear description, related issues, testing performed, and screenshots if applicable.
- **Review checklist**:
  - [ ] Code follows style guidelines.
  - [ ] All tests pass.
  - [ ] Linting passes without errors.
  - [ ] Documentation updated (if needed).
  - [ ] No breaking changes without discussion.
- **What gets merged**: PRs that are approved, pass CI checks, and align with project goals.

## Issue Reporting
- **Bug report**: Include steps to reproduce, expected vs actual behavior, environment details, and logs.
- **Feature request**: Describe the problem, propose a solution, and discuss with maintainers before implementation.

## Questions?
Open an issue for any clarifications.

---

By contributing, you agree that your work will be licensed under the project's MIT License.
