document.addEventListener('DOMContentLoaded', () => {
    console.log("SCRIPT.JS LOADED AND DOMCONTENTLOADED FIRED! Current Time:", new Date().toLocaleTimeString());

    // --- DOM Elements ---
    const tableBody = document.getElementById('reports-table-body');
    const searchInput = document.getElementById('search-input');
    // Theme switcher elements are removed as per previous decision
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
        const defaultEventColors = { backgroundColor: 'rgba(128,128,128,0.5)', borderColor: 'gray', textColor: 'black' }; // Default error event color
        const defaultReturn = { 
            text: "تاريخ غير صالح", 
            classForTable: "status-error", 
            isPast: false, 
            isNear: false, 
            eventColors: defaultEventColors 
        };

        if (!dueDateStr || typeof dueDateStr !== 'string' || !dueDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // console.warn("getStatus: Invalid dueDateStr format or type:", dueDateStr);
            return defaultReturn;
        }
        
        const due = new Date(dueDateStr);
        if (isNaN(due.getTime())) {
            // console.warn("getStatus: Failed to parse dueDateStr into valid date object:", dueDateStr);
            return defaultReturn;
        }
        const normalizedDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());

        const pastEvent = { backgroundColor: '#E9ECEF', borderColor: '#D0D0D0', textColor: '#6C757D' };
        const dueTodayEvent = { backgroundColor: getThemeColor('--accent-gold-muted', '#bd9a5f'), borderColor: getThemeColor('--accent-gold-muted', '#bd9a5f'), textColor: '#FFFFFF' };
        const upcomingEvent = { backgroundColor: getThemeColor('--accent-blue-calendar-event', '#AEC6CF'), borderColor: getThemeColor('--accent-blue-calendar-event', '#AEC6CF'), textColor: getThemeColor('--primary-dark-light', '#2C3E50') };
        const futureEvent = { backgroundColor: getThemeColor('--accent-green-event', '#F5F5F5'), borderColor: '#E0E0E0', textColor: '#6C757D' };

        if (normalizedDue < today) return { text: "منتهي", classForTable: "status-past", isPast: true, isNear: false, eventColors: pastEvent };
        if (normalizedDue.getTime() === today.getTime()) return { text: "مستحق اليوم", classForTable: "status-due", isPast: false, isNear: true, eventColors: dueTodayEvent };
        if (normalizedDue > today && normalizedDue <= threeDaysLater) return { text: "قادم قريباً", classForTable: "status-upcoming", isPast: false, isNear: true, eventColors: upcomingEvent };
        return { text: "قادم", classForTable: "status-future", isPast: false, isNear: false, eventColors: futureEvent };
    }

    function createMailtoLink(reportTitle) { /* ... unchanged ... */ }
    function createCharts(dataForCharts) { /* ... unchanged ... */ }
    function populateTable(reportsToShow) { /* ... unchanged ... */ }
    function updateKPIs(currentBaseFilteredData, currentDateRangeFilteredData) { /* ... unchanged ... */ }
    function displayPagination(totalRows) { /* ... unchanged ... */ }
    function populateFilter(data) { /* ... unchanged ... */ }
    function renderCurrentPage() { /* ... unchanged with previous console.logs ... */ }
    async function fetchData() { /* ... unchanged with previous console.logs ... */ }
    function handleFilterAndSearch() { /* ... unchanged ... */ }
    function resetDateFilter() { /* ... unchanged ... */ }
    // Removed toggleTheme and loadTheme

    function initializeCalendar() {
        console.log("initializeCalendar: CALLED. Calendar Initialized Flag:", calendarInitialized, "Calendar Element:", !!calendarEl);
        if (!calendarEl) {
            console.error("initializeCalendar: calendarEl is NULL. Cannot initialize.");
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
        
        console.log("initializeCalendar: Current filters for calendar data - Search:", searchTerm, "Dept:", selectedDept);

        const calendarData = allReportsData.filter(report => {
            if (!report || !Array.isArray(report) || report.length < 3) return false;
            const reportDept = String(report[1] || ""); // Ensure report[1] is a string
            const reportTitle = String(report[2] || ""); // Ensure report[2] is a string
            const matchesSearch = reportDept.toLowerCase().includes(searchTerm) || 
                                  reportTitle.toLowerCase().includes(searchTerm);
            const matchesDept = (selectedDept === 'all') || (reportDept === selectedDept);
            return matchesSearch && matchesDept;
        });
        console.log("initializeCalendar: Data for calendar (after search/dept filter). Count:", calendarData.length);
        // if (calendarData.length > 0) console.log("initializeCalendar: Sample of calendarData[0]:", JSON.stringify(calendarData[0]));


        const calendarEvents = calendarData.map((report, index) => {
            console.log(`initializeCalendar: Processing report index ${index} for event:`, report);
            if (!Array.isArray(report) || report.length < 5) { 
                console.warn(`initializeCalendar: Skipping invalid report structure at index ${index}:`, report);
                return null; 
            }
            const reportId = report[0];
            const reportTitle = report[2];
            const reportDate = report[4];
            
            console.log(`initializeCalendar: Report ID ${reportId}, Date ${reportDate}, Title ${reportTitle}`);

            const statusInfo = getStatus(reportDate); // report[4] is the date string
            
            console.log(`initializeCalendar: For report ID ${reportId}, statusInfo:`, JSON.stringify(statusInfo));

            if (!statusInfo || !statusInfo.eventColors || typeof statusInfo.text !== 'string') { 
                console.warn(`initializeCalendar: Missing or invalid statusInfo or eventColors for report ID ${reportId}. statusInfo:`, statusInfo);
                return null; 
            }
            return {
                id: reportId, 
                title: reportTitle, 
                start: reportDate, 
                allDay: true,
                backgroundColor: statusInfo.eventColors.backgroundColor,
                borderColor: statusInfo.eventColors.borderColor,
                textColor: statusInfo.eventColors.textColor,
                extendedProps: { 
                    id: reportId, 
                    department: report[1], 
                    frequency: report[3], 
                    statusText: statusInfo.text, 
                    fullReport: report 
                }
            };
        }).filter(event => event !== null); 

        console.log("initializeCalendar: Processed calendarEvents array. Final Count:", calendarEvents.length);
        if (calendarEvents.length > 0) {
            console.log("initializeCalendar: Sample of first processed calendarEvent:", JSON.stringify(calendarEvents[0]));
        } else {
            console.warn("initializeCalendar: No valid events were created for the calendar.");
        }


        if (calendarInstance) calendarInstance.destroy();
        try {
            calendarInstance = new FullCalendar.Calendar(calendarEl, {
                locale: 'ar', 
                headerToolbar: { right: 'prev,next today', center: 'title', left: 'dayGridMonth,timeGridWeek,listWeek' },
                initialView: 'dayGridMonth',
                events: calendarEvents, // Pass the processed events
                eventDisplay: 'block', 
                eventTextColor: function(eventInfo){ return eventInfo.event.textColor; },
                eventDidMount: function(info) {
                    if (info.event.backgroundColor) info.el.style.setProperty('background-color', info.event.backgroundColor, 'important');
                    if (info.event.borderColor) info.el.style.setProperty('border-color', info.event.borderColor, 'important');
                },
                eventClick: function(info) {
                    const props = info.event.extendedProps;
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
            console.log("initializeCalendar: Calendar RENDERED successfully with", calendarEvents.length, "events.");
        } catch(e) {
            console.error("initializeCalendar: ERROR during FullCalendar instantiation or render:", e);
            calendarEl.innerHTML = "<p style='text-align:center; padding:20px;'>حدث خطأ أثناء عرض التقويم.</p>";
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
        // Allow re-click for calendar/analytics to refresh
        // if (clickedLi.classList.contains('active') && clickedLi.dataset.view !== 'calendar' && clickedLi.dataset.view !== 'analytics') { 
        //     return;
        // }
        
        const viewId = clickedLi.dataset.view;
        console.log("handleNavigation: Navigating to viewId:", viewId);

        if(navLinks) navLinks.forEach(link => link.classList.remove('active'));
        if(views) views.forEach(view => view.classList.remove('active-view'));
        
        if(clickedLi) clickedLi.classList.add('active'); // Check if clickedLi is not null
        const targetView = document.getElementById(`${viewId}-section`);
        if (targetView) {
            targetView.classList.add('active-view');
        } else { 
            console.error("handleNavigation: Target view element not found for ID:", `${viewId}-section`);
            return; 
        }
        
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
    // Removed themeSwitcherBtn listener
    if(navLinks && navLinks.length > 0) {
        navLinks.forEach((link) => { if (link) link.addEventListener('click', handleNavigation); });
    }

    // Initial Setup
    console.log("Running initial setup: Fetching data (Theme functions removed).");
    // Removed loadTheme()
    fetchData();

});
