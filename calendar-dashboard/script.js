// Meeting data structure
let meetingsData = [];

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Set default week to current week
    const today = new Date();
    const weekInput = document.getElementById('week-select');
    const weekString = getWeekString(today);
    weekInput.value = weekString;
    
    // Generate sample JSON with dates from current week
    const sampleJson = generateSampleJsonForCurrentWeek();
    document.getElementById('json-input').value = JSON.stringify(sampleJson, null, 2);
    
    // Auto-load the sample data
    loadJsonFromTextarea();
    
    // Event listeners
    document.getElementById('week-select').addEventListener('change', updateDashboard);
    document.getElementById('load-json-btn').addEventListener('click', loadJsonFromTextarea);
    document.getElementById('json-file-input').addEventListener('change', handleFileUpload);
    document.getElementById('clear-data-btn').addEventListener('click', clearData);
});

// Get ISO week string (YYYY-Www) from date
function getWeekString(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
    d.setDate(diff);
    
    // Get the week number
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = Math.ceil((((d - week1) / 86400000) + week1.getDay() + 1) / 7);
    
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// Get start and end of week from week input (ISO week format: YYYY-Www)
function getWeekRange(weekValue) {
    if (!weekValue) return { start: null, end: null };
    
    const parts = weekValue.split('-W');
    if (parts.length !== 2) return { start: null, end: null };
    
    const year = parseInt(parts[0]);
    const week = parseInt(parts[1]);
    
    // Calculate the date of the Monday of the ISO week
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = new Date(simple);
    
    // Adjust to Monday (ISO week starts on Monday)
    if (dow <= 4) {
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    
    const start = new Date(ISOweekStart);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
}

// Generate sample JSON with dates from current week
function generateSampleJsonForCurrentWeek() {
    const today = new Date();
    const weekString = getWeekString(today);
    const { start } = getWeekRange(weekString);
    
    // Generate dates for Monday, Tuesday, Wednesday, Thursday of current week
    const monday = new Date(start);
    const tuesday = new Date(start);
    tuesday.setDate(start.getDate() + 1);
    const wednesday = new Date(start);
    wednesday.setDate(start.getDate() + 2);
    const thursday = new Date(start);
    thursday.setDate(start.getDate() + 3);
    
    // Format date as YYYY-MM-DD
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    return [
        {
            "employeeId": "EMP001",
            "date": formatDate(monday),
            "duration": 30,
            "hasActionItems": true,
            "timeDifference": 5,
            "efficiency": 85
        },
        {
            "employeeId": "EMP001",
            "date": formatDate(tuesday),
            "duration": 45,
            "hasActionItems": false,
            "timeDifference": -10,
            "efficiency": 70
        },
        {
            "employeeId": "EMP002",
            "date": formatDate(monday),
            "duration": 60,
            "hasActionItems": true,
            "timeDifference": 15,
            "efficiency": 90
        },
        {
            "employeeId": "EMP002",
            "date": formatDate(wednesday),
            "duration": 30,
            "hasActionItems": true,
            "timeDifference": -5,
            "efficiency": 95
        },
        {
            "employeeId": "EMP003",
            "date": formatDate(tuesday),
            "duration": 90,
            "hasActionItems": false,
            "timeDifference": 0,
            "efficiency": 60
        },
        {
            "employeeId": "EMP003",
            "date": formatDate(thursday),
            "duration": 20,
            "hasActionItems": true,
            "timeDifference": -8,
            "efficiency": 80
        }
    ];
}

// Filter meetings for selected week
function getWeekMeetings() {
    const weekValue = document.getElementById('week-select').value;
    const { start, end } = getWeekRange(weekValue);
    
    if (!start || !end) return [];
    
    return meetingsData.filter(meeting => {
        // Parse date string as local date (YYYY-MM-DD format)
        const [year, month, day] = meeting.date.split('-').map(Number);
        const meetingDate = new Date(year, month - 1, day);
        meetingDate.setHours(0, 0, 0, 0);
        
        return meetingDate >= start && meetingDate <= end;
    });
}

// Calculate metrics
function calculateMetrics(weekMeetings) {
    const totalMeetings = weekMeetings.length;
    const totalMinutes = weekMeetings.reduce((sum, m) => sum + m.duration, 0);
    const meetingsWithActions = weekMeetings.filter(m => m.hasActionItems).length;
    
    // Calculate average efficiency from JSON data
    // Efficiency comes from each meeting object in JSON
    let totalEfficiency = 0;
    let efficiencyCount = 0;
    
    weekMeetings.forEach(meeting => {
        if (meeting.efficiency !== undefined && meeting.efficiency !== null && typeof meeting.efficiency === 'number') {
            totalEfficiency += meeting.efficiency;
            efficiencyCount++;
        }
    });
    
    const efficiency = efficiencyCount > 0 
        ? Math.round(totalEfficiency / efficiencyCount) 
        : 0;
    
    // Calculate overshot and undershot minutes
    // timeDifference > 0 means overshot, < 0 means undershot
    let overshotMinutes = 0;
    let undershotMinutes = 0;
    
    weekMeetings.forEach(meeting => {
        if (meeting.timeDifference !== undefined && meeting.timeDifference !== null) {
            if (meeting.timeDifference > 0) {
                overshotMinutes += meeting.timeDifference;
            } else if (meeting.timeDifference < 0) {
                undershotMinutes += Math.abs(meeting.timeDifference);
            }
        }
    });
    
    return {
        totalMeetings,
        totalMinutes,
        meetingsWithActions,
        efficiency,
        overshotMinutes,
        undershotMinutes
    };
}

// Calculate employee breakdown
function calculateEmployeeBreakdown(weekMeetings) {
    const employeeMap = {};
    
    weekMeetings.forEach(meeting => {
        const empId = meeting.employeeId;
        
        if (!employeeMap[empId]) {
            employeeMap[empId] = {
                employeeId: empId,
                totalMeetings: 0,
                totalMinutes: 0,
                meetingsWithActions: 0,
                overshotMinutes: 0,
                undershotMinutes: 0,
                totalEfficiency: 0,
                efficiencyCount: 0
            };
        }
        
        employeeMap[empId].totalMeetings++;
        employeeMap[empId].totalMinutes += meeting.duration;
        if (meeting.hasActionItems) {
            employeeMap[empId].meetingsWithActions++;
        }
        
        // Calculate overshot/undershot for this employee
        if (meeting.timeDifference !== undefined && meeting.timeDifference !== null) {
            if (meeting.timeDifference > 0) {
                employeeMap[empId].overshotMinutes += meeting.timeDifference;
            } else if (meeting.timeDifference < 0) {
                employeeMap[empId].undershotMinutes += Math.abs(meeting.timeDifference);
            }
        }
        
        // Accumulate efficiency from JSON
        if (meeting.efficiency !== undefined && meeting.efficiency !== null && typeof meeting.efficiency === 'number') {
            employeeMap[empId].totalEfficiency += meeting.efficiency;
            employeeMap[empId].efficiencyCount++;
        }
    });
    
    // Calculate average efficiency for each employee from JSON data
    Object.values(employeeMap).forEach(emp => {
        emp.efficiency = emp.efficiencyCount > 0 
            ? Math.round(emp.totalEfficiency / emp.efficiencyCount) 
            : 0;
    });
    
    return Object.values(employeeMap).sort((a, b) => 
        a.employeeId.localeCompare(b.employeeId)
    );
}

// Update dashboard display
function updateDashboard() {
    const weekMeetings = getWeekMeetings();
    const metrics = calculateMetrics(weekMeetings);
    const employeeBreakdown = calculateEmployeeBreakdown(weekMeetings);
    
    // Update summary cards
    document.getElementById('total-meetings').textContent = metrics.totalMeetings;
    document.getElementById('total-minutes').textContent = metrics.totalMinutes;
    document.getElementById('meetings-with-actions').textContent = metrics.meetingsWithActions;
    document.getElementById('efficiency-percentage').textContent = `${metrics.efficiency}%`;
    document.getElementById('overshot-minutes').textContent = metrics.overshotMinutes;
    document.getElementById('undershot-minutes').textContent = metrics.undershotMinutes;
    
    // Update employee table
    const tableBody = document.getElementById('employee-table-body');
    tableBody.innerHTML = '';
    
    if (employeeBreakdown.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="empty-state">No meeting data for this week</td></tr>';
    } else {
        employeeBreakdown.forEach(emp => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${emp.employeeId}</td>
                <td>${emp.totalMeetings}</td>
                <td>${emp.totalMinutes}</td>
                <td>${emp.meetingsWithActions}</td>
                <td>${emp.efficiency}%</td>
                <td>${emp.overshotMinutes}</td>
                <td>${emp.undershotMinutes}</td>
            `;
            tableBody.appendChild(row);
        });
    }
}

// Load JSON data from textarea
function loadJsonFromTextarea() {
    const jsonInput = document.getElementById('json-input').value.trim();
    const errorDiv = document.getElementById('json-error');
    const successDiv = document.getElementById('json-success');
    
    // Hide previous messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    if (!jsonInput) {
        showError('Please enter JSON data');
        return;
    }
    
    try {
        const parsedData = JSON.parse(jsonInput);
        
        // Validate data structure
        if (!Array.isArray(parsedData)) {
            showError('JSON must be an array of meeting objects');
            return;
        }
        
        // Validate each meeting object
        const validationErrors = [];
        parsedData.forEach((meeting, index) => {
            if (!meeting.employeeId || typeof meeting.employeeId !== 'string') {
                validationErrors.push(`Meeting at index ${index}: missing or invalid employeeId`);
            }
            if (!meeting.date || typeof meeting.date !== 'string') {
                validationErrors.push(`Meeting at index ${index}: missing or invalid date`);
            }
            if (typeof meeting.duration !== 'number' || meeting.duration <= 0) {
                validationErrors.push(`Meeting at index ${index}: missing or invalid duration`);
            }
            if (typeof meeting.hasActionItems !== 'boolean') {
                validationErrors.push(`Meeting at index ${index}: missing or invalid hasActionItems`);
            }
            // timeDifference is optional, but if present must be a number
            if (meeting.timeDifference !== undefined && meeting.timeDifference !== null && typeof meeting.timeDifference !== 'number') {
                validationErrors.push(`Meeting at index ${index}: timeDifference must be a number`);
            }
            // efficiency is optional, but if present must be a number
            if (meeting.efficiency !== undefined && meeting.efficiency !== null && typeof meeting.efficiency !== 'number') {
                validationErrors.push(`Meeting at index ${index}: efficiency must be a number`);
            }
        });
        
        if (validationErrors.length > 0) {
            showError('Validation errors:\n' + validationErrors.join('\n'));
            return;
        }
        
        // Normalize date format (remove time if present)
        parsedData.forEach(meeting => {
            meeting.date = meeting.date.split('T')[0];
        });
        
        // Load the data
        meetingsData = parsedData;
        
        // Update dashboard
        updateDashboard();
        
        // Show success message
        showSuccess(`Successfully loaded ${meetingsData.length} meeting(s)`);
        
    } catch (error) {
        showError('Invalid JSON format: ' + error.message);
    }
}

// Handle file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const errorDiv = document.getElementById('json-error');
    const successDiv = document.getElementById('json-success');
    
    // Hide previous messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const jsonInput = document.getElementById('json-input');
            jsonInput.value = e.target.result;
            loadJsonFromTextarea();
        } catch (error) {
            showError('Error reading file: ' + error.message);
        }
    };
    
    reader.onerror = function() {
        showError('Error reading file');
    };
    
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

// Clear all data
function clearData() {
    if (confirm('Are you sure you want to clear all meeting data?')) {
        meetingsData = [];
        document.getElementById('json-input').value = '';
        document.getElementById('json-error').style.display = 'none';
        document.getElementById('json-success').style.display = 'none';
        updateDashboard();
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('json-error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    document.getElementById('json-success').style.display = 'none';
}

// Show success message
function showSuccess(message) {
    const successDiv = document.getElementById('json-success');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    document.getElementById('json-error').style.display = 'none';
}

