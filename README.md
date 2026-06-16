# BigQuery Release Notes Explorer & Share Hub

A premium, interactive web application designed to fetch, filter, and share Google Cloud BigQuery release updates. Built with a **Python Flask** backend and a responsive, modern **vanilla HTML, CSS, and JS** frontend.

---

## ⚡ Key Features

- **Granular Update Splitting**: Automatically parses standard Atom feeds and breaks multi-update release entries (grouped by date) into distinct, category-specific update cards (Features, Issues, Deprecations, etc.).
- **Disk Caching**: Implements a 1-hour local disk cache (`release_notes_cache.json`) to minimize network requests, optimize API speed, and support offline/fallback modes.
- **Premium Glassmorphism Dashboard**: Sleek dark-mode interface featuring animated radial gradients, responsive cards, category count badges, and glowing highlights indicating update states.
- **X/Twitter Composer Integration**: A built-in post composer modeled after X with multiple text templates (Standard, Hype, Brief, Insight), character limit validation, and a circular progress ring, forwarding posts via X Web Intents.

---

## 📁 Directory Structure

```text
try/
│
├── app.py                  # Flask backend server, XML/HTML parsers & API routes
├── requirements.txt        # Backend dependencies
├── .gitignore              # Files to exclude from Git control
├── README.md               # Project documentation (this file)
│
├── templates/
│   └── index.html          # HTML5 application shell & X modal composer
│
└── static/
    ├── style.css           # Premium vanilla CSS styling
    └── app.js              # State management, filter logic, and modal rendering
```

---

## 🚀 Setup & Execution

Follow these steps to run the application locally on your machine:

### Prerequisite
Make sure you have **Python 3.12+** and **Git** installed.

### 1. Clone & Navigate
```bash
cd try
```

### 2. Create and Activate Virtual Environment
```bash
# Create environment
python -m venv .venv

# Activate (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Activate (Windows CMD)
.venv\Scripts\activate.bat

# Activate (macOS/Linux)
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Server
```bash
python app.py
```

### 5. Access the Web Dashboard
Open your web browser and navigate to:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🛠️ Built With

- **Backend**: Python 3.12, Flask, Requests, BeautifulSoup4 (bs4), ElementTree
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom Variables, Keyframes, Transitions), Vanilla JS (ES6)
- **Icons**: FontAwesome 6.4.0
- **Fonts**: Google Fonts (Outfit, Inter)
