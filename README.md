<div align="center">
    <img src="images/icon.png" alt="antigravity-usage logo" width="150" height="150">
    <h1>antigravity-usage</h1>
</div>

<p align="center">
    <a href="https://npmjs.com/package/antigravity-usage"><img src="https://img.shields.io/npm/v/antigravity-usage?color=yellow" alt="npm version" /></a>
    <a href="https://packagephobia.com/result?p=antigravity-usage"><img src="https://packagephobia.com/badge?p=antigravity-usage" alt="install size" /></a>
    <a href="https://www.npmjs.com/package/antigravity-usage"><img src="https://img.shields.io/npm/dt/antigravity-usage" alt="NPM Downloads" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg" alt="Node.js Version" /></a>
</p>

<p align="center">
A fast, lightweight, and powerful CLI tool to track your Antigravity model quota and usage. Works offline with your IDE or online with multiple Google accounts.
</p>

<p align="center">
<em>Inspired by <a href="https://github.com/ryoppippi/ccusage">ccusage</a></em>
</p>

<div align="center">
    <img src="images/banner.png" alt="Antigravity Usage Screenshot">
</div>


## Quick Start (No Login Required) 🚀

If you have Antigravity running in your IDE (VSCode, JetBrains, etc.), you can check your quota immediately **without logging in**.

```bash
# Install globally
npm install -g antigravity-usage

# Check quota immediately (uses your IDE's connection)
antigravity-usage
```

That's it! The tool automatically connects to your local Antigravity server to fetch the exact same data your IDE sees.

---

## Power User Guide ⚡️

Want to check quota for **multiple accounts** or when your IDE is closed?

### 1. Login with Google
```bash
antigravity-usage login
```

### 2. Add more accounts
```bash
antigravity-usage accounts add
```

### 3. Check everything at once
```bash
antigravity-usage quota --all
```

---

## How It Works 🛠️

Antigravity Usage employs a smart "Dual-Fetch" strategy to ensure you always get data:

1.  **Local Mode (Priority)**: First, it tries to connect to the Antigravity Language Server running inside your IDE.
    *   **Pros**: Fast, works offline, no extra login required.
    *   **Cons**: IDE must be open.
2.  **Cloud Mode (Fallback)**: If Local Mode fails (or if managing multiple accounts), it uses the Google Cloud Code API.
    *   **Pros**: Works anywhere, supports multiple accounts.
    *   **Cons**: Requires one-time login.

By default, `antigravity-usage` runs in **Auto Mode**, seamlessly switching between these methods.

---

## Features

### 🔐 Multi-Account Management
Seamlessly juggle multiple Google accounts (e.g., Personal vs Work).
- **Parallel Fetching**: optional `--all` flag fetches data for all accounts simultaneously.
- **Privacy Focused**: Tokens are stored locally on your machine, never sent to third-party servers.

### 🔌 Offline Capabilities
Designed for plane rides and spotty wifi.
- **Direct IDE Access**: Reads directly from the local server loopback.
- **Smart Fallbacks**: If the internet cuts out, it defaults to the last known state from your local IDE.

### ⚡️ Smart Caching
To keep the CLI snappy and avoid hitting API rate limits:
- Quota data is cached for **5 minutes**.
- Use the `--refresh` flag to force a new fetch:
    ```bash
    antigravity-usage quota --refresh
    ```

### 📱 Responsive UI
Tables automatically adapt to your terminal size, switching between "Compact" and "Spacious" views to show you the most relevant data without wrapping.

---

## Command Reference

### `antigravity-usage` (Default)
Alias for `quota`. Fetches and displays usage data.

```bash
antigravity-usage                  # Auto-detect (Local -> Cloud)
antigravity-usage --all            # Fetch ALL accounts
antigravity-usage --method local   # Force local IDE connection
antigravity-usage --json           # Output JSON for scripts
```

### `antigravity-usage accounts`
Manage your roster of Google accounts.

```bash
antigravity-usage accounts list            # Show all accounts & status
antigravity-usage accounts add             # Login a new account
antigravity-usage accounts switch <email>  # Set active account
antigravity-usage accounts remove <email>  # Logout & delete data
```

### `antigravity-usage doctor`
Troubleshoot issues with your setup. Checks env vars, auth status, and local server connectivity.

### `antigravity-usage status`
Quickly check if your auth tokens are valid or expired.

### `antigravity-usage wakeup`
Auto wake-up and warm up AI models to optimize quota usage.

```bash
antigravity-usage wakeup config     # Configure schedule interactively
antigravity-usage wakeup install    # Install to system cron
antigravity-usage wakeup uninstall  # Remove from cron
antigravity-usage wakeup test       # Manual test trigger
antigravity-usage wakeup history    # View trigger history
antigravity-usage wakeup status     # Show current status
```

**Features:**
- 🕐 **Schedule-based**: Run at specific times (interval, daily, or cron)
- 🔄 **Quota-reset-based**: Auto-trigger when quota resets
- 👥 **Multi-account**: Trigger for multiple accounts
- 🛡️ **Deduplication**: Cooldown prevents duplicate triggers

## Configuration
Data is stored in your system's standard config location:
- **macOS**: `~/Library/Application Support/antigravity-usage/`
- **Linux**: `~/.config/antigravity-usage/`
- **Windows**: `%APPDATA%/antigravity-usage/`

## Development
```bash
npm run dev -- quota --all
npm test
```

## License
MIT
