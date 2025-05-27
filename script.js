document.addEventListener('DOMContentLoaded', () => {
    console.log("SCRIPT.JS LOADED AND DOMCONTENTLOADED FIRED! Current Time:", new Date().toLocaleTimeString());

    // --- DOM Elements ---
    const tableBody = document.getElementById('reports-table-body');
    const searchInput = document.getElementById('search-input');
    const themeSwitcherBtn = document.getElementById('theme-switcher-btn');
    const themeIcon = themeSwitcherBtn ? themeSwitcherBtn.querySelector('i') : null;
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
    const modalTitle = eventModal ? document.getElementById('modal-title') : null;
    const modalDepartment = eventModal ? document.getElementById('modal-department') : null;
    const modalDate = eventModal ? document.getElementById('modal-date') : null;
    const modalFrequency = eventModal ? document.getElementById('modal-frequency') : null;
    const modalStatus = eventModal ? document.getElementById('modal-status') : null;
    const modalEmailLink = eventModal ? document.getElementById('modal-email-link') : null;
    const closeModalButton = eventModal ? eventModal.querySelector('.close-button') : null;

    console.log("DOM Elements Selection Check (Post-Full Init):", {
        tableBodyExists: !!tableBody,
        searchInputExists: !!searchInput,
        themeSwitcherBtnExists: !!themeSwitcherBtn,
        navLinksCount: navLinks ? navLinks.length : 0,
        viewsCount: views ? views.length : 0,
        kpiTotalReportsExists: !!kpiTotalReports,
        kpiDueInPeriodExists: !!kpiDueInPeriod, // Check for new KPI
        calendarElExists: !!calendarEl,
        eventModalExists: !!eventModal 
    });

    // --- Settings & State ---
    const dataUrl = 'data.json';
    const targetEmail = 'shamdan@aur.com.sa';
    const systemBaseDate = new Date('2025-05-27T00:00:00'); 
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
    console.log("Calculated 'today':", today.toISOString(), "'threeDaysLater':", threeDaysLater.toISOString());

    function getThemeColor(cssVarName, fallbackColor) { /* ... unchanged ... */ }
    function getStatus(dueDateStr) { /* ... unchanged ... */ }
    function createMailtoLink(reportTitle) { /* ... unchanged ... */ }
    function createCharts(dataForCharts) { /* ... unchanged with its console.logs ... */ }
    function populateTable(reportsToShow) { /* ... unchanged with its console.logs ... */ }

    function updateKPIs(currentBaseFilteredData, currentDateRangeFilteredData) {
        console.log("updateKPIs called. Base Data Length:", currentBaseFilteredData ? currentBaseFilteredData.length : 'N/A', 
                    "Date Range Data Length:", currentDateRangeFilteredData ? currentDateRangeFilteredData.length : 'N/A');

        if (!kpiTotalReports || !kpiDueInPeriod || !kpiDueToday || !kpiDue3Days || !kpiPastTotal) {
            console.error("One or more KPI DOM elements are missing for updateKPIs!");
            if(kpiTotalReports) kpiTotalReports.textContent = '-';
            if(kpiDueInPeriod) kpiDueInPeriod.textContent = '-';
            if(kpiDueToday) kpiDueToday.textContent = '-';
            if(kpiDue3Days) kpiDue3Days.textContent = '-';
            if(kpiPastTotal) kpiPastTotal.textContent = '-';
            return;
        }
        
        kpiTotalReports.textContent = currentBaseFilteredData ? currentBaseFilteredData.length : '0';

        if (startDateInput && endDateInput && startDateInput.value && endDateInput.value) {
            kpiDueInPeriod.textContent = currentDateRangeFilteredData ? currentDateRangeFilteredData.length : '0';
        } else {
            kpiDueInPeriod.textContent = '-';
        }

        let dueTodayCount = 0;
        let due3DaysOnlyCount = 0; 
        if (currentDateRangeFilteredData) {
            currentDateRangeFilteredData.forEach(report => {
                if (!report || report.length < 5) return;
                const statusInfo = getStatus(report[4]); 
                if (statusInfo && statusInfo.classForTable === 'status-due') dueTodayCount++;
                if (statusInfo && statusInfo.classForTable === 'status-upcoming') due3DaysOnlyCount++;
            });
        }
        kpiDueToday.textContent = dueTodayCount;
        kpiDue3Days.textContent = due3DaysOnlyCount + dueTodayCount; 

        let pastTotalCount = 0;
        if (currentBaseFilteredData) {
            currentBaseFilteredData.forEach(report => {
                if (!report || report.length < 5) return;
                const statusInfo = getStatus(report[4]);
                if (statusInfo && statusInfo.isPast) pastTotalCount++;
            });
        }
        kpiPastTotal.textContent = pastTotalCount;
        
        let nearNotificationCount = 0;
        if (currentBaseFilteredData) {
            currentBaseFilteredData.forEach(report => {
                 if (!report || report.length < 5) return;
                const statusInfo = getStatus(report[4]);
                if (statusInfo && statusInfo.isNear) nearNotificationCount++;
            });
        }
        if (notificationDot) {
            notificationDot.classList.toggle('hidden', nearNotificationCount === 0);
        } else {
            console.warn("Notification dot element not found for KPIs update.");
        }
        console.log("KPIs updated. TotalR:", kpiTotalReports.textContent, "DuePeriod:", kpiDueInPeriod.textContent, "DueToday:", kpiDueToday.textContent, "Due3Days:", kpiDue3Days.textContent, "PastTotal:", kpiPastTotal.textContent);
    }

    function displayPagination(totalRows) { /* ... unchanged with its console.logs ... */ }
    function renderCurrentPage() { /* ... unchanged with its console.logs ... */ }
    function populateFilter(data) { /* ... unchanged ... */ }

    async function fetchData() {
        console.log("1. fetchData called");
        try {
            const response = await fetch(dataUrl);
            console.log("2. Fetch response status:", response.status, ". Is response ok?", response.ok);
            if (!response.ok) {
                console.error("Network response was not ok for data.json. Status:", response.status, response.statusText);
                if (tableBody) tableBody.innerHTML = `<tr><td colspan="7">فشل تحميل البيانات. الحالة: ${response.status}. تأكد من وجود ملف data.json في المسار الصحيح.</td></tr>`;
                updateKPIs([], []); 
                return; 
            }
            allReportsData = await response.json();
            console.log("3. Data fetched and parsed. Total reports:", allReportsData ? allReportsData.length : 'undefined/null'); 
            
            if (Array.isArray(allReportsData) && allReportsData.length > 0) {
                if(departmentFilter) populateFilter(allReportsData); 
                renderCurrentPage(); 
                console.log("4. Initial render triggered after data fetch.");
            } else {
                console.warn("No data received, data array is empty, or data is not an array after parsing.");
                if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">تم تحميل البيانات ولكنها فارغة أو بتنسيق غير صحيح.</td></tr>';
                updateKPIs([], []); 
            }
        } catch (error) {
            console.error('Fetch Error in fetchData:', error);
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="7">فشل تحميل البيانات (خطأ في الشبكة أو تحليل JSON): ${error.message}</td></tr>`;
            updateKPIs([], []);
        }
    }

    function handleFilterAndSearch() { /* ... unchanged with its console.logs ... */ }
    function resetDateFilter() { /* ... unchanged ... */ }
    function toggleTheme() { /* ... unchanged ... */ }
    function loadTheme() { /* ... unchanged ... */ }
    function initializeCalendar() { /* ... unchanged with its console.logs ... */ }
    function destroyCalendar() { /* ... unchanged ... */ }
    
    if(closeModalButton) closeModalButton.onclick = function() { eventModal.style.display = "none"; }
    if(eventModal) window.onclick = function(event) { if (eventModal && event.target == eventModal) eventModal.style.display = "none"; }

    function handleNavigation(event) {
        event.preventDefault();
        console.log("--- handleNavigation Start --- Event Target:", event.target);
        const clickedLi = event.target.closest('li[data-view]');
        
        if (!clickedLi) {
            console.log("Navigation ignored: clicked target is not an li with data-view or child of it. Clicked:", event.target);
            console.log("--- handleNavigation End (No valid li) ---");
            return;
        }
        console.log("Clicked li element:", clickedLi, "Current active status:", clickedLi.classList.contains('active'));

        if (clickedLi.classList.contains('active')) {
            console.log("Navigation ignored: clicked li is already active.");
            console.log("--- handleNavigation End (Already Active) ---");
            return;
        }

        const viewId = clickedLi.dataset.view;
        console.log("Navigating to viewId:", viewId);

        if(navLinks) navLinks.forEach(link => link.classList.remove('active'));
        if(views) views.forEach(view => view.classList.remove('active-view'));
        
        clickedLi.classList.add('active');
        const targetView = document.getElementById(`${viewId}-section`);
        if (targetView) {
            targetView.classList.add('active-view');
            console.log("View activated:", viewId, "Element:", targetView);
        } else {
            console.error("Target view not found for ID:", `${viewId}-section`);
            console.log("--- handleNavigation End (Error View Not Found) ---");
            return; 
        }
        
        if (viewId === 'analytics') {
            console.log("Analytics tab processing. Charts drawn previously:", chartsDrawn);
            const currentSearchTerm = searchInput ? searchInput.value.toLowerCase() : "";
            const currentSelectedDept = departmentFilter ? departmentFilter.value : "all";
            const chartData = allReportsData.filter(report => { 
                if (!report || !Array.isArray(report) || report.length < 3) return false;
                const matchesSearch = report[1].toLowerCase().includes(currentSearchTerm) || 
                                    report[2].toLowerCase().includes(currentSearchTerm);
                const matchesDept = (currentSelectedDept === 'all') || (report[1] === currentSelectedDept);
                return matchesSearch && matchesDept;
            });
            console.log("Data for analytics charts:", chartData.length);
            createCharts(chartData); 
        }

        if (viewId === 'calendar') {
            console.log("Calendar tab processing.");
            initializeCalendar(); 
        }
        console.log("--- handleNavigation End (Success) ---");
    }

    // Event Listeners (with null checks for robustness)
    console.log("Attaching event listeners...");
    if(searchInput) searchInput.addEventListener('input', handleFilterAndSearch);
    console.log("Search input listener attached:", !!searchInput);

    if(departmentFilter) departmentFilter.addEventListener('change', handleFilterAndSearch);
    console.log("Department filter listener attached:", !!departmentFilter);

    if(startDateInput) startDateInput.addEventListener('change', handleFilterAndSearch);
    console.log("Start date listener attached:", !!startDateInput);

    if(endDateInput) endDateInput.addEventListener('change', handleFilterAndSearch);
    console.log("End date listener attached:", !!endDateInput);

    if(resetDateBtn) resetDateBtn.addEventListener('click', resetDateFilter);
    console.log("Reset date listener attached:", !!resetDateBtn);
    
    if(themeSwitcherBtn) themeSwitcherBtn.addEventListener('click', toggleTheme);
    console.log("Theme switcher listener attached:", !!themeSwitcherBtn);

    if(navLinks && navLinks.length > 0) {
        navLinks.forEach((link, index) => {
            if (link) {
                link.addEventListener('click', handleNavigation);
                // console.log(`Navigation listener attached to link ${index + 1}:`, link); // This can be very verbose
            } else {
                console.warn(`NavLink at index ${index} is null.`);
            }
        });
        console.log(`${navLinks.length} navigation listeners attached.`);
    } else {
        console.warn("No navLinks found to attach listeners.");
    }


    // Initial Setup
    console.log("Running initial setup: loadTheme and fetchData");
    loadTheme();
    fetchData();

});
