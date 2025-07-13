document.addEventListener('DOMContentLoaded', () => {
    // --- Global State & Config ---
    let allReports = [];
    let currentPage = 1;
    const reportsPerPage = 15;
    const recipientEmail = 'shamdan@aur.com.sa';
    let isAdmin = false;
    const ADMIN_PASSWORD = '1412';
    let activeKpiFilterType = null;
    let chartInstances = { department: null, frequency: null };
    let calendarInstance = null;
    let eventDates = new Set();
    let currentFilteredData = [];
    let lastActiveView = 'overview-section';
    let startDatePicker, endDatePicker;

    // --- DOM Element Cache ---
    const DOMElements = {
        loadingMessage: document.getElementById('loading-message'),
        searchInput: document.getElementById('search-input'),
        departmentFilter: document.getElementById('department-filter'),
        startDateInput: document.getElementById('start-date'),
        endDateInput: document.getElementById('end-date'),
        reportsTableBody: document.getElementById('reports-table-body'),
        paginationControls: document.getElementById('pagination-controls'),
        notificationDot: document.getElementById('notification-dot'),
        notificationsBtn: document.getElementById('notifications-btn'),
        notificationsDropdown: document.getElementById('notifications-dropdown'),
        notificationsList: document.getElementById('notifications-list'),
        passwordModal: document.getElementById('password-modal'),
        passwordForm: document.getElementById('password-form'),
        formModal: document.getElementById('form-modal'),
        reportForm: document.getElementById('report-form'),
        confirmModal: document.getElementById('confirm-modal'),
        kpiCards: document.querySelectorAll('.kpi-card'),
        calendarEl: document.getElementById('calendar'),
        monthFilterButtons: document.querySelectorAll('.month-filter-btn'),
        resetFiltersBtn: document.getElementById('reset-all-filters-btn'),
        departmentChartEl: document.getElementById('department-chart'),
        frequencyChartEl: document.getElementById('frequency-chart'),
        departmentDatalist: document.getElementById('department-list'),
        adminNavItem: document.getElementById('admin-nav-item'),
        adminReportsTableBody: document.getElementById('admin-reports-table-body'),
        adminSearchInput: document.getElementById('admin-search-input'),
    };

    // --- Utility Functions ---
    const getToday = () => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    };

    const getReportStatus = (dueDateString, today) => {
        const dateParts = dueDateString.split('-');
        const d1 = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        const d2 = new Date(today);
        const diff = Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
        
        if (diff < 0) return { text: 'منتهي', class: 'status-past-due', isPastDue: true };
        if (diff === 0) return { text: 'مستحق اليوم', class: 'status-due-today', isPastDue: false };
        if (diff > 0 && diff <= 3) return { text: 'قادم قريباً', class: 'status-due-soon', isPastDue: false };
        return { text: 'قادم', class: 'status-upcoming', isPastDue: false };
    };
    
    const showModal = (modal) => modal.style.display = 'block';
    const hideModal = (modal) => {
        if (!modal) return;
        modal.style.display = 'none';
    };

    // --- Firebase Integration ---
    const initializeFirebaseListener = () => {
        const checkFirebase = setInterval(() => {
            if (window.db && window.firebase) {
                clearInterval(checkFirebase);
                const { collection, onSnapshot } = window.firebase;
                onSnapshot(collection(window.db, 'reports'), (snapshot) => {
                    allReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    allReports.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
                    eventDates = new Set(allReports.map(r => r.dueDate));
                    DOMElements.loadingMessage.style.display = 'none';
                    populateDepartmentFilter();
                    populateDepartmentDatalist();
                    renderUI();
                }, (error) => {
                    console.error("Error fetching reports: ", error);
                    DOMElements.loadingMessage.textContent = 'خطأ في الاتصال بقاعدة البيانات.';
                });
            }
        }, 100);
    };

    // --- Core Rendering Pipeline ---
    const renderUI = () => {
        const today = getToday();
        const filters = {
            term: DOMElements.searchInput.value.toLowerCase().trim(),
            department: DOMElements.departmentFilter.value,
            start: DOMElements.startDateInput.value ? new Date(DOMElements.startDateInput.value) : null,
            end: DOMElements.endDateInput.value ? new Date(DOMElements.endDateInput.value) : null,
        };
        if(filters.end) filters.end.setHours(23, 59, 59, 999);

        const baseFiltered = allReports.filter(r =>
            (!filters.term || r.title.toLowerCase().includes(filters.term) || r.department.toLowerCase().includes(filters.term)) &&
            (!filters.department || r.department === filters.department)
        );

        const upcomingBase = baseFiltered.filter(r => !getReportStatus(r.dueDate, today).isPastDue);
        const pastDueBase = baseFiltered.filter(r => getReportStatus(r.dueDate, today).isPastDue);

        const filterByDate = (reports) => (filters.start && filters.end)
            ? reports.filter(r => { const d = new Date(r.dueDate); return d >= filters.start && d <= filters.end; })
            : reports;

        const upcomingInDate = filterByDate(upcomingBase);
        const pastDueInDate = filterByDate(pastDueBase);
        
        currentFilteredData = [...upcomingInDate, ...pastDueInDate].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        updateKPIs({ upcomingBase, pastDueBase, today });

        let reportsForDisplay;
        switch (activeKpiFilterType) {
            case 'total_reports': reportsForDisplay = upcomingBase; break;
            case 'period_reports': reportsForDisplay = currentFilteredData; break;
            case 'due_today': reportsForDisplay = upcomingInDate.filter(r => getReportStatus(r.dueDate, today).text === 'مستحق اليوم'); break;
            case 'due_soon': reportsForDisplay = upcomingInDate.filter(r => getReportStatus(r.dueDate, today).text === 'قادم قريباً'); break;
            case 'past_due':
                reportsForDisplay = pastDueBase.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
                break;
            default: 
                reportsForDisplay = (filters.start || filters.end) ? currentFilteredData : upcomingBase;
        }
        
        populateTable(reportsForDisplay, today);
        updateActiveView(today);
        updateNotificationDot(upcomingBase, today);
    };

    const updateKPIs = ({ upcomingBase, pastDueBase, today }) => {
        document.getElementById('kpi-total-reports-value').textContent = upcomingBase.length;
        document.getElementById('kpi-past-due-value').textContent = pastDueBase.length;
        
        const upcomingInDate = upcomingBase.filter(r => {
             const d = new Date(r.dueDate);
             const start = DOMElements.startDateInput.value ? new Date(DOMElements.startDateInput.value) : null;
             const end = DOMElements.endDateInput.value ? new Date(DOMElements.endDateInput.value) : null;
             if(end) end.setHours(23, 59, 59, 999);
             return (!start || d >= start) && (!end || d <= end);
        });

        document.getElementById('kpi-due-today-value').textContent = upcomingInDate.filter(r => getReportStatus(r.dueDate, today).text === 'مستحق اليوم').length;
        document.getElementById('kpi-due-soon-value').textContent = upcomingInDate.filter(r => getReportStatus(r.dueDate, today).text === 'قادم قريباً').length;
        
        const periodValueEl = document.getElementById('kpi-period-reports-value');
        if (DOMElements.startDateInput.value && DOMElements.endDateInput.value) {
             const pastInDate = pastDueBase.filter(r => {
                const d = new Date(r.dueDate);
                const start = new Date(DOMElements.startDateInput.value);
                const end = new Date(DOMElements.endDateInput.value);
                end.setHours(23, 59, 59, 999);
                return d >= start && d <= end;
            });
            periodValueEl.textContent = upcomingInDate.length + pastInDate.length;
        } else {
            periodValueEl.textContent = '-';
        }
    };
    
    const updateActiveView = (today) => {
        const activeView = document.querySelector('.view.active');
        if (!activeView) return;
        if (activeView.id === 'analytics-section') renderAnalyticsCharts(currentFilteredData);
        if (activeView.id === 'calendar-section') renderFullCalendar(currentFilteredData, today);
        if(activeView.id === 'admin-section') populateAdminTable();
    };

    const updateNotificationDot = (upcomingBase, today) => {
        const notificationCount = upcomingBase.filter(r => {
            const status = getReportStatus(r.dueDate, today);
            return status.class === 'status-due-today' || status.class === 'status-due-soon';
        }).length;
        DOMElements.notificationDot.style.display = notificationCount > 0 ? 'block' : 'none';
    };

    // --- UI Population ---
    const populateDepartmentFilter = () => {
        const departments = [...new Set(allReports.map(r => r.department))].sort((a, b) => a.localeCompare(b, 'ar'));
        const currentVal = DOMElements.departmentFilter.value;
        DOMElements.departmentFilter.innerHTML = '<option value="">كل الجهات</option>';
        departments.forEach(dept => DOMElements.departmentFilter.add(new Option(dept, dept)));
        DOMElements.departmentFilter.value = currentVal;
    };

    const populateDepartmentDatalist = () => {
        const departments = [...new Set(allReports.map(r => r.department))];
        DOMElements.departmentDatalist.innerHTML = '';
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            DOMElements.departmentDatalist.appendChild(option);
        });
    };

    const populateTable = (reports, today) => {
        DOMElements.reportsTableBody.innerHTML = '';
        const startIndex = (currentPage - 1) * reportsPerPage;
        const paginatedReports = reports.slice(startIndex, startIndex + reportsPerPage);

        if (paginatedReports.length === 0) {
            DOMElements.reportsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">لا توجد تقارير تطابق المعايير.</td></tr>`;
        } else {
            paginatedReports.forEach((report, index) => {
                const row = DOMElements.reportsTableBody.insertRow();
                const statusInfo = getReportStatus(report.dueDate, today);
                
                let userActions = `
                    <button class="action-button" onclick="window.sendEmailById('${report.id}')" title="إرسال التقرير"><i class="fas fa-envelope"></i></button>
                    <button class="action-button" onclick="window.downloadICSById('${report.id}')" title="إضافة للتقويم"><i class="fas fa-calendar-plus"></i></button>
                `;
                
                if (isAdmin) {
                    userActions += `
                        <button class="action-button" onclick="window.confirmUpdateById('${report.id}')" title="تعديل"><i class="fas fa-edit"></i></button>
                        <button class="action-button delete-btn" onclick="window.confirmDeleteById('${report.id}')" title="حذف"><i class="fas fa-trash"></i></button>
                    `;
                }

                row.innerHTML = `
                    <td>${startIndex + index + 1}</td>
                    <td>${report.department}</td>
                    <td>${report.title}</td>
                    <td>${report.frequency}</td>
                    <td>${new Date(report.dueDate).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })}</td>
                    <td><span class="status-tag ${statusInfo.class}">${statusInfo.text}</span></td>
                    <td><div class="actions-container">${userActions}</div></td>
                `;
            });
        }
        displayPagination(reports.length);
    };
    
    const displayPagination = (totalReports) => {
        DOMElements.paginationControls.innerHTML = '';
        const totalPages = Math.ceil(totalReports / reportsPerPage);
        if (totalPages <= 1) return;
        
        const createButton = (text, page, isDisabled, isActive) => {
            const btn = document.createElement('button');
            btn.innerHTML = text;
            btn.disabled = isDisabled;
            if(isActive) btn.classList.add('active');
            btn.onclick = () => { currentPage = page; renderUI(); };
            return btn;
        };

        DOMElements.paginationControls.appendChild(createButton('&laquo;', currentPage - 1, currentPage === 1));
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                DOMElements.paginationControls.appendChild(createButton(i, i, false, i === currentPage));
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                DOMElements.paginationControls.insertAdjacentHTML('beforeend', `<span>...</span>`);
            }
        }
        DOMElements.paginationControls.appendChild(createButton('&raquo;', currentPage + 1, currentPage === totalPages));
    };

    // --- Modals & Admin Logic ---
    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        const password = document.getElementById('admin-password').value;
        if (password === ADMIN_PASSWORD) {
            isAdmin = true;
            hideModal(DOMElements.passwordModal);
            DOMElements.adminNavItem.click();
        } else {
            alert("كلمة المرور غير صحيحة.");
        }
        DOMElements.passwordForm.reset();
    };

    const populateAdminTable = (searchTerm = '') => {
        const tableBody = DOMElements.adminReportsTableBody;
        tableBody.innerHTML = '';
        const filtered = allReports
            .filter(r => !searchTerm || r.title.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">لا توجد تقارير تطابق البحث.</td></tr>`;
            return;
        }
        filtered.forEach((report, index) => {
            const row = tableBody.insertRow();
            const statusInfo = getReportStatus(report.dueDate, getToday());
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${report.department}</td>
                <td>${report.title}</td>
                <td>${report.frequency}</td>
                <td>${new Date(report.dueDate).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })}</td>
                <td><span class="status-tag ${statusInfo.class}">${statusInfo.text}</span></td>
                <td>
                    <div class="actions-container">
                         <button class="action-button" onclick="window.confirmUpdateById('${report.id}')" title="تعديل"><i class="fas fa-edit"></i></button>
                         <button class="action-button delete-btn" onclick="window.confirmDeleteById('${report.id}')" title="حذف"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
        });
    };

    const openFormForEdit = (report, mode = 'single') => {
        DOMElements.reportForm.reset();
        document.getElementById('report-id').value = report.id;
        document.getElementById('edit-mode').value = mode;
        
        const recurrenceSection = document.getElementById('recurrence-section');
        const singleDateSection = document.getElementById('single-due-date-section');
        
        document.getElementById('report-department').value = report.department;
        document.getElementById('report-title').value = report.title;
        document.getElementById('report-frequency-text').value = report.frequency;
        document.getElementById('original-title').value = report.title;

        if (mode === 'single') {
            document.getElementById('form-modal-title').innerHTML = '<i class="fas fa-pen-to-square"></i> تعديل تقرير فردي';
            recurrenceSection.style.display = 'none';
            singleDateSection.style.display = 'block';
            document.getElementById('report-single-dueDate').value = report.dueDate;
        } else { // 'all' mode
            document.getElementById('form-modal-title').innerHTML = '<i class="fas fa-layer-group"></i> تعديل كل التقارير المشابهة';
            recurrenceSection.style.display = 'block';
            singleDateSection.style.display = 'none';
            updateRecurrenceUI();
            document.getElementById('report-startDate').value = '';
            document.getElementById('report-endDate').value = '';
        }
        
        showModal(DOMElements.formModal);
    };
    
    const openFormForAdd = () => {
        DOMElements.reportForm.reset();
        document.getElementById('report-id').value = '';
        document.getElementById('edit-mode').value = 'add';
        document.getElementById('form-modal-title').innerHTML = '<i class="fas fa-plus"></i> إضافة تقرير جديد';
        document.getElementById('recurrence-section').style.display = 'block';
        document.getElementById('single-due-date-section').style.display = 'none';
        document.getElementById('recurrence-end-date-group').style.display = 'flex';
        updateRecurrenceUI();
        showModal(DOMElements.formModal);
    };

    const updateRecurrenceUI = () => {
        const type = document.getElementById('report-recurrence-type').value;
        const daySelectorContainer = document.getElementById('recurrence-day-selector');
        const daySelector = document.getElementById('recurrence-day');
        const endDateGroup = document.getElementById('recurrence-end-date-group');
        
        daySelector.innerHTML = '';
        
        if (type === 'none') {
            daySelectorContainer.style.display = 'none';
            endDateGroup.style.display = 'none';
        } else {
            endDateGroup.style.display = 'flex';
            daySelectorContainer.style.display = 'block';
            if (type === 'weekly') {
                const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                days.forEach((day, index) => daySelector.add(new Option(day, index)));
            } else { // monthly, quarterly, etc.
                for (let i = 1; i <= 31; i++) {
                    daySelector.add(new Option(i, i));
                }
            }
        }
    };

    async function handleFormSubmit(event) {
        event.preventDefault();
        const saveBtn = document.getElementById('save-report-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'جاري الحفظ...';

        const { doc, updateDoc, writeBatch, collection, query, where, getDocs } = window.firebase;
        const db = window.db;
        const reportId = document.getElementById('report-id').value;
        const editMode = document.getElementById('edit-mode').value;

        try {
            if (editMode === 'single') {
                const reportRef = doc(db, 'reports', reportId);
                await updateDoc(reportRef, {
                    department: document.getElementById('report-department').value,
                    title: document.getElementById('report-title').value,
                    frequency: document.getElementById('report-frequency-text').value,
                    dueDate: document.getElementById('report-single-dueDate').value
                });
            } else if (editMode === 'all') {
                const originalTitle = document.getElementById('original-title').value;
                if (!originalTitle) throw new Error("Original report title not found for 'edit all'");
                
                const q = query(collection(db, "reports"), where("title", "==", originalTitle));
                const querySnapshot = await getDocs(q);
                const deleteBatch = writeBatch(db);
                querySnapshot.forEach(doc => deleteBatch.delete(doc.ref));
                await deleteBatch.commit();
                
                await createRecurrentReports();

            } else { // Add mode
                await createRecurrentReports();
            }
            hideModal(DOMElements.formModal);
        } catch (e) {
            console.error("Error saving document(s): ", e);
            alert("حدث خطأ أثناء حفظ التقرير.");
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'حفظ التغييرات';
        }
    }

    async function createRecurrentReports() {
        const { writeBatch, collection, doc: createDoc } = window.firebase;
        const db = window.db;
        const batch = writeBatch(db);
        const recurrenceType = document.getElementById('report-recurrence-type').value;
        const startDateValue = document.getElementById('report-startDate').value;
        const endDateValue = document.getElementById('report-endDate').value;

        if (!startDateValue) {
            alert('الرجاء تحديد تاريخ البدء.');
            throw new Error('Invalid start date');
        }
        const startDate = new Date(startDateValue + 'T00:00:00');
        
        const baseReport = {
            department: document.getElementById('report-department').value,
            title: document.getElementById('report-title').value,
            frequency: document.getElementById('report-frequency-text').value,
        };

        if (recurrenceType === 'none') {
            const docRef = createDoc(collection(db, "reports"));
            batch.set(docRef, { ...baseReport, dueDate: startDate.toISOString().split('T')[0] });
        } else {
            if (!endDateValue || new Date(endDateValue) < startDate) {
                alert('تاريخ انتهاء التكرار يجب أن يكون بعد تاريخ البدء.');
                throw new Error('Invalid end date');
            }
            const endDate = new Date(endDateValue + 'T23:59:59');
            const daySelector = document.getElementById('recurrence-day');
            const selectedDay = parseInt(daySelector.value);
            let currentDate = new Date(startDate);

            while (currentDate <= endDate) {
                let nextDate = new Date(currentDate);
                if (recurrenceType === 'weekly') {
                    let dayOffset = selectedDay - nextDate.getDay();
                    if (nextDate.getDay() > selectedDay) {
                         nextDate.setDate(nextDate.getDate() + 7 - (nextDate.getDay() - selectedDay));
                    } else {
                         nextDate.setDate(nextDate.getDate() + (selectedDay - nextDate.getDay()));
                    }
                } else {
                     nextDate.setDate(selectedDay);
                }

                if (nextDate >= startDate && nextDate <= endDate) {
                    const docRef = createDoc(collection(db, "reports"));
                    batch.set(docRef, { ...baseReport, dueDate: nextDate.toISOString().split('T')[0] });
                }

                if (recurrenceType === 'weekly') {
                    currentDate.setDate(currentDate.getDate() + 7);
                } else if (recurrenceType === 'monthly') {
                    currentDate.setMonth(currentDate.getMonth() + 1, 1);
                } else if (recurrenceType === 'quarterly') {
                    currentDate.setMonth(currentDate.getMonth() + 3, 1);
                } else if (recurrenceType === 'semi-annually') {
                    currentDate.setMonth(currentDate.getMonth() + 6, 1);
                } else if (recurrenceType === 'annually') {
                    currentDate.setFullYear(currentDate.getFullYear() + 1, 0, 1);
                } else {
                    break;
                }
            }
        }
        await batch.commit();
    }

    window.confirmUpdateById = (reportId) => {
        const report = allReports.find(r => r.id === reportId);
        if (!report) return;
        document.getElementById('confirm-modal-text').textContent = `هل تريد تعديل هذا التقرير فقط، أم كل التقارير التي تحمل اسم "${report.title}"؟`;
        document.getElementById('confirm-all-btn').textContent = 'تعديل الكل';
        document.getElementById('confirm-one-btn').textContent = 'تعديل هذا فقط';
        showModal(DOMElements.confirmModal);

        document.getElementById('confirm-all-btn').onclick = () => {
            hideModal(DOMElements.confirmModal);
            openFormForEdit(report, 'all');
        };
        document.getElementById('confirm-one-btn').onclick = () => {
            hideModal(DOMElements.confirmModal);
            openFormForEdit(report, 'single');
        };
    };

    window.confirmDeleteById = (reportId) => {
        const report = allReports.find(r => r.id === reportId);
        if (!report) return;
        document.getElementById('confirm-modal-text').textContent = `هل تريد حذف هذا التقرير فقط، أم كل التقارير التي تحمل اسم "${report.title}"؟`;
        document.getElementById('confirm-all-btn').textContent = 'حذف الكل';
        document.getElementById('confirm-one-btn').textContent = 'حذف هذا فقط';
        showModal(DOMElements.confirmModal);

        document.getElementById('confirm-all-btn').onclick = () => {
            hideModal(DOMElements.confirmModal);
            handleMassiveDelete(report.title);
        };
        document.getElementById('confirm-one-btn').onclick = () => {
            hideModal(DOMElements.confirmModal);
            deleteReport(report.id);
        };
    };
    
    async function handleMassiveDelete(title) {
        const { query, where, getDocs, writeBatch, collection } = window.firebase;
        const db = window.db;
        const q = query(collection(db, "reports"), where("title", "==", title));
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);
        querySnapshot.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        if (document.getElementById('admin-section').classList.contains('active')) {
            populateAdminTable(DOMElements.adminSearchInput.value);
        }
    }

    async function deleteReport(id) {
        try {
            const { doc, deleteDoc } = window.firebase;
            await deleteDoc(doc(window.db, 'reports', id));
            if (document.getElementById('admin-section').classList.contains('active')) {
                populateAdminTable(DOMElements.adminSearchInput.value);
            }
        } catch (error) {
            console.error("Error deleting report: ", error);
            alert("حدث خطأ أثناء الحذف.");
        }
    }

    // FIX: This function now correctly triggers a UI update
    const handleMonthFilterClick = (btn) => {
        DOMElements.monthFilterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const type = btn.id === 'filter-current-month' ? 'current' : 'next';
        const today = new Date();
        let year = today.getFullYear();
        let month = today.getMonth();
        if (type === 'next') {
            month++;
            if (month > 11) { month = 0; year++; }
        }
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        startDatePicker.setDate(firstDay, true);
        endDatePicker.setDate(lastDay, true);

        // Manually trigger the UI update
        renderUI();
    };
    
    const toggleNotificationsDropdown = () => {
        const isShown = DOMElements.notificationsDropdown.classList.toggle('show');
        if (isShown) populateNotificationsDropdown();
    };

    const populateNotificationsDropdown = () => {
        const list = DOMElements.notificationsList;
        list.innerHTML = '';
        const today = getToday();
        const alertReports = allReports.filter(r => {
            const status = getReportStatus(r.dueDate, today);
            return status.class === 'status-due-today' || status.class === 'status-due-soon';
        });

        if (alertReports.length === 0) {
            list.innerHTML = '<li class="no-notifications">لا توجد تنبيهات حالية.</li>';
        } else {
            alertReports.forEach(report => {
                const statusInfo = getReportStatus(report.dueDate, today);
                const item = document.createElement('li');
                item.innerHTML = `
                    <span class="notification-details">${report.department} | ${report.title}</span>
                    <span class="notification-status-tag ${statusInfo.class}">${statusInfo.text}</span>
                `;
                list.appendChild(item);
            });
        }
    };
    
    // --- Event Listeners Setup ---
    const setupEventListeners = () => {
        [DOMElements.searchInput, DOMElements.departmentFilter].forEach(el => {
            el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
                activeKpiFilterType = null; currentPage = 1;
                DOMElements.monthFilterButtons.forEach(b => b.classList.remove('active'));
                renderUI();
            });
        });
        DOMElements.resetFiltersBtn.addEventListener('click', () => {
            DOMElements.searchInput.value = ''; 
            DOMElements.departmentFilter.value = '';
            startDatePicker.clear();
            endDatePicker.clear();
            DOMElements.monthFilterButtons.forEach(b => b.classList.remove('active'));
            activeKpiFilterType = null; currentPage = 1; renderUI();
        });
        DOMElements.monthFilterButtons.forEach(btn => {
            if(btn.id !== 'reset-all-filters-btn') {
                btn.onclick = () => handleMonthFilterClick(btn);
            }
        });

        // KPI Cards
        DOMElements.kpiCards.forEach(card => card.addEventListener('click', () => {
            const kpiType = card.dataset.kpiType;
            activeKpiFilterType = activeKpiFilterType === kpiType ? null : kpiType;
            currentPage = 1;
            renderUI();
            DOMElements.kpiCards.forEach(c => c.classList.remove('kpi-active-filter'));
            if(activeKpiFilterType) card.classList.add('kpi-active-filter');
        }));

        // Navigation
        document.querySelector('.sidebar-nav').addEventListener('click', (e) => {
            e.preventDefault();
            const navItem = e.target.closest('.nav-item');
            if (!navItem) return;

            if (navItem.id === 'admin-nav-item' && !isAdmin) {
                showModal(DOMElements.passwordModal);
                return;
            }

            if (navItem.classList.contains('active')) return;

            document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => item.classList.remove('active'));
            navItem.classList.add('active');
            
            lastActiveView = document.querySelector('.view.active').id;
            document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
            document.getElementById(navItem.dataset.view).classList.add('active');
            renderUI();
        });

        // Modals & Admin
        DOMElements.passwordForm.addEventListener('submit', handlePasswordSubmit);
        document.querySelectorAll('.modal .close-button').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            hideModal(btn.closest('.modal'));
        }));
        window.addEventListener('click', (e) => { 
            if (e.target.classList.contains('modal')) {
                e.stopPropagation();
                hideModal(e.target);
            }
        });
        document.getElementById('admin-add-new-btn').onclick = openFormForAdd;
        DOMElements.adminSearchInput.oninput = (e) => populateAdminTable(e.target.value);
        DOMElements.reportForm.addEventListener('submit', handleFormSubmit);
        document.getElementById('report-recurrence-type').onchange = updateRecurrenceUI;
        document.getElementById('confirm-cancel-btn').onclick = (e) => hideModal(DOMElements.confirmModal, e);
        
        // Notifications
        DOMElements.notificationsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleNotificationsDropdown(); });
        document.addEventListener('click', () => DOMElements.notificationsDropdown.classList.remove('show'));
    };

    // --- Init ---
    setupEventListeners();
    initializeFirebaseListener();
    
    const flatpickrConfig = {
        locale: "ar",
        dateFormat: "Y-m-d",
    };
    
    flatpickr("#report-single-dueDate", flatpickrConfig);
    flatpickr("#report-startDate", flatpickrConfig);
    flatpickr("#report-endDate", flatpickrConfig);

    const sidebarFlatpickrConfig = {
        ...flatpickrConfig,
        onClose: function(selectedDates, dateStr, instance) {
            activeKpiFilterType = null;
            currentPage = 1;
            document.querySelectorAll('.month-filter-btn').forEach(b => b.classList.remove('active'));
            renderUI();
        }
    };

    startDatePicker = flatpickr("#start-date", {
        ...sidebarFlatpickrConfig,
        onChange: function(selectedDates, dateStr, instance) {
            if (endDatePicker) {
                endDatePicker.set('minDate', selectedDates[0]);
            }
        },
    });

    endDatePicker = flatpickr("#end-date", {
        ...sidebarFlatpickrConfig,
        onChange: function(selectedDates, dateStr, instance) {
            if (startDatePicker) {
                startDatePicker.set('maxDate', selectedDates[0]);
            }
        },
    });
    
    // --- Global Functions ---
    function renderAnalyticsCharts(data) {
        const departmentCounts = data ? data.reduce((acc, r) => ({ ...acc, [r.department]: (acc[r.department] || 0) + 1 }), {}) : {};
        const frequencyCounts = data ? data.reduce((acc, r) => ({ ...acc, [r.frequency]: (acc[r.frequency] || 0) + 1 }), {}) : {};
        
        const chartOptions = { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { position: 'bottom', labels: { font: { family: "'Cairo', sans-serif" } } } 
            },
            onHover: (event, chartElement) => {
                event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
            }
        };

        const hoverOptions = {
            hoverBorderWidth: 3,
            hoverBorderColor: '#777'
        };
        
        if (chartInstances.department) chartInstances.department.destroy();
        chartInstances.department = new Chart(DOMElements.departmentChartEl, { 
            type: 'pie', 
            data: { 
                labels: Object.keys(departmentCounts), 
                datasets: [{ 
                    data: Object.values(departmentCounts), 
                    backgroundColor: ['#C89638', '#bd9a5f', '#AEC6CF', '#E67E22', '#5cb85c', '#5bc0de', '#95A5A6', '#2C3E50'],
                    ...hoverOptions
                }] 
            }, 
            options: chartOptions 
        });
        
        if (chartInstances.frequency) chartInstances.frequency.destroy();
        chartInstances.frequency = new Chart(DOMElements.frequencyChartEl, { 
            type: 'bar', 
            data: { 
                labels: Object.keys(frequencyCounts), 
                datasets: [{ 
                    label: 'التقارير', 
                    data: Object.values(frequencyCounts), 
                    backgroundColor: 'rgba(200, 150, 56, 0.8)',
                    ...hoverOptions
                }] 
            }, 
            options: { ...chartOptions, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } } 
        });
    }

    function renderFullCalendar(data, today) {
        const events = data.map(report => ({
            id: report.id,
            title: report.title,
            start: report.dueDate,
            allDay: true,
            extendedProps: { reportId: report.id },
            className: getReportStatus(report.dueDate, today).class,
        }));

        if (calendarInstance) {
            calendarInstance.destroy();
        }
        
        calendarInstance = new FullCalendar.Calendar(DOMElements.calendarEl, {
            locale: 'ar',
            headerToolbar: { right: 'prev,next today', center: 'title', left: '' },
            initialView: 'dayGridMonth',
            height: 'auto',
            events: events,
            eventClick: function(info) {
                window.sendEmailById(info.event.extendedProps.reportId);
            },
            eventDidMount: function(info) {
                info.el.style.cursor = 'pointer';
            }
        });
        calendarInstance.render();
    }

    window.sendEmailById = (reportId) => {
        const report = allReports.find(r => r.id === reportId);
        if (!report) return;
        const subject = `تقرير: ${report.title}`;
        const body = `السلام عليكم،\n\nيرجى الاطلاع على تقرير "${report.title}" المرفق.\n\nمع وافر التحية والتقدير.`;
        window.location.href = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
    
    window.downloadICSById = (reportId) => {
        const report = allReports.find(r => r.id === reportId);
        if (!report) return;
        const formatDate = (date) => date.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
        const icsContent = [
            'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AUR//Report Dashboard//EN',
            'BEGIN:VEVENT',
            `UID:report-${report.id}@aur.com.sa`,
            `DTSTAMP:${formatDate(new Date())}`,
            `DTSTART;VALUE=DATE:${report.dueDate.replace(/-/g, '')}`,
            `SUMMARY:تذكير بتقرير: ${report.title}`,
            'END:VEVENT', 'END:VCALENDAR'
        ].join('\r\n');
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `تذكير-${report.title.replace(/[\s/]+/g, '_')}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }
});
