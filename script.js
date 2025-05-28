document.addEventListener('DOMContentLoaded', () => {
    console.log("SCRIPT.JS LOADED AND DOMCONTENTLOADED FIRED! Current Time:", new Date().toLocaleTimeString());

    // --- DOM Elements ---
    const tableBody = document.getElementById('reports-table-body');
    const searchInput = document.getElementById('search-input');
    // Theme switcher elements removed
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

    // --- Settings & State ---
    const dataUrl = 'data.json';
    const targetEmail = 'shamdan@aur.com.sa';
    const systemBaseDate = new Date('2025-05-27T00:00:00'); 
    let allReportsData = []; 
    let baseFilteredDataForKPIsAndCharts = []; 
    let dateRangeAndOtherFilteredData = []; 
    let currentPage = 1;
    const rowsPerPage = 15; 
    let departmentChartInstance = null;
    let frequencyChartInstance = null; 
    let chartsDrawn = false;
    let calendarInstance = null; 
    let calendarInitialized = false;

    const today = new Date(new Date(systemBaseDate).setHours(0, 0, 0, 0));
    const threeDaysLater = new Date(new Date(systemBaseDate).setHours(0, 0, 0, 0));
    threeDaysLater.setDate(today.getDate() + 3);

    console.log("Date context: 'today' is set to", today.toISOString().split('T')[0]);

    function getThemeColor(cssVarName, fallbackColor) { /* ... unchanged ... */ }
    function getStatus(dueDateStr) { /* ... unchanged ... */ }
    function createMailtoLink(reportTitle) { /* ... unchanged ... */ }
    function createCharts(dataForCharts) { /* ... unchanged ... */ }
    function populateTable(reportsToShow) { /* ... unchanged ... */ }
    function updateKPIs(currentBaseFilteredData, currentDateRangeFilteredData) { /* ... unchanged ... */ }
    function displayPagination(totalRows) { /* ... unchanged ... */ }
    function populateFilter(data) { /* ... unchanged ... */ }
    function renderCurrentPage() { /* ... unchanged ... */ }
    
    async function fetchData() {
        console.log("fetchData: Initiating...");
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="7">جاري تحميل البيانات...</td></tr>';
        } else {
            console.error("fetchData: tableBody is NULL at start, cannot set loading message.");
        }

        try {
            const response = await fetch(dataUrl);
            console.log("fetchData: Response received. Status:", response.status, "Ok:", response.ok);
            if (!response.ok) {
                console.error("fetchData: Network error! Status:", response.status, response.statusText);
                if (tableBody) tableBody.innerHTML = `<tr><td colspan="7">فشل تحميل البيانات (خطأ شبكة: ${response.status}).</td></tr>`;
                updateKPIs([], []); 
                return; 
            }
            allReportsData = await response.json();
            console.log("fetchData: Data parsed successfully. Type:", typeof allReportsData, "Is Array:", Array.isArray(allReportsData), "Length:", allReportsData ? allReportsData.length : 'N/A'); 
            // console.log("fetchData: Sample of first 2 reports:", JSON.stringify(allReportsData.slice(0,2)));
            
            if (Array.isArray(allReportsData) && allReportsData.length > 0) {
                console.log("fetchData: Data is valid. Populating filter and rendering initial page.");
                if(departmentFilter) { populateFilter(allReportsData); } else { console.error("fetchData: departmentFilter is NULL."); }
                renderCurrentPage(); 
                console.log("fetchData: Initial page render process complete.");
            } else {
                console.warn("fetchData: Data is empty or not an array after parsing.");
                if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">لا توجد بيانات لعرضها (البيانات فارغة أو غير صحيحة).</td></tr>';
                updateKPIs([], []); 
            }
        } catch (error) {
            console.error('fetchData: CRITICAL ERROR during fetch or JSON parsing:', error);
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="7">خطأ فادح في تحميل أو معالجة البيانات: ${error.message}</td></tr>`;
            updateKPIs([], []);
        }
    }

    function handleFilterAndSearch() { /* ... unchanged ... */ }
    function resetDateFilter() { /* ... unchanged ... */ }
    // Theme functions removed
    function initializeCalendar() { /* ... unchanged ... */ }
    function destroyCalendar() { /* ... unchanged ... */ }
    
    if(closeModalButton) closeModalButton.onclick = function() { if(eventModal) eventModal.style.display = "none"; }
    if(eventModal) window.onclick = function(event) { if (eventModal && event.target == eventModal) eventModal.style.display = "none"; }

    function handleNavigation(event) {
        event.preventDefault();
        console.log("--- handleNavigation START --- Target:", event.target.closest('li[data-view]'));
        const clickedLi = event.target.closest('li[data-view]');
        
        if (!clickedLi) {
            console.log("handleNavigation: No valid LI clicked.");
            return;
        }
        // Allow re-click for calendar/analytics to refresh IF data is loaded
        if (clickedLi.classList.contains('active') && 
            clickedLi.dataset.view !== 'calendar' && 
            clickedLi.dataset.view !== 'analytics') { 
            console.log("handleNavigation: Clicked LI is already active and not calendar/analytics.");
            return;
        }
        
        const viewId = clickedLi.dataset.view;
        console.log("handleNavigation: Navigating to viewId:", viewId);

        if(navLinks) navLinks.forEach(link => link.classList.remove('active'));
        if(views) views.forEach(view => view.classList.remove('active-view'));
        
        if(clickedLi) clickedLi.classList.add('active');
        const targetView = document.getElementById(`${viewId}-section`);
        if (targetView) {
            targetView.classList.add('active-view');
            console.log("handleNavigation: View activated:", viewId);
        } else { 
            console.error("handleNavigation: Target view element not found for ID:", `${viewId}-section`);
            return; 
        }
        
        // Ensure allReportsData is populated before trying to create charts or calendar
        if (!allReportsData || allReportsData.length === 0) {
            console.warn(`handleNavigation: allReportsData is empty. Cannot populate ${viewId} view yet.`);
            if (viewId === 'calendar' && calendarEl) {
                calendarEl.innerHTML = "<p style='text-align:center; padding:20px;'>البيانات الأساسية غير متوفرة بعد.</p>";
            }
            // Similarly for analytics if canvases are directly manipulated before data
            return;
        }

        if (viewId === 'analytics') {
            console.log("handleNavigation: Analytics tab processing.");
            const currentSearchTerm = searchInput ? searchInput.value.toLowerCase() : "";
            const currentSelectedDept = departmentFilter ? departmentFilter.value : "all";
            const chartData = allReportsData.filter(report => { 
                if (!report || !Array.isArray(report) || report.length < 3) return false;
                const matchesSearch = (report[1] && String(report[1]).toLowerCase().includes(currentSearchTerm)) || 
                                    (report[2] && String(report[2]).toLowerCase().includes(currentSearchTerm));
                const matchesDept = (currentSelectedDept === 'all') || (report[1] === currentSelectedDept);
                return matchesSearch && matchesDept;
            });
            createCharts(chartData); 
        }

        if (viewId === 'calendar') {
            console.log("handleNavigation: Calendar tab processing.");
            initializeCalendar(); 
        }
        console.log("--- handleNavigation END for view:", viewId, "---");
    }

    // Event Listeners
    console.log("Attaching event listeners...");
    if(searchInput) searchInput.addEventListener('input', handleFilterAndSearch);
    if(departmentFilter) departmentFilter.addEventListener('change', handleFilterAndSearch);
    if(startDateInput) startDateInput.addEventListener('change', handleFilterAndSearch);
    if(endDateInput) endDateInput.addEventListener('change', handleFilterAndSearch);
    if(resetDateBtn) resetDateBtn.addEventListener('click', resetDateFilter);
    // Removed themeSwitcherBtn listener
    if(navLinks && navLinks.length > 0) {
        navLinks.forEach((link) => { if (link) link.addEventListener('click', handleNavigation); });
        console.log(`${navLinks.length} navigation listeners attached.`);
    } else { console.warn("No navLinks found for attaching listeners."); }

    // Initial Setup
    console.log("Initial Setup: About to call fetchData(). Current Time:", new Date().toLocaleTimeString());
    try {
        fetchData(); // This is an async function
        console.log("Initial Setup: fetchData() has been called. Any further console logs from fetchData will appear above if it runs correctly.");
    } catch(e) {
        console.error("Initial Setup: Error directly calling fetchData():", e);
    }
    console.log("Initial Setup: Script execution finished (DOMContentLoaded complete).");

});