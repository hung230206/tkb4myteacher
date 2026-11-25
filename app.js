const { createApp, ref, computed } = Vue;
const { PERIODS, dayLabel, formatPeriodTime, runs } = Timetable;
const MORNING_PERIODS = PERIODS.slice(0, 6);
const AFTERNOON_PERIODS = PERIODS.slice(6);
const DAYS_OF_WEEK = Array.from({ length: 7 }, (_, i) => ({ key: i + 2, label: dayLabel(i + 2), isSun: i === 6 }));
const COLOR_PALETTES = [
  { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-900', badge: 'bg-blue-600' },
  { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-900', badge: 'bg-emerald-600' },
  { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-900', badge: 'bg-amber-600' },
  { bg: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-900', badge: 'bg-rose-600' },
  { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-900', badge: 'bg-purple-600' },
  { bg: 'bg-teal-50', border: 'border-teal-400', text: 'text-teal-900', badge: 'bg-teal-600' }
];

createApp({
  setup() {
    const courses = ref([]);
    const allSolutions = ref([]);
    const currentSolutionIndex = ref(0);
    const excludedDays = ref([]);
    const avoidFirstPeriod = ref(false);
    const avoidLastPeriod = ref(false);
    const sortOrder = ref('days');
    const isReading = ref(false);
    const isExporting = ref(false);
    const exportError = ref('');
    const importError = ref('');
    const sourceName = ref('');
    const omittedCourses = ref([]);
    const importedIssues = ref([]);
    const importedIssueCount = computed(() => importedIssues.value.length);
    const solutionsTruncated = ref(false);
    const fileInput = ref(null);

    const totalClasses = computed(() => courses.value.reduce((sum, c) => sum + c.classes.length, 0));
    const currentSolution = computed(() => allSolutions.value[currentSolutionIndex.value] || null);
    const filteredCourses = computed(() => courses.value.map(course => ({
      ...course,
      classes: course.classes.map(cls => ({...cls, selected: isClassAllowed(course, cls)}))
    })));
    const totalAllowedClasses = computed(() => filteredCourses.value.reduce((sum, c) => sum + c.classes.filter(cls => cls.selected).length, 0));
    const activeFilterChips = computed(() => {
      const chips = excludedDays.value.map(day => ({key: `day-${day}`, kind: 'day', day, label: `Nghỉ ${dayLabel(day)}`}));
      if (avoidFirstPeriod.value) chips.push({key: 'first', kind: 'first', label: 'Tránh tiết 1'});
      if (avoidLastPeriod.value) chips.push({key: 'last', kind: 'last', label: 'Tránh tiết 12'});
      courses.value.forEach(course => {
        const teacherCount = getLecturersForCourse(course).length;
        if (course.selectedLecturers.length < teacherCount) {
          chips.push({key: `teachers-${course.code}`, kind: 'teachers', courseCode: course.code,
            label: course.selectedLecturers.length ? `${course.name}: ${course.selectedLecturers.join(', ')}` : `${course.name}: chưa chọn giảng viên`});
        }
        const excluded = course.classes.filter(cls => !cls.selected).length;
        if (excluded) chips.push({key: `groups-${course.code}`, kind: 'groups', courseCode: course.code, label: `${course.name}: bỏ ${excluded} nhóm`});
      });
      return chips;
    });

    async function uploadWord(event) {
      const file = event.target.files[0];
      if (!file) return;
      isReading.value = true;
      importError.value = '';
      try {
        const parsed = await Timetable.readDocx(file);
        importCourses(parsed, file.name);
      } catch (error) {
        importError.value = error.message;
      } finally {
        isReading.value = false;
        event.target.value = '';
      }
    }

    function solveSchedule() {
      const { results, truncated } = Timetable.solve(filteredCourses.value);
      allSolutions.value = results.map(solution => ({...solution, numGaps: countGaps(solution)}));
      solutionsTruncated.value = truncated;
      exportError.value = '';
      sortSolutions();
    }

    function countGaps(solution) {
      let gaps = 0;
      const sessions = solution.classes.flatMap(cls => cls.sessions);
      DAYS_OF_WEEK.forEach(({key: day}) => {
        [false, true].forEach(afternoon => {
          const periods = [...new Set(sessions.filter(s => s.day === day).flatMap(s => s.periods).filter(p => (p >= 7) === afternoon))].sort((a, b) => a - b);
          if (periods.length) gaps += periods[periods.length - 1] - periods[0] + 1 - periods.length;
        });
      });
      return gaps;
    }

    function sortSolutions() {
      allSolutions.value.sort((a, b) => sortOrder.value === 'gaps'
        ? a.numGaps - b.numGaps || a.numDays - b.numDays
        : a.numDays - b.numDays || a.numGaps - b.numGaps);
      currentSolutionIndex.value = 0;
    }

    function importCourses(parsed, filename) {
      const validCourses = parsed.courses.filter(course => course.classes.length);
      if (!validCourses.length) throw new Error('Tệp chưa có nhóm lớp hợp lệ. Hãy bổ sung hoặc sửa lịch trong Word rồi chọn lại tệp.');
      courses.value = validCourses.map((course, index) => ({
        ...course,
        selectedLecturers: [...new Set(course.classes.map(cls => cls.lecturer))],
        color: COLOR_PALETTES[index % COLOR_PALETTES.length],
        classes: course.classes.map(cls => ({
          ...cls, selected: true,
          sessions: cls.sessions.map(session => ({ ...session, timeLabel: formatPeriodTime(session.periods) }))
        }))
      }));
      sourceName.value = filename;
      omittedCourses.value = parsed.missingCourses.map(c => c.name);
      importedIssues.value = parsed.issues;
      excludedDays.value = [];
      avoidFirstPeriod.value = false;
      avoidLastPeriod.value = false;
      solveSchedule();
    }

    const getLecturersForCourse = course => [...new Set(course.classes.map(c => c.lecturer))].map(name => ({ name, count: course.classes.filter(c => c.lecturer === name).length }));
    function isClassAllowed(course, cls) {
      return cls.selected && course.selectedLecturers.includes(cls.lecturer) && cls.sessions.every(session =>
        !excludedDays.value.includes(session.day)
        && (!avoidFirstPeriod.value || !session.periods.includes(1))
        && (!avoidLastPeriod.value || !session.periods.includes(12)));
    }
    const getCourseAllowedCount = course => course.classes.filter(cls => isClassAllowed(course, cls)).length;
    function toggleLecturer(course, lecturer) {
      course.selectedLecturers = course.selectedLecturers.includes(lecturer)
        ? course.selectedLecturers.filter(name => name !== lecturer)
        : [...course.selectedLecturers, lecturer];
      solveSchedule();
    }
    function toggleDay(day) {
      excludedDays.value = excludedDays.value.includes(day)
        ? excludedDays.value.filter(value => value !== day)
        : [...excludedDays.value, day].sort((a, b) => a - b);
      solveSchedule();
    }
    function removeFilter(chip) {
      if (chip.kind === 'day') excludedDays.value = excludedDays.value.filter(day => day !== chip.day);
      if (chip.kind === 'first') avoidFirstPeriod.value = false;
      if (chip.kind === 'last') avoidLastPeriod.value = false;
      const course = courses.value.find(c => c.code === chip.courseCode);
      if (course && chip.kind === 'teachers') course.selectedLecturers = getLecturersForCourse(course).map(lecturer => lecturer.name);
      if (course && chip.kind === 'groups') course.classes.forEach(cls => { cls.selected = true; });
      solveSchedule();
    }
    function toggleClass(cls) { cls.selected = !cls.selected; solveSchedule(); }
    function resetCourse(course) {
      course.selectedLecturers = getLecturersForCourse(course).map(lecturer => lecturer.name);
      course.classes.forEach(cls => { cls.selected = true; });
      solveSchedule();
    }
    function resetAllFilters() {
      excludedDays.value = [];
      avoidFirstPeriod.value = false;
      avoidLastPeriod.value = false;
      courses.value.forEach(course => {
        course.selectedLecturers = getLecturersForCourse(course).map(lecturer => lecturer.name);
        course.classes.forEach(cls => { cls.selected = true; });
      });
      solveSchedule();
    }

    function buildSessionGrid(periodList) {
      if (!currentSolution.value) return [];
      const blocks = currentSolution.value.classes.flatMap(cls => cls.sessions.flatMap(session => runs(session.periods).map(periods => ({ ...cls, day: session.day, periods }))));
      return periodList.map(periodInfo => ({
        periodInfo,
        cells: DAYS_OF_WEEK.map(day => {
          const block = blocks.find(c => c.day === day.key && c.periods.includes(periodInfo.period));
          const base = { day: day.key, isSun: day.isSun };
          if (!block) return { ...base, type: 'empty' };
          return block.periods[0] === periodInfo.period
            ? { ...base, type: 'class', rowspan: block.periods.length, data: block }
            : { ...base, type: 'occupied' };
        })
      }));
    }
    const morningGrid = computed(() => buildSessionGrid(MORNING_PERIODS));
    const afternoonGrid = computed(() => buildSessionGrid(AFTERNOON_PERIODS));
    function nextSolution() { if (currentSolutionIndex.value < allSolutions.value.length - 1) currentSolutionIndex.value++; }
    function prevSolution() { if (currentSolutionIndex.value > 0) currentSolutionIndex.value--; }

    async function exportWord() {
      if (!currentSolution.value || isExporting.value) return;
      const number = currentSolutionIndex.value + 1;
      isExporting.value = true;
      exportError.value = '';
      try {
        const blob = await TimetableExport.createDocx(currentSolution.value, {
          number, omittedCourses: omittedCourses.value, issueCount: importedIssueCount.value
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `TKB-phuong-an-${number}.docx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        exportError.value = 'Không xuất được tệp Word. ' + error.message;
      } finally {
        isExporting.value = false;
      }
    }

    return {
      DAYS_OF_WEEK, courses, allSolutions, currentSolutionIndex,
      excludedDays, avoidFirstPeriod, avoidLastPeriod, sortOrder,
      activeFilterChips, totalAllowedClasses,
      isReading, isExporting, exportError, importError, sourceName, omittedCourses,
      importedIssues, importedIssueCount, solutionsTruncated, fileInput, totalClasses,
      currentSolution, morningGrid, afternoonGrid, dayLabel, formatPeriodTime,
      uploadWord, getLecturersForCourse, getCourseAllowedCount, isClassAllowed,
      toggleLecturer, toggleDay, toggleClass, removeFilter, resetCourse, solveSchedule, sortSolutions,
      resetAllFilters, nextSolution, prevSolution, exportWord
    };
  }
}).mount('#app');

