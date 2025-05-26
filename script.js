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
    const departmentChartCanvas = document.getElementById('departmentChart').getContext('2d');
    const frequencyChartCanvas = document.getElementById('frequencyChart').getContext('2d');
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
    let chartsCreated = false; // Flag to create charts only once

    // --- Date Calculations ---
    const today = new Date(currentDate.setHours(0, 0, 0, 0));
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(today.getDate() + 3);

    // --- Functions ---

    /** Get Status Info **/
    function getStatus(dueDateStr) {
        const due = new Date(new Date(dueDateStr).setHours(0, 0, 0, 0));
        if (due < today) {
            return { text: "منتهي", class: "status-past", isPast: true, isNear: false }; // Changed text
        } else if (due.getTime() === today.getTime()) {
            return { text: "مستحق اليوم", class: "status-due", isPast: false, isNear: true };
        } else if (due > today && due <= threeDaysLater) {
            return { text: "قادم قريباً", class: "status-upcoming", isPast: false, isNear: true };
        } else {
            return { text: "قادم", class: "status-future", isPast: false, isNear: false };
        }
    }

    /** Create Mailto Link **/
    function createMailtoLink(reportTitle) {
        const subject = encodeURIComponent(reportTitle);
        return `mailto:${targetEmail}?subject=${subject}`;
    }
    
    /** Create Basic Charts **/
    function createCharts(data) {
        if (!data || data.length === 0) return; // Don't create if no data

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

        departmentChart = new Chart(departmentChartCanvas, { 
            type: 'pie', 
            data: { labels: Object.keys(deptCounts), datasets: [{ data: Object.values(deptCounts), backgroundColor: chartPieColors }] }, 
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } } 
        });

        frequencyChart = new Chart(frequencyChartCanvas, { 
            type: 'bar', 
            data: { labels: Object.keys(freqCounts), datasets: [{ label: 'عدد التقارير', data: Object.values(freqCounts), backgroundColor: goldColor }] }, // Changed color
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } 
        });
        chartsCreated = true;
    }
    
    /** Populate Table **/
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
            `; // Removed Sent Button
            tableBody.appendChild(row);
        });
    }

    /** Update KPIs **/
    function updateKPIs(data) {
        let dueTodayCount = 0, nearCount = 0, pastDueCount = 0, due3DaysOnlyCount = 0;
        data.forEach(report => {
            const statusInfo = getStatus(report[4]);
            if (statusInfo.class === 'status-due') dueTodayCount++;
            if (statusInfo.isNear) nearCount++; 
            if (statusInfo.isPast) pastDueCount++;
            if (statusInfo.class === 'status-upcoming') due3DaysOnlyCount++;
        });
        kpiTotal.textContent = data.length;
        kpiDueToday.textContent = dueTodayCount;
        kpiDue3Days.textContent = due3DaysOnlyCount + dueTodayCount; 
        kpiPastDue.textContent = pastDueCount;
        notificationDot.classList.toggle('hidden', nearCount === 0);
    }

    /** Display Pagination Controls **/
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

    /** Render Current Page **/
    function renderCurrentPage() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedDept = departmentFilter.value;
        const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
        const endDate = endDateInput.value ? new Date(endDateInput.value) : null;

        if (startDate) startDate.setHours(0, 0, 0, 0);
        if (endDate) endDate.setHours(23, 59, 59, 999); // Include whole end day

        filteredReportsData = allReportsData.filter(report => {
            const reportDate = new Date(report[4]);
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
    
    /** Populate Department Filter **/
    function populateFilter(data) {
        const departments = [...new Set(data.map(report => report[1]))]; 
        departments.sort((a, b) => a.localeCompare(b, 'ar')); 
        departmentFilter.innerHTML = '<option value="all">عرض الكل</option>'; // Clear and add default
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departmentFilter.appendChild(option);
        });
    }

    /** Fetch Data **/
    async function fetchData() {
        try {
            const response = await fetch(dataUrl);
            if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
            allReportsData = await response.json();
            populateFilter(allReportsData); 
            renderCurrentPage(); 
            // Charts will be created when their tab is clicked
        } catch (error) {
            console.error('Fetch Error:', error);
            tableBody.innerHTML = '<tr><td colspan="7">فشل تحميل البيانات.</td></tr>';
        }
    }

    /** Handle Search & Filter **/
    function handleFilterAndSearch() {
        currentPage = 1; 
        renderCurrentPage();
        // Charts are now separate, no need to update here
    }

    /** Reset Date Filter **/
    function resetDateFilter() {
        startDateInput.value = '';
        endDateInput.value = '';
        handleFilterAndSearch();
    }

    /** Toggle Theme **/
    function toggleTheme() { /* ... unchanged ... */ }
    function loadTheme() { /* ... unchanged ... */ }

    /** Handle Navigation **/
    function handleNavigation(event) {
        event.preventDefault();
        const clickedLi = event.target.closest('li');
        if (!clickedLi || clickedLi.classList.contains('active')) return;
        const viewId = clickedLi.dataset.view;
        navLinks.forEach(link => link.classList.remove('active'));
        views.forEach(view => view.classList.remove('active-view'));
        clickedLi.classList.add('active');
        document.getElementById(`${viewId}-section`).classList.add('active-view');
        
        // Create charts only when analytics tab is clicked for the first time
        if (viewId === 'analytics' && !chartsCreated) {
            createCharts(allReportsData); 
        }
        if (viewId === 'calendar') console.log("Load Calendar View Now...");
        if (viewId === 'timeline') console.log("Load Timeline View Now...");
    }

    // --- Event Listeners ---
    searchInput.addEventListener('input', handleFilterAndSearch);
    departmentFilter.addEventListener('change', handleFilterAndSearch);
    startDateInput.addEventListener('change', handleFilterAndSearch);
    endDateInput.addEventListener('change', handleFilterAndSearch);
    resetDateBtn.addEventListener('click', resetDateFilter);
    themeSwitcherBtn.addEventListener('click', toggleTheme);
    navLinks.forEach(link => link.addEventListener('click', handleNavigation));

    // --- Initial Setup ---
    loadTheme();
    fetchData();

});