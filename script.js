// Global variables
let allReports = [];
let filteredReportsBase = []; // After search and department filter, includes ALL statuses
let reportsForChartsAndCalendar = []; // Derived from filteredReportsBase, excluding/including past_due based on activeKpiFilterType
let reportsForDisplayInTable = []; // Derived from reportsForChartsAndCalendar or a more specific KPI subset

let currentPage = 1;
const reportsPerPage = 15;
const recipientEmail = 'shamdan@aur.com.sa';

// Chart instances
let departmentChartInstance = null;
let monthlyDepartmentChartInstance = null; // New chart instance for monthly view

// State for KPI filter
let activeKpiFilterType = null;
let activeKpiFilterName = '';
let activeMonthFilter = null; // 'current', 'next', or null

// DOM Elements
const loadingMessage = document.getElementById('loading-message');
const reportsTableBody = document.getElementById('reports-table-body');
const paginationControls = document.getElementById('pagination-controls');
const searchInput = document.getElementById('search-input');
const departmentFilter = document.getElementById('department-filter');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const notificationDot = document.getElementById('notification-dot');
const kpiFilterIndicator = document.getElementById('kpi-filter-indicator');
const resetAllFiltersButton = document.getElementById('reset-all-filters-btn');
const filterCurrentMonthButton = document.getElementById('filter-current-month');
const filterNextMonthButton = document.getElementById('filter-next-month');
// const exportPdfButton = document.getElementById('export-pdf-btn'); // Removed

// Notifications Dropdown Elements
const notificationsBtn = document.getElementById('notifications-btn');
const notificationsDropdown = document.getElementById('notifications-dropdown');
const notificationsList = document.getElementById('notifications-list');
const notificationsFooter = document.getElementById('notifications-footer');
const viewAllNotificationsLink = document.getElementById('view-all-notifications-link');

// Analytics Section Elements
const analyticsDepartmentFilter = document.getElementById('analytics-department-filter');
const analyticsSummaryView = document.getElementById('analytics-summary-view');
const analyticsChartView = document.getElementById('analytics-chart-view');
const monthlyDepartmentChartCanvas = document.getElementById('monthly-department-chart');


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
function getToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function dateToYYYYMMDD(date) {
    if (!date || !(date instanceof Date)) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


function diffInDays(date1Str, date2) {
    const d1 = new Date(date1Str);
    const d1StartOfDay = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const d2StartOfDay = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
    return Math.round((d1StartOfDay - d2StartOfDay) / (1000 * 60 * 60 * 24));
}

function getReportStatusWithReference(dueDateString, referenceDate) {
    const refDateStartOfDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    const diff = diffInDays(dueDateString, refDateStartOfDay);

    if (diff < 0) return { text: 'منتهي', class: 'status-past-due', isPastDue: true };
    if (diff === 0) return { text: 'مستحق اليوم', class: 'status-due-today', isPastDue: false };
    if (diff > 0 && diff <= 2) return { text: 'قادم قريباً', class: 'status-due-soon', isPastDue: false };
    return { text: 'قادم', class: 'status-upcoming', isPastDue: false };
}

function generateICSContent(report) {
    const formatDateForICS = (dateString) => {
        const date = new Date(dateString);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    };

    const now = new Date();
    const dtstamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}Z`;
    const uid = `report-${report.id}-${Date.now()}@aur.com.sa`;
    const dtstart = formatDateForICS(report.dueDate);

    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//AUR//Report Dashboard//EN',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `SUMMARY:تذكير بتقرير: ${report.title}`,
        `DESCRIPTION:الجهة: ${report.department}\\nفترة التكرار: ${report.frequency}\\nتاريخ الاستحقاق: ${report.dueDate}`,
        'STATUS:TENTATIVE',
        'TRANSP:TRANSPARENT',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:تذكير بالتقرير: ' + report.title,
        'TRIGGER;VALUE=DATE-TIME:' + dtstart + 'T090000',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    return icsContent;
}

function downloadICSFile(icsContent, reportTitle) {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const filename = `تذكير-${reportTitle.replace(/[\s\/]+/g, '_')}.ics`;
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function fetchData() {
    if (loadingMessage) loadingMessage.style.display = 'block';
    if (reportsTableBody) reportsTableBody.innerHTML = '';

    try {
        const response = await fetch('./data.json');
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText} (URL: ${response.url})`);
        }
        const data = await response.json();
        
        allReports = data.map(item => ({
            id: item[0],
            department: item[1],
            title: item[2],
            frequency: item[3],
            dueDate: item[4],
        }));

        populateDepartmentFilter();
        populateAnalyticsFilter();
        applyAllFiltersAndRender(); 

    } catch (error) {
        console.error('Error fetching or parsing data:', error);
        if (loadingMessage) loadingMessage.textContent = `حدث خطأ أثناء تحميل البيانات: ${error.message}. يرجى التأكد من وجود ملف data.json في المسار الصحيح.`;
    } finally {
        if (loadingMessage) loadingMessage.style.display = 'none';
    }
}

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
        paginatedReports.forEach((report, index) => {
            const row = reportsTableBody.insertRow();
            const statusInfo = getReportStatusWithReference(report.dueDate, getToday());

            row.insertCell().textContent = index + 1;

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
            actionsCell.style.whiteSpace = 'nowrap';

            const emailButton = document.createElement('button');
            emailButton.className = 'action-button';
            emailButton.innerHTML = '<i class="fas fa-envelope"></i>';
            emailButton.title = "إرسال بريد إلكتروني";
            emailButton.setAttribute('aria-label', `إرسال بريد بخصوص ${report.title}`);
            emailButton.onclick = () => {
                const subject = `بخصوص تقرير: ${report.title}`;
                const body = `السلام عليكم،\n\nمرفق لكم تقرير "${report.title}"\n\nمع وافر التحية والتقدير`;
                window.location.href = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            };
            actionsCell.appendChild(emailButton);

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
    
    // KPI: "إجمالي التقارير القادمة" - Based on search/dept filters only, ignores date range
    const nonPastDueOverall = filteredReportsBase.filter(r => !getReportStatusWithReference(r.dueDate, today).isPastDue);
    kpiTotalReportsValue.textContent = nonPastDueOverall.length;
    
    // KPI: "تقارير منتهية" is always based on search/dept only
    const pastDueReportsForAll = filteredReportsBase.filter(r => getReportStatusWithReference(r.dueDate, today).isPastDue);
    kpiPastDueValue.textContent = pastDueReportsForAll.length;

    // KPI: "إجمالي تقارير الفترة" is the only KPI that respects the date range filter
    const startDateValue = startDateInput.value ? new Date(startDateInput.value) : null;
    const endDateValue = endDateInput.value ? new Date(endDateInput.value) : null;
    if (endDateValue) endDateValue.setHours(23, 59, 59, 999);

    if (startDateValue && endDateValue) {
        const reportsInPeriod = filteredReportsBase.filter(report => {
            const dueDate = new Date(report.dueDate);
            return dueDate >= startDateValue && dueDate <= endDateValue;
        });
        const nonPastDueInPeriod = reportsInPeriod.filter(r => !getReportStatusWithReference(r.dueDate, today).isPastDue);
        kpiPeriodReportsValue.textContent = nonPastDueInPeriod.length;
    } else {
        kpiPeriodReportsValue.textContent = '-';
    }
    
    // KPIs: "مستحق اليوم" and "مستحق خلال 3 أيام" are based on search/dept only
    kpiDueTodayValue.textContent = nonPastDueOverall.filter(r => diffInDays(r.dueDate, today) === 0).length;
    
    kpiDueSoonValue.textContent = nonPastDueOverall.filter(r => {
        const diff = diffInDays(r.dueDate, today);
        return diff > 0 && diff <= 3; 
    }).length;
    
    // Notification dot logic remains the same (based on search/dept only)
    const upcomingOrDueTodayForNotification = nonPastDueOverall.filter(r => {
        const diff = diffInDays(r.dueDate, today);
        return diff >= 0 && diff <= 2;
    }).length;

    if (notificationDot) {
        notificationDot.style.display = upcomingOrDueTodayForNotification > 0 ? 'block' : 'none';
    }

    Object.values(kpiCards).forEach(card => {
        if (card) card.classList.remove('kpi-active-filter');
    });
    if (activeKpiFilterType && kpiCards[activeKpiFilterType]) {
        kpiCards[activeKpiFilterType].classList.add('kpi-active-filter');
    }

    if (kpiFilterIndicator) {
        kpiFilterIndicator.textContent = '';
        kpiFilterIndicator.style.display = 'none';
    }
}


function applyAllFiltersAndRender() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedDepartment = departmentFilter.value;
    const today = getToday();

    // 1. Base filtering (search, department)
    filteredReportsBase = allReports.filter(report => {
        const matchesSearch = searchTerm === '' ||
            report.title.toLowerCase().includes(searchTerm) ||
            report.department.toLowerCase().includes(searchTerm);
        const matchesDepartment = selectedDepartment === '' || report.department === selectedDepartment;
        return matchesSearch && matchesDepartment;
    });

    // 2. Determine reports for Charts/Calendar (respects KPI 'past_due' or shows non-past-due from filteredReportsBase)
    if (activeKpiFilterType === 'past_due') {
        reportsForChartsAndCalendar = filteredReportsBase.filter(r => getReportStatusWithReference(r.dueDate, today).isPastDue);
    } else {
        reportsForChartsAndCalendar = filteredReportsBase.filter(r => !getReportStatusWithReference(r.dueDate, today).isPastDue);
    }
    
    // 3. Determine reports for Table display
    let tempReportsForTable;

    if (activeKpiFilterType) {
        // When a KPI is active, it generally ignores the date range inputs for table filtering
        // except for "period_reports".
        if (activeKpiFilterType === 'past_due') {
            tempReportsForTable = filteredReportsBase.filter(r => getReportStatusWithReference(r.dueDate, today).isPastDue);
            tempReportsForTable.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate)); // Sort newest first
        } else {
            let kpiScope = filteredReportsBase.filter(r => !getReportStatusWithReference(r.dueDate, today).isPastDue);
            
            if (activeKpiFilterType === 'total_reports') {
                tempReportsForTable = kpiScope;
            } else if (activeKpiFilterType === 'due_today') {
                tempReportsForTable = kpiScope.filter(r => diffInDays(r.dueDate, today) === 0);
            } else if (activeKpiFilterType === 'due_soon') {
                tempReportsForTable = kpiScope.filter(r => {
                    const diff = diffInDays(r.dueDate, today);
                    return diff > 0 && diff <= 3; 
                });
            } else if (activeKpiFilterType === 'period_reports') {
                const startDateValue = startDateInput.value ? new Date(startDateInput.value) : null;
                const endDateValue = endDateInput.value ? new Date(endDateInput.value) : null;
                if (endDateValue) endDateValue.setHours(23, 59, 59, 999);

                if(startDateValue && endDateValue) {
                     tempReportsForTable = kpiScope.filter(report => {
                        const dueDate = new Date(report.dueDate);
                        return dueDate >= startDateValue && dueDate <= endDateValue;
                    });
                } else {
                    tempReportsForTable = []; // No period defined for "period reports" KPI
                }
            }
        }
    } else {
        // No KPI filter active, use date range on non-past-due reports
        tempReportsForTable = filteredReportsBase.filter(r => !getReportStatusWithReference(r.dueDate, today).isPastDue);
        const startDateValue = startDateInput.value ? new Date(startDateInput.value) : null;
        const endDateValue = endDateInput.value ? new Date(endDateInput.value) : null;
        if (endDateValue) endDateValue.setHours(23, 59, 59, 999);

        if (startDateValue && endDateValue) {
            tempReportsForTable = tempReportsForTable.filter(report => {
                const dueDate = new Date(report.dueDate);
                return dueDate >= startDateValue && dueDate <= endDateValue;
            });
        }
    }
    
    reportsForDisplayInTable = tempReportsForTable;

    currentPage = 1;
    populateTable();
    updateKPIs(); 
    updateMonthFilterButtonsUI();

    const activeViewId = document.querySelector('.view.active')?.id;
    if (activeViewId === 'analytics-section') renderAnalyticsView();
    if (activeViewId === 'calendar-section') renderFullCalendar();
}


