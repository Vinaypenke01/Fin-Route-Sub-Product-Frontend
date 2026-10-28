/**
 * ==============================================================================
 * SUNDAY MONEY COLLECTION TRACKER - BACKEND API (Google Apps Script)
 * ==============================================================================
 * Version: 2.2 (Hardened Enterprise Real-Time Sync)
 * ==============================================================================
 */

const CONFIG = {
  TRACKER_SHEET: "Weekly Collection Tracker",
  ARCHIVE_SHEET: "Loan History Archive",
  START_CUSTOMER_ROW: 3,

  // ============================================================================
  // AUTHENTICATION PROTECTION LAYER
  // ============================================================================
  // When deploying for a new user, set their credentials here or in Script Properties
  AUTH_ENABLED: true,
  AUTH_EMAIL: "admin@example.com",
  AUTH_PASSWORD: "Password123",
};

/**
 * Retrieves active authentication credentials (from Script Properties or CONFIG)
 */
function getAuthConfig() {
  const props = PropertiesService.getScriptProperties();
  const email = props.getProperty("AUTH_EMAIL") || CONFIG.AUTH_EMAIL || "";
  const password = props.getProperty("AUTH_PASSWORD") || CONFIG.AUTH_PASSWORD || "";
  const enabled = CONFIG.AUTH_ENABLED !== false;
  return {
    email: String(email).trim().toLowerCase(),
    password: String(password).trim(),
    enabled: enabled
  };
}

/**
 * Verifies email and password against stored credentials
 */
function verifyAuth(email, password) {
  const auth = getAuthConfig();
  if (!auth.enabled) return { success: true };
  if (!auth.email && !auth.password) return { success: true }; // No credentials configured

  const reqEmail = String(email || "").trim().toLowerCase();
  const reqPass = String(password || "").trim();

  // If credentials match configured auth
  if (reqEmail === auth.email && reqPass === auth.password) {
    return { success: true };
  }

  // Multi-Tenant Auto-Provisioning for newly cloned tenant sheets:
  // If the sheet still has default placeholder credentials ("admin@example.com"),
  // automatically bind to the incoming tenant credentials on first access.
  const props = PropertiesService.getScriptProperties();
  const isDefaultPlaceholder = !props.getProperty("AUTH_EMAIL") && auth.email === "admin@example.com" && auth.password === "Password123";
  if (isDefaultPlaceholder && reqEmail && reqPass) {
    props.setProperty("AUTH_EMAIL", reqEmail);
    props.setProperty("AUTH_PASSWORD", reqPass);
    return { success: true };
  }

  return { success: false, message: "Invalid email or password. Access denied." };
}

