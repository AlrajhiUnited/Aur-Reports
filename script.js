// Global variables
let allReports = []; // To store all reports fetched from data.json
let filteredReports = []; // To store reports after search and department filter
let reportsForPeriod = []; // To store reports after all filters (search, dept, date)
let currentPage = 1;
const reportsPerPage = 15;
const systemBaseDate = new Date('2025-05-27'); // As specified for "Due Today" calculations

// Chart instances
let departmentChartInstance = null;
let frequencyChartInstance = null;
let calendarInstance = null;

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

// KPI Card Elements
const kpiTotalReports = document.getElementById('kpi-total-reports').querySelector('.kpi-value');
const kpiPeriodReports = document.getElementById('kpi-period-reports').querySelector('.kpi-value');
const kpiDueToday = document.getElementById('kpi-due-today').querySelector('.kpi-value');
const kpiDueSoon = document.getElementById('kpi-due-soon').querySelector('.kpi-value');
const kpiPastDue = document.getElementById('kpi-past-due').querySelector('.kpi-value');

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
/**
 * Formats a Date object to 'YYYY-MM-DD' string.
 * @param {Date} date The date to format.
 * @returns {string} The formatted date string.
 */
function formatDate(date) {
    if (!date || !(date instanceof Date)) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Calculates the difference in days between two dates.
 * Ignores time, only considers date part.
 * @param {Date} date1
 * @param {Date} date2
 * @returns {number} Difference in days (date1 - date2)
 */
function diffInDays(date1, date2) {
    const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
    return Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
}


/**
 * Determines the status of a report based on its due date and the systemBaseDate.
 * @param {string} dueDateString - The due date of the report (YYYY-MM-DD).
 * @returns {object} An object with status text and a CSS class.
 */
function getReportStatus(dueDateString) {
    const dueDate = new Date(dueDateString);
    // Adjust systemBaseDate to remove time component for accurate comparison
    const today = new Date(systemBaseDate.getFullYear(), systemBaseDate.getMonth(), systemBaseDate.getDate());

    const diff = diffInDays(dueDate, today);

    if (diff < 0) {
        return { text: 'منتهي', class: 'status-past-due', color: getComputedStyle(document.documentElement).getPropertyValue('--past-due-color').trim() };
    } else if (diff === 0) {
        return { text: 'مستحق اليوم', class: 'status-due-today', color: getComputedStyle(document.documentElement).getPropertyValue('--accent-orange-table-tag').trim() };
    } else if (diff > 0 && diff <= 3) {
        return { text: 'قادم قريباً', class: 'status-due-soon', color: getComputedStyle(document.documentElement).getPropertyValue('--accent-blue-table-tag').trim() };
    } else {
        return { text: 'قادم', class: 'status-upcoming', color: getComputedStyle(document.documentElement).getPropertyValue('--accent-green-table-tag').trim() };
    }
}

/**
 * Gets the FullCalendar event color based on report status.
 * Uses the agreed-upon muted color palette for the calendar.
 * @param {string} dueDateString - The due date of the report (YYYY-MM-DD).
 * @returns {string} The hex color code for the event.
 */
function getCalendarEventColor(dueDateString) {
    const dueDate = new Date(dueDateString);
    const today = new Date(systemBaseDate.getFullYear(), systemBaseDate.getMonth(), systemBaseDate.getDate());
    const diff = diffInDays(dueDate, today);

    if (diff < 0) {
        return getComputedStyle(document.documentElement).getPropertyValue('--past-due-color').trim(); // منتهي: #E9ECEF (as background)
    } else if (diff === 0) {
        return getComputedStyle(document.documentElement).getPropertyValue('--accent-gold-muted').trim(); // مستحق اليوم: #bd9a5f
    } else if (diff > 0 && diff <= 3) {
        return getComputedStyle(document.documentElement).getPropertyValue('--accent-blue-calendar-event').trim(); // قادم قريباً: #AEC6CF
    } else {
        return getComputedStyle(document.documentElement).getPropertyValue('--accent-green-event').trim(); // قادم: #F5F5F5 (very light)
    }
}
/**
 * Gets the FullCalendar event class based on report status.
 * @param {string} dueDateString - The due date of the report (YYYY-MM-DD).
 * @returns {string} The CSS class for the event.
 */
function getCalendarEventClass(dueDateString) {
    const dueDate = new Date(dueDateString);
    const today = new Date(systemBaseDate.getFullYear(), systemBaseDate.getMonth(), systemBaseDate.getDate());
    const diff = diffInDays(dueDate, today);

    if (diff < 0) return 'event-past-due';
    if (diff === 0) return 'event-due-today';
    if (diff > 0 && diff <= 3) return 'event-due-soon';
    return 'event-upcoming';
}


// --- Data Fetching and Processing ---
async function fetchData() {
    console.log('Fetching data...');
    if (loadingMessage) loadingMessage.style.display = 'block';
    if (reportsTableBody) reportsTableBody.innerHTML = ''; // Clear previous data

    try {
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const data = await response.json();
        console.log('Data fetched successfully:', data.length, 'reports');

        allReports = data.map(item => ({
            id: item[0],
            department: item[1],
            title: item[2],
            frequency: item[3],
            dueDate: item[4], // Keep as string for FullCalendar and status calculation
        }));

        filteredReports = [...allReports]; // Initially, all reports are filtered reports
        reportsForPeriod = [...allReports]; // Initially, all reports are for the period

        populateDepartmentFilter();
        handleFilterAndSearch(); // Apply initial filters (if any) and populate table
        updateKPIs(); // Update KPIs after data is loaded

    } catch (error) {
        console.error('Error fetching or parsing data:', error);
        if (loadingMessage) loadingMessage.textContent = 'حدث خطأ أثناء تحميل البيانات. يرجى المحاولة مرة أخرى.';
        // Optionally, display a more user-friendly error message on the page
    } finally {
        if (loadingMessage) loadingMessage.style.display = 'none';
    }
}

// --- UI Updates ---

/**
 * Populates the department filter dropdown with unique department names.
 */
function populateDepartmentFilter() {
    if (!departmentFilter) return;
    const departments = [...new Set(allReports.map(report => report.department))];
    departments.sort((a, b) => a.localeCompare(b, 'ar')); // Sort alphabetically in Arabic

    // Clear existing options except the first one ("All Departments")
    while (departmentFilter.options.length > 1) {
        departmentFilter.remove(1);
    }

    departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        departmentFilter.appendChild(option);
    });
    console.log('Department filter populated.');
}

