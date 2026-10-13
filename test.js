'use strict';

const assert = require('node:assert');
const {
  dateKey,
  addDaysKey,
  hasAnyCompleted,
  computeTodayCount,
  computeStreak,
  getCompletedHabits,
  shiftMonth,
  getCalendarCells
} = require('./app.js');

function test(name, fn) {
  fn();
  console.log('✓ ' + name);
}

test('dateKey 输出本地日期 YYYY-MM-DD', function () {
  assert.strictEqual(dateKey(new Date(2026, 8, 9)), '2026-09-09');
  assert.strictEqual(dateKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('addDaysKey 跨月、跨年和回退', function () {
  assert.strictEqual(addDaysKey('2026-09-09', 1), '2026-09-10');
  assert.strictEqual(addDaysKey('2026-09-09', -1), '2026-09-08');
  assert.strictEqual(addDaysKey('2026-09-30', 1), '2026-10-01');
  assert.strictEqual(addDaysKey('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(addDaysKey('2026-01-01', -1), '2025-12-31');
});

test('hasAnyCompleted 空记录与 false 不计入', function () {
  assert.strictEqual(hasAnyCompleted({}, '2026-09-09'), false);
  assert.strictEqual(hasAnyCompleted({ '2026-09-09': {} }, '2026-09-09'), false);
  assert.strictEqual(hasAnyCompleted({ '2026-09-09': { a: false } }, '2026-09-09'), false);
  assert.strictEqual(hasAnyCompleted({ '2026-09-09': { a: true } }, '2026-09-09'), true);
});

test('computeTodayCount 统计今日完成数', function () {
  const habits = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const records = { '2026-09-09': { a: true, b: true } };
  assert.deepStrictEqual(computeTodayCount(records, habits, '2026-09-09'), { done: 2, total: 3 });
  assert.deepStrictEqual(computeTodayCount({}, habits, '2026-09-09'), { done: 0, total: 3 });
  assert.deepStrictEqual(computeTodayCount(records, [], '2026-09-09'), { done: 0, total: 0 });
});

test('computeStreak 今天完成连续计数', function () {
  const records = {
    '2026-09-09': { a: true },
    '2026-09-08': { a: true },
    '2026-09-07': { a: true }
  };
  assert.strictEqual(computeStreak(records, '2026-09-09'), 3);
});

test('computeStreak 今天未完成但昨天完成仍计入', function () {
  const records = {
    '2026-09-08': { a: true },
    '2026-09-07': { a: true }
  };
  assert.strictEqual(computeStreak(records, '2026-09-09'), 2);
});

test('computeStreak 今天昨天都未完成返回 0', function () {
  assert.strictEqual(computeStreak({ '2026-09-06': { a: true } }, '2026-09-09'), 0);
  assert.strictEqual(computeStreak({}, '2026-09-09'), 0);
});

test('computeStreak 中间断档则重新计数', function () {
  const records = {
    '2026-09-09': { a: true },
    '2026-09-08': {},
    '2026-09-07': { a: true }
  };
  assert.strictEqual(computeStreak(records, '2026-09-09'), 1);
});

test('getCompletedHabits 返回当天完成的习惯', function () {
  const habits = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
  const records = { '2026-09-09': { a: true, c: true } };
  assert.deepStrictEqual(getCompletedHabits(records, habits, '2026-09-09'), [habits[0], habits[2]]);
  assert.deepStrictEqual(getCompletedHabits({}, habits, '2026-09-09'), []);
});

test('shiftMonth 跨年切换', function () {
  assert.deepStrictEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepStrictEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepStrictEqual(shiftMonth(2026, 10, 1), { year: 2026, month: 11 });
});

test('getCalendarCells 生成 42 格且当月天数正确', function () {
  const cells = getCalendarCells(2026, 10);
  assert.strictEqual(cells.length, 42);
  const inMonth = cells.filter(function (c) { return c.inMonth; });
  assert.strictEqual(inMonth.length, 31);
  assert.strictEqual(inMonth[0].day, 1);
  assert.strictEqual(inMonth[inMonth.length - 1].day, 31);
  const startWeekday = new Date(2026, 9, 1).getDay();
  assert.strictEqual(cells[startWeekday].key, '2026-10-01');
  assert.strictEqual(cells[startWeekday].inMonth, true);
});

console.log('\n全部测试通过 ✔');