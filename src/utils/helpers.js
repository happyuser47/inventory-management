export const formatDisplayDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = date.getDate();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${day} ${month} ${year}, ${time}`;
};

export const getCustomWeekStart = (date, startDay) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day >= startDay ? day - startDay : 7 - (startDay - day);
    d.setDate(d.getDate() - diff);
    return d;
};

export const getCustomMonthStart = (date, startDateNum) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    if (d.getDate() >= startDateNum) {
        d.setDate(startDateNum);
    } else {
        d.setMonth(d.getMonth() - 1);
        d.setDate(startDateNum);
    }
    return d;
};

export const escapeCSV = (str) => `"${String(str).replace(/"/g, '""')}"`;

export const triggerDownload = (content, filename) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const parseCSVRow = (str) => {
    const result = [];
    let inQuotes = false;
    let current = '';
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '"' && str[i + 1] === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result.map(s => s.trim());
};
