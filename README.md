# BigQuery Release Insights 📊🐦

A premium, high-performance web application designed to fetch, parse, search, and share Google Cloud BigQuery release notes. Built using a **Python Flask** backend and a **plain vanilla HTML, CSS, and JavaScript** frontend, this app offers a beautiful, interactive dashboard with real-time sharing capabilities.

---

## 🌟 Key Features

*   **Granular Update Parsing**: Google Cloud's official Atom feed groups release notes by day. This application automatically parses and splits these notes into separate cards based on their category (e.g. *Feature*, *Announcement*, *Issue*, or *Deprecation*).
*   **Dual-Theme Dark/Light UI**: A premium dark theme (default) and a high-contrast light theme with transitions. Uses modern custom properties, glassmorphism, and glowing background decorations.
*   **API Caching**: Implements a 10-minute cache (`cache.json`) for the Atom feed to optimize performance and prevent rate-limiting.
*   **Real-time Search & Filter**: Instant search filters release notes by keyword, type, or date.
*   **Interactive Tweet Composer**:
    *   Powered by the native HTML `<dialog>` element with responsive entry/exit transitions.
    *   Pre-compiles update descriptions to fit the **280-character Twitter limit** (accounting for standard templates, labels, and docs links).
    *   Features a live SVG circular progress ring and character validator (disables tweeting if edits exceed 280 characters).
    *   Supports single-click copy-to-clipboard and direct X/Twitter sharing via Web Intents.
*   **Offline/Error Fallback**: If the network is unreachable, the system automatically falls back to cached data and alerts the user via status indicators and toast notifications.

---

## 🛠️ Technology Stack

*   **Backend**: Python 3, Flask, Requests, BeautifulSoup4 (for HTML splitting), and XML ElementTree (for feed ingestion).
*   **Frontend**: Vanilla HTML5 (using semantic elements and native dialog structures), Vanilla JavaScript (ES6+ state management, clipboard API, SVG manipulation), and Vanilla CSS (custom properties, grid layouts, composited animations, and `@starting-style`).
*   **Icons & Fonts**: FontAwesome (icons), Google Fonts (Outfit & Plus Jakarta Sans).

---

## 📂 Project Structure

```text
├── app.py                 # Flask server, Atom XML parser, and JSON caching engine
├── requirements.txt       # Python environment dependencies
├── cache.json             # Local feed cache file (generated at runtime)
├── .gitignore             # Git ignore list
├── README.md              # Project documentation
├── templates/
│   └── index.html         # Main page template and dialog markup
└── static/
    ├── css/
    │   └── style.css      # Core styles, variables, theme tokens, and animations
    └── js/
        └── app.js         # Client-side state, filtering, clipboard, and sharing logic
```

---

## 🚀 Quick Start Instructions

Follow these steps to run the application locally:

### 1. Prerequisite Setup
Make sure you have Python 3 installed. Clone this repository, navigate to the directory, and set up a virtual environment:

```bash
# Create a virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate  # On Windows, use: venv\Scripts\activate
```

### 2. Install Dependencies
Install the required packages using pip:

```bash
pip install -r requirements.txt
```

### 3. Run the Development Server
Start the Flask application:

```bash
python app.py
```

By default, the application will run in debug mode at:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 📄 License

This project is open-source and available under the MIT License.
