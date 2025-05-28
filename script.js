document.addEventListener('DOMContentLoaded', () => {
    console.log("SCRIPT.JS LOADED AND DOMCONTENTLOADED FIRED!");

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

    function getThemeColor(cssVarName, fallbackColor) { /* ... as before ... */ }
    function getStatus(dueDateStr) { /* ... as before ... */ }
    function createMailtoLink(reportTitle) { /* ... as before ... */ }
    function createCharts(dataForCharts) { /* ... as before ... */ }
    function populateTable(reportsToShow) { /* ... as before ... */ }
    function updateKPIs(currentBaseFilteredData, currentDateRangeFilteredData) { /* ... as before ... */ }
    function displayPagination(totalRows) { /* ... as before ... */ }
    function populateFilter(data) { /* ... as before ... */ }
    function renderCurrentPage() { /* ... as before ... */ }
    
    async function fetchData() {
        console.log("fetchData: Initiating...");
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">جاري تحميل البيانات...</td></tr>';
        
        try {
            const response = await fetch(dataUrl);
            console.log("fetchData: Response received. Status:", response.status, "Ok:", response.ok);
            if (!response.ok) {
                throw new Error(`Network error (${response.status})`);
            }
            allReportsData = await response.json();
            console.log("fetchData: Data parsed. Length:", allReportsData ? allReportsData.length : 'N/A', ". IsArray:", Array.isArray(allReportsData)); 
            
            if (Array.isArray(allReportsData) && allReportsData.length > 0) {
                if(departmentFilter) { 
                    populateFilter(allReportsData); 
                } else { console.error("fetchData: departmentFilter element is NULL."); }
                renderCurrentPage(); 
                console.log("fetchData: Initial page render process complete.");
            } else {
                console.warn("fetchData: Data is empty or not an array after parsing.");
                if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">لا توجد بيانات للعرض.</td></tr>';
                updateKPIs([], []); 
            }
        } catch (error) {
            console.error('fetchData: CRITICAL ERROR:', error);
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="7">خطأ: ${error.message}</td></tr>`;
            updateKPIs([], []);
        }
    }

    function handleFilterAndSearch() { /* ... as before ... */ }
    function resetDateFilter() { /* ... as before ... */ }
    // Theme functions (toggleTheme, loadTheme) are REMOVED

    function initializeCalendar() {
        console.log("initializeCalendar: CALLED. Initialized Flag:", calendarInitialized, "Calendar Element:", !!calendarEl);
        if (!calendarEl) {
            console.error("initializeCalendar: calendarEl is NULL.");
            return;
        }
        if (!Array.isArray(allReportsData) || allReportsData.length === 0) {
            console.warn("initializeCalendar: allReportsData is empty. Cannot populate calendar.");
            calendarEl.innerHTML = "<p style='text-align:center; padding:20px;'>لا توجد بيانات أساسية لعرضها في التقويم.</p>";
            if (calendarInstance) { calendarInstance.destroy(); calendarInstance = null; calendarInitialized = false;}
            return;
        }
        calendarEl.innerHTML = ''; 

        const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
        const selectedDept = departmentFilter ? departmentFilter.value : "all";
        
        const dataForCalendar = allReportsData.filter(report => {
            if (!report || !Array.isArray(report) || report.length < 3) return false;
            const reportDept = String(report[1] || ""); 
            const reportTitle = String(report[2] || ""); 
            const matchesSearch = reportDept.toLowerCase().includes(searchTerm) || 
                                  reportTitle.toLowerCase().includes(searchTerm);
            const matchesDept = (selectedDept === 'all') || (reportDept === selectedDept);
            return matchesSearch && matchesDept;
        });
        console.log("initializeCalendar: Data for calendar (after current search/dept filter). Count:", dataForCalendar.length);

        const calendarEvents = dataForCalendar.map((report, index) => {
            if (!Array.isArray(report) || report.length < 5) { 
                // console.warn(`initializeCalendar: Skipping invalid report structure at index ${index}:`, report);
                return null; 
            }
            const reportId = report[0];
            const reportTitle = report[2];
            const reportDate = report[4];
            
            const statusInfo = getStatus(reportDate); 
            
            if (!statusInfo || !statusInfo.eventColors || typeof statusInfo.text !== 'string') { 
                console.warn(`initializeCalendar: Invalid statusInfo for report ID ${reportId}. date: ${reportDate}, statusInfo:`, JSON.stringify(statusInfo));
                return null; 
            }
            // console.log(`initializeCalendar: Event for ID ${reportId}: Title: ${reportTitle}, Start: ${reportDate}, Colors:`, statusInfo.eventColors);
            return {
                id: String(reportId), // Ensure ID is a string for FullCalendar
                title: reportTitle, 
                start: reportDate, 
                allDay: true,
                backgroundColor: statusInfo.eventColors.backgroundColor,
                borderColor: statusInfo.eventColors.borderColor,
                textColor: statusInfo.eventColors.textColor,
                extendedProps: { 
                    id:reportId, 
                    department: report[1], 
                    frequency: report[3], 
                    statusText: statusInfo.text, 
                    fullReport: report 
                }
            };
        }).filter(event => event !== null); 

        console.log("initializeCalendar: Processed calendarEvents array. Final Count:", calendarEvents.length);
        if (calendarEvents.length > 0) {
            // console.log("initializeCalendar: Sample of first processed calendarEvent:", JSON.stringify(calendarEvents[0]));
        } else if (dataForCalendar.length > 0) {
             console.warn("initializeCalendar: Had data for calendar ("+ dataForCalendar.length +") but NO valid events were created.");
        }


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
            console.log("initializeCalendar: Calendar RENDERED successfully with", calendarEvents.length, "events.");
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
        // console.log("--- handleNavigation START ---");
        const clickedLi = event.target.closest('li[data-view]');
        if (!clickedLi) { return; }
        
        const viewId = clickedLi.dataset.view;
        // console.log("handleNavigation: Navigating to viewId:", viewId);

        if(navLinks) navLinks.forEach(link => link.classList.remove('active'));
        if(views) views.forEach(view => view.classList.remove('active-view'));
        
        if(clickedLi) clickedLi.classList.add('active');
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
        // console.log("--- handleNavigation END for view:", viewId, "---");
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

    // Initial Setup
    console.log("Running initial setup: Fetching data (Theme functions removed).");
    // Removed loadTheme()
    fetchData();

});
