document.addEventListener('DOMContentLoaded', () => {
    console.log("SCRIPT.JS LOADED AND DOMCONTENTLOADED FIRED! Current Time:", new Date().toLocaleTimeString());

    // --- DOM Elements ---
    const tableBody = document.getElementById('reports-table-body');
    const searchInput = document.getElementById('search-input');
    const themeSwitcherBtn = document.getElementById('theme-switcher-btn'); // Will be removed later
    const themeIcon = themeSwitcherBtn ? themeSwitcherBtn.querySelector('i') : null; // Will be removed later
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
    let baseFilteredDataForKPIsAndCharts = []; // For KPIs (total, past) and Charts (overview data)
    let dateRangeAndOtherFilteredData = []; // For table, and date-specific KPIs
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
    function displayPagination(totalRows) { /* ... unchanged ... */ }
    
    function populateFilter(data) {
        console.log("populateFilter: Called. Data length:", data ? data.length : 'undefined');
        if (!departmentFilter) { console.error("populateFilter: departmentFilter is NULL."); return; }
        if (!data || !Array.isArray(data)) { console.error("populateFilter: Invalid data."); return;}
        
        const currentFilterValue = departmentFilter.value; // Preserve current selection if any
        departmentFilter.innerHTML = '<option value="all">عرض الكل</option>';
        const departments = [...new Set(data.map(report => report[1]).filter(dept => dept))]; 
        departments.sort((a, b) => String(a).localeCompare(String(b), 'ar')); 
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            if (dept === currentFilterValue) { // Re-select if it was selected
                option.selected = true;
            }
            departmentFilter.appendChild(option);
        });
        console.log("populateFilter: Populated with", departments.length, "departments. Current value:", departmentFilter.value);
    }

    function updateKPIs(baseData, dateRangeData) { // Takes two data sets now
        console.log("updateKPIs: BaseData:", baseData.length, "DateRangeData:", dateRangeData.length);
        if (!kpiTotalReports || !kpiDueInPeriod || !kpiDueToday || !kpiDue3Days || !kpiPastTotal) {
            return;
        }
        
        kpiTotalReports.textContent = baseData ? baseData.length : '0';

        if (startDateInput && endDateInput && startDateInput.value && endDateInput.value) {
            kpiDueInPeriod.textContent = dateRangeData ? dateRangeData.length : '0';
        } else {
            kpiDueInPeriod.textContent = '-';
        }

        let dueTodayCount = 0, due3DaysOnlyCount = 0, pastTotalCount = 0, nearNotificationCount = 0;

        // KPIs like Due Today, Due in 3 Days should reflect the fully filtered view (including date range)
        if (dateRangeData) {
            dateRangeData.forEach(report => {
                if (!report || report.length < 5) return;
                const statusInfo = getStatus(report[4]); 
                if (statusInfo && statusInfo.classForTable === 'status-due') dueTodayCount++;
                if (statusInfo && statusInfo.classForTable === 'status-upcoming') due3DaysOnlyCount++;
            });
        }
        kpiDueToday.textContent = dueTodayCount;
        kpiDue3Days.textContent = due3DaysOnlyCount + dueTodayCount; 

        // Past Total KPI should be based on the base filter (search + department), not the date range
        if (baseData) {
            baseData.forEach(report => {
                if (!report || report.length < 5) return;
                const statusInfo = getStatus(report[4]);
                if (statusInfo && statusInfo.isPast) pastTotalCount++;
                if (statusInfo && statusInfo.isNear) nearNotificationCount++; // Notification still based on this broader set
            });
        }
        kpiPastTotal.textContent = pastTotalCount;
        if (notificationDot) notificationDot.classList.toggle('hidden', nearNotificationCount === 0);
        console.log("KPIs updated.");
    }
    
    function renderCurrentPage() {
        console.log("--- renderCurrentPage START --- Current Page:", currentPage);
        if (!allReportsData || !Array.isArray(allReportsData) || allReportsData.length === 0) {
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">البيانات الأساسية غير متوفرة.</td></tr>';
            updateKPIs([], []); 
            if (paginationControls) displayPagination(0); 
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
        
        // Step 1: Filter by Search and Department (for some KPIs and as base for date filter)
        baseFilteredDataForKPIsAndCharts = allReportsData.filter(report => {
            if (!report || !Array.isArray(report) || report.length < 3 || typeof report[1] !== 'string' || typeof report[2] !== 'string') return false;
            const deptMatch = (selectedDept === 'all') || (report[1] === selectedDept);
            const searchMatch = report[1].toLowerCase().includes(searchTerm) || 
                                report[2].toLowerCase().includes(searchTerm);
            return deptMatch && searchMatch;
        });
        console.log("renderCurrentPage: baseFilteredDataForKPIsAndCharts count:", baseFilteredDataForKPIsAndCharts.length);

        // Step 2: Filter by Date Range (applied to baseFilteredData)
        dateRangeAndOtherFilteredData = baseFilteredDataForKPIsAndCharts.filter(report => {
            if (!report || !Array.isArray(report) || report.length < 5 || typeof report[4] !== 'string') return false;
            const reportDate = new Date(report[4]);
            if (isNaN(reportDate.getTime())) return false;
            reportDate.setHours(0,0,0,0); 
            const matchesStartDate = !startDate || reportDate >= startDate;
            const matchesEndDate = !endDate || reportDate <= endDate;
            return matchesStartDate && matchesEndDate;
        });
        console.log("renderCurrentPage: dateRangeAndOtherFilteredData count (for table):", dateRangeAndOtherFilteredData.length);

        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const reportsToShow = dateRangeAndOtherFilteredData.slice(startIndex, endIndex);

        populateTable(reportsToShow);
        if (paginationControls) displayPagination(dateRangeAndOtherFilteredData.length);
        updateKPIs(baseFilteredDataForKPIsAndCharts, dateRangeAndOtherFilteredData); 
        console.log("--- renderCurrentPage END --- Table & KPIs updated. Reports shown:", reportsToShow.length);
    }
    
    async function fetchData() {
        console.log("fetchData: Initiating...");
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">جاري تحميل البيانات...</td></tr>';
        try {
            const response = await fetch(dataUrl);
            console.log("fetchData: Response status:", response.status, "Ok:", response.ok);
            if (!response.ok) throw new Error(`Network error (${response.status})`);
            
            allReportsData = await response.json();
            console.log("fetchData: Data parsed. Length:", allReportsData ? allReportsData.length : 'N/A'); 
            
            if (Array.isArray(allReportsData) && allReportsData.length > 0) {
                if(departmentFilter) { 
                    populateFilter(allReportsData); // Populate filter first
                } else { console.error("fetchData: departmentFilter is NULL."); }
                renderCurrentPage(); // Then render page, which uses filter value
                console.log("fetchData: Initial page render process complete.");
            } else {
                console.warn("fetchData: Data is empty or not an array.");
                if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">لا توجد بيانات.</td></tr>';
                updateKPIs([], []); 
            }
        } catch (error) {
            console.error('fetchData: CRITICAL ERROR:', error);
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="7">خطأ: ${error.message}</td></tr>`;
            updateKPIs([], []);
        }
    }

    function handleFilterAndSearch() {
        console.log("handleFilterAndSearch: User interaction.");
        currentPage = 1; 
        renderCurrentPage();
    }
    function resetDateFilter() { /* ... unchanged ... */ }
    
    // --- REMOVED THEME FUNCTIONS: toggleTheme, loadTheme ---
    // Ensure themeSwitcherBtn event listener is also removed or handled if button is removed from HTML

    function initializeCalendar() {
        console.log("initializeCalendar: Called. Calendar Initialized Flag:", calendarInitialized, "Calendar Element:", !!calendarEl);
        if (!calendarEl) {
            console.error("initializeCalendar: calendarEl is NULL.");
            return;
        }
        if (!Array.isArray(allReportsData) || allReportsData.length === 0) { // Check allReportsData
            console.warn("initializeCalendar: No base data (allReportsData). Cannot populate calendar.");
            calendarEl.innerHTML = "<p style='text-align:center; padding:20px;'>لا توجد بيانات لعرضها في التقويم.</p>";
            if (calendarInstance) { calendarInstance.destroy(); calendarInstance = null; calendarInitialized = false;}
            return;
        }
        calendarEl.innerHTML = ''; 

        // For calendar, let's use data filtered by search and department only
        // This is now baseFilteredDataForKPIsAndCharts from the last renderCurrentPage call
        // Or re-filter allReportsData here if more current filter values are desired
        const currentSearchTerm = searchInput ? searchInput.value.toLowerCase() : "";
        const currentSelectedDept = departmentFilter ? departmentFilter.value : "all";
        const dataForCalendar = allReportsData.filter(report => {
             if (!report || !Array.isArray(report) || report.length < 3 || typeof report[1] !== 'string' || typeof report[2] !== 'string') return false;
            const deptMatch = (currentSelectedDept === 'all') || (report[1] === currentSelectedDept);
            const searchMatch = report[1].toLowerCase().includes(currentSearchTerm) || 
                                report[2].toLowerCase().includes(currentSearchTerm);
            return deptMatch && searchMatch;
        });

        console.log("initializeCalendar: Data for calendar (after current search/dept filter):", dataForCalendar.length);

        const calendarEvents = dataForCalendar.map(report => {
            if (!report || !Array.isArray(report) || report.length < 5) return null; 
            const statusInfo = getStatus(report[4]);
            if (!statusInfo || !statusInfo.eventColors) return null;
            return {
                id: report[0], title: report[2], start: report[4], allDay: true,
                backgroundColor: statusInfo.eventColors.backgroundColor,
                borderColor: statusInfo.eventColors.borderColor,
                textColor: statusInfo.eventColors.textColor,
                extendedProps: { id:report[0], department: report[1], frequency: report[3], statusText: statusInfo.text, fullReport: report }
            };
        }).filter(event => event !== null); 

        console.log("initializeCalendar: Processed calendarEvents. Count:", calendarEvents.length);
        if (calendarEvents.length === 0) {
             console.warn("initializeCalendar: No events to display on calendar after processing.");
        }
        // console.log("initializeCalendar: Sample event:", JSON.stringify(calendarEvents.slice(0,1)));


        if (calendarInstance) calendarInstance.destroy();
        try {
            calendarInstance = new FullCalendar.Calendar(calendarEl, {
                locale: 'ar', 
                headerToolbar: { right: 'prev,next today', center: 'title', left: 'dayGridMonth,timeGridWeek,listWeek' },
                initialView: 'dayGridMonth',
                events: calendarEvents,
                eventDisplay: 'block', 
                eventTextColor: function(eventInfo){ return eventInfo.event.textColor; },
                eventDidMount: function(info) {
                    if (info.event.backgroundColor) info.el.style.setProperty('background-color', info.event.backgroundColor, 'important');
                    if (info.event.borderColor) info.el.style.setProperty('border-color', info.event.borderColor, 'important');
                },
                eventClick: function(info) { /* ... as before ... */ }
            });
            calendarInstance.render();
            calendarInitialized = true; 
            console.log("initializeCalendar: Calendar RENDERED successfully.");
        } catch(e) {
            console.error("initializeCalendar: ERROR during FullCalendar instantiation or render:", e);
            calendarEl.innerHTML = "<p style='text-align:center; padding:20px;'>حدث خطأ أثناء عرض التقويم.</p>";
        }
    }

    function destroyCalendar() { /* ... as before ... */ }
    
    if(closeModalButton) closeModalButton.onclick = function() { if(eventModal) eventModal.style.display = "none"; }
    if(eventModal) window.onclick = function(event) { if (eventModal && event.target == eventModal) eventModal.style.display = "none"; }

    function handleNavigation(event) {
        event.preventDefault();
        // console.log("--- handleNavigation START --- Target:", event.target.closest('li[data-view]'));
        const clickedLi = event.target.closest('li[data-view]');
        if (!clickedLi) { return; }
        // Allow re-click for calendar/analytics to refresh with current filters
        // if (clickedLi.classList.contains('active') && clickedLi.dataset.view !== 'calendar' && clickedLi.dataset.view !== 'analytics') { 
        //     return;
        // }
        
        const viewId = clickedLi.dataset.view;
        // console.log("handleNavigation: Navigating to viewId:", viewId);

        if(navLinks) navLinks.forEach(link => link.classList.remove('active'));
        if(views) views.forEach(view => view.classList.remove('active-view'));
        
        clickedLi.classList.add('active');
        const targetView = document.getElementById(`${viewId}-section`);
        if (targetView) {
            targetView.classList.add('active-view');
        } else { return; }
        
        if (viewId === 'analytics') {
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
            initializeCalendar(); 
        }
        // console.log("--- handleNavigation END for view:", viewId, "---");
    }

    // Event Listeners
    // console.log("Attaching event listeners...");
    if(searchInput) searchInput.addEventListener('input', handleFilterAndSearch);
    if(departmentFilter) departmentFilter.addEventListener('change', handleFilterAndSearch);
    if(startDateInput) startDateInput.addEventListener('change', handleFilterAndSearch);
    if(endDateInput) endDateInput.addEventListener('change', handleFilterAndSearch);
    if(resetDateBtn) resetDateBtn.addEventListener('click', resetDateFilter);
    // Removed themeSwitcherBtn listener
    if(navLinks && navLinks.length > 0) {
        navLinks.forEach((link) => { if (link) link.addEventListener('click', handleNavigation); });
    }

    // Initial Setup
    console.log("Running initial setup: Fetching data.");
    // Removed loadTheme()
    fetchData();

});
