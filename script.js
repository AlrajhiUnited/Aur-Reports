// Global variables
let allReports = [];
let filteredReportsBase = []; // After search and department filter, includes ALL statuses
let reportsForChartsAndCalendar = []; // Derived from filteredReportsBase, excluding/including past_due based on activeKpiFilterType
let reportsForDisplayInTable = []; // Derived from reportsForChartsAndCalendar or a more specific KPI subset

let currentPage = 1;
const reportsPerPage = 15;
const systemBaseDate = new Date('2025-05-27'); // System's "today"
const recipientEmail = 'shamdan@aur.com.sa';

// Chart instances
let departmentChartInstance = null;
let frequencyChartInstance = null;
let calendarInstance = null;
let timelineInstance = null; // For Vis.js Timeline
let timelineReferenceDate = new Date(systemBaseDate); // For "Time Travel" feature, defaults to systemBaseDate

// State for KPI filter
let activeKpiFilterType = null;
let activeKpiFilterName = '';

// DOM Elements
const loadingMessage = document.getElementById('loading-message');
const reportsTableBody = document.getElementById('reports-table-body');
const paginationControls = document.getElementById('pagination-controls');
const searchInput = document.getElementById('search-input');
const departmentFilter = document.getElementById('department-filter');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const resetDateFilterButton = document.getElementById('reset-date-filter');
const notificationDot = document.getElementById('notification-dot');
const kpiFilterIndicator = document.getElementById('kpi-filter-indicator');
const clearKpiFilterButton = document.getElementById('clear-kpi-filter');

// KPI Card Elements & Values
const kpiTotalReportsValue = document.getElementById('kpi-total-reports-value');
const kpiPeriodReportsValue = document.getElementById('kpi-period-reports-value');
const kpiDueTodayValue = document.getElementById('kpi-due-today-value');
const kpiDueSoonValue = document.getElementById('kpi-due-soon-value');
const kpiPastDueValue = document.getElementById('kpi-past-due-value');

const kpiCards = {
    total_reports: document.getElementById('kpi-total-reports-card'),
    period_reports: document.getElementById('kpi-period-reports-card'),
    due_today: document.getElementById('kpi-due-today-card'),
    due_soon: document.getElementById('kpi-due-soon-card'),
    past_due: document.getElementById('kpi-past-due-card')
};

// Modal Elements
const eventModal = document.getElementById('event-modal');
const modalCloseButton = eventModal.querySelector('.close-button');
const modalTitle = document.getElementById('modal-title');
const modalDepartment = document.getElementById('modal-department');
const modalFrequency = document.getElementById('modal-frequency');
const modalDueDate = document.getElementById('modal-due-date');
const modalStatus = document.getElementById('modal-status');
const modalEmailButton = document.getElementById('modal-email-button');
let currentModalReport = null;

// Timeline DOM Elements
const timelineContainer = document.getElementById('visualization-timeline');
const timelineLoadingMessage = document.getElementById('timeline-loading-message');
const timelineZoomInButton = document.getElementById('timeline-zoom-in');
const timelineZoomOutButton = document.getElementById('timeline-zoom-out');
const timelinePrevButton = document.getElementById('timeline-prev');
const timelineNextButton = document.getElementById('timeline-next');
const timelineTodayButton = document.getElementById('timeline-today');
const timeTravelDatePicker = document.getElementById('time-travel-date-picker');
const timeTravelDisplay = document.getElementById('time-travel-display');


// --- Utility Functions ---
function getToday() {
    return new Date(systemBaseDate.getFullYear(), systemBaseDate.getMonth(), systemBaseDate.getDate());
}

function diffInDays(date1Str, date2) {
    const d1 = new Date(date1Str);
    const d1StartOfDay = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
    return Math.round((d1StartOfDay - date2) / (1000 * 60 * 60 * 24));
}

