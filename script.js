document.addEventListener('DOMContentLoaded', () => {
    console.log("SCRIPT.JS LOADED. Current Time:", new Date().toLocaleTimeString());

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
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(today.getDate() + 3);

    function getThemeColor(cssVarName, fallbackColor) { /* ... unchanged ... */ }

    // --- UPDATED getStatus function ---
    function getStatus(dueDateStr) {
        const defaultErrorStatus = { 
            text: "تاريخ غير صالح", 
            classForTable: "status-error", 
            isPast: false, 
            isNear: false, 
            eventColors: { backgroundColor: 'gray', borderColor: 'gray', textColor: 'white' } 
        };

        if (!dueDateStr || typeof dueDateStr !== 'string' || !dueDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            console.error("Invalid dueDateStr received by getStatus:", dueDateStr);
            return defaultErrorStatus;
        }
        
        const due = new Date(dueDateStr); // Simpler date parsing
        if (isNaN(due.getTime())) { // Check if date is valid after parsing
            console.error("Failed to parse dueDateStr into valid date:", dueDateStr);
            return defaultErrorStatus;
        }
        due.setHours(0, 0, 0, 0); // Normalize to start of day

        const pastEvent = { backgroundColor: '#E9ECEF', borderColor: '#D0D0D0', textColor: '#6C757D' };
        const dueTodayEvent = { backgroundColor: getThemeColor('--accent-gold-muted', '#bd9a5f'), borderColor: getThemeColor('--accent-gold-muted', '#bd9a5f'), textColor: '#FFFFFF' };
        const upcomingEvent = { backgroundColor: getThemeColor('--accent-blue', '#AEC6CF'), borderColor: getThemeColor('--accent-blue', '#AEC6CF'), textColor: getThemeColor('--primary-dark-light', '#2C3E50') };
        const futureEvent = { backgroundColor: getThemeColor('--accent-green', '#F5F5F5'), borderColor: getThemeColor('--accent-green', '#F5F5F5'), textColor: '#6C757D' };

        if (due < today) return { text: "منتهي", classForTable: "status-past", isPast: true, isNear: false, eventColors: pastEvent };
        if (due.getTime() === today.getTime()) return { text: "مستحق اليوم", classForTable: "status-due", isPast: false, isNear: true, eventColors: dueTodayEvent };
        if (due > today && due <= threeDaysLater) return { text: "قادم قريباً", classForTable: "status-upcoming", isPast: false, isNear: true, eventColors: upcomingEvent };
        return { text: "قادم", classForTable: "status-future", isPast: false, isNear: false, eventColors: futureEvent };
    }

    function createMailtoLink(reportTitle) { /* ... unchanged with new body ... */
        const subject = encodeURIComponent(`تقرير: ${reportTitle}`);
        const bodyLines = ["السلام عليكم","","مرفق لكم تقرير \"" + reportTitle + "\"","","مع وافر التحية والتقدير"];
        const body = encodeURIComponent(bodyLines.join('\n'));
        return `mailto:${targetEmail}?subject=${subject}&body=${body}`;
    }
    
    function createCharts(dataForCharts) { /* ... unchanged ... */ }
    
    function populateTable(reportsToShow) {
        // console.log("populateTable: Starting. Reports to show:", reportsToShow ? reportsToShow.length : 'null/undefined');
        if (!tableBody) { return; } // Simplified check
        tableBody.innerHTML = ''; 
        if (!reportsToShow || reportsToShow.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7">لا توجد تقارير تطابق البحث أو التصفية.</td></tr>';
            return;
        }
        
        reportsToShow.forEach((report) => {
            if (!Array.isArray(report) || report.length < 5) {
                console.error(`populateTable: Invalid report data structure:`, report);
                return; 
            }
            const [id, department, title, frequency, dateString] = report;
            const statusInfo = getStatus(dateString); 
            
            // This check should now be less necessary due to getStatus improvements, but good for safety.
            if (!statusInfo || typeof statusInfo.isPast === 'undefined') {
                console.error(`populateTable: Still received invalid statusInfo for report ID ${id}`, statusInfo);
                return; 
            }

            const row = document.createElement('tr');
            if (statusInfo.isPast) row.classList.add('past-due');
            
            row.innerHTML = `
                <td>${id !== undefined ? id : 'N/A'}</td>
                <td>${department !== undefined ? department : 'N/A'}</td>
                <td>${title !== undefined ? title : 'N/A'}</td>
                <td>${frequency !== undefined ? frequency : 'N/A'}</td>
                <td>${dateString !== undefined ? dateString : 'N/A'}</td>
                <td><span class="status-tag ${statusInfo.classForTable || ''}">${statusInfo.text || 'N/A'}</span></td>
                <td><a href="${createMailtoLink(title || 'تقرير غير محدد')}" class="icon-button" title="إرسال بريد"><i class="fas fa-envelope"></i></a></td>
            `;
            tableBody.appendChild(row);
        });
        // console.log("populateTable: Finished.");
    }

    function updateKPIs(currentBaseFilteredData, currentDateRangeFilteredData) { /* ... unchanged ... */ }
    function displayPagination(totalRows) { /* ... unchanged ... */ }
    
    function renderCurrentPage() {
        // console.log("--- renderCurrentPage Start --- Current Page:", currentPage);
        if (!allReportsData || allReportsData.length === 0) {
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">لا توجد بيانات لعرضها (renderCurrentPage - no allReportsData).</td></tr>';
            updateKPIs([], []); 
            displayPagination(0); 
            return;
        }
        // ... (rest of renderCurrentPage as in previous console.log version)
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
            if (!report || !Array.isArray(report) || report.length < 3) return false;
            const deptMatch = (selectedDept === 'all') || (report[1] === selectedDept);
            const searchMatch = report[1].toLowerCase().includes(searchTerm) || 
                                report[2].toLowerCase().includes(searchTerm);
            return deptMatch && searchMatch;
        });

        dateRangeFilteredData = baseFilteredData.filter(report => {
            if (!report || !Array.isArray(report) || report.length < 5) return false;
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
        displayPagination(dateRangeFilteredData.length);
        updateKPIs(baseFilteredData, dateRangeFilteredData); 
        // console.log("--- renderCurrentPage End ---");
    }
    
    function populateFilter(data) { /* ... unchanged ... */ }

    async function fetchData() {
        console.log("fetchData: Initiating...");
        try {
            const response = await fetch(dataUrl);
            console.log("fetchData: Response status:", response.status, "Ok:", response.ok);
            if (!response.ok) {
                console.error("fetchData: Network error. Status:", response.status, response.statusText);
                if (tableBody) tableBody.innerHTML = `<tr><td colspan="7">فشل تحميل البيانات. الحالة: ${response.status}.</td></tr>`;
                updateKPIs([], []); 
                return; 
            }
            allReportsData = await response.json();
            console.log("fetchData: Data parsed. Type:", typeof allReportsData, "Is Array:", Array.isArray(allReportsData), "Length:", allReportsData ? allReportsData.length : 'N/A'); 
            
            if (Array.isArray(allReportsData) && allReportsData.length > 0) {
                if(departmentFilter) populateFilter(allReportsData); else console.error("fetchData: departmentFilter is null.");
                renderCurrentPage(); 
                console.log("fetchData: Initial render process completed.");
            } else {
                console.warn("fetchData: Data is empty or not an array.");
                if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">البيانات فارغة أو غير صحيحة.</td></tr>';
                updateKPIs([], []); 
            }
        } catch (error) {
            console.error('fetchData: Critical error during fetch or processing:', error);
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="7">خطأ فادح في تحميل البيانات: ${error.message}</td></tr>`;
            updateKPIs([], []);
        }
    }

    function handleFilterAndSearch() { /* ... unchanged ... */ }
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
             console.log("handleNavigation: Clicked target is not a valid nav LI. Clicked element:", event.target);
            return;
        }
        if (clickedLi.classList.contains('active')) {
            console.log("handleNavigation: Clicked LI is already active.");
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
            console.log("handleNavigation: View activated:", viewId);
        } else {
            console.error("handleNavigation: Target view element not found for ID:", `${viewId}-section`);
            return; 
        }
        
        if (viewId === 'analytics') {
            console.log("handleNavigation: Analytics tab processing. Charts drawn previously:", chartsDrawn);
            const currentSearchTerm = searchInput ? searchInput.value.toLowerCase() : "";
            const currentSelectedDept = departmentFilter ? departmentFilter.value : "all";
            const chartData = allReportsData.filter(report => { 
                if (!report || !Array.isArray(report) || report.length < 3) return false;
                const matchesSearch = report[1].toLowerCase().includes(currentSearchTerm) || 
                                    report[2].toLowerCase().includes(currentSearchTerm);
                const matchesDept = (currentSelectedDept === 'all') || (report[1] === currentSelectedDept);
                return matchesSearch && matchesDept;
            });
            createCharts(chartData); 
        }

        if (viewId === 'calendar') {
            console.log("handleNavigation: Calendar tab processing.");
            initializeCalendar(); 
        }
        console.log("--- handleNavigation End (Success for view:", viewId, ") ---");
    }

    // Event Listeners
    console.log("Attaching event listeners...");
    if(searchInput) searchInput.addEventListener('input', handleFilterAndSearch);
    if(departmentFilter) departmentFilter.addEventListener('change', handleFilterAndSearch);
    if(startDateInput) startDateInput.addEventListener('change', handleFilterAndSearch);
    if(endDateInput) endDateInput.addEventListener('change', handleFilterAndSearch);
    if(resetDateBtn) resetDateBtn.addEventListener('click', resetDateFilter);
    if(themeSwitcherBtn) themeSwitcherBtn.addEventListener('click', toggleTheme);
    if(navLinks && navLinks.length > 0) {
        navLinks.forEach((link) => { if (link) link.addEventListener('click', handleNavigation); });
        console.log(`${navLinks.length} navigation listeners attached.`);
    } else { console.warn("No navLinks found."); }

    // Initial Setup
    console.log("Running initial setup: loadTheme and fetchData. Current Time:", new Date().toLocaleTimeString());
    loadTheme();
    fetchData();

});
