document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Current Time:", new Date().toLocaleTimeString());

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
    // Ensure modal elements are selected correctly
    const modalTitle = eventModal ? document.getElementById('modal-title') : null;
    const modalDepartment = eventModal ? document.getElementById('modal-department') : null;
    const modalDate = eventModal ? document.getElementById('modal-date') : null;
    const modalFrequency = eventModal ? document.getElementById('modal-frequency') : null;
    const modalStatus = eventModal ? document.getElementById('modal-status') : null;
    const modalEmailLink = eventModal ? document.getElementById('modal-email-link') : null;
    const closeModalButton = eventModal ? eventModal.querySelector('.close-button') : null;


    console.log("DOM Elements Selection Check:", {
        tableBodyExists: !!tableBody,
        searchInputExists: !!searchInput,
        kpiTotalReportsExists: !!kpiTotalReports,
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
        // Ensure dueDateStr is valid before creating a Date object
        if (!dueDateStr || typeof dueDateStr !== 'string' || !dueDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            console.error("Invalid dueDateStr received by getStatus:", dueDateStr);
            // Return a default status or handle error appropriately
            return { text: "خطأ في التاريخ", classForTable: "status-error", isPast: false, isNear: false, eventColors: { backgroundColor: 'red', borderColor: 'red', textColor: 'white' } };
        }
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

    function createMailtoLink(reportTitle) {
        const subject = encodeURIComponent(reportTitle);
        return `mailto:${targetEmail}?subject=${subject}`;
    }
    
    function createCharts(dataForCharts) {
        console.log("Attempting to create/update charts with data length:", dataForCharts ? dataForCharts.length : 'null');
        if (!dataForCharts || dataForCharts.length === 0 || !departmentChartCanvasEl || !frequencyChartCanvasEl) {
             console.warn("Chart creation skipped: no data or canvas element not found.", { hasData: !!dataForCharts && dataForCharts.length > 0, deptCanvas: !!departmentChartCanvasEl, freqCanvas: !!frequencyChartCanvasEl });
             if(departmentChartInstance) departmentChartInstance.destroy();
             if(frequencyChartInstance) frequencyChartInstance.destroy();
             chartsDrawn = false; 
            return;
        }
        const deptCtx = departmentChartCanvasEl.getContext('2d');
        const freqCtx = frequencyChartCanvasEl.getContext('2d');

        const deptCounts = dataForCharts.reduce((acc, report) => { acc[report[1]] = (acc[report[1]] || 0) + 1; return acc; }, {});
        const freqCounts = dataForCharts.reduce((acc, report) => { acc[report[3]] = (acc[report[3]] || 0) + 1; return acc; }, {});
        
        const goldColor = getThemeColor('--accent-gold', '#C89638'); 
        const blueColor = getThemeColor('--accent-blue', '#3498DB'); 
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
        console.log("Charts successfully created/updated.");
    }
    
    function populateTable(reportsToShow) {
        console.log("populateTable called. Reports to show:", reportsToShow ? reportsToShow.length : 'null/undefined');
        if (!tableBody) {
            console.error("populateTable: tableBody element not found!");
            return;
        }
        tableBody.innerHTML = ''; 
        if (!reportsToShow || reportsToShow.length === 0) {
            console.log("populateTable: No reports to show, displaying empty message.");
            tableBody.innerHTML = '<tr><td colspan="7">لا توجد تقارير تطابق البحث أو التصفية.</td></tr>';
            return;
        }
        
        reportsToShow.forEach((report, index) => {
            // Check if report is a valid array and has enough elements
            if (!Array.isArray(report) || report.length < 5) {
                console.error(`Invalid report data at index ${index}:`, report);
                return; // Skip this invalid report
            }

            const [id, department, title, frequency, dateString] = report;
            // console.log(`Processing report ID ${id}, dateString: ${dateString}`); // Log each dateString

            const statusInfo = getStatus(dateString); 
            
            // Crucial check: Ensure statusInfo is an object and has the isPast property
            if (!statusInfo || typeof statusInfo.isPast === 'undefined') {
                console.error(`Invalid statusInfo for report ID ${id}, dateString: ${dateString}`, statusInfo);
                // Skip this row or use default values
                return; 
            }

            const row = document.createElement('tr');
            if (statusInfo.isPast) {
                row.classList.add('past-due');
            }
            
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
        console.log("Table populated with (attempted) rows.");
    }

    function updateKPIs(currentBaseFilteredData, currentDateRangeFilteredData) {
        console.log("updateKPIs called. Base Data Length:", currentBaseFilteredData ? currentBaseFilteredData.length : 'N/A', 
                    "Date Range Data Length:", currentDateRangeFilteredData ? currentDateRangeFilteredData.length : 'N/A');

        if (!kpiTotalReports || !kpiDueInPeriod || !kpiDueToday || !kpiDue3Days || !kpiPastTotal) {
            console.error("One or more KPI DOM elements are missing for updateKPIs!");
            return;
        }
        
        kpiTotalReports.textContent = currentBaseFilteredData ? currentBaseFilteredData.length : '-';

        if (startDateInput && endDateInput && startDateInput.value && endDateInput.value) {
            kpiDueInPeriod.textContent = currentDateRangeFilteredData ? currentDateRangeFilteredData.length : '0';
        } else {
            kpiDueInPeriod.textContent = '-';
        }

        let dueTodayCount = 0;
        let due3DaysOnlyCount = 0; 
        if (currentDateRangeFilteredData) {
            currentDateRangeFilteredData.forEach(report => {
                if (!report || report.length < 5) return; // Skip invalid report
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
                if (!report || report.length < 5) return; // Skip invalid report
                const statusInfo = getStatus(report[4]);
                if (statusInfo && statusInfo.isPast) pastTotalCount++;
            });
        }
        kpiPastTotal.textContent = pastTotalCount;
        
        let nearNotificationCount = 0;
        if (currentBaseFilteredData) {
            currentBaseFilteredData.forEach(report => {
                 if (!report || report.length < 5) return; // Skip invalid report
                const statusInfo = getStatus(report[4]);
                if (statusInfo && statusInfo.isNear) nearNotificationCount++;
            });
        }
        if (notificationDot) {
            notificationDot.classList.toggle('hidden', nearNotificationCount === 0);
        } else {
            console.warn("Notification dot element not found");
        }
        console.log("KPIs updated. Total:", kpiTotalReports.textContent, "DuePeriod:", kpiDueInPeriod.textContent, "DueToday:", kpiDueToday.textContent);
    }

    function displayPagination(totalRows) { 
        console.log("displayPagination called. Total rows for pagination:", totalRows);
        if (!paginationControls) {
            console.error("Pagination controls element not found!");
            return;
        }
        paginationControls.innerHTML = '';
        const pageCount = Math.ceil(totalRows / rowsPerPage);
        if (pageCount <= 1) return;

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
        console.log("Pagination controls rendered.");
    }
    
    function renderCurrentPage() {
        console.log("--- renderCurrentPage Start --- Current Page:", currentPage);
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
        const selectedDept = departmentFilter ? departmentFilter.value : "all";
        const startDateValue = startDateInput ? startDateInput.value : "";
        const endDateValue = endDateInput ? endDateInput.value : "";

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
            if (!report || !Array.isArray(report) || report.length < 3) return false; // Basic check for report structure
            const matchesSearch = report[1].toLowerCase().includes(searchTerm) || 
                                  report[2].toLowerCase().includes(searchTerm);
            const matchesDept = (selectedDept === 'all') || (report[1] === selectedDept);
            return matchesSearch && matchesDept;
        });
        console.log("Base filtered data count:", baseFilteredData.length);

        dateRangeFilteredData = baseFilteredData.filter(report => {
            if (!report || !Array.isArray(report) || report.length < 5) return false;
            const reportDate = new Date(report[4]);
            if (isNaN(reportDate.getTime())) { // Check for invalid date
                console.warn("Invalid date in report, skipping for date filter:", report);
                return false;
            }
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
                console.error("Network response was not ok for data.json. Status:", response.status, response.statusText);
                if (tableBody) tableBody.innerHTML = `<tr><td colspan="7">فشل تحميل البيانات. الحالة: ${response.status}</td></tr>`;
                return;
            }
            allReportsData = await response.json();
            console.log("3. Data fetched and parsed. Total reports:", allReportsData ? allReportsData.length : 'undefined/null'); 
            
            if (Array.isArray(allReportsData) && allReportsData.length > 0) { // More robust check
                if(departmentFilter) populateFilter(allReportsData); 
                renderCurrentPage(); 
                console.log("4. Initial render triggered after data fetch.");
            } else {
                console.warn("No data received, data array is empty, or data is not an array after parsing.");
                if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">تم تحميل البيانات ولكنها فارغة أو بتنسيق غير صحيح.</td></tr>';
                // Initialize KPIs to 0 or '-' if no data
                updateKPIs([], []); 
            }
        } catch (error) {
            console.error('Fetch Error in fetchData:', error);
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="7">فشل تحميل البيانات: ${error.message}</td></tr>`;
            // Initialize KPIs to 0 or '-' on fetch error
            updateKPIs([], []);
        }
    }

    function handleFilterAndSearch() { /* ... unchanged ... */ }
    function resetDateFilter() { /* ... unchanged ... */ }
    function toggleTheme() { /* ... unchanged ... */ }
    function loadTheme() { /* ... unchanged ... */ }
    function initializeCalendar() { /* ... unchanged, but relies on allReportsData */ }
    function destroyCalendar() { /* ... unchanged ... */ }
    
    if(closeModalButton) closeModalButton.onclick = function() { eventModal.style.display = "none"; }
    window.onclick = function(event) { if (eventModal && event.target == eventModal) eventModal.style.display = "none"; } // Added null check

    function handleNavigation(event) {
        event.preventDefault();
        console.log("--- handleNavigation Start ---");
        const clickedLi = event.target.closest('li');
        if (!clickedLi) {
            console.log("Navigation ignored: clicked target is not an li or child of li");
             console.log("--- handleNavigation End (No li) ---");
            return;
        }
        if (clickedLi.classList.contains('active')) {
            console.log("Navigation ignored: clicked li is already active");
             console.log("--- handleNavigation End (Active) ---");
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
            console.log("View activated:", viewId);
        } else {
            console.error("Target view not found for ID:", `${viewId}-section`);
            console.log("--- handleNavigation End (Error View Not Found) ---");
            return; 
        }
        
        if (viewId === 'analytics') {
            console.log("Analytics tab clicked. Charts drawn previously:", chartsDrawn);
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
            console.log("Calendar tab clicked.");
            initializeCalendar(); 
        }
        console.log("--- handleNavigation End ---");
    }

    // Event Listeners (with null checks for robustness)
    if(searchInput) searchInput.addEventListener('input', handleFilterAndSearch);
    if(departmentFilter) departmentFilter.addEventListener('change', handleFilterAndSearch);
    if(startDateInput) startDateInput.addEventListener('change', handleFilterAndSearch);
    if(endDateInput) endDateInput.addEventListener('change', handleFilterAndSearch);
    if(resetDateBtn) resetDateBtn.addEventListener('click', resetDateFilter);
    if(themeSwitcherBtn) themeSwitcherBtn.addEventListener('click', toggleTheme);
    if(navLinks) navLinks.forEach(link => {
        if (link) link.addEventListener('click', handleNavigation);
    });

    // Initial Setup
    console.log("Running initial setup: loadTheme and fetchData");
    loadTheme();
    fetchData();

});
