/* Khung giờ đối chiếu Thông báo 1243/TB-ĐHSP ngày 04/08/2025. */
(function (root) {
  'use strict';
  const PERIODS = [
    '07:00 - 07:50', '07:50 - 08:40', '08:45 - 09:35',
    '09:40 - 10:30', '10:35 - 11:25', '11:25 - 12:15',
    '13:00 - 13:50', '13:50 - 14:40', '14:45 - 15:35',
    '15:40 - 16:30', '16:35 - 17:25', '17:25 - 18:15'
  ].map((time, index) => ({ period: index + 1, label: `Tiết ${index + 1}`, time }));
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const fold = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
  const dayLabel = day => day === 8 ? 'Chủ Nhật' : `Thứ ${day}`;

  function parseDay(value) {
    const text = fold(value);
    if (/^(cn|chu nhat|sunday)$/.test(text)) return 8;
    const match = text.match(/^(?:thu\s*|t\s*)?([2-8])$/);
    if (!match) throw new Error('Thứ phải từ 2 đến 7 hoặc CN (8).');
    return Number(match[1]);
  }

  function parsePeriods(value) {
    const original = fold(value);
    const explicit = /^tiet\s+\d{1,2}$/.test(original);
    const text = original.replace(/^tiet\s*/, '').replace(/[–—]/g, '-').replace(/\s*-\s*/g, '-');
    if (!text || text.length > 100 || !/^[\d\s,;\-]+$/.test(text)) throw new Error('Tiết học không hợp lệ.');
    const valid = n => Number.isInteger(n) && n >= 1 && n <= 12;
    let periods = [];
    if (explicit || /[\s,;\-]/.test(text)) {
      for (const token of text.split(/[\s,;]+/).filter(Boolean)) {
        if (/^\d{1,2}-\d{1,2}$/.test(token)) {
          const [start, end] = token.split('-').map(Number);
          if (!valid(start) || !valid(end) || end < start) throw new Error('Khoảng tiết phải tăng dần trong 1–12.');
          for (let n = start; n <= end; n++) periods.push(n);
        } else if (/^\d{1,2}$/.test(token) && valid(Number(token))) {
          periods.push(Number(token));
        } else throw new Error('Dùng tiết 1–12, ví dụ 7-8 hoặc 9, 10.');
      }
    } else {
      const choices = [];
      function split(offset, current) {
        if (offset === text.length) { choices.push(current); return; }
        for (let size = 1; size <= 2; size++) {
          const token = text.slice(offset, offset + size);
          if (token.length !== size || token[0] === '0') continue;
          const n = Number(token);
          if (valid(n) && (!current.length || n === current[current.length - 1] + 1)) {
            split(offset + size, [...current, n]);
          }
        }
      }
      split(0, []);
      if (choices.length > 1) throw new Error('“12” chưa rõ nghĩa: ghi “1-2” hoặc “Tiết 12”.');
      if (choices.length !== 1) throw new Error('Không đọc được chuỗi tiết. Dùng dấu phẩy hoặc khoảng, ví dụ 1-3.');
      periods = choices[0];
    }
    if (!periods.length) throw new Error('Thiếu tiết học.');
    return [...new Set(periods)].sort((a, b) => a - b);
  }

  function runs(periods) {
    const groups = [];
    for (const p of [...periods].sort((a, b) => a - b)) {
      const last = groups[groups.length - 1];
      // Tách ô ở giờ nghỉ trưa và ở những tiết không liên tiếp.
      if (last && p === last[last.length - 1] + 1 && p !== 7) last.push(p);
      else groups.push([p]);
    }
    return groups;
  }

  function formatPeriodTime(periods) {
    return runs(periods).map(group => `${PERIODS[group[0] - 1].time.split(' - ')[0]} - ${PERIODS[group[group.length - 1] - 1].time.split(' - ')[1]}`).join('; ');
  }

  function parseDocumentXml(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Nội dung Word bị lỗi. Hãy lưu lại dưới dạng .docx.');
    const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const body = doc.getElementsByTagNameNS(ns, 'body')[0];
    if (!body) throw new Error('Không tìm thấy nội dung tài liệu Word.');
    const children = (node, name) => Array.from(node.children).filter(child => child.namespaceURI === ns && child.localName === name);
    const textOf = node => clean(Array.from(node.getElementsByTagNameNS(ns, 'p')).map(p => Array.from(p.getElementsByTagNameNS(ns, 't')).map(t => t.textContent).join('')).join(' '));
    const paragraphText = node => clean(Array.from(node.getElementsByTagNameNS(ns, 't')).map(t => t.textContent).join(''));
    const courses = [];
    const issues = [];
    const blocked = new Set();
    let current = null;
    let tableNumber = 0;

    function visit(container) {
      for (const child of container.children) {
        if (child.namespaceURI !== ns) continue;
        if (child.localName === 'p') {
          const match = paragraphText(child).match(/^(\d{5,12})\s*[:：]\s*(.+)$/);
          if (match) {
            current = courses.find(c => c.code === match[1]);
            if (!current) {
              current = { code: match[1], name: match[2], classes: [] };
              courses.push(current);
            }
          }
        } else if (child.localName === 'tbl') {
          tableNumber++;
          let previousCells = [];
          children(child, 'tr').forEach((row, index) => {
            const cells = children(row, 'tc').map((cell, column) => {
              const merge = cell.getElementsByTagNameNS(ns, 'vMerge')[0];
              const continued = merge && merge.getAttributeNS(ns, 'val') !== 'restart';
              return continued ? previousCells[column] || '' : textOf(cell);
            });
            previousCells = cells;
            if (cells.every(c => !c)) return;
            // Tiêu đề cột không phải dữ liệu lớp.
            if (/^(ma (lop|nhom)|lop( hoc phan)?)$/.test(fold(cells[0])) && /giang vien|giao vien/.test(fold(cells[1]))) return;
            const location = `Bảng ${tableNumber}, dòng ${index + 1}`;
            const key = current ? `${current.code}/${cells[0]}` : '';
            try {
              if (!current) throw new Error('Bảng chưa có tiêu đề “mã môn: tên môn”.');
              if (cells.length !== 4) throw new Error('Cần đúng 4 cột: mã lớp, giảng viên, thứ, tiết.');
              if (!cells[0] || !cells[1]) throw new Error('Thiếu mã lớp hoặc giảng viên.');
              const session = { day: parseDay(cells[2]), periods: parsePeriods(cells[3]) };
              const existing = current.classes.find(c => c.classCode === cells[0]);
              if (existing) {
                if (existing.lecturer !== cells[1]) throw new Error('Cùng mã lớp nhưng khác giảng viên. Hãy kiểm tra lại.');
                if (!existing.sessions.some(s => s.day === session.day && String(s.periods) === String(session.periods))) existing.sessions.push(session);
              } else current.classes.push({ classCode: cells[0], lecturer: cells[1], sessions: [session] });
            } catch (error) {
              if (key) blocked.add(key);
              issues.push(`${location}${current ? ` (${current.name})` : ''}: ${error.message}`);
            }
          });
        } else if (child.localName === 'sdt' || child.localName === 'sdtContent') visit(child);
      }
    }
    visit(body);
    courses.forEach(c => {
      c.classes = c.classes.filter(cls => !blocked.has(`${c.code}/${cls.classCode}`));
      c.classes.forEach(cls => {
        const byDay = new Map();
        cls.sessions.forEach(session => {
          if (!byDay.has(session.day)) byDay.set(session.day, new Set());
          session.periods.forEach(p => byDay.get(session.day).add(p));
        });
        cls.sessions = [...byDay].sort(([a], [b]) => a - b).map(([day, periods]) => ({ day, periods: [...periods].sort((a, b) => a - b) }));
      });
    });
    if (!courses.length) throw new Error('Không tìm thấy môn học. Tiêu đề cần có dạng “32221036: Tên môn học”.');
    return { courses, issues, missingCourses: courses.filter(c => !c.classes.length) };
  }

  async function readDocx(file) {
    if (!/\.docx$/i.test(file.name)) throw new Error('Hãy chọn tệp Word .docx. Với .doc, hãy dùng Save As → .docx trong Word.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Tệp quá lớn. Hãy chọn tệp .docx dưới 10 MB.');
    if (!root.JSZip) throw new Error('Không tải được bộ đọc Word. Hãy tải lại trang.');
    let xml;
    try {
      const zip = await root.JSZip.loadAsync(await file.arrayBuffer());
      const entry = zip.file('word/document.xml');
      if (!entry) throw new Error();
      xml = await entry.async('string');
    } catch {
      throw new Error('Không mở được tệp Word. Tệp có thể bị hỏng, có mật khẩu hoặc không đúng định dạng .docx.');
    }
    return parseDocumentXml(xml);
  }

  const hasConflict = (a, b) => a.sessions.some(sa => b.sessions.some(sb => sa.day === sb.day && sa.periods.some(p => sb.periods.includes(p))));
  function solve(courses, limit = 5000) {
    const results = [];
    let truncated = false;
    let steps = 0;
    if (!courses.length) return { results, truncated };
    const ordered = courses.map(course => ({ ...course, classes: course.classes.filter(c => c.selected) })).sort((a, b) => a.classes.length - b.classes.length);
    const combo = [];
    function search(index) {
      if (results.length >= limit || ++steps > 250000) { truncated = true; return; }
      if (index === ordered.length) {
        results.push({ classes: [...combo].sort((a, b) => courses.findIndex(c => c.code === a.courseCode) - courses.findIndex(c => c.code === b.courseCode)), numDays: new Set(combo.flatMap(c => c.sessions.map(s => s.day))).size });
        return;
      }
      const course = ordered[index];
      for (const cls of course.classes) {
        if (truncated) break;
        if (!combo.some(c => hasConflict(c, cls))) {
          combo.push({ ...cls, courseCode: course.code, courseName: course.name, color: course.color });
          search(index + 1);
          combo.pop();
        }
      }
    }
    search(0);
    results.sort((a, b) => a.numDays - b.numDays);
    return { results, truncated };
  }

  const api = { PERIODS, dayLabel, parseDay, parsePeriods, formatPeriodTime, runs, parseDocumentXml, readDocx, hasConflict, solve };
  root.Timetable = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