/**
 * Handle HTTP GET Requests (Fetch all records from Google Sheets to Web App)
 * Protected: data is only returned if credentials match.
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const email = e?.parameter?.email || e?.parameter?.authEmail || "";
    const password = e?.parameter?.password || e?.parameter?.authPassword || "";

    const authCheck = verifyAuth(email, password);
    if (!authCheck.success) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: "unauthorized", message: authCheck.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const data = fetchAllData(ss);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", data: data }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle HTTP POST Requests (Execute Actions from Web App on Google Sheets)
 * Protected: credentials verified on every action.
 */
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const payload = postData.payload || {};

    const clientEmail = postData.authEmail || payload.authEmail || payload.email || "";
    const clientPassword = postData.authPassword || payload.authPassword || payload.password || "";

    // 1. Explicit Login Action: Verifies credentials and returns initial data
    if (action === "login") {
      const authCheck = verifyAuth(clientEmail, clientPassword);
      if (!authCheck.success) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: "unauthorized", message: authCheck.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const data = fetchAllData(ss);
      return ContentService
        .createTextOutput(JSON.stringify({
          status: "success",
          message: "Authenticated successfully",
          email: clientEmail,
          data: data
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Authentication Enforcement for all other actions
    const authCheck = verifyAuth(clientEmail, clientPassword);
    if (!authCheck.success) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: "unauthorized", message: authCheck.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const trackerSheet = getTrackerSheet(ss);
    if (isSheetEmpty(trackerSheet) || action === "bootstrap" || action === "syncAll") {
      ensureTrackerSheetInitialized(ss, trackerSheet, payload);
    }

    let result = {};

    switch (action) {
      case "updateCredentials": {
        const newEmail = String(payload.newEmail || "").trim().toLowerCase();
        const newPassword = String(payload.newPassword || "").trim();
        if (!newPassword || newPassword.length < 4) {
          result = { success: false, message: "New password must be at least 4 characters long." };
          break;
        }
        const props = PropertiesService.getScriptProperties();
        if (newEmail) props.setProperty("AUTH_EMAIL", newEmail);
        props.setProperty("AUTH_PASSWORD", newPassword);
        result = { success: true, message: "Credentials updated successfully in Google Sheet." };
        break;
      }
      case "bootstrap":
        result = { success: true, message: "Sheet initialized successfully" };
        break;

      case "deleteCustomer":
        result = deleteCustomerRow(ss, payload);
        break;

      case "deleteArchivedRecord":
        result = deleteArchivedRecordInSheet(ss, payload);
        break;

      case "addCustomer":
        result = addCustomerRow(ss, payload);
        break;

      case "moveCustomerRow":
        result = moveCustomerRowInSheet(ss, payload);
        break;

      case "syncRowOrder":
        result = syncRowOrderInSheet(ss, payload);
        break;

      case "updatePayment":
        result = updateSinglePayment(ss, payload);
        break;

      case "updateCustomerField":
        result = updateCustomerFieldInSheet(ss, payload);
        break;

      case "addWeek":
        result = addWeekColumn(ss, payload);
        break;

      case "deleteWeek":
        result = deleteLatestWeekColumn(ss, payload);
        break;

      case "archiveLoans":
        result = archiveLoansInSheet(ss, payload);
        break;

      case "archiveAndRenewCustomer":
        result = archiveAndRenewCustomerInSheet(ss, payload);
        break;

      case "updateReconciliation":
        result = updateWeekReconciliation(ss, payload);
        break;

      case "syncReconciliation":
        result = syncReconciliationInSheet(ss, payload);
        break;

      case "updateWeeks":
        result = updateWeeksInSheet(ss, payload);
        break;

      case "syncAll":
        result = syncAllData(ss, payload);
        break;

      case "trimWorkbook":
        trimEntireWorkbook(ss);
        result = { success: true, message: "Workbook cells trimmed successfully" };
        break;

      default:
        throw new Error("Unknown action: " + action);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", result: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Bulletproof Sheet Resolver:
 * Finds the tracker sheet dynamically even if tab is named 'Sheet1',
 * has extra spaces, or was renamed.
 */
function getTrackerSheet(ss) {
  if (!ss) throw new Error("No active spreadsheet found.");

  // 1. Try exact match
  let sheet = ss.getSheetByName(CONFIG.TRACKER_SHEET);
  if (sheet) return sheet;

  const sheets = ss.getSheets();
  if (!sheets || sheets.length === 0) throw new Error("Spreadsheet contains no sheets.");

  // 2. Try trimmed & case-insensitive match
  const target = CONFIG.TRACKER_SHEET.trim().toLowerCase();
  for (let i = 0; i < sheets.length; i++) {
    const sName = sheets[i].getName().trim().toLowerCase();
    if (sName === target) return sheets[i];
  }

  // 3. Try keyword search ("collection" or "tracker")
  for (let i = 0; i < sheets.length; i++) {
    const sName = sheets[i].getName().trim().toLowerCase();
    if (sName.includes("collection") || sName.includes("tracker")) {
      return sheets[i];
    }
  }

  // 4. Primary sheet (not archive/history)
  for (let i = 0; i < sheets.length; i++) {
    const sName = sheets[i].getName().trim().toLowerCase();
    if (!sName.includes("archive") && !sName.includes("history")) {
      return sheets[i];
    }
  }

  // 5. Fallback: First sheet
  return sheets[0];
}

/**
 * Ensures the archive sheet exists and has all 9 columns in correct order:
 * 1. Date Archived
 * 2. Customer ID
 * 3. Customer Name
 * 4. Village Name
 * 5. Original Capital Disbursed
 * 6. Total Amount Repaid
 * 7. Final Balance Due
 * 8. Status at Archive
 * 9. Reason / Notes
 */
function ensureArchiveSheetColumns(sheet) {
  if (!sheet) return;
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();

  if (lastCol === 0 || lastRow === 0) {
    sheet.appendRow([
      "Date Archived", "Customer ID", "Customer Name", "Village Name",
      "Original Capital Disbursed", "Total Amount Repaid",
      "Final Balance Due", "Status at Archive", "Reason / Notes"
    ]);
    sheet.getRange("A1:I1").setBackground("#137333").setFontColor("#FFFFFF").setFontWeight("bold");
    sheet.setFrozenRows(1);
    return;
  }

  const numCols = Math.max(lastCol, 9);
  const headers = sheet.getRange(1, 1, 1, numCols).getValues()[0];
  const col4Header = String(headers[3] || "").trim().toLowerCase();

  // If column 4 is "Original Capital" or "disbursed", insert "Village Name" before col 4
  if (col4Header.includes("original") || col4Header.includes("capital") || col4Header.includes("disbursed")) {
    sheet.insertColumnBefore(4);
    sheet.getRange(1, 4).setValue("Village Name").setBackground("#137333").setFontColor("#FFFFFF").setFontWeight("bold");
    sheet.getRange(1, 9).setValue("Reason / Notes").setBackground("#137333").setFontColor("#FFFFFF").setFontWeight("bold");
  } else if (!col4Header.includes("village")) {
    sheet.getRange(1, 4).setValue("Village Name").setBackground("#137333").setFontColor("#FFFFFF").setFontWeight("bold");
    sheet.getRange(1, 9).setValue("Reason / Notes").setBackground("#137333").setFontColor("#FFFFFF").setFontWeight("bold");
  } else {
    const col9Header = String(sheet.getRange(1, 9).getValue() || "").trim().toLowerCase();
    if (!col9Header.includes("reason")) {
      sheet.getRange(1, 9).setValue("Reason / Notes").setBackground("#137333").setFontColor("#FFFFFF").setFontWeight("bold");
    }
  }
  sheet.getRange("A1:I1").setBackground("#137333").setFontColor("#FFFFFF").setFontWeight("bold");
}

/**
 * Bulletproof Archive Sheet Resolver
 */
function getArchiveSheet(ss) {
  if (!ss) throw new Error("No active spreadsheet found.");

  let sheet = ss.getSheetByName(CONFIG.ARCHIVE_SHEET);
  if (!sheet) {
    const sheets = ss.getSheets();
    for (let i = 0; i < sheets.length; i++) {
      const sName = sheets[i].getName().trim().toLowerCase();
      if (sName.includes("archive") || sName.includes("history")) {
        sheet = sheets[i];
        break;
      }
    }
  }

  if (!sheet) {
    try {
      sheet = ss.insertSheet(CONFIG.ARCHIVE_SHEET);
    } catch (err) {
      return null;
    }
  }

  if (sheet) {
    ensureArchiveSheetColumns(sheet);
  }
  return sheet;
}

/**
 * Checks if a sheet is brand new / completely blank
 */
function isSheetEmpty(sheet) {
  if (!sheet) return true;
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) return true;
  const val = String(sheet.getRange(1, 1).getValue() || "").trim();
  return val === "";
}

/**
 * AUTO-BOOTSTRAP NEW SHEET:
 * Automatically formats an empty spreadsheet into the exact professional
 * Sunday Money Collection Tracker template with headers, styling, freeze panes & archive.
 */
function ensureTrackerSheetInitialized(ss, trackerSheet, payload) {
  if (!trackerSheet) trackerSheet = getTrackerSheet(ss);

  // Rename to CONFIG.TRACKER_SHEET if needed
  try {
    if (trackerSheet.getName().toLowerCase() !== CONFIG.TRACKER_SHEET.toLowerCase()) {
      if (!ss.getSheetByName(CONFIG.TRACKER_SHEET)) {
        trackerSheet.setName(CONFIG.TRACKER_SHEET);
      }
    }
  } catch (e) {}

  if (!isSheetEmpty(trackerSheet)) return trackerSheet;

  // Determine collection weeks
  const weeks = (payload && payload.weeks && payload.weeks.length > 0)
    ? payload.weeks
    : [
        { id: "week_1", label: "Week 1", date: "25-10-2026" },
        { id: "week_2", label: "Week 2", date: "01-11-2026" }
      ];

  const W = weeks.length;
  const totalCols = 9 + W;

  const headerRow1 = new Array(totalCols).fill("");
  const headerRow2 = new Array(totalCols).fill("");

  headerRow1[0] = "Customer Name";
  headerRow1[1] = "Amount Disbursed";

  for (let i = 0; i < W; i++) {
    headerRow1[2 + i] = weeks[i].label || ("Week " + (i + 1));
    headerRow2[2 + i] = weeks[i].date || "";
  }

  const sumStartCol = 2 + W; // 0-indexed
  headerRow1[sumStartCol] = "Account Summary";
  headerRow2[sumStartCol] = "Total Paid";
  headerRow2[sumStartCol + 1] = "Balance Due";
  headerRow2[sumStartCol + 2] = "Repayment Status";

  headerRow1[sumStartCol + 3] = "Customer ID";
  headerRow1[sumStartCol + 4] = "Customer Mobile Number";
  headerRow1[sumStartCol + 5] = "Date of Amount Disbursed";
  headerRow1[sumStartCol + 6] = "Original Amount";

  trackerSheet.getRange(1, 1, 2, totalCols).setValues([headerRow1, headerRow2]);

  // Merge Header cells
  trackerSheet.getRange(1, 1, 2, 1).merge(); // Customer Name
  trackerSheet.getRange(1, 2, 2, 1).merge(); // Amount Disbursed
  trackerSheet.getRange(1, sumStartCol + 1, 1, 3).merge(); // Account Summary
  trackerSheet.getRange(1, sumStartCol + 4, 2, 1).merge(); // Customer ID
  trackerSheet.getRange(1, sumStartCol + 5, 2, 1).merge(); // Mobile
  trackerSheet.getRange(1, sumStartCol + 6, 2, 1).merge(); // Date Disbursed
  trackerSheet.getRange(1, sumStartCol + 7, 2, 1).merge(); // Original Amount

  // Forest Green Header Theme
  const headerRange = trackerSheet.getRange(1, 1, 2, totalCols);
  headerRange.setBackground("#1E4620");
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");
  headerRange.setWrap(true);
  trackerSheet.getRange(1, 1, 2, 1).setHorizontalAlignment("left");

  // Readable Column Widths
  trackerSheet.setColumnWidth(1, 190);
  trackerSheet.setColumnWidth(2, 140);
  for (let i = 0; i < W; i++) {
    trackerSheet.setColumnWidth(3 + i, 115);
  }
  trackerSheet.setColumnWidth(sumStartCol + 1, 120);
  trackerSheet.setColumnWidth(sumStartCol + 2, 120);
  trackerSheet.setColumnWidth(sumStartCol + 3, 130);
  trackerSheet.setColumnWidth(sumStartCol + 4, 120);
  trackerSheet.setColumnWidth(sumStartCol + 5, 140);
  trackerSheet.setColumnWidth(sumStartCol + 6, 130);
  trackerSheet.setColumnWidth(sumStartCol + 7, 140);

  // Freeze Panes
  trackerSheet.setFrozenRows(2);
  trackerSheet.setFrozenColumns(2);

  // Auto-create Archive Sheet tab
  getArchiveSheet(ss);

  // Auto-trim excess blank rows/columns across workbook to avoid cell limits
  trimEntireWorkbook(ss);

  return trackerSheet;
}

/**
 * Helper to inspect sheet layout and locate column indices dynamically
 */
function getSheetColumnMap(trackerSheet) {
  if (isSheetEmpty(trackerSheet)) {
    return {
      summaryCol: 5,
      idCol: 8,
      phoneCol: 9,
      dateCol: 10,
      origCol: 11,
      weeks: [
        { id: "week_1", colIndex: 3, label: "Week 1", date: "25-10-2026" },
        { id: "week_2", colIndex: 4, label: "Week 2", date: "01-11-2026" }
      ]
    };
  }

  const lastCol = trackerSheet.getLastColumn();
  const headersRow1 = trackerSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const headersRow2 = trackerSheet.getRange(2, 1, 1, lastCol).getValues()[0];

  let summaryCol = -1;
  let idCol = -1;
  let phoneCol = -1;
  let dateCol = -1;
  let origCol = -1;
  const weeks = [];

  for (let c = 0; c < headersRow1.length; c++) {
    const t1 = String(headersRow1[c] || "").trim().toLowerCase();
    const t2 = String(headersRow2[c] || "").trim().toLowerCase();
    const combined = (t1 + " " + t2).trim();
    const colIdx = c + 1; // 1-indexed

    if (combined.includes("account summary") || combined.includes("total paid")) {
      if (summaryCol === -1) summaryCol = colIdx;
    } else if (c > 1 && (combined.includes("customer id") || combined.includes("cust id"))) {
      if (idCol === -1) idCol = colIdx;
    } else if (c > 1 && (combined.includes("mobile") || combined.includes("phone"))) {
      if (phoneCol === -1) phoneCol = colIdx;
    } else if (
      c > 1 &&
      !combined.includes("week") &&
      (combined.includes("date of amount") || combined.includes("date disbursed") || combined.includes("disbursed date") || combined.includes("loan date") || (combined.includes("date") && !combined.includes("amount disbursed")))
    ) {
      if (dateCol === -1) dateCol = colIdx;
    } else if (c > 1 && (combined.includes("original") || combined.includes("orig") || combined.includes("sanctioned"))) {
      if (origCol === -1) origCol = colIdx;
    }
  }

  // Weeks are between Col 3 (C) and summaryCol - 1
  if (summaryCol === -1) summaryCol = 5;

  for (let c = 3; c < summaryCol; c++) {
    const rawLabel = String(headersRow1[c - 1] || ("Week " + (c - 2))).trim();
    const rawDate = headersRow2[c - 1];
    let dateStr = "";
    if (rawDate instanceof Date) {
      dateStr = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
    } else {
      dateStr = String(rawDate || "").replace(/^'/, '').trim().replace(/-/g, '/');
    }

    weeks.push({
      id: "week_" + (c - 2),
      colIndex: c,
      label: rawLabel,
      date: dateStr
    });
  }

  return {
    summaryCol: summaryCol,
    idCol: (idCol > 0 && idCol !== 2) ? idCol : (summaryCol + 3),
    phoneCol: (phoneCol > 0 && phoneCol !== 2) ? phoneCol : (summaryCol + 4),
    dateCol: (dateCol > 0 && dateCol !== 2) ? dateCol : (summaryCol + 5),
    origCol: (origCol > 0 && origCol !== 2) ? origCol : (summaryCol + 6),
    weeks: weeks
  };
}

/**
 * Fetch all data from sheets
 */
function fetchAllData(ss) {
  const trackerSheet = getTrackerSheet(ss);
  if (!trackerSheet) throw new Error("Spreadsheet contains no sheets.");

  if (isSheetEmpty(trackerSheet)) {
    return {
      empty: true,
      weeks: [
        { id: "week_1", label: "Week 1", date: "25-10-2026" },
        { id: "week_2", label: "Week 2", date: "01-11-2026" }
      ],
      customers: [],
      weeklyReconciliation: {},
      archive: []
    };
  }

  const lastRow = trackerSheet.getLastRow();
  const lastCol = trackerSheet.getLastColumn();
  const colMap = getSheetColumnMap(trackerSheet);

  const customers = [];
  if (lastRow >= CONFIG.START_CUSTOMER_ROW) {
    const numRows = lastRow - CONFIG.START_CUSTOMER_ROW + 1;
    const allRange = trackerSheet.getRange(CONFIG.START_CUSTOMER_ROW, 1, numRows, lastCol);
    const allData = allRange.getValues();
    const allFontLines = allRange.getFontLines();

    for (let i = 0; i < allData.length; i++) {
      const row = allData[i];
      const name = String(row[0] || "").trim();
      if (name.toLowerCase().includes("total") || name.toLowerCase().includes("less:") || name.toLowerCase().includes("net cash")) break;
      if (!name) continue;

      const disbursed = parseFloat(row[1]) || 0;
      const custId = String(row[colMap.idCol - 1] || ("CUST-" + (i + 1))).trim();

      if (custId.startsWith("VILLAGE-") || name.startsWith("📍 VILLAGE:")) {
        const vName = name.replace("📍 VILLAGE:", "").trim();
        customers.push({
          id: custId,
          name: vName,
          villageName: vName,
          isVillageDivider: true
        });
        continue;
      }

      let phone = String(row[colMap.phoneCol - 1] || "").trim();
      if (phone.includes("E") || phone.includes("e")) {
        const pNum = parseFloat(phone);
        if (!isNaN(pNum)) phone = String(Math.round(pNum));
      }

      let disbDate = "";
      if (row[colMap.dateCol - 1]) {
        const dVal = row[colMap.dateCol - 1];
        if (dVal instanceof Date) {
          disbDate = Utilities.formatDate(dVal, Session.getScriptTimeZone(), "dd/MM/yyyy");
        } else {
          disbDate = String(dVal || "").replace(/^'/, '').trim().replace(/-/g, '/');
        }
      }

      const payments = {};
      const pastCyclePayments = {};
      let hasPastCycle = false;
      let firstActiveWeekId = null;

      colMap.weeks.forEach(w => {
        const val = parseFloat(row[w.colIndex - 1]) || 0;
        const fontLine = (allFontLines[i] && allFontLines[i][w.colIndex - 1]) ? allFontLines[i][w.colIndex - 1] : "none";

        if (fontLine === "line-through") {
          pastCyclePayments[w.id] = val;
          hasPastCycle = true;
        } else {
          payments[w.id] = val;
          if (!firstActiveWeekId) {
            firstActiveWeekId = w.id;
          }
        }
      });

      const statusVal = colMap.summaryCol > 0 ? String(row[colMap.summaryCol + 1] || "").toLowerCase() : "";
      const isArchived = statusVal.includes("archived");

      // Derive startWeekId from disbursedDate if matching a week column
      let startWeekId = null;
      if (disbDate) {
        const normDisb = String(disbDate).replace(/-/g, '/').trim();
        let matchedWeek = colMap.weeks.find(w => String(w.date || '').replace(/-/g, '/').trim() === normDisb);
        if (!matchedWeek) {
          const parseGDate = function(str) {
            if (!str) return null;
            const parts = String(str).trim().split(/[/-]/);
            if (parts.length === 3) {
              if (parts[0].length === 4) return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
              return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
            }
            return null;
          };
          const dObj = parseGDate(disbDate);
          if (dObj && !isNaN(dObj.getTime())) {
            matchedWeek = colMap.weeks.find(w => {
              const wObj = parseGDate(w.date);
              return wObj && wObj.getTime() === dObj.getTime();
            });
            if (!matchedWeek) {
              matchedWeek = colMap.weeks.find(w => {
                const wObj = parseGDate(w.date);
                return wObj && wObj.getTime() >= dObj.getTime();
              });
            }
          }
        }
        if (matchedWeek) {
          startWeekId = matchedWeek.id;
        }
      }

      customers.push({
        id: custId,
        name: name,
        disbursed: disbursed,
        originalAmount: parseFloat(row[colMap.origCol - 1]) || disbursed,
        phone: phone,
        disbursedDate: disbDate,
        startWeekId: startWeekId,
        payments: payments,
        pastCyclePayments: hasPastCycle ? pastCyclePayments : null,
        renewedAtWeek: hasPastCycle ? firstActiveWeekId : null,
        isArchived: isArchived
      });
    }
  }

  // Read Weekly Reconciliation from bottom summary rows
  const weeklyReconciliation = {};
  colMap.weeks.forEach(w => {
    weeklyReconciliation[w.id] = { expenses: 0, amountGiven: 0, salaries: 0 };
  });

  if (lastRow >= CONFIG.START_CUSTOMER_ROW) {
    const bottomRange = trackerSheet.getRange(CONFIG.START_CUSTOMER_ROW, 1, lastRow - CONFIG.START_CUSTOMER_ROW + 1, lastCol).getValues();
    for (let r = 0; r < bottomRange.length; r++) {
      const rowText = (String(bottomRange[r][0] || "") + " " + String(bottomRange[r][1] || "")).toLowerCase();
      if (rowText.includes("previous week") || rowText.includes("prev. week") || rowText.includes("opening cash")) {
        colMap.weeks.forEach(w => {
          const val = bottomRange[r][w.colIndex - 1];
          if (val !== "" && val !== null && val !== undefined) {
            weeklyReconciliation[w.id].prevCash = parseFloat(val) || 0;
          }
        });
      } else if (rowText.includes("operating expenses") || rowText.includes("less: operating") || rowText.includes("expenses")) {
        colMap.weeks.forEach(w => {
          weeklyReconciliation[w.id].expenses = parseFloat(bottomRange[r][w.colIndex - 1]) || 0;
        });
      } else if (rowText.includes("amount given") || rowText.includes("fresh loans") || rowText.includes("less: amount") || rowText.includes("loans given")) {
        colMap.weeks.forEach(w => {
          weeklyReconciliation[w.id].amountGiven = parseFloat(bottomRange[r][w.colIndex - 1]) || 0;
        });
      } else if (rowText.includes("salaries") || rowText.includes("salary")) {
        colMap.weeks.forEach(w => {
          weeklyReconciliation[w.id].salaries = parseFloat(bottomRange[r][w.colIndex - 1]) || 0;
        });
      }
    }
  }

  // Read Archive
  const archive = [];
  const archiveSheet = getArchiveSheet(ss);
  if (archiveSheet && archiveSheet.getLastRow() > 1) {
    ensureArchiveSheetColumns(archiveSheet);
    const lastRow = archiveSheet.getLastRow();
    const lastCol = Math.max(archiveSheet.getLastColumn(), 9);
    const arcData = archiveSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const arcHeaders = archiveSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const hasVillageAtCol4 = String(arcHeaders[3] || "").toLowerCase().includes("village");

    arcData.forEach(r => {
      if (r[1] || r[2]) {
        let dArc = r[0];
        if (dArc instanceof Date) dArc = Utilities.formatDate(dArc, Session.getScriptTimeZone(), "dd/MM/yyyy");

        let village = "";
        let disbursed = 0;
        let totalRepaid = 0;
        let finalBalance = 0;
        let status = "Paid Off";
        let reason = "";

        if (hasVillageAtCol4) {
          village = String(r[3] || "").trim();
          disbursed = parseFloat(r[4]) || 0;
          totalRepaid = parseFloat(r[5]) || 0;
          finalBalance = parseFloat(r[6]) || 0;
          status = String(r[7] || "Paid Off").trim();
          reason = String(r[8] || "").trim();
        } else {
          disbursed = parseFloat(r[3]) || 0;
          totalRepaid = parseFloat(r[4]) || 0;
          finalBalance = parseFloat(r[5]) || 0;
          status = String(r[6] || "Paid Off").trim();
          village = String(r[7] || "").trim();
          reason = String(r[8] || "").trim();
        }

        archive.push({
          dateArchived: String(dArc || "").replace(/-/g, '/'),
          id: String(r[1] || ""),
          name: String(r[2] || ""),
          villageName: village,
          disbursed: disbursed,
          totalRepaid: totalRepaid,
          finalBalance: finalBalance,
          status: status,
          reason: reason
        });
      }
    });
  }

  return {
    weeks: colMap.weeks.map(w => ({ id: w.id, label: w.label, date: w.date })),
    customers: customers,
    weeklyReconciliation: weeklyReconciliation,
    reconciliation: { expenses: 0, amountGiven: 0 },
    archive: archive
  };
}

/**
 * DELETE CUSTOMER: Permanently deletes the matching row from Google Sheet
 * and automatically preserves the customer details, village name, and deletion reason
 * in the "Loan History Archive" sheet tab.
 */
function deleteCustomerRow(ss, payload) {
  const custId = String(payload.custId || "").trim();
  const custName = String(payload.name || "").trim();
  const payloadVillage = String(payload.villageName || "").trim();
  const payloadReason = String(payload.reason || "Deleted by user").trim();
  const archiveRecord = payload.archiveRecord || null;

  const trackerSheet = getTrackerSheet(ss);
  const lastRow = trackerSheet.getLastRow();
  const colMap = getSheetColumnMap(trackerSheet);

  if (lastRow < CONFIG.START_CUSTOMER_ROW) {
    return { success: false, message: "No data rows" };
  }

  const range = trackerSheet.getRange(CONFIG.START_CUSTOMER_ROW, 1, lastRow - CONFIG.START_CUSTOMER_ROW + 1, Math.max(colMap.idCol, 8)).getValues();
  const cleanCustId = custId.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();
  const cleanCustName = custName.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();

  let detectedVillage = payloadVillage;
  let deletedCount = 0;

  // Scan in reverse order so row indices remain accurate during deletions
  for (let i = range.length - 1; i >= 0; i--) {
    const rowName = String(range[i][0] || "").trim();
    const rowId = String(range[i][colMap.idCol - 1] || "").trim();

    if (rowName.toLowerCase().includes("total") || rowName.toLowerCase().includes("less:")) continue;

    const cleanRowId = rowId.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();
    const cleanRowName = rowName.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();

    const isIdMatch = (cleanCustId && cleanCustId !== 'cust-' && cleanRowId === cleanCustId);
    const isNameMatch = (cleanCustName && cleanRowName === cleanCustName);

    if (isIdMatch || isNameMatch) {
      const isDivider = rowName.startsWith("---") || rowName.toLowerCase().includes("village");

      // Save customer to Loan History Archive before deleting from tracker
      if (!isDivider) {
        try {
          const archiveSheet = getArchiveSheet(ss);
          if (archiveSheet) {
            // Find village if not provided
            if (!detectedVillage) {
              for (let v = i - 1; v >= 0; v--) {
                const prevName = String(range[v][0] || "").trim();
                if (prevName.startsWith("---") && prevName.endsWith("---")) {
                  detectedVillage = prevName.replace(/---/g, '').trim();
                  break;
                }
              }
            }

            const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
            const finalDisb = archiveRecord && archiveRecord.disbursed !== undefined
              ? parseFloat(archiveRecord.disbursed) || 0
              : parseFloat(range[i][1]) || 0;
            const finalRepaid = archiveRecord && archiveRecord.totalRepaid !== undefined
              ? parseFloat(archiveRecord.totalRepaid) || 0
              : parseFloat(range[i][colMap.summaryCol - 1]) || 0;
            const finalBal = archiveRecord && archiveRecord.finalBalance !== undefined
              ? parseFloat(archiveRecord.finalBalance) || 0
              : parseFloat(range[i][colMap.summaryCol]) || 0;

            archiveSheet.appendRow([
              "'" + todayStr,
              rowId || custId,
              rowName || custName,
              detectedVillage || "",
              finalDisb,
              finalRepaid,
              finalBal,
              "Deleted",
              payloadReason
            ]);

            const lastArcRow = archiveSheet.getLastRow();
            archiveSheet.getRange(lastArcRow, 5, 1, 3).setNumberFormat("[$₹-4009] #,##0");
          }
        } catch (arcErr) {
          Logger.log("Auto-archive customer warning: " + arcErr.toString());
        }
      }

      const targetRow = CONFIG.START_CUSTOMER_ROW + i;
      trackerSheet.deleteRow(targetRow);
      deletedCount++;
      if (isIdMatch) break; // Unique ID matched: delete only that single record
    }
  }

  if (deletedCount > 0) {
    return { success: true, count: deletedCount, id: custId, name: custName, archived: true };
  }

  return { success: false, message: "Customer not found: " + (custId || custName) };
}

/**
 * DELETE ARCHIVED RECORD: Permanently removes an entry from the Loan History Archive sheet
 */
function deleteArchivedRecordInSheet(ss, payload) {
  const archiveSheet = getArchiveSheet(ss);
  if (!archiveSheet) throw new Error("Archive sheet not found");

  const archiveId = String(payload.archiveId || payload.id || "").trim();
  const custName = String(payload.name || payload.customerName || "").trim();

  const lastRow = archiveSheet.getLastRow();
  if (lastRow <= 1) {
    return { success: false, message: "Archive sheet is empty" };
  }

  const lastCol = Math.max(archiveSheet.getLastColumn(), 9);
  const data = archiveSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const cleanTargetId = archiveId.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();
  const cleanTargetName = custName.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();

  let deletedCount = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    const rowId = String(data[i][1] || "").replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();
    const rowName = String(data[i][2] || "").replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();

    const isIdMatch = (cleanTargetId && (rowId === cleanTargetId || cleanTargetId.includes(rowId) || rowId.includes(cleanTargetId)));
    const isNameMatch = (cleanTargetName && rowName === cleanTargetName);

    if (isIdMatch || isNameMatch) {
      archiveSheet.deleteRow(2 + i);
      deletedCount++;
      break;
    }
  }

  if (deletedCount > 0) {
    return { success: true, count: deletedCount, id: archiveId, name: custName };
  }

  return { success: false, message: "Archived record not found: " + (archiveId || custName) };
}

/**
 * ADD CUSTOMER: Inserts customer row with live formulas
 */
function addCustomerRow(ss, payload) {
  const trackerSheet = getTrackerSheet(ss);
  const lastRow = trackerSheet.getLastRow();
  const colMap = getSheetColumnMap(trackerSheet);

  // Find summary row
  let summaryRow = -1;
  const colA = trackerSheet.getRange(1, 1, lastRow, 1).getValues();
  for (let i = CONFIG.START_CUSTOMER_ROW - 1; i < colA.length; i++) {
    const text = String(colA[i][0] || "").toLowerCase();
    if (text.includes("total") || text.includes("less:") || text.includes("net cash")) {
      summaryRow = i + 1;
      break;
    }
  }
  if (summaryRow === -1) summaryRow = lastRow + 1;

  let newRow = -1;
  if (payload.insertAtStart) {
    trackerSheet.insertRowBefore(CONFIG.START_CUSTOMER_ROW);
    newRow = CONFIG.START_CUSTOMER_ROW;
  } else if (payload.insertAfterId) {
    const afterRange = trackerSheet.getRange(CONFIG.START_CUSTOMER_ROW, 1, lastRow - CONFIG.START_CUSTOMER_ROW + 1, Math.max(colMap.idCol, 8)).getValues();
    for (let i = 0; i < afterRange.length; i++) {
      const rowId = String(afterRange[i][colMap.idCol - 1] || "").trim();
      if (rowId === String(payload.insertAfterId).trim()) {
        const afterRowNum = CONFIG.START_CUSTOMER_ROW + i;
        trackerSheet.insertRowAfter(afterRowNum);
        newRow = afterRowNum + 1;
        break;
      }
    }
  }

  if (newRow === -1) {
    let lastActiveRow = CONFIG.START_CUSTOMER_ROW - 1;
    for (let i = CONFIG.START_CUSTOMER_ROW - 1; i < summaryRow - 1; i++) {
      const text = String(colA[i][0] || "").trim();
      if (text !== "") {
        lastActiveRow = i + 1;
      }
    }
    if (lastActiveRow >= CONFIG.START_CUSTOMER_ROW) {
      trackerSheet.insertRowAfter(lastActiveRow);
      newRow = lastActiveRow + 1;
    } else {
      trackerSheet.insertRowBefore(summaryRow);
      newRow = summaryRow;
    }
  }

  const lastColWidth = trackerSheet.getLastColumn();

  if (payload.isVillageDivider) {
    // Clear entire row first to purge inherited formulas, 0s, and "Paid Off"
    trackerSheet.getRange(newRow, 1, 1, lastColWidth).clearContent().clearFormat();
    
    // Set formatted Village Header
    const nameCell = trackerSheet.getRange(newRow, 1);
    nameCell.setValue(payload.name || "📍 VILLAGE SECTION");
    nameCell.setFontWeight("bold").setFontColor("#1E3A8A").setFontSize(11);
    
    // Save Village ID in ID column
    trackerSheet.getRange(newRow, colMap.idCol).setValue(payload.id);
    trackerSheet.getRange(newRow, 1, 1, lastColWidth).setBackground("#EEF2FF");
    return { success: true, row: newRow };
  }

  // Name & Disbursed
  trackerSheet.getRange(newRow, 1).setValue(payload.name);
  trackerSheet.getRange(newRow, 2).setValue(Number(payload.disbursed) || 0);

  // Set week cells: past weeks before startWeekId shaded grey, active weeks white
  const startWeekId = String(payload.startWeekId || "").trim();
  const matchingStartWeek = colMap.weeks.find(w => w.id === startWeekId);
  const startCol = matchingStartWeek ? matchingStartWeek.colIndex : 3;

  for (let c = 3; c < colMap.summaryCol; c++) {
    const cell = trackerSheet.getRange(newRow, c);
    cell.setValue(0);
    if (c < startCol) {
      cell.setBackground("#F1F5F9");
      cell.setFontColor("#94A3B8");
    } else {
      cell.setBackground("#FFFFFF");
      cell.setFontColor("#0F172A");
    }
  }

  // Formulas
  const lastWeekLetter = String.fromCharCode(64 + colMap.summaryCol - 1);
  const totalPaidLetter = String.fromCharCode(64 + colMap.summaryCol);
  const balLetter = String.fromCharCode(64 + colMap.summaryCol + 1);

  trackerSheet.getRange(newRow, colMap.summaryCol).setFormula(`=SUM(C${newRow}:${lastWeekLetter}${newRow})`);
  trackerSheet.getRange(newRow, colMap.summaryCol + 1).setFormula(`=MAX(0, B${newRow}-${totalPaidLetter}${newRow})`);
  trackerSheet.getRange(newRow, colMap.summaryCol + 2).setFormula(`=IF(${balLetter}${newRow}<=0, "Paid Off", "Active")`);

  // Metadata (Strictly protects Column 2 from being overwritten)
  if (colMap.idCol > 0 && colMap.idCol !== 2) {
    trackerSheet.getRange(newRow, colMap.idCol).setValue(payload.id || "CUST-NEW");
  }
  if (colMap.phoneCol > 0 && colMap.phoneCol !== 2) {
    trackerSheet.getRange(newRow, colMap.phoneCol).setValue("'" + (payload.phone || ""));
  }
  if (colMap.dateCol > 0 && colMap.dateCol !== 2) {
    const rawDisbDate = payload.disbursedDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
    trackerSheet.getRange(newRow, colMap.dateCol).setValue("'" + String(rawDisbDate).replace(/-/g, '/'));
  }
  if (colMap.origCol > 0 && colMap.origCol !== 2) {
    trackerSheet.getRange(newRow, colMap.origCol).setValue(Number(payload.originalAmount || payload.disbursed) || 0).setNumberFormat("[$₹-4009] #,##0");
  }

  return { success: true, row: newRow };
}

/**
 * MOVE CUSTOMER ROW IN SHEET: Swaps row positions (values, formulas, background)
 */
function moveCustomerRowInSheet(ss, payload) {
  const custId = String(payload.custId || "").trim();
  const direction = parseInt(payload.direction, 10); // -1 for UP, +1 for DOWN
  if (!direction || !custId) return { success: false, message: "Invalid parameters" };

  const trackerSheet = getTrackerSheet(ss);
  if (!trackerSheet) return { success: false, message: "Tracker sheet not found" };

  const lastRow = trackerSheet.getLastRow();
  const lastCol = trackerSheet.getLastColumn();
  const colMap = getSheetColumnMap(trackerSheet);

  const range = trackerSheet.getRange(CONFIG.START_CUSTOMER_ROW, 1, lastRow - CONFIG.START_CUSTOMER_ROW + 1, Math.max(colMap.idCol, 8)).getValues();
  let currentRow = -1;
  for (let i = 0; i < range.length; i++) {
    const rowId = String(range[i][colMap.idCol - 1] || "").trim();
    if (rowId === custId) {
      currentRow = CONFIG.START_CUSTOMER_ROW + i;
      break;
    }
  }

  if (currentRow === -1) return { success: false, message: "Row not found for ID: " + custId };

  const targetRow = currentRow + direction;
  if (targetRow < CONFIG.START_CUSTOMER_ROW) {
    return { success: false, message: "Cannot move above top customer row" };
  }

  const targetName = String(trackerSheet.getRange(targetRow, 1).getValue() || "").toLowerCase();
  if (targetName.includes("total") || targetName.includes("less:") || targetName.includes("net cash")) {
    return { success: false, message: "Cannot move past summary row" };
  }

  // Swap the two rows
  const rangeA = trackerSheet.getRange(currentRow, 1, 1, lastCol);
  const rangeB = trackerSheet.getRange(targetRow, 1, 1, lastCol);

  const formulasA = rangeA.getFormulas()[0];
  const valuesA = rangeA.getValues()[0];
  const bgA = rangeA.getBackgrounds()[0];

  const formulasB = rangeB.getFormulas()[0];
  const valuesB = rangeB.getValues()[0];
  const bgB = rangeB.getBackgrounds()[0];

  const combinedA = valuesA.map((v, idx) => formulasA[idx] ? formulasA[idx] : v);
  const combinedB = valuesB.map((v, idx) => formulasB[idx] ? formulasB[idx] : v);

  rangeA.setValues([combinedB]);
  rangeA.setBackgrounds([bgB]);

  rangeB.setValues([combinedA]);
  rangeB.setBackgrounds([bgA]);

  return { success: true, fromRow: currentRow, toRow: targetRow };
}

/**
 * SYNC ROW ORDER: Rearranges rows in Google Sheet to match exact sequence in Web UI
 * Purges empty ghost rows and ensures clean village divider styling
 */
function syncRowOrderInSheet(ss, payload) {
  const orderedIds = payload.orderedIds || [];
  if (!orderedIds || orderedIds.length === 0) return { success: false, message: "No IDs provided" };

  const trackerSheet = getTrackerSheet(ss);
  if (!trackerSheet) return { success: false, message: "Tracker sheet not found" };

  const lastRow = trackerSheet.getLastRow();
  const lastCol = trackerSheet.getLastColumn();
  const colMap = getSheetColumnMap(trackerSheet);

  // Find summary row
  let summaryRow = -1;
  const colA = trackerSheet.getRange(1, 1, lastRow, 1).getValues();
  for (let i = CONFIG.START_CUSTOMER_ROW - 1; i < colA.length; i++) {
    const text = String(colA[i][0] || "").toLowerCase();
    if (text.includes("total") || text.includes("less:") || text.includes("net cash")) {
      summaryRow = i + 1;
      break;
    }
  }
  if (summaryRow === -1) summaryRow = lastRow + 1;

  const rowCount = summaryRow - CONFIG.START_CUSTOMER_ROW;
  if (rowCount <= 0) return { success: false, message: "No customer rows found" };

  const fullRange = trackerSheet.getRange(CONFIG.START_CUSTOMER_ROW, 1, rowCount, lastCol);
  const values = fullRange.getValues();
  const formulas = fullRange.getFormulas();
  const backgrounds = fullRange.getBackgrounds();
  const fontWeights = fullRange.getFontWeights();
  const fontColors = fullRange.getFontColors();

  // Index existing rows by ID or Name
  const rowMap = new Map();
  for (let i = 0; i < rowCount; i++) {
    const rowId = String(values[i][colMap.idCol - 1] || "").trim();
    const rowName = String(values[i][0] || "").trim();
    const rowData = {
      values: values[i],
      formulas: formulas[i],
      backgrounds: backgrounds[i],
      fontWeights: fontWeights[i],
      fontColors: fontColors[i]
    };
    if (rowId) rowMap.set(rowId, rowData);
    if (rowName) rowMap.set("NAME:" + rowName, rowData);
  }

  const newValues = [];
  const newBackgrounds = [];
  const newFontWeights = [];
  const newFontColors = [];

  orderedIds.forEach(id => {
    let rowData = rowMap.get(id);
    if (!rowData) {
      // Find village divider by prefix
      for (let [k, v] of rowMap.entries()) {
        if (id.startsWith("VILLAGE-") && (k.startsWith("VILLAGE-") || k.includes("VILLAGE:"))) {
          rowData = v;
          break;
        }
      }
    }

    if (rowData) {
      const isVillage = id.startsWith("VILLAGE-") || String(rowData.values[0] || "").includes("VILLAGE:");
      const combined = rowData.values.map((v, idx) => rowData.formulas[idx] ? rowData.formulas[idx] : v);

      if (isVillage) {
        // Clear all columns across the divider row except Column 1 (Name) and ID column
        for (let c = 1; c < lastCol; c++) {
          if (c !== colMap.idCol - 1) {
            combined[c] = "";
          }
        }
        combined[colMap.idCol - 1] = id;

        newValues.push(combined);
        newBackgrounds.push(new Array(lastCol).fill("#EEF2FF"));
        newFontWeights.push(new Array(lastCol).fill("bold"));
        newFontColors.push(new Array(lastCol).fill("#1E3A8A"));
      } else {
        newValues.push(combined);
        newBackgrounds.push(rowData.backgrounds);
        newFontWeights.push(rowData.fontWeights);
        newFontColors.push(rowData.fontColors);
      }
    }
  });

  if (newValues.length > 0) {
    // 1. Wipe customer area clean
    fullRange.clearContent();
    fullRange.clearFormat();

    // 2. Write new properly ordered rows
    const writeRange = trackerSheet.getRange(CONFIG.START_CUSTOMER_ROW, 1, newValues.length, lastCol);
    writeRange.setValues(newValues);
    writeRange.setBackgrounds(newBackgrounds);
    writeRange.setFontWeights(newFontWeights);
    writeRange.setFontColors(newFontColors);

    // 3. Format currency columns for customer rows
    for (let i = 0; i < newValues.length; i++) {
      const isVillage = String(newValues[i][0] || "").includes("VILLAGE:");
      const rNum = CONFIG.START_CUSTOMER_ROW + i;
      if (!isVillage) {
        trackerSheet.getRange(rNum, 2, 1, colMap.summaryCol + 1).setNumberFormat("[$₹] #,##0.00");
      }
    }
  }

  return { success: true, count: newValues.length };
}

/**
 * ADD WEEK: Inserts weekly column and updates sum ranges
 */
function addWeekColumn(ss, payload) {
  const trackerSheet = getTrackerSheet(ss);
  const colMap = getSheetColumnMap(trackerSheet);

  trackerSheet.insertColumnBefore(colMap.summaryCol);
  const newCol = colMap.summaryCol;

  trackerSheet.getRange(1, newCol).setValue(payload.label || "Week");
  const rawWeekDate = payload.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
  trackerSheet.getRange(2, newCol).setValue("'" + String(rawWeekDate).replace(/-/g, '/'));

  // Zero out all customer cells in this new week
  const lastRow = trackerSheet.getLastRow();
  for (let r = CONFIG.START_CUSTOMER_ROW; r <= lastRow; r++) {
    const name = String(trackerSheet.getRange(r, 1).getValue() || "").trim().toLowerCase();
    if (name.includes("total") || name.includes("less:") || name.includes("previous week") || name.includes("net cash")) break;
    if (name) {
      trackerSheet.getRange(r, newCol).setValue(0);
    }
  }

  // Refresh all reconciliation formulas and format new column
  syncReconciliationInSheet(ss, payload);
  trimExcessSheetGrid(trackerSheet);

  return { success: true, newCol: newCol };
}

/**
 * DELETE LATEST WEEK
 */
function deleteLatestWeekColumn(ss, payload) {
  const trackerSheet = getTrackerSheet(ss);
  const colMap = getSheetColumnMap(trackerSheet);

  if (colMap.weeks.length > 1) {
    const targetCol = colMap.summaryCol - 1;
    trackerSheet.deleteColumn(targetCol);
    syncReconciliationInSheet(ss, payload);
    return { success: true, deletedCol: targetCol };
  }
  return { success: false, message: "Cannot delete the only week column" };
}

/**
 * UPDATE WEEKS IN SHEET:
 * Updates the label (Row 1) and date (Row 2) for all week columns in Google Sheet.
 */
function updateWeeksInSheet(ss, payload) {
  const trackerSheet = getTrackerSheet(ss);
  if (!trackerSheet) return { success: false, message: "Tracker sheet not found" };

  const weeks = payload.weeks || [];
  if (!weeks || weeks.length === 0) return { success: false, message: "No weeks provided" };

  const colMap = getSheetColumnMap(trackerSheet);
  if (!colMap.weeks || colMap.weeks.length === 0) {
    return { success: false, message: "No week columns found in sheet" };
  }

  // Update existing week columns in Sheet Row 1 and Row 2
  for (let i = 0; i < colMap.weeks.length && i < weeks.length; i++) {
    const wObj = weeks[i];
    const colIdx = colMap.weeks[i].colIndex;
    if (wObj.label) {
      trackerSheet.getRange(1, colIdx).setValue(wObj.label);
    }
    if (wObj.date) {
      // Store date with apostrophe prefix to ensure exact literal string format (e.g. 18-10-2026 or 18/10/2026)
      trackerSheet.getRange(2, colIdx).setValue("'" + String(wObj.date));
    }
  }

  return { success: true, count: Math.min(colMap.weeks.length, weeks.length) };
}

/**
 * UPDATE PAYMENT: Cell update
 */
function updateSinglePayment(ss, payload) {
  const { custId, weekId, amount } = payload;
  const custName = String(payload.name || payload.customerName || "").trim();
  const trackerSheet = getTrackerSheet(ss);
  const lastRow = trackerSheet.getLastRow();
  const colMap = getSheetColumnMap(trackerSheet);

  // Match week column
  const matchingWeek = colMap.weeks.find(w => w.id === weekId);
  const targetCol = matchingWeek ? matchingWeek.colIndex : (2 + (parseInt(weekId.replace("week_", ""), 10) || 1));

  const range = trackerSheet.getRange(CONFIG.START_CUSTOMER_ROW, 1, lastRow - CONFIG.START_CUSTOMER_ROW + 1, Math.max(colMap.idCol, 8)).getValues();
  const cleanCustId = String(custId || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();
  const cleanCustName = custName.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();

  for (let i = 0; i < range.length; i++) {
    const rowId = String(range[i][colMap.idCol - 1] || "").trim();
    const rowName = String(range[i][0] || "").trim();
    const cleanRowId = rowId.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();
    const cleanRowName = rowName.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();

    const isIdMatch = (cleanCustId && cleanCustId !== 'cust-' && cleanRowId === cleanCustId);
    const isNameMatch = (cleanCustName && (cleanRowName === cleanCustName || cleanRowName.replace(/📍/g, '').replace(/village:/g, '').trim() === cleanCustName));
    const isNameContains = (cleanCustName.length >= 3 && cleanRowName.length >= 3 && (cleanRowName.includes(cleanCustName) || cleanCustName.includes(cleanRowName)));

    if (isIdMatch || isNameMatch || (!cleanCustId && isNameContains) || (cleanCustId === 'cust-' && isNameContains)) {
      const targetRow = CONFIG.START_CUSTOMER_ROW + i;
      try {
        trackerSheet.getRange(targetRow, targetCol).setValue(Number(amount) || 0);
      } catch (cellErr) {
        // Auto-recover if workbook hit cell quota
        trimExcessSheetGrid(trackerSheet);
        trimEntireWorkbook(ss);
        trackerSheet.getRange(targetRow, targetCol).setValue(Number(amount) || 0);
      }
      return { success: true, row: targetRow, col: targetCol, amount: amount, id: rowId, name: rowName };
    }
  }

  return { success: false, message: "Customer not found: " + (custId || custName) };
}

/**
 * UPDATE CUSTOMER FIELD: Updates name, disbursed, phone, date or id
 */
function updateCustomerFieldInSheet(ss, payload) {
  const { custId, field, value } = payload;
  const custName = String(payload.name || payload.customerName || "").trim();
  const trackerSheet = getTrackerSheet(ss);
  if (!trackerSheet) return { success: false, message: "Tracker sheet not found" };

  const lastRow = trackerSheet.getLastRow();
  if (lastRow < CONFIG.START_CUSTOMER_ROW) {
    return { success: false, message: "No customer rows found in sheet" };
  }

  const colMap = getSheetColumnMap(trackerSheet);

  let targetCol = -1;
  if (field === 'name') targetCol = 1;
  else if (field === 'disbursed') targetCol = 2;
  else if (field === 'id') targetCol = colMap.idCol;
  else if (field === 'phone') targetCol = colMap.phoneCol;
  else if (field === 'disbursedDate') targetCol = colMap.dateCol;
  else if (field === 'originalAmount') targetCol = colMap.origCol;

  if (targetCol === -1 || targetCol > trackerSheet.getLastColumn()) {
    return { success: false, message: "Target column not found for field: " + field };
  }

  const maxCol = Math.min(trackerSheet.getLastColumn(), Math.max(colMap.idCol || 1, colMap.origCol || 1, colMap.dateCol || 1, targetCol, 12));
  const range = trackerSheet.getRange(CONFIG.START_CUSTOMER_ROW, 1, lastRow - CONFIG.START_CUSTOMER_ROW + 1, maxCol).getValues();
  const cleanCustId = String(custId || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();
  const cleanCustName = custName.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();

  for (let i = 0; i < range.length; i++) {
    const rowId = String(range[i][colMap.idCol - 1] || "").trim();
    const rowName = String(range[i][0] || "").trim();
    const cleanRowId = rowId.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();
    const cleanRowName = rowName.replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();

    const cleanRowNameWithoutVillage = cleanRowName.replace(/📍/g, '').replace(/village:/g, '').trim();

    const isIdMatch = (cleanCustId && cleanCustId !== 'cust-' && cleanRowId === cleanCustId);
    const isNameMatch = (cleanCustName && (cleanRowName === cleanCustName || cleanRowNameWithoutVillage === cleanCustName));
    const isNameContains = (cleanCustName.length >= 3 && cleanRowName.length >= 3 && (cleanRowName.includes(cleanCustName) || cleanCustName.includes(cleanRowName)));

    if (isIdMatch || isNameMatch || (!cleanCustId && isNameContains) || (cleanCustId === 'cust-' && isNameContains)) {
      const targetRow = CONFIG.START_CUSTOMER_ROW + i;
      const isVillageRow = cleanRowId.startsWith('village-') || cleanRowName.includes('village:');

      if (field === 'disbursed' || field === 'originalAmount') {
        trackerSheet.getRange(targetRow, targetCol).setValue(Number(value) || 0);
      } else if (field === 'phone' || field === 'disbursedDate') {
        trackerSheet.getRange(targetRow, targetCol).setValue("'" + String(value || ""));
      } else if (field === 'name' || field === 'villageName') {
        const valToSet = isVillageRow ? ("📍 VILLAGE: " + String(value || "").replace("📍 VILLAGE:", "").trim()) : String(value || "");
        trackerSheet.getRange(targetRow, targetCol).setValue(valToSet);
      } else {
        trackerSheet.getRange(targetRow, targetCol).setValue(String(value || ""));
      }
      return { success: true, row: targetRow, col: targetCol, field: field, value: value, id: rowId, name: rowName };
    }
  }

  return { success: false, message: "Customer not found in sheet: " + (custName || custId) };
}

/**
 * ARCHIVE LOANS: Moves paid off to archive and deletes from tracker
 */
function archiveLoansInSheet(ss, payload) {
  const trackerSheet = getTrackerSheet(ss);
  const archiveSheet = getArchiveSheet(ss);
  if (!archiveSheet) throw new Error("Archive sheet not found");

  const archivedCustomers = payload.archived || [];
  const rowsToAdd = archivedCustomers.map(c => [
    "'" + (c.dateArchived ? String(c.dateArchived).replace(/-/g, '/') : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy")),
    c.id,
    c.name,
    c.villageName || c.village || "",
    c.disbursed || 0,
    c.totalPaid || c.totalRepaid || 0,
    c.balance || c.finalBalance || 0,
    "Paid Off",
    c.reason || "Loan Completed"
  ]);

  if (rowsToAdd.length > 0) {
    archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, rowsToAdd.length, 9).setValues(rowsToAdd);
    const lastArcRow = archiveSheet.getLastRow();
    archiveSheet.getRange(lastArcRow - rowsToAdd.length + 1, 5, rowsToAdd.length, 3).setNumberFormat("[$₹-4009] #,##0");
  }

  // Strike off payments on tracker sheet with distinct purple shading rather than deleting the rows
  const idsToArchive = new Set(archivedCustomers.map(c => String(c.id || "").trim().toLowerCase()));
  const namesToArchive = new Set(archivedCustomers.map(c => String(c.name || "").trim().toLowerCase()));
  const lastRow = trackerSheet.getLastRow();
  const colMap = getSheetColumnMap(trackerSheet);

  if (lastRow >= CONFIG.START_CUSTOMER_ROW) {
    const range = trackerSheet.getRange(CONFIG.START_CUSTOMER_ROW, 1, lastRow - CONFIG.START_CUSTOMER_ROW + 1, Math.max(colMap.idCol, 8)).getValues();
    const weekColsCount = (colMap.summaryCol - 1) - 3 + 1;

    for (let i = 0; i < range.length; i++) {
      const rowId = String(range[i][colMap.idCol - 1] || "").trim().toLowerCase();
      const rowName = String(range[i][0] || "").trim().toLowerCase();

      if (idsToArchive.has(rowId) || namesToArchive.has(rowName)) {
        const targetRow = CONFIG.START_CUSTOMER_ROW + i;
        if (weekColsCount > 0) {
          const weekRange = trackerSheet.getRange(targetRow, 3, 1, weekColsCount);
          weekRange.setBackground("#F3E8FF"); // light purple shading
          weekRange.setFontColor("#6B21A8");
          weekRange.setFontLine("line-through");
        }
        if (colMap.summaryCol > 0) {
          trackerSheet.getRange(targetRow, colMap.summaryCol + 2).setValue("Archived (Paid Off)");
        }
      }
    }
  }

  return { success: true, count: rowsToAdd.length };
}

/**
 * ARCHIVE & RENEW CUSTOMER LOAN (API):
 * 1. Logs past completed loan cycle to "Loan History Archive" sheet tab
 * 2. Keeps past cycle payments in place with strikethrough (line-through) and warm amber fill (#FEF3C7)
 * 3. Starts active weeks from renewal week with 0 and clean white formatting
 * 4. Overwrites Column B (Amount Disbursed) with the new loan amount
 * 5. Updates Date Disbursed & Original Amount columns
 * 6. Updates Total Paid formula to only sum new payments from renewal week onward
 */
function archiveAndRenewCustomerInSheet(ss, payload) {
  const trackerSheet = getTrackerSheet(ss);
  const archiveSheet = getArchiveSheet(ss);
  if (!archiveSheet) throw new Error("Archive sheet not found");

  const custId = String(payload.customerId || "").trim();
  const custName = String(payload.customerName || "").trim();
  const newAmount = parseFloat(payload.newAmount || 0);
  const newDate = String(payload.newDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy")).replace(/-/g, '/').trim();
  const rec = payload.archiveRecord || {};

  // 1. Append permanent history record to "Loan History Archive" tab
  const timeStr = rec.dateArchived || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
  const oldDisb = rec.disbursed !== undefined ? rec.disbursed : 0;
  const totPaid = rec.totalRepaid !== undefined ? rec.totalRepaid : 0;
  const bal = rec.finalBalance !== undefined ? rec.finalBalance : 0;
  const stat = rec.status || "Active";
  const villageName = rec.villageName || payload.villageName || "";
  const reason = rec.reason || payload.reason || "Loan Renewed";

  archiveSheet.appendRow([
    "'" + String(timeStr).replace(/-/g, '/'),
    rec.id || custId,
    rec.name || custName,
    villageName,
    oldDisb,
    totPaid,
    bal,
    stat,
    reason
  ]);

  const lastArcRow = archiveSheet.getLastRow();
  archiveSheet.getRange(lastArcRow, 5, 1, 3).setNumberFormat("[$₹-4009] #,##0");

  // 2. Locate customer row in trackerSheet
  const lastRow = trackerSheet.getLastRow();
  const colMap = getSheetColumnMap(trackerSheet);
  const range = trackerSheet.getRange(CONFIG.START_CUSTOMER_ROW, 1, Math.max(1, lastRow - CONFIG.START_CUSTOMER_ROW + 1), Math.max(colMap.idCol, 8)).getValues();

  let targetRow = -1;
  for (let i = 0; i < range.length; i++) {
    const rowId = String(range[i][colMap.idCol - 1] || "").trim();
    const rowName = String(range[i][0] || "").trim();
    if ((custId && rowId.toLowerCase() === custId.toLowerCase()) || (custName && rowName.toLowerCase() === custName.toLowerCase())) {
      targetRow = CONFIG.START_CUSTOMER_ROW + i;
      break;
    }
  }

  if (targetRow !== -1) {
    const renewWeekId = String(payload.renewedAtWeek || "").trim();
    const matchingWeek = colMap.weeks.find(w => w.id === renewWeekId);
    const renewCol = matchingWeek ? matchingWeek.colIndex : 3;

    // 1. For weeks prior to renewal week (e.g. Week 1, 2, 3 before Week 4):
    // Display past amounts, strikethrough, amber fill
    const pastPayments = payload.pastCyclePayments || rec.payments || {};
    const pastColsCount = (renewCol - 1) - 3 + 1;
    if (pastColsCount > 0) {
      for (let c = 3; c < renewCol; c++) {
        const weekIndex = c - 3;
        const weekObj = colMap.weeks[weekIndex];
        const cell = trackerSheet.getRange(targetRow, c);
        if (weekObj && pastPayments[weekObj.id] !== undefined && Number(pastPayments[weekObj.id]) > 0) {
          cell.setValue(Number(pastPayments[weekObj.id]));
        }
        cell.setBackground("#FEF3C7"); // warm amber shading
        cell.setFontColor("#92400E");
        cell.setFontLine("line-through");
        cell.setNumberFormat("[$₹-4009] #,##0");
      }
    }

    // 2. For active weeks from renewal week onward (e.g. Week 4+): Reset to 0 with clean formatting
    const activeColsCount = (colMap.summaryCol - 1) - renewCol + 1;
    if (activeColsCount > 0) {
      const activeRange = trackerSheet.getRange(targetRow, renewCol, 1, activeColsCount);
      activeRange.setValue(0);
      activeRange.setBackground("#FFFFFF");
      activeRange.setFontColor("#0F172A");
      activeRange.setFontLine("none");
      activeRange.setNumberFormat("[$₹-4009] #,##0");
    }

    // 3. Overwrite Column B (Amount Disbursed) with new loan amount
    trackerSheet.getRange(targetRow, 2).setValue(newAmount).setNumberFormat("[$₹-4009] #,##0");

    // 4. Overwrite Date Disbursed & Original Amount (Strictly protect Column 2)
    if (colMap.dateCol > 0 && colMap.dateCol !== 2) {
      trackerSheet.getRange(targetRow, colMap.dateCol).setValue("'" + newDate);
    }
    if (colMap.origCol > 0 && colMap.origCol !== 2) {
      trackerSheet.getRange(targetRow, colMap.origCol).setValue(newAmount).setNumberFormat("[$₹-4009] #,##0");
    }

    // 5. Update Total Paid formula to only sum from renewal week onward
    const renewColLetter = String.fromCharCode(64 + renewCol);
    const lastWeekLetter = String.fromCharCode(64 + colMap.summaryCol - 1);
    trackerSheet.getRange(targetRow, colMap.summaryCol).setFormula(`=SUM(${renewColLetter}${targetRow}:${lastWeekLetter}${targetRow})`);
  }

  return {
    success: true,
    message: "Archived past loan for " + (custName || custId) + " and set new loan to ₹" + newAmount
  };
}

/**
 * SPREADSHEET onEdit TRIGGER:
 * Listens for edits to the "Archive Loans" checkbox in the spreadsheet control panel.
 * When checked (TRUE):
 * 1. Reads the customer selected in the "Select Customer" cell.
 * 2. Pops up a prompt dialog: "Enter the new loan amount disbursed to [Customer Name] (₹):"
 * 3. Logs history into "Loan History Archive" tab.
 * 4. Strikes out past week cells (line-through, #F1F3F4, #80868B) and clears payment amounts so Total Paid becomes 0.
 * 5. Updates Column B (Amount Disbursed) with the new loan amount and updates Date Disbursed.
 * 6. Clears the "Select Customer" dropdown and unchecks the "Archive Loans" checkbox.
 * 7. Displays success alert.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const ss = e.source || SpreadsheetApp.getActiveSpreadsheet();

  let trackerSheet;
  try {
    trackerSheet = getTrackerSheet(ss);
  } catch (err) {
    return;
  }
  if (!trackerSheet || sheet.getName() !== trackerSheet.getName()) return;

  const row = e.range.getRow();
  const col = e.range.getColumn();

  // Trigger when editing Column B
  if (col === 2) {
    const labelA = String(sheet.getRange(row, 1).getValue() || "").trim().toLowerCase();
    if (labelA.includes("archive loan")) {
      const isChecked = (e.value === "TRUE" || e.range.getValue() === true);
      if (isChecked) {
        handleSheetArchiveLoansWorkflow(sheet, ss, e.range);
      }
    }
  }
}

/**
 * Executes the complete Archive & Renew workflow directly inside Google Sheets
 */
function handleSheetArchiveLoansWorkflow(sheet, ss, checkboxCell) {
  const ui = SpreadsheetApp.getUi();
  const colMap = getSheetColumnMap(sheet);
  const lastRow = sheet.getLastRow();

  // Find the "Select Customer" cell in Column A
  let selectCustRow = -1;
  const colAValues = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (let r = 0; r < colAValues.length; r++) {
    const label = String(colAValues[r][0] || "").trim().toLowerCase();
    if (label.includes("select customer")) {
      selectCustRow = r + 1;
      break;
    }
  }

  if (selectCustRow === -1) {
    ui.alert("⚠️ Could not locate the 'Select Customer' row in Column A.");
    checkboxCell.setValue(false);
    return;
  }

  const selectCell = sheet.getRange(selectCustRow, 2);
  const selectedCust = String(selectCell.getValue() || "").trim();

  if (!selectedCust) {
    ui.alert("⚠️ Please select or type a customer name in the 'Select Customer' cell (Row " + selectCustRow + ", Column B) before checking Archive Loans.");
    checkboxCell.setValue(false);
    return;
  }

  // Scan main customer rows (between row 3 and rowCollections or control panel)
  let custRow = -1;
  const scanLimit = Math.min(selectCustRow - 1, lastRow);
  const custRange = sheet.getRange(CONFIG.START_CUSTOMER_ROW, 1, Math.max(1, scanLimit - CONFIG.START_CUSTOMER_ROW + 1), Math.max(colMap.idCol, 8)).getValues();

  for (let i = 0; i < custRange.length; i++) {
    const rowName = String(custRange[i][0] || "").trim();
    const rowId = String(custRange[i][colMap.idCol - 1] || "").trim();
    if (rowName.toLowerCase() === selectedCust.toLowerCase() || (rowId && rowId.toLowerCase() === selectedCust.toLowerCase())) {
      custRow = CONFIG.START_CUSTOMER_ROW + i;
      break;
    }
  }

  if (custRow === -1) {
    ui.alert("⚠️ Customer '" + selectedCust + "' was not found in active rows (Rows 3 to " + scanLimit + ").");
    checkboxCell.setValue(false);
    return;
  }

  // Read current row data
  const custName = String(sheet.getRange(custRow, 1).getValue() || selectedCust).trim();
  const oldDisbursed = sheet.getRange(custRow, 2).getValue() || 0;
  const custId = colMap.idCol > 0 ? sheet.getRange(custRow, colMap.idCol).getValue() : "";
  const totalPaid = colMap.summaryCol > 0 ? sheet.getRange(custRow, colMap.summaryCol).getValue() || 0 : 0;
  const balanceDue = colMap.summaryCol > 0 ? sheet.getRange(custRow, colMap.summaryCol + 1).getValue() || 0 : 0;
  const status = colMap.summaryCol > 0 ? String(sheet.getRange(custRow, colMap.summaryCol + 2).getValue() || "Active") : "Active";

  // Prompt user for new loan amount
  const promptResponse = ui.prompt(
    "Archive & Renew Loan",
    "Enter the new loan amount disbursed to " + custName + " (₹):",
    ui.ButtonSet.OK_CANCEL
  );

  if (promptResponse.getSelectedButton() !== ui.Button.OK) {
    checkboxCell.setValue(false);
    return;
  }

  const rawInput = promptResponse.getResponseText().replace(/[^0-9.]/g, "").trim();
  const newAmount = parseFloat(rawInput);
  if (isNaN(newAmount) || newAmount <= 0) {
    ui.alert("⚠️ Invalid loan amount entered. Archive cancelled.");
    checkboxCell.setValue(false);
    return;
  }

  // 1. Record history into "Loan History Archive" Tab
  const archiveSheet = getArchiveSheet(ss);
  ensureArchiveSheetColumns(archiveSheet);
  const now = new Date();
  const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy");
  archiveSheet.appendRow([
    "'" + timeStr,
    custId,
    custName,
    "",
    oldDisbursed,
    totalPaid,
    balanceDue,
    status,
    "Renewed via Sheet Checkbox"
  ]);
  const lastArcRow = archiveSheet.getLastRow();
  archiveSheet.getRange(lastArcRow, 5, 1, 3).setNumberFormat("[$₹-4009] #,##0");

  // 2. Clean up active tracker row
  // Strike out completed weeks: Column C up to column before Total Paid (KEEP existing payment values)
  const weekColsCount = (colMap.summaryCol - 1) - 3 + 1;
  if (weekColsCount > 0) {
    const weekRange = sheet.getRange(custRow, 3, 1, weekColsCount);
    // Keep values so historical records are not wiped out to 0
    weekRange.setBackground("#FEF3C7");
    weekRange.setFontColor("#92400E");
    weekRange.setFontLine("line-through");
  }

  // Update loan balance: Overwrites Column B (Amount Disbursed)
  sheet.getRange(custRow, 2).setValue(newAmount).setNumberFormat("[$₹-4009] #,##0");

  // Update Date of Disbursement to today
  const todayStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy");
  if (colMap.dateCol > 0) {
    sheet.getRange(custRow, colMap.dateCol).setValue("'" + todayStr);
  }
  if (colMap.origCol > 0) {
    sheet.getRange(custRow, colMap.origCol).setValue(newAmount).setNumberFormat("[$₹-4009] #,##0");
  }

  // Clear "Select Customer" dropdown & uncheck "Archive Loans"
  selectCell.clearContent();
  checkboxCell.setValue(false);

  // Success alert
  ui.alert("Archived past loan for " + custName + " and set new loan to ₹" + Utilities.formatNumber(newAmount, "en_IN", "#,##0") + ".");
}

/**
 * Adds custom menu on sheet open
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("⚡ Tracker Actions")
      .addItem("📦 Archive & Renew Customer Loan", "promptArchiveAndRenewLoan")
      .addSeparator()
      .addItem("🧹 Clean & Fix Cell Limit (Trim Blank Rows/Cols)", "menuTrimWorkbook")
      .addToUi();
  } catch (e) {}
}

/**
 * Menu action: Trims all excess rows and columns in the workbook to permanently fix cell limits
 */
function menuTrimWorkbook() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  try {
    trimEntireWorkbook(ss);
    ui.alert("Success", "Cleaned & trimmed workbook!\n\nAll excess padding rows and empty columns have been safely removed. Cell quota limit is now permanently resolved.", ui.ButtonSet.OK);
  } catch (err) {
    ui.alert("Error", "Could not trim workbook: " + err.toString(), ui.ButtonSet.OK);
  }
}

/**
 * Menu action helper
 */
function promptArchiveAndRenewLoan() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getTrackerSheet(ss);
  const ui = SpreadsheetApp.getUi();

  const promptCust = ui.prompt("Archive & Renew Loan", "Enter Customer Name or ID to archive & renew:", ui.ButtonSet.OK_CANCEL);
  if (promptCust.getSelectedButton() !== ui.Button.OK) return;

  const target = promptCust.getResponseText().trim();
  if (!target) return;

  // Set into Select Customer cell if found and call workflow
  const lastRow = sheet.getLastRow();
  let selectCustRow = -1;
  const colAValues = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (let r = 0; r < colAValues.length; r++) {
    if (String(colAValues[r][0] || "").trim().toLowerCase().includes("select customer")) {
      selectCustRow = r + 1;
      break;
    }
  }

  if (selectCustRow > 0) {
    sheet.getRange(selectCustRow, 2).setValue(target);
  }

  const dummyCheckbox = { setValue: function() {} };
  handleSheetArchiveLoansWorkflow(sheet, ss, dummyCheckbox);
}

/**
 * Helper to convert 1-based column index to letter (1 -> A, 3 -> C, 27 -> AA)
 */
function getColumnLetter(colIndex) {
  let temp, letter = '';
  let col = colIndex;
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = Math.floor((col - temp - 1) / 26);
  }
  return letter;
}

/**
 * MASTER RECONCILIATION SYNCHRONIZATION
 * Ensures all 5 rows exist in exact order at bottom of sheet:
 *   1. Total Weekly Collections
 *   2. + Prev. Week Cash (₹)
 *   3. Less: Operating Expenses
 *   4. Less: Amount Given
 *   5. Net Cash in Hand
 * Automatically inserts missing rows, writes week values, live formulas, and INR currency formatting.
 */
function syncReconciliationInSheet(ss, payload) {
  const trackerSheet = getTrackerSheet(ss);
  if (!trackerSheet) return { success: false, message: "Tracker sheet not found" };

  const colMap = getSheetColumnMap(trackerSheet);
  const lastRow = trackerSheet.getLastRow();
  if (lastRow < CONFIG.START_CUSTOMER_ROW) {
    return { success: false, message: "Sheet has no customer rows" };
  }

  // Scan column A to locate reconciliation rows
  const colA = trackerSheet.getRange(1, 1, lastRow, 1).getValues();
  let rowCollections = -1;
  let rowPrevCash = -1;
  let rowExpenses = -1;
  let rowGiven = -1;
  let rowSalaries = -1;
  let rowNetCash = -1;

  for (let r = 0; r < colA.length; r++) {
    const text = String(colA[r][0] || "").trim().toLowerCase();
    const rowNum = r + 1;
    if (text.includes("total weekly collections") || (text.includes("weekly collections") && text.includes("total"))) {
      rowCollections = rowNum;
    } else if (text.includes("previous week") || text.includes("prev. week") || text.includes("opening cash") || text.includes("+ prev")) {
      rowPrevCash = rowNum;
    } else if (text.includes("operating expenses") || (text.includes("less") && text.includes("expense")) || text.includes("expenses")) {
      rowExpenses = rowNum;
    } else if (text.includes("amount given") || (text.includes("less") && text.includes("given")) || text.includes("loans given")) {
      rowGiven = rowNum;
    } else if (text.includes("salaries") || text.includes("salary")) {
      rowSalaries = rowNum;
    } else if (text.includes("net cash in hand") || text.includes("net cash")) {
      rowNetCash = rowNum;
    }
  }

  // 1. If rowCollections missing, append at bottom
  if (rowCollections === -1) {
    rowCollections = trackerSheet.getLastRow() + 1;
    trackerSheet.getRange(rowCollections, 1).setValue("Total Weekly Collections").setFontWeight("bold");
  }

  // 2. If rowPrevCash missing, insert immediately after rowCollections
  if (rowPrevCash === -1) {
    trackerSheet.insertRowAfter(rowCollections);
    rowPrevCash = rowCollections + 1;
    trackerSheet.getRange(rowPrevCash, 1).setValue("+ Prev. Week Cash (₹)").setFontWeight("bold").setFontColor("#1E293B");
    if (rowExpenses >= rowPrevCash) rowExpenses++;
    if (rowGiven >= rowPrevCash) rowGiven++;
    if (rowSalaries >= rowPrevCash) rowSalaries++;
    if (rowNetCash >= rowPrevCash) rowNetCash++;
  }

  // 3. If rowExpenses missing, insert immediately after rowPrevCash
  if (rowExpenses === -1) {
    trackerSheet.insertRowAfter(rowPrevCash);
    rowExpenses = rowPrevCash + 1;
    trackerSheet.getRange(rowExpenses, 1).setValue("Less: Operating Expenses").setFontColor("#991B1B");
    if (rowGiven >= rowExpenses) rowGiven++;
    if (rowSalaries >= rowExpenses) rowSalaries++;
    if (rowNetCash >= rowExpenses) rowNetCash++;
  }

  // 4. If rowGiven missing, insert immediately after rowExpenses
  if (rowGiven === -1) {
    trackerSheet.insertRowAfter(rowExpenses);
    rowGiven = rowExpenses + 1;
    trackerSheet.getRange(rowGiven, 1).setValue("Less: Amount Given").setFontColor("#991B1B");
    if (rowSalaries >= rowGiven) rowSalaries++;
    if (rowNetCash >= rowGiven) rowNetCash++;
  }

  // 5. If rowSalaries missing, insert immediately after rowGiven
  if (rowSalaries === -1) {
    trackerSheet.insertRowAfter(rowGiven);
    rowSalaries = rowGiven + 1;
    trackerSheet.getRange(rowSalaries, 1).setValue("Less: Salaries").setFontColor("#6B21A8");
    if (rowNetCash >= rowSalaries) rowNetCash++;
  }

  // 6. If rowNetCash missing, insert immediately after rowSalaries
  if (rowNetCash === -1) {
    trackerSheet.insertRowAfter(rowSalaries);
    rowNetCash = rowSalaries + 1;
    trackerSheet.getRange(rowNetCash, 1).setValue("Net Cash in Hand").setFontWeight("bold").setFontColor("#137333");
  }

  // Identify customer data boundaries
  const firstCustRow = CONFIG.START_CUSTOMER_ROW;
  const lastCustRow = rowCollections - 1;
  const summaryCol = colMap.summaryCol;
  const summaryColLetter = getColumnLetter(summaryCol);

  const weeklyReconMap = payload.weeklyReconciliation || {};

  // Update reconciliation values and live formulas across each week column
  colMap.weeks.forEach((w, idx) => {
    const cLetter = getColumnLetter(w.colIndex);

    // Live Collection Sum Formula for this week: =SUM(C3:C59)
    if (lastCustRow >= firstCustRow) {
      trackerSheet.getRange(rowCollections, w.colIndex).setFormula("=SUM(" + cLetter + firstCustRow + ":" + cLetter + lastCustRow + ")");
    }

    // Resolve week recon object
    let weekRecon = null;
    if (weeklyReconMap[w.id]) {
      weekRecon = weeklyReconMap[w.id];
    } else if (payload.weekId === w.id || payload.weekIndex === idx || (payload.label && String(payload.label).toLowerCase() === String(w.label).toLowerCase())) {
      weekRecon = {
        prevCash: payload.prevCash,
        expenses: payload.expenses,
        amountGiven: payload.amountGiven,
        salaries: payload.salaries
      };
    } else if (payload.weeks && payload.weeks[idx]) {
      const uId = payload.weeks[idx].id;
      if (weeklyReconMap[uId]) weekRecon = weeklyReconMap[uId];
    }

    // Write Prev. Week Cash (₹)
    if (weekRecon && weekRecon.prevCash !== undefined && weekRecon.prevCash !== null && weekRecon.prevCash !== '') {
      trackerSheet.getRange(rowPrevCash, w.colIndex).setValue(Number(weekRecon.prevCash));
    } else if (idx === 0) {
      trackerSheet.getRange(rowPrevCash, w.colIndex).setValue(0);
    } else {
      const prevWeekColLetter = getColumnLetter(colMap.weeks[idx - 1].colIndex);
      trackerSheet.getRange(rowPrevCash, w.colIndex).setFormula("=" + prevWeekColLetter + rowNetCash);
    }

    // Write Operating Expenses
    if (weekRecon && weekRecon.expenses !== undefined) {
      trackerSheet.getRange(rowExpenses, w.colIndex).setValue(Number(weekRecon.expenses) || 0);
    }

    // Write Loans Given
    if (weekRecon && weekRecon.amountGiven !== undefined) {
      trackerSheet.getRange(rowGiven, w.colIndex).setValue(Number(weekRecon.amountGiven) || 0);
    }

    // Write Salaries
    if (weekRecon && weekRecon.salaries !== undefined) {
      trackerSheet.getRange(rowSalaries, w.colIndex).setValue(Number(weekRecon.salaries) || 0);
    }

    // Net Cash in Hand Formula: =(C60+C61)-C62-C63-C64
    trackerSheet.getRange(rowNetCash, w.colIndex).setFormula("=(" + cLetter + rowCollections + "+" + cLetter + rowPrevCash + ")-" + cLetter + rowExpenses + "-" + cLetter + rowGiven + "-" + cLetter + rowSalaries);
  });

  // Summary Column Formulas & Formats
  if (colMap.weeks.length > 0) {
    const firstWeekLetter = getColumnLetter(colMap.weeks[0].colIndex);
    const lastWeekLetter = getColumnLetter(colMap.weeks[colMap.weeks.length - 1].colIndex);

    trackerSheet.getRange(rowCollections, summaryCol).setFormula("=SUM(" + firstWeekLetter + rowCollections + ":" + lastWeekLetter + rowCollections + ")");
    trackerSheet.getRange(rowPrevCash, summaryCol).setValue("-");
    trackerSheet.getRange(rowExpenses, summaryCol).setFormula("=SUM(" + firstWeekLetter + rowExpenses + ":" + lastWeekLetter + rowExpenses + ")");
    trackerSheet.getRange(rowGiven, summaryCol).setFormula("=SUM(" + firstWeekLetter + rowGiven + ":" + lastWeekLetter + rowGiven + ")");
    trackerSheet.getRange(rowSalaries, summaryCol).setFormula("=SUM(" + firstWeekLetter + rowSalaries + ":" + lastWeekLetter + rowSalaries + ")");
    trackerSheet.getRange(rowNetCash, summaryCol).setFormula("=(" + summaryColLetter + rowCollections + "-" + summaryColLetter + rowExpenses + "-" + summaryColLetter + rowGiven + "-" + summaryColLetter + rowSalaries + ")");

    // Format Number Cells (INR Currency)
    const startCol = colMap.weeks[0].colIndex;
    const totalCols = summaryCol - startCol + 1;
    trackerSheet.getRange(rowCollections, startCol, 6, totalCols).setNumberFormat("[$₹] #,##0.00;[Red]-[$₹] #,##0.00;\"₹ 0.00\"");

    // Styling
    trackerSheet.getRange(rowCollections, 1, 1, summaryCol).setBackground("#F8FAFC").setFontWeight("bold");
    trackerSheet.getRange(rowNetCash, 1, 1, summaryCol).setBackground("#E6F4EA").setFontWeight("bold");
  }

  return {
    success: true,
    rows: {
      collections: rowCollections,
      prevCash: rowPrevCash,
      expenses: rowExpenses,
      given: rowGiven,
      salaries: rowSalaries,
      netCash: rowNetCash
    }
  };
}

/**
 * UPDATE WEEK RECONCILIATION: Updates reconciliation in sheet
 */
function updateWeekReconciliation(ss, payload) {
  return syncReconciliationInSheet(ss, payload);
}

/**
 * Populates all customer records, village divider banners, live formulas, and styling.
 */
function writeAllCustomersToSheet(trackerSheet, colMap, customers) {
  if (!customers || customers.length === 0) return;

  const startRow = CONFIG.START_CUSTOMER_ROW;
  const totalCols = colMap.origCol;
  const numCust = customers.length;

  const firstWeekLetter = getColumnLetter(colMap.weeks[0].colIndex);
  const lastWeekLetter = getColumnLetter(colMap.weeks[colMap.weeks.length - 1].colIndex);
  const summaryColLetter = getColumnLetter(colMap.summaryCol);
  const balanceDueLetter = getColumnLetter(colMap.summaryCol + 1);

  // Locate existing reconciliation rows (if any)
  const lastRow = trackerSheet.getLastRow();
  let existingReconRow = -1;
  if (lastRow >= startRow) {
    const colA = trackerSheet.getRange(startRow, 1, lastRow - startRow + 1, 1).getValues();
    for (let i = 0; i < colA.length; i++) {
      const txt = String(colA[i][0] || "").toLowerCase();
      if (txt.includes("total") || txt.includes("less:") || txt.includes("net cash")) {
        existingReconRow = startRow + i;
        break;
      }
    }
  }

  // Adjust row count in customer area if needed
  const existingCustCount = existingReconRow !== -1 ? (existingReconRow - startRow) : (lastRow >= startRow ? (lastRow - startRow + 1) : 0);
  if (existingReconRow !== -1) {
    if (numCust > existingCustCount) {
      trackerSheet.insertRowsAfter(existingReconRow - 1, numCust - existingCustCount);
    } else if (numCust < existingCustCount) {
      trackerSheet.deleteRows(startRow + numCust, existingCustCount - numCust);
    }
  }

  const values = [];
  const backgrounds = [];
  const fontWeights = [];
  const fontColors = [];
  const fontLines = [];

  for (let i = 0; i < numCust; i++) {
    const c = customers[i];
    const r = startRow + i;
    const rowVals = new Array(totalCols).fill("");
    const rowBg = new Array(totalCols).fill(i % 2 === 0 ? "#FFFFFF" : "#F8FAFC");
    const rowWeight = new Array(totalCols).fill("normal");
    const rowColor = new Array(totalCols).fill("#0F172A");
    const rowLine = new Array(totalCols).fill("none");

    const isVillage = c.isVillageDivider || String(c.id || "").startsWith("VILLAGE-") || String(c.name || "").includes("VILLAGE:");

    if (isVillage) {
      const vName = String(c.name || "").replace("📍", "").trim();
      rowVals[0] = vName.startsWith("VILLAGE:") ? ("📍 " + vName) : ("📍 VILLAGE: " + vName);
      rowVals[colMap.idCol - 1] = c.id || ("VILLAGE-" + (i + 1));

      for (let j = 0; j < totalCols; j++) {
        rowBg[j] = "#EEF2FF"; // Soft indigo highlight
        rowWeight[j] = "bold";
        rowColor[j] = "#1E3A8A";
      }
    } else {
      rowVals[0] = c.name || "";
      rowVals[1] = Number(c.disbursed) || 0;

      // Determine renewal column if this customer was renewed
      let renewCol = -1;
      if (c.renewedAtWeek) {
        const matchingRenewWeek = colMap.weeks.find(w => w.id === c.renewedAtWeek);
        if (matchingRenewWeek) renewCol = matchingRenewWeek.colIndex;
      }

      // Payments for each week with past cycle strikethrough preservation
      colMap.weeks.forEach(w => {
        const isPastWeek = (renewCol !== -1 && w.colIndex < renewCol);
        if (isPastWeek) {
          const pastVal = (c.pastCyclePayments && c.pastCyclePayments[w.id] !== undefined)
            ? Number(c.pastCyclePayments[w.id])
            : (Number(c.payments?.[w.id]) || 0);
          rowVals[w.colIndex - 1] = pastVal;
          rowBg[w.colIndex - 1] = "#FEF3C7"; // warm amber shading
          rowColor[w.colIndex - 1] = "#92400E";
          rowLine[w.colIndex - 1] = "line-through";
        } else {
          rowVals[w.colIndex - 1] = Number(c.payments?.[w.id]) || 0;
        }
      });

      // Total Paid formula: only sum active weeks from renewal week if renewed
      const sumStartLetter = (renewCol !== -1) ? getColumnLetter(renewCol) : firstWeekLetter;
      rowVals[colMap.summaryCol - 1] = "=SUM(" + sumStartLetter + r + ":" + lastWeekLetter + r + ")";

      // Balance Due formula: =MAX(0, B3 - E3)
      rowVals[colMap.summaryCol] = "=MAX(0, B" + r + " - " + summaryColLetter + r + ")";

      // Repayment Status formula: =IF(F3<=0, "Paid Off", "Active")
      rowVals[colMap.summaryCol + 1] = "=IF(" + balanceDueLetter + r + "<=0, \"Paid Off\", \"Active\")";

      // Metadata with proper quoting to prevent date/phone corruption
      rowVals[colMap.idCol - 1] = c.id || ("CUST-" + (i + 1));
      rowVals[colMap.phoneCol - 1] = c.phone ? ("'" + String(c.phone).trim()) : "";
      rowVals[colMap.dateCol - 1] = c.disbursedDate ? ("'" + String(c.disbursedDate).replace(/-/g, '/').trim()) : "";
      rowVals[colMap.origCol - 1] = Number(c.originalAmount) || Number(c.disbursed) || 0;
    }

    values.push(rowVals);
    backgrounds.push(rowBg);
    fontWeights.push(rowWeight);
    fontColors.push(rowColor);
    fontLines.push(rowLine);
  }

  // Batch write all customer rows
  const custRange = trackerSheet.getRange(startRow, 1, numCust, totalCols);
  custRange.setValues(values);
  custRange.setBackgrounds(backgrounds);
  custRange.setFontWeights(fontWeights);
  custRange.setFontColors(fontColors);
  custRange.setFontLines(fontLines);

  // Set number formatting for currency columns
  trackerSheet.getRange(startRow, 2, numCust, 1).setNumberFormat("[$₹] #,##0.00");
  colMap.weeks.forEach(w => {
    trackerSheet.getRange(startRow, w.colIndex, numCust, 1).setNumberFormat("[$₹] #,##0.00");
  });
  trackerSheet.getRange(startRow, colMap.summaryCol, numCust, 2).setNumberFormat("[$₹] #,##0.00");
  trackerSheet.getRange(startRow, colMap.origCol, numCust, 1).setNumberFormat("[$₹] #,##0.00");
}

/**
 * SYNC ALL: Full dataset rewrite (Works seamlessly on empty or existing sheets)
 */
function syncAllData(ss, payload) {
  const trackerSheet = getTrackerSheet(ss);
  ensureTrackerSheetInitialized(ss, trackerSheet, payload);

  const colMap = getSheetColumnMap(trackerSheet);
  const customers = payload.customers || [];

  if (payload.weeks && payload.weeks.length > 0) {
    updateWeeksInSheet(ss, payload);
  }

  if (customers.length > 0) {
    writeAllCustomersToSheet(trackerSheet, colMap, customers);
  } else {
    // If customers list is empty, clean any existing customer rows
    const lastRow = trackerSheet.getLastRow();
    const startRow = CONFIG.START_CUSTOMER_ROW;
    let reconRow = -1;
    if (lastRow >= startRow) {
      const colA = trackerSheet.getRange(startRow, 1, lastRow - startRow + 1, 1).getValues();
      for (let i = 0; i < colA.length; i++) {
        const txt = String(colA[i][0] || "").toLowerCase();
        if (txt.includes("total") || txt.includes("less:") || txt.includes("net cash")) {
          reconRow = startRow + i;
          break;
        }
      }
      if (reconRow > startRow) {
        trackerSheet.deleteRows(startRow, reconRow - startRow);
      }
    }
  }

  // Master reconciliation sync
  syncReconciliationInSheet(ss, payload);

  // Auto-trim excess grid cells across workbook to prevent hitting limits
  trimEntireWorkbook(ss);

  return { success: true };
}

/**
 * ==============================================================================
 * AUTOMATIC WORKBOOK CELL OPTIMIZER & QUOTA PROTECTOR
 * ==============================================================================
 * Trims excess blank rows and columns to eliminate millions of unneeded cells,
 * ensuring sheets stay lightning-fast and never hit Google's 10M / 20M cell limits.
 */
function trimExcessSheetGrid(sheet) {
  if (!sheet) return;
  try {
    const maxRows = sheet.getMaxRows();
    const lastRow = Math.max(sheet.getLastRow(), 2);
    // Keep at most 25 padding rows below active data, minimum 30 rows
    const desiredMaxRows = Math.max(lastRow + 25, 30);
    if (maxRows > desiredMaxRows) {
      sheet.deleteRows(desiredMaxRows + 1, maxRows - desiredMaxRows);
    }

    const maxCols = sheet.getMaxColumns();
    const lastCol = Math.max(sheet.getLastColumn(), 2);
    // Keep at most 3 padding columns to the right, minimum 15 columns
    const desiredMaxCols = Math.max(lastCol + 3, 15);
    if (maxCols > desiredMaxCols) {
      sheet.deleteColumns(desiredMaxCols + 1, maxCols - desiredMaxCols);
    }
  } catch (e) {
    // Gracefully ignore if sheet cannot be trimmed further
  }
}

/**
 * Trims all sheets across the workbook and removes empty default tabs (like 'Sheet1')
 */
function trimEntireWorkbook(ss) {
  if (!ss) return;
  try {
    const sheets = ss.getSheets();
    for (let i = 0; i < sheets.length; i++) {
      const sh = sheets[i];
      const sName = sh.getName().trim().toLowerCase();
      // Remove unused blank default tabs like "Sheet1" if another tracker tab exists
      if (sheets.length > 1 && (sName === "sheet1" || sName === "sheet 1") && sh.getLastRow() === 0 && sh.getLastColumn() === 0) {
        try { ss.deleteSheet(sh); } catch (e) {}
      } else {
        trimExcessSheetGrid(sh);
      }
    }
  } catch (e) {}
}
