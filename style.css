document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const tableBody = document.getElementById('reports-table-body');
    const searchInput = document.getElementById('search-input');
    const themeSwitcherBtn = document.getElementById('theme-switcher-btn');
    const themeIcon = themeSwitcherBtn.querySelector('i');
    const notificationDot = document.getElementById('notification-dot');
    const navLinks = document.querySelectorAll('.sidebar ul li');
    const views = document.querySelectorAll('.view');
    const kpiTotal = document.getElementById('kpi-total');
    const kpiDueToday = document.getElementById('kpi-due-today');
    const kpiDue3Days = document.getElementById('kpi-due-3days');
    const kpiPastDue = document.getElementById('kpi-past-due');
    const kpiDueInPeriod = document.getElementById('kpi-due-in-period'); // New KPI
    const departmentChartCanvas = document.getElementById('departmentChart');
    const frequencyChartCanvas = document.getElementById('frequencyChart');
    const departmentFilter = document.getElementById('department-filter');
    const paginationControls = document.getElementById('pagination-controls');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const resetDateBtn = document.getElementById('reset-date-filter');

    // --- Settings & State ---
    const dataUrl = 'data.json';
    const targetEmail = 'shamdan@aur.com.sa';
    const currentDate = new Date('2025-05-26T00:00:00'); 
    let allReportsData = []; 
    let filteredReportsData = []; 
    let currentPage = 1;
    const rowsPerPage = 15; // Changed to 15
    let departmentChart = null;
    let frequencyChart = null;
    let chartsCreated = false;

    // --- Date Calculations ---
    const today = new Date(new Date(currentDate).setHours(0, 0, 0, 0)); // Ensure 'today' is start of day
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(today.getDate() + 3);

    // --- Functions ---

    function getStatus(dueDateStr) {
        const due = new Date(new Date(dueDateStr).setHours(0, 0, 0, 0));
        if (due < today) {
            return { text: "منتهي", class: "status-past", isPast: true, isNear: false };
        } else if (due.getTime() === today.getTime()) {
            return { text: "مستحق اليوم", class: "status-due", isPast: false, isNear: true };
        } else if (due > today && due <= threeDaysLater) {
            return { text: "قادم قريباً", class: "status-upcoming", isPast: false, isNear: true };
        } else {
            return { text: "قادم", class: "status-future", isPast: false, isNear: false };
        }
    }

    function createMailtoLink(reportTitle) {
        const subject = encodeURIComponent(reportTitle);
        return `mailto:${targetEmail}?subject=${subject}`;
    }
    
    function createCharts(data) {
        if (!data || data.length === 0 || !departmentChartCanvas || !frequencyChartCanvas) return; 

        const deptCtx = departmentChartCanvas.getContext('2d');
        const freqCtx = frequencyChartCanvas.getContext('2d');

        const deptCounts = data.reduce((acc, report) => { acc[report[1]] = (acc[report[1]] || 0) + 1; return acc; }, {});
        const freqCounts = data.reduce((acc, report) => { acc[report[3]] = (acc[report[3]] || 0) + 1; return acc; }, {});
        
        const goldColor = '#C89638'; 
        const blueColor = '#3498DB';
        const primaryDarkColor = '#2C3E50';
        const mutedGoldColor = '#bd9a5f';
        const greyColor = '#95A5A6';
        const chartPieColors = [goldColor, blueColor, primaryDarkColor, mutedGoldColor, greyColor, '#E74C3C'];

        if(departmentChart) departmentChart.destroy();
        if(frequencyChart) frequencyChart.destroy();

        departmentChart = new Chart(deptCtx, { 
            type: 'pie', 
            data: { labels: Object.keys(deptCounts), datasets: [{ data: Object.values(deptCounts), backgroundColor: chartPieColors }] }, 
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } } 
        });

        frequencyChart = new Chart(freqCtx, { 
            type: 'bar', 
            data: { labels: Object.keys(freqCounts), datasets: [{ label: 'عدد التقارير', data: Object.values(freqCounts), backgroundColor: goldColor }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } 
        });
        chartsCreated = true;
    }
    
    function populateTable(reportsToShow) {
        tableBody.innerHTML = '';
        if (reportsToShow.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7">لا توجد تقارير تطابق البحث أو التصفية.</td></tr>';
            return;
        }

        reportsToShow.forEach(report => {
            const [id, department, title, frequency, dateString] = report;
            const statusInfo = getStatus(dateString);
            const row = document.createElement('tr');
            if (statusInfo.isPast) row.classList.add('past-due');
            
            row.innerHTML = `
                <td>${id}</td>
                <td>${department}</td>
                <td>${title}</td>
                <td>${frequency}</td>
                <td>${dateString}</td>
                <td><span class="status-tag ${statusInfo.class}">${statusInfo.text}</span></td>
                <td>
                    <a href="${createMailtoLink(title)}" class="icon-button" title="إرسال بريد">
                       <i class="fas fa-envelope"></i>
                    </a>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    function updateKPIs(dataForKPIs) { // dataForKPIs is already filtered by search, dept, and date
        let dueTodayCount = 0;
        let nearNotificationCount = 0; // For notification dot, based on ALL data before date filter
        let pastDueCount = 0;
        let due3DaysOnlyCount = 0;

        // Calculate specific KPIs based on the data passed (which is fully filtered)
        dataForKPIs.forEach(report => {
            const statusInfo = getStatus(report[4]); // report[4] is dateString
            if (statusInfo.class === 'status-due') dueTodayCount++;
            if (statusInfo.class === 'status-upcoming') due3DaysOnlyCount++; // isNear includes today
            if (statusInfo.isPast) pastDueCount++;
        });
        
        // Calculate nearNotificationCount based on data filtered by search and department ONLY
        const selectedDept = departmentFilter.value;
        const searchTerm = searchInput.value.toLowerCase();
        const searchAndDeptFilteredData = allReportsData.filter(report => {
             const matchesSearch = report[1].toLowerCase().includes(searchTerm) || 
                                   report[2].toLowerCase().includes(searchTerm);
             const matchesDept = (selectedDept === 'all') || (report[1] === selectedDept);
             return matchesSearch && matchesDept;
        });

        searchAndDeptFilteredData.forEach(report => {
            const statusInfo = getStatus(report[4]);
             if (statusInfo.isNear) nearNotificationCount++;
        });


        kpiTotal.textContent = dataForKPIs.length; // Total matching all filters
        kpiDueToday.textContent = dueTodayCount;
        kpiDue3Days.textContent = due3DaysOnlyCount + dueTodayCount; 
        kpiPastDue.textContent = pastDueCount;
        
        // New KPI
        if (startDateInput.value && endDateInput.value) {
            kpiDueInPeriod.textContent = dataForKPIs.length; 
        } else {
            kpiDueInPeriod.textContent = '-';
        }

        notificationDot.classList.toggle('hidden', nearNotificationCount === 0);
    }

    function displayPagination(totalRows) {
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
        const searchTerm = searchInput.value.toLowerCase();
        const selectedDept = departmentFilter.value;
        const startDateValue = startDateInput.value;
        const endDateValue = endDateInput.value;

        // Parse dates carefully, ensuring they are at the start/end of day for comparison
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
        
        filteredReportsData = allReportsData.filter(report => {
            const reportDate = new Date(report[4]);
            reportDate.setHours(0,0,0,0); // Normalize report date for comparison

            const matchesSearch = report[1].toLowerCase().includes(searchTerm) || 
                                  report[2].toLowerCase().includes(searchTerm);
            const matchesDept = (selectedDept === 'all') || (report[1] === selectedDept);
            const matchesStartDate = !startDate || reportDate >= startDate;
            const matchesEndDate = !endDate || reportDate <= endDate;
            return matchesSearch && matchesDept && matchesStartDate && matchesEndDate;
        });

        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const reportsToShow = filteredReportsData.slice(startIndex, endIndex);

        populateTable(reportsToShow);
        displayPagination(filteredReportsData.length);
        updateKPIs(filteredReportsData); 
    }
    
    function populateFilter(data) {
        const departments = [...new Set(data.map(report => report[1]))]; 
        departments.sort((a, b) => a.localeCompare(b, 'ar')); 
        departmentFilter.innerHTML = '<option value="all">عرض الكل</option>';
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departmentFilter.appendChild(option);
        });
    }

    async function fetchData() {
        try {
            const response = await fetch(dataUrl);
            if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
            allReportsData = await response.json();
            populateFilter(allReportsData); 
            renderCurrentPage(); 
            // Charts are created when tab is displayed
        } catch (error) {
            console.error('Fetch Error:', error);
            tableBody.innerHTML = '<tr><td colspan="7">فشل تحميل البيانات.</td></tr>';
        }
    }

    function handleFilterAndSearch() {
        currentPage = 1; 
        renderCurrentPage();
    }

    function resetDateFilter() {
        startDateInput.value = '';
        endDateInput.value = '';
        handleFilterAndSearch();
    }

    function toggleTheme() { /* ... unchanged ... */ }
    function loadTheme() { /* ... unchanged ... */ }

    function handleNavigation(event) {
        event.preventDefault();
        const clickedLi = event.target.closest('li');
        if (!clickedLi || clickedLi.classList.contains('active')) return;
        const viewId = clickedLi.dataset.view;
        navLinks.forEach(link => link.classList.remove('active'));
        views.forEach(view => view.classList.remove('active-view'));
        clickedLi.classList.add('active');
        document.getElementById(`${viewId}-section`).classList.add('active-view');
        
        if (viewId === 'analytics' && !chartsCreated) {
            // Filter data for charts based on current search and department filters, but NOT date range
            const searchTerm = searchInput.value.toLowerCase();
            const selectedDept = departmentFilter.value;
            const chartData = allReportsData.filter(report => {
                const matchesSearch = report[1].toLowerCase().includes(searchTerm) || 
                                  report[2].toLowerCase().includes(searchTerm);
                const matchesDept = (selectedDept === 'all') || (report[1] === selectedDept);
                return matchesSearch && matchesDept;
            });
            createCharts(chartData); 
        }
        if (viewId === 'calendar') console.log("Load Calendar View Now...");
        if (viewId === 'timeline') console.log("Load Timeline View Now...");
    }

    // Event Listeners
    searchInput.addEventListener('input', handleFilterAndSearch);
    departmentFilter.addEventListener('change', handleFilterAndSearch);
    startDateInput.addEventListener('change', handleFilterAndSearch);
    endDateInput.addEventListener('change', handleFilterAndSearch);
    resetDateBtn.addEventListener('click', resetDateFilter);
    themeSwitcherBtn.addEventListener('click', toggleTheme);
    navLinks.forEach(link => link.addEventListener('click', handleNavigation));

    // Initial Setup
    loadTheme();
    fetchData();

});
