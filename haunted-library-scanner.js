function scanLibraryAndCreateSheet() {
  // Find the Library folder
  const folders = DriveApp.getFoldersByName('Library');
  if (!folders.hasNext()) {
    throw new Error('No folder named "Library" found in your Google Drive');
  }
  
  const libraryFolder = folders.next();
  console.log('Found Library folder:', libraryFolder.getName());
  
  // Create or update the Book Library spreadsheet
  let spreadsheet;
  const existingFiles = DriveApp.getFilesByName('Library Catalog');
  
  if (existingFiles.hasNext()) {
    spreadsheet = SpreadsheetApp.open(existingFiles.next());
    spreadsheet.getActiveSheet().clear(); // Clear existing data
  } else {
    spreadsheet = SpreadsheetApp.create('Library Catalog');
  }
  
  const sheet = spreadsheet.getActiveSheet();
  
  // Set up headers
  const headers = ['Category', 'Title', 'Author', 'Date Added'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Scan for PDFs
  const books = [];
  scanFolderForPDFs(libraryFolder, '', books);
  
  console.log(`Found ${books.length} PDF files`);
  
  // Write data to sheet
  if (books.length > 0) {
    // Sort books by category, then by title
    books.sort((a, b) => {
      // First sort by category
      if (a[0] < b[0]) return -1;
      if (a[0] > b[0]) return 1;
      // If categories are equal, sort by title
      if (a[1] < b[1]) return -1;
      if (a[1] > b[1]) return 1;
      return 0;
    });
    
    // Process books data to create hyperlinked titles
    const processedBooks = books.map(book => [
      book[0], // category
      `=HYPERLINK("${book[3]}", "${book[1]}")`, // hyperlinked title
      book[2], // author
      book[4]  // date added
    ]);
    
    const dataRange = sheet.getRange(2, 1, books.length, headers.length);
    dataRange.setValues(processedBooks);
    
    // Apply vintage library card styling
    applyLibraryCardStyling(sheet, books.length, headers.length);
  }
  
  // Clean up sheet - delete unused rows and columns
  const maxRows = sheet.getMaxRows();
  const maxCols = sheet.getMaxColumns();
  const dataRows = books.length + 1; // +1 for header
  const dataCols = headers.length;
  
  if (maxRows > dataRows) {
    sheet.deleteRows(dataRows + 1, maxRows - dataRows);
  }
  if (maxCols > dataCols) {
    sheet.deleteColumns(dataCols + 1, maxCols - dataCols);
  }
  
  console.log('Library catalog created/updated successfully!');
  console.log('Spreadsheet URL:', spreadsheet.getUrl());
}

function scanFolderForPDFs(folder, path, books) {
  // Get PDFs in current folder
  const files = folder.getFilesByType(MimeType.PDF);
  
  while (files.hasNext()) {
    const file = files.next();
    
    // Extract metadata
    const category = getCategory(path);
    const title = extractTitle(file.getName());
    const author = extractAuthor(file.getName());
    const directLink = file.getUrl();
    const dateAdded = file.getDateCreated();
    
    books.push([category, title, author, directLink, dateAdded]);
  }
  
  // Recursively scan subfolders
  const subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    const subfolder = subfolders.next();
    const subPath = path ? `${path}/${subfolder.getName()}` : subfolder.getName();
    scanFolderForPDFs(subfolder, subPath, books);
  }
}

function extractTitle(filename) {
  // Remove .pdf extension
  let title = filename.replace(/\.pdf$/i, '');
  
  // Handle "Book Title — Author Name" format (em dash)
  if (title.includes(' — ')) {
    title = title.split(' — ')[0].trim();
  }
  // Fallback to regular dash
  else if (title.includes(' - ')) {
    title = title.split(' - ')[0].trim();
  }
  
  // Clean up common patterns
  title = title.replace(/^\d+[-.\s]+/, ''); // Remove leading numbers
  title = title.replace(/[-_]/g, ' '); // Replace hyphens/underscores with spaces
  title = title.replace(/\s+/g, ' ').trim(); // Clean up extra spaces
  
  return title;
}