function getReportStatusWithReference(dueDateString, referenceDate) {
    const refDateStartOfDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    const diff = diffInDays(dueDateString, refDateStartOfDay);

    // The timelineClass will primarily be used for border color now, as background is unified gold
    if (diff < 0) return { text: 'منتهي', class: 'status-past-due', timelineClass: 'timeline-item-past-due', isPastDue: true };
    if (diff === 0) return { text: 'مستحق اليوم', class: 'status-due-today', timelineClass: 'timeline-item-due-today', isPastDue: false };
    if (diff > 0 && diff <= 2) return { text: 'قادم قريباً', class: 'status-due-soon', timelineClass: 'timeline-item-due-soon', isPastDue: false };
    return { text: 'قادم', class: 'status-upcoming', timelineClass: 'timeline-item-upcoming', isPastDue: false };
}

/**
 * Generates iCalendar (.ics) file content for a report.
 * @param {object} report - The report object.
 * @returns {string} The iCalendar content.
 */
function generateICSContent(report) {
    const formatDateForICS = (dateString) => {
        const date = new Date(dateString);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}${month}${day}`; // Format for all-day event
    };

    const now = new Date();
    const dtstamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}Z`;
    const uid = `report-${report.id}-${Date.now()}@aur.com.sa`; // Unique ID

    // For all-day events, DTSTART should be just the date.
    // DTEND is typically the next day for an all-day event if specified.
    // Or, simply use DTSTART with VALUE=DATE and no DTEND for some clients.
    const dtstart = formatDateForICS(report.dueDate);

    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//AUR//Report Dashboard//EN',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${dtstart}`, // Specifies an all-day event starting on this date
        // For an all-day event, DTEND is often the day after DTSTART, or omitted if using VALUE=DATE for DTSTART
        // `DTEND;VALUE=DATE:${formatDateForICS(new Date(new Date(report.dueDate).getTime() + 24 * 60 * 60 * 1000))}`,
        `SUMMARY:تذكير بتقرير: ${report.title}`,
        `DESCRIPTION:الجهة: ${report.department}\\nفترة التكرار: ${report.frequency}\\nتاريخ الاستحقاق: ${report.dueDate}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE', // Shows as busy time
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:تذكير بالتقرير',
        'TRIGGER:-PT15M', // Reminder 15 minutes before (for timed events; for all-day, it's usually at a set time)
        // For all-day events, a common reminder is on the day of the event at a specific time, e.g., 9 AM.
        // Or a day before. Example for 9 AM on the day:
        // 'TRIGGER;VALUE=DATE-TIME:' + dtstart + 'T090000'
        // For simplicity, a basic reminder is set. Outlook handles all-day event reminders well.
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    return icsContent;
}

/**
 * Triggers download of an .ics file.
 * @param {string} icsContent - The content of the .ics file.
 * @param {string} reportTitle - The title of the report for the filename.
 */
function downloadICSFile(icsContent, reportTitle) {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const filename = `تذكير-${reportTitle.replace(/[\s\/]+/g, '_')}.ics`; // Sanitize filename
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}


// --- Data Fetching and Processing ---
async function fetchData() {
    console.log('Fetching data...');
    if (loadingMessage) loadingMessage.style.display = 'block';
    if (reportsTableBody) reportsTableBody.innerHTML = '';

    try {
        const response = await fetch('./data.json');
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText} (URL: ${response.url})`);
        }
        const data = await response.json();
        console.log('Data fetched successfully:', data.length, 'reports');

        allReports = data.map(item => ({
            id: item[0],
            department: item[1],
            title: item[2],
            frequency: item[3],
            dueDate: item[4],
        }));

        if (timeTravelDatePicker) {
            timeTravelDatePicker.value = timelineReferenceDate.toISOString().split('T')[0];
            updateTimeTravelDisplay();
        }

        populateDepartmentFilter();
        applyAllFiltersAndRender();

    } catch (error) {
        console.error('Error fetching or parsing data:', error);
        if (loadingMessage) loadingMessage.textContent = `حدث خطأ أثناء تحميل البيانات: ${error.message}. يرجى التأكد من وجود ملف data.json في المسار الصحيح.`;
    } finally {
        if (loadingMessage) loadingMessage.style.display = 'none';
    }
}

// --- UI Updates ---
function populateDepartmentFilter() {
    if (!departmentFilter) return;
    const departments = [...new Set(allReports.map(report => report.department))].sort((a, b) => a.localeCompare(b, 'ar'));
    departmentFilter.innerHTML = '<option value="">كل الجهات</option>';
    departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        departmentFilter.appendChild(option);
    });
}

