class CalendarApp {
    constructor() {
        this.currentDate = new Date();
        this.events = new Map();
        this.selectedEvent = null;
        this.isDraggingEvent = false;
        this.isResizingEvent = false;
        this.resizingDirection = '';
        this.dragStartY = 0;
        this.eventStartY = 0;
        this.sheetState = 'closed'; // closed, collapsed, expanded
        this.isCreatingEvent = false;
        this.eventPreview = {
            startTime: null,
            endTime: null,
            top: 0,
            height: 60
        };
        this.swipeState = {
            startX: 0,
            startY: 0,
            isSwiping: false,
            direction: null,
            translateX: 0
        };
        this.currentCalendarIndex = 1; // For swipe animation
        this.calendars = []; // Store multiple calendar instances for swipe
        
        this.eventColors = [
            '#4285f4', // Blueberry
            '#ea4335', // Flamingo
            '#fbbc04', // Banana
            '#34a853', // Sage
            '#fa7b17', // Orange
            '#9334e6', // Lavender
            '#039be5', // Peacock
            '#616161'  // Graphite
        ];
        
        this.init();
    }

    init() {
        this.loadEvents();
        this.setupDOM();
        this.setupEventListeners();
        this.renderCalendar();
        this.updateCurrentTime();
        this.registerServiceWorker();
        
        // Update current time every minute
        setInterval(() => this.updateCurrentTime(), 60000);
    }

    setupDOM() {
        this.dom = {
            currentDate: document.getElementById('currentDate'),
            currentWeekday: document.getElementById('currentWeekday'),
            calendarContainer: document.getElementById('calendarContainer'),
            calendarWrapper: document.getElementById('calendarWrapper'),
            calendar: document.getElementById('calendar'),
            timeGrid: document.getElementById('timeGrid'),
            eventsContainer: document.getElementById('eventsContainer'),
            hourLabels: document.getElementById('hourLabels'),
            currentTimeLine: document.getElementById('currentTimeLine'),
            eventPreview: document.getElementById('eventPreview'),
            addEventBtn: document.getElementById('addEventBtn'),
            bottomSheet: document.getElementById('bottomSheet'),
            overlay: document.getElementById('overlay'),
            eventTitleInput: document.getElementById('eventTitleInput'),
            colorPicker: document.getElementById('colorPicker'),
            startTimeDisplay: document.getElementById('startTimeDisplay'),
            endTimeDisplay: document.getElementById('endTimeDisplay'),
            dateDisplaySheet: document.getElementById('dateDisplaySheet'),
            repeatSelect: document.getElementById('repeatSelect'),
            eventDescription: document.getElementById('eventDescription'),
            deleteBtn: document.getElementById('deleteBtn'),
            saveBtn: document.getElementById('saveBtn'),
            dragHandle: document.getElementById('dragHandle'),
            todayBtn: document.getElementById('todayBtn'),
            menuBtn: document.getElementById('menuBtn'),
            searchBtn: document.getElementById('searchBtn'),
            timeModal: document.getElementById('timeModal'),
            startHourSelect: document.getElementById('startHourSelect'),
            startMinuteSelect: document.getElementById('startMinuteSelect'),
            endHourSelect: document.getElementById('endHourSelect'),
            endMinuteSelect: document.getElementById('endMinuteSelect'),
            cancelTimeBtn: document.getElementById('cancelTimeBtn'),
            applyTimeBtn: document.getElementById('applyTimeBtn')
        };

        this.setupTimeGrid();
        this.setupHourLabels();
        this.setupColorPicker();
        this.setupTimeSelectors();
        this.setupSheetDrag();
    }

    setupTimeGrid() {
        this.dom.timeGrid.innerHTML = '';
        for (let hour = 0; hour < 24; hour++) {
            const hourSlot = document.createElement('div');
            hourSlot.className = 'hour-slot';
            hourSlot.dataset.hour = hour;
            this.dom.timeGrid.appendChild(hourSlot);

            const halfHourSlot = document.createElement('div');
            halfHourSlot.className = 'half-hour-slot';
            this.dom.timeGrid.appendChild(halfHourSlot);
        }
    }

