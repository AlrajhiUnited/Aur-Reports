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

    // --- Settings & State ---
    const dataUrl = 'data.json';
    const targetEmail = 'shamdan@aur.com.sa';
    const currentDate = new Date('2025-05-26T00:00:00'); // Use new Date() for real use
    let allReportsData = []; // Store all data
    let filteredReportsData = []; // Store filtered data
    let sentReports = new Set(); // Store IDs of sent reports
    let currentPage = 1;
    const rowsPerPage = 5;
    let departmentChart = null;
    let frequencyChart = null;

    // --- Date Calculations ---
    const today = new Date(currentDate.setHours(0, 0, 0, 0));
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(today.getDate() + 3);

    // --- Functions ---

    /** Load Sent Status from localStorage **/
    function loadSentStatus() {
        const savedSent = localStorage.getItem('sentReports');
        if (savedSent) {
            sentReports = new Set(JSON.parse(savedSent));
        }
    }

    /** Save Sent Status to localStorage **/
    function saveSentStatus() {
        localStorage.setItem('sentReports', JSON.stringify(Array.from(sentReports)));
    }

    /** Get Status Info **/
    function getStatus(reportId, dueDateStr) {
        if (sentReports.has(reportId)) {
            return { text: "تم الإرسال", class: "status-sent", isPast: false, isNear: false, isSent: true };
        }
        const due = new Date(new Date(dueDateStr).setHours(0, 0, 0, 0));
        if (due < today) {
            return { text: "فات موعده", class: "status-past", isPast: true, isNear: false, isSent: false };
        } else if (due.getTime() === today.getTime()) {
            return { text: "مستحق اليوم", class: "status-due", isPast: false, isNear: true, isSent: false };
        } else if (due > today && due <= threeDaysLater) {
            return { text: "قادم قريباً", class: "status-upcoming", isPast: false, isNear: true, isSent: false };
        } else {
            return { text: "قادم", class: "status-future", isPast: false, isNear: false, isSent: false };
        }
    }

    /** Create Mailto Link **/
    function createMailtoLink(reportTitle) {
        const subject = encodeURIComponent(reportTitle);
        return `mailto:${targetEmail}?subject=${subject}`;
    }
    
    /** Create Basic Charts **/
    function createCharts(data) {
        const deptCounts = data.reduce((acc, report) => { acc[report[1]] = (acc[report[1]] || 0) + 1; return acc; }, {});
        const freqCounts = data.reduce((acc, report) => { acc[report[3]] = (acc[report[3]] || 0) + 1; return acc; }, {});
        const chartColors = ['#C89638', '#bd9a5f', '#2C3E50', '#3498DB', '#95A5A6', '#E74C3C'];
        if(departmentChart) departmentChart.destroy();
        if(frequencyChart) frequencyChart.destroy();
        departmentChart = new Chart(departmentChartCanvas, { type: 'pie', data: { labels: Object.keys(deptCounts), datasets: [{ data: Object.values(deptCounts), backgroundColor: chartColors }] }, options: { responsive: true, plugins: { legend: { position: 'top' } } } });
        frequencyChart = new Chart(frequencyChartCanvas, { type: 'bar', data: { labels: Object.keys(freqCounts), datasets: [{ label: 'عدد التقارير', data: Object.values(freqCounts), backgroundColor: '#3498DB' }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
    }
    
    /** Handle Mark as Sent **/
    function handleMarkAsSent(reportId) {
        sentReports.add(reportId);
        saveSentStatus();
        renderCurrentPage(); // Re-render to show updated status
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
            const statusInfo = getStatus(id, dateString);
            const row = document.createElement('tr');
            if (statusInfo.isPast && !statusInfo.isSent) row.classList.add('past-due');
            
            const sentButtonDisabled = statusInfo.isSent ? 'disabled' : '';
            const sentButtonClass = statusInfo.isSent ? 'sent' : '';
            const sentButtonIcon = statusInfo.isSent ? 'fas fa-check-circle' : 'fas fa-paper-plane';

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
                    <button class="icon-button mark-sent-btn ${sentButtonClass}" title="وضع علامة كـ مرسل" data-id="${id}" ${sentButtonDisabled}>
                       <i class="${sentButtonIcon}"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Add event listeners to NEW "Mark as Sent" buttons
        document.querySelectorAll('.mark-sent-btn:not([disabled])').forEach(button => {
            button.onclick = () => handleMarkAsSent(parseInt(button.dataset.id));
        });
    }

    /** Update KPIs **/
    function updateKPIs(data) {
        let dueTodayCount = 0, nearCount = 0, pastDueCount = 0, due3DaysOnlyCount = 0;
        data.forEach(report => {
            const statusInfo = getStatus(report[0], report[4]);
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

        if (pageCount <= 1) return; // No need for pagination if only one page

        // Previous Button
        const prevLi = document.createElement('li');
        prevLi.innerHTML = `<a href="#" data-page="${currentPage - 1}">&laquo; السابق</a>`;
        if (currentPage === 1) prevLi.classList.add('disabled');
        paginationControls.appendChild(prevLi);

        // Page Numbers
        for (let i = 1; i <= pageCount; i++) {
            const pageLi = document.createElement('li');
            pageLi.innerHTML = `<a href="#" data-page="${i}">${i}</a>`;
            if (i === currentPage) pageLi.classList.add('active');
            paginationControls.appendChild(pageLi);
        }

        // Next Button
        const nextLi = document.createElement('li');
        nextLi.innerHTML = `<a href="#" data-page="${currentPage + 1}">التالي &raquo;</a>`;
        if (currentPage === pageCount) nextLi.classList.add('disabled');
        paginationControls.appendChild(nextLi);

        // Add event listeners to pagination links
        paginationControls.querySelectorAll('a').forEach(link => {
            link.onclick = (e) => {
                e.preventDefault();
                const parentLi = link.parentElement;
                if (parentLi.classList.contains('disabled') || parentLi.classList.contains('active')) {
                   return; // Do nothing if disabled or already active
                }
                currentPage = parseInt(link.dataset.page);
                renderCurrentPage();
            };
        });
    }

    /** Render Current Page (Filters + Slices + Populates) **/
    function renderCurrentPage() {
        // 1. Get current search term
        const searchTerm = searchInput.value.toLowerCase();
        // 2. Get current department filter
        const selectedDept = departmentFilter.value;

        // 3. Apply filters
        filteredReportsData = allReportsData.filter(report => {
            const matchesSearch = report[1].toLowerCase().includes(searchTerm) || 
                                  report[2].toLowerCase().includes(searchTerm);
            const matchesDept = (selectedDept === 'all') || (report[1] === selectedDept);
            return matchesSearch && matchesDept;
        });

        // 4. Calculate pagination slice
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const reportsToShow = filteredReportsData.slice(startIndex, endIndex);

        // 5. Populate table with sliced data
        populateTable(reportsToShow);
        
        // 6. Update pagination based on *filtered* total
        displayPagination(filteredReportsData.length);

        // 7. Update KPIs based on *filtered* total
        updateKPIs(filteredReportsData);
    }
    
    /** Populate Department Filter **/
    function populateFilter(data) {
        const departments = [...new Set(data.map(report => report[1]))]; // Get unique departments
        departments.sort().forEach(dept => {
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
            loadSentStatus(); // Load sent status *before* first render
            populateFilter(allReportsData); // Populate filter dropdown
            renderCurrentPage(); // Initial render
            createCharts(allReportsData); // Create initial charts
        } catch (error) {
            console.error('Fetch Error:', error);
            tableBody.innerHTML = '<tr><td colspan="7">فشل تحميل البيانات.</td></tr>';
        }
    }

    /** Handle Search & Filter **/
    function handleFilterAndSearch() {
        currentPage = 1; // Reset to page 1 on search/filter
        renderCurrentPage();
        createCharts(filteredReportsData); // Update charts based on filter
    }

    /** Toggle Theme **/
    function toggleTheme() {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        themeIcon.className = isDarkMode ? 'fas fa-moon' : 'fas fa-sun';
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    }

    /** Load Theme **/
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
        if (viewId === 'calendar') console.log("Load Calendar View Now...");
        if (viewId === 'timeline') console.log("Load Timeline View Now...");
    }

    // --- Event Listeners ---
    searchInput.addEventListener('input', handleFilterAndSearch);
    departmentFilter.addEventListener('change', handleFilterAndSearch);
    themeSwitcherBtn.addEventListener('click', toggleTheme);
    navLinks.forEach(link => link.addEventListener('click', handleNavigation));

    // --- Initial Setup ---
    loadTheme();
    fetchData();

}); // End of DOMContentLoaded