function populateTable() {
    if (!reportsTableBody) return;
    reportsTableBody.innerHTML = '';

    const startIndex = (currentPage - 1) * reportsPerPage;
    const endIndex = startIndex + reportsPerPage;
    const paginatedReports = reportsForDisplayInTable.slice(startIndex, endIndex);

    if (paginatedReports.length === 0) {
        const row = reportsTableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 7; // Updated colspan
        cell.textContent = activeKpiFilterType === 'past_due' ? `لا توجد تقارير منتهية تطابق البحث الحالي.` :
                           activeKpiFilterType ? `لا توجد تقارير تطابق فلتر (${activeKpiFilterName}) والبحث الحالي (مع استبعاد المنتهية).` :
                           'لا توجد تقارير (غير منتهية) تطابق معايير البحث أو التصفية الحالية.';
        cell.style.textAlign = 'center';
        cell.style.padding = '20px';
    } else {
        paginatedReports.forEach(report => {
            const row = reportsTableBody.insertRow();
            const statusInfo = getReportStatusWithReference(report.dueDate, getToday());

            row.insertCell().textContent = report.id;
            row.insertCell().textContent = report.department;
            row.insertCell().textContent = report.title;
            row.insertCell().textContent = report.frequency;
            row.insertCell().textContent = report.dueDate;

            const statusCell = row.insertCell();
            const statusTag = document.createElement('span');
            statusTag.className = `status-tag ${statusInfo.class}`;
            statusTag.textContent = statusInfo.text;
            statusCell.appendChild(statusTag);

            const actionsCell = row.insertCell();
            // Email button
            const emailButton = document.createElement('button');
            emailButton.className = 'action-button';
            emailButton.innerHTML = '<i class="fas fa-envelope"></i>';
            emailButton.title = "إرسال بريد إلكتروني";
            emailButton.setAttribute('aria-label', `إرسال بريد بخصوص ${report.title}`);
            emailButton.onclick = () => {
                const subject = `بخصوص تقرير: ${report.title}`;
                const body = `السلام عليكم،\n\nيرجى الاطلاع على تقرير "${report.title}".\n\nمع وافر التحية والتقدير.`;
                window.location.href = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            };
            actionsCell.appendChild(emailButton);

            // Add to Calendar button
            const calendarButton = document.createElement('button');
            calendarButton.className = 'action-button';
            calendarButton.innerHTML = '<i class="far fa-calendar-plus"></i>';
            calendarButton.title = "إضافة تنبيه للتقويم";
            calendarButton.setAttribute('aria-label', `إضافة تنبيه لتقرير ${report.title} إلى التقويم`);
            calendarButton.onclick = () => {
                const icsContent = generateICSContent(report);
                downloadICSFile(icsContent, report.title);
            };
            actionsCell.appendChild(calendarButton);
        });
    }
    displayPagination();
}

function displayPagination() {
    if (!paginationControls) return;
    paginationControls.innerHTML = '';
    const totalPages = Math.ceil(reportsForDisplayInTable.length / reportsPerPage);

    if (totalPages <= 1) return;

    const createButton = (text, pageNum, isDisabled = false, isActive = false) => {
        const button = document.createElement('button');
        button.innerHTML = text;
        button.disabled = isDisabled;
        if (isActive) button.classList.add('active');
        button.onclick = () => {
            currentPage = pageNum;
            populateTable();
        };
        return button;
    };

    paginationControls.appendChild(createButton('&laquo; السابق', currentPage - 1, currentPage === 1));

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            paginationControls.appendChild(createButton(i, i, false, i === currentPage));
        } else if ((i === currentPage - 2 && currentPage > 3) || (i === currentPage + 2 && currentPage < totalPages - 2)) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.style.margin = "0 5px";
            paginationControls.appendChild(ellipsis);
        }
    }
    paginationControls.appendChild(createButton('التالي &raquo;', currentPage + 1, currentPage === totalPages));
}

function updateKPIs() {
    const today = getToday();

    const nonPastDueReportsForKpi = filteredReportsBase.filter(r => !getReportStatusWithReference(r.dueDate, today).isPastDue);
    const pastDueReportsForKpi = filteredReportsBase.filter(r => getReportStatusWithReference(r.dueDate, today).isPastDue);

    kpiTotalReportsValue.textContent = nonPastDueReportsForKpi.length;

    const startDateValue = startDateInput.value ? new Date(startDateInput.value) : null;
    const endDateValue = endDateInput.value ? new Date(endDateInput.value) : null;
    if (endDateValue) endDateValue.setHours(23, 59, 59, 999);

    if (startDateValue && endDateValue) {
        const reportsInPeriodForKpi = nonPastDueReportsForKpi.filter(report => {
            const dueDate = new Date(report.dueDate);
            return dueDate >= startDateValue && dueDate <= endDateValue;
        });
        kpiPeriodReportsValue.textContent = reportsInPeriodForKpi.length;
    } else {
        kpiPeriodReportsValue.textContent = '-';
    }

    kpiDueTodayValue.textContent = nonPastDueReportsForKpi.filter(r => diffInDays(r.dueDate, today) === 0).length;
    kpiDueSoonValue.textContent = nonPastDueReportsForKpi.filter(r => {
        const diff = diffInDays(r.dueDate, today);
        return diff >= 0 && diff <= 2;
    }).length;
    kpiPastDueValue.textContent = pastDueReportsForKpi.length;

    const upcomingOrDueTodayForNotification = nonPastDueReportsForKpi.filter(r => {
        const diff = diffInDays(r.dueDate, today);
        return diff >= 0 && diff <= 2;
    }).length;

    if (notificationDot) {
        notificationDot.style.display = upcomingOrDueTodayForNotification > 0 ? 'block' : 'none';
    }

    document.querySelectorAll('.kpi-card').forEach(card => card.classList.remove('kpi-active-filter'));
    if (activeKpiFilterType && kpiCards[activeKpiFilterType]) {
        kpiCards[activeKpiFilterType].classList.add('kpi-active-filter');
    }

    if (kpiFilterIndicator) {
        kpiFilterIndicator.textContent = '';
        kpiFilterIndicator.style.display = 'none';
    }
    if (clearKpiFilterButton) {
        clearKpiFilterButton.style.display = activeKpiFilterType ? 'block' : 'none';
    }
}


function applyAllFiltersAndRender() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedDepartment = departmentFilter.value;
    const today = getToday();

    filteredReportsBase = allReports.filter(report => {
        const matchesSearch = searchTerm === '' ||
            report.title.toLowerCase().includes(searchTerm) ||
            report.department.toLowerCase().includes(searchTerm);
        const matchesDepartment = selectedDepartment === '' || report.department === selectedDepartment;
        return matchesSearch && matchesDepartment;
    });

    if (activeKpiFilterType === 'past_due') {
        reportsForChartsAndCalendar = filteredReportsBase.filter(r => getReportStatusWithReference(r.dueDate, today).isPastDue);
    } else {
        reportsForChartsAndCalendar = filteredReportsBase.filter(r => !getReportStatusWithReference(r.dueDate, today).isPastDue);
    }

    if (activeKpiFilterType) {
        switch (activeKpiFilterType) {
            case 'total_reports':
                reportsForDisplayInTable = reportsForChartsAndCalendar;
                break;
            case 'period_reports':
                const startDateValue = startDateInput.value ? new Date(startDateInput.value) : null;
                const endDateValue = endDateInput.value ? new Date(endDateInput.value) : null;
                if (endDateValue) endDateValue.setHours(23, 59, 59, 999);

                if (startDateValue && endDateValue) {
                    reportsForDisplayInTable = reportsForChartsAndCalendar.filter(report => {
                        const dueDate = new Date(report.dueDate);
                        return dueDate >= startDateValue && dueDate <= endDateValue;
                    });
                } else {
                    reportsForDisplayInTable = reportsForChartsAndCalendar;
                }
                break;
            case 'due_today':
                reportsForDisplayInTable = reportsForChartsAndCalendar.filter(r => diffInDays(r.dueDate, today) === 0);
                break;
            case 'due_soon':
                reportsForDisplayInTable = reportsForChartsAndCalendar.filter(r => {
                    const diff = diffInDays(r.dueDate, today);
                    return diff >= 0 && diff <= 2;
                });
                break;
            case 'past_due':
                reportsForDisplayInTable = reportsForChartsAndCalendar;
                break;
            default:
                reportsForDisplayInTable = reportsForChartsAndCalendar;
                break;
        }
    } else {
        const startDateValue = startDateInput.value ? new Date(startDateInput.value) : null;
        const endDateValue = endDateInput.value ? new Date(endDateInput.value) : null;
        if (endDateValue) endDateValue.setHours(23, 59, 59, 999);

        if (startDateValue && endDateValue) {
            reportsForDisplayInTable = reportsForChartsAndCalendar.filter(report => {
                const dueDate = new Date(report.dueDate);
                return dueDate >= startDateValue && dueDate <= endDateValue;
            });
        } else {
            reportsForDisplayInTable = reportsForChartsAndCalendar;
        }
    }

    currentPage = 1;
    populateTable();
    updateKPIs();

    const activeViewId = document.querySelector('.view.active')?.id;
    if (activeViewId === 'analytics-section') renderAnalyticsCharts();
    if (activeViewId === 'calendar-section') renderFullCalendar();
    if (activeViewId === 'timeline-section') renderTimeline();
}


