'use strict';
// Synthetic attendance tests and supplied report totals, not verified payroll data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function extract(name) {
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
const el = value => ({ value: String(value), textContent: '', innerHTML: '', style: {} });
const elements = {};
const writes = [];
const knownStart = source.indexOf('const known={');
assert.notEqual(knownStart, -1, 'missing embedded report data');
const known = vm.runInNewContext(source.slice(knownStart, source.indexOf('function pad(', knownStart)) + '\nknown;');
assert.equal(known['2026-9'], undefined, 'revisit October source assumptions if an official report is added');
const entries = {
  '2026-09-22': { in: '06:00', out: '20:00' }, // Outside cycle.
  '2026-09-23': { in: '07:30', out: '19:30' }, // 0.9h at 150%, no early cut here.
  '2026-09-25': { in: '06:00', out: '12:00' }, // Friday: 4h at 150%.
  '2026-10-22': { in: '08:00', out: '20:00' }, // Last day included: 0.9h.
  '2026-10-23': { in: '06:00', out: '20:00' } // Outside cycle.
};
const c = {
  hourlyRate: el(46.70), salaryRegular: el(184.20), salary125: el(44.83),
  salary150: el(20.17), salaryUnauthorizedEarlyHours: el(2.35),
  baseSalary: el(8500), standardHours: el(182), salaryExtras: el(100),
  salaryPaidExtraHours: el(0), salaryPensionDeduction: el(510),
  salaryGross: el(0), salaryNet: el(0), salaryBreakdown: el(''), netBreakdown: el(''),
  salaryNote: el(''), salaryPeriod: el(''), salaryDaysDetail: el(''),
  y: el(2026), m: 10, currentUser: null, known, dbEntriesByDate: entries,
  document: { getElementById: id => elements[id] ||= el('') },
  localStorage: { getItem: () => null, setItem: (...args) => writes.push(args) },
  salaryStateKey: () => 'salary-state', dbSaveSalarySettings: () => {},
  edits: () => ({}), store: () => ({}), dayName: () => '',
  getBestEntryForDate: d => entries[c.isoLocal(d)] || null
};
vm.createContext(c);
vm.runInContext(['pad', 'mins', 'salaryBounds', 'salaryRange', 'isoLocal',
  'splitPayHoursForDay', 'calculatePeriodPayHours', 'calcSalary'].map(extract).join('\n') +
  '\n' + source.slice(source.indexOf('async function loadSalary('), source.indexOf('function calcSalary(')), c);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const money = element => Number(element.textContent.replace(/[^0-9.]/g, ''));
const reconciliation = () => elements.salaryReportReconciliation;

async function main() {
  const auto = c.calculatePeriodPayHours(2026, 10);
  close(auto.h150, 5.8);
  close(auto.h150, auto.details.reduce((sum, d) => sum + (d.h150 || 0), 0));
  assert.equal(auto.daysCount, 3);
  assert.equal(auto.details[0].date, '2026-09-23');
  assert.equal(auto.details.at(-1).date, '2026-10-22');
  c.salaryUnauthorizedEarlyHours.value = '0';
  close(c.calculatePeriodPayHours(2026, 10).h150, 5.8);
  c.salaryUnauthorizedEarlyHours.value = '2.35';
  close(c.calculatePeriodPayHours(2026, 10).h150, 5.8);

  // Supplied summary: compare deduction once with no further deduction.
  c.calcSalary(false);
  assert.equal(money(c.salaryGross), 12465.24);
  assert.equal(money(c.salaryNet), 11012.60);
  assert.match(c.salaryBreakdown.innerHTML, /17\.82 ש׳/);
  assert.match(reconciliation().innerHTML, /12629\.86/);
  assert.match(reconciliation().innerHTML, /11164\.77/);
  c.salaryUnauthorizedEarlyHours.value = '0';
  c.calcSalary(false);
  assert.equal(money(c.salaryGross), 12629.86);
  assert.equal(money(c.salaryNet), 11164.77);

  // Recalculation is idempotent; it must not reduce the input a second time.
  c.salaryUnauthorizedEarlyHours.value = '2.35';
  for (let i = 0; i < 3; i++) c.calcSalary(false);
  assert.equal(money(c.salaryGross), 12465.24);
  assert.equal(c.salary150.value, '20.17');
  assert.equal(c.salaryUnauthorizedEarlyHours.value, '2.35');

  // Clamp the deduction to available 150% hours, including in the alternative.
  c.salary150.value = '1';
  c.calcSalary(false);
  const clampedGross = money(c.salaryGross);
  c.salaryUnauthorizedEarlyHours.value = '0';
  c.calcSalary(false);
  close(money(c.salaryGross) - clampedGross, 70.05);

  // January salary cycle crosses the year boundary correctly.
  const [a, b] = c.salaryBounds(2027, 1);
  assert.equal(c.isoLocal(a), '2026-12-23');
  assert.equal(c.isoLocal(b), '2027-01-22');
  c.m = 11;
  c.calcSalary(false);
  assert.equal(reconciliation().style.display, 'none');
  c.m = 10;

  // No official September-start cycle is embedded; open-cycle values use daily sums.
  await c.loadSalary();
  assert.equal(c.salary150.value, '5.80');
  assert.equal(c.salaryUnauthorizedEarlyHours.value, 2.35);
  assert.match(c.salaryBreakdown.innerHTML, /3\.45 ש׳/);
  // Synthetic closed report: summary and daily details are separate sources.
  c.known['2026-9'] = { sum: [0, 184.20, 44.83, 20.17] };
  await c.loadSalary();
  assert.equal(c.salary150.value, '20.17');
  assert.match(c.salaryDaysDetail.innerHTML, /4\.00/);
  assert.equal(money(c.salaryGross), 12465.24);
  assert.deepEqual(writes, [], 'read-only recalculation must not persist data');
  console.log('PASS: cycle boundaries, daily aggregation without early deduction, single/idempotent capped salary deduction, both supplied-summary scenarios, and open-cycle loading. Source payroll data remains unverified.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