function resetAllFilters() { 
    searchInput.value = '';
    departmentFilter.value = '';
    startDateInput.value = '';
    endDateInput.value = '';
    activeMonthFilter = null;
    activeKpiFilterType = null;
    activeKpiFilterName = '';
    if (analyticsDepartmentFilter) analyticsDepartmentFilter.value = 'all';
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
        // Clear date-based filters when a specific KPI is clicked, except for period_reports
        if(kpiType !== 'period_reports') {
            startDateInput.value = ''; 
            endDateInput.value = '';
            activeMonthFilter = null; 
        }
    }
    applyAllFiltersAndRender();
}


function handleMonthFilterClick(monthType) {
    if (activeMonthFilter === monthType) {
        activeMonthFilter = null;
        startDateInput.value = ''; 
        endDateInput.value = '';
    } else {
        activeMonthFilter = monthType;
        const todayForMonthCalc = getToday(); 
        let year = todayForMonthCalc.getFullYear();
        let month = todayForMonthCalc.getMonth();

        if (monthType === 'current') {
            // current month is already set
        } else if (monthType === 'next') {
            month += 1;
            if (month > 11) {
                month = 0;
                year += 1;
            }
        }
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        startDateInput.value = dateToYYYYMMDD(firstDay);
        endDateInput.value = dateToYYYYMMDD(lastDay);
    }
    activeKpiFilterType = null; 
    activeKpiFilterName = '';
    applyAllFiltersAndRender();
}