function resetDateFilter() {
    startDateInput.value = '';
    endDateInput.value = '';
    applyAllFiltersAndRender();
}

function handleKpiCardClick(event) {
    const clickedCard = event.currentTarget;
    const kpiType = clickedCard.dataset.kpiType;
    const kpiName = clickedCard.querySelector('.kpi-label').textContent;

    if (activeKpiFilterType === kpiType) {
        activeKpiFilterType = null;
        activeKpiFilterName = '';
    } else {
        activeKpiFilterType = kpiType;
        activeKpiFilterName = kpiName;
    }
    applyAllFiltersAndRender();
}

function clearActiveKpiFilter() {
    activeKpiFilterType = null;
    activeKpiFilterName = '';
    applyAllFiltersAndRender();
}

function handleNavigation(event) {
    event.preventDefault();
    const targetNavItem = event.target.closest('.nav-item');
    if (!targetNavItem || targetNavItem.classList.contains('active')) return;

    const viewId = targetNavItem.dataset.view;
    if (!viewId) return;

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => item.classList.remove('active'));
    targetNavItem.classList.add('active');

    document.querySelectorAll('.main-content .view').forEach(view => {
        view.classList.toggle('active', view.id === viewId);
        if (view.id === viewId) {
            if (viewId === 'analytics-section') renderAnalyticsCharts();
            else if (viewId === 'calendar-section') renderFullCalendar();
            else if (viewId === 'timeline-section') renderTimeline();
        }
    });
}

function renderAnalyticsCharts() {
    const dataForCharts = reportsForChartsAndCalendar;

    const departmentCounts = dataForCharts.reduce((acc, r) => ({ ...acc, [r.department]: (acc[r.department] || 0) + 1 }), {});
    const frequencyCounts = dataForCharts.reduce((acc, r) => ({ ...acc, [r.frequency]: (acc[r.frequency] || 0) + 1 }), {});

    const chartOptions = (title) => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { font: { family: "'Cairo', sans-serif" } } },
            tooltip: { bodyFont: { family: "'Cairo', sans-serif" }, titleFont: { family: "'Cairo', sans-serif" } }
        }
    });

    const departmentChartCtx = document.getElementById('department-chart')?.getContext('2d');
    if (departmentChartCtx) {
        if (departmentChartInstance) departmentChartInstance.destroy();
        departmentChartInstance = new Chart(departmentChartCtx, {
            type: 'pie',
            data: {
                labels: Object.keys(departmentCounts),
                datasets: [{
                    label: 'التقارير حسب الجهة', data: Object.values(departmentCounts),
                    backgroundColor: ['#C89638', '#bd9a5f', '#AEC6CF', '#E67E22', '#5cb85c', '#5bc0de', '#95A5A6', '#2C3E50', '#F1C40F', '#3498DB'],
                    borderColor: '#FFFFFF', borderWidth: 2
                }]
            },
            options: chartOptions('التقارير حسب الجهة')
        });
    }

    const frequencyChartCtx = document.getElementById('frequency-chart')?.getContext('2d');
    if (frequencyChartCtx) {
        if (frequencyChartInstance) frequencyChartInstance.destroy();
        frequencyChartInstance = new Chart(frequencyChartCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(frequencyCounts),
                datasets: [{
                    label: 'التقارير حسب التكرار', data: Object.values(frequencyCounts),
                    backgroundColor: 'rgba(200, 150, 56, 0.8)',
                    borderColor: 'rgba(200, 150, 56, 1)', borderWidth: 1
                }]
            },
            options: { ...chartOptions('التقارير حسب التكرار'), scales: { y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: "'Cairo', sans-serif" } } }, x: { ticks: { font: { family: "'Cairo', sans-serif" } } } } }
        });
    }
}

function renderFullCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    const eventsForCalendar = reportsForChartsAndCalendar.map(report => ({
        id: report.id,
        title: report.title,
        start: report.dueDate,
        allDay: true,
        extendedProps: { ...report, statusInfo: getReportStatusWithReference(report.dueDate, getToday()) }
    }));

    if (calendarInstance) {
        calendarInstance.removeAllEvents();
        calendarInstance.addEventSource(eventsForCalendar);
    } else {
        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            locale: 'ar',
            headerToolbar: { right: 'prev,next today', center: 'title', left: 'dayGridMonth,timeGridWeek,listWeek' },
            initialView: 'dayGridMonth',
            editable: false,
            events: eventsForCalendar,
            eventDisplay: 'block',
            eventClick: function(info) {
                currentModalReport = info.event.extendedProps;
                modalTitle.textContent = currentModalReport.title;
                modalDepartment.textContent = currentModalReport.department;
                modalFrequency.textContent = currentModalReport.frequency;
                modalDueDate.textContent = currentModalReport.dueDate;
                modalStatus.textContent = currentModalReport.statusInfo.text;
                modalStatus.className = `status-tag ${currentModalReport.statusInfo.class}`;
                eventModal.style.display = 'block';
            },
        });
        calendarInstance.render();
    }
}

// --- Timeline Section ---
function updateTimeTravelDisplay() {
    if (timeTravelDisplay && timelineReferenceDate) {
        timeTravelDisplay.textContent = `التاريخ المرجعي: ${timelineReferenceDate.toISOString().split('T')[0]}`;
    }
}

function renderTimeline() {
    if (!timelineContainer || !window.vis) { // Check if vis is loaded
        console.error("Vis.js Timeline library not loaded or container not found.");
        if(timelineLoadingMessage) timelineLoadingMessage.textContent = "خطأ في تحميل مكتبة الخط الزمني.";
        return;
    }
    if (timelineLoadingMessage) timelineLoadingMessage.style.display = 'block';

    const itemsArray = reportsForChartsAndCalendar.map(report => {
        const statusInfo = getReportStatusWithReference(report.dueDate, timelineReferenceDate);
        return {
            id: report.id,
            content: report.title,
            start: report.dueDate,
            className: `vis-item-custom ${statusInfo.timelineClass}`, // Unified gold background via CSS, border via status
            title: `${report.title}\nالجهة: ${report.department}\nتاريخ الاستحقاق: ${report.dueDate}\nالحالة (بالنسبة لـ ${timelineReferenceDate.toISOString().split('T')[0]}): ${statusInfo.text}`, // Tooltip
            originalReport: report
        };
    });
    const items = new vis.DataSet(itemsArray);


    const options = {
        locale: 'ar',
        orientation: { item: 'top' },
        editable: false,
        selectable: true,
        zoomMin: 1000 * 60 * 60 * 24 * 7,
        zoomMax: 1000 * 60 * 60 * 24 * 365 * 3,
        start: new Date(timelineReferenceDate.getFullYear(), timelineReferenceDate.getMonth() - 1, timelineReferenceDate.getDate()),
        end: new Date(timelineReferenceDate.getFullYear(), timelineReferenceDate.getMonth() + 2, timelineReferenceDate.getDate()),
        height: '400px',
        // Ensure items don't overlap too much if possible
        stack: true, // Try stacking items
        margin: {
            item: {
                vertical: 5, // Add some vertical margin between items
                horizontal: 2
            }
        }
    };

    if (timelineInstance) {
        timelineInstance.destroy();
    }
    try {
        timelineInstance = new vis.Timeline(timelineContainer, items, options);

        try { timelineInstance.removeCustomTime('referenceDate'); } catch (e) { /* ignore */ }
        timelineInstance.addCustomTime(timelineReferenceDate, 'referenceDate');
        // Make custom time bar non-interactive
        const customTimeBar = timelineInstance.customTimes.find(ct => ct.id === 'referenceDate');
        if (customTimeBar && customTimeBar.hammer) {
             customTimeBar.hammer.off("pan");
             customTimeBar.hammer.off("tap");
             customTimeBar.hammer.off("press");
        }


        timelineInstance.on('select', function (properties) {
            if (properties.items.length > 0) {
                const selectedReportId = properties.items[0];
                const selectedItem = items.get(selectedReportId); // Get item from DataSet
                if (selectedItem && selectedItem.originalReport) {
                    const reportData = selectedItem.originalReport;
                    currentModalReport = reportData;
                    const statusForModal = getReportStatusWithReference(reportData.dueDate, getToday());

                    modalTitle.textContent = reportData.title;
                    modalDepartment.textContent = reportData.department;
                    modalFrequency.textContent = reportData.frequency;
                    modalDueDate.textContent = reportData.dueDate;
                    modalStatus.textContent = statusForModal.text;
                    modalStatus.className = `status-tag ${statusForModal.class}`;
                    eventModal.style.display = 'block';
                }
            }
        });
    } catch(e) {
        console.error("Error initializing Vis.js Timeline:", e);
        if(timelineLoadingMessage) timelineLoadingMessage.textContent = "خطأ عند عرض الخط الزمني.";
    }


    if (timelineLoadingMessage) timelineLoadingMessage.style.display = 'none';
    console.log("Timeline rendered/updated");
}


