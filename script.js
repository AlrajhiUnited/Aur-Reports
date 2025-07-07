// Global variables
let allReports = [];
let currentPage = 1;
const reportsPerPage = 15;
const recipientEmail = 'shamdan@aur.com.sa';

// Chart and Calendar instances
let departmentChartInstance = null;
let frequencyChartInstance = null;
let calendarInstance = null;

// State for filters
let activeKpiFilterType = null;
let activeMonthFilter = null;

// DOM Elements
const loadingMessage = document.getElementById('loading-message');
const reportsTableBody = document.getElementById('reports-table-body');
const paginationControls = document.getElementById('pagination-controls');
const searchInput = document.getElementById('search-input');
const departmentFilter = document.getElementById('department-filter');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const notificationDot = document.getElementById('notification-dot');
const resetAllFiltersButton = document.getElementById('reset-all-filters-btn');
const filterCurrentMonthButton = document.getElementById('filter-current-month');
const filterNextMonthButton = document.getElementById('filter-next-month');
const eventModal = document.getElementById('event-modal');
const modalCloseButton = eventModal.querySelector('.close-button');
const modalEmailButton = document.getElementById('modal-email-button');
let currentModalReport = null;

const kpiCards = {
    total_reports: document.getElementById('kpi-total-reports-card'),
    period_reports: document.getElementById('kpi-period-reports-card'),
    due_today: document.getElementById('kpi-due-today-card'),
    due_soon: document.getElementById('kpi-due-soon-card'),
    past_due: document.getElementById('kpi-past-due-card')
};

// --- Utility Functions ---
function getToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function dateToYYYYMMDD(date) {
    if (!date || !(date instanceof Date)) return '';
    return date.toISOString().split('T')[0];
}

function diffInDays(date1Str, date2) {
    const d1 = new Date(date1Str);
    d1.setHours(0, 0, 0, 0);
    const d2StartOfDay = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
    return Math.round((d1 - d2StartOfDay) / (1000 * 60 * 60 * 24));
}

function getReportStatus(dueDateString, referenceDate) {
    const diff = diffInDays(dueDateString, referenceDate);
    if (diff < 0) return { text: 'منتهي', class: 'status-past-due', isPastDue: true };
    if (diff === 0) return { text: 'مستحق اليوم', class: 'status-due-today', isPastDue: false };
    if (diff > 0 && diff <= 2) return { text: 'قادم قريباً', class: 'status-due-soon', isPastDue: false };
    return { text: 'قادم', class: 'status-upcoming', isPastDue: false };
}

// --- Data Fetching and Initial Setup ---
async function fetchData() {
    loadingMessage.style.display = 'block';
    reportsTableBody.innerHTML = '';
    try {
        const response = await fetch('./data.json');
        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
        const data = await response.json();
        allReports = data.map(item => ({
            id: item[0], department: item[1], title: item[2], frequency: item[3], dueDate: item[4],
        }));
        populateDepartmentFilter();
        applyAllFiltersAndRender();
    } catch (error) {
        console.error('Error fetching data:', error);
        loadingMessage.textContent = `حدث خطأ أثناء تحميل البيانات: ${error.message}.`;
    } finally {
        loadingMessage.style.display = 'none';
    }
}

function populateDepartmentFilter() {
    const departments = [...new Set(allReports.map(r => r.department))].sort((a, b) => a.localeCompare(b, 'ar'));
    departmentFilter.innerHTML = '<option value="">كل الجهات</option>';
    departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        departmentFilter.appendChild(option);
    });
}