function updateMonthFilterButtonsUI() {
    filterCurrentMonthButton?.classList.toggle('active', activeMonthFilter === 'current');
    filterNextMonthButton?.classList.toggle('active', activeMonthFilter === 'next');
}

// --- Notifications Dropdown Logic ---
function toggleNotificationsDropdown() {
    if (!notificationsDropdown) return;
    const isCurrentlyShown = notificationsDropdown.classList.contains('show');
    if (isCurrentlyShown) {
        notificationsDropdown.classList.remove('show');
    } else {
        populateNotificationsDropdown(); 
        notificationsDropdown.classList.add('show');
    }
}

function populateNotificationsDropdown() {
    if (!notificationsList || !notificationsFooter) {
        return;
    }
    notificationsList.innerHTML = ''; 
    const today = getToday();

    const alertReports = filteredReportsBase.filter(report => {
        const status = getReportStatusWithReference(report.dueDate, today);
        return !status.isPastDue && (status.class === 'status-due-today' || status.class === 'status-due-soon');
    }).sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate)); 

    if (alertReports.length === 0) {
        notificationsList.innerHTML = '<li class="no-notifications">لا توجد تنبيهات حالية.</li>';
        notificationsFooter.style.display = 'none';
    } else {
        alertReports.forEach(report => {
            const statusInfo = getReportStatusWithReference(report.dueDate, today);
            const listItem = document.createElement('li');
            
            listItem.innerHTML = `
                <span class="notification-title">${report.title}</span>
                <small class="notification-details">
                    ${report.department} | ${report.dueDate} | 
                    <span class="notification-status-tag ${statusInfo.class}">${statusInfo.text}</span>
                </small>
            `;
            listItem.addEventListener('click', () => {
                activeKpiFilterType = null; 
                activeMonthFilter = null;
                searchInput.value = report.title; 
                departmentFilter.value = report.department; 
                startDateInput.value = report.dueDate;
                endDateInput.value = report.dueDate;
                
                applyAllFiltersAndRender();
                if (notificationsDropdown) notificationsDropdown.classList.remove('show');
                
                const overviewNavItem = document.querySelector('.nav-item[data-view="overview-section"]');
                if (overviewNavItem && !overviewNavItem.classList.contains('active')) {
                     overviewNavItem.querySelector('a').click();
                }
            });
            notificationsList.appendChild(listItem);
        });
        notificationsFooter.style.display = 'block';
    }
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
            if (viewId === 'analytics-section') renderAnalyticsView();
            else if (viewId === 'calendar-section') renderFullCalendar();
        }
    });
}

// --- Analytics Section Logic ---
function populateAnalyticsFilter() {
    if (!analyticsDepartmentFilter) return;
    const departments = [...new Set(allReports.map(report => report.department))].sort((a, b) => a.localeCompare(b, 'ar'));
    
    while (analyticsDepartmentFilter.options.length > 1) {
        analyticsDepartmentFilter.remove(1);
    }

    departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        analyticsDepartmentFilter.appendChild(option);
    });
}

function renderAnalyticsView() {
    const selectedDept = analyticsDepartmentFilter.value;
    const dataForAnalytics = filteredReportsBase; 

    if (selectedDept === 'all') {
        analyticsSummaryView.style.display = 'grid';
        analyticsChartView.style.display = 'none';
        renderNumericalSummary(dataForAnalytics);
    } else {
        analyticsSummaryView.style.display = 'none';
        analyticsChartView.style.display = 'block';
        renderMonthlyChartForDept(selectedDept, dataForAnalytics);
    }
}

function renderNumericalSummary(data) {
    if (!analyticsSummaryView) return;
    analyticsSummaryView.innerHTML = '';
    
    const departmentCounts = data.reduce((acc, report) => {
        acc[report.department] = (acc[report.department] || 0) + 1;
        return acc;
    }, {});

    const sortedDepartments = Object.keys(departmentCounts).sort((a, b) => a.localeCompare(b, 'ar'));

    if (sortedDepartments.length === 0) {
        analyticsSummaryView.innerHTML = '<p class="no-notifications">لا توجد بيانات لعرضها حسب الفلاتر الحالية.</p>';
        return;
    }

    sortedDepartments.forEach(dept => {
        const count = departmentCounts[dept];
        const item = document.createElement('div');
        item.className = 'summary-item';
        item.innerHTML = `
            <span class="summary-item-dept">${dept}</span>
            <span class="summary-item-count">${count}</span>
        `;
        analyticsSummaryView.appendChild(item);
    });
}

