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

    console.log("DOM Elements Initial Check:", {
        tableBody: !!tableBody, searchInput: !!searchInput, kpiTotalReports: !!kpiTotalReports, 
        departmentFilter: !!departmentFilter, paginationControls: !!paginationControls,
        startDateInput: !!startDateInput, endDateInput: !!endDateInput, resetDateBtn: !!resetDateBtn,
        calendarEl: !!calendarEl, eventModal: !!eventModal
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

    const today = new Date(new Date(systemBaseDate).setHours(0, 0, 0, 0));
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(today.getDate() + 3);
    // console.log("Date context: 'today' is set to", today.toISOString().split('T')[0]); // Kept for reference

    function getThemeColor(cssVarName, fallbackColor) { /* ... unchanged ... */ }
    function getStatus(dueDateStr) { /* ... unchanged ... */ }
    function createMailtoLink(reportTitle) { /* ... unchanged ... */ }
    function createCharts(dataForCharts) { /* ... unchanged ... */ }
    
    function populateTable(reportsToShow) {
        console.log("populateTable: Starting. Reports to show count:", reportsToShow ? reportsToShow.length : 'undefined');
        if (!tableBody) {
            console.error("populateTable: tableBody element is NULL. Aborting.");
            return;
        }
        tableBody.innerHTML = ''; // Clear previous entries
        console.log("populateTable: tableBody cleared.");

        if (!reportsToShow || reportsToShow.length === 0) {
            console.log("populateTable: No reports to show, displaying empty message.");
            tableBody.innerHTML = '<tr><td colspan="7">لا توجد تقارير تطابق البحث أو التصفية.</td></tr>';
            return;
        }
        
        reportsToShow.forEach((report, index) => {
            // console.log(`populateTable: Processing report at index ${index}`, report); // Log each report
            if (!Array.isArray(report) || report.length < 5) {
                console.warn(`populateTable: Skipping invalid report data structure at index ${index}:`, report);
                return; 
            }
            const [id, department, title, frequency, dateString] = report;
            const statusInfo = getStatus(dateString); 
            
            if (!statusInfo || typeof statusInfo.classForTable === 'undefined') { 
                console.error(`populateTable: Invalid statusInfo for report ID ${id}. statusInfo:`, statusInfo, "dateString:", dateString);
                return; 
            }

            const row = document.createElement('tr');
            if (statusInfo.isPast) row.classList.add('past-due');
            
            const rowHTML = `
                <td>${id !== undefined ? id : ''}</td>
                <td>${department !== undefined ? department : ''}</td>
                <td>${title !== undefined ? title : ''}</td>
                <td>${frequency !== undefined ? frequency : ''}</td>
                <td>${dateString !== undefined ? dateString : ''}</td>
                <td><span class="status-tag ${statusInfo.classForTable}">${statusInfo.text}</span></td>
                <td><a href="${createMailtoLink(title || '')}" class="icon-button" title="إرسال بريد"><i class="fas fa-envelope"></i></a></td>
            `;
            row.innerHTML = rowHTML;
            tableBody.appendChild(row);
            // console.log(`populateTable: Appended row for report ID ${id}. HTML:`, rowHTML);
        });
        console.log("populateTable: Finished. Table should have", reportsToShow.length, "rows. Actual rows in DOM:", tableBody.rows.length);
    }

    function updateKPIs(currentBaseFilteredData, currentDateRangeFilteredData) {
        console.log("updateKPIs: Starting. BaseData Count:", currentBaseFilteredData ? currentBaseFilteredData.length : 'N/A', 
                    "DateRangeData Count:", currentDateRangeFilteredData ? currentDateRangeFilteredData.length : 'N/A');

        if (!kpiTotalReports || !kpiDueInPeriod || !kpiDueToday || !kpiDue3Days || !kpiPastTotal) {
            console.error("updateKPIs: One or more KPI DOM elements are missing!");
            // Set to default even if elements are missing to avoid errors later if some exist
            if(kpiTotalReports) kpiTotalReports.textContent = '-';
            if(kpiDueInPeriod) kpiDueInPeriod.textContent = '-';
            if(kpiDueToday) kpiDueToday.textContent = '-';
            if(kpiDue3Days) kpiDue3Days.textContent = '-';
            if(kpiPastTotal) kpiPastTotal.textContent = '-';
            return;
        }
        
        const valTotalReports = currentBaseFilteredData ? currentBaseFilteredData.length : 0;
        kpiTotalReports.textContent = valTotalReports;
        console.log("updateKPIs: kpiTotalReports set to", valTotalReports);

        let valDueInPeriod = '-';
        if (startDateInput && endDateInput && startDateInput.value && endDateInput.value) {
            valDueInPeriod = currentDateRangeFilteredData ? currentDateRangeFilteredData.length : 0;
        }
        kpiDueInPeriod.textContent = valDueInPeriod;
        console.log("updateKPIs: kpiDueInPeriod set to", valDueInPeriod);


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
        console.log("updateKPIs: kpiDueToday set to", dueTodayCount, "kpiDue3Days set to", (due3DaysOnlyCount + dueTodayCount));

        let pastTotalCount = 0;
        if (currentBaseFilteredData) {
            currentBaseFilteredData.forEach(report => {
                if (!report || report.length < 5) return;
                const statusInfo = getStatus(report[4]);
                if (statusInfo && statusInfo.isPast) pastTotalCount++;
            });
        }
        kpiPastTotal.textContent = pastTotalCount;
        console.log("updateKPIs: kpiPastTotal set to", pastTotalCount);
        
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
        }
        console.log("updateKPIs: Finished.");
    }

    function displayPagination(totalRows) { 
        console.log("displayPagination: Called. Total rows for pagination:", totalRows);
        // ... (rest as before)
         if (!paginationControls) { return; }
        paginationControls.innerHTML = '';
        const pageCount = Math.ceil(totalRows / rowsPerPage);
        if (pageCount <= 1) {
            console.log("displayPagination: Page count <= 1, no controls needed.");
            return;
        }

        const prevLi = document.createElement('li');
        prevLi.innerHTML = `<a href="#" data-page="${currentPage - 1}">&laquo; السابق</a>`;
        if (currentPage === 1) prevLi.classList.add('disabled');
        paginationControls.appendChild(prevLi);

        for (let i = 1; i <= pageCount; i++) {
            const pageLi = document.createElement('li');
            pageLi.innerHTML = `<a href="#" data-page="${i}">${i}</a>`;
            if (i === currentPage) pageLi.classList.add('active');
            paginationControls.appendChild(pageLi);
        }

        const nextLi = document.createElement('li');
        nextLi.innerHTML = `<a href="#" data-page="${currentPage + 1}">التالي &raquo;</a>`;
        if (currentPage === pageCount) nextLi.classList.add('disabled');
        paginationControls.appendChild(nextLi);

        paginationControls.querySelectorAll('a').forEach(link => {
            link.onclick = (e) => {
                e.preventDefault();
                const parentLi = link.parentElement;
                if (parentLi.classList.contains('disabled') || parentLi.classList.contains('active')) return;
                currentPage = parseInt(link.dataset.page);
                renderCurrentPage();
            };
        });
        console.log("displayPagination: Pagination controls rendered for", pageCount, "pages.");
    }
    
    function renderCurrentPage() {
        console.log("--- renderCurrentPage START --- Current Page:", currentPage);
        if (!allReportsData || !Array.isArray(allReportsData) || allReportsData.length === 0) {
            console.warn("renderCurrentPage: allReportsData is empty or not an array. Aborting render.");
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">لا توجد بيانات أساسية لعرضها.</td></tr>';
            updateKPIs([], []); // Ensure KPIs are cleared
            if (paginationControls) displayPagination(0); // Ensure pagination is cleared
            return;
        }
        
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
        const selectedDept = departmentFilter ? departmentFilter.value : "all";
        const startDateValue = startDateInput ? startDateInput.value : "";
        const endDateValue = endDateInput ? endDateInput.value : "";

        let startDate = null;
        if (startDateValue) {
            startDate = new Date(startDateValue);
            if (!isNaN(startDate.getTime())) startDate.setHours(0, 0, 0, 0); else { console.warn("Invalid start date value:", startDateValue); startDate = null; }
        }
        let endDate = null;
        if (endDateValue) {
            endDate = new Date(endDateValue);
            if (!isNaN(endDate.getTime())) endDate.setHours(23, 59, 59, 999); else { console.warn("Invalid end date value:", endDateValue); endDate = null; }
        }
        // console.log("renderCurrentPage: Filters - Search:", searchTerm, "Dept:", selectedDept, "Start:", startDate, "End:", endDate);
        
        baseFilteredData = allReportsData.filter(report => { /* ... unchanged ... */ });
        // console.log("renderCurrentPage: Base filtered data count (after search & dept):", baseFilteredData.length);

        dateRangeFilteredData = baseFilteredData.filter(report => { /* ... unchanged ... */ });
        // console.log("renderCurrentPage: Date range filtered data count (final for table):", dateRangeFilteredData.length);

        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const reportsToShow = dateRangeFilteredData.slice(startIndex, endIndex);
        // console.log("renderCurrentPage: Reports to show on this page (after slice):", reportsToShow.length);

        populateTable(reportsToShow);
        if (paginationControls) displayPagination(dateRangeFilteredData.length); else console.warn("renderCurrentPage: paginationControls is null, cannot display pagination.");
        updateKPIs(baseFilteredData, dateRangeFilteredData); 
        console.log("--- renderCurrentPage END --- Table & KPIs updated.");
    }
    
    function populateFilter(data) { /* ... unchanged with its console.logs ... */ }

    async function fetchData() {
        console.log("fetchData: Initiating...");
        if (!tableBody) { // Check if tableBody exists before trying to write "loading" to it
            console.error("fetchData: tableBody element is NULL at the start. Cannot display loading message.");
        } else {
            tableBody.innerHTML = '<tr><td colspan="7">جاري تحميل البيانات...</td></tr>';
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
            console.log("fetchData: Sample of first 2 reports:", JSON.stringify(allReportsData.slice(0,2)));
            
            if (Array.isArray(allReportsData) && allReportsData.length > 0) {
                console.log("fetchData: Data is valid. Populating filter and rendering initial page.");
                if(departmentFilter) { populateFilter(allReportsData); } else { console.error("fetchData: departmentFilter is NULL."); }
                renderCurrentPage(); 
                console.log("fetchData: Initial page render process COMPLETE.");
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

    function handleFilterAndSearch() { /* ... unchanged with its console.logs ... */ }
    function resetDateFilter() { /* ... unchanged ... */ }
    
    function toggleTheme() {
        console.log("toggleTheme: Called. Current dark mode class:", document.body.classList.contains('dark-mode'));
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        if (themeIcon) themeIcon.className = isDarkMode ? 'fas fa-moon' : 'fas fa-sun';
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        console.log("toggleTheme: Theme set to", isDarkMode ? 'dark' : 'light');
        
        const activeViewId = document.querySelector('.sidebar ul li.active')?.dataset.view;
        if (activeViewId === 'analytics') {
            if (chartsDrawn) { // Only re-create if they were already drawn
                console.log("toggleTheme: Re-creating analytics charts for new theme.");
                // ... (rest of chart recreation logic) ...
            } else {
                console.log("toggleTheme: Analytics charts not drawn yet, skipping re-creation.");
            }
        }
        if (activeViewId === 'calendar') {
             if (calendarInitialized) { // Only re-initialize if it was already up
                console.log("toggleTheme: Re-initializing calendar for new theme.");
                initializeCalendar(); 
            } else {
                console.log("toggleTheme: Calendar not initialized yet, skipping re-initialization.");
            }
        }
    }

    function loadTheme() { /* ... unchanged with its console.logs ... */ }
    function initializeCalendar() { /* ... unchanged with its console.logs ... */ }
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
        console.log("handleNavigation: Clicked LI data-view:", clickedLi.dataset.view, "Is active:", clickedLi.classList.contains('active'));

        if (clickedLi.classList.contains('active')) {
            console.log("handleNavigation: Clicked LI is already active. No action.");
            return;
        }

        const viewId = clickedLi.dataset.view;
        console.log("handleNavigation: Attempting to navigate to viewId:", viewId);

        if(navLinks) navLinks.forEach(link => link.classList.remove('active'));
        if(views) views.forEach(view => view.classList.remove('active-view'));
        
        clickedLi.classList.add('active');
        const targetView = document.getElementById(`${viewId}-section`);
        if (targetView) {
            targetView.classList.add('active-view');
            console.log("handleNavigation: View activated:", viewId);
        } else {
            console.error("handleNavigation: Target view element not found for ID:", `${viewId}-section`);
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
    // ... (بقية ربط مستمعي الأحداث كما هي مع console.log)

    // Initial Setup
    console.log("Running initial setup: loadTheme and fetchData. Current Time:", new Date().toLocaleTimeString());
    loadTheme();
    fetchData();

});
