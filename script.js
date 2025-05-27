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
    console.log("Date context: 'today' is set to", today.toISOString().split('T')[0]);

    function getThemeColor(cssVarName, fallbackColor) {
        try {
            const color = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
            return color || fallbackColor;
        } catch (e) {
            // console.warn(`Could not get theme color for ${cssVarName}, using fallback ${fallbackColor}`, e);
            return fallbackColor;
        }
    }

    function getStatus(dueDateStr) {
        const defaultErrorStatus = { text: "تاريخ غير صالح", classForTable: "status-error", isPast: false, isNear: false, eventColors: { backgroundColor: 'lightgray', borderColor: 'gray', textColor: 'black' } };
        if (!dueDateStr || typeof dueDateStr !== 'string' || !dueDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // console.warn("Invalid dueDateStr for getStatus:", dueDateStr);
            return defaultErrorStatus;
        }
        const due = new Date(dueDateStr);
        if (isNaN(due.getTime())) {
            // console.warn("Failed to parse dueDateStr into valid date:", dueDateStr);
            return defaultErrorStatus;
        }
        due.setHours(0, 0, 0, 0);

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
        const subject = encodeURIComponent(`تقرير: ${reportTitle}`);
        const bodyLines = ["السلام عليكم","","مرفق لكم تقرير \"" + reportTitle + "\"","","مع وافر التحية والتقدير"];
        const body = encodeURIComponent(bodyLines.join('\n')).replace(/%0A/g, '%0D%0A');
        return `mailto:${targetEmail}?subject=${subject}&body=${body}`;
    }
    
    function createCharts(dataForCharts) {
        // console.log("Attempting createCharts. Data length:", dataForCharts ? dataForCharts.length : 'null');
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
        console.log("populateTable: Starting. Reports to show count:", reportsToShow ? reportsToShow.length : 'undefined');
        if (!tableBody) {
            console.error("populateTable: tableBody element is NULL. Aborting.");
            return;
        }
        tableBody.innerHTML = ''; 
        if (!reportsToShow || reportsToShow.length === 0) {
            // console.log("populateTable: No reports to show, displaying empty message.");
            tableBody.innerHTML = '<tr><td colspan="7">لا توجد تقارير تطابق البحث أو التصفية.</td></tr>';
            return;
        }
        
        reportsToShow.forEach((report, index) => {
            if (!Array.isArray(report) || report.length < 5) {
                // console.warn(`populateTable: Skipping invalid report data structure at index ${index}:`, report);
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
        // console.log("populateTable: Finished. Table populated with", tableBody.rows.length, "rows.");
    }

    function updateKPIs(currentBaseFilteredData, currentDateRangeFilteredData) {
        // console.log("updateKPIs: Called. BaseData:", currentBaseFilteredData.length, "DateRangeData:", currentDateRangeFilteredData.length);
        if (!kpiTotalReports || !kpiDueInPeriod || !kpiDueToday || !kpiDue3Days || !kpiPastTotal) {
            console.error("updateKPIs: One or more KPI DOM elements are missing!");
            if(kpiTotalReports) kpiTotalReports.textContent = '-';
            if(kpiDueInPeriod) kpiDueInPeriod.textContent = '-';
            if(kpiDueToday) kpiDueToday.textContent = '-';
            if(kpiDue3Days) kpiDue3Days.textContent = '-';
            if(kpiPastTotal) kpiPastTotal.textContent = '-';
            return;
        }
        kpiTotalReports.textContent = currentBaseFilteredData ? currentBaseFilteredData.length : '0';
        if (startDateInput && endDateInput && startDateInput.value && endDateInput.value) {
            kpiDueInPeriod.textContent = currentDateRangeFilteredData ? currentDateRangeFilteredData.length : '0';
        } else {
            kpiDueInPeriod.textContent = '-';
        }
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
        let pastTotalCount = 0;
        if (currentBaseFilteredData) {
            currentBaseFilteredData.forEach(report => {
                if (!report || report.length < 5) return;
                const statusInfo = getStatus(report[4]);
                if (statusInfo && statusInfo.isPast) pastTotalCount++;
            });
        }
        kpiPastTotal.textContent = pastTotalCount;
        let nearNotificationCount = 0;
        if (currentBaseFilteredData) {
            currentBaseFilteredData.forEach(report => {
                 if (!report || report.length < 5) return;
                const statusInfo = getStatus(report[4]);
                if (statusInfo && statusInfo.isNear) nearNotificationCount++;
            });
        }
        if (notificationDot) notificationDot.classList.toggle('hidden', nearNotificationCount === 0);
        // console.log("KPIs updated successfully.");
    }

    function displayPagination(totalRows) { 
        // console.log("displayPagination called. Total rows for pagination:", totalRows);
        if (!paginationControls) { return; }
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
    }
    
    function renderCurrentPage() {
        console.log("--- renderCurrentPage --- Called. Current Page:", currentPage);
        if (!allReportsData || !Array.isArray(allReportsData) || allReportsData.length === 0) {
            console.warn("renderCurrentPage: allReportsData is empty or not loaded. Displaying empty table and KPIs.");
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">لا توجد بيانات لعرضها.</td></tr>';
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
            const searchMatch = (report[1] && report[1].toLowerCase().includes(searchTerm)) || 
                                (report[2] && report[2].toLowerCase().includes(searchTerm));
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
        if (paginationControls) displayPagination(dateRangeFilteredData.length); else console.warn("renderCurrentPage: paginationControls is null");
        updateKPIs(baseFilteredData, dateRangeFilteredData); 
        console.log("--- renderCurrentPage --- Finished. Reports shown:", reportsToShow.length);
    }
    
    function populateFilter(data) {
        console.log("populateFilter: Called. Data length:", data ? data.length : 'undefined');
        if (!departmentFilter) { console.error("populateFilter: departmentFilter is NULL."); return; }
        if (!data || !Array.isArray(data)) { console.error("populateFilter: Invalid data."); return;}
        departmentFilter.innerHTML = '<option value="all">عرض الكل</option>';
        const departments = [...new Set(data.map(report => report[1]))]; 
        departments.sort((a, b) => a.localeCompare(b, 'ar')); 
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departmentFilter.appendChild(option);
        });
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
            console.log("fetchData: Data parsed successfully. Type:", typeof allReportsData, "Is Array:", Array.isArray(allReportsData), "Length:", allReportsData ? allReportsData.length : 'N/A'); 
            
            if (Array.isArray(allReportsData) && allReportsData.length > 0) {
                console.log("fetchData: Data is valid. Populating filter and rendering initial page.");
                if(departmentFilter) { populateFilter(allReportsData); } else { console.error("fetchData: departmentFilter is NULL."); }
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
        console.log("handleFilterAndSearch: User interaction triggered filter/search.");
        currentPage = 1; 
        renderCurrentPage();
    }
    function resetDateFilter() { /* ... unchanged ... */ }
    
    function toggleTheme() {
        console.log("toggleTheme: Called.");
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        if (themeIcon) themeIcon.className = isDarkMode ? 'fas fa-moon' : 'fas fa-sun';
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        console.log("toggleTheme: Theme set to", isDarkMode ? 'dark' : 'light');
        
        const activeViewId = document.querySelector('.sidebar ul li.active')?.dataset.view;
        if (activeViewId === 'analytics' && chartsDrawn) {
            console.log("toggleTheme: Re-creating charts for new theme.");
            const currentSearchTerm = searchInput ? searchInput.value.toLowerCase() : "";
            const currentSelectedDept = departmentFilter ? departmentFilter.value : "all";
            const chartData = allReportsData.filter(report => { 
                if (!report || !Array.isArray(report) || report.length < 3) return false;
                const matchesSearch = (report[1] && report[1].toLowerCase().includes(currentSearchTerm)) || 
                                    (report[2] && report[2].toLowerCase().includes(currentSearchTerm));
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
            console.log("loadTheme: Dark theme loaded.");
        } else {
            document.body.classList.remove('dark-mode');
            if (themeIcon) themeIcon.className = 'fas fa-sun';
            console.log("loadTheme: Light theme applied.");
        }
    }

    function initializeCalendar() {
        console.log("initializeCalendar: Called. Initialized previously:", calendarInitialized, "Calendar Element:", !!calendarEl);
        if (!calendarEl) {
            console.error("initializeCalendar: Calendar placeholder element not found!");
            return;
        }

        const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
        const selectedDept = departmentFilter ? departmentFilter.value : "all";
        const calendarData = allReportsData.filter(report => {
            if (!report || !Array.isArray(report) || report.length < 3) return false;
            const matchesSearch = (report[1] && report[1].toLowerCase().includes(searchTerm)) || 
                                  (report[2] && report[2].toLowerCase().includes(searchTerm));
            const matchesDept = (selectedDept === 'all') || (report[1] === selectedDept);
            return matchesSearch && matchesDept;
        });
        console.log("initializeCalendar: Data for calendar (after search/dept filter):", calendarData.length, "Sample:", JSON.stringify(calendarData.slice(0,2)));

        const calendarEvents = calendarData.map(report => {
            if (!report || !Array.isArray(report) || report.length < 5) return null; 
            const statusInfo = getStatus(report[4]);
            return {
                id: report[0], title: report[2], start: report[4], allDay: true,
                backgroundColor: statusInfo.eventColors.backgroundColor,
                borderColor: statusInfo.eventColors.borderColor,
                textColor: statusInfo.eventColors.textColor,
                extendedProps: { department: report[1], frequency: report[3], statusText: statusInfo.text }
            };
        }).filter(event => event !== null); 

        console.log("initializeCalendar: Processed calendarEvents (first 2):", JSON.stringify(calendarEvents.slice(0,2)));

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
        console.log("initializeCalendar: Calendar rendered/updated.");
    }

    function destroyCalendar() { /* ... unchanged ... */ }
    
    if(closeModalButton) closeModalButton.onclick = function() { if(eventModal) eventModal.style.display = "none"; }
    if(eventModal) window.onclick = function(event) { if (eventModal && event.target == eventModal) eventModal.style.display = "none"; }

    function handleNavigation(event) {
        event.preventDefault();
        console.log("--- handleNavigation START --- Target:", event.target);
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
                const matchesSearch = (report[1] && report[1].toLowerCase().includes(currentSearchTerm)) || 
                                    (report[2] && report[2].toLowerCase().includes(currentSearchTerm));
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
