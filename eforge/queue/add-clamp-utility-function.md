---
title: Add clamp() utility function
created: 2026-04-06
depends_on: ["add-clamp-utility-function-to-scripts-utils-gd"]
---

# Add clamp() utility function

## Problem / Motivation
N/A

## Goal
Create a utility script containing a clamp() function that constrains a value to a specified range.

## Approach
Create a new file `scripts/utils.gd` and implement a `clamp()` function that accepts three parameters (value, min, max) and returns the value clamped to the range [min, max].

## Scope
**In Scope:**
- Create `scripts/utils.gd` file
- Implement `clamp()` function with value, min, max parameters
- Function returns value clamped to [min, max] range

**Out of Scope:**
N/A

## Acceptance Criteria
- File `scripts/utils.gd` exists in the scripts directory
- File contains a `clamp()` function
- Function accepts three parameters: `value`, `min`, and `max`
- Function returns the `value` clamped to the range [`min`, `max`]
