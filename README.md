# Calendar Slack Sync Chrome Extension

A Chrome extension that helps with scheduling by extracting availability from Slack messages, converting timezones, and detecting conflicts with Google Calendar.

## Features

- 🕒 **Smart Timezone Detection**: Automatically detects timezone from names (Trevor → PST, Devon → EST, Kelsey → CST)
- 📅 **Google Calendar Integration**: Reads your calendar and detects scheduling conflicts
- 🎯 **Precise Conflict Detection**: Shows exact time overlaps, not just "busy day"
- 🌈 **Color-Coded Results**: Green (free), Yellow (partial conflicts), Red (fully blocked)
- ⚡ **Instant Conversion**: Paste availability text and get immediate timezone conversion

## Installation Instructions

### For Team Members:

1. **Download the Extension Files**
   - Get the extension folder from your team lead
   - Make sure you have: `manifest.json`, `content.js`, and this `README.md`

2. **Install in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Turn ON "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the extension folder
   - The extension should now appear in your extensions list

3. **Usage**
   - Go to `calendar.google.com` or any Slack workspace
   - Look for a green clock icon in the top-right corner
   - Click the clock to open the timezone converter
   - Paste scheduling availability text and select target timezone
   - See color-coded results with conflict detection!

## Supported Sites

- ✅ Google Calendar (calendar.google.com) - Full conflict detection
- ✅ Slack (*.slack.com) - Basic timezone conversion

## Timezone Support

**Automatic Detection:**
- Trevor → Pacific Time (PST)
- Devon → Eastern Time (EST) 
- Kelsey → Central Time (CST)

**Manual Selection:**
- All major US timezones (ET, CT, MT, PST)
- UTC and international timezones
- Toronto, Vancouver, London, Tokyo, and more

## How It Works

1. **Extract**: Parses availability text for dates and times
2. **Convert**: Transforms times to your selected timezone
3. **Analyze**: Reads Google Calendar events for the relevant dates
4. **Detect**: Calculates precise time overlaps
5. **Display**: Shows color-coded results with conflict percentages

## Troubleshooting

**Clock icon not showing?**
- Refresh the page
- Check that you're on calendar.google.com or *.slack.com
- Verify extension is enabled in chrome://extensions/

**Conflict detection not working?**
- Make sure you're on Google Calendar
- Check that the calendar is in week view
- Verify dates in availability text match the visible calendar week

**Need help?** Contact your team lead who shared this extension.

## Version History

- **v1.0.0** - Initial release with timezone conversion and conflict detection
