/* Tạo tệp Word thực (.docx) ngay trong trình duyệt bằng JSZip. */
(function (root) {
  'use strict';
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const COLORS = ['EFF6FF', 'ECFDF5', 'FFFBEB', 'FFF1F2', 'FAF5FF', 'F0FDFA'];
  const escape = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function textRun(text, options = {}) {
    const size = options.size || 18;
    return `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${options.bold ? '<w:b/>' : ''}<w:color w:val="${options.color || '000000'}"/><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r>`;
  }

  function paragraph(text, options = {}) {
    const parts = Array.isArray(text) ? text : [text];
    const content = parts.map(part => typeof part === 'object' ? textRun(part.text, {...options, ...part}) : textRun(part, options)).join('');
    return `<w:p><w:pPr>${options.style ? `<w:pStyle w:val="${options.style}"/>` : ''}${options.pageBreak ? '<w:pageBreakBefore/>' : ''}${options.keepNext ? '<w:keepNext/>' : ''}<w:jc w:val="${options.center ? 'center' : 'left'}"/><w:spacing w:before="0" w:after="${options.after ?? 40}" w:line="220" w:lineRule="auto"/></w:pPr>${content}</w:p>`;
  }

  function cell(content, width, options = {}) {
    return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${options.span ? `<w:gridSpan w:val="${options.span}"/>` : ''}${options.merge ? `<w:vMerge${options.merge === 'restart' ? ' w:val="restart"' : ''}/>` : ''}${options.fill ? `<w:shd w:fill="${options.fill}"/>` : ''}<w:vAlign w:val="${options.top ? 'top' : 'center'}"/></w:tcPr>${content || '<w:p/>'}</w:tc>`;
  }

  function row(cells, options = {}) {
    return `<w:tr><w:trPr><w:cantSplit/>${options.header ? '<w:tblHeader/>' : ''}${options.height ? `<w:trHeight w:val="${options.height}" w:hRule="atLeast"/>` : ''}</w:trPr>${cells.join('')}</w:tr>`;
  }

  function table(widths, rows) {
    const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(side => `<w:${side} w:val="single" w:sz="4" w:color="D9D9D9"/>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${borders}</w:tblBorders><w:tblCellMar><w:top w:w="90" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(width => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`;
  }

  function scheduleTable(solution) {
    const widths = [2050, ...Array(7).fill(1900)];
    const blocks = solution.classes.flatMap((cls, index) => cls.sessions.flatMap(session => root.Timetable.runs(session.periods).map(periods => ({ ...cls, day: session.day, periods, fill: COLORS[index % COLORS.length] }))));
    const rows = [row(['TIẾT / GIỜ', ...Array.from({length: 7}, (_, i) => root.Timetable.dayLabel(i + 2))].map((label, i) => cell(paragraph(label, {bold: true, center: true}), widths[i], {fill: i === 7 ? 'F7D3D3' : 'DCE6F1'})), {header: true})];
    for (const period of root.Timetable.PERIODS) {
      if (period.period === 7) rows.push(row([cell(paragraph('Nghỉ trưa (12:15 - 13:00)', {bold: true, center: true}), 15350, {span: 8, fill: 'DCE6F1'})]));
      const cells = [cell(paragraph(period.label, {bold: true, center: true}) + paragraph(period.time, {center: true, size: 17}), widths[0], {fill: 'F1F5F9'})];
      for (let day = 2; day <= 8; day++) {
        const block = blocks.find(b => b.day === day && b.periods.includes(period.period));
        if (!block) {
          cells.push(cell('', 1900, {fill: day === 8 ? 'FFF1F2' : 'FFFFFF'}));
          continue;
        }
        const start = block.periods[0] === period.period;
        const content = start ? paragraph(block.courseName, {bold: true}) + paragraph([{text: 'Lớp: '}, {text: block.classCode, color: 'C00000', bold: true}], {size: 17}) + paragraph(`GV: ${block.lecturer}`, {size: 17}) : '';
        cells.push(cell(content, 1900, {fill: block.fill, top: true, merge: block.periods.length > 1 ? (start ? 'restart' : 'continue') : null}));
      }
      rows.push(row(cells, {height: 500}));
    }
    return table(widths, rows);
  }

  function selectedGroups(solution) {
    const widths = [3000, 6350, 2200, 3800];
    return solution.classes.map(cls => {
      const header = row(['Mã lớp', 'Giảng viên', 'Thứ', 'Tiết'].map((text, i) => cell(paragraph(text, {bold: true, size: 22, center: i > 1}), widths[i], {fill: 'EDF2F7'})), {header: true});
      const rows = cls.sessions.map(session => row([cls.classCode, cls.lecturer, session.day === 8 ? 'CN' : session.day, session.periods.join(', ')].map((text, i) => cell(paragraph(text, {size: 22, center: i > 1, color: i === 0 ? 'C00000' : '000000', bold: i === 0}), widths[i]))));
      return paragraph([{text: cls.courseCode, color: 'C00000'}, {text: `: ${cls.courseName}`}], {bold: true, size: 22, after: 100, keepNext: true}) + table(widths, [header, ...rows]) + paragraph('', {after: 100});
    }).join('');
  }

  async function createDocx(solution, options = {}) {
    if (!solution || !solution.classes.length) throw new Error('Chưa có thời khóa biểu để xuất.');
    if (!root.JSZip || !root.Timetable) throw new Error('Không tải được bộ xuất Word. Hãy tải lại trang.');
    const number = options.number || 1;
    const warning = options.omittedCourses?.length ? paragraph(`Chưa bao gồm các môn thiếu lịch: ${options.omittedCourses.join('; ')}.`, {size: 18, after: 120}) : '';
    const skipped = options.issueCount ? paragraph(`Đã bỏ qua các nhóm có dữ liệu lỗi (${options.issueCount} dòng).`, {size: 18, after: 120}) : '';
    const body = paragraph('TKB4U', {style: 'Title', size: 30, bold: true, center: true, after: 100})
      + paragraph(`Phương án ${number} · ${solution.classes.length} môn · ${solution.numDays} ngày học mỗi tuần`, {center: true, size: 20, after: 140})
      + warning + skipped
      + paragraph('DANH SÁCH NHÓM LỚP TRONG THỜI KHÓA BIỂU', {bold: true, size: 26, after: 120, keepNext: true})
      + selectedGroups(solution)
      + paragraph('BẢNG THỜI KHÓA BIỂU', {bold: true, size: 26, after: 120, keepNext: true})
      + scheduleTable(solution);
    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${body}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="600" w:right="720" w:bottom="600" w:left="720" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const zip = new root.JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', document);
    zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="000000"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="000000"/><w:sz w:val="30"/></w:rPr></w:style></w:styles>`);
    return zip.generateAsync({type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE'});
  }

  root.TimetableExport = {createDocx};
})(typeof window !== 'undefined' ? window : globalThis);
