# Calendar Slack Sync Extension - Specification

## Overview
A simple Chrome extension that provides visual indicator when active on Google Calendar and Slack pages.

## Features

### Visual Indicator
- Displays a green circle in the top right corner of web pages
- Only visible when the extension is active on supported domains

### Text Processing
- Extracts date/time availability information from message text
- Supports common date formats (Mon Jun 30, Thu Jul 3, etc.)
- Supports time ranges (8:00am – 1:00pm)
- Filters out non-essential text and formatting

### Calendar Integration
- Reads Google Calendar page DOM directly (no API required)
- Assumes calendar is in week view
- Detects scheduling conflicts by analyzing existing events
- Color-codes output based on availability status
- Validates extracted dates match currently displayed calendar week
- **Smart conflict filtering**: Ignores events longer than 8 hours and all-day events (OOO, conferences, etc.)

### Enhanced Timezone Detection
- **Priority 1**: Explicit timezone mentions (PST, EST, CST, MST, UTC) take precedence
- **Priority 2**: Name-based fallback (Trevor→PST, Devon→EST, Kelsey→CST)
- Handles mixed scenarios where recruiters work across multiple timezones
- Example: "Kelsey is available Tuesday 2-3pm EST" → Uses EST, not CST

### Supported Domains
- `calendar.google.com`
- `*.slack.com` (all Slack workspaces)

## Technical Implementation

### Extension Structure
- Chrome Extension Manifest v3
- Content script injection for supported domains
- Interactive popup UI triggered by clock icon click
- No background service worker needed

### Interaction Flow
1. **Clock Icon Click (Closed State)**:
   - Clock icon changes from green to yellow
   - Popup appears below icon
   - Textarea gets focus

2. **Clock Icon Click (Open State)**:
   - Popup disappears
   - Clock icon changes from yellow back to green clock
   - All content in textarea and results are cleared
   - Timezone dropdown resets to default

3. **Outside Click**:
   - Popup remains open
   - Clock icon stays yellow

4. **Timezone Dropdown Selection**:
   - Extract date/time information from textarea content
   - Convert extracted times to selected target timezone
   - Display results in textbox below dropdown
   - If no valid information found, display error message in textbox
   - Textarea content remains unchanged

### Visual Specifications