function extractAuthor(filename) {
  // Remove .pdf extension
  let author = '';
  let cleanName = filename.replace(/\.pdf$/i, '');
  
  // Handle "Book Title — Author Name" format (em dash)
  if (cleanName.includes(' — ')) {
    const parts = cleanName.split(' — ');
    if (parts.length >= 2) {
      author = parts[1].trim();
    }
  }
  // Fallback to regular dash "Book Title - Author Name"
  else if (cleanName.includes(' - ')) {
    const parts = cleanName.split(' - ');
    if (parts.length >= 2) {
      author = parts[1].trim();
    }
  }
  
  return author;
}

function getCategory(path) {
  if (!path) return 'Main Library';
  
  // Get the first subfolder name (immediate category)
  const pathParts = path.split('/');
  const category = pathParts[0];
  
  return category;
}

function applyLibraryCardStyling(sheet, numRows, numCols) {
  // Vintage library card theme - cream/beige background
  const headerRange = sheet.getRange(1, 1, 1, numCols);
  const dataRange = sheet.getRange(2, 1, numRows, numCols);
  
  // Header styling - vintage red on cream like old card headers
  headerRange.setBackground('#f0ead6')
    .setFontColor('#8b3635')
    .setFontWeight('bold')
    .setFontSize(11)
    .setFontFamily('Courier New');
  
  // Data styling - black text on cream background
  dataRange.setBackground('#f5f3e7')
    .setFontColor('#2c2c2c')
    .setFontSize(10)
    .setFontFamily('Courier New');
  
  // Apply stamp colors to category column based on content
  applyCategoryStamps(sheet, numRows);
  
  // Horizontal borders to mimic ruled paper
  const allDataRange = sheet.getRange(1, 1, numRows + 1, numCols);
  allDataRange.setBorder(false, false, true, false, true, false, '#d4c4a8', SpreadsheetApp.BorderStyle.SOLID);
  
  // Auto-resize columns and freeze header
  sheet.autoResizeColumns(1, numCols);
  
  // Set specific width for category column to contain tilted stamps properly
  sheet.setColumnWidth(1, 100);
  
  sheet.setFrozenRows(1);
  
  // Hide gridlines for cleaner vintage look
  sheet.setHiddenGridlines(true);
  
  // Add auto-filter to make headers clickable for sorting
  const filterRange = sheet.getRange(1, 1, numRows + 1, numCols);
  filterRange.createFilter();
}

function applyCategoryStamps(sheet, numRows) {
  // Define stamp styles for each category (weathered ink colors like real library stamps)
  const stampStyles = {
    'Environment': {
      fontColor: '#2d5a2b',       // Faded green ink
      borderColor: '#2d5a2b',     // Matching green border
    },
    'Ethics': {
      fontColor: '#8b3635',       // Faded red ink  
      borderColor: '#8b3635',     // Matching red border
    },
    'Theory': {
      fontColor: '#2e4a7f',       // Faded blue ink
      borderColor: '#2e4a7f',     // Matching blue border
    },
    'History': {
      fontColor: '#6c4317',       // Faded brown ink
      borderColor: '#6c4317',     // Matching brown border
    },
    'State': {
      fontColor: '#3c3c3c',       // Faded black ink
      borderColor: '#3c3c3c',     // Matching black border
    },
    'Technology': {
      fontColor: '#5a5a5a',       // Faded gray ink
      borderColor: '#5a5a5a',     // Matching gray border
    }
  };
  
  // Force data to commit before styling
  SpreadsheetApp.flush();
  
  // Apply stamp styling to category column (column 1)
  for (let i = 2; i <= numRows + 1; i++) {
    const categoryCell = sheet.getRange(i, 1);
    const categoryValue = categoryCell.getValue();
    
    // Remove underscore prefix if present
    const cleanCategory = categoryValue.replace(/^_/, '');
    
    console.log(`Row ${i}: Category value: "${categoryValue}" -> Clean: "${cleanCategory}"`);
    
    if (stampStyles[cleanCategory]) {
      const style = stampStyles[cleanCategory];
      console.log(`Applying ${cleanCategory} stamp style`);
      
      categoryCell.setFontColor(style.fontColor)
        .setFontWeight('normal')
        .setFontSize(9)
        .setFontFamily('Courier New')
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle');
    } else {
      console.log(`No stamp style found for: "${cleanCategory}"`);
    }
  }
  
  // Force formatting to commit
  SpreadsheetApp.flush();
}
