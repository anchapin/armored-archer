# Use Ubuntu 22.04 as the base image
FROM ubuntu:22.04

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install common dependencies
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Godot 4.6 headless (server version for CI/builds)
# Godot version matches project.godot: config/features=PackedStringArray("4.6", "Mobile")
ARG GODOT_VERSION=4.6.2
RUN wget -q "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}-stable/Godot_v${GODOT_VERSION}-stable-linux.x86_64.zip" -O godot.zip && \
    unzip -q godot.zip && \
    mv Godot_v${GODOT_VERSION}-stable-linux.x86_64 /usr/local/bin/godot && \
    chmod +x /usr/local/bin/godot && \
    rm godot.zip

# Install Godot export templates (required for exporting)
ARG GODOT_VERSION=4.6.2
RUN mkdir -p ~/.local/share/godot/export_templates/${GODOT_VERSION}.stable && \
    wget -q "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}-stable/Godot_v${GODOT_VERSION}-stable-export_templates.tpz" -O templates.tpz && \
    unzip -q templates.tpz && \
    mv templates/* ~/.local/share/godot/export_templates/${GODOT_VERSION}.stable/ && \
    rm -rf templates.tpz templates

# Set up working directory
WORKDIR /workspace

# Default command - runs Godot in headless mode to verify project
CMD ["godot", "--headless", "--path", "/workspace", "--script", "res://test/run_all_tests.gd"]
