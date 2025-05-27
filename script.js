document.addEventListener('DOMContentLoaded', () => {
    console.log("SCRIPT.JS LOADED. DOMContentLoaded event fired.");

    // --- DOM Elements ---
    const tableBody = document.getElementById('reports-table-body');
    const searchInput = document.getElementById('search-input');
    // Removed themeSwitcherBtn and themeIcon
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

    console.log("Initial 'today' date for logic:", today.toISOString().split('T')[0]);

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
        const normalizedDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());

        const pastEvent = { backgroundColor: '#E9ECEF', borderColor: '#D0D0D0', textColor: '#6C757D' };
        const dueTodayEvent = { backgroundColor: getThemeColor('--accent-gold-muted', '#bd9a5f'), borderColor: getThemeColor('--accent-gold-muted', '#bd9a5f'), textColor: '#FFFFFF' };
        const upcomingEvent = { backgroundColor: getThemeColor('--accent-blue', '#AEC6CF'), borderColor: getThemeColor('--accent-blue', '#AEC6CF'), textColor: getThemeColor('--primary-dark-light', '#2C3E50') };
        const futureEvent = { backgroundColor: getThemeColor('--accent-green', '#F5F5F5'), borderColor: '#E0E0E0', textColor: '#6C757D' };

        if (normalizedDue < today) return { text: "منتهي", classForTable: "status-past", isPast: true, isNear: false, eventColors: pastEvent };
        if (normalizedDue.getTime() === today.getTime()) return { text: "مستحق اليوم", classForTable: "status-due", isPast: false, isNear: true, eventColors: dueTodayEvent };
        if (normalizedDue > today && normalizedDue <= threeDaysLater) return { text: "قادم قريباً", classForTable: "status-upcoming", isPast: false, isNear: true, eventColors: upcomingEvent };
        return { text: "قادم", classForTable: "status-future", isPast: false, isNear: false, eventColors: futureEvent };
    }

    function createMailtoLink(reportTitle) { /* ... unchanged ... */ }
    
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
        const blueColorOriginal = getThemeColor('--accent-blue', '#3498DB'); 
        const primaryDarkColor = getThemeColor('--primary-dark-light', '#2C3E50');
        const mutedGoldColor = getThemeColor('--accent-gold-muted', '#bd9a5f');
        const greyColor = getThemeColor('--past-due-color', '#95A5A6');
        const redColor = getThemeColor('--accent-red', '#E74C3C');
        const chartPieColors = [goldColor, blueColorOriginal, primaryDarkColor, mutedGoldColor, greyColor, redColor];

        if(departmentChartInstance) departmentChartInstance.destroy();
        if(frequencyChartInstance) frequencyChartInstance.destroy();
        departmentChartInstance = new Chart(deptCtx, { type: 'pie', data: { labels: Object.keys(deptCounts), datasets: [{ data: Object.values(deptCounts), backgroundColor: chartPieColors }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } } });
        frequencyChartInstance = new Chart(freqCtx, { type: 'bar', data: { labels: Object.keys(freqCounts), datasets: [{ label: 'عدد التقارير', data: Object.values(freqCounts), backgroundColor: goldColor }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
        chartsDrawn = true;
    }
    
    function populateTable(reportsToShow) {
        // console.log("populateTable: Reports count:", reportsToShow ? reportsToShow.length : '0');
        if (!tableBody) { console.error("populateTable: tableBody is NULL."); return; }
        tableBody.innerHTML = ''; 
        if (!reportsToShow || reportsToShow.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7">لا توجد تقارير تطابق البحث أو التصفية.</td></tr>';
            return;
        }
        reportsToShow.forEach((report) => {
            if (!Array.isArray(report) || report.length < 5) { return; }
            const [id, department, title, frequency, dateString] = report;
            const statusInfo = getStatus(dateString); 
            if (!statusInfo || typeof statusInfo.classForTable === 'undefined') { return; }
            const row = document.createElement('tr');
            if (statusInfo.isPast) row.classList.add('past-due');
            row.innerHTML = `
                <td>${id || ''}</td> <td>${department || ''}</td> <td>${title || ''}</td>
                <td>${frequency || ''}</td> <td>${dateString || ''}</td>
                <td><span class="status-tag ${statusInfo.classForTable}">${statusInfo.text}</span></td>
                <td><a href="${createMailtoLink(title || '')}" class="icon-button" title="إرسال بريد"><i class="fas fa-envelope"></i></a></td>
            `;
            tableBody.appendChild(row);
        });
    }

    function updateKPIs(currentBaseFilteredData, currentDateRangeFilteredData) {
        // console.log("updateKPIs: BaseData:", currentBaseFilteredData.length, "DateRangeData:", currentDateRangeFilteredData.length);
        if (!kpiTotalReports || !kpiDueInPeriod || !kpiDueToday || !kpiDue3Days || !kpiPastTotal) { return; }
        
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

    function displayPagination(totalRows) { /* ... unchanged ... */ }
    function populateFilter(data) { /* ... unchanged ... */ }
    
    function renderCurrentPage() {
        console.log("--- renderCurrentPage START ---");
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
        
        baseFilteredData = allReportsData.filter(report => {
            if (!report || !Array.isArray(report) || report.length < 3 || typeof report[1] !== 'string' || typeof report[2] !== 'string') return false;
            const deptMatch = (selectedDept === 'all') || (report[1] === selectedDept);
            const searchMatch = (report[1].toLowerCase().includes(searchTerm)) || 
                                (report[2].toLowerCase().includes(searchTerm));
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
        console.log("--- renderCurrentPage END --- Table & KPIs updated.");
    }
    
    async function fetchData() {
        console.log("fetchData: Initiating...");
        if (!tableBody) { console.error("fetchData: tableBody is NULL at start."); } 
        else { tableBody.innerHTML = '<tr><td colspan="7">جاري تحميل البيانات...</td></tr>'; }
        try {
            const response = await fetch(dataUrl);
            console.log("fetchData: Response received. Status:", response.status, "Ok:", response.ok);
            if (!response.ok) {
                console.error("fetchData: Network error! Status:", response.status);
                if (tableBody) tableBody.innerHTML = `<tr><td colspan="7">فشل تحميل البيانات.</td></tr>`;
                updateKPIs([], []); 
                return; 
            }
            allReportsData = await response.json();
            console.log("fetchData: Data parsed successfully. Length:", allReportsData ? allReportsData.length : 'N/A'); 
            
            if (Array.isArray(allReportsData) && allReportsData.length > 0) {
                if(departmentFilter) { populateFilter(allReportsData); }
                renderCurrentPage(); 
                console.log("fetchData: Initial page render process complete.");
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

    function handleFilterAndSearch() { /* ... unchanged ... */ }
    function resetDateFilter() { /* ... unchanged ... */ }
    
    // Removed toggleTheme and loadTheme functions

    function initializeCalendar() {
        console.log("initializeCalendar: Called. Initialized:", calendarInitialized, "Calendar Element:", !!calendarEl);
        if (!calendarEl) { console.error("initializeCalendar: Calendar placeholder is NULL."); return; }
        if (!Array.isArray(allReportsData) || allReportsData.length === 0) {
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
        console.log("initializeCalendar: Data for calendar (filtered):", calendarData.length);

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

        console.log("initializeCalendar: Processed calendarEvents count:", calendarEvents.length);

        if (calendarInstance) calendarInstance.destroy();
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
            eventClick: function(info) { /* ... unchanged ... */ }
        });
        try {
            calendarInstance.render();
            calendarInitialized = true; 
            console.log("initializeCalendar: Calendar rendered successfully.");
        } catch (e) {
            console.error("initializeCalendar: Error during FullCalendar render:", e);
        }
    }

    function destroyCalendar() { /* ... unchanged ... */ }
    
    if(closeModalButton) closeModalButton.onclick = function() { if(eventModal) eventModal.style.display = "none"; }
    if(eventModal) window.onclick = function(event) { if (eventModal && event.target == eventModal) eventModal.style.display = "none"; }

    function handleNavigation(event) {
        event.preventDefault();
        console.log("--- handleNavigation START --- Target:", event.target.closest('li[data-view]'));
        const clickedLi = event.target.closest('li[data-view]');
        if (!clickedLi) { return; }
        // if (clickedLi.classList.contains('active')) { return; } // Allow re-clicking to refresh calendar/charts

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
            const currentSearchTerm = searchInput ? searchInput.value.toLowerCase() : "";
            const currentSelectedDept = departmentFilter ? departmentFilter.value : "all";
            const chartData = allReportsData.filter(report => { /* ... */ });
            createCharts(chartData); 
        }

        if (viewId === 'calendar') {
            initializeCalendar(); 
        }
        console.log("--- handleNavigation END for view:", viewId, "---");
    }

    // Event Listeners
    if(searchInput) searchInput.addEventListener('input', handleFilterAndSearch);
    if(departmentFilter) departmentFilter.addEventListener('change', handleFilterAndSearch);
    if(startDateInput) startDateInput.addEventListener('change', handleFilterAndSearch);
    if(endDateInput) endDateInput.addEventListener('change', handleFilterAndSearch);
    if(resetDateBtn) resetDateBtn.addEventListener('click', resetDateFilter);
    // Removed themeSwitcherBtn listener
    if(navLinks && navLinks.length > 0) {
        navLinks.forEach((link) => { if (link) link.addEventListener('click', handleNavigation); });
    }

    // Initial Setup (No loadTheme call)
    console.log("Running initial setup: fetchData. Current Time:", new Date().toLocaleTimeString());
    fetchData();

});