/**
 * Populates the main reports table with data for the current page.
 */
function populateTable() {
    if (!reportsTableBody) return;
    reportsTableBody.innerHTML = ''; // Clear existing rows

    const startIndex = (currentPage - 1) * reportsPerPage;
    const endIndex = startIndex + reportsPerPage;
    const paginatedReports = reportsForPeriod.slice(startIndex, endIndex); // Use reportsForPeriod for table

    if (paginatedReports.length === 0 && reportsForPeriod.length > 0) { // If current page is empty but there's data
        currentPage = Math.max(1, Math.ceil(reportsForPeriod.length / reportsPerPage)); // Go to last valid page
        populateTable(); // Re-populate with corrected page
        return;
    }
     if (paginatedReports.length === 0) {
        const row = reportsTableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 7; // Number of columns
        cell.textContent = 'لا توجد تقارير تطابق معايير البحث أو التصفية الحالية.';
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
            row.insertCell().textContent = report.dueDate; // Display as YYYY-MM-DD

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
                const body = `السلام عليكم،\n\nمرفق لكم تقرير "${report.title}".\n\nمع وافر التحية والتقدير.`;
                window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            };
            actionsCell.appendChild(emailButton);
        });
    }
    console.log(`Table populated. Page: ${currentPage}, Reports: ${paginatedReports.length}`);
    displayPagination();
}


/**
 * Displays pagination buttons based on the total number of reports and current page.
 */
function displayPagination() {
    if (!paginationControls) return;
    paginationControls.innerHTML = ''; // Clear existing buttons

    const totalPages = Math.ceil(reportsForPeriod.length / reportsPerPage);

    if (totalPages <= 1) return; // No pagination needed for 1 or 0 pages

    // Previous Button
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '&laquo; السابق';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            populateTable();
        }
    };
    paginationControls.appendChild(prevButton);

    // Page Number Buttons (simplified for now, can add more complex logic for many pages)
    for (let i = 1; i <= totalPages; i++) {
        // Simple display: show first, current +/- 1, last.
        // More complex: ellipsis for many pages.
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            if (i === currentPage) {
                pageButton.classList.add('active');
            }
            pageButton.onclick = () => {
                currentPage = i;
                populateTable();
            };
            paginationControls.appendChild(pageButton);
        } else if ( (i === currentPage - 2 && currentPage > 3) || (i === currentPage + 2 && currentPage < totalPages - 2) ) {
             const ellipsis = document.createElement('span');
             ellipsis.textContent = '...';
             ellipsis.style.margin = "0 5px";
             paginationControls.appendChild(ellipsis);
        }
    }


    // Next Button
    const nextButton = document.createElement('button');
    nextButton.innerHTML = 'التالي &raquo;';
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            populateTable();
        }
    };
    paginationControls.appendChild(nextButton);
    console.log('Pagination displayed.');
}

