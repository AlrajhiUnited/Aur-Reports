document.addEventListener('DOMContentLoaded', () => {
    console.log("SCRIPT.JS LOADED AND DOMCONTENTLOADED FIRED! Current Time:", new Date().toLocaleTimeString());

    // --- DOM Elements ---
    // ... (كما كانت، لا تغيير)
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
        kpiDueInPeriodExists: !!kpiDueInPeriod, 
        calendarElExists: !!calendarEl,
        eventModalExists: !!eventModal 
    });
    // --- Settings & State ---
    // ... (كما كانت، لا تغيير)
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
    // ... (كما كانت، لا تغيير)
    const today = new Date(new Date(systemBaseDate).setHours(0, 0, 0, 0));
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(today.getDate() + 3);
    console.log("Calculated 'today':", today.toISOString(), "'threeDaysLater':", threeDaysLater.toISOString());


    // --- Helper: Get computed style for colors ---
    function getThemeColor(cssVarName, fallbackColor) { /* ... unchanged ... */ }
    function getStatus(dueDateStr) { /* ... unchanged ... */ }
    function createMailtoLink(reportTitle) { /* ... unchanged ... */ }
    function createCharts(dataForCharts) { /* ... unchanged with its console.logs ... */ }
    function populateTable(reportsToShow) { /* ... unchanged with its console.logs ... */ }
    function updateKPIs(currentBaseFilteredData, currentDateRangeFilteredData) { /* ... unchanged with its console.logs ... */ }
    function displayPagination(totalRows) { /* ... unchanged with its console.logs ... */ }
    
    function populateFilter(data) {
        console.log("populateFilter called with data length:", data ? data.length : 'null');
        if (!departmentFilter) {
            console.error("populateFilter: departmentFilter element is null!");
            return;
        }
        if (!data || !Array.isArray(data)) {
            console.error("populateFilter: Invalid data provided.");
            return;
        }
        const departments = [...new Set(data.map(report => report[1]))]; 
        departments.sort((a, b) => a.localeCompare(b, 'ar')); 
        departmentFilter.innerHTML = '<option value="all">عرض الكل</option>'; // Clear and add default
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departmentFilter.appendChild(option);
        });
        console.log("Department filter populated with", departments.length, "unique departments.");
    }

    function renderCurrentPage() {
        console.log("--- renderCurrentPage Start --- Current Page:", currentPage);
        if (!allReportsData || allReportsData.length === 0) {
            console.warn("renderCurrentPage: allReportsData is empty or not loaded. Aborting render.");
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">لا توجد بيانات لعرضها حالياً.</td></tr>';
            updateKPIs([], []); // Ensure KPIs are cleared
            displayPagination(0); // Ensure pagination is cleared/hidden
            return;
        }

        const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
        const selectedDept = departmentFilter ? departmentFilter.value : "all";
        const startDateValue = startDateInput ? startDateInput.value : "";
        const endDateValue = endDateInput ? endDateInput.value : "";

        let startDate = null;
        if (startDateValue) {
            startDate = new Date(startDateValue);
            if (!isNaN(startDate.getTime())) startDate.setHours(0, 0, 0, 0); else startDate = null;
        }
        let endDate = null;
        if (endDateValue) {
            endDate = new Date(endDateValue);
            if (!isNaN(endDate.getTime())) endDate.setHours(23, 59, 59, 999); else endDate = null;
        }
        console.log("Filters - Search:", searchTerm, "Dept:", selectedDept, "Start:", startDate, "End:", endDate);
        
        baseFilteredData = allReportsData.filter(report => {
            if (!report || !Array.isArray(report) || report.length < 3) return false;
            const deptMatch = (selectedDept === 'all') || (report[1] === selectedDept);
            const searchMatch = report[1].toLowerCase().includes(searchTerm) || 
                                report[2].toLowerCase().includes(searchTerm);
            return deptMatch && searchMatch;
        });
        console.log("Base filtered data count (after search & dept):", baseFilteredData.length);

        dateRangeFilteredData = baseFilteredData.filter(report => {
            if (!report || !Array.isArray(report) || report.length < 5) return false;
            const reportDate = new Date(report[4]);
            if (isNaN(reportDate.getTime())) { 
                console.warn("Invalid date in report for date filter:", report);
                return false;
            }
            reportDate.setHours(0,0,0,0); 
            const matchesStartDate = !startDate || reportDate >= startDate;
            const matchesEndDate = !endDate || reportDate <= endDate;
            return matchesStartDate && matchesEndDate;
        });
        console.log("Date range filtered data count (final for table):", dateRangeFilteredData.length);

        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const reportsToShow = dateRangeFilteredData.slice(startIndex, endIndex);
        console.log("Reports to show on this page (after slice):", reportsToShow.length);

        populateTable(reportsToShow);
        displayPagination(dateRangeFilteredData.length);
        updateKPIs(baseFilteredData, dateRangeFilteredData); 
        console.log("--- renderCurrentPage End ---");
    }
    
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
            console.log("3. Data fetched and parsed. Type:", typeof allReportsData, "Is Array:", Array.isArray(allReportsData), "Total reports:", allReportsData ? allReportsData.length : 'undefined/null'); 
            
            if (Array.isArray(allReportsData) && allReportsData.length > 0) {
                console.log("Attempting to populate filter...");
                if(departmentFilter) {
                    populateFilter(allReportsData); 
                } else {
                    console.error("departmentFilter element is null, cannot populate.");
                }
                console.log("Attempting initial render...");
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
        console.log("Clicked li element:", clickedLi, "data-view:", clickedLi.dataset.view, "Current active status:", clickedLi.classList.contains('active'));

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
        const targetView = document.getElementById(`${viewId}-section`); // e.g., overview-section
        if (targetView) {
            targetView.classList.add('active-view');
            console.log("View activated:", viewId, "Element:", targetView);
        } else {
            console.error("Target view element not found for ID:", `${viewId}-section`);
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
            } else {
                console.warn(`NavLink at index ${index} is null.`);
            }
        });
        console.log(`${navLinks.length} navigation listeners attached.`);
    } else {
        console.warn("No navLinks found to attach listeners.");
    }

    // Initial Setup
    console.log("Running initial setup: loadTheme and fetchData. Current Time:", new Date().toLocaleTimeString());
    loadTheme();
    fetchData();

});
