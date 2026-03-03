# Armored Archer 🏹

A 2D top-down mobile archery game built with Godot 4 and Nakama. Features a highly replayable PvE auto-shooter mode and asynchronous turn-based PvP duels. 

Strictly Free-to-Play. Zero Pay-to-Win. Cosmetics only.

## 🛠 Tech Stack

* **Game Engine:** [Godot 4](https://godotengine.org/)
* **Language:** GDScript (Client) / TypeScript (Server)
* **Backend:** [Nakama](https://heroiclabs.com/)
* **Database:** PostgreSQL
* **IAP Infrastructure:** RevenueCat

## 📊 Code Coverage

[![codecov](https://img.shields.io/codecov/c/gh/anchapin/armored-archer/main)](https://codecov.io/gh/anchapin/armored-archer)

## 🚀 Local Development Setup

### Prerequisites
* Godot 4.x installed
* Docker & Docker Compose (for local Nakama backend)

### 1. Start the Backend
Navigate to the `/backend` directory and spin up the Nakama server and PostgreSQL database:
\`\`\`bash
cd backend
docker-compose up -d
\`\`\`
Nakama console will be available at `http://localhost:7351` (admin:password).

### 2. Run the Game
Open the `/client` folder in the Godot 4 Editor. 
* Press `F5` to run the project.
* Make sure your Nakama connection settings in `res://autoloads/NetworkManager.gd` point to `127.0.0.1:7350`.

## 📁 Project Structure

* `/client` - Godot 4 project files (Scenes, Scripts, Assets).
* `/backend` - Nakama server configuration, Docker Compose file, and TypeScript server logic.
* `/design` - UI mockups, master cosmetic spreadsheets, and game design notes.

## Roadmap

Phase,Timeline,Focus Area,Key Deliverables
1. Core Mechanics,Weeks 1-3,Godot Engine Setup & Physics,"Touch controls (virtual joysticks), character movement, arrow trajectory physics, and hitbox collisions."
2. PvE & Game Loop,Weeks 4-6,AI & Auto-Aim Logic,"Spawning simple enemies, implementing auto-aim logic, health systems, and core game loop (win/loss states)."
3. Infrastructure,Weeks 7-9,Backend & Database Setup,"Local Nakama Docker setup, user authentication, database schemas (catalog, inventory, loadout)."
4. Shop & Network,Weeks 10-13,"UI, IAP, & Turn-Based PvP","Modular sprite system, cosmetic shop UI, RevenueCat integration, Nakama matchmaker, and turn-based RPCs."
5. Launch Prep,Weeks 14-16,Polish & App Store Submission,"Safe-area UI adjustments, analytics (Crashlytics), TestFlight (iOS) / Play Console (Android) beta distribution."
