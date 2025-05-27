document.addEventListener('DOMContentLoaded', () => {
    console.log("SCRIPT.JS LOADED: DOMContentLoaded FIRED");

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

    const today = new Date(new Date(systemBaseDate).setHours(0, 0, 0, 0));
    const threeDaysLater = new Date(new Date(systemBaseDate).setHours(0, 0, 0, 0));
    threeDaysLater.setDate(today.getDate() + 3);

    function getThemeColor(cssVarName, fallbackColor) {
        try {
            if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.documentElement) {
                const color = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
                return color || fallbackColor;
            }
            return fallbackColor;
        } catch (e) { return fallbackColor; }
    }

    function getStatus(dueDateStr) {
        const defaultErrorStatus = { text: "خطأ بالتاريخ", classForTable: "status-error", isPast: false, isNear: false, eventColors: { backgroundColor: 'gray', borderColor: 'gray', textColor: 'white' } };
        if (!dueDateStr || typeof dueDateStr !== 'string' || !dueDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            console.warn("getStatus: Invalid dueDateStr format or type:", dueDateStr);
            return defaultErrorStatus;
        }
        const due = new Date(dueDateStr);
        if (isNaN(due.getTime())) {
            console.warn("getStatus: Failed to parse dueDateStr into valid date object:", dueDateStr);
            return defaultErrorStatus;
        }
        const normalizedDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());

        const pastEvent = { backgroundColor: '#E9ECEF', borderColor: '#D0D0D0', textColor: '#6C757D' };
        const dueTodayEvent = { backgroundColor: getThemeColor('--accent-gold-muted', '#bd9a5f'), borderColor: getThemeColor('--accent-gold-muted', '#bd9a5f'), textColor: '#FFFFFF' };
        const upcomingEvent = { backgroundColor: getThemeColor('--accent-blue-calendar-event', '#AEC6CF'), borderColor: getThemeColor('--accent-blue-calendar-event', '#AEC6CF'), textColor: getThemeColor('--primary-dark-light', '#2C3E50') };
        const futureEvent = { backgroundColor: getThemeColor('--accent-green-event', '#F5F5F5'), borderColor: getThemeColor('--accent-green-event', '#F5F5F5'), textColor: '#6C757D' };

        if (normalizedDue < today) return { text: "منتهي", classForTable: "status-past", isPast: true, isNear: false, eventColors: pastEvent };
        if (normalizedDue.getTime() === today.getTime()) return { text: "مستحق اليوم", classForTable: "status-due", isPast: false, isNear: true, eventColors: dueTodayEvent };
        if (normalizedDue > today && normalizedDue <= threeDaysLater) return { text: "قادم قريباً", classForTable: "status-upcoming", isPast: false, isNear: true, eventColors: upcomingEvent };
        return { text: "قادم", classForTable: "status-future", isPast: false, isNear: false, eventColors: futureEvent };
    }

    function createMailtoLink(reportTitle) { /* ... as before ... */ }
    function createCharts(dataForCharts) { /* ... as before ... */ }
    
    function populateTable(reportsToShow) {
        if (!tableBody) { console.error("populateTable: tableBody is NULL."); return; }
        tableBody.innerHTML = ''; 
        if (!reportsToShow || reportsToShow.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7">لا توجد تقارير تطابق البحث أو التصفية.</td></tr>';
            return;
        }
        reportsToShow.forEach((report) => {
            if (!Array.isArray(report) || report.length < 5) return; 
            const [id, department, title, frequency, dateString] = report;
            const statusInfo = getStatus(dateString); 
            if (!statusInfo || typeof statusInfo.classForTable === 'undefined') return; 
            const row = document.createElement('tr');
            if (statusInfo.isPast) row.classList.add('past-due');
            row.innerHTML = `<td>${id||''}</td><td>${department||''}</td><td>${title||''}</td><td>${frequency||''}</td><td>${dateString||''}</td><td><span class="status-tag ${statusInfo.classForTable}">${statusInfo.text}</span></td><td><a href="${createMailtoLink(title||'')}" class="icon-button" title="إرسال بريد"><i class="fas fa-envelope"></i></a></td>`;
            tableBody.appendChild(row);
        });
    }

    function updateKPIs(currentBaseFilteredData, currentDateRangeFilteredData) {
        if (!kpiTotalReports || !kpiDueInPeriod || !kpiDueToday || !kpiDue3Days || !kpiPastTotal) return;
        
        kpiTotalReports.textContent = currentBaseFilteredData ? currentBaseFilteredData.length : '0';
        if (startDateInput && endDateInput && startDateInput.value && endDateInput.value) {
            kpiDueInPeriod.textContent = currentDateRangeFilteredData ? currentDateRangeFilteredData.length : '0';
        } else {
            kpiDueInPeriod.textContent = '-';
        }
        let dueTodayCount = 0, due3DaysOnlyCount = 0, pastTotalCount = 0, nearNotificationCount = 0;

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

        if (currentBaseFilteredData) {
            currentBaseFilteredData.forEach(report => {
                if (!report || report.length < 5) return;
                const statusInfo = getStatus(report[4]);
                if (statusInfo && statusInfo.isPast) pastTotalCount++;
                if (statusInfo && statusInfo.isNear) nearNotificationCount++;
            });
        }
        kpiPastTotal.textContent = pastTotalCount;
        if (notificationDot) notificationDot.classList.toggle('hidden', nearNotificationCount === 0);
    }

    function displayPagination(totalRows) { /* ... as before ... */ }
    
    function populateFilter(data) {
        if (!departmentFilter || !data || !Array.isArray(data)) return;
        departmentFilter.innerHTML = '<option value="all">عرض الكل</option>';
        const departments = [...new Set(data.map(report => report[1]).filter(dept => dept))]; // Filter out undefined/null departments
        departments.sort((a, b) => String(a).localeCompare(String(b), 'ar')); 
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departmentFilter.appendChild(option);
        });
        console.log("populateFilter: Populated with", departments.length, "departments.");
    }
    
    function renderCurrentPage() {
        console.log("--- renderCurrentPage --- Called");
        if (!allReportsData || !Array.isArray(allReportsData)) { // Added !Array.isArray check
            console.error("renderCurrentPage: allReportsData is not ready or not an array.");
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">خطأ في تحميل البيانات الأساسية.</td></tr>';
            updateKPIs([], []); 
            if (paginationControls) displayPagination(0); 
            return;
        }
        // ... (rest of function as before, with careful checks for null/undefined on DOM elements before use)
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
        
        baseFilteredData = allReportsData.filter(report => {
            if (!report || !Array.isArray(report) || report.length < 3 || typeof report[1] !== 'string' || typeof report[2] !== 'string') return false;
            const deptMatch = (selectedDept === 'all') || (report[1] === selectedDept);
            const searchMatch = report[1].toLowerCase().includes(searchTerm) || 
                                report[2].toLowerCase().includes(searchTerm);
            return deptMatch && searchMatch;
        });

        dateRangeFilteredData = baseFilteredData.filter(report => {
            if (!report || !Array.isArray(report) || report.length < 5 || typeof report[4] !== 'string') return false;
            const reportDate = new Date(report[4]);
            if (isNaN(reportDate.getTime())) return false;
            reportDate.setHours(0,0,0,0); 
            const matchesStartDate = !startDate || reportDate >= startDate;
            const matchesEndDate = !endDate || reportDate <= endDate;
            return matchesStartDate && matchesEndDate;
        });

        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const reportsToShow = dateRangeFilteredData.slice(startIndex, endIndex);

        populateTable(reportsToShow);
        if (paginationControls) displayPagination(dateRangeFilteredData.length);
        updateKPIs(baseFilteredData, dateRangeFilteredData); 
        console.log("--- renderCurrentPage --- Finished. Reports shown:", reportsToShow.length);
    }
    
    async function fetchData() {
        console.log("fetchData: Initiating...");
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">جاري تحميل البيانات...</td></tr>';
        else { console.error("fetchData: tableBody is null, cannot set loading message."); }

        try {
            const response = await fetch(dataUrl);
            console.log("fetchData: Response status:", response.status, "Ok:", response.ok);
            if (!response.ok) {
                console.error("fetchData: Network error fetching data.json. Status:", response.status);
                if (tableBody) tableBody.innerHTML = `<tr><td colspan="7">فشل تحميل البيانات. الحالة: ${response.status}.</td></tr>`;
                updateKPIs([], []); 
                return; 
            }
            allReportsData = await response.json();
            console.log("fetchData: Data parsed. Length:", allReportsData ? allReportsData.length : 'N/A', ". IsArray:", Array.isArray(allReportsData)); 
            
            if (Array.isArray(allReportsData) && allReportsData.length > 0) {
                populateFilter(allReportsData); 
                renderCurrentPage(); 
                console.log("fetchData: Initial page render process complete.");
            } else {
                console.warn("fetchData: Data is empty or not an array after parsing.");
                if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">لا توجد بيانات للعرض.</td></tr>';
                updateKPIs([], []); 
            }
        } catch (error) {
            console.error('fetchData: CRITICAL ERROR:', error);
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="7">خطأ فادح: ${error.message}</td></tr>`;
            updateKPIs([], []);
        }
    }

    function handleFilterAndSearch() { /* ... as before ... */ }
    function resetDateFilter() { /* ... as before ... */ }
    
    function toggleTheme() {
        console.log("toggleTheme: Called.");
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        if (themeIcon) themeIcon.className = isDarkMode ? 'fas fa-moon' : 'fas fa-sun';
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        console.log("toggleTheme: Theme set to", isDarkMode ? 'dark' : 'light');
        
        const activeViewId = document.querySelector('.sidebar ul li.active')?.dataset.view;
        if (activeViewId === 'analytics' && chartsDrawn) {
            console.log("toggleTheme: Re-creating analytics charts.");
            // ... (logic for recreating charts with current filters) ...
        }
        if (activeViewId === 'calendar' && calendarInitialized) {
            console.log("toggleTheme: Re-initializing calendar.");
            initializeCalendar(); 
        }
    }

    function loadTheme() {
        console.log("loadTheme: Called.");
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            if (themeIcon) themeIcon.className = 'fas fa-moon';
        } else {
            document.body.classList.remove('dark-mode'); 
            if (themeIcon) themeIcon.className = 'fas fa-sun';
        }
        console.log("loadTheme: Theme loaded as", document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    }

    function initializeCalendar() {
        console.log("initializeCalendar: Attempting. Calendar Initialized Flag:", calendarInitialized, "Calendar Element:", !!calendarEl);
        if (!calendarEl) {
            console.error("initializeCalendar: calendarEl is NULL.");
            return;
        }
        if (!Array.isArray(allReportsData) || allReportsData.length === 0) {
            console.warn("initializeCalendar: allReportsData is empty. Cannot populate calendar.");
            calendarEl.innerHTML = "<p style='text-align:center; padding:20px;'>لا توجد بيانات لعرضها في التقويم حالياً.</p>";
            if (calendarInstance) { calendarInstance.destroy(); calendarInstance = null; calendarInitialized = false;}
            return;
        }
        calendarEl.innerHTML = ''; 

        const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
        const selectedDept = departmentFilter ? departmentFilter.value : "all";
        const calendarData = allReportsData.filter(report => { /* ... as before ... */ });
        console.log("initializeCalendar: Filtered data for calendar. Count:", calendarData.length);

        const calendarEvents = calendarData.map(report => {
            if (!report || !Array.isArray(report) || report.length < 5) { console.warn("initializeCalendar: Skipping invalid report for calendar event:", report); return null; }
            const statusInfo = getStatus(report[4]);
            if (!statusInfo || !statusInfo.eventColors) { console.warn("initializeCalendar: Missing statusInfo or eventColors for report:", report, statusInfo); return null; }
            return {
                id: report[0], title: report[2], start: report[4], allDay: true,
                backgroundColor: statusInfo.eventColors.backgroundColor,
                borderColor: statusInfo.eventColors.borderColor,
                textColor: statusInfo.eventColors.textColor,
                extendedProps: { id:report[0], department: report[1], frequency: report[3], statusText: statusInfo.text, fullReport: report }
            };
        }).filter(event => event !== null); 
        console.log("initializeCalendar: Processed calendarEvents. Count:", calendarEvents.length, "Sample:", JSON.stringify(calendarEvents.slice(0,1)));

        if (calendarInstance) calendarInstance.destroy();
        calendarInstance = new FullCalendar.Calendar(calendarEl, { /* ... options as before ... */ });
        try {
            calendarInstance.render();
            calendarInitialized = true; 
            console.log("initializeCalendar: Calendar RENDERED successfully.");
        } catch (e) {
            console.error("initializeCalendar: Error during FullCalendar RENDER:", e);
        }
    }

    function destroyCalendar() { /* ... as before ... */ }
    
    if(closeModalButton) closeModalButton.onclick = function() { if(eventModal) eventModal.style.display = "none"; }
    if(eventModal) window.onclick = function(event) { if (eventModal && event.target == eventModal) eventModal.style.display = "none"; }

    function handleNavigation(event) {
        event.preventDefault();
        console.log("--- handleNavigation START ---");
        const clickedLi = event.target.closest('li[data-view]');
        if (!clickedLi) { return; }
        if (clickedLi.classList.contains('active') && clickedLi.dataset.view !== 'calendar' && clickedLi.dataset.view !== 'analytics') { // Allow re-click for calendar/analytics to refresh
            return;
        }
        const viewId = clickedLi.dataset.view;
        console.log("handleNavigation: Navigating to viewId:", viewId);

        if(navLinks) navLinks.forEach(link => link.classList.remove('active'));
        if(views) views.forEach(view => view.classList.remove('active-view'));
        
        clickedLi.classList.add('active');
        const targetView = document.getElementById(`${viewId}-section`);
        if (targetView) {
            targetView.classList.add('active-view');
        } else { return; }
        
        if (viewId === 'analytics') {
            // ... (chart creation as before) ...
        }
        if (viewId === 'calendar') {
            initializeCalendar(); 
        }
        console.log("--- handleNavigation END for view:", viewId, "---");
    }

    // Event Listeners
    // ... (as before) ...
    if(searchInput) searchInput.addEventListener('input', handleFilterAndSearch);
    if(departmentFilter) departmentFilter.addEventListener('change', handleFilterAndSearch);
    if(startDateInput) startDateInput.addEventListener('change', handleFilterAndSearch);
    if(endDateInput) endDateInput.addEventListener('change', handleFilterAndSearch);
    if(resetDateBtn) resetDateBtn.addEventListener('click', resetDateFilter);
    if(themeSwitcherBtn) themeSwitcherBtn.addEventListener('click', toggleTheme);
    if(navLinks && navLinks.length > 0) {
        navLinks.forEach((link) => { if (link) link.addEventListener('click', handleNavigation); });
    }

    // Initial Setup
    console.log("Running initial setup: loadTheme and fetchData.");
    loadTheme();
    fetchData();

});