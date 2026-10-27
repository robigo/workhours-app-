'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = source.indexOf('function calcSalary(');
assert.notEqual(start, -1, 'missing calcSalary');
const open = source.indexOf('{', start);
let depth = 0, end = -1;
for (let i = open; i < source.length; i++) {
  if (source[i] === '{') depth++;
  if (source[i] === '}' && --depth === 0) { end = i + 1; break; }
}
assert.notEqual(end, -1, 'unterminated calcSalary');

const el = value => ({ value: String(value), textContent: '', innerHTML: '' });
const state = {};
const context = {
  hourlyRate: el(46.70), salaryRegular: el(184.20), salary125: el(44.83), salary150: el(20.17), salaryUnauthorizedEarlyHours: el(2.35),
  baseSalary: el(8500), standardHours: el(182), salaryExtras: el(100),
  salaryPaidExtraHours: el(0), salaryPensionDeduction: el(510),
  salaryGross: el(0), salaryBreakdown: el(0), salaryNet: el(0), netBreakdown: el(0), salaryNote: el(''),
  salaryRange: () => '23/09/2026 → 22/10/2026', y: { value: '2026' }, m: 10,
  currentUser: null, salaryStateKey: () => 'salary-state',
  localStorage: { setItem: (key, value) => { state[key] = value; } },
  dbSaveSalarySettings: () => {}
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
context.calcSalary(true);
assert.ok(context.netBreakdown.innerHTML.includes('גמל/פנסיה — סכום קבוע'));
assert.ok(context.netBreakdown.innerHTML.includes('₪510.00'), 'should subtract fixed ₪510');
assert.equal(JSON.parse(state['salary-state']).pensionDeduction, 510, 'fixed deduction should persist');
assert.equal(JSON.parse(state['salary-state']).unauthorizedEarlyHours, 2.35, 'unauthorized early hours should persist');
const gross = Number(context.salaryGross.textContent.replace(/[^0-9.]/g, ''));
assert.equal(gross, 12465.24, 'gross should include base and overtime, deducting 2.35 hours from 150%');
assert.ok(context.salaryBreakdown.innerHTML.includes('164.62'), 'breakdown should show the 150% early-hours deduction');
assert.ok(context.netBreakdown.innerHTML.includes('₪942.64'), 'mandatory deductions should use September rate');
assert.ok(context.netBreakdown.innerHTML.includes('מס הכנסה לפי ההנחה כרגע'));
assert.ok(context.netBreakdown.innerHTML.includes('₪0.00'), 'income tax should be zero under the current assumption');
assert.equal(Number(context.salaryNet.textContent.replace(/[^0-9.]/g, '')), 11012.60, 'net should reflect September mandatory deductions and fixed pension');

const firstNet = Number(context.salaryNet.textContent.replace(/[^0-9.]/g, ''));
context.salaryPensionDeduction.value = '610';
context.calcSalary(false);
const secondNet = Number(context.salaryNet.textContent.replace(/[^0-9.]/g, ''));
assert.equal(firstNet - secondNet, 100, 'raising fixed deduction by ₪100 should lower net by ₪100');
console.log('PASS: salary estimate uses fixed base, deducts unauthorized early hours from 150%, applies September mandatory-deduction rate, assumes zero income tax, and persists fixed gemel.');
