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

/**
 * Determines the status of a report based on its due date and a reference date.
 * @param {string} dueDateString - The due date of the report (YYYY-MM-DD).
 * @param {Date} referenceDate - The date to compare against (e.g., systemBaseDate or timelineReferenceDate).
 * @returns {object} An object with status text, CSS class, and isPastDue boolean.
 */
function getReportStatusWithReference(dueDateString, referenceDate) {
    const refDateStartOfDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    const diff = diffInDays(dueDateString, refDateStartOfDay);

    if (diff < 0) return { text: 'منتهي', class: 'status-past-due', timelineClass: 'timeline-item-past-due', isPastDue: true };
    if (diff === 0) return { text: 'مستحق اليوم', class: 'status-due-today', timelineClass: 'timeline-item-due-today', isPastDue: false };
    if (diff > 0 && diff <= 2) return { text: 'قادم قريباً', class: 'status-due-soon', timelineClass: 'timeline-item-due-soon', isPastDue: false };
    return { text: 'قادم', class: 'status-upcoming', timelineClass: 'timeline-item-upcoming', isPastDue: false };
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
            id: item[0], // Vis.js needs unique IDs, ensure report IDs are unique
            department: item[1],
            title: item[2],
            frequency: item[3],
            dueDate: item[4],
        }));

        // Initialize time travel picker
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
        cell.colSpan = 7;
        cell.textContent = activeKpiFilterType === 'past_due' ? `لا توجد تقارير منتهية تطابق البحث الحالي.` :
                           activeKpiFilterType ? `لا توجد تقارير تطابق فلتر (${activeKpiFilterName}) والبحث الحالي (مع استبعاد المنتهية).` :
                           'لا توجد تقارير (غير منتهية) تطابق معايير البحث أو التصفية الحالية.';
        cell.style.textAlign = 'center';
        cell.style.padding = '20px';
    } else {
        paginatedReports.forEach(report => {
            const row = reportsTableBody.insertRow();
            // For table, status is always relative to systemBaseDate
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
            const emailButton = document.createElement('button');
            emailButton.className = 'action-button';
            emailButton.innerHTML = '<i class="fas fa-envelope"></i>';
            emailButton.setAttribute('aria-label', `إرسال بريد بخصوص ${report.title}`);
            emailButton.onclick = () => {
                const subject = `بخصوص تقرير: ${report.title}`;
                const body = `السلام عليكم،\n\nيرجى الاطلاع على تقرير "${report.title}".\n\nمع وافر التحية والتقدير.`;
                window.location.href = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            };
            actionsCell.appendChild(emailButton);
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
    const today = getToday(); // System's "today"

    // KPIs are calculated from filteredReportsBase (search + department, all statuses)
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
    const today = getToday(); // System's "today" for default status checks

    // Step 1: Base filter (search, department) - includes all statuses
    filteredReportsBase = allReports.filter(report => {
        const matchesSearch = searchTerm === '' ||
            report.title.toLowerCase().includes(searchTerm) ||
            report.department.toLowerCase().includes(searchTerm);
        const matchesDepartment = selectedDepartment === '' || report.department === selectedDepartment;
        return matchesSearch && matchesDepartment;
    });

    // Step 2: Determine data for Charts, Calendar, and Timeline (based on systemBaseDate for status)
    if (activeKpiFilterType === 'past_due') {
        reportsForChartsAndCalendar = filteredReportsBase.filter(r => getReportStatusWithReference(r.dueDate, today).isPastDue);
    } else {
        // For all other KPI filters or no KPI filter, charts/calendar show non-past-due relative to systemBaseDate
        reportsForChartsAndCalendar = filteredReportsBase.filter(r => !getReportStatusWithReference(r.dueDate, today).isPastDue);
    }

    // Step 3: Determine data for Table Display
    if (activeKpiFilterType) {
        switch (activeKpiFilterType) {
            case 'total_reports':
                reportsForDisplayInTable = reportsForChartsAndCalendar; // Already non-past-due
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
                reportsForDisplayInTable = reportsForChartsAndCalendar; // Already past-due
                break;
            default:
                reportsForDisplayInTable = reportsForChartsAndCalendar;
                break;
        }
    } else {
        // No KPI filter active, apply date range to non-past-due reports for table
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
    if (activeViewId === 'timeline-section') renderTimeline(); // Render timeline if active
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
                modalStatus.textContent = currentModalReport.statusInfo.text; // Status relative to systemBaseDate
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
    if (!timelineContainer) return;
    if (timelineLoadingMessage) timelineLoadingMessage.style.display = 'block';

    // Data for timeline is reportsForChartsAndCalendar
    // Status for timeline items will be relative to timelineReferenceDate
    const items = new vis.DataSet(reportsForChartsAndCalendar.map(report => {
        const statusInfo = getReportStatusWithReference(report.dueDate, timelineReferenceDate); // Status relative to timeline ref date
        return {
            id: report.id,
            content: report.title,
            start: report.dueDate, // Must be YYYY-MM-DD
            className: statusInfo.timelineClass, // For status-based coloring
            originalReport: report // Store original report for modal
        };
    }));

    const options = {
        locale: 'ar', // Basic localization for some elements if vis.js supports it
        orientation: { item: 'top' },
        editable: false,
        selectable: true,
        zoomMin: 1000 * 60 * 60 * 24 * 7, // Minimum zoom: 1 week
        zoomMax: 1000 * 60 * 60 * 24 * 365 * 3, // Maximum zoom: 3 years
        // Set initial window around the timelineReferenceDate
        start: new Date(timelineReferenceDate.getFullYear(), timelineReferenceDate.getMonth() - 1, 1),
        end: new Date(timelineReferenceDate.getFullYear(), timelineReferenceDate.getMonth() + 2, 1),
        height: '400px', // Ensure height is set
        // showCurrentTime: false, // We'll add a custom one for timelineReferenceDate
    };

    if (timelineInstance) {
        timelineInstance.destroy(); // Destroy existing instance before creating new
    }
    timelineInstance = new vis.Timeline(timelineContainer, items, options);

    // Add custom time bar for timelineReferenceDate
    try {
        timelineInstance.removeCustomTime('referenceDate');
    } catch (e) { /* ignore if not found */ }
    timelineInstance.addCustomTime(timelineReferenceDate, 'referenceDate');
    timelineInstance.customTimes[timelineInstance.customTimes.length -1].hammer.off("pan"); // Make it non-draggable

    timelineInstance.on('select', function (properties) {
        if (properties.items.length > 0) {
            const selectedReportId = properties.items[0];
            const reportData = items.get(selectedReportId)?.originalReport;
            if (reportData) {
                currentModalReport = reportData; // Set for the modal
                // Status for modal should be relative to systemBaseDate
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
    fetchData(); // This will also call applyAllFiltersAndRender

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
    timelinePrevButton?.addEventListener('click', () => timelineInstance?.move(-0.3));
    timelineNextButton?.addEventListener('click', () => timelineInstance?.move(0.3));
    timelineTodayButton?.addEventListener('click', () => {
        if (timelineInstance) {
            timelineInstance.moveTo(timelineReferenceDate);
        }
    });
    timeTravelDatePicker?.addEventListener('change', (event) => {
        const newDate = new Date(event.target.value);
        if (!isNaN(newDate)) {
            timelineReferenceDate = newDate;
            updateTimeTravelDisplay();
            if (document.getElementById('timeline-section').classList.contains('active')) {
                renderTimeline(); // Re-render with new reference date for item coloring and focus
            }
        }
    });


    document.querySelector('.nav-item[data-view="overview-section"]')?.classList.add('active');
    document.getElementById('overview-section')?.classList.add('active');
});