/**
 * Updates the Key Performance Indicators (KPIs).
 */
function updateKPIs() {
    const today = new Date(systemBaseDate.getFullYear(), systemBaseDate.getMonth(), systemBaseDate.getDate());

    // 1. إجمالي التقارير (بعد فلتر البحث والجهة، قبل فلتر التاريخ)
    kpiTotalReports.textContent = filteredReports.length;

    // 2. إجمالي تقارير الفترة (بعد كل الفلاتر)
    const startDateValue = startDateInput.value ? new Date(startDateInput.value) : null;
    const endDateValue = endDateInput.value ? new Date(endDateInput.value) : null;
    if (startDateValue && endDateValue) {
        kpiPeriodReports.textContent = reportsForPeriod.length;
    } else {
        kpiPeriodReports.textContent = '-'; // Display '-' if no date range is selected
    }

    // Apply all filters for "Due Today" and "Due Soon"
    const reportsForStatusKPIs = reportsForPeriod; // Use reportsForPeriod which has all filters applied

    // 3. مستحق اليوم (بناءً على systemBaseDate وبعد كل الفلاتر)
    const dueTodayCount = reportsForStatusKPIs.filter(report => {
        const dueDate = new Date(report.dueDate);
        return diffInDays(dueDate, today) === 0;
    }).length;
    kpiDueToday.textContent = dueTodayCount;

    // 4. مستحق خلال 3 أيام (بما في ذلك اليوم، بعد كل الفلاتر)
    const dueSoonCount = reportsForStatusKPIs.filter(report => {
        const dueDate = new Date(report.dueDate);
        const diff = diffInDays(dueDate, today);
        return diff >= 0 && diff <= 2; // 0 for today, 1 for tomorrow, 2 for day after
    }).length;
    kpiDueSoon.textContent = dueSoonCount;

    // 5. تقارير منتهية (بعد فلتر البحث والجهة، وبدون تأثير فلتر نطاق التاريخ)
    const pastDueCount = filteredReports.filter(report => { // Use filteredReports (search + dept)
        const dueDate = new Date(report.dueDate);
        return diffInDays(dueDate, today) < 0;
    }).length;
    kpiPastDue.textContent = pastDueCount;


    // Update notification dot (based on reports after search and department filter)
    const upcomingOrDueTodayForNotification = filteredReports.filter(report => {
        const dueDate = new Date(report.dueDate);
        const diff = diffInDays(dueDate, today);
        return diff >= 0 && diff <= 2; // Due today or within next 2 days
    }).length;

    if (notificationDot) {
        notificationDot.style.display = upcomingOrDueTodayForNotification > 0 ? 'block' : 'none';
    }
    console.log('KPIs updated.');
}


// --- Filtering and Searching ---
function handleFilterAndSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedDepartment = departmentFilter.value;
    const startDateValue = startDateInput.value ? new Date(startDateInput.value) : null;
    const endDateValue = endDateInput.value ? new Date(endDateInput.value) : null;

    // Adjust end date to include the whole day
    if (endDateValue) {
        endDateValue.setHours(23, 59, 59, 999);
    }

    // Step 1: Apply search and department filters to `allReports` to get `filteredReports`
    filteredReports = allReports.filter(report => {
        const matchesSearch = searchTerm === '' ||
            report.title.toLowerCase().includes(searchTerm) ||
            report.department.toLowerCase().includes(searchTerm);
        const matchesDepartment = selectedDepartment === '' || report.department === selectedDepartment;
        return matchesSearch && matchesDepartment;
    });

    // Step 2: Apply date filter to `filteredReports` to get `reportsForPeriod`
    if (startDateValue && endDateValue) {
        reportsForPeriod = filteredReports.filter(report => {
            const dueDate = new Date(report.dueDate);
            return dueDate >= startDateValue && dueDate <= endDateValue;
        });
    } else {
        reportsForPeriod = [...filteredReports]; // If no date range, use all from filteredReports
    }

    currentPage = 1; // Reset to first page after filtering
    populateTable();
    updateKPIs();

    // If analytics or calendar views are active, update them
    const activeView = document.querySelector('.view.active').id;
    if (activeView === 'analytics-section') {
        renderAnalyticsCharts();
    } else if (activeView === 'calendar-section') {
        renderFullCalendar();
    }
    console.log('Filters applied. Search:', searchTerm, 'Dept:', selectedDepartment, 'Start:', startDateValue, 'End:', endDateValue);
}

