---
name: 🐛 Alpha Bug Report
description: Report a bug encountered during alpha testing of Armored Archer
title: '[ALPHA BUG] '
labels: [alpha, bug, needs-triage]
assignees: ''
body:
  - type: markdown
    attributes:
      value: |
        ## Thanks for reporting this bug! 🎮
        
        Your feedback helps us improve Armored Archer before beta launch.
        Please fill out all fields below to help us reproduce and fix the issue quickly.
        
        > **Need immediate help?** If the game is completely unplayable, join our Discord and ping @alpha-support.

  - type: input
    id: device
    attributes:
      label: Device Information
      description: What device and operating system are you using?
      placeholder: e.g., iPhone 14 Pro, iOS 17.2 OR Samsung Galaxy S23, Android 14
    validations:
      required: true

  - type: input
    id: version
    attributes:
      label: Game Version
      description: What version of the game are you running? (Check in Settings → About)
      placeholder: e.g., v2.0.5, v2.1.0-alpha.1
    validations:
      required: true

  - type: textarea
    id: description
    attributes:
      label: Bug Description
      description: Describe what went wrong in detail. What were you doing when the bug occurred?
      placeholder: |
        I was playing campaign level 3 when...
        The game...
    validations:
      required: true

  - type: textarea
    id: reproduction
    attributes:
      label: Reproduction Steps
      description: List the exact steps to reproduce this bug. Be as specific as possible.
      placeholder: |
        1. Start campaign level 3
        2. Equip the Epic Bow of Fire
        3. Aim at the first enemy
        4. Release the arrow
        5. See error...
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What should have happened instead?
      placeholder: The arrow should have hit the enemy and dealt damage...
    validations:
      required: true

  - type: dropdown
    id: frequency
    attributes:
      label: Frequency
      description: How often does this bug occur when you follow the reproduction steps?
      options:
        - Always (100% of the time)
        - Sometimes (50-99% of the time)
        - Rarely (10-49% of the time)
        - Only once (couldn't reproduce again)
    validations:
      required: true

  - type: dropdown
    id: severity
    attributes:
      label: Severity
      description: How severe is this bug's impact on gameplay?
      options:
        - Critical - Game crashes, freezes, or progression completely blocked
        - High - Major feature broken (combat, multiplayer, save system)
        - Medium - Minor bug, game still playable but annoying
        - Low - Cosmetic issue, typo, or minor visual glitch
    validations:
      required: true

  - type: dropdown
    id: game_mode
    attributes:
      label: Game Mode
      description: Which game mode were you playing when the bug occurred?
      options:
        - Campaign (Story Mode)
        - Survival (Endless Mode)
        - PvP (Multiplayer)
        - Tutorial
        - Main Menu / UI
        - Other
    validations:
      required: true

  - type: input
    id: player_level
    attributes:
      label: Player Level (Optional)
      description: What level is your character? This helps us identify progression-related issues.
      placeholder: e.g., Level 15
    validations:
      required: false

  - type: textarea
    id: logs
    attributes:
      label: Error Logs & Screenshots
      description: |
        Paste any error messages you saw. If the game crashed, you can find logs at:
        - **iOS**: Settings → Armored Archer → Crash Logs
        - **Android**: Settings → Apps → Armored Archer → Storage → View Logs
        - **Desktop**: Check the game installation folder for `logs/latest.log`
        
        You can also attach screenshots or screen recordings by dragging them here.
      placeholder: Paste error messages here...
      render: shell
    validations:
      required: false

  - type: checkboxes
    id: checklist
    attributes:
      label: Bug Report Checklist
      description: Please confirm the following before submitting
      options:
        - label: I have searched existing issues and this hasn't been reported before
          required: true
        - label: I have filled out all required fields accurately
          required: true
        - label: I understand this is an alpha build and bugs are expected
          required: true
        - label: I am willing to provide additional information if requested by developers
          required: true

  - type: markdown
    attributes:
      value: |
        ---
        
        ### What happens next?
        
        1. **Auto-Triage**: Our system will automatically categorize your bug report
        2. **Developer Review**: A developer will review and reproduce the issue (usually within 24 hours)
        3. **Updates**: You'll receive notifications when the status changes
        4. **Fix**: Once fixed, the issue will be marked as resolved
        
        **Critical bugs** (crashes, progression blockers) trigger immediate alerts to our team.
        
        > 📧 **Questions?** Contact alpha-support@armoredarcher.com or join our Discord.
        
        Thank you for helping us improve Armored Archer! 🏹