#### Indicator Icon
- **Shape**: Clock icon (circular with clock face)
- **Design**: 
  - Clock face with 12 hour markers
  - Clock hands pointing to 12:00
  - Numbers and hands in green (#00FF00) when inactive/closed
  - Numbers and hands in yellow (#FFFF00) when popup is open
  - Always maintains clock shape and structure
- **Size**: 20px diameter
- **Position**: Top right corner of viewport
  - 20px from top edge
  - 20px from right edge
- **Z-index**: High value (9999) to ensure visibility above page content
- **Style**: SVG icon with transparent background
- **Interaction**: Clickable cursor pointer

#### Popup Window
- **Trigger**: Click on clock icon
- **Position**: Directly below the clock icon
  - Top edge aligned 5px below icon
  - Right edge aligned with icon's right edge
- **Size**: 
  - Width: 300px
  - Height: Auto (content-based)
- **Background**: White with subtle shadow
- **Border**: 1px solid #ccc, rounded corners (8px)
- **Z-index**: Higher than circle (10000)

#### Popup Contents
- **Textarea**:
  - Full width minus padding
  - Height: 150px (increased from 100px for better visibility)
  - Placeholder: "Enter your message..."
  - Border: 1px solid #ddd
  - Padding: 8px
  - Font: System default
- **Timezone Selection Dropdown**:
  - Full width
  - Height: 40px
  - Label: "Extract and convert to timezone:"
  - Options: All global timezones (UTC, Americas, Europe, Asia, Africa, Australia)
    - Examples: UTC, America/New_York, America/Chicago, America/Denver, America/Los_Angeles, Europe/London, Asia/Tokyo, etc.
  - Default: "Select timezone..."
  - Margin-top: 10px from textarea
- **Results Textbox**:
  - Appears below dropdown when timezone is selected
  - Full width
  - Height: Dynamic based on content (minimum 80px, maximum 300px)
  - Auto-sized to show all output lines without scrolling when possible
  - Border: 1px solid #ddd
  - Background: White
  - Padding: 8px
  - Font: Same as input textarea (system default, not monospace)
  - Font-size: 12px (reduced from 14px)
  - Read-only
  - Shows extracted times converted to selected timezone
  - Compact format: times displayed on single lines
  - **Calendar conflict color coding** (when on calendar.google.com):
    - **Green background**: No scheduling conflicts
    - **Yellow background**: Partial conflicts (some overlap)
    - **Red background**: Fully blocked (complete overlap)

### Browser Compatibility
- Chrome Extension Manifest v3
- Minimum Chrome version: 88

### Permissions Required
- `activeTab` - to inject content script on supported domains

## Text Extraction Algorithm

### Input Processing
- Accepts multi-line text input from textarea
- Searches for date/time patterns using regular expressions  
- Extracts timezone preferences from candidate assignment notes
- Ignores greeting text, signatures, and URLs

### Supported Formats
- **Date formats**: 
  - "Mon Jun 30" (3-letter day, 3-letter month, day number)
  - "Thu Jul 3" (abbreviated format)
- **Time formats**:
  - "8:00am – 1:00pm" (12-hour format with em dash)
  - "8:00am - 1:00pm" (12-hour format with hyphen)
- **Combined format**: "Day Month Date, StartTime – EndTime"
- **Timezone assignment**: "(Name's candidates: TZ)" format at end of message

### Output Format
- **Results displayed in textbox** (when timezone selected):
  - One line per availability slot (each date/time on separate line)
  - Format: "Day Month Date, StartTime – EndTime"  
  - Times converted to selected target timezone
  - Timezone line: Added after all availability slots with common abbreviations
  - **Source timezone display**: Shows detected source abbreviation (CST, EST, PST)
  - **Target timezone display**: Shows selected target abbreviation
  - Example for EST selection (from Kelsey/CST source):
    ```
    Sun Jun 29, 11:00am – Sun Jun 29, 4:00pm
    Mon Jun 30, 11:00am – Mon Jun 30, 4:00pm
    Tue Jul 1, 11:00am – Tue Jul 1, 4:00pm
    
    Timezone: EST
    ```

### Timezone Detection Logic
1. **Search for required names** in input text (Kelsey, Trevor, or Devon)
2. **Case-insensitive matching** throughout entire input text
3. **Map name to source timezone**:
   - **Kelsey** → CST (America/Chicago)
   - **Devon** → EST (America/New_York)
   - **Trevor** → PST (America/Los_Angeles)
4. **Display format**: Use timezone abbreviations (CST, EST, PST)
5. **Require explicit name** - no default timezone behavior
6. **Support conversion** between any global timezones
7. **Debug logging**: Console output for timezone detection validation

## Calendar Conflict Detection

### DOM Reading Approach
- **Target view**: Week view only (assumption)
- **Data source**: Read existing calendar events from DOM elements
- **Scope**: Currently displayed week on calendar page
- **Adaptive selectors**: Use multiple fallback strategies for element detection
- **Debug-driven development**: Console analysis to understand current DOM structure
- **Known limitations**: Google Calendar DOM structure changes frequently
- **Robust parsing**: Handle cases where selectors fail gracefully

### Date Validation Logic
1. **Extract dates** from input text availability slots
2. **Read current week** displayed on Google Calendar page
3. **Flexible date range validation**:
   - Parse visible week headers (e.g., "SUN 22", "MON 23")
   - Calculate full week span (Sunday to Sunday, e.g., June 22-28)
   - Extract month/year from page title (e.g., "June 2025")
   - **Permissive validation**: If ANY extracted dates fall within current week span → proceed
   - **Allow overflow**: Dates extending beyond the week are acceptable if sequence starts in week
   - If NO extracted dates fall within current week → show error
4. **Error message**: "Please navigate to the week containing the start date [date] in your calendar"
5. **Fallback behavior**: If week detection fails, show warning but proceed
6. **Week span calculation**: Determine full Sunday-to-Saturday week regardless of visible days

### Conflict Detection Algorithm
1. **Parse calendar DOM** to identify existing events and time slots
   - Target event containers with multiple selector strategies
   - Look for colored event blocks in week view grid
   - Parse event text for time information
2. **For each extracted time slot**:
   - Check for overlapping events in same date/time range
   - Calculate conflict percentage based on visual event presence
3. **Assign color coding**:
   - **Green**: 0% conflict (no overlapping events detected)
   - **Yellow**: 1-99% conflict (partial overlap detected)
   - **Red**: 100% conflict (fully blocked by existing events)
4. **Graceful degradation**: If event detection fails, default to green with warning

### DOM Structure Debugging
- **Debug function** to analyze Google Calendar's current DOM structure
- **Console logging** of found elements, selectors, and data attributes
- **Fallback detection** for alternative element selectors
- **Real-time analysis** of visible events and week structure

#### Debug Analysis Points
1. **Week date detection**: 
   - Validate `data-datekey` attributes and alternative date selectors
   - Parse day headers like "SUN 22", "MON 23" from `[role="columnheader"]`
   - Extract month/year from page title elements
   - Calculate full week span (Sunday to Sunday) from visible dates
   - Validate flexible date range logic
2. **Event element identification**: 
   - Check `data-eventid`, `role="button"`, and time-pattern text
   - Analyze colored event blocks and their positioning
   - Test multiple event container selectors
3. **DOM structure sampling**: Analyze actual CSS classes and element hierarchy
4. **Visibility verification**: Ensure elements are actually rendered on page
5. **Time pattern matching**: Find elements containing time-like text (e.g., "2:00 PM")
6. **Selector validation**: Verify that current selectors match actual DOM structure
7. **Timezone detection validation**: Console logging of name matching and timezone mapping

### Error Handling
- **No dates found**: "No availability information found in the text"
- **Invalid format**: "Could not parse date/time format. Please check the input."
- **Empty input**: "Please enter some text to process"
- **Missing required name**: "Please include Kelsey, Trevor, or Devon in the text to determine source timezone"
- **Date mismatch**: "Please navigate to the week containing [dates] in your calendar"
- **DOM parsing failure**: "Calendar integration unavailable - using default color coding"

## User Experience
1. User installs extension
2. Extension automatically activates when visiting Google Calendar or Slack
3. Green clock icon appears in top right corner as visual confirmation
4. User can click clock icon to open popup
5. Clock icon turns yellow when popup is open
6. Popup displays with textarea and timezone selection dropdown
7. User pastes or types message content into textarea
8. User selects target timezone from dropdown (global timezone list)
9. Times are extracted and converted to selected timezone
10. Results appear in textbox below dropdown
11. **On calendar.google.com**: 
    - Times are color-coded based on calendar conflicts (when detection works)
    - Shows green with warning if calendar parsing fails
    - Validates that extracted dates overlap with current calendar week (flexible matching)
12. **Debug mode**: Console logging available for DOM structure analysis
13. If no valid dates found, missing required name, date mismatch, or DOM parsing failure, appropriate error/warning message appears in textbox  
14. Clicking clock icon again closes popup and returns icon to green

## Known Issues & Limitations
- **Google Calendar DOM changes**: Selectors may need updates when Google modifies their interface
- **Event detection reliability**: Complex events or non-standard layouts may not be detected
- **Week view dependency**: Only works when calendar is in week view mode
- **Date parsing accuracy**: Depends on consistent header formatting in calendar interface