function renderMonthlyChartForDept(department, data) {
    if (!monthlyDepartmentChartCanvas) return;

    const departmentReports = data.filter(report => report.department === department);
    const monthlyCounts = Array(12).fill(0); 

    departmentReports.forEach(report => {
        const month = new Date(report.dueDate).getMonth(); // 0-11
        monthlyCounts[month]++;
    });

    const monthLabels = [
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
    ];

    if (monthlyDepartmentChartInstance) {
        monthlyDepartmentChartInstance.destroy();
    }

    monthlyDepartmentChartInstance = new Chart(monthlyDepartmentChartCanvas, {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: [{
                label: `تقارير - ${department}`,
                data: monthlyCounts,
                backgroundColor: 'rgba(200, 150, 56, 0.8)', 
                borderColor: 'rgba(200, 150, 56, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: { family: "'Cairo', sans-serif" }
                    }
                },
                x: {
                    ticks: {
                        font: { family: "'Cairo', sans-serif" }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    bodyFont: { family: "'Cairo', sans-serif" },
                    titleFont: { family: "'Cairo', sans-serif" }
                }
            }
        }
    });
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

function closeModal() {
    if (eventModal) eventModal.style.display = 'none';
    currentModalReport = null;
}

document.addEventListener('DOMContentLoaded', () => {
    fetchData();

    document.querySelector('.sidebar-nav')?.addEventListener('click', handleNavigation);

    searchInput?.addEventListener('input', applyAllFiltersAndRender);
    departmentFilter?.addEventListener('change', applyAllFiltersAndRender);
    startDateInput?.addEventListener('change', () => {
        activeMonthFilter = null; 
        updateMonthFilterButtonsUI();
        applyAllFiltersAndRender();
    });
    endDateInput?.addEventListener('change', () => {
        activeMonthFilter = null; 
        updateMonthFilterButtonsUI();
        applyAllFiltersAndRender();
    });
    
    resetAllFiltersButton?.addEventListener('click', resetAllFilters);
    // exportPdfButton?.addEventListener('click', exportTableToPDF); // Removed

    Object.values(kpiCards).forEach(card => card?.addEventListener('click', handleKpiCardClick));

    filterCurrentMonthButton?.addEventListener('click', () => handleMonthFilterClick('current'));
    filterNextMonthButton?.addEventListener('click', () => handleMonthFilterClick('next'));

    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', (event) => {
            event.stopPropagation(); 
            toggleNotificationsDropdown();
        });
    }

    if (viewAllNotificationsLink) {
        viewAllNotificationsLink.addEventListener('click', (e) => {
            e.preventDefault();
            activeKpiFilterType = 'due_soon'; 
            activeKpiFilterName = 'التنبيهات الهامة'; 
            startDateInput.value = ''; 
            endDateInput.value = '';
            activeMonthFilter = null;
            applyAllFiltersAndRender();
            
            if (notificationsDropdown && notificationsDropdown.classList.contains('show')) {
                notificationsDropdown.classList.remove('show');
            }
            
            const overviewNavItem = document.querySelector('.nav-item[data-view="overview-section"]');
            if (overviewNavItem && !overviewNavItem.classList.contains('active')) {
                 overviewNavItem.querySelector('a').click();
            }
        });
    }
    
    window.addEventListener('click', (event) => {
        if (notificationsDropdown && notificationsDropdown.classList.contains('show')) {
            const container = notificationsBtn.closest('.notifications-container');
            if (container && !container.contains(event.target)) { 
                 notificationsDropdown.classList.remove('show');
            }
        }
        if (event.target === eventModal) {
            closeModal();
        }
    });

    analyticsDepartmentFilter?.addEventListener('change', renderAnalyticsView);

    modalCloseButton?.addEventListener('click', closeModal);
    
    modalEmailButton?.addEventListener('click', () => {
        if (currentModalReport) {
            const subject = `بخصوص تقرير: ${currentModalReport.title}`;
            const body = `السلام عليكم،\n\nيرجى الاطلاع على تقرير "${currentModalReport.title}".\n\nمع وافر التحية والتقدير.`;
            window.location.href = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
    });

    document.querySelector('.nav-item[data-view="overview-section"]')?.classList.add('active');
    document.getElementById('overview-section')?.classList.add('active');
});
