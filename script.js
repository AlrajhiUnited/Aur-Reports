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


    // --- Settings & State ---
    const dataUrl = 'data.json';
    const targetEmail = 'shamdan@aur.com.sa';
    const currentDate = new Date('2025-05-26T00:00:00'); // Use new Date() for real use
    let allReportsData = []; // To store all data for filtering
    let departmentChart = null; // To hold chart instance
    let frequencyChart = null; // To hold chart instance

    // --- Date Calculations ---
    const today = new Date(currentDate.setHours(0, 0, 0, 0));
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(today.getDate() + 3);

    // --- Functions ---

    /** Get Status Info **/
    function getStatus(dueDateStr) {
        const due = new Date(new Date(dueDateStr).setHours(0, 0, 0, 0));

        if (due < today) {
            return { text: "فات موعده", class: "status-past", isPast: true, isNear: false };
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
        const deptCounts = data.reduce((acc, report) => {
            acc[report[1]] = (acc[report[1]] || 0) + 1;
            return acc;
        }, {});
        
        const freqCounts = data.reduce((acc, report) => {
            acc[report[3]] = (acc[report[3]] || 0) + 1;
            return acc;
        }, {});

        const chartColors = ['#C89638', '#bd9a5f', '#2C3E50', '#3498DB', '#95A5A6', '#E74C3C'];

        if(departmentChart) departmentChart.destroy();
        if(frequencyChart) frequencyChart.destroy();

        departmentChart = new Chart(departmentChartCanvas, {
            type: 'pie',
            data: {
                labels: Object.keys(deptCounts),
                datasets: [{ data: Object.values(deptCounts), backgroundColor: chartColors }]
            },
            options: { responsive: true, plugins: { legend: { position: 'top' } } }
        });

        frequencyChart = new Chart(frequencyChartCanvas, {
            type: 'bar',
            data: {
                labels: Object.keys(freqCounts),
                datasets: [{ label: 'عدد التقارير', data: Object.values(freqCounts), backgroundColor: '#3498DB' }]
            },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    }

    /** Populate Table & Update KPIs **/
    function populateTable(reportsData) {
        tableBody.innerHTML = '';
        let dueTodayCount = 0;
        let nearCount = 0; // Includes today + next 3 days
        let pastDueCount = 0;
        let due3DaysOnlyCount = 0; // Only next 3 days

        reportsData.forEach(report => {
            const [id, department, title, frequency, dateString] = report;
            const statusInfo = getStatus(dateString);

            // Update KPIs
            if (statusInfo.class === 'status-due') dueTodayCount++;
            if (statusInfo.isNear) nearCount++;
            if (statusInfo.isPast) pastDueCount++;
            if (statusInfo.class === 'status-upcoming') due3DaysOnlyCount++;

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

        kpiTotal.textContent = reportsData.length;
        kpiDueToday.textContent = dueTodayCount;
        kpiDue3Days.textContent = due3DaysOnlyCount + dueTodayCount; 
        kpiPastDue.textContent = pastDueCount;

        notificationDot.classList.toggle('hidden', nearCount === 0);
    }

    /** Fetch Data **/
    async function fetchData() {
        try {
            const response = await fetch(dataUrl);
            if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
            allReportsData = await response.json();
            populateTable(allReportsData);
            createCharts(allReportsData);
        } catch (error) {
            console.error('Fetch Error:', error);
            tableBody.innerHTML = '<tr><td colspan="7">فشل تحميل البيانات.</td></tr>';
        }
    }

    /** Handle Search **/
    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredData = allReportsData.filter(report => {
            return report[1].toLowerCase().includes(searchTerm) || 
                   report[2].toLowerCase().includes(searchTerm);
        });
        populateTable(filteredData);
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
    searchInput.addEventListener('input', handleSearch);
    themeSwitcherBtn.addEventListener('click', toggleTheme);
    navLinks.forEach(link => link.addEventListener('click', handleNavigation));

    // --- Initial Setup ---
    loadTheme();
    fetchData();

}); // End of DOMContentLoaded