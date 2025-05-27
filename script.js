document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed");

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

    console.log("DOM Elements selected:", { tableBody, searchInput, kpiTotalReports, calendarEl });


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
        try {
            const color = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
            return color || fallbackColor;
        } catch (e) {
            console.warn(`Could not get theme color for ${cssVarName}, using fallback ${fallbackColor}`, e);
            return fallbackColor;
        }
    }

    // --- Functions ---
    function getStatus(dueDateStr) {
        const due = new Date(new Date(dueDateStr).setHours(0, 0, 0, 0));
        
        const pastEvent = { backgroundColor: '#E9ECEF', borderColor: '#D0D0D0', textColor: '#6C757D' };
        const dueTodayEvent = { backgroundColor: getThemeColor('--accent-gold-muted', '#bd9a5f'), borderColor: getThemeColor('--accent-gold-muted', '#bd9a5f'), textColor: '#FFFFFF' };
        const upcomingEvent = { backgroundColor: getThemeColor('--accent-blue', '#AEC6CF'), borderColor: getThemeColor('--accent-blue', '#AEC6CF'), textColor: getThemeColor('--primary-dark-light', '#2C3E50') };
        const futureEvent = { backgroundColor: getThemeColor('--accent-green', '#F5F5F5'), borderColor: getThemeColor('--accent-green', '#F5F5F5'), textColor: '#6C757D' };

        if (due < today) return { text: "منتهي", classForTable: "status-past", isPast: true, isNear: false, eventColors: pastEvent };
        if (due.getTime() === today.getTime()) return { text: "مستحق اليوم", classForTable: "status-due", isPast: false, isNear: true, eventColors: dueTodayEvent };
        if (due > today && due <= threeDaysLater) return { text: "قادم قريباً", classForTable: "status-upcoming", isPast: false, isNear: true, eventColors: upcomingEvent };
        return { text: "قادم", classForTable: "status-future", isPast: false, isNear: false, eventColors: futureEvent };
    }

    function createMailtoLink(reportTitle) { /* ... unchanged ... */ }
    
    function createCharts(dataForCharts) {
        console.log("createCharts called with data length:", dataForCharts ? dataForCharts.length : 'null');
        if (!dataForCharts || dataForCharts.length === 0 || !departmentChartCanvasEl || !frequencyChartCanvasEl) {
             console.warn("Chart creation skipped: no data or canvas not found.", {dataForCharts, departmentChartCanvasEl, frequencyChartCanvasEl});
             if(departmentChartInstance) departmentChartInstance.destroy();
             if(frequencyChartInstance) frequencyChartInstance.destroy();
             chartsDrawn = false; 
            return;
        }
        // ... (rest of createCharts is unchanged from previous full code response)
        const deptCtx = departmentChartCanvasEl.getContext('2d');
        const freqCtx = frequencyChartCanvasEl.getContext('2d');

        const deptCounts = dataForCharts.reduce((acc, report) => { acc[report[1]] = (acc[report[1]] || 0) + 1; return acc; }, {});
        const freqCounts = dataForCharts.reduce((acc, report) => { acc[report[3]] = (acc[report[3]] || 0) + 1; return acc; }, {});
        
        const goldColor = getThemeColor('--accent-gold', '#C89638'); 
        const blueColor = getThemeColor('--accent-blue', '#3498DB'); // Reverted to standard blue for pie
        const primaryDarkColor = getThemeColor('--primary-dark-light', '#2C3E50');
        const mutedGoldColor = getThemeColor('--accent-gold-muted', '#bd9a5f');
        const greyColor = getThemeColor('--past-due-color', '#95A5A6');
        const redColor = getThemeColor('--accent-red', '#E74C3C');
        const chartPieColors = [goldColor, blueColor, primaryDarkColor, mutedGoldColor, greyColor, redColor];

        if(departmentChartInstance) departmentChartInstance.destroy();
        if(frequencyChartInstance) frequencyChartInstance.destroy();

        departmentChartInstance = new Chart(deptCtx, { 
            type: 'pie', 
            data: { labels: Object.keys(deptCounts), datasets: [{ data: Object.values(deptCounts), backgroundColor: chartPieColors }] }, 
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } } 
        });

        frequencyChartInstance = new Chart(freqCtx, { 
            type: 'bar', 
            data: { labels: Object.keys(freqCounts), datasets: [{ label: 'عدد التقارير', data: Object.values(freqCounts), backgroundColor: goldColor }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } 
        });
        chartsDrawn = true;
        console.log("Charts created/updated.");
    }
    
    function populateTable(reportsToShow) {
        // console.log("populateTable called with reports:", reportsToShow.length);
        tableBody.innerHTML = '';
        if (reportsToShow.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7">لا توجد تقارير تطابق البحث أو التصفية.</td></tr>';
            return;
        }
        // ... (rest of populateTable is unchanged)
        reportsToShow.forEach(report => {
            const [id, department, title, frequency, dateString] = report;
            const statusInfo = getStatus(dateString); 
            const row = document.createElement('tr');
            if (statusInfo.isPast) row.classList.add('past-due');
            row.innerHTML = `
                <td>${id}</td>
                <td>${department}</td>
                <td>${title}</td>
                <td>${frequency}</td>
                <td>${dateString}</td>
                <td><span class="status-tag ${statusInfo.classForTable}">${statusInfo.text}</span></td>
                <td><a href="${createMailtoLink(title)}" class="icon-button" title="إرسال بريد"><i class="fas fa-envelope"></i></a></td>
            `;
            tableBody.appendChild(row);
        });
    }

    function updateKPIs(currentBaseFilteredData, currentDateRangeFilteredData) { /* ... unchanged ... */ }
    function displayPagination(totalRows) { /* ... unchanged ... */ }
    
    function renderCurrentPage() {
        console.log("--- renderCurrentPage Start ---");
        console.log("Current Page for table:", currentPage);
        // ... (rest of renderCurrentPage is unchanged from previous full code response)
        const searchTerm = searchInput.value.toLowerCase();
        const selectedDept = departmentFilter.value;
        const startDateValue = startDateInput.value;
        const endDateValue = endDateInput.value;

        let startDate = null;
        if (startDateValue) {
            startDate = new Date(startDateValue);
            startDate.setHours(0, 0, 0, 0);
        }
        let endDate = null;
        if (endDateValue) {
            endDate = new Date(endDateValue);
            endDate.setHours(23, 59, 59, 999);
        }
        console.log("Filters - Search:", searchTerm, "Dept:", selectedDept, "Start:", startDate, "End:", endDate);
        
        baseFilteredData = allReportsData.filter(report => {
            const matchesSearch = report[1].toLowerCase().includes(searchTerm) || 
                                  report[2].toLowerCase().includes(searchTerm);
            const matchesDept = (selectedDept === 'all') || (report[1] === selectedDept);
            return matchesSearch && matchesDept;
        });
        console.log("Base filtered data count:", baseFilteredData.length);

        dateRangeFilteredData = baseFilteredData.filter(report => {
            const reportDate = new Date(report[4]);
            reportDate.setHours(0,0,0,0); 
            const matchesStartDate = !startDate || reportDate >= startDate;
            const matchesEndDate = !endDate || reportDate <= endDate;
            return matchesStartDate && matchesEndDate;
        });
        console.log("Date range filtered data count:", dateRangeFilteredData.length);

        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const reportsToShow = dateRangeFilteredData.slice(startIndex, endIndex);
        console.log("Reports to show on this page (after slice):", reportsToShow.length);

        populateTable(reportsToShow);
        displayPagination(dateRangeFilteredData.length);
        updateKPIs(baseFilteredData, dateRangeFilteredData); 
        console.log("--- renderCurrentPage End ---");
    }
    
    function populateFilter(data) { /* ... unchanged ... */ }

    async function fetchData() {
        console.log("1. fetchData called");
        try {
            const response = await fetch(dataUrl);
            console.log("2. Fetch response status:", response.status, response.ok);
            if (!response.ok) {
                console.error("Network response was not ok for data.json", response);
                tableBody.innerHTML = `<tr><td colspan="7">فشل تحميل البيانات. الحالة: ${response.status}</td></tr>`;
                throw new Error(`Network error: ${response.statusText}`);
            }
            allReportsData = await response.json();
            console.log("3. Data fetched and parsed:", allReportsData.length, "reports"); 
            
            if (allReportsData.length > 0) {
                populateFilter(allReportsData); 
                renderCurrentPage(); 
                console.log("4. Initial render triggered after data fetch.");
            } else {
                console.warn("No data received or data array is empty.");
                tableBody.innerHTML = '<tr><td colspan="7">تم تحميل البيانات ولكنها فارغة.</td></tr>';
            }
        } catch (error) {
            console.error('Fetch Error in fetchData:', error);
            tableBody.innerHTML = `<tr><td colspan="7">فشل تحميل البيانات: ${error.message}</td></tr>`;
        }
    }

    function handleFilterAndSearch() {
        console.log("handleFilterAndSearch called");
        currentPage = 1; 
        renderCurrentPage();
    }

    function resetDateFilter() { /* ... unchanged ... */ }
    function toggleTheme() { /* ... unchanged ... */ }
    function loadTheme() { /* ... unchanged ... */ }

    function initializeCalendar() {
        console.log("initializeCalendar called. Initialized previously:", calendarInitialized);
        if (!calendarEl) {
            console.error("Calendar placeholder element not found!");
            return;
        }
        // if (calendarInitialized) return; // Let's re-init to update data

        const searchTerm = searchInput.value.toLowerCase();
        const selectedDept = departmentFilter.value;
        const calendarData = allReportsData.filter(report => {
            const matchesSearch = report[1].toLowerCase().includes(searchTerm) || 
                                  report[2].toLowerCase().includes(searchTerm);
            const matchesDept = (selectedDept === 'all') || (report[1] === selectedDept);
            return matchesSearch && matchesDept;
        });
        console.log("Data for calendar:", calendarData.length);

        const calendarEvents = calendarData.map(report => {
            const statusInfo = getStatus(report[4]);
            return {
                id: report[0], title: report[2], start: report[4], allDay: true,
                backgroundColor: statusInfo.eventColors.backgroundColor,
                borderColor: statusInfo.eventColors.borderColor,
                textColor: statusInfo.eventColors.textColor,
                extendedProps: { department: report[1], frequency: report[3], statusText: statusInfo.text }
            };
        });

        if (calendarInstance) calendarInstance.destroy();

        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            locale: 'ar', 
            headerToolbar: { right: 'prev,next today', center: 'title', left: 'dayGridMonth,timeGridWeek,listWeek' },
            initialView: 'dayGridMonth',
            events: calendarEvents,
            eventDisplay: 'block', 
            eventTextColor: function(eventInfo){ return eventInfo.event.textColor; },
            eventDidMount: function(info) {
                info.el.style.setProperty('background-color', info.event.backgroundColor, 'important');
                info.el.style.setProperty('border-color', info.event.borderColor, 'important');
            },
            eventClick: function(info) { /* ... unchanged ... */ }
        });

        calendarInstance.render();
        calendarInitialized = true; 
        console.log("Calendar rendered/updated.");
    }

    function destroyCalendar() { /* ... unchanged ... */ }
    
    closeModalButton.onclick = function() { eventModal.style.display = "none"; }
    window.onclick = function(event) { if (event.target == eventModal) eventModal.style.display = "none"; }

    function handleNavigation(event) {
        event.preventDefault();
        console.log("--- handleNavigation Start ---");
        const clickedLi = event.target.closest('li');
        if (!clickedLi) {
            console.log("Navigation ignored: clicked target is not an li or child of li");
            return;
        }
        if (clickedLi.classList.contains('active')) {
            console.log("Navigation ignored: clicked li is already active");
            return;
        }

        const viewId = clickedLi.dataset.view;
        console.log("Navigating to viewId:", viewId);

        navLinks.forEach(link => link.classList.remove('active'));
        views.forEach(view => view.classList.remove('active-view'));
        
        clickedLi.classList.add('active');
        const targetView = document.getElementById(`${viewId}-section`);
        if (targetView) {
            targetView.classList.add('active-view');
            console.log("View activated:", viewId);
        } else {
            console.error("Target view not found for ID:", `${viewId}-section`);
            console.log("--- handleNavigation End (Error) ---");
            return; // Exit if target view not found
        }
        
        if (viewId === 'analytics') {
            console.log("Analytics tab clicked. Charts drawn previously:", chartsDrawn);
            // if (!chartsDrawn) { // Always redraw charts for analytics based on current filters
                const currentSearchTerm = searchInput.value.toLowerCase();
                const currentSelectedDept = departmentFilter.value;
                const chartData = allReportsData.filter(report => { // Use allReportsData as base for charts
                    const matchesSearch = report[1].toLowerCase().includes(currentSearchTerm) || 
                                      report[2].toLowerCase().includes(currentSearchTerm);
                    const matchesDept = (currentSelectedDept === 'all') || (report[1] === currentSelectedDept);
                    return matchesSearch && matchesDept;
                });
                console.log("Data for analytics charts:", chartData.length);
                createCharts(chartData); 
            // }
        }

        if (viewId === 'calendar') {
            console.log("Calendar tab clicked.");
            initializeCalendar(); 
        }
        console.log("--- handleNavigation End ---");
    }

    // Event Listeners
    if (searchInput) searchInput.addEventListener('input', handleFilterAndSearch);
    if (departmentFilter) departmentFilter.addEventListener('change', handleFilterAndSearch);
    if (startDateInput) startDateInput.addEventListener('change', handleFilterAndSearch);
    if (endDateInput) endDateInput.addEventListener('change', handleFilterAndSearch);
    if (resetDateBtn) resetDateBtn.addEventListener('click', resetDateFilter);
    if (themeSwitcherBtn) themeSwitcherBtn.addEventListener('click', toggleTheme);
    if (navLinks) navLinks.forEach(link => link.addEventListener('click', handleNavigation));

    // Initial Setup
    console.log("Running initial setup: loadTheme and fetchData");
    loadTheme();
    fetchData();

});