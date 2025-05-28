// Global variables
let allReports = [];
let filteredReports = []; // After search and department filter
let reportsForDisplayInTable = []; // After all filters including KPI-specific or date range for table
let currentPage = 1;
const reportsPerPage = 15;
const systemBaseDate = new Date('2025-05-27');
const recipientEmail = 'shamdan@aur.com.sa'; // Recipient email

// Chart instances
let departmentChartInstance = null;
let frequencyChartInstance = null;
let calendarInstance = null;

// State for KPI filter
let activeKpiFilterType = null; // e.g., 'due_today', 'past_due', null
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


// --- Utility Functions ---
function formatDate(date) {
    if (!date || !(date instanceof Date)) return '';
    return date.toISOString().split('T')[0];
}

function diffInDays(date1, date2) {
    const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
    return Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
}

function getReportStatus(dueDateString) {
    const dueDate = new Date(dueDateString);
    const today = new Date(systemBaseDate.getFullYear(), systemBaseDate.getMonth(), systemBaseDate.getDate());
    const diff = diffInDays(dueDate, today);

    if (diff < 0) return { text: 'منتهي', class: 'status-past-due' };
    if (diff === 0) return { text: 'مستحق اليوم', class: 'status-due-today' };
    if (diff > 0 && diff <= 2) return { text: 'قادم قريباً', class: 'status-due-soon' }; // 0 for today, 1 for tomorrow, 2 for day after tomorrow
    return { text: 'قادم', class: 'status-upcoming' };
}

// --- Data Fetching and Processing ---
async function fetchData() {
    console.log('Fetching data...');
    if (loadingMessage) loadingMessage.style.display = 'block';
    if (reportsTableBody) reportsTableBody.innerHTML = '';

    try {
        // const response = await fetch('data.json'); // User requested not to include data.json code
        // For local testing, you might use a placeholder or ensure data.json is served.
        // This line assumes data.json is in the same directory or accessible via the path.
        const response = await fetch('./data.json'); //  Make sure this path is correct for your setup
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
    departmentFilter.innerHTML = '<option value="">كل الجهات</option>'; // Reset
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
        cell.textContent = activeKpiFilterType ? `لا توجد تقارير تطابق فلتر (${activeKpiFilterName}) والبحث الحالي.` : 'لا توجد تقارير تطابق معايير البحث أو التصفية الحالية.';
        cell.style.textAlign = 'center';
        cell.style.padding = '20px';
    } else {
        paginatedReports.forEach(report => {
            const row = reportsTableBody.insertRow();
            const statusInfo = getReportStatus(report.dueDate);

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
    const today = new Date(systemBaseDate.getFullYear(), systemBaseDate.getMonth(), systemBaseDate.getDate());

    // KPIs are always based on `filteredReports` (search + department) BEFORE specific KPI or date range filters for the table.
    const baseReportsForKpiCalc = filteredReports;

    kpiTotalReportsValue.textContent = baseReportsForKpiCalc.length;

    const startDateValue = startDateInput.value ? new Date(startDateInput.value) : null;
    const endDateValue = endDateInput.value ? new Date(endDateInput.value) : null;
    if (endDateValue) endDateValue.setHours(23, 59, 59, 999);

    let reportsInPeriodForKpi = baseReportsForKpiCalc;
    if (startDateValue && endDateValue) {
        reportsInPeriodForKpi = baseReportsForKpiCalc.filter(report => {
            const dueDate = new Date(report.dueDate);
            return dueDate >= startDateValue && dueDate <= endDateValue;
        });
        kpiPeriodReportsValue.textContent = reportsInPeriodForKpi.length;
    } else {
        kpiPeriodReportsValue.textContent = '-';
    }


    const dueTodayCount = baseReportsForKpiCalc.filter(r => diffInDays(new Date(r.dueDate), today) === 0).length;
    kpiDueTodayValue.textContent = dueTodayCount;

    const dueSoonCount = baseReportsForKpiCalc.filter(r => {
        const diff = diffInDays(new Date(r.dueDate), today);
        return diff >= 0 && diff <= 2; // 0, 1, 2 days from today
    }).length;
    kpiDueSoonValue.textContent = dueSoonCount;

    const pastDueCount = baseReportsForKpiCalc.filter(r => diffInDays(new Date(r.dueDate), today) < 0).length;
    kpiPastDueValue.textContent = pastDueCount;

    const upcomingOrDueTodayForNotification = baseReportsForKpiCalc.filter(r => {
        const diff = diffInDays(new Date(r.dueDate), today);
        return diff >= 0 && diff <= 2;
    }).length;

    if (notificationDot) {
        notificationDot.style.display = upcomingOrDueTodayForNotification > 0 ? 'block' : 'none';
    }

    // Style active KPI card
    document.querySelectorAll('.kpi-card').forEach(card => card.classList.remove('kpi-active-filter'));
    if (activeKpiFilterType && kpiCards[activeKpiFilterType]) {
        kpiCards[activeKpiFilterType].classList.add('kpi-active-filter');
    }
    // Ensure kpiFilterIndicator is not displayed
    if (kpiFilterIndicator) {
        kpiFilterIndicator.textContent = ''; // Clear any previous text
        kpiFilterIndicator.style.display = 'none'; // Ensure it's hidden
    }
    if (clearKpiFilterButton) {
        clearKpiFilterButton.style.display = activeKpiFilterType ? 'block' : 'none';
    }
}

// --- Filtering and Searching ---
function applyAllFiltersAndRender() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedDepartment = departmentFilter.value;

    // Step 1: Basic filter (search, department)
    filteredReports = allReports.filter(report => {
        const matchesSearch = searchTerm === '' ||
            report.title.toLowerCase().includes(searchTerm) ||
            report.department.toLowerCase().includes(searchTerm);
        const matchesDepartment = selectedDepartment === '' || report.department === selectedDepartment;
        return matchesSearch && matchesDepartment;
    });

    // Step 2: Apply date/KPI filter for table display
    const today = new Date(systemBaseDate.getFullYear(), systemBaseDate.getMonth(), systemBaseDate.getDate());
    reportsForDisplayInTable = [...filteredReports]; // Start with basic filtered reports

    if (activeKpiFilterType) {
        // KPI filter overrides date range filter for table display
        switch (activeKpiFilterType) {
            case 'total_reports':
                // No additional date filtering, reportsForDisplayInTable is already correct
                break;
            case 'period_reports':
                // This KPI inherently uses the date range filter, so if it was clicked,
                // we assume the user wants to see what's in the date range.
                const startDateValue = startDateInput.value ? new Date(startDateInput.value) : null;
                const endDateValue = endDateInput.value ? new Date(endDateInput.value) : null;
                if (endDateValue) endDateValue.setHours(23, 59, 59, 999);

                if (startDateValue && endDateValue) {
                    reportsForDisplayInTable = filteredReports.filter(report => {
                        const dueDate = new Date(report.dueDate);
                        return dueDate >= startDateValue && dueDate <= endDateValue;
                    });
                }
                // If no date range, it shows all filteredReports, which is fine.
                break;
            case 'due_today':
                reportsForDisplayInTable = filteredReports.filter(r => diffInDays(new Date(r.dueDate), today) === 0);
                break;
            case 'due_soon':
                reportsForDisplayInTable = filteredReports.filter(r => {
                    const diff = diffInDays(new Date(r.dueDate), today);
                    return diff >= 0 && diff <= 2;
                });
                break;
            case 'past_due':
                reportsForDisplayInTable = filteredReports.filter(r => diffInDays(new Date(r.dueDate), today) < 0);
                break;
        }
    } else {
        // Apply date range filter if no KPI filter is active
        const startDateValue = startDateInput.value ? new Date(startDateInput.value) : null;
        const endDateValue = endDateInput.value ? new Date(endDateInput.value) : null;
        if (endDateValue) endDateValue.setHours(23, 59, 59, 999);

        if (startDateValue && endDateValue) {
            reportsForDisplayInTable = filteredReports.filter(report => {
                const dueDate = new Date(report.dueDate);
                return dueDate >= startDateValue && dueDate <= endDateValue;
            });
        }
    }

    currentPage = 1;
    populateTable(); // Populates table with reportsForDisplayInTable
    updateKPIs();     // Updates KPI cards based on filteredReports (before KPI/Date specific for table)

    const activeViewId = document.querySelector('.view.active')?.id;
    if (activeViewId === 'analytics-section') renderAnalyticsCharts();
    if (activeViewId === 'calendar-section') renderFullCalendar();
}


function resetDateFilter() {
    startDateInput.value = '';
    endDateInput.value = '';
    // If a KPI filter is active, resetting date filter should not clear KPI filter
    // It will just mean the KPI filter applies to a broader set if it depended on dates.
    // However, standard KPI filters (due_today, etc.) don't depend on the date range input.
    applyAllFiltersAndRender();
}

function handleKpiCardClick(event) {
    const clickedCard = event.currentTarget;
    const kpiType = clickedCard.dataset.kpiType;
    const kpiName = clickedCard.querySelector('.kpi-label').textContent;

    if (activeKpiFilterType === kpiType) { // Clicked same KPI again, so toggle off
        activeKpiFilterType = null;
        activeKpiFilterName = '';
    } else {
        activeKpiFilterType = kpiType;
        activeKpiFilterName = kpiName;
    }
    // When a KPI is clicked, date range inputs are ignored for table display
    // but preserved for when the KPI filter is cleared.
    applyAllFiltersAndRender();
}

function clearActiveKpiFilter() {
    activeKpiFilterType = null;
    activeKpiFilterName = '';
    applyAllFiltersAndRender();
}


// --- Navigation ---
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
        }
    });
}

