document.addEventListener('DOMContentLoaded', () => {

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

    const departmentChartCanvas = document.getElementById('departmentChart');
    const frequencyChartCanvas = document.getElementById('frequencyChart');
    const departmentFilter = document.getElementById('department-filter');
    const paginationControls = document.getElementById('pagination-controls');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const resetDateBtn = document.getElementById('reset-date-filter');
    // Removed monthQuickSelectButtons reference

    // --- Settings & State ---
    const dataUrl = 'data.json';
    const targetEmail = 'shamdan@aur.com.sa';
    const systemBaseDate = new Date('2025-05-26T00:00:00'); 
    let allReportsData = []; 
    let baseFilteredData = []; 
    let dateRangeFilteredData = []; 
    let currentPage = 1;
    const rowsPerPage = 15; 
    let departmentChart = null;
    let frequencyChart = null;
    let chartsCreated = false;

    // --- Date Calculations ---
    const today = new Date(new Date(systemBaseDate).setHours(0, 0, 0, 0));
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
    
    function createCharts(dataForCharts) {
        if (!dataForCharts || dataForCharts.length === 0 || !departmentChartCanvas || !frequencyChartCanvas) {
             if(departmentChart) departmentChart.destroy();
             if(frequencyChart) frequencyChart.destroy();
             chartsCreated = false; 
            return;
        }

        const deptCtx = departmentChartCanvas.getContext('2d');
        const freqCtx = frequencyChartCanvas.getContext('2d');

        const deptCounts = dataForCharts.reduce((acc, report) => { acc[report[1]] = (acc[report[1]] || 0) + 1; return acc; }, {});
        const freqCounts = dataForCharts.reduce((acc, report) => { acc[report[3]] = (acc[report[3]] || 0) + 1; return acc; }, {});
        
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

    function updateKPIs(currentBaseFilteredData, currentDateRangeFilteredData) {
        // 1. إجمالي التقارير (بعد البحث والجهة، قبل التاريخ)
        kpiTotalReports.textContent = currentBaseFilteredData.length;

        // 2. تقارير خلال الفترة المحددة (بعد كل الفلاتر)
        if (startDateInput.value && endDateInput.value) {
            kpiDueInPeriod.textContent = currentDateRangeFilteredData.length;
        } else {
            kpiDueInPeriod.textContent = '-';
        }

        // 3. مستحق اليوم & 4. مستحق خلال 3 أيام (تحسب من البيانات المفلترة بالكامل currentDateRangeFilteredData)
        let dueTodayCount = 0;
        let due3DaysOnlyCount = 0; 
        currentDateRangeFilteredData.forEach(report => {
            const statusInfo = getStatus(report[4]); 
            if (statusInfo.class === 'status-due') dueTodayCount++;
            if (statusInfo.class === 'status-upcoming') due3DaysOnlyCount++;
        });
        kpiDueToday.textContent = dueTodayCount;
        kpiDue3Days.textContent = due3DaysOnlyCount + dueTodayCount; 

        // 5. تقارير منتهية (من البيانات المفلترة بالبحث والجهة currentBaseFilteredData)
        let pastTotalCount = 0;
        currentBaseFilteredData.forEach(report => {
            const statusInfo = getStatus(report[4]);
            if (statusInfo.isPast) pastTotalCount++;
        });
        kpiPastTotal.textContent = pastTotalCount;
        
        // Notification Dot (based on currentBaseFilteredData for broader upcoming relevance)
        let nearNotificationCount = 0;
        currentBaseFilteredData.forEach(report => {
            const statusInfo = getStatus(report[4]);
            if (statusInfo.isNear) nearNotificationCount++;
        });
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
        
        baseFilteredData = allReportsData.filter(report => {
            const matchesSearch = report[1].toLowerCase().includes(searchTerm) || 
                                  report[2].toLowerCase().includes(searchTerm);
            const matchesDept = (selectedDept === 'all') || (report[1] === selectedDept);
            return matchesSearch && matchesDept;
        });

        dateRangeFilteredData = baseFilteredData.filter(report => {
            const reportDate = new Date(report[4]);
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
    
    // Removed handleMonthQuickSelect

    function toggleTheme() {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        themeIcon.className = isDarkMode ? 'fas fa-moon' : 'fas fa-sun';
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    }
    function loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            themeIcon.className = 'fas fa-moon';
        } else {
            document.body.classList.remove('dark-mode');
            themeIcon.className = 'fas fa-sun';
        }
    }

    function handleNavigation(event) {
        event.preventDefault();
        const clickedLi = event.target.closest('li');
        if (!clickedLi || clickedLi.classList.contains('active')) return;
        const viewId = clickedLi.dataset.view;
        navLinks.forEach(link => link.classList.remove('active'));
        views.forEach(view => view.classList.remove('active-view'));
        clickedLi.classList.add('active');
        const targetView = document.getElementById(`${viewId}-section`);
        if (targetView) {
            targetView.classList.add('active-view');
        }
        
        if (viewId === 'analytics' && !chartsCreated) {
            const currentSearchTerm = searchInput.value.toLowerCase();
            const currentSelectedDept = departmentFilter.value;
            // Charts for analytics should reflect the broader dataset after search/department filters
            // Not limited by date range unless specifically designed to do so.
            const chartData = allReportsData.filter(report => {
                const matchesSearch = report[1].toLowerCase().includes(currentSearchTerm) || 
                                  report[2].toLowerCase().includes(currentSearchTerm);
                const matchesDept = (currentSelectedDept === 'all') || (report[1] === currentSelectedDept);
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
    // Removed monthQuickSelectButtons listener
    themeSwitcherBtn.addEventListener('click', toggleTheme);
    navLinks.forEach(link => link.addEventListener('click', handleNavigation));

    // Initial Setup
    loadTheme();
    fetchData();

});