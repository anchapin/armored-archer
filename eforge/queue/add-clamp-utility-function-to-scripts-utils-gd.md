---
title: Add clamp() utility function to scripts/utils.gd
created: 2026-04-06
---

# Add clamp() utility function to scripts/utils.gd

## Problem / Motivation

N/A

## Goal

Add a simple utility function to the scripts directory: create `scripts/utils.gd` with a `clamp()` function that takes a value, min, and max, and returns the value clamped to the range [min, max].

## Approach

- Create a new file: `scripts/utils.gd`
- Implement a `clamp()` function that accepts three parameters: `value`, `min`, and `max`
- The function should return the `value` clamped to the range [min, max]

## Scope

**In scope:**
- Creating the `scripts/utils.gd` file
- Implementing the `clamp()` function with `value`, `min`, and `max` parameters
- Ensuring the function returns the value clamped to the range [min, max]

**Out of scope:**
N/A

## Acceptance Criteria

- The `scripts/utils.gd` file exists in the project
- The file contains a `clamp()` function
- The `clamp()` function accepts three parameters: `value`, `min`, and `max`
- The function returns:
  - `min` if `value < min`
  - `max` if `value > max`
  - `value` if `min <= value <= max`
