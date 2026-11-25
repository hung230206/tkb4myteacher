const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../timetable.js');

test('đọc đúng tiết ghép trong mẫu Word và tiết có dấu phân cách', () => {
  for (const [text, expected] of Object.entries({
    '78': [7, 8], '910': [9, 10], '456': [4, 5, 6], '8910': [8, 9, 10],
    '123': [1, 2, 3], '1011': [10, 11], '56': [5, 6], '1112': [11, 12],
    '7-8': [7, 8], '1-3': [1, 2, 3], '7, 8': [7, 8], 'Tiết 12': [12],
    '1-3, 5': [1, 2, 3, 5]
  })) assert.deepEqual(T.parsePeriods(text), expected, text);
});

test('không đoán tiết mơ hồ hoặc chấp nhận dữ liệu ngoài khung', () => {
  for (const text of ['', '12', '0', '13', '10-9', '1-13', 'abc', '7/8', '001']) {
    assert.throws(() => T.parsePeriods(text), undefined, text);
  }
  assert.equal(T.parseDay('Thứ 5'), 5);
  assert.equal(T.parseDay('CN'), 8);
  assert.throws(() => T.parseDay('Thứ 9'));
});

test('đổi giờ theo PDF, tách khoảng trống và giờ nghỉ trưa', () => {
  assert.equal(T.PERIODS.length, 12);
  assert.equal(T.formatPeriodTime([7, 8]), '13:00 - 14:40');
  assert.equal(T.formatPeriodTime([8, 9, 10]), '13:50 - 16:30');
  assert.equal(T.formatPeriodTime([10, 11]), '15:40 - 17:25');
  assert.equal(T.formatPeriodTime([1, 3]), '07:00 - 07:50; 08:45 - 09:35');
  assert.deepEqual(T.runs([5, 6, 7, 8]), [[5, 6], [7, 8]]);
});

const cls = (code, sessions, selected = true) => ({ classCode: code, lecturer: 'GV', sessions, selected });
test('kiểm tra mọi buổi của một lớp và không xếp môn bị bỏ hết nhóm', () => {
  const courses = [
    { code: 'A', classes: [cls('A1', [{day: 2, periods: [1, 2]}, {day: 4, periods: [7, 8]}])] },
    { code: 'B', classes: [cls('B1', [{day: 4, periods: [8, 9]}]), cls('B2', [{day: 2, periods: [4, 5]}])] }
  ];
  const solved = T.solve(courses);
  assert.equal(solved.results.length, 1);
  assert.equal(solved.results[0].classes[1].classCode, 'B2');
  assert.equal(solved.results[0].numDays, 2);
  courses[1].classes.forEach(c => { c.selected = false; });
  assert.equal(T.solve(courses).results.length, 0);
  assert.equal(T.solve([]).results.length, 0);
});

test('ưu tiên ít ngày và công bố khi chưa tìm hết phương án', () => {
  const courses = [
    { code: 'A', classes: [cls('A1', [{day: 2, periods: [1]}])] },
    { code: 'B', classes: [cls('B1', [{day: 3, periods: [2]}]), cls('B2', [{day: 2, periods: [2]}])] }
  ];
  assert.deepEqual(T.solve(courses).results.map(s => s.numDays), [1, 2]);
  const capped = T.solve(courses, 1);
  assert.equal(capped.results.length, 1);
  assert.equal(capped.truncated, true);
});
