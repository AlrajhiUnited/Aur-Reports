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

    function getThemeColor(cssVarName, fallbackColor) { /* ... same ... */ }
    function getStatus(dueDateStr) { /* ... same ... */ }
    function createMailtoLink(reportTitle) { /* ... same with email body ... */ }
    function createCharts(dataForCharts) { /* ... same ... */ }
    function populateTable(reportsToShow) { /* ... same ... */ }
    function updateKPIs(currentBaseFilteredData, currentDateRangeFilteredData) { /* ... same ... */ }
    function displayPagination(totalRows) { /* ... same ... */ }
    function populateFilter(data) { /* ... same ... */ }
    
    function renderCurrentPage() {
        console.log("--- renderCurrentPage START ---");
        if (!allReportsData || !Array.isArray(allReportsData) || allReportsData.length === 0) {
            console.warn("renderCurrentPage: allReportsData is empty or not an array. Aborting.");
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">لا توجد بيانات أساسية لعرضها.</td></tr>';
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
            if (!report || !Array.isArray(report) || report.length < 3) return false;
            const deptMatch = (selectedDept === 'all') || (report[1] === selectedDept);
            const searchMatch = (report[1] && String(report[1]).toLowerCase().includes(searchTerm)) || 
                                (report[2] && String(report[2]).toLowerCase().includes(searchTerm));
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
        if (paginationControls) displayPagination(dateRangeFilteredData.length);
        updateKPIs(baseFilteredData, dateRangeFilteredData); 
        console.log("--- renderCurrentPage END --- Table & KPIs updated.");
    }
    
    async function fetchData() {
        console.log("fetchData: Initiating...");
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
            console.log("fetchData: Data parsed successfully. Length:", allReportsData ? allReportsData.length : 'N/A'); 
            
            if (Array.isArray(allReportsData) && allReportsData.length > 0) {
                console.log("fetchData: Data is valid. Populating filter and rendering initial page.");
                if(departmentFilter) { populateFilter(allReportsData); }
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

    function handleFilterAndSearch() {
        console.log("handleFilterAndSearch: User interaction triggered.");
        currentPage = 1; 
        renderCurrentPage();
    }
    function resetDateFilter() {
        if (startDateInput) startDateInput.value = '';
        if (endDateInput) endDateInput.value = '';
        handleFilterAndSearch();
        console.log("resetDateFilter: Dates reset and page re-rendered.");
    }
    
    function toggleTheme() {
        console.log("toggleTheme: Called. Current dark mode class:", document.body.classList.contains('dark-mode'));
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        if (themeIcon) themeIcon.className = isDarkMode ? 'fas fa-moon' : 'fas fa-sun';
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        console.log("toggleTheme: Theme set to", isDarkMode ? 'dark' : 'light', "Icon class:", themeIcon ? themeIcon.className : 'N/A');
        
        // Re-render charts and calendar for theme change
        const activeViewId = document.querySelector('.sidebar ul li.active')?.dataset.view;
        if (activeViewId === 'analytics' && chartsDrawn) {
            console.log("toggleTheme: Re-creating analytics charts for new theme.");
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
        if (activeViewId === 'calendar' && calendarInitialized) {
            console.log("toggleTheme: Re-initializing calendar for new theme.");
            initializeCalendar(); 
        }
    }

    function loadTheme() {
        console.log("loadTheme: Called.");
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            if (themeIcon) themeIcon.className = 'fas fa-moon';
            console.log("loadTheme: Dark theme loaded from localStorage.");
        } else {
            document.body.classList.remove('dark-mode'); 
            if (themeIcon) themeIcon.className = 'fas fa-sun';
            console.log("loadTheme: Light theme applied (or default).");
        }
    }

    function initializeCalendar() {
        console.log("initializeCalendar: Called. Initialized previously:", calendarInitialized, "Calendar Element:", !!calendarEl);
        if (!calendarEl) {
            console.error("initializeCalendar: Calendar placeholder element (#calendar-placeholder) not found!");
            return;
        }
        if (!Array.isArray(allReportsData) || allReportsData.length === 0) {
            console.warn("initializeCalendar: No data in allReportsData to display on calendar.");
            calendarEl.innerHTML = "<p style='text-align:center; padding:20px;'>لا توجد بيانات لعرضها في التقويم حالياً.</p>";
            if (calendarInstance) calendarInstance.destroy();
            calendarInstance = null;
            calendarInitialized = false;
            return;
        }
        calendarEl.innerHTML = ''; // Clear placeholder text

        const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
        const selectedDept = departmentFilter ? departmentFilter.value : "all";
        const calendarData = allReportsData.filter(report => {
            if (!report || !Array.isArray(report) || report.length < 3) return false;
            const matchesSearch = (report[1] && String(report[1]).toLowerCase().includes(searchTerm)) || 
                                  (report[2] && String(report[2]).toLowerCase().includes(searchTerm));
            const matchesDept = (selectedDept === 'all') || (report[1] === selectedDept);
            return matchesSearch && matchesDept;
        });
        console.log("initializeCalendar: Data for calendar (after search/dept filter):", calendarData.length);
        // console.log("Sample calendarData for FullCalendar:", JSON.stringify(calendarData.slice(0, 2)));


        const calendarEvents = calendarData.map(report => {
            if (!report || !Array.isArray(report) || report.length < 5) {
                console.warn("initializeCalendar: Invalid report structure for calendar event", report);
                return null; 
            }
            const statusInfo = getStatus(report[4]);
            if (!statusInfo || !statusInfo.eventColors) { // Added check for eventColors
                console.warn("initializeCalendar: statusInfo or eventColors missing for report", report);
                return null;
            }
            return {
                id: report[0], title: report[2], start: report[4], allDay: true,
                backgroundColor: statusInfo.eventColors.backgroundColor,
                borderColor: statusInfo.eventColors.borderColor,
                textColor: statusInfo.eventColors.textColor,
                extendedProps: { id: report[0], department: report[1], frequency: report[3], statusText: statusInfo.text, fullReport: report }
            };
        }).filter(event => event !== null); 

        console.log("initializeCalendar: Processed calendarEvents count:", calendarEvents.length);
        // console.log("Sample calendarEvents for FullCalendar:", JSON.stringify(calendarEvents.slice(0,2)));

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
            eventClick: function(info) {
                const props = info.event.extendedProps;
                const reportDetails = props.fullReport; // Get the full report data
                if (modalTitle) modalTitle.textContent = info.event.title;
                if (modalDepartment) modalDepartment.textContent = props.department;
                const eventStartDate = new Date(info.event.startStr);
                if (modalDate) modalDate.textContent = eventStartDate.toLocaleDateString('ar-SA-u-nu-arab', { year: 'numeric', month: 'long', day: 'numeric' });
                if (modalFrequency) modalFrequency.textContent = props.frequency;
                if (modalStatus) modalStatus.textContent = props.statusText; 
                if (modalEmailLink) modalEmailLink.href = createMailtoLink(info.event.title);
                if (eventModal) eventModal.style.display = "block";
            }
        });
        calendarInstance.render();
        calendarInitialized = true; 
        console.log("initializeCalendar: Calendar rendered/updated successfully.");
    }

    function destroyCalendar() { 
        if (calendarInstance) {
            calendarInstance.destroy();
            calendarInstance = null;
            console.log("destroyCalendar: Calendar instance destroyed.");
        }
        calendarInitialized = false; 
     }
    
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
