document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const tableBody = document.getElementById('reports-table-body');
    const searchInput = document.getElementById('search-input');
    const themeSwitcherBtn = document.getElementById('theme-switcher-btn');
    const themeIcon = themeSwitcherBtn.querySelector('i');
    const notificationDot = document.getElementById('notification-dot');
    const navLinks = document.querySelectorAll('.sidebar ul li');
    const views = document.querySelectorAll('.view');
    
    const kpiTotalReports = document.getElementById('kpi-total-reports');
    const kpiDueInPeriod = document.getElementById('kpi-due-in-period');
    const kpiDueToday = document.getElementById('kpi-due-today');
    const kpiDue3Days = document.getElementById('kpi-due-3days');
    const kpiPastTotal = document.getElementById('kpi-past-total');

    const departmentChartCanvasEl = document.getElementById('departmentChart');
    const frequencyChartCanvasEl = document.getElementById('frequencyChart');
    const departmentFilter = document.getElementById('department-filter');
    const paginationControls = document.getElementById('pagination-controls');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const resetDateBtn = document.getElementById('reset-date-filter');

    const calendarEl = document.getElementById('calendar-placeholder');
    const eventModal = document.getElementById('event-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalDepartment = document.getElementById('modal-department');
    const modalDate = document.getElementById('modal-date');
    const modalFrequency = document.getElementById('modal-frequency');
    const modalStatus = document.getElementById('modal-status');
    const modalEmailLink = document.getElementById('modal-email-link');
    const closeModalButton = eventModal.querySelector('.close-button');

    // --- Settings & State ---
    const dataUrl = 'data.json';
    const targetEmail = 'shamdan@aur.com.sa';
    const systemBaseDate = new Date('2025-05-26T00:00:00'); 
    let allReportsData = []; 
    let baseFilteredData = []; 
    let dateRangeFilteredData = []; 
    let currentPage = 1;
    const rowsPerPage = 15; 
    let departmentChartInstance = null;
    let frequencyChartInstance = null; 
    let chartsDrawn = false;
    let calendarInstance = null; 
    let calendarInitialized = false;

    // --- Date Calculations ---
    const today = new Date(new Date(systemBaseDate).setHours(0, 0, 0, 0));
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(today.getDate() + 3);

    // --- Helper: Get computed style for colors ---
    function getThemeColor(cssVarName, fallbackColor) {
        const color = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
        return color || fallbackColor;
    }

    // --- Functions ---
    function getStatus(dueDateStr) {
        const due = new Date(new Date(dueDateStr).setHours(0, 0, 0, 0));
        
        // Updated Calendar Event Colors (Subdued Palette)
        const pastEvent = { 
            backgroundColor: '#E9ECEF', // Very light grey (var(--border-color-light))
            borderColor: '#D0D0D0', 
            textColor: '#6C757D'  // Medium grey text (var(--text-muted-light))
        };
        const dueTodayEvent = { 
            backgroundColor: getThemeColor('--accent-gold-muted', '#bd9a5f'), 
            borderColor: getThemeColor('--accent-gold-muted', '#bd9a5f'), 
            textColor: '#FFFFFF' 
        };
        const upcomingEvent = { 
            backgroundColor: '#AEC6CF', // Pastel Blue/Grey
            borderColor: '#AEC6CF', 
            textColor: getThemeColor('--primary-dark-light', '#2C3E50') 
        };
        const futureEvent = { 
            backgroundColor: '#F5F5F5', // Different Very light grey
            borderColor: '#E0E0E0', 
            textColor: '#6C757D' 
        };

        // Dark mode overrides for event text colors if needed for contrast
        // This example assumes default text colors provide enough contrast or FullCalendar handles it.
        // If not, you'd add: if (document.body.classList.contains('dark-mode')) { ... }
        // For simplicity, keeping text colors consistent for now based on background.

        if (due < today) {
            return { text: "منتهي", classForTable: "status-past", isPast: true, isNear: false, eventColors: pastEvent };
        } else if (due.getTime() === today.getTime()) {
            return { text: "مستحق اليوم", classForTable: "status-due", isPast: false, isNear: true, eventColors: dueTodayEvent };
        } else if (due > today && due <= threeDaysLater) {
            return { text: "قادم قريباً", classForTable: "status-upcoming", isPast: false, isNear: true, eventColors: upcomingEvent };
        } else {
            return { text: "قادم", classForTable: "status-future", isPast: false, isNear: false, eventColors: futureEvent };
        }
    }

    function createMailtoLink(reportTitle) { /* ... unchanged ... */ }
    function createCharts(dataForCharts) { /* ... unchanged ... */ }
    function populateTable(reportsToShow) { /* ... unchanged (uses statusInfo.classForTable) ... */ }
    function updateKPIs(currentBaseFilteredData, currentDateRangeFilteredData) { /* ... unchanged ... */ }
    function displayPagination(totalRows) { /* ... unchanged ... */ }
    function renderCurrentPage() { /* ... unchanged ... */ }
    function populateFilter(data) { /* ... unchanged ... */ }
    async function fetchData() { /* ... unchanged ... */ }
    function handleFilterAndSearch() { /* ... unchanged ... */ }
    function resetDateFilter() { /* ... unchanged ... */ }
    function toggleTheme() { /* ... unchanged ... */ }
    function loadTheme() { /* ... unchanged ... */ }

    // --- FullCalendar Initialization ---
    function initializeCalendar() {
        if (calendarInitialized || !calendarEl) return;

        const searchTerm = searchInput.value.toLowerCase();
        const selectedDept = departmentFilter.value;
        const calendarData = allReportsData.filter(report => {
            const matchesSearch = report[1].toLowerCase().includes(searchTerm) || 
                                  report[2].toLowerCase().includes(searchTerm);
            const matchesDept = (selectedDept === 'all') || (report[1] === selectedDept);
            return matchesSearch && matchesDept;
        });

        const calendarEvents = calendarData.map(report => {
            const statusInfo = getStatus(report[4]); // Get status and new event colors
            return {
                id: report[0],
                title: report[2],
                start: report[4], 
                allDay: true,
                backgroundColor: statusInfo.eventColors.backgroundColor,
                borderColor: statusInfo.eventColors.borderColor,
                textColor: statusInfo.eventColors.textColor,
                // className: statusInfo.eventColors.className, // Optional: use classes if preferred for styling
                extendedProps: {
                    department: report[1],
                    frequency: report[3],
                    statusText: statusInfo.text 
                }
            };
        });

        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            locale: 'ar', 
            headerToolbar: { right: 'prev,next today', center: 'title', left: 'dayGridMonth,timeGridWeek,listWeek' },
            initialView: 'dayGridMonth',
            events: calendarEvents,
            eventDisplay: 'block', 
            eventTextColor: function(eventInfo){ // Ensure text color is applied if specified
                return eventInfo.event.textColor;
            },
            eventDidMount: function(info) {
                // If specific classes were added to eventColors, they can be applied here too.
                // For example: info.el.classList.add(info.event.extendedProps.className);
            },
            eventClick: function(info) {
                const props = info.event.extendedProps;
                modalTitle.textContent = info.event.title;
                modalDepartment.textContent = props.department;
                modalDate.textContent = info.event.startStr; 
                modalFrequency.textContent = props.frequency;
                modalStatus.textContent = props.statusText; 
                modalEmailLink.href = createMailtoLink(info.event.title);
                eventModal.style.display = "block";
            },
        });

        calendarInstance.render();
        calendarInitialized = true;
    }

    function destroyCalendar() { /* ... unchanged ... */ }
    
    // --- Modal Logic ---
    closeModalButton.onclick = function() { eventModal.style.display = "none"; }
    window.onclick = function(event) { if (event.target == eventModal) eventModal.style.display = "none"; }

    function handleNavigation(event) { /* ... unchanged ... */ }

    // Event Listeners
    searchInput.addEventListener('input', handleFilterAndSearch);
    departmentFilter.addEventListener('change', handleFilterAndSearch);
    startDateInput.addEventListener('change', handleFilterAndSearch);
    endDateInput.addEventListener('change', handleFilterAndSearch);
    resetDateBtn.addEventListener('click', resetDateFilter);
    themeSwitcherBtn.addEventListener('click', toggleTheme);
    navLinks.forEach(link => link.addEventListener('click', handleNavigation));

    // Initial Setup
    loadTheme();
    fetchData();

});