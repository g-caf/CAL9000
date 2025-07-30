# Cal 9000 v2 - Simple Calendar Chat Assistant

A clean, simple Chrome extension for chatting with your Google Calendar from anywhere in your browser.

## ✨ Features

- 🗓️ **Chat interface** - Ask about your calendar in natural language
- 🌐 **Works everywhere** - Browser action popup available on any website  
- 🔐 **Simple OAuth** - Uses Chrome's built-in identity API
- ⚡ **Fast & lightweight** - ~100 lines of code vs 2000+
- 📱 **Modern UI** - Clean, responsive design

## 🚀 Setup

1. **Load extension in Chrome:**
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" 
   - Select the `Cal9000-v2` folder

2. **Get extension ID:**
   - Copy the extension ID from Chrome (looks like: `abcdefghijklmnopqrstuvwxyz123456`)

3. **Update Google Cloud Console:**
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Edit your OAuth 2.0 client
   - Add authorized redirect URI: `https://[extension-id].chromiumapp.org/`
   - Save changes

4. **Test:**
   - Click the Cal 9000 extension icon
   - Click "Connect Google Calendar"
   - Grant permissions
   - Start chatting!

## 💬 Example Queries

- "What's next on my calendar?"
- "What do I have today?"
- "Show me tomorrow's events"
- "What's coming up?"

## 🏗️ Architecture

**Simple & Clean:**
- Browser action popup (works everywhere)
- Direct Google Calendar API calls (no backend needed for OAuth)
- Chrome identity API for authentication
- Minimal UI focused on chat experience

**No More:**
- ❌ Complex backend OAuth flows
- ❌ DOM parsing of calendar pages  
- ❌ Cross-origin communication issues
- ❌ Content script limitations
- ❌ Overcomplicated caching

## 🔧 Technical Details

- **Extension Type:** Browser Action (Manifest V3)
- **Authentication:** `chrome.identity.getAuthToken()`
- **API:** Direct calls to Google Calendar API v3
- **Storage:** Chrome extension local storage
- **UI:** Vanilla HTML/CSS/JS popup

## 📝 Next Steps

- Add event creation capabilities
- Integrate with AI for natural language processing
- Add more calendar operations (edit, delete)
- Support multiple calendars