// --- Core Logic: Filtering and Rendering ---
function applyAllFiltersAndRender() {
    const today = getToday();
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedDepartment = departmentFilter.value;
    const startDateValue = startDateInput.value ? new Date(startDateInput.value) : null;
    const endDateValue = endDateInput.value ? new Date(endDateInput.value) : null;
    if (endDateValue) endDateValue.setHours(23, 59, 59, 999);

    // 1. Apply base filters (search, department)
    const baseFilteredReports = allReports.filter(report => {
        const matchesSearch = !searchTerm || report.title.toLowerCase().includes(searchTerm) || report.department.toLowerCase().includes(searchTerm);
        const matchesDepartment = !selectedDepartment || report.department === selectedDepartment;
        return matchesSearch && matchesDepartment;
    });

    // 2. Separate base-filtered reports into upcoming and past-due
    const upcomingBaseReports = baseFilteredReports.filter(r => !getReportStatus(r.dueDate, today).isPastDue);
    const pastDueBaseReports = baseFilteredReports.filter(r => getReportStatus(r.dueDate, today).isPastDue);

    // 3. Apply date filters to each group separately
    const filterByDate = (reports) => (startDateValue && endDateValue)
        ? reports.filter(r => { const d = new Date(r.dueDate); return d >= startDateValue && d <= endDateValue; })
        : reports;
        
    const upcomingDateFilteredReports = filterByDate(upcomingBaseReports);
    const pastDueDateFilteredReports = filterByDate(pastDueBaseReports);

    // 4. Update KPI cards
    updateKPIs(upcomingBaseReports, upcomingDateFilteredReports, pastDueDateFilteredReports, today);
    
    // 5. Determine which data to show in the table
    let reportsForDisplay;
    switch (activeKpiFilterType) {
        case 'total_reports':
            reportsForDisplay = upcomingBaseReports;
            break;
        case 'period_reports':
            reportsForDisplay = upcomingDateFilteredReports;
            break;
        case 'due_today':
            reportsForDisplay = upcomingDateFilteredReports.filter(r => diffInDays(r.dueDate, today) === 0);
            break;
        case 'due_soon':
            reportsForDisplay = upcomingDateFilteredReports.filter(r => diffInDays(r.dueDate, today) > 0 && diffInDays(r.dueDate, today) <= 3);
            break;
        case 'past_due':
            reportsForDisplay = pastDueDateFilteredReports;
            reportsForDisplay.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
            break;
        default:
            // Default view is upcoming reports within the date filter (or all upcoming if no date filter)
            reportsForDisplay = upcomingDateFilteredReports;
    }

    // 6. Render UI
    currentPage = 1;
    populateTable(reportsForDisplay, today);
    updateUIAfterFiltering(upcomingBaseReports, reportsForDisplay, today);
}

function updateKPIs(upcomingBase, upcomingDateFiltered, pastDueDateFiltered, today) {
    // KPI 1: Total Upcoming Reports (only respects search/department)
    document.getElementById('kpi-total-reports-value').textContent = upcomingBase.length;

    // KPI 2: Upcoming Period Reports (respects search/department/date)
    const periodReportsCardLabel = document.querySelector('#kpi-period-reports-card .kpi-label');
    if (startDateInput.value && endDateInput.value) {
        document.getElementById('kpi-period-reports-value').textContent = upcomingDateFiltered.length;
        periodReportsCardLabel.textContent = 'تقارير الفترة القادمة';
    } else {
        document.getElementById('kpi-period-reports-value').textContent = '-';
        periodReportsCardLabel.textContent = 'تقارير الفترة المحددة';
    }

    // Other KPIs for upcoming reports (respect search/department/date)
    document.getElementById('kpi-due-today-value').textContent = upcomingDateFiltered.filter(r => diffInDays(r.dueDate, today) === 0).length;
    document.getElementById('kpi-due-soon-value').textContent = upcomingDateFiltered.filter(r => diffInDays(r.dueDate, today) > 0 && diffInDays(r.dueDate, today) <= 3).length;
    
    // Past Due KPI (respects search/department/date)
    document.getElementById('kpi-past-due-value').textContent = pastDueDateFiltered.length;
}

function updateUIAfterFiltering(upcomingBaseReports, reportsForTable, today) {
    // Update notification dot (based on upcoming reports from base filters)
    const upcomingForNotification = upcomingBaseReports.filter(r => {
        const status = getReportStatus(r.dueDate, today);
        return status.class === 'status-due-today' || status.class === 'status-due-soon';
    }).length;
    notificationDot.style.display = upcomingForNotification > 0 ? 'block' : 'none';

    // Update active state on KPI cards
    Object.values(kpiCards).forEach(card => card.classList.remove('kpi-active-filter'));
    if (activeKpiFilterType && kpiCards[activeKpiFilterType]) {
        kpiCards[activeKpiFilterType].classList.add('kpi-active-filter');
    }
    
    updateMonthFilterButtonsUI();

    // Update views if they are active
    const activeViewId = document.querySelector('.view.active')?.id;
    // For charts and calendar, always show the currently displayed data in the table
    const dataForChartsAndCalendar = reportsForTable;

    if (activeViewId === 'analytics-section') renderAnalyticsCharts(dataForChartsAndCalendar);
    if (activeViewId === 'calendar-section') renderFullCalendar(dataForChartsAndCalendar, today);
}


