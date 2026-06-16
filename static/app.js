// Main application logic
document.addEventListener('DOMContentLoaded', () => {
    // State variables
    let releaseNotes = [];
    let activeFilter = 'all';
    let searchQuery = '';
    let selectedUpdate = null;

    // Elements
    const elements = {
        refreshBtn: document.getElementById('refresh-btn'),
        refreshIcon: document.getElementById('refresh-icon'),
        syncStatus: document.getElementById('sync-status'),
        statusPulse: document.querySelector('.pulse-dot'),
        searchInput: document.getElementById('search-input'),
        clearSearch: document.getElementById('clear-search'),
        filterTabs: document.getElementById('filter-tabs'),
        loadingState: document.getElementById('loading-state'),
        errorState: document.getElementById('error-state'),
        errorMessage: document.getElementById('error-message'),
        retryBtn: document.getElementById('retry-btn'),
        emptyState: document.getElementById('empty-state'),
        resetFiltersBtn: document.getElementById('reset-filters-btn'),
        notesGrid: document.getElementById('notes-grid'),
        
        // Count Badges
        countAll: document.getElementById('count-all'),
        countFeature: document.getElementById('count-feature'),
        countIssue: document.getElementById('count-issue'),
        countDeprecation: document.getElementById('count-deprecation'),
        countOther: document.getElementById('count-other'),
        
        // Tweet Modal Elements
        tweetModal: document.getElementById('tweet-modal'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        cancelTweetBtn: document.getElementById('cancel-tweet-btn'),
        shareTweetBtn: document.getElementById('share-tweet-btn'),
        tweetTemplate: document.getElementById('tweet-template'),
        tweetTextarea: document.getElementById('tweet-textarea'),
        charCount: document.getElementById('char-count'),
        progressCircle: document.getElementById('progress-circle'),
        previewTitle: document.getElementById('preview-title'),
        previewDesc: document.getElementById('preview-desc'),

        // Theme Switch
        themeCheckbox: document.getElementById('theme-checkbox'),
        moonIcon: document.querySelector('.icon-theme-moon'),
        sunIcon: document.querySelector('.icon-theme-sun'),

        // Export CSV
        exportCsvBtn: document.getElementById('export-csv-btn')
    };

    // Constant for progress ring circumference (2 * pi * r) where r = 10
    const CIRCUMFERENCE = 2 * Math.PI * 10;
    elements.progressCircle.style.strokeDasharray = CIRCUMFERENCE;

    // Initial load
    initTheme();
    fetchReleaseNotes();

    // Event Listeners
    elements.refreshBtn.addEventListener('click', () => refreshReleaseNotes());
    elements.retryBtn.addEventListener('click', () => fetchReleaseNotes());
    elements.resetFiltersBtn.addEventListener('click', resetFilters);
    elements.themeCheckbox.addEventListener('change', toggleTheme);
    elements.exportCsvBtn.addEventListener('click', exportToCSV);
    
    // Search input
    elements.searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        elements.clearSearch.style.display = searchQuery.length > 0 ? 'block' : 'none';
        renderFeed();
    });

    elements.clearSearch.addEventListener('click', () => {
        elements.searchInput.value = '';
        searchQuery = '';
        elements.clearSearch.style.display = 'none';
        elements.searchInput.focus();
        renderFeed();
    });

    // Filter Tabs
    elements.filterTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.filter-tab');
        if (!tab) return;
        
        // Deactivate current active tab
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        
        // Activate new tab
        tab.classList.add('active');
        activeFilter = tab.getAttribute('data-filter');
        
        renderFeed();
    });

    // Tweet Modal Events
    elements.closeModalBtn.addEventListener('click', closeTweetModal);
    elements.cancelTweetBtn.addEventListener('click', closeTweetModal);
    elements.tweetTemplate.addEventListener('change', updateTweetFromTemplate);
    elements.tweetTextarea.addEventListener('input', handleTweetTextareaInput);
    elements.shareTweetBtn.addEventListener('click', postToTwitter);

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.tweetModal.style.display !== 'none') {
            closeTweetModal();
        }
    });

    // Close modal if clicking overlay
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) {
            closeTweetModal();
        }
    });

    // Functions

    /**
     * Fetches release notes from the backend API.
     */
    async function fetchReleaseNotes() {
        showState('loading');
        setSyncStatus('syncing', 'Syncing...');
        
        try {
            const response = await fetch('/api/release-notes');
            const result = await response.json();
            
            if (result.success) {
                releaseNotes = result.data;
                updateCounts();
                renderFeed();
                
                const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isCached = result.status === 'cached';
                setSyncStatus(
                    isCached ? 'idle' : 'success', 
                    isCached ? `Cached (Last checked ${timeStr})` : `Updated ${timeStr}`
                );
            } else {
                throw new Error(result.error || 'Server returned an error');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            elements.errorMessage.textContent = `Could not fetch release notes: ${error.message}`;
            showState('error');
            setSyncStatus('error', 'Sync Failed');
        }
    }

    /**
     * Forces a refresh of release notes from the live Google Cloud Feed.
     */
    async function refreshReleaseNotes() {
        if (elements.refreshIcon.classList.contains('spin')) return; // Already refreshing
        
        elements.refreshIcon.classList.add('spin');
        elements.refreshBtn.disabled = true;
        setSyncStatus('syncing', 'Fetching latest notes...');
        
        try {
            const response = await fetch('/api/release-notes/refresh', { method: 'POST' });
            const result = await response.json();
            
            if (result.success) {
                releaseNotes = result.data;
                updateCounts();
                renderFeed();
                
                const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                setSyncStatus('success', `Synced ${timeStr}`);
            } else {
                throw new Error(result.error || 'Server failed to refresh');
            }
        } catch (error) {
            console.error('Refresh error:', error);
            alert(`Refresh failed: ${error.message}. Showing cached version.`);
        } finally {
            elements.refreshIcon.classList.remove('spin');
            elements.refreshBtn.disabled = false;
        }
    }

    /**
     * Sets sync status message and state.
     */
    function setSyncStatus(state, message) {
        elements.syncStatus.textContent = message;
        
        // Update pulse dot class
        elements.statusPulse.className = 'pulse-dot';
        if (state === 'syncing') {
            elements.statusPulse.classList.add('syncing');
            elements.statusPulse.style.backgroundColor = '#fbbf24';
            elements.statusPulse.style.boxShadow = '0 0 8px #fbbf24';
        } else if (state === 'error') {
            elements.statusPulse.style.backgroundColor = '#ef4444';
            elements.statusPulse.style.boxShadow = '0 0 8px #ef4444';
        } else if (state === 'success') {
            elements.statusPulse.style.backgroundColor = '#34d399';
            elements.statusPulse.style.boxShadow = '0 0 8px #34d399';
        } else {
            elements.statusPulse.style.backgroundColor = '#6b7280';
            elements.statusPulse.style.boxShadow = 'none';
        }
    }

    /**
     * Changes display state of main layout panels.
     */
    function showState(state) {
        elements.loadingState.style.display = state === 'loading' ? 'flex' : 'none';
        elements.errorState.style.display = state === 'error' ? 'flex' : 'none';
        elements.emptyState.style.display = state === 'empty' ? 'flex' : 'none';
        elements.notesGrid.style.display = state === 'grid' ? 'grid' : 'none';
    }

    /**
     * Updates count badges inside filter tabs.
     */
    function updateCounts() {
        const counts = {
            all: releaseNotes.length,
            feature: 0,
            issue: 0,
            deprecation: 0,
            other: 0
        };
        
        releaseNotes.forEach(item => {
            const type = item.type.toLowerCase();
            if (type.includes('feature')) {
                counts.feature++;
            } else if (type.includes('issue') || type.includes('bug')) {
                counts.issue++;
            } else if (type.includes('deprecation') || type.includes('remove') || type.includes('disable')) {
                counts.deprecation++;
            } else {
                counts.other++;
            }
        });

        elements.countAll.textContent = counts.all;
        elements.countFeature.textContent = counts.feature;
        elements.countIssue.textContent = counts.issue;
        elements.countDeprecation.textContent = counts.deprecation;
        elements.countOther.textContent = counts.other;
    }

    /**
     * Resets active filter and search text.
     */
    function resetFilters() {
        elements.searchInput.value = '';
        searchQuery = '';
        elements.clearSearch.style.display = 'none';
        
        // Reset filter tabs
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        elements.filterTabs.querySelector('[data-filter="all"]').classList.add('active');
        activeFilter = 'all';
        
        renderFeed();
    }

    /**
     * Filter release notes according to search text and active tab.
     */
    function getFilteredNotes() {
        return releaseNotes.filter(item => {
            // 1. Filter by tab
            const itemType = item.type.toLowerCase();
            let matchesFilter = true;
            
            if (activeFilter === 'feature') {
                matchesFilter = itemType.includes('feature');
            } else if (activeFilter === 'issue') {
                matchesFilter = itemType.includes('issue') || itemType.includes('bug');
            } else if (activeFilter === 'deprecation') {
                matchesFilter = itemType.includes('deprecation') || itemType.includes('remove') || itemType.includes('disable');
            } else if (activeFilter === 'other') {
                // Not feature, issue, or deprecation
                matchesFilter = !itemType.includes('feature') && 
                                !itemType.includes('issue') && !itemType.includes('bug') && 
                                !itemType.includes('deprecation') && !itemType.includes('remove') && !itemType.includes('disable');
            }
            
            if (!matchesFilter) return false;
            
            // 2. Filter by search text
            if (searchQuery) {
                const searchContent = `${item.date} ${item.type} ${item.text_content}`.toLowerCase();
                return searchContent.includes(searchQuery);
            }
            
            return true;
        });
    }

    /**
     * Renders filtered release notes onto the grid.
     */
    function renderFeed() {
        const filtered = getFilteredNotes();
        elements.notesGrid.innerHTML = '';
        
        if (filtered.length === 0) {
            showState('empty');
            return;
        }
        
        filtered.forEach(item => {
            const card = document.createElement('article');
            
            // Map types to card classes for unique styles
            const lowerType = item.type.toLowerCase();
            let cardClass = 'card-other';
            let badgeClass = 'badge-other';
            
            if (lowerType.includes('feature')) {
                cardClass = 'card-feature';
                badgeClass = 'badge-feature';
            } else if (lowerType.includes('issue') || lowerType.includes('bug')) {
                cardClass = 'card-issue';
                badgeClass = 'badge-issue';
            } else if (lowerType.includes('deprecation') || lowerType.includes('remove') || lowerType.includes('disable')) {
                cardClass = 'card-deprecation';
                badgeClass = 'badge-deprecation';
            }
            
            card.className = `note-card ${cardClass}`;
            
            card.innerHTML = `
                <div class="card-header">
                    <span class="date-badge">
                        <i class="fa-regular fa-calendar"></i> ${item.date}
                    </span>
                    <span class="type-badge ${badgeClass}">${item.type}</span>
                </div>
                <div class="card-body">
                    ${item.content}
                </div>
                <div class="card-footer">
                    ${item.link ? `
                        <a href="${item.link}" target="_blank" rel="noopener" class="source-link">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Docs Link
                        </a>
                    ` : '<span></span>'}
                    <div class="card-actions">
                        <button class="action-btn-copy" data-id="${item.id}">
                            <i class="fa-regular fa-copy"></i> Copy
                        </button>
                        <button class="action-btn-share" data-id="${item.id}">
                            <i class="fa-brands fa-x-twitter"></i> Select & Tweet
                        </button>
                    </div>
                </div>
            `;
            
            // Event listener for copy button
            const copyBtn = card.querySelector('.action-btn-copy');
            copyBtn.addEventListener('click', () => copyToClipboard(item, copyBtn));

            // Event listener for tweet sharing
            const shareBtn = card.querySelector('.action-btn-share');
            shareBtn.addEventListener('click', () => openTweetModal(item));
            
            elements.notesGrid.appendChild(card);
        });
        
        showState('grid');
    }

    /**
     * Opens the tweet composer modal for the selected update.
     */
    function openTweetModal(item) {
        selectedUpdate = item;
        elements.tweetTemplate.value = 'default';
        
        // Link preview card update
        elements.previewTitle.textContent = `BigQuery Updates: ${item.date}`;
        
        // Clean description from tags and shorten
        const cleanText = item.text_content.replace(/\s+/g, ' ');
        const truncatedDesc = cleanText.length > 120 ? cleanText.substring(0, 117) + '...' : cleanText;
        elements.previewDesc.textContent = truncatedDesc;
        
        // Generate initial tweet from default template
        updateTweetFromTemplate();
        
        // Reveal Modal
        elements.tweetModal.style.display = 'flex';
        elements.tweetTextarea.focus();
    }

    /**
     * Closes the tweet composer modal.
     */
    function closeTweetModal() {
        elements.tweetModal.style.display = 'none';
        selectedUpdate = null;
    }

    /**
     * Generates tweet text based on chosen template style and selected item.
     */
    function updateTweetFromTemplate() {
        if (!selectedUpdate) return;
        
        const templateStyle = elements.tweetTemplate.value;
        const date = selectedUpdate.date;
        const type = selectedUpdate.type.toUpperCase();
        
        // Extract plain text and clean up whitespace
        let cleanText = selectedUpdate.text_content.replace(/\s+/g, ' ').trim();
        
        // Trim double/multiple spaces and periods at start/end
        if (cleanText.endsWith('.')) {
            cleanText = cleanText.substring(0, cleanText.length - 1);
        }
        
        let tweetBody = '';
        
        // Generate body based on templates
        switch (templateStyle) {
            case 'hype':
                tweetBody = `🚀 New BigQuery update is here! (${date})\n\n[${type}]: ${cleanText}.\n\nCheck out details:`;
                break;
            case 'brief':
                tweetBody = `BigQuery Update [${type}] (${date}): ${cleanText}. Details:`;
                break;
            case 'insight':
                tweetBody = `💡 Cloud Tip: BigQuery just added a new ${type.toLowerCase()} update (${date}).\n\n"${cleanText}"\n\nRead more details here:`;
                break;
            case 'default':
            default:
                tweetBody = `Google Cloud BigQuery Update (${date})\n\n[${type}] ${cleanText}.\n\nDetails in the release notes:`;
                break;
        }
        
        // Twitter Intent links handles url separately, so we don't append it to text in the textarea,
        // but we can show it visually or represent it.
        elements.tweetTextarea.value = tweetBody;
        handleTweetTextareaInput();
    }

    /**
     * Handles textarea input, updates characters count and progress indicator ring.
     */
    function handleTweetTextareaInput() {
        const text = elements.tweetTextarea.value;
        const textLength = text.length;
        
        elements.charCount.textContent = textLength;
        
        if (textLength > 280) {
            elements.charCount.classList.add('warning');
            elements.shareTweetBtn.disabled = true;
        } else {
            elements.charCount.classList.remove('warning');
            elements.shareTweetBtn.disabled = false;
        }
        
        // Update circular progress bar
        const percent = Math.min((textLength / 280) * 100, 100);
        const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
        elements.progressCircle.style.strokeDashoffset = offset;
        
        // Color transition for circular progress
        if (textLength >= 280) {
            elements.progressCircle.style.stroke = '#ff5a5a'; // Red
        } else if (textLength >= 250) {
            elements.progressCircle.style.stroke = '#fbbc05'; // Amber
        } else {
            elements.progressCircle.style.stroke = '#1d9bf0'; // Twitter Blue
        }
    }

    /**
     * Opens Twitter Web Intent in a new tab with encoded parameters.
     */
    function postToTwitter() {
        if (!selectedUpdate) return;
        
        const tweetText = elements.tweetTextarea.value;
        const tweetUrl = selectedUpdate.link || 'https://cloud.google.com/bigquery/docs/release-notes';
        
        const encodedText = encodeURIComponent(tweetText);
        const encodedUrl = encodeURIComponent(tweetUrl);
        
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        
        window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
        closeTweetModal();
    }

    /**
     * Initializes theme from localStorage preference.
     */
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'light') {
            document.body.classList.add('light-mode');
            elements.themeCheckbox.checked = true;
            elements.sunIcon.classList.add('active');
            elements.moonIcon.classList.remove('active');
        } else {
            document.body.classList.remove('light-mode');
            elements.themeCheckbox.checked = false;
            elements.moonIcon.classList.add('active');
            elements.sunIcon.classList.remove('active');
        }
    }

    /**
     * Toggles theme and saves preference in localStorage.
     */
    function toggleTheme() {
        if (elements.themeCheckbox.checked) {
            document.body.classList.add('light-mode');
            localStorage.setItem('theme', 'light');
            elements.sunIcon.classList.add('active');
            elements.moonIcon.classList.remove('active');
        } else {
            document.body.classList.remove('light-mode');
            localStorage.setItem('theme', 'dark');
            elements.moonIcon.classList.add('active');
            elements.sunIcon.classList.remove('active');
        }
    }

    /**
     * Copies plain text of a release update to user clipboard.
     */
    async function copyToClipboard(item, btn) {
        const textToCopy = `Google Cloud BigQuery Update (${item.date})\n[${item.type.toUpperCase()}]\n\n${item.text_content}\n\nRead more: ${item.link || 'https://cloud.google.com/bigquery/docs/release-notes'}`;
        
        try {
            await navigator.clipboard.writeText(textToCopy);
            
            // Visual feedback
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `<i class="fa-solid fa-check" style="color: #34d399;"></i> Copied!`;
            btn.classList.add('copied');
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.classList.remove('copied');
            }, 1500);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy to clipboard.');
        }
    }

    /**
     * Exports the currently filtered release notes to a CSV file.
     */
    function exportToCSV() {
        const filtered = getFilteredNotes();
        if (filtered.length === 0) {
            alert('No release notes to export.');
            return;
        }

        // CSV headers
        const headers = ['Date', 'Type', 'Link', 'Content'];
        
        // Convert rows to CSV strings
        const csvRows = [
            headers.join(',') // Add header row
        ];
        
        filtered.forEach(item => {
            const row = [
                escapeCSVField(item.date),
                escapeCSVField(item.type),
                escapeCSVField(item.link || ''),
                escapeCSVField(item.text_content)
            ];
            csvRows.push(row.join(','));
        });
        
        // Create a blob and download it
        const csvContent = "\uFEFF" + csvRows.join('\r\n'); // Add UTF-8 BOM for Excel formatting
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            
            // Format filename with current date or filter type
            const dateStr = new Date().toISOString().slice(0, 10);
            const filterStr = activeFilter !== 'all' ? `_${activeFilter}` : '';
            link.setAttribute('download', `bigquery_release_notes_${dateStr}${filterStr}.csv`);
            
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    /**
     * Escapes fields for CSV format. Wraps in quotes and escapes internal double-quotes.
     */
    function escapeCSVField(val) {
        if (val === null || val === undefined) return '""';
        let str = String(val).trim();
        // Replace internal double quotes with two double quotes
        str = str.replace(/"/g, '""');
        // Wrap in double quotes if it contains comma, double quote, newline, or carriage return
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            str = `"${str}"`;
        }
        return str;
    }
});
