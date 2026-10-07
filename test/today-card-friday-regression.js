'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function extractFunction(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'missing ' + name);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('unterminated ' + name);
}
const context = {};
vm.createContext(context);
vm.runInContext([extractFunction('mins'), extractFunction('splitPayHoursForDay'), extractFunction('todayFridayStatusText')].join('\n'), context);
const weekday = new Date(2026, 9, 7, 12);
const weekdaySplit = context.splitPayHoursForDay(weekday, { in: '06:00', out: '17:00' });
assert.equal(weekdaySplit.regular, 8);
assert.equal(weekdaySplit.h125, 3);
assert.equal(weekdaySplit.h150, 0);
const eightHours = context.splitPayHoursForDay(weekday, { in: '06:00', out: '14:00' });
assert.equal(eightHours.regular, 8);
assert.equal(eightHours.h125, 0);
const friday = new Date(2026, 9, 9, 12);
const split = context.splitPayHoursForDay(friday, { in: '06:00', out: '12:00' });
assert.equal(split.h125, 2);
assert.equal(split.h150, 4);
assert.equal(split.regular, 0);
const note = context.todayFridayStatusText(friday, split.h125, split.h150);
assert.ok(note.includes('2.00 שעות 125%'));
assert.ok(note.includes('4.00 שעות 150%'));
assert.doesNotMatch(note, /17:00/);
assert.equal(context.todayFridayStatusText(new Date(2026, 9, 8, 12), 2, 4), null);
assert.ok(source.includes('150% היום<b id="today150">'));
assert.ok(source.includes('today150.textContent=h150.toFixed(2)'));
console.log('PASS: Weekday overtime starts after 8 hours from entry; Friday still splits 2h at 125% and the rest at 150%.');
