document.addEventListener('DOMContentLoaded', () => {
    console.log("SCRIPT.JS LOADED AND DOMCONTENTLOADED FIRED! Current Time:", new Date().toLocaleTimeString());

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

    // --- UPDATED getStatus function for robustness ---
    function getStatus(dueDateStr) {
        const defaultEventColors = { 
            backgroundColor: 'rgba(200,200,200,0.7)', // Light grey for errors
            borderColor: 'rgba(150,150,150,0.9)', 
            textColor: '#333333' 
        };
        const defaultReturn = { 
            text: "تاريخ غير صالح", 
            classForTable: "status-error", 
            isPast: false, 
            isNear: false, 
            eventColors: defaultEventColors // Ensure eventColors is always defined
        };

        if (!dueDateStr || typeof dueDateStr !== 'string' || !dueDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            console.warn("getStatus: Invalid dueDateStr format or type. Input:", dueDateStr);
            return defaultReturn;
        }
        
        const due = new Date(dueDateStr);
        if (isNaN(due.getTime())) {
            console.warn("getStatus: Failed to parse dueDateStr into valid date object. Input:", dueDateStr);
            return defaultReturn;
        }
        const normalizedDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());

        // Define event colors, ensuring fallbacks if CSS variables are not found
        const pastEvent = { 
            backgroundColor: getThemeColor('--border-color-light', '#E9ECEF'), 
            borderColor: getThemeColor('--border-color-light', '#D0D0D0'), 
            textColor: getThemeColor('--text-muted-light', '#6C757D') 
        };
        const dueTodayEvent = { 
            backgroundColor: getThemeColor('--accent-gold-muted', '#bd9a5f'), 
            borderColor: getThemeColor('--accent-gold-muted', '#bd9a5f'), 
            textColor: '#FFFFFF' 
        };
        const upcomingEvent = { 
            backgroundColor: getThemeColor('--accent-blue-calendar-event', '#AEC6CF'), 
            borderColor: getThemeColor('--accent-blue-calendar-event', '#AEC6CF'), 
            textColor: getThemeColor('--primary-dark-light', '#2C3E50') 
        };
        const futureEvent = { 
            backgroundColor: getThemeColor('--accent-green-event', '#F5F5F5'), 
            borderColor: getThemeColor('--accent-green-event', '#E0E0E0'), 
            textColor: getThemeColor('--text-muted-light', '#6C757D') 
        };

        if (normalizedDue < today) return { text: "منتهي", classForTable: "status-past", isPast: true, isNear: false, eventColors: pastEvent };
        if (normalizedDue.getTime() === today.getTime()) return { text: "مستحق اليوم", classForTable: "status-due", isPast: false, isNear: true, eventColors: dueTodayEvent };
        if (normalizedDue > today && normalizedDue <= threeDaysLater) return { text: "قادم قريباً", classForTable: "status-upcoming", isPast: false, isNear: true, eventColors: upcomingEvent };
        return { text: "قادم", classForTable: "status-future", isPast: false, isNear: false, eventColors: futureEvent };
    }

    function createMailtoLink(reportTitle) { /* ... as before ... */ }
    function createCharts(dataForCharts) { /* ... as before ... */ }
    function populateTable(reportsToShow) { /* ... as before ... */ }
    function updateKPIs(currentBaseFilteredData, currentDateRangeFilteredData) { /* ... as before ... */ }
    function displayPagination(totalRows) { /* ... as before ... */ }
    function populateFilter(data) { /* ... as before ... */ }
    function renderCurrentPage() { /* ... as before ... */ }
    async function fetchData() { /* ... as before ... */ }
    function handleFilterAndSearch() { /* ... as before ... */ }
    function resetDateFilter() { /* ... as before ... */ }
    // No theme functions
    function initializeCalendar() {
        console.log("initializeCalendar: CALLED. Calendar Initialized Flag:", calendarInitialized, "Calendar Element:", !!calendarEl);
        if (!calendarEl) {
            console.error("initializeCalendar: calendarEl is NULL. Cannot initialize.");
            return;
        }
        if (!Array.isArray(allReportsData) || allReportsData.length === 0) {
            console.warn("initializeCalendar: No base data (allReportsData). Cannot populate calendar.");
            calendarEl.innerHTML = "<p style='text-align:center; padding:20px;'>لا توجد بيانات أساسية لعرضها في التقويم.</p>";
            if (calendarInstance) { calendarInstance.destroy(); calendarInstance = null; calendarInitialized = false;}
            return;
        }
        calendarEl.innerHTML = ''; 

        const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
        const selectedDept = departmentFilter ? departmentFilter.value : "all";
        
        const calendarData = allReportsData.filter(report => {
            if (!report || !Array.isArray(report) || report.length < 3) return false;
            const reportDept = String(report[1] || ""); 
            const reportTitle = String(report[2] || ""); 
            const matchesSearch = reportDept.toLowerCase().includes(searchTerm) || 
                                  reportTitle.toLowerCase().includes(searchTerm);
            const matchesDept = (selectedDept === 'all') || (reportDept === selectedDept);
            return matchesSearch && matchesDept;
        });
        console.log("initializeCalendar: Data for calendar (after search/dept filter). Count:", calendarData.length);

        const calendarEvents = calendarData.map((report, index) => {
            // console.log(`initializeCalendar: Processing report index ${index} for event:`, report); // Can be too verbose
            if (!Array.isArray(report) || report.length < 5) { 
                console.warn(`initializeCalendar: Skipping invalid report structure at index ${index}:`, report);
                return null; 
            }
            const reportId = report[0];
            const reportTitle = report[2];
            const reportDate = report[4]; // This is the date string
            
            // console.log(`initializeCalendar: Report ID ${reportId}, Date to process: "${reportDate}", Title: "${reportTitle}"`);

            const statusInfo = getStatus(reportDate); 
            
            // CRITICAL LOGGING: Check what getStatus returns
            // console.log(`initializeCalendar: For report ID ${reportId}, statusInfo from getStatus:`, JSON.stringify(statusInfo));

            if (!statusInfo || !statusInfo.eventColors || typeof statusInfo.text !== 'string') { 
                console.warn(`initializeCalendar: Invalid or incomplete statusInfo for report ID ${reportId}. statusInfo:`, statusInfo, `Using default event.`);
                // Fallback event if statusInfo is bad, to still show something
                return {
                    id: reportId, title: reportTitle + " (خطأ في الحالة)", start: reportDate, allDay: true,
                    backgroundColor: 'red', borderColor: 'darkred', textColor: 'white',
                    extendedProps: { id:reportId, department: report[1], frequency: report[3], statusText: "خطأ", fullReport: report }
                };
            }
            return {
                id: reportId, title: reportTitle, start: reportDate, allDay: true,
                backgroundColor: statusInfo.eventColors.backgroundColor,
                borderColor: statusInfo.eventColors.borderColor,
                textColor: statusInfo.eventColors.textColor,
                extendedProps: { id:reportId, department: report[1], frequency: report[3], statusText: statusInfo.text, fullReport: report }
            };
        }).filter(event => event !== null); 

        console.log("initializeCalendar: Processed calendarEvents array. Final Count:", calendarEvents.length);
        if (calendarEvents.length > 0) {
            console.log("initializeCalendar: Sample of first processed calendarEvent:", JSON.stringify(calendarEvents[0]));
        } else if (calendarData.length > 0) { // If there was data but no events were made
            console.warn("initializeCalendar: Had data for calendar but NO valid events were created. Check getStatus logic and data integrity (especially dates).");
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
    function handleNavigation(event) { /* ... as before ... */ }

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
    fetchData();
});
