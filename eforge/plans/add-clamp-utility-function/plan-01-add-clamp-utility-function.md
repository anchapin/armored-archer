---
id: plan-01-add-clamp-utility-function
name: Create utility library with clamp() and other helper functions
depends_on: []
branch: add-clamp-utility-function/main
---

# Create utility library with helper functions

## Problem / Motivation
The project needs a centralized location for utility functions to promote code reuse and maintainability. While Godot 4.x provides built-in functions like `clamp()`, having a utility library allows for:
- Consistent access patterns across the codebase
- Future extensibility with custom utility functions
- Easier testing and maintenance of utility logic

## Goal
Create a utility script `scripts/utils.gd` containing helper functions, starting with a `clamp()` function that wraps the built-in Godot function for consistency with the project's utility library pattern.

## Approach
Create a new file `scripts/utils.gd` and implement a `clamp()` function that:
- Accepts three parameters: `value`, `min`, and `max`
- Returns the value clamped to the range [min, max]
- Uses Godot's built-in `clamp()` function internally
- Includes type hints for better code clarity
- Includes documentation comments

## Scope
**In Scope:**
- Create `scripts/utils.gd` file
- Implement `clamp()` function with proper type hints
- Add documentation comments
- Structure the file to accommodate future utility functions

**Out of Scope:**
- Additional utility functions beyond `clamp()` (can be added in future PRDs)

## Acceptance Criteria
- File `scripts/utils.gd` exists in the scripts directory
- File contains a `clamp()` function
- Function accepts three parameters: `value`, `min`, and `max`
- Function returns the `value` clamped to the range [`min`, `max`]
- Function uses Godot's built-in `clamp()` internally
- Function has type hints and documentation comments