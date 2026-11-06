import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const read = (name) => readFile(new URL(`../site/${name}`, import.meta.url), "utf8");

function contrast(a, b) {
  const luminance = (hex) => hex.slice(1).match(/../g).map((part) => {
    const channel = parseInt(part, 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}

test("interactive paper, selected and status palettes retain accessible contrast", async () => {
  const css = await read("theme.css");
  const root = css.match(/:root\{([\s\S]*?)\n\}/)[1];
  const palette = Object.fromEntries([...root.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map((match) => [match[1], match[2]]));
  for (const surface of ["field-paper", "selected-paper"]) {
    for (const text of ["ink", "muted", "accent", "gold-ink"]) {
      assert.ok(contrast(palette[text], palette[surface]) >= 4.5, `${text} on ${surface}`);
    }
    assert.ok(contrast(palette["control-line"], palette[surface]) >= 3, `control boundary on ${surface}`);
    assert.ok(contrast(palette.focus, palette[surface]) >= 3, `focus on ${surface}`);
  }
  for (const state of ["success", "warning", "error"]) {
    assert.ok(contrast(palette[state], palette[`${state}-bg`]) >= 4.5, state);
  }
});

test("both writing surfaces keep associated labels, limits and integrated live counts", async () => {
  const html = await read("index.html");
  for (const [id, count, limit] of [["description", "description-count", 1200], ["site-feedback-note", "feedback-count", 500]]) {
    assert.match(html, new RegExp(`<label[^>]*for="${id}"`));
    const field = html.match(new RegExp(`<textarea id="${id}"[^>]+>`))[0];
    assert.match(field, new RegExp(`maxlength="${limit}"`));
    assert.match(field, new RegExp(`aria-describedby="[^"]*${count}`));
    const eventSource = html.match(new RegExp(`\\$\\("#${id}"\\)\\.addEventListener\\("input", \\(e\\) => \\{([\\s\\S]*?)\\n\\}\\);`))[1];
    const elements = { [`#${id}`]: { removeAttribute() {} }, [`#${count}`]: {} };
    runInNewContext(eventSource, { $: (selector) => elements[selector], e: { target: { value: "A thoughtful gift" } } });
    assert.equal(elements[`#${count}`].textContent, `17 / ${limit.toLocaleString("en-GB")}`);
  }
});

test("ratings retain native mutually exclusive radios with explicit accessible names", async () => {
  const html = await read("index.html");
  const ratings = [...html.matchAll(/<input type="radio" name="site-rating" value="(\d)" aria-label="([^"]+)">/g)];
  assert.deepEqual(ratings.map((match) => match[1]), ["1", "2", "3", "4", "5"]);
  ratings.forEach((match) => assert.match(match[2], new RegExp(`^${match[1]} out of 5`)));
  assert.match(await read("home.css"), /\.feedback-rating-option input:focus-visible\+span\{outline:2px solid var\(--focus\)/);
});

test("interactive controls and confirmations remain legible on inverse burgundy cards", async () => {
  for (const [file, selector] of [["home.css", /\.card\.featured\{([\s\S]*?)\n\}/], ["guide.css", /\.idea:first-child\{([^}]+)\}/]]) {
    const declarations = (await read(file)).match(selector)[1];
    const palette = Object.fromEntries([...declarations.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map((match) => [match[1], match[2]]));
    for (const surface of ["field-paper", "selected-paper"]) {
      for (const text of ["ink", "muted", "accent"]) {
        assert.ok(contrast(palette[text], palette[surface]) >= 4.5, `${file}: ${text} on ${surface}`);
      }
    }
  }
});

test("feedback prepares the same optional email draft without claiming it was sent", async () => {
  const html = await read("index.html");
  const source = html.match(/\$\("#website-feedback"\)\.addEventListener\("submit", \(event\) => \{([\s\S]*?)\n\}\);/)[1];
  for (const [rating, note] of [[null, ""], ["4", ""], [null, "A little suggestion"], ["5", "Thank you"]]) {
    const status = {};
    const location = {};
    let prevented = false;
    runInNewContext(`(() => {${source}})()`, {
      $: (selector) => selector === "#site-feedback-note" ? { value: note } : status,
      window: { location },
      event: { preventDefault() { prevented = true; }, currentTarget: { querySelector: () => rating ? { value: rating } : null } },
    });
    assert.ok(prevented);
    if (!rating && !note) {
      assert.equal(location.href, undefined);
      assert.match(status.textContent, /No feedback added/);
    } else {
      const email = new URL(location.href);
      assert.equal(email.protocol, "mailto:");
      assert.equal(email.pathname, "support@christmasidea.co.uk");
      assert.equal(email.searchParams.get("body").includes("Rating:"), Boolean(rating));
      if (note) assert.ok(email.searchParams.get("body").includes(note));
      assert.match(status.textContent, /Review it and choose Send/);
    }
  }
});

test("shared controls support reduced motion, forced colours and field validation", async () => {
  const theme = await read("theme.css");
  assert.match(theme, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(theme, /@media\(forced-colors:active\)/);
  assert.match(theme, /:where\(select\)[\s\S]*appearance:none/);
  assert.match(theme, /aria-invalid=true/);
  assert.match(theme, /\.writing-field:focus-within\{[^}]*outline:2px/);
  const html = await read("index.html");
  for (const id of ["description", "budget-amount", "interests"]) {
    assert.match(html, new RegExp(`\\$\\("#${id}"\\)\\.setAttribute\\("aria-invalid", "true"\\)`));
    assert.match(html.match(new RegExp(`<[^>]+id="${id}"[^>]+>`))[0], /aria-describedby="[^"]*status/);
  }
  assert.match(html, /id="site-feedback-status" role="status" aria-live="polite"/);
  assert.match(html, /Nothing is sent until you choose to send the email/);
});