function resetDateFilter() {
    startDateInput.value = '';
    endDateInput.value = '';
    handleFilterAndSearch(); // Re-apply filters (which will now exclude date filter)
    console.log('Date filter reset.');
}


// --- Navigation ---
function handleNavigation(event) {
    event.preventDefault();
    const targetNavItem = event.target.closest('.nav-item');
    if (!targetNavItem) return;

    const viewId = targetNavItem.dataset.view;
    if (!viewId) return;

    // Update active class on sidebar
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => item.classList.remove('active'));
    targetNavItem.classList.add('active');

    // Show the selected view and hide others
    document.querySelectorAll('.main-content .view').forEach(view => {
        if (view.id === viewId) {
            view.classList.add('active');
            // Initialize or update content for the activated view
            if (viewId === 'analytics-section') {
                renderAnalyticsCharts();
            } else if (viewId === 'calendar-section') {
                renderFullCalendar();
            }
        } else {
            view.classList.remove('active');
        }
    });
    console.log('Navigated to:', viewId);
}

// --- Chart.js Analytics ---
function renderAnalyticsCharts() {
    // Data for charts should be based on `filteredReports` (search + department)
    const dataForCharts = filteredReports;

    // 1. Reports by Department (Pie Chart)
    const departmentCounts = dataForCharts.reduce((acc, report) => {
        acc[report.department] = (acc[report.department] || 0) + 1;
        return acc;
    }, {});

    const departmentLabels = Object.keys(departmentCounts);
    const departmentData = Object.values(departmentCounts);

    const departmentChartCtx = document.getElementById('department-chart')?.getContext('2d');
    if (departmentChartCtx) {
        if (departmentChartInstance) {
            departmentChartInstance.destroy();
        }
        departmentChartInstance = new Chart(departmentChartCtx, {
            type: 'pie',
            data: {
                labels: departmentLabels,
                datasets: [{
                    label: 'التقارير حسب الجهة',
                    data: departmentData,
                    backgroundColor: [ // Add more colors if more departments
                        '#C89638', '#bd9a5f', '#AEC6CF', '#E67E22',
                        '#5cb85c', '#5bc0de', '#95A5A6', '#2C3E50',
                        '#F1C40F', '#3498DB', '#E74C3C', '#9B59B6'
                    ],
                    borderColor: '#FFFFFF',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { family: "'Cairo', sans-serif" }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += context.parsed;
                                }
                                return label;
                            }
                        },
                        bodyFont: { family: "'Cairo', sans-serif" },
                        titleFont: { family: "'Cairo', sans-serif" }
                    }
                }
            }
        });
    }

    // 2. Reports by Frequency (Bar Chart)
    const frequencyCounts = dataForCharts.reduce((acc, report) => {
        acc[report.frequency] = (acc[report.frequency] || 0) + 1;
        return acc;
    }, {});

    const frequencyLabels = Object.keys(frequencyCounts);
    const frequencyData = Object.values(frequencyCounts);

    const frequencyChartCtx = document.getElementById('frequency-chart')?.getContext('2d');
    if (frequencyChartCtx) {
        if (frequencyChartInstance) {
            frequencyChartInstance.destroy();
        }
        frequencyChartInstance = new Chart(frequencyChartCtx, {
            type: 'bar',
            data: {
                labels: frequencyLabels,
                datasets: [{
                    label: 'التقارير حسب التكرار',
                    data: frequencyData,
                    backgroundColor: 'rgba(200, 150, 56, 0.8)', // Accent Gold
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
                            stepSize: 1, // Ensure integer ticks if counts are small
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
                        display: false // Often not needed for single dataset bar charts
                    },
                     tooltip: {
                        bodyFont: { family: "'Cairo', sans-serif" },
                        titleFont: { family: "'Cairo', sans-serif" }
                    }
                }
            }
        });
    }
    console.log('Analytics charts rendered/updated.');
}

