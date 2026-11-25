const SPREADSHEET_ID = 'PASTE_PRIVATE_SHEET_ID_HERE';
const RESPONSES_TAB = 'Jaiho91 Bonus Signups';

function doGet() {
  return HtmlService.createHtmlOutput(`<!doctype html>
<html lang="hi">
<head>
  <base target="_top">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px 16px; font: 16px/1.55 system-ui, sans-serif; color: #f7f1f8; background: #100e13; }
    main { max-width: 440px; padding: 24px; margin: 5vh auto; border: 1px solid #60435e; border-radius: 14px; background: #1a161e; }
    h1 { margin: 0; line-height: 1.2; font-size: 1.6rem; }
    p { color: #d6c6d9; }
    label { display: block; }
    input[name="phone"] { width: 100%; margin: 6px 0 16px; padding: 10px 12px; border: 1px solid #885376; border-radius: 8px; background: #100e13; color: inherit; font: inherit; }
    button { width: 100%; margin-top: 16px; padding: 11px; border: 0; border-radius: 8px; background: #fb94d8; color: #251021; font: inherit; font-weight: 700; }
    a { color: #fb94d8; }
    :focus-visible { outline: 2px solid #fb94d8; outline-offset: 3px; }
    .trap { position: absolute; left: -10000px; }
    #status { min-height: 1.55em; }
  </style>
</head>
<body>
  <main>
    <h1>Jaiho91 बोनस अपडेट</h1>
    <p lang="hi-Latn">Jaiho91 ke bonus updates ke liye apna mobile number dein.</p>
    <form id="signup">
      <label for="phone">मोबाइल नंबर / Mobile number</label>
      <input id="phone" name="phone" type="tel" autocomplete="tel-national" inputmode="tel" maxlength="20" required>
      <div class="trap" aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off"></div>
      <label><input name="consent" type="checkbox" required> मैं इस नंबर पर बोनस अपडेट पाने के लिए सहमत हूँ। <span lang="hi-Latn">Main is number par bonus updates paane se sehmat hoon.</span></label>
      <p>आपका नंबर Google Sheets में रखा जाएगा। <a href="https://jaiho91rtp.com/privacy/">गोपनीयता / Privacy</a></p>
      <button type="submit">साइन अप करें / Sign up</button>
    </form>
    <p id="status" role="status"></p>
  </main>
  <script>
    const form = document.querySelector('#signup');
    const status = document.querySelector('#status');
    const button = form.querySelector('button');
    const messages = {
      saved:'साइन अप हो गया। / Signup complete.',
      invalid:'10 अंकों का भारतीय मोबाइल नंबर डालें। / Enter a 10-digit Indian mobile number.',
      consent:'साइन अप करने के लिए सहमति दें। / Tick the box to sign up.',
      retry:'फिर से कोशिश करें। / Please try again.'
    };
    function showResult(result) {
      status.textContent = messages[result] || messages.retry;
      button.disabled = false;
      if (result === 'saved') form.reset();
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      button.disabled = true;
      status.textContent = 'भेज रहे हैं… / Sending…';
      google.script.run.withSuccessHandler(showResult).withFailureHandler(() => showResult('retry'))
        .submitSignup(form.elements.phone.value, form.elements.consent.checked, form.elements.website.value);
    });
  </script>
</body>
</html>`).setTitle('Jaiho91 Bonus Updates').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(event) {
  const fields = event?.parameter || {};
  let result = 'retry';
  try {
    result = submitSignup(fields.phone, fields.consent === '1', fields.website);
  } catch {
    // Keep public responses free of Sheet details.
  }
  return ContentService.createTextOutput(JSON.stringify({ result }))
    .setMimeType(ContentService.MimeType.JSON);
}

function submitSignup(phone, consent, website) {
  if (website) return 'saved';
  if (consent !== true) return 'consent';
  if (typeof phone !== 'string' || phone.length > 20) return 'invalid';
  const number = phone.trim().replace(/[\s()-]/g, '').replace(/^\+91(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(number)) return 'invalid';

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return 'retry';
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(RESPONSES_TAB) || spreadsheet.insertSheet(RESPONSES_TAB);
    const lastRow = sheet.getLastRow();
    if (lastRow === 0) sheet.appendRow(['Submitted at', 'Mobile number', 'Consent to bonus updates']);
    if (lastRow > 1 && sheet.getRange(2, 2, lastRow - 1, 1).createTextFinder(number).matchEntireCell(true).findNext()) {
      return 'saved';
    }
    sheet.appendRow([new Date(), "'" + number, true]);
    SpreadsheetApp.flush();
    return 'saved';
  } finally {
    lock.releaseLock();
  }
}