// --- UI Population Functions ---
function populateTable(reports, today) {
    reportsTableBody.innerHTML = '';
    const startIndex = (currentPage - 1) * reportsPerPage;
    const paginatedReports = reports.slice(startIndex, startIndex + reportsPerPage);

    if (paginatedReports.length === 0) {
        const row = reportsTableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 7;
        cell.textContent = 'لا توجد تقارير تطابق معايير البحث أو التصفية الحالية.';
        cell.style.textAlign = 'center';
        cell.style.padding = '20px';
    } else {
        paginatedReports.forEach((report, index) => {
            const row = reportsTableBody.insertRow();
            const statusInfo = getReportStatus(report.dueDate, today);
            row.insertCell().textContent = startIndex + index + 1;
            row.insertCell().textContent = report.department;
            row.insertCell().textContent = report.title;
            row.insertCell().textContent = report.frequency;
            row.insertCell().textContent = report.dueDate;
            const statusCell = row.insertCell();
            statusCell.innerHTML = `<span class="status-tag ${statusInfo.class}">${statusInfo.text}</span>`;
            const actionsCell = row.insertCell();
            actionsCell.innerHTML = `
                <button class="action-button" title="إرسال بريد إلكتروني" aria-label="إرسال بريد بخصوص ${report.title}"><i class="fas fa-envelope"></i></button>
                <button class="action-button" title="إضافة تنبيه للتقويم" aria-label="إضافة تنبيه لتقرير ${report.title} إلى التقويم"><i class="far fa-calendar-plus"></i></button>
            `;
            actionsCell.querySelector('.fa-envelope').parentElement.onclick = () => sendEmail(report);
            actionsCell.querySelector('.fa-calendar-plus').parentElement.onclick = () => downloadICS(report);
        });
    }
    displayPagination(reports.length);
}

function displayPagination(totalReports) {
    paginationControls.innerHTML = '';
    const totalPages = Math.ceil(totalReports / reportsPerPage);
    if (totalPages <= 1) return;

    const createButton = (text, pageNum, isDisabled = false, isActive = false) => {
        const button = document.createElement('button');
        button.innerHTML = text;
        button.disabled = isDisabled;
        if (isActive) button.classList.add('active');
        button.onclick = () => {
            currentPage = pageNum;
            // We don't need to re-filter, just re-populate the table for the new page
            // But the current logic re-filters anyway, which is fine, just less efficient.
            // Let's stick with the current logic for simplicity.
            applyAllFiltersAndRender();
        };
        return button;
    };
    paginationControls.appendChild(createButton('&laquo; السابق', currentPage - 1, currentPage === 1));
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
             paginationControls.appendChild(createButton(i, i, false, i === currentPage));
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            paginationControls.insertAdjacentHTML('beforeend', `<span>...</span>`);
        }
    }
    paginationControls.appendChild(createButton('التالي &raquo;', currentPage + 1, currentPage === totalPages));
}

// --- Event Handlers and Actions ---
function handleKpiCardClick(kpiType) {
    activeKpiFilterType = activeKpiFilterType === kpiType ? null : kpiType;
    applyAllFiltersAndRender();
}

function handleMonthFilterClick(monthType) {
    if (activeMonthFilter === monthType) {
        activeMonthFilter = null;
        startDateInput.value = '';
        endDateInput.value = '';
    } else {
        activeMonthFilter = monthType;
        const today = getToday();
        let year = today.getFullYear();
        let month = today.getMonth();
        if (monthType === 'next') {
            month++;
            if (month > 11) {
                month = 0;
                year++;
            }
        }
        startDateInput.value = dateToYYYYMMDD(new Date(year, month, 1));
        endDateInput.value = dateToYYYYMMDD(new Date(year, month + 1, 0));
    }
    activeKpiFilterType = null;
    applyAllFiltersAndRender();
}

function updateMonthFilterButtonsUI() {
    filterCurrentMonthButton.classList.toggle('active', activeMonthFilter === 'current');
    filterNextMonthButton.classList.toggle('active', activeMonthFilter === 'next');
}

