---
title: Add utility clamp function
created: 2026-04-06
---

# Add utility clamp function

## Problem / Motivation
N/A

## Goal
Create a utility file containing a clamp function that restricts a value within a specified minimum and maximum range.

## Approach
Create a new GDScript file at `scripts/utils.gd` containing a `clamp()` function that accepts three parameters (value, min, max) and returns the value clamped to the inclusive range [min, max].

## Scope

**In Scope:**
- Creating `scripts/utils.gd` file
- Implementing a `clamp()` function with value, min, and max parameters
- Function returns value clamped to [min, max] range

**Out of Scope:**
- Any additional utility functions
- Tests for the clamp function
- Integration with existing code

## Acceptance Criteria

- File `scripts/utils.gd` exists in the project
- File contains a function named `clamp()`
- The `clamp()` function accepts three parameters: value, min, and max
- When the value is below min, the function returns min
- When the value is above max, the function returns max
- When the value is within [min, max], the function returns the value unchanged
