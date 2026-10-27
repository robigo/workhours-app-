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
  hourlyRate: el(46.70), salaryRegular: el(180.60), salary125: el(44.83), salary150: el(20.17),
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

const firstNet = Number(context.salaryNet.textContent.replace(/[^0-9.]/g, ''));
context.salaryPensionDeduction.value = '610';
context.calcSalary(false);
const secondNet = Number(context.salaryNet.textContent.replace(/[^0-9.]/g, ''));
assert.equal(firstNet - secondNet, 100, 'raising fixed deduction by ₪100 should lower net by ₪100');
console.log('PASS: salary tab applies and persists a fixed pension/gemel deduction; net changes shekel for shekel.');
