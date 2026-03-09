# Use Ubuntu 22.04 as the base image
FROM ubuntu:22.04

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install common dependencies including libcurl4 for Godot networking
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    git \
    curl \
    ca-certificates \
    libcurl4 \
    libx11-dev \
    libxext6 \
    libxinerama1 \
    libxcursor1 \
    libxrandr2 \
    libxi6 \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install gdlint for GDScript linting (project uses gdlintrc)
# Note: The package was renamed to gdtoolkit, but we install it via pipx or skip for now
# as the base pip in Ubuntu 22.04 doesn't support --break-system-packages
# Users can install it via: pip3 install gdtoolkit

# Install Godot 4.6.1 headless (server version for CI/builds)
# Godot version matches project.godot: config/features=PackedStringArray("4.6", "Mobile")
ARG GODOT_VERSION=4.6.1
RUN wget -q "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}-stable/Godot_v${GODOT_VERSION}-stable_linux.x86_64.zip" -O godot.zip && \
    unzip -q godot.zip && \
    mv Godot_v${GODOT_VERSION}-stable_linux.x86_64 /usr/local/bin/godot && \
    chmod +x /usr/local/bin/godot && \
    rm godot.zip

# Install Godot export templates (required for exporting)
ARG GODOT_VERSION=4.6.1
RUN mkdir -p ~/.local/share/godot/export_templates/${GODOT_VERSION}.stable && \
    wget -q "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}-stable/Godot_v${GODOT_VERSION}-stable_export_templates.tpz" -O templates.tpz && \
    unzip -q templates.tpz && \
    mv templates/* ~/.local/share/godot/export_templates/${GODOT_VERSION}.stable/ && \
    rm -rf templates.tpz templates

# Set up working directory
WORKDIR /workspace

# Create vscode user for devcontainer
RUN useradd -m -s /bin/bash vscode

# Give vscode user ownership of the workspace
RUN chown -R vscode:vscode /workspace /home/vscode

# Switch to vscode user
USER vscode

# Default command - verify Godot can load the project in headless mode
CMD ["godot", "--headless", "--path", "/workspace", "--quit-after", "1"]
