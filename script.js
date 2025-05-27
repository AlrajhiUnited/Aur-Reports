document.addEventListener('DOMContentLoaded', () => {
    console.log("SCRIPT.JS LOADED AND DOMCONTENTLOADED FIRED!");

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
        const defaultErrorStatus = { text: "تاريخ غير صالح", classForTable: "status-error", isPast: false, isNear: false, eventColors: { backgroundColor: 'lightgray', borderColor: 'gray', textColor: 'black' } };
        if (!dueDateStr || typeof dueDateStr !== 'string' || !dueDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return defaultErrorStatus;
        }
        const due = new Date(dueDateStr);
        if (isNaN(due.getTime())) { return defaultErrorStatus; }
        due.setHours(0, 0, 0, 0);

        // Use direct hex or well-defined CSS vars for event colors for reliability
        const pastEventColors = { backgroundColor: '#E9ECEF', borderColor: '#D0D0D0', textColor: '#6C757D' };
        const dueTodayEventColors = { backgroundColor: '#bd9a5f', borderColor: '#bd9a5f', textColor: '#FFFFFF' }; // Muted Gold
        const upcomingEventColors = { backgroundColor: '#AEC6CF', borderColor: '#AEC6CF', textColor: '#2C3E50' }; // Pastel Blue/Grey
        const futureEventColors = { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0', textColor: '#6C757D' };

        if (due < today) return { text: "منتهي", classForTable: "status-past", isPast: true, isNear: false, eventColors: pastEventColors };
        if (due.getTime() === today.getTime()) return { text: "مستحق اليوم", classForTable: "status-due", isPast: false, isNear: true, eventColors: dueTodayEventColors };
        if (due > today && due <= threeDaysLater) return { text: "قادم قريباً", classForTable: "status-upcoming", isPast: false, isNear: true, eventColors: upcomingEventColors };
        return { text: "قادم", classForTable: "status-future", isPast: false, isNear: false, eventColors: futureEventColors };
    }

    function createMailtoLink(reportTitle) { /* ... same ... */ }
    
    function createCharts(dataForCharts) {
         if (!dataForCharts || dataForCharts.length === 0 || !departmentChartCanvasEl || !frequencyChartCanvasEl) {
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
        const blueColorForPie = getThemeColor('--accent-blue', '#AEC6CF'); // Using the subdued blue for pie
        const primaryDarkColor = getThemeColor('--primary-dark-light', '#2C3E50');
        const mutedGoldColor = getThemeColor('--accent-gold-muted', '#bd9a5f');
        const greyColor = getThemeColor('--past-due-color', '#95A5A6');
        const redColor = getThemeColor('--accent-red', '#E74C3C');
        const chartPieColors = [goldColor, blueColorForPie, primaryDarkColor, mutedGoldColor, greyColor, redColor];

        if(departmentChartInstance) departmentChartInstance.destroy();
        if(frequencyChartInstance) frequencyChartInstance.destroy();

        departmentChartInstance = new Chart(deptCtx, { type: 'pie', data: { labels: Object.keys(deptCounts), datasets: [{ data: Object.values(deptCounts), backgroundColor: chartPieColors }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } } });
        frequencyChartInstance = new Chart(freqCtx, { type: 'bar', data: { labels: Object.keys(freqCounts), datasets: [{ label: 'عدد التقارير', data: Object.values(freqCounts), backgroundColor: goldColor }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
        chartsDrawn = true;
    }
    
    function populateTable(reportsToShow) {
        if (!tableBody) { return; }
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
            row.innerHTML = `
                <td>${id !== undefined ? id : ''}</td>
                <td>${department !== undefined ? department : ''}</td>
                <td>${title !== undefined ? title : ''}</td>
                <td>${frequency !== undefined ? frequency : ''}</td>
                <td>${dateString !== undefined ? dateString : ''}</td>
                <td><span class="status-tag ${statusInfo.classForTable}">${statusInfo.text}</span></td>
                <td><a href="${createMailtoLink(title || '')}" class="icon-button" title="إرسال بريد"><i class="fas fa-envelope"></i></a></td>
            `;
            tableBody.appendChild(row);
        });
    }

    function updateKPIs(currentBaseFilteredData, currentDateRangeFilteredData) { /* ... same ... */ }
    function displayPagination(totalRows) { /* ... same ... */ }
    
    function renderCurrentPage() {
        if (!allReportsData || !Array.isArray(allReportsData)) { // Added check for allReportsData being an array
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">خطأ: البيانات الأساسية غير محملة أو غير صالحة.</td></tr>';
            updateKPIs([], []); 
            if (paginationControls) displayPagination(0); 
            return;
        }
        // ... (rest of the function as in previous version)
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
    }
    
    function populateFilter(data) { /* ... same ... */ }

    async function fetchData() {
        console.log("fetchData: Initiating...");
        if (!tableBody) { console.error("fetchData: tableBody is NULL at start."); } 
        else { tableBody.innerHTML = '<tr><td colspan="7">جاري تحميل البيانات...</td></tr>'; }
        try {
            const response = await fetch(dataUrl);
            if (!response.ok) {
                console.error("fetchData: Network error! Status:", response.status);
                if (tableBody) tableBody.innerHTML = `<tr><td colspan="7">فشل تحميل البيانات.</td></tr>`;
                updateKPIs([], []); 
                return; 
            }
            allReportsData = await response.json();
            console.log("fetchData: Data parsed. Length:", allReportsData ? allReportsData.length : 'N/A'); 
            
            if (Array.isArray(allReportsData) && allReportsData.length > 0) {
                if(departmentFilter) { populateFilter(allReportsData); }
                renderCurrentPage(); 
                console.log("fetchData: Initial render complete.");
            } else {
                if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">لا توجد بيانات.</td></tr>';
                updateKPIs([], []); 
            }
        } catch (error) {
            console.error('fetchData: CRITICAL ERROR:', error);
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="7">خطأ: ${error.message}</td></tr>`;
            updateKPIs([], []);
        }
    }

    function handleFilterAndSearch() { currentPage = 1; renderCurrentPage(); }
    function resetDateFilter() { /* ... same ... */ }
    
    function toggleTheme() {
        console.log("toggleTheme: Called. Current body classList:", document.body.classList.toString());
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        if (themeIcon) themeIcon.className = isDarkMode ? 'fas fa-moon' : 'fas fa-sun';
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        console.log("toggleTheme: Theme set to ->", isDarkMode ? 'dark' : 'light', ". New body classList:", document.body.classList.toString());
        
        const activeViewId = document.querySelector('.sidebar ul li.active')?.dataset.view;
        if (activeViewId === 'analytics' && chartsDrawn) {
            console.log("toggleTheme: Re-creating analytics charts for new theme.");
            const currentSearchTerm = searchInput ? searchInput.value.toLowerCase() : "";
            const currentSelectedDept = departmentFilter ? departmentFilter.value : "all";
            const chartData = allReportsData.filter(report => { /* ... filter logic ... */ });
            createCharts(chartData);
        }
        if (activeViewId === 'calendar' && calendarInitialized) {
            console.log("toggleTheme: Re-initializing calendar for new theme.");
            initializeCalendar(); 
        }
    }

    function loadTheme() {
        console.log("loadTheme: Called.");
        const savedTheme = localStorage.getItem('theme');
        console.log("loadTheme: Saved theme from localStorage:", savedTheme);
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            if (themeIcon) themeIcon.className = 'fas fa-moon';
        } else {
            document.body.classList.remove('dark-mode'); 
            if (themeIcon) themeIcon.className = 'fas fa-sun';
        }
        console.log("loadTheme: Applied theme. Body classList:", document.body.classList.toString());
    }

    function initializeCalendar() {
        console.log("initializeCalendar: Called. Initialized:", calendarInitialized, "Element:", !!calendarEl);
        if (!calendarEl) { console.error("initializeCalendar: Calendar placeholder NOT FOUND!"); return; }
        if (!Array.isArray(allReportsData) || allReportsData.length === 0) {
            console.warn("initializeCalendar: No allReportsData to display.");
            calendarEl.innerHTML = "<p style='text-align:center; padding:20px;'>لا توجد بيانات لعرضها في التقويم.</p>";
            if (calendarInstance) { calendarInstance.destroy(); calendarInstance = null; calendarInitialized = false;}
            return;
        }
        calendarEl.innerHTML = ''; 

        const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
        const selectedDept = departmentFilter ? departmentFilter.value : "all";
        const calendarData = allReportsData.filter(report => {
            if (!report || !Array.isArray(report) || report.length < 3) return false;
            const matchesSearch = (report[1] && String(report[1]).toLowerCase().includes(searchTerm)) || 
                                  (report[2] && String(report[2]).toLowerCase().includes(searchTerm));
            const matchesDept = (selectedDept === 'all') || (report[1] === selectedDept);
            return matchesSearch && matchesDept;
        });
        console.log("initializeCalendar: Filtered data for calendar. Count:", calendarData.length);

        const calendarEvents = calendarData.map(report => {
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
        // console.log("initializeCalendar: Sample event:", calendarEvents.length > 0 ? JSON.stringify(calendarEvents[0]) : "No events");


        if (calendarInstance) calendarInstance.destroy();
        calendarInstance = new FullCalendar.Calendar(calendarEl, { /* ... options as before ... */ });
        try {
            calendarInstance.render();
            calendarInitialized = true; 
            console.log("initializeCalendar: Calendar rendered successfully.");
        } catch (e) {
            console.error("initializeCalendar: Error during FullCalendar render:", e);
        }
    }

    function destroyCalendar() { /* ... same ... */ }
    if(closeModalButton) closeModalButton.onclick = function() { if(eventModal) eventModal.style.display = "none"; }
    if(eventModal) window.onclick = function(event) { if (eventModal && event.target == eventModal) eventModal.style.display = "none"; }

    function handleNavigation(event) {
        event.preventDefault();
        // console.log("--- handleNavigation START ---");
        const clickedLi = event.target.closest('li[data-view]');
        if (!clickedLi || clickedLi.classList.contains('active')) return;
        const viewId = clickedLi.dataset.view;
        // console.log("handleNavigation: Navigating to:", viewId);
        if(navLinks) navLinks.forEach(link => link.classList.remove('active'));
        if(views) views.forEach(view => view.classList.remove('active-view'));
        clickedLi.classList.add('active');
        const targetView = document.getElementById(`${viewId}-section`);
        if (targetView) targetView.classList.add('active-view'); else return; 
        
        if (viewId === 'analytics') { createCharts(baseFilteredData);  } // Use baseFiltered for general analytics
        if (viewId === 'calendar') { initializeCalendar(); }
        // console.log("--- handleNavigation END ---");
    }

    // Event Listeners
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
    loadTheme();
    fetchData();

});