    setupHourLabels() {
        this.dom.hourLabels.innerHTML = '';
        for (let hour = 0; hour < 24; hour++) {
            const hourLabel = document.createElement('div');
            hourLabel.className = 'hour-label';
            hourLabel.textContent = `${hour.toString().padStart(2, '0')}:00`;
            this.dom.hourLabels.appendChild(hourLabel);
        }
    }

    setupColorPicker() {
        this.dom.colorPicker.innerHTML = '';
        this.eventColors.forEach(color => {
            const colorOption = document.createElement('div');
            colorOption.className = 'color-option';
            colorOption.style.backgroundColor = color;
            colorOption.dataset.color = color;
            colorOption.addEventListener('click', () => this.selectColor(color));
            this.dom.colorPicker.appendChild(colorOption);
        });
        this.selectColor(this.eventColors[0]);
    }

    setupTimeSelectors() {
        // Setup hour options
        for (let i = 0; i < 24; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i.toString().padStart(2, '0');
            this.dom.startHourSelect.appendChild(option.cloneNode(true));
            this.dom.endHourSelect.appendChild(option.cloneNode(true));
        }

        // Setup minute options (15 minute intervals)
        for (let i = 0; i < 60; i += 15) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i.toString().padStart(2, '0');
            this.dom.startMinuteSelect.appendChild(option.cloneNode(true));
            this.dom.endMinuteSelect.appendChild(option.cloneNode(true));
        }

        // Set default times
        const now = new Date();
        const startHour = now.getHours();
        const startMinute = Math.ceil(now.getMinutes() / 15) * 15;
        const endHour = startMinute === 45 ? (startHour + 1) % 24 : startHour;
        const endMinute = (startMinute + 15) % 60;

        this.dom.startHourSelect.value = startHour;
        this.dom.startMinuteSelect.value = startMinute;
        this.dom.endHourSelect.value = endHour;
        this.dom.endMinuteSelect.value = endMinute;