// --- Chart.js Analytics ---
function renderAnalyticsCharts() {
    const dataForCharts = filteredReports; // Charts always use search + dept filters

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
                    backgroundColor: 'rgba(200, 150, 56, 0.8)', // Accent Gold
                    borderColor: 'rgba(200, 150, 56, 1)', borderWidth: 1
                }]
            },
            options: { ...chartOptions('التقارير حسب التكرار'), scales: { y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: "'Cairo', sans-serif" } } }, x: { ticks: { font: { family: "'Cairo', sans-serif" } } } } }
        });
    }
}

// --- FullCalendar Integration ---
function renderFullCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    const eventsForCalendar = filteredReports.map(report => ({ // Calendar also uses search + dept filters
        id: report.id,
        title: report.title,
        start: report.dueDate,
        allDay: true,
        // className will be 'event-gold' or similar, defined in CSS
        // Or directly set colors here if preferred over global CSS override
        // backgroundColor: '#C89638', // Gold color as requested
        // borderColor: '#C89638', // Gold color
        // textColor: 'white', // Assuming white text on gold
        extendedProps: { ...report, statusInfo: getReportStatus(report.dueDate) } // Store original report data
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
                currentModalReport = info.event.extendedProps; // This now holds the full report object + statusInfo
                modalTitle.textContent = currentModalReport.title;
                modalDepartment.textContent = currentModalReport.department;
                modalFrequency.textContent = currentModalReport.frequency;
                modalDueDate.textContent = currentModalReport.dueDate;
                modalStatus.textContent = currentModalReport.statusInfo.text;
                modalStatus.className = `status-tag ${currentModalReport.statusInfo.class}`;
                eventModal.style.display = 'block';
            },
            // The gold color for events is now handled by CSS: .fc-event
        });
        calendarInstance.render();
    }
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
    startDateInput?.addEventListener('change', () => { activeKpiFilterType = null; activeKpiFilterName = ''; applyAllFiltersAndRender(); }); // Clear KPI filter if date changes
    endDateInput?.addEventListener('change', () => { activeKpiFilterType = null; activeKpiFilterName = ''; applyAllFiltersAndRender(); });     // Clear KPI filter if date changes
    resetDateFilterButton?.addEventListener('click', () => { activeKpiFilterType = null; activeKpiFilterName = ''; resetDateFilter(); }); // Clear KPI filter also

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

    // Activate overview section by default
    document.querySelector('.nav-item[data-view="overview-section"]')?.classList.add('active');
    document.getElementById('overview-section')?.classList.add('active');
});