// --- Modal Logic ---
function closeModal() {
    if (eventModal) eventModal.style.display = 'none';
    currentModalReport = null;
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    fetchData();

    document.querySelector('.sidebar-nav')?.addEventListener('click', handleNavigation);

    searchInput?.addEventListener('input', applyAllFiltersAndRender);
    departmentFilter?.addEventListener('change', applyAllFiltersAndRender);
    startDateInput?.addEventListener('change', applyAllFiltersAndRender);
    endDateInput?.addEventListener('change', applyAllFiltersAndRender);
    resetDateFilterButton?.addEventListener('click', resetDateFilter);

    Object.values(kpiCards).forEach(card => card?.addEventListener('click', handleKpiCardClick));
    clearKpiFilterButton?.addEventListener('click', clearActiveKpiFilter);

    modalCloseButton?.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => { if (event.target === eventModal) closeModal(); });
    modalEmailButton?.addEventListener('click', () => {
        if (currentModalReport) {
            const subject = `بخصوص تقرير: ${currentModalReport.title}`;
            const body = `السلام عليكم،\n\nيرجى الاطلاع على تقرير "${currentModalReport.title}".\n\nمع وافر التحية والتقدير.`;
            window.location.href = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
    });

    // Timeline controls
    timelineZoomInButton?.addEventListener('click', () => timelineInstance?.zoomIn(0.5));
    timelineZoomOutButton?.addEventListener('click', () => timelineInstance?.zoomOut(0.5));
    timelinePrevButton?.addEventListener('click', () => timelineInstance?.move(0.3)); // Positive to move window "forward" (older dates)
    timelineNextButton?.addEventListener('click', () => timelineInstance?.move(-0.3)); // Negative to move window "backward" (newer dates)
    timelineTodayButton?.addEventListener('click', () => {
        if (timelineInstance) {
            timelineInstance.moveTo(timelineReferenceDate, { animation: true });
        }
    });
    timeTravelDatePicker?.addEventListener('change', (event) => {
        const newDate = new Date(event.target.value);
        if (!isNaN(newDate.valueOf())) { // Check if date is valid
            timelineReferenceDate = newDate;
            updateTimeTravelDisplay();
            if (document.getElementById('timeline-section').classList.contains('active')) {
                renderTimeline();
            }
        } else {
            // Handle invalid date input if necessary, e.g., reset to previous valid date
            event.target.value = timelineReferenceDate.toISOString().split('T')[0];
        }
    });

    document.querySelector('.nav-item[data-view="overview-section"]')?.classList.add('active');
    document.getElementById('overview-section')?.classList.add('active');
});