function sendEmail(report) {
    const subject = `بخصوص تقرير: ${report.title}`;
    const body = `السلام عليكم،\n\nيرجى الاطلاع على تقرير "${report.title}".\n\nمع وافر التحية والتقدير.`;
    window.location.href = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function downloadICS(report) {
    const formatDate = (date) => date.toISOString().replace(/-|:|\.\d+/g, '');
    const now = new Date();
    const icsContent = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AUR//Report Dashboard//EN',
        'BEGIN:VEVENT',
        `UID:report-${report.id}-${now.getTime()}@aur.com.sa`,
        `DTSTAMP:${formatDate(now)}Z`,
        `DTSTART;VALUE=DATE:${report.dueDate.replace(/-/g, '')}`,
        `SUMMARY:تذكير بتقرير: ${report.title}`,
        `DESCRIPTION:الجهة: ${report.department}\\nفترة التكرار: ${report.frequency}\\nتاريخ الاستحقاق: ${report.dueDate}`,
        'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `تذكير-${report.title.replace(/[\s\/]+/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

// --- Analytics and Calendar Rendering ---
function renderAnalyticsCharts(dataForCharts) {
    const departmentCounts = dataForCharts.reduce((acc, r) => ({ ...acc, [r.department]: (acc[r.department] || 0) + 1 }), {});
    const frequencyCounts = dataForCharts.reduce((acc, r) => ({ ...acc, [r.frequency]: (acc[r.frequency] || 0) + 1 }), {});
    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { family: "'Cairo', sans-serif" } } } }
    };
    const departmentChartCtx = document.getElementById('department-chart')?.getContext('2d');
    if (departmentChartCtx) {
        if (departmentChartInstance) departmentChartInstance.destroy();
        departmentChartInstance = new Chart(departmentChartCtx, {
            type: 'pie',
            data: { labels: Object.keys(departmentCounts), datasets: [{ data: Object.values(departmentCounts), backgroundColor: ['#C89638', '#bd9a5f', '#AEC6CF', '#E67E22', '#5cb85c', '#5bc0de', '#95A5A6', '#2C3E50'] }] },
            options: chartOptions
        });
    }
    const frequencyChartCtx = document.getElementById('frequency-chart')?.getContext('2d');
    if (frequencyChartCtx) {
        if (frequencyChartInstance) frequencyChartInstance.destroy();
        frequencyChartInstance = new Chart(frequencyChartCtx, {
            type: 'bar',
            data: { labels: Object.keys(frequencyCounts), datasets: [{ label: 'التقارير', data: Object.values(frequencyCounts), backgroundColor: 'rgba(200, 150, 56, 0.8)' }] },
            options: { ...chartOptions, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });
    }
}

function renderFullCalendar(dataForCalendar, today) {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
    const events = dataForCalendar.map(report => ({
        id: report.id, title: report.title, start: report.dueDate, allDay: true,
        extendedProps: { ...report, statusInfo: getReportStatus(report.dueDate, today) }
    }));
    if (calendarInstance) {
        calendarInstance.removeAllEvents();
        calendarInstance.addEventSource(events);
    } else {
        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            locale: 'ar',
            headerToolbar: { right: 'prev,next today', center: 'title', left: 'dayGridMonth,timeGridWeek,listWeek' },
            events: events,
            eventClick: (info) => {
                currentModalReport = info.event.extendedProps;
                document.getElementById('modal-title').textContent = currentModalReport.title;
                document.getElementById('modal-department').textContent = currentModalReport.department;
                document.getElementById('modal-frequency').textContent = currentModalReport.frequency;
                document.getElementById('modal-due-date').textContent = currentModalReport.dueDate;
                const statusSpan = document.getElementById('modal-status');
                statusSpan.textContent = currentModalReport.statusInfo.text;
                statusSpan.className = `status-tag ${currentModalReport.statusInfo.class}`;
                eventModal.style.display = 'block';
            }
        });
        calendarInstance.render();
    }
}

// --- DOM Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    fetchData();

    // Main filters
    searchInput.addEventListener('input', applyAllFiltersAndRender);
    departmentFilter.addEventListener('change', applyAllFiltersAndRender);
    startDateInput.addEventListener('change', () => { activeMonthFilter = null; applyAllFiltersAndRender(); });
    endDateInput.addEventListener('change', () => { activeMonthFilter = null; applyAllFiltersAndRender(); });
    resetAllFiltersButton.addEventListener('click', () => {
        searchInput.value = ''; departmentFilter.value = ''; startDateInput.value = ''; endDateInput.value = '';
        activeKpiFilterType = null; activeMonthFilter = null;
        applyAllFiltersAndRender();
    });

    // KPI card filters
    Object.entries(kpiCards).forEach(([type, card]) => card.addEventListener('click', () => handleKpiCardClick(type)));

    // Month filters
    filterCurrentMonthButton.addEventListener('click', () => handleMonthFilterClick('current'));
    filterNextMonthButton.addEventListener('click', () => handleMonthFilterClick('next'));

    // Navigation
    document.querySelector('.sidebar-nav').addEventListener('click', (e) => {
        const navItem = e.target.closest('.nav-item');
        if (!navItem) return;
        e.preventDefault();
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => item.classList.remove('active'));
        navItem.classList.add('active');
        document.querySelectorAll('.main-content .view').forEach(view => view.classList.remove('active'));
        document.getElementById(navItem.dataset.view).classList.add('active');
        applyAllFiltersAndRender(); // Re-render charts/calendar on view switch
    });

    // Modal
    modalCloseButton.addEventListener('click', () => eventModal.style.display = 'none');
    modalEmailButton.addEventListener('click', () => { if (currentModalReport) sendEmail(currentModalReport); });
    window.addEventListener('click', (e) => { if (e.target === eventModal) eventModal.style.display = 'none'; });
});