// --- FullCalendar Integration ---
function renderFullCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    // Data for calendar should be based on `filteredReports` (search + department)
    const eventsForCalendar = filteredReports.map(report => {
        const status = getReportStatus(report.dueDate);
        return {
            id: report.id,
            title: report.title,
            start: report.dueDate, // FullCalendar uses YYYY-MM-DD
            allDay: true,
            // backgroundColor: getCalendarEventColor(report.dueDate),
            // borderColor: getCalendarEventColor(report.dueDate), // Or a slightly darker shade
            classNames: [getCalendarEventClass(report.dueDate)], // Use CSS classes for styling
            extendedProps: {
                department: report.department,
                frequency: report.frequency,
                statusText: status.text,
                statusClass: status.class,
                originalReport: report
            }
        };
    });

    if (calendarInstance) {
        calendarInstance.removeAllEvents();
        calendarInstance.addEventSource(eventsForCalendar);
        calendarInstance.render(); // Re-render might be needed
    } else {
        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            locale: 'ar', // Arabic locale
            headerToolbar: {
                right: 'prev,next today',
                center: 'title',
                left: 'dayGridMonth,timeGridWeek,listWeek' // Added list view
            },
            initialView: 'dayGridMonth',
            editable: false, // Events are not draggable/resizable
            selectable: false,
            events: eventsForCalendar,
            eventDisplay: 'block', // Makes events take full width of day cell
            eventDidMount: function(info) {
                // Example: Add a tooltip using tippy.js if you were to include it
                // For now, we rely on the modal
            },
            eventClick: function(info) {
                // Show modal with event details
                currentModalReport = info.event.extendedProps.originalReport;
                modalTitle.textContent = currentModalReport.title;
                modalDepartment.textContent = currentModalReport.department;
                modalFrequency.textContent = currentModalReport.frequency;
                modalDueDate.textContent = currentModalReport.dueDate;

                const statusInfo = getReportStatus(currentModalReport.dueDate);
                modalStatus.textContent = statusInfo.text;
                modalStatus.className = `status-tag ${statusInfo.class}`; // Apply status styling

                eventModal.style.display = 'block';
            },
            dayCellDidMount: function(info) {
                // Highlight today's date with specific background
                // FullCalendar's fc-day-today class should handle this, but we can override
                // This is now handled by CSS: .fc .fc-day-today
            }
            // Add more FullCalendar options as needed
        });
        calendarInstance.render();
    }
    console.log('FullCalendar rendered/updated.');
}

// --- Modal Logic ---
function closeModal() {
    if (eventModal) eventModal.style.display = 'none';
    currentModalReport = null;
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed.');
    fetchData(); // Fetch data when the page loads

    // Sidebar navigation
    const sidebarNav = document.querySelector('.sidebar-nav');
    if (sidebarNav) {
        sidebarNav.addEventListener('click', handleNavigation);
    }

    // Search and filter listeners
    if (searchInput) searchInput.addEventListener('input', handleFilterAndSearch);
    if (departmentFilter) departmentFilter.addEventListener('change', handleFilterAndSearch);
    if (startDateInput) startDateInput.addEventListener('change', handleFilterAndSearch);
    if (endDateInput) endDateInput.addEventListener('change', handleFilterAndSearch);
    if (resetDateFilterButton) resetDateFilterButton.addEventListener('click', resetDateFilter);

    // Modal close
    if (modalCloseButton) modalCloseButton.onclick = closeModal;
    window.onclick = function(event) { // Close modal if clicked outside
        if (event.target == eventModal) {
            closeModal();
        }
    };
    if(modalEmailButton) {
        modalEmailButton.onclick = () => {
            if (currentModalReport) {
                 const subject = `بخصوص تقرير: ${currentModalReport.title}`;
                const body = `السلام عليكم،\n\nمرفق لكم تقرير "${currentModalReport.title}".\n\nمع وافر التحية والتقدير.`;
                window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            }
        };
    }

    // Initial setup for the "Overview" section to be active
    const overviewNavItem = document.querySelector('.nav-item[data-view="overview-section"]');
    if (overviewNavItem) {
        overviewNavItem.classList.add('active');
        document.getElementById('overview-section').classList.add('active');
    }
});

console.log('Script.js loaded. Base date for "Today":', systemBaseDate.toDateString());
