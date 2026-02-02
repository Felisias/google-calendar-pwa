class CalendarApp {
    constructor() {
        this.currentDate = new Date();
        this.events = new Map();
        this.selectedEvent = null;
        this.isDragging = false;
        this.isResizing = false;
        this.dragStartY = 0;
        this.eventStartY = 0;
        this.sheetState = 'closed'; // closed, collapsed, expanded, maximized
        this.touchStart = { x: 0, y: 0 };
        this.currentView = 'day';
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
        this.render();
        this.updateCurrentTime();
        this.registerServiceWorker();
        
        // Update current time every minute
        setInterval(() => this.updateCurrentTime(), 60000);
    }

    setupDOM() {
        this.dom = {
            currentDate: document.getElementById('currentDate'),
            currentWeekday: document.getElementById('currentWeekday'),
            timeSlots: document.getElementById('timeSlots'),
            dayGrid: document.getElementById('dayGrid'),
            eventsContainer: document.getElementById('eventsContainer'),
            currentTimeLine: document.getElementById('currentTimeLine'),
            eventsColumn: document.getElementById('eventsColumn'),
            addEventBtn: document.getElementById('addEventBtn'),
            bottomSheet: document.getElementById('bottomSheet'),
            overlay: document.getElementById('overlay'),
            eventTitleInput: document.getElementById('eventTitleInput'),
            colorPicker: document.getElementById('colorPicker'),
            startTime: document.getElementById('startTime'),
            endTime: document.getElementById('endTime'),
            eventDate: document.getElementById('eventDate'),
            repeatSelect: document.getElementById('repeatSelect'),
            eventDescription: document.getElementById('eventDescription'),
            deleteBtn: document.getElementById('deleteBtn'),
            saveBtn: document.getElementById('saveBtn'),
            dragHandle: document.getElementById('dragHandle'),
            todayBtn: document.getElementById('todayBtn'),
            quickActions: document.getElementById('quickActions'),
            menuBtn: document.getElementById('menuBtn'),
            searchBtn: document.getElementById('searchBtn')
        };

        this.setupTimeSlots();
        this.setupDayGrid();
        this.setupColorPicker();
        this.setDefaultFormTimes();
    }

    setupTimeSlots() {
        for (let hour = 0; hour < 24; hour++) {
            // Full hour
            const fullHour = document.createElement('div');
            fullHour.className = 'time-slot';
            fullHour.textContent = `${hour.toString().padStart(2, '0')}:00`;
            this.dom.timeSlots.appendChild(fullHour);

            // Half hour
            const halfHour = document.createElement('div');
            halfHour.className = 'time-slot half-hour';
            this.dom.timeSlots.appendChild(halfHour);
        }
    }

    setupDayGrid() {
        for (let hour = 0; hour < 24; hour++) {
            const hourSlot = document.createElement('div');
            hourSlot.className = 'hour-slot';
            this.dom.dayGrid.appendChild(hourSlot);

            const halfHourSlot = document.createElement('div');
            halfHourSlot.className = 'half-hour-slot';
            this.dom.dayGrid.appendChild(halfHourSlot);
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

    setDefaultFormTimes() {
        const now = new Date();
        const startTime = new Date(now.getTime() + 60 * 60000); // 1 hour from now
        startTime.setMinutes(Math.ceil(startTime.getMinutes() / 15) * 15);
        
        const endTime = new Date(startTime.getTime() + 60 * 60000); // +1 hour
        
        this.dom.startTime.value = this.formatTime(startTime);
        this.dom.endTime.value = this.formatTime(endTime);
        this.dom.eventDate.value = this.formatDate(now);
    }

    setupEventListeners() {
        // Add event button
        this.dom.addEventBtn.addEventListener('click', () => this.openNewEventSheet());

        // Today button
        this.dom.todayBtn.addEventListener('click', () => this.goToToday());

        // Save event
        this.dom.saveBtn.addEventListener('click', () => this.saveEvent());

        // Delete event
        this.dom.deleteBtn.addEventListener('click', () => this.deleteEvent());

        // Close sheet when clicking overlay
        this.dom.overlay.addEventListener('click', () => this.closeSheet());

        // Swipe for changing days
        this.setupSwipeGestures();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        // Form inputs
        this.dom.eventTitleInput.addEventListener('focus', () => this.expandSheet());
        this.dom.startTime.addEventListener('change', () => this.adjustEndTime());
        
        // Long press to create event
        this.setupLongPress();

        // Quick actions
        this.setupQuickActions();

        // Menu and search buttons
        this.dom.menuBtn.addEventListener('click', () => this.showMenu());
        this.dom.searchBtn.addEventListener('click', () => this.showSearch());
    }

    setupSwipeGestures() {
        let startX = 0;
        let startY = 0;

        this.dom.eventsColumn.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });

        this.dom.eventsColumn.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const diffX = startX - endX;
            const diffY = startY - endY;

            // Horizontal swipe for changing days
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    this.nextDay(); // Swipe left
                } else {
                    this.previousDay(); // Swipe right
                }
            }
        });
    }

    setupLongPress() {
        let pressTimer;
        const longPressDelay = 500;

        this.dom.eventsColumn.addEventListener('touchstart', (e) => {
            if (e.target.classList.contains('event')) return;
            
            const rect = e.target.getBoundingClientRect();
            const y = e.touches[0].clientY - rect.top;
            const time = this.pixelsToTime(y);
            
            pressTimer = setTimeout(() => {
                this.createEventAtTime(time);
            }, longPressDelay);
        });

        this.dom.eventsColumn.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
        });

        this.dom.eventsColumn.addEventListener('touchmove', () => {
            clearTimeout(pressTimer);
        });
    }

    setupQuickActions() {
        const quickActions = document.querySelectorAll('.quick-action');
        quickActions.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Show/hide quick actions on add button long press
        let quickActionsTimer;
        this.dom.addEventBtn.addEventListener('touchstart', () => {
            quickActionsTimer = setTimeout(() => {
                this.dom.quickActions.classList.add('visible');
            }, 300);
        });

        this.dom.addEventBtn.addEventListener('touchend', () => {
            clearTimeout(quickActionsTimer);
        });

        this.dom.addEventBtn.addEventListener('click', () => {
            clearTimeout(quickActionsTimer);
        });
    }

    handleQuickAction(action) {
        const now = new Date();
        let duration = 30;

        switch (action) {
            case 'quick30':
                duration = 30;
                break;
            case 'quick60':
                duration = 60;
                break;
            case 'quick90':
                duration = 90;
                break;
            case 'quickCustom':
                this.openNewEventSheet();
                this.dom.quickActions.classList.remove('visible');
                return;
        }

        const startTime = new Date(now);
        startTime.setMinutes(Math.ceil(startTime.getMinutes() / 15) * 15);
        
        const endTime = new Date(startTime.getTime() + duration * 60000);

        this.openNewEventSheet();
        this.dom.startTime.value = this.formatTime(startTime);
        this.dom.endTime.value = this.formatTime(endTime);
        this.dom.quickActions.classList.remove('visible');
    }

    createEventAtTime(time) {
        const [hours, minutes] = time.split(':').map(Number);
        const eventDate = new Date(this.currentDate);
        eventDate.setHours(hours, minutes, 0, 0);

        const endTime = new Date(eventDate.getTime() + 60 * 60000);

        this.openNewEventSheet();
        this.dom.startTime.value = time;
        this.dom.endTime.value = this.formatTime(endTime);
        this.dom.eventDate.value = this.formatDate(eventDate);
    }

    openNewEventSheet(event = null) {
        this.selectedEvent = event;
        
        if (event) {
            // Editing existing event
            this.dom.eventTitleInput.value = event.title;
            this.dom.startTime.value = this.formatTime(new Date(event.start));
            this.dom.endTime.value = this.formatTime(new Date(event.end));
            this.dom.eventDate.value = this.formatDate(new Date(event.start));
            this.dom.eventDescription.value = event.description || '';
            this.dom.repeatSelect.value = event.repeat || 'none';
            this.selectColor(event.color);
            this.dom.deleteBtn.style.display = 'block';
        } else {
            // Creating new event
            this.dom.eventTitleInput.value = '';
            this.setDefaultFormTimes();
            this.dom.eventDescription.value = '';
            this.dom.repeatSelect.value = 'none';
            this.selectColor(this.eventColors[0]);
            this.dom.deleteBtn.style.display = 'none';
        }

        this.showSheet();
    }

    showSheet() {
        this.dom.bottomSheet.classList.add('active');
        this.dom.overlay.classList.add('active');
        this.sheetState = 'collapsed';
        setTimeout(() => this.dom.eventTitleInput.focus(), 300);
    }

    expandSheet() {
        this.dom.bottomSheet.classList.add('expanded');
        this.sheetState = 'expanded';
    }

    closeSheet() {
        this.dom.bottomSheet.classList.remove('active', 'expanded', 'maximized');
        this.dom.overlay.classList.remove('active');
        this.sheetState = 'closed';
        this.selectedEvent = null;
    }

    selectColor(color) {
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.toggle('selected', option.dataset.color === color);
        });
    }

    saveEvent() {
        const title = this.dom.eventTitleInput.value.trim();
        if (!title) {
            this.showSnackbar('Введите название события');
            return;
        }

        const startDate = new Date(`${this.dom.eventDate.value}T${this.dom.startTime.value}`);
        const endDate = new Date(`${this.dom.eventDate.value}T${this.dom.endTime.value}`);

        if (endDate <= startDate) {
            this.showSnackbar('Время окончания должно быть позже начала');
            return;
        }

        const eventData = {
            id: this.selectedEvent ? this.selectedEvent.id : Date.now().toString(),
            title,
            start: startDate.getTime(),
            end: endDate.getTime(),
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

    adjustEndTime() {
        const start = new Date(`2000-01-01T${this.dom.startTime.value}`);
        let end = new Date(start.getTime() + 60 * 60000); // Default +1 hour
        
        if (end.getDate() !== start.getDate()) {
            end = new Date(start.getTime() + 24 * 60 * 60000 - 1); // Max 23:59
        }
        
        this.dom.endTime.value = this.formatTime(end);
    }

    render() {
        this.updateDateDisplay();
        this.renderEvents();
        this.setupDragAndDrop();
    }

    updateDateDisplay() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
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

        // Group overlapping events
        const groups = this.groupOverlappingEvents(eventsForDay);

        groups.forEach(group => {
            if (group.length === 1) {
                this.renderEvent(group[0]);
            } else {
                this.renderEventGroup(group);
            }
        });
    }

    groupOverlappingEvents(events) {
        events.sort((a, b) => a.start - b.start);
        const groups = [];
        let currentGroup = [];

        events.forEach(event => {
            if (currentGroup.length === 0) {
                currentGroup.push(event);
            } else {
                const lastEvent = currentGroup[currentGroup.length - 1];
                if (event.start < lastEvent.end) {
                    currentGroup.push(event);
                } else {
                    groups.push([...currentGroup]);
                    currentGroup = [event];
                }
            }
        });

        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }

        return groups;
    }

    renderEvent(event) {
        const eventElement = document.createElement('div');
        eventElement.className = 'event';
        eventElement.dataset.eventId = event.id;
        
        const startMinutes = this.timeToMinutes(new Date(event.start));
        const endMinutes = this.timeToMinutes(new Date(event.end));
        const duration = endMinutes - startMinutes;
        
        eventElement.style.top = `${(startMinutes / 60) * 60}px`;
        eventElement.style.height = `${(duration / 60) * 60}px`;
        eventElement.style.backgroundColor = this.hexToRgba(event.color, 0.2);
        eventElement.style.borderLeftColor = event.color;
        eventElement.style.color = this.getContrastColor(event.color);

        eventElement.innerHTML = `
            <div class="event-title">${event.title}</div>
            <div class="event-time">${this.formatTime(new Date(event.start))} - ${this.formatTime(new Date(event.end))}</div>
            <div class="resize-handle top"></div>
            <div class="resize-handle bottom"></div>
        `;

        // Event click
        eventElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openNewEventSheet(event);
        });

        // Setup drag and resize
        this.setupEventInteractions(eventElement, event);

        this.dom.eventsContainer.appendChild(eventElement);
    }

    renderEventGroup(events) {
        const groupElement = document.createElement('div');
        groupElement.className = 'event-overlap-group';

        const groupStart = Math.min(...events.map(e => this.timeToMinutes(new Date(e.start))));
        const groupEnd = Math.max(...events.map(e => this.timeToMinutes(new Date(e.end))));
        
        groupElement.style.top = `${(groupStart / 60) * 60}px`;
        groupElement.style.height = `${((groupEnd - groupStart) / 60) * 60}px`;

        events.forEach((event, index) => {
            const eventElement = document.createElement('div');
            eventElement.className = 'event';
            eventElement.dataset.eventId = event.id;
            
            const startMinutes = this.timeToMinutes(new Date(event.start));
            const endMinutes = this.timeToMinutes(new Date(event.end));
            const duration = endMinutes - startMinutes;
            
            eventElement.style.top = `${((startMinutes - groupStart) / 60) * 60}px`;
            eventElement.style.height = `${(duration / 60) * 60}px`;
            eventElement.style.backgroundColor = this.hexToRgba(event.color, 0.2);
            eventElement.style.borderLeftColor = event.color;
            eventElement.style.color = this.getContrastColor(event.color);

            eventElement.innerHTML = `
                <div class="event-title">${event.title}</div>
                <div class="event-time">${this.formatTime(new Date(event.start))}</div>
            `;

            eventElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openNewEventSheet(event);
            });

            groupElement.appendChild(eventElement);
        });

        this.dom.eventsContainer.appendChild(groupElement);
    }

    setupEventInteractions(eventElement, event) {
        let isDragging = false;
        let isResizing = false;
        let resizeDirection = '';
        let startY = 0;
        let originalTop = 0;
        let originalHeight = 0;

        const startDrag = (e, type) => {
            e.preventDefault();
            e.stopPropagation();
            
            isDragging = type === 'drag';
            isResizing = type === 'resize';
            resizeDirection = e.target.classList.contains('top') ? 'top' : 'bottom';
            
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            originalTop = parseFloat(eventElement.style.top);
            originalHeight = parseFloat(eventElement.style.height);
            
            if (isDragging) {
                eventElement.classList.add('dragging');
            } else if (isResizing) {
                eventElement.classList.add('resizing');
            }
            
            document.addEventListener('mousemove', doDrag);
            document.addEventListener('touchmove', doDrag, { passive: false });
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('touchend', stopDrag);
        };

        const doDrag = (e) => {
            if (!isDragging && !isResizing) return;
            
            e.preventDefault();
            const currentY = e.touches ? e.touches[0].clientY : e.clientY;
            const deltaY = currentY - startY;
            
            if (isDragging) {
                const newTop = originalTop + deltaY;
                const snappedTop = Math.round(newTop / 15) * 15;
                eventElement.style.top = `${snappedTop}px`;
                
                // Update event time
                const newStartMinutes = (snappedTop / 60) * 60;
                const duration = originalHeight;
                const newEndMinutes = newStartMinutes + duration;
                
                event.start = this.minutesToTime(newStartMinutes);
                event.end = this.minutesToTime(newEndMinutes);
            } else if (isResizing) {
                if (resizeDirection === 'top') {
                    const newTop = originalTop + deltaY;
                    const snappedTop = Math.round(newTop / 15) * 15;
                    const newHeight = originalHeight - (snappedTop - originalTop);
                    
                    if (newHeight >= 30) { // Minimum 30 minutes
                        eventElement.style.top = `${snappedTop}px`;
                        eventElement.style.height = `${newHeight}px`;
                        
                        const newStartMinutes = (snappedTop / 60) * 60;
                        event.start = this.minutesToTime(newStartMinutes);
                    }
                } else {
                    const newHeight = originalHeight + deltaY;
                    const snappedHeight = Math.round(newHeight / 15) * 15;
                    
                    if (snappedHeight >= 30) {
                        eventElement.style.height = `${snappedHeight}px`;
                        
                        const newEndMinutes = (originalTop / 60) * 60 + snappedHeight;
                        event.end = this.minutesToTime(newEndMinutes);
                    }
                }
            }
        };

        const stopDrag = () => {
            if (isDragging || isResizing) {
                this.events.set(event.id, event);
                this.saveEvents();
                
                if (isDragging) {
                    eventElement.classList.remove('dragging');
                } else if (isResizing) {
                    eventElement.classList.remove('resizing');
                }
            }
            
            isDragging = false;
            isResizing = false;
            
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('touchmove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchend', stopDrag);
        };

        // Drag event
        eventElement.addEventListener('mousedown', (e) => {
            if (!e.target.classList.contains('resize-handle')) {
                startDrag(e, 'drag');
            }
        });

        eventElement.addEventListener('touchstart', (e) => {
            if (!e.target.classList.contains('resize-handle')) {
                startDrag(e, 'drag');
            }
        }, { passive: false });

        // Resize handles
        const resizeHandles = eventElement.querySelectorAll('.resize-handle');
        resizeHandles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => startDrag(e, 'resize'));
            handle.addEventListener('touchstart', (e) => startDrag(e, 'resize'), { passive: false });
        });
    }

    updateCurrentTime() {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const topPosition = (currentMinutes / 60) * 60;
        
        this.dom.currentTimeLine.style.top = `${topPosition}px`;
        this.dom.currentTimeLine.style.display = 'block';
        
        // Auto-scroll to current time
        if (now.toDateString() === this.currentDate.toDateString()) {
            const scrollPosition = Math.max(0, topPosition - 200);
            this.dom.eventsColumn.scrollTop = scrollPosition;
        }
    }

    goToToday() {
        this.currentDate = new Date();
        this.render();
        this.showSnackbar('Переход на сегодня');
    }

    nextDay() {
        this.currentDate.setDate(this.currentDate.getDate() + 1);
        this.render();
    }

    previousDay() {
        this.currentDate.setDate(this.currentDate.getDate() - 1);
        this.render();
    }

    handleKeyboardShortcuts(e) {
        if (e.key === 'Escape' && this.sheetState !== 'closed') {
            this.closeSheet();
        } else if (e.key === '+' || e.key === '=') {
            this.openNewEventSheet();
        } else if (e.key === 'ArrowRight' && e.ctrlKey) {
            this.nextDay();
        } else if (e.key === 'ArrowLeft' && e.ctrlKey) {
            this.previousDay();
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
        return date.toISOString().split('T')[0];
    }

    formatTime(date) {
        return date.toTimeString().slice(0, 5);
    }

    timeToMinutes(date) {
        return date.getHours() * 60 + date.getMinutes();
    }

    minutesToTime(minutes) {
        const date = new Date(this.currentDate);
        date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        return date.getTime();
    }

    pixelsToTime(pixels) {
        const minutes = Math.round(pixels / 60 * 60);
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
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
