const DAY = 86400000;
const text = (value) => String(value).replaceAll("\\", "\\\\").replace(/\r?\n/g, "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
const dateStamp = (date) => date.toISOString().slice(0, 10).replaceAll("-", "");

export function blackFridayDate(now = new Date()) {
  let year = now.getFullYear();
  const friday = (year) => {
    const first = new Date(Date.UTC(year, 10, 1));
    return new Date(Date.UTC(year, 10, 1 + (5 - first.getUTCDay() + 7) % 7 + 21));
  };
  let date = friday(year);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (date.getTime() < today) date = friday(++year);
  return date;
}

function foldLine(line) {
  const lines = [];
  let chunk = "", bytes = 0;
  for (const char of line) {
    const length = new TextEncoder().encode(char).length;
    if (bytes + length > 75) { lines.push(chunk); chunk = " "; bytes = 1; }
    chunk += char; bytes += length;
  }
  lines.push(chunk);
  return lines.join("\r\n");
}

export function calendarReminder({ birthday, link = "https://christmasidea.co.uk/", now = new Date(), uid = crypto.randomUUID() } = {}) {
  let date, summary;
  if (birthday) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) throw new TypeError("Choose a valid birthday date");
    const occasion = new Date(`${birthday}T00:00:00Z`);
    if (!Number.isFinite(occasion.getTime()) || occasion.toISOString().slice(0, 10) !== birthday) throw new TypeError("Choose a valid birthday date");
    date = new Date(occasion.getTime() - 14 * DAY);
    summary = "Choose a birthday gift";
  } else {
    date = blackFridayDate(now); summary = "Review your Black Friday gift shortlist";
  }
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (date.getTime() < today) throw new RangeError("The reminder date is in the past. Choose an occasion at least two weeks away.");
  const url = new URL(link);
  if (!["https:", "http:"].includes(url.protocol)) throw new TypeError("Invalid reminder link");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Santas Helper//Gift Reminder//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${uid}@christmasidea.co.uk`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    `DTSTART;VALUE=DATE:${dateStamp(date)}`, `DTEND;VALUE=DATE:${dateStamp(new Date(date.getTime() + DAY))}`,
    `SUMMARY:${text(summary)}`, `DESCRIPTION:${text(`Return to Santa's Helper to choose a gift: ${url}`)}`,
    `URL:${url}`, "BEGIN:VALARM", "TRIGGER:PT0S", "ACTION:DISPLAY",
    `DESCRIPTION:${text(summary)}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