        // Event listeners for time modal
        this.dom.startTimeDisplay.addEventListener('click', () => this.showTimeModal('start'));
        this.dom.endTimeDisplay.addEventListener('click', () => this.showTimeModal('end'));
        this.dom.cancelTimeBtn.addEventListener('click', () => this.hideTimeModal());
        this.dom.applyTimeBtn.addEventListener('click', () => this.applyTimeFromModal());
    }

    setupSheetDrag() {
        let startY = 0;
        let startSheetY = 0;
        let isDragging = false;

        const startDrag = (e) => {
            isDragging = true;
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            startSheetY = this.bottomSheetY;
            e.preventDefault();
        };

        const doDrag = (e) => {
            if (!isDragging) return;
            
            const currentY = e.touches ? e.touches[0].clientY : e.clientY;
            const deltaY = currentY - startY;
            const newY = Math.max(0, Math.min(window.innerHeight - 120, startSheetY + deltaY));
            
            this.bottomSheetY = newY;
            this.updateSheetPosition();
        };

        const stopDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            
            // Snap to nearest state
            const screenHeight = window.innerHeight;
            const sheetHeight = this.dom.bottomSheet.offsetHeight;
            const currentY = this.bottomSheetY;
            
            if (currentY < screenHeight * 0.3) {
                this.expandSheet();
            } else if (currentY < screenHeight - 200) {
                this.collapseSheet();
            } else {
                this.closeSheet();
            }
        };

        this.dom.dragHandle.addEventListener('mousedown', startDrag);
        this.dom.dragHandle.addEventListener('touchstart', startDrag, { passive: false });
        
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('touchmove', doDrag, { passive: false });
        
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
    }

    setupEventListeners() {
        // Add event button
        this.dom.addEventBtn.addEventListener('click', () => this.createNewEvent());

        // Today button
        this.dom.todayBtn.addEventListener('click', () => this.goToToday());

        // Save event
        this.dom.saveBtn.addEventListener('click', () => this.saveEvent());

        // Delete event
        this.dom.deleteBtn.addEventListener('click', () => this.deleteEvent());

        // Close sheet when clicking overlay
        this.dom.overlay.addEventListener('click', () => this.closeSheet());

        // Event title input focus
        this.dom.eventTitleInput.addEventListener('focus', () => this.expandSheet());

        // Setup touch events for calendar
        this.setupCalendarTouchEvents();

        // Setup swipe for changing days
        this.setupSwipeEvents();

        // Menu and search buttons
        this.dom.menuBtn.addEventListener('click', () => this.showMenu());
        this.dom.searchBtn.addEventListener('click', () => this.showSearch());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    setupCalendarTouchEvents() {
        let isCreating = false;
        let createStartY = 0;
        let createHeight = 60;
        let isResizingPreview = false;
        let resizeStartY = 0;
        let originalTop = 0;
        let originalHeight = 0;

        const getTimeFromY = (y) => {
            const rect = this.dom.calendar.getBoundingClientRect();
            const relativeY = y - rect.top + this.dom.calendar.scrollTop;
            const totalMinutes = Math.round((relativeY / 60) * 60);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return { hours, minutes, totalMinutes };
        };

        // Single tap to create event preview
        this.dom.calendar.addEventListener('click', (e) => {
            if (e.target.closest('.event')) return;
            
            const rect = this.dom.calendar.getBoundingClientRect();
            const y = e.clientY - rect.top + this.dom.calendar.scrollTop;
            const time = getTimeFromY(e.clientY);
            
            // Snap to 15 minutes
            const snappedMinutes = Math.round(time.minutes / 15) * 15;
            const totalMinutes = time.hours * 60 + snappedMinutes;
            
            this.showEventPreview(totalMinutes, totalMinutes + 60);
            this.openSheetForPreview();
        });

        // Touch events for creating/resizing preview
        this.dom.calendar.addEventListener('touchstart', (e) => {
            if (e.target.closest('.event')) return;
            
            const touch = e.touches[0];
            const time = getTimeFromY(touch.clientY);
            const snappedMinutes = Math.round(time.minutes / 15) * 15;
            const totalMinutes = time.hours * 60 + snappedMinutes;
            
            isCreating = true;
            createStartY = touch.clientY;
            createHeight = 60; // 1 hour default
            
            this.showEventPreview(totalMinutes, totalMinutes + 60);
            e.preventDefault();
        });

        this.dom.calendar.addEventListener('touchmove', (e) => {
            if (!isCreating && !isResizingPreview) return;
            
            const touch = e.touches[0];
            const currentY = touch.clientY;
            
            if (isCreating) {
                const deltaY = currentY - createStartY;
                const deltaMinutes = Math.round((deltaY / 60) * 60);
                const newHeight = Math.max(15, Math.min(1440, createHeight + deltaMinutes));
                
                const time = getTimeFromY(createStartY);
                const snappedMinutes = Math.round(time.minutes / 15) * 15;
                const startMinutes = time.hours * 60 + snappedMinutes;
                const endMinutes = startMinutes + newHeight;
                
                this.updateEventPreview(startMinutes, endMinutes);
            }
            
            e.preventDefault();
        });

        this.dom.calendar.addEventListener('touchend', () => {
            if (isCreating) {
                isCreating = false;
                this.openSheetForPreview();
            }
            if (isResizingPreview) {
                isResizingPreview = false;
            }
        });

        // Event preview resize handles
        this.setupPreviewResize();
    }

    setupPreviewResize() {
        let isResizing = false;
        let resizeStartY = 0;
        let originalTop = 0;
        let originalHeight = 0;
        let resizeDirection = '';

        const startResize = (e, direction) => {
            isResizing = true;
            resizeDirection = direction;
            resizeStartY = e.touches ? e.touches[0].clientY : e.clientY;
            
            const preview = this.dom.eventPreview;
            originalTop = parseFloat(preview.style.top);
            originalHeight = parseFloat(preview.style.height);
            
            preview.classList.add('resizing');
            e.preventDefault();
        };

        const doResize = (e) => {
            if (!isResizing) return;
            
            const currentY = e.touches ? e.touches[0].clientY : e.clientY;
            const deltaY = currentY - resizeStartY;
            const deltaMinutes = Math.round((deltaY / 60) * 60);
            
            if (resizeDirection === 'top') {
                const newTop = originalTop + deltaY;
                const snappedTop = Math.round(newTop / 15) * 15;
                const newHeight = Math.max(15, originalHeight - (snappedTop - originalTop));
                
                if (newHeight >= 15) {
                    this.dom.eventPreview.style.top = `${snappedTop}px`;
                    this.dom.eventPreview.style.height = `${newHeight}px`;
                    
                    // Update times
                    const startMinutes = (snappedTop / 60) * 60;
                    const endMinutes = startMinutes + newHeight;
                    this.updateTimeDisplays(startMinutes, endMinutes);
                }
            } else {
                const newHeight = Math.max(15, originalHeight + deltaY);
                const snappedHeight = Math.round(newHeight / 15) * 15;
                
                if (snappedHeight >= 15) {
                    this.dom.eventPreview.style.height = `${snappedHeight}px`;
                    
                    const startMinutes = (originalTop / 60) * 60;
                    const endMinutes = startMinutes + snappedHeight;
                    this.updateTimeDisplays(startMinutes, endMinutes);
                }
            }
            
            e.preventDefault();
        };

        const stopResize = () => {
            if (!isResizing) return;
            isResizing = false;
            this.dom.eventPreview.classList.remove('resizing');
        };

        // Add resize handles to preview
        const preview = this.dom.eventPreview;
        const topHandle = document.createElement('div');
        topHandle.className = 'resize-handle top';
        topHandle.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 20px;
            cursor: ns-resize;
        `;
        
        const bottomHandle = document.createElement('div');
        bottomHandle.className = 'resize-handle bottom';
        bottomHandle.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 20px;
            cursor: ns-resize;
        `;
        
        preview.appendChild(topHandle);
        preview.appendChild(bottomHandle);

        // Add event listeners
        topHandle.addEventListener('mousedown', (e) => startResize(e, 'top'));
        bottomHandle.addEventListener('mousedown', (e) => startResize(e, 'bottom'));
        
        topHandle.addEventListener('touchstart', (e) => startResize(e, 'top'), { passive: false });
        bottomHandle.addEventListener('touchstart', (e) => startResize(e, 'bottom'), { passive: false });
        
        document.addEventListener('mousemove', doResize);
        document.addEventListener('touchmove', doResize, { passive: false });
        
        document.addEventListener('mouseup', stopResize);
        document.addEventListener('touchend', stopResize);
    }

    setupSwipeEvents() {
        let startX = 0;
        let startY = 0;
        let isSwiping = false;
        let swipeDirection = null;

        this.dom.calendarContainer.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isSwiping = false;
        });

        this.dom.calendarContainer.addEventListener('touchmove', (e) => {
            if (!isSwiping && Math.abs(e.touches[0].clientX - startX) > 10) {
                isSwiping = true;
                swipeDirection = e.touches[0].clientX > startX ? 'right' : 'left';
            }
            
            if (isSwiping) {
                const deltaX = e.touches[0].clientX - startX;
                this.dom.calendarWrapper.style.transform = `translateX(${deltaX}px)`;
                e.preventDefault();
            }
        });

        this.dom.calendarContainer.addEventListener('touchend', (e) => {
            if (isSwiping) {
                const deltaX = e.changedTouches[0].clientX - startX;
                const shouldChangeDay = Math.abs(deltaX) > 100;
                
                if (shouldChangeDay) {
                    if (swipeDirection === 'left') {
                        this.nextDayWithAnimation(deltaX);
                    } else {
                        this.previousDayWithAnimation(deltaX);
                    }
                } else {
                    // Return to original position
                    this.dom.calendarWrapper.style.transition = 'transform 0.3s ease';
                    this.dom.calendarWrapper.style.transform = 'translateX(0)';
                    setTimeout(() => {
                        this.dom.calendarWrapper.style.transition = '';
                    }, 300);
                }
                isSwiping = false;
            }
        });
    }

    showEventPreview(startMinutes, endMinutes) {
        const top = (startMinutes / 60) * 60;
        const height = ((endMinutes - startMinutes) / 60) * 60;
        
        this.dom.eventPreview.style.top = `${top}px`;
        this.dom.eventPreview.style.height = `${height}px`;
        this.dom.eventPreview.classList.add('visible');
        
        this.eventPreview.startTime = startMinutes;
        this.eventPreview.endTime = endMinutes;
        this.eventPreview.top = top;
        this.eventPreview.height = height;
    }

    updateEventPreview(startMinutes, endMinutes) {
        this.showEventPreview(startMinutes, endMinutes);
        this.updateTimeDisplays(startMinutes, endMinutes);
    }

    updateTimeDisplays(startMinutes, endMinutes) {
        const startHours = Math.floor(startMinutes / 60);
        const startMins = startMinutes % 60;
        const endHours = Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;
        
        this.dom.startTimeDisplay.textContent = 
            `${startHours.toString().padStart(2, '0')}:${startMins.toString().padStart(2, '0')}`;
        this.dom.endTimeDisplay.textContent = 
            `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
        
        // Update time modal if open
        if (this.timeModalType) {
            this.dom.startHourSelect.value = startHours;
            this.dom.startMinuteSelect.value = Math.round(startMins / 15) * 15;
            this.dom.endHourSelect.value = endHours;
            this.dom.endMinuteSelect.value = Math.round(endMins / 15) * 15;
        }
    }

    openSheetForPreview() {
        this.isCreatingEvent = true;
        this.selectedEvent = null;
        
        // Set form values from preview
        this.dom.eventTitleInput.value = '';
        this.dom.eventDescription.value = '';
        this.dom.repeatSelect.value = 'none';
        this.dom.deleteBtn.style.display = 'none';
        
        // Update date display
        this.dom.dateDisplaySheet.textContent = this.formatDate(this.currentDate);
        
        this.showSheet();
    }

    showSheet() {
        this.dom.bottomSheet.classList.add('active');
        this.dom.overlay.classList.add('active');
        this.sheetState = 'collapsed';
        this.bottomSheetY = window.innerHeight - 120;
        this.updateSheetPosition();
        
        setTimeout(() => this.dom.eventTitleInput.focus(), 300);
    }

    collapseSheet() {
        this.dom.bottomSheet.classList.remove('expanded');
        this.dom.bottomSheet.classList.add('collapsed');
        this.sheetState = 'collapsed';
        this.bottomSheetY = window.innerHeight - 120;
        this.updateSheetPosition();
    }

    expandSheet() {
        this.dom.bottomSheet.classList.remove('collapsed');
        this.dom.bottomSheet.classList.add('expanded');
        this.sheetState = 'expanded';
        this.bottomSheetY = 0;
        this.updateSheetPosition();
    }

    updateSheetPosition() {
        this.dom.bottomSheet.style.transform = `translateY(${this.bottomSheetY}px)`;
    }

    closeSheet() {
        this.dom.bottomSheet.classList.remove('active', 'expanded', 'collapsed');
        this.dom.overlay.classList.remove('active');
        this.dom.eventPreview.classList.remove('visible');
        this.sheetState = 'closed';
        this.selectedEvent = null;
        this.isCreatingEvent = false;
    }

    selectColor(color) {
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.toggle('selected', option.dataset.color === color);
        });
    }

    showTimeModal(type) {
        this.timeModalType = type;
        this.dom.timeModal.classList.add('active');
    }

    hideTimeModal() {
        this.dom.timeModal.classList.remove('active');
        this.timeModalType = null;
    }

    applyTimeFromModal() {
        const startHour = parseInt(this.dom.startHourSelect.value);
        const startMinute = parseInt(this.dom.startMinuteSelect.value);
        const endHour = parseInt(this.dom.endHourSelect.value);
        const endMinute = parseInt(this.dom.endMinuteSelect.value);
        
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;
        
        if (endMinutes <= startMinutes) {
            this.showSnackbar('Время окончания должно быть позже начала');
            return;
        }
        
        this.updateTimeDisplays(startMinutes, endMinutes);
        this.updateEventPreview(startMinutes, endMinutes);
        this.hideTimeModal();
    }

    createNewEvent() {
        const now = new Date();
        const startHour = now.getHours();
        const startMinute = Math.ceil(now.getMinutes() / 15) * 15;
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = startMinutes + 60; // 1 hour default
        
        this.showEventPreview(startMinutes, endMinutes);
        this.openSheetForPreview();
    }

    saveEvent() {
        const title = this.dom.eventTitleInput.value.trim();
        if (!title) {
            this.showSnackbar('Введите название события');
            return;
        }

        const startMinutes = this.eventPreview.startTime;
        const endMinutes = this.eventPreview.endTime;
        
        if (endMinutes <= startMinutes) {
            this.showSnackbar('Время окончания должно быть позже начала');
            return;
        }

        const eventData = {
            id: this.selectedEvent ? this.selectedEvent.id : Date.now().toString(),
            title,
            start: this.getDateFromMinutes(startMinutes).getTime(),
            end: this.getDateFromMinutes(endMinutes).getTime(),
            color: document.querySelector('.color-option.selected').dataset.color,
            description: this.dom.eventDescription.value,
            repeat: this.dom.repeatSelect.value,
            lastModified: Date.now()
        };

        this.events.set(eventData.id, eventData);
        this.saveEvents();
        this.renderEvents();
        this.closeSheet();
        this.showSnackbar('Событие сохранено');
    }

    deleteEvent() {
        if (this.selectedEvent) {
            this.events.delete(this.selectedEvent.id);
            this.saveEvents();
            this.renderEvents();
            this.closeSheet();
            this.showSnackbar('Событие удалено');
        }
    }

    getDateFromMinutes(minutes) {
        const date = new Date(this.currentDate);
        date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        return date;
    }

    renderCalendar() {
        this.updateDateDisplay();
        this.renderEvents();
        this.setupEventDragAndDrop();
    }

    updateDateDisplay() {
        this.dom.currentDate.textContent = this.currentDate.toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long' 
        });
        this.dom.currentWeekday.textContent = this.currentDate.toLocaleDateString('ru-RU', { 
            weekday: 'long' 
        });
    }

    renderEvents() {
        this.dom.eventsContainer.innerHTML = '';

        const eventsForDay = Array.from(this.events.values()).filter(event => {
            const eventDate = new Date(event.start);
            return eventDate.toDateString() === this.currentDate.toDateString();
        });

        eventsForDay.forEach(event => {
            this.renderEvent(event);
        });
    }

    renderEvent(event) {
        const eventElement = document.createElement('div');
        eventElement.className = 'event';
        eventElement.dataset.eventId = event.id;
        
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
        const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
        const duration = endMinutes - startMinutes;
        
        eventElement.style.top = `${(startMinutes / 60) * 60}px`;
        eventElement.style.height = `${(duration / 60) * 60}px`;
        eventElement.style.left = '4px';
        eventElement.style.right = '4px';
        eventElement.style.backgroundColor = this.hexToRgba(event.color, 0.2);
        eventElement.style.borderLeftColor = event.color;
        eventElement.style.color = this.getContrastColor(event.color);

        const title = document.createElement('div');
        title.className = 'event-title';
        title.textContent = event.title;
        
        const time = document.createElement('div');
        time.className = 'event-time';
        time.textContent = `${this.formatTime(startDate)} - ${this.formatTime(endDate)}`;

        eventElement.appendChild(title);
        eventElement.appendChild(time);

        // Event click
        eventElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editEvent(event);
        });

        // Setup drag
        this.setupEventDrag(eventElement, event);

        this.dom.eventsContainer.appendChild(eventElement);
    }

    setupEventDrag(eventElement, event) {
        let isDragging = false;
        let startY = 0;
        let originalTop = 0;

        const startDrag = (e) => {
            isDragging = true;
            eventElement.classList.add('dragging');
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            originalTop = parseFloat(eventElement.style.top);
            e.preventDefault();
        };

        const doDrag = (e) => {
            if (!isDragging) return;
            
            const currentY = e.touches ? e.touches[0].clientY : e.clientY;
            const deltaY = currentY - startY;
            const newTop = originalTop + deltaY;
            const snappedTop = Math.round(newTop / 15) * 15;
            
            eventElement.style.top = `${snappedTop}px`;
            
            // Update event time
            const newStartMinutes = (snappedTop / 60) * 60;
            const duration = parseFloat(eventElement.style.height);
            event.start = this.getDateFromMinutes(newStartMinutes).getTime();
            event.end = this.getDateFromMinutes(newStartMinutes + (duration / 60) * 60).getTime();
            
            e.preventDefault();
        };

        const stopDrag = () => {
            if (!isDragging) return;
            
            isDragging = false;
            eventElement.classList.remove('dragging');
            
            // Save changes
            this.events.set(event.id, event);
            this.saveEvents();
            this.showSnackbar('Событие перемещено');
        };

        eventElement.addEventListener('mousedown', startDrag);
        eventElement.addEventListener('touchstart', startDrag, { passive: false });
        
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('touchmove', doDrag, { passive: false });
        
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
    }

    setupEventDragAndDrop() {
        // Already handled in renderEvent
    }

    editEvent(event) {
        this.selectedEvent = event;
        this.isCreatingEvent = false;
        
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
        const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
        
        // Show preview at event position
        this.showEventPreview(startMinutes, endMinutes);
        
        // Fill form
        this.dom.eventTitleInput.value = event.title;
        this.updateTimeDisplays(startMinutes, endMinutes);
        this.dom.eventDescription.value = event.description || '';
        this.dom.repeatSelect.value = event.repeat || 'none';
        this.selectColor(event.color);
        this.dom.deleteBtn.style.display = 'block';
        
        // Update date display
        this.dom.dateDisplaySheet.textContent = this.formatDate(startDate);
        
        this.showSheet();
        this.expandSheet();
    }

    updateCurrentTime() {
        const now = new Date();
        if (now.toDateString() === this.currentDate.toDateString()) {
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const topPosition = (currentMinutes / 60) * 60;
            
            this.dom.currentTimeLine.style.top = `${topPosition}px`;
            this.dom.currentTimeLine.style.display = 'block';
            
            // Auto-scroll to current time
            const scrollPosition = Math.max(0, topPosition - 200);
            this.dom.calendar.scrollTop = scrollPosition;
        } else {
            this.dom.currentTimeLine.style.display = 'none';
        }
    }

    goToToday() {
        this.currentDate = new Date();
        this.renderCalendar();
        this.showSnackbar('Переход на сегодня');
    }

    nextDayWithAnimation(deltaX) {
        const nextDate = new Date(this.currentDate);
        nextDate.setDate(nextDate.getDate() + 1);
        
        // Create next day calendar
        const nextCalendar = this.createCalendarForDate(nextDate);
        nextCalendar.style.transform = `translateX(${window.innerWidth + deltaX}px)`;
        this.dom.calendarContainer.appendChild(nextCalendar);
        
        // Animate
        this.dom.calendarWrapper.style.transition = 'transform 0.4s ease';
        this.dom.calendarWrapper.style.transform = `translateX(-${window.innerWidth}px)`;
        
        setTimeout(() => {
            this.currentDate = nextDate;
            this.dom.calendarContainer.removeChild(nextCalendar);
            this.dom.calendarWrapper.style.transition = '';
            this.dom.calendarWrapper.style.transform = 'translateX(0)';
            this.renderCalendar();
        }, 400);
    }

    previousDayWithAnimation(deltaX) {
        const prevDate = new Date(this.currentDate);
        prevDate.setDate(prevDate.getDate() - 1);
        
        // Create previous day calendar
        const prevCalendar = this.createCalendarForDate(prevDate);
        prevCalendar.style.transform = `translateX(-${window.innerWidth + Math.abs(deltaX)}px)`;
        this.dom.calendarContainer.appendChild(prevCalendar);
        
        // Animate
        this.dom.calendarWrapper.style.transition = 'transform 0.4s ease';
        this.dom.calendarWrapper.style.transform = `translateX(${window.innerWidth}px)`;
        
        setTimeout(() => {
            this.currentDate = prevDate;
            this.dom.calendarContainer.removeChild(prevCalendar);
            this.dom.calendarWrapper.style.transition = '';
            this.dom.calendarWrapper.style.transform = 'translateX(0)';
            this.renderCalendar();
        }, 400);
    }

    createCalendarForDate(date) {
        const wrapper = document.createElement('div');
        wrapper.className = 'calendar-wrapper';
        
        const calendar = document.createElement('div');
        calendar.className = 'calendar';
        
        // Add time grid
        const timeGrid = document.createElement('div');
        timeGrid.className = 'time-grid';
        for (let i = 0; i < 24; i++) {
            timeGrid.appendChild(document.createElement('div'));
            timeGrid.appendChild(document.createElement('div'));
        }
        
        // Add events for this date
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'events-container';
        
        const eventsForDay = Array.from(this.events.values()).filter(event => {
            const eventDate = new Date(event.start);
            return eventDate.toDateString() === date.toDateString();
        });
        
        eventsForDay.forEach(event => {
            const eventElement = document.createElement('div');
            eventElement.className = 'event';
            eventElement.style.cssText = `
                position: absolute;
                left: 4px;
                right: 4px;
                background-color: ${this.hexToRgba(event.color, 0.2)};
                border-left: 4px solid ${event.color};
                color: ${this.getContrastColor(event.color)};
                border-radius: 8px;
                padding: 8px 12px;
                font-size: 14px;
            `;
            
            const startDate = new Date(event.start);
            const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
            const endDate = new Date(event.end);
            const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
            const duration = endMinutes - startMinutes;
            
            eventElement.style.top = `${(startMinutes / 60) * 60}px`;
            eventElement.style.height = `${(duration / 60) * 60}px`;
            
            eventsContainer.appendChild(eventElement);
        });
        
        calendar.appendChild(timeGrid);
        calendar.appendChild(eventsContainer);
        wrapper.appendChild(calendar);
        
        return wrapper;
    }

    handleKeyboardShortcuts(e) {
        if (e.key === 'Escape' && this.sheetState !== 'closed') {
            this.closeSheet();
        } else if (e.key === '+' || e.key === '=') {
            this.createNewEvent();
        } else if (e.key === 'ArrowRight' && e.ctrlKey) {
            this.nextDayWithAnimation(0);
        } else if (e.key === 'ArrowLeft' && e.ctrlKey) {
            this.previousDayWithAnimation(0);
        } else if (e.key === 't' && e.ctrlKey) {
            this.goToToday();
        }
    }

    showMenu() {
        this.showSnackbar('Меню будет реализовано в следующих версиях');
    }

    showSearch() {
        this.showSnackbar('Поиск будет реализован в следующих версиях');
    }

    // Utility methods
    formatDate(date) {
        return date.toLocaleDateString('ru-RU', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
    }

    formatTime(date) {
        return date.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    getContrastColor(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    // Storage methods
    saveEvents() {
        const eventsArray = Array.from(this.events.values());
        localStorage.setItem('calendarEvents', JSON.stringify(eventsArray));
    }

    loadEvents() {
        const saved = localStorage.getItem('calendarEvents');
        if (saved) {
            try {
                const eventsArray = JSON.parse(saved);
                eventsArray.forEach(event => {
                    this.events.set(event.id, event);
                });
            } catch (e) {
                console.error('Error loading events:', e);
            }
        }
    }

    // Snackbar for notifications
    showSnackbar(message) {
        const snackbar = document.createElement('div');
        snackbar.className = 'snackbar';
        snackbar.textContent = message;
        document.body.appendChild(snackbar);

        setTimeout(() => snackbar.classList.add('show'), 10);
        setTimeout(() => {
            snackbar.classList.remove('show');
            setTimeout(() => snackbar.remove(), 300);
        }, 3000);
    }

    // Service Worker for PWA
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js')
                .then(() => console.log('Service Worker registered'))
                .catch(err => console.error('Service Worker registration failed:', err));
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CalendarApp();
});
