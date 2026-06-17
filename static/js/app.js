// ==========================================================================
// Application State
// ==========================================================================
let state = {
    updates: [],
    filteredUpdates: [],
    filters: {
        search: '',
        type: 'all'
    },
    activeTheme: 'dark',
    selectedUpdate: null
};

// SVG Progress Ring Constants
const RING_RADIUS = 9;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ~56.548

// ==========================================================================
// DOM Elements
// ==========================================================================
const feedContainer = document.getElementById('feedContainer');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const filterTagsContainer = document.getElementById('filterTagsContainer');
const statusSummary = document.getElementById('statusSummary');
const lastUpdatedTime = document.getElementById('lastUpdatedTime');
const sourceIndicator = document.getElementById('sourceIndicator');
const refreshBtn = document.getElementById('refreshBtn');
const spinnerIcon = document.getElementById('spinnerIcon');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const toastContainer = document.getElementById('toastContainer');

// Modal Elements
const tweetDialog = document.getElementById('tweetDialog');
const closeDialogBtn = document.getElementById('closeDialogBtn');
const tweetTextarea = document.getElementById('tweetTextarea');
const charCount = document.getElementById('charCount');
const progressRingBar = document.getElementById('progressRingBar');
const copyTweetBtn = document.getElementById('copyTweetBtn');
const submitTweetBtn = document.getElementById('submitTweetBtn');
const previewType = document.getElementById('previewType');
const previewDate = document.getElementById('previewDate');
const previewText = document.getElementById('previewText');

// ==========================================================================
// Initialization & Event Listeners
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchReleaseNotes(false);
    initProgressRing();

    // Event Listeners
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    themeToggleBtn.addEventListener('click', toggleTheme);
    
    // Search
    searchInput.addEventListener('input', handleSearchInput);
    clearSearchBtn.addEventListener('click', clearSearch);
    
    // Filters
    filterTagsContainer.addEventListener('click', handleFilterClick);
    
    // Modal
    closeDialogBtn.addEventListener('click', () => tweetDialog.close());
    tweetTextarea.addEventListener('input', handleTweetTextareaInput);
    copyTweetBtn.addEventListener('click', copyTweetToClipboard);
    submitTweetBtn.addEventListener('click', submitTweetToTwitter);
    
    // Close modal if clicking backdrop (light dismiss as per guidelines)
    tweetDialog.addEventListener('click', (e) => {
        const rect = tweetDialog.getBoundingClientRect();
        const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
          rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
        if (!isInDialog) {
            tweetDialog.close();
        }
    });
});

// ==========================================================================
// Theme Management
// ==========================================================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

function setTheme(theme) {
    state.activeTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    const icon = themeToggleBtn.querySelector('i');
    if (theme === 'dark') {
        icon.className = 'fa-solid fa-sun';
    } else {
        icon.className = 'fa-solid fa-moon';
    }
}

function toggleTheme() {
    const nextTheme = state.activeTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    showToast(`Switched to ${nextTheme} theme`, 'success');
}

// ==========================================================================
// API Fetching & Rendering
// ==========================================================================
async function fetchReleaseNotes(forceRefresh = false) {
    setLoadingState(true);
    
    try {
        const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        state.updates = data.updates || [];
        lastUpdatedTime.textContent = data.last_updated || 'Just now';
        
        // Update Cache/Network Badge
        updateSourceBadge(data.source);
        
        // Apply current filters
        applyFilters();
        updateFilterCounts();
        
        if (forceRefresh) {
            showToast('Feed refreshed successfully!', 'success');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showToast(`Failed to load release notes: ${error.message}`, 'error');
        
        // Clear skeleton if error
        feedContainer.innerHTML = `
            <div class="release-card" style="align-items: center; justify-content: center; padding: 3rem; text-align: center;">
                <i class="fa-solid fa-circle-exclamation" style="font-size: 3rem; color: var(--accent-red); margin-bottom: 1rem;"></i>
                <h2>Failed to Load Feed</h2>
                <p style="color: var(--text-muted); max-width: 450px; margin: 0.5rem auto;">
                    We couldn't retrieve the BigQuery release notes. Please check your internet connection or try again.
                </p>
                <button class="btn btn-secondary" style="margin-top: 1rem;" onclick="fetchReleaseNotes(true)">
                    <i class="fa-solid fa-arrows-rotate"></i> Retry Fetch
                </button>
            </div>
        `;
        statusSummary.textContent = "Error loading updates.";
    } finally {
        setLoadingState(false);
    }
}

function setLoadingState(isLoading) {
    if (isLoading) {
        refreshBtn.disabled = true;
        spinnerIcon.classList.add('spinning');
        // Render skeletons
        feedContainer.innerHTML = `
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        `;
        statusSummary.textContent = "Loading updates...";
    } else {
        refreshBtn.disabled = false;
        spinnerIcon.classList.remove('spinning');
    }
}

function updateSourceBadge(source) {
    sourceIndicator.innerHTML = '';
    const span = document.createElement('span');
    span.className = 'badge';
    
    if (source === 'network') {
        span.classList.add('badge-network');
        span.textContent = 'Live Feed';
    } else if (source === 'cache') {
        span.classList.add('badge-cache');
        span.textContent = 'Cached';
    } else {
        span.classList.add('badge-cache');
        span.textContent = 'Offline Fallback';
    }
    
    sourceIndicator.appendChild(span);
}

function renderUpdates() {
    feedContainer.innerHTML = '';
    
    if (state.filteredUpdates.length === 0) {
        feedContainer.innerHTML = `
            <div class="release-card" style="align-items: center; justify-content: center; padding: 4rem; text-align: center;">
                <i class="fa-regular fa-folder-open" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                <h2>No Updates Found</h2>
                <p style="color: var(--text-muted); margin-top: 0.5rem;">Try adjusting your keywords or clearing the filter.</p>
            </div>
        `;
        return;
    }
    
    // Standard stagger animation using index for staggered delay
    state.filteredUpdates.forEach((update, idx) => {
        const card = document.createElement('article');
        
        // Categorize css class based on update type
        const typeClass = `type-${update.type.toLowerCase().replace(/\s+/g, '-')}`;
        card.className = `release-card ${typeClass}`;
        
        // Delay animation to stagger them nicely
        card.style.animationDelay = `${Math.min(idx * 50, 400)}ms`;
        
        card.innerHTML = `
            <header class="card-header">
                <div class="card-title-group">
                    <span class="type-tag">${update.type}</span>
                    <span class="card-date">${update.date}</span>
                </div>
            </header>
            <main class="card-content">
                ${update.content}
            </main>
            <footer class="card-actions">
                <a href="${update.link}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-card" title="View official Google documentation">
                    <i class="fa-solid fa-up-right-from-square"></i> Docs Link
                </a>
                <button class="btn btn-primary btn-card btn-tweet-trigger" title="Select and tweet this specific update">
                    <i class="fa-brands fa-x-twitter"></i> Tweet Update
                </button>
            </footer>
        `;
        
        // Add event listener to the Tweet button
        const tweetBtn = card.querySelector('.btn-tweet-trigger');
        tweetBtn.addEventListener('click', () => openTweetModal(update));
        
        feedContainer.appendChild(card);
    });
}

// ==========================================================================
// Filtering & Searching
// ==========================================================================
function handleSearchInput(e) {
    state.filters.search = e.target.value.toLowerCase();
    
    // Toggle clear search button visibility
    if (state.filters.search.length > 0) {
        clearSearchBtn.style.display = 'block';
    } else {
        clearSearchBtn.style.display = 'none';
    }
    
    applyFilters();
}

function clearSearch() {
    searchInput.value = '';
    state.filters.search = '';
    clearSearchBtn.style.display = 'none';
    applyFilters();
}

function handleFilterClick(e) {
    const filterTag = e.target.closest('.filter-tag');
    if (!filterTag) return;
    
    // Update active class
    filterTagsContainer.querySelectorAll('.filter-tag').forEach(tag => {
        tag.classList.remove('active');
    });
    filterTag.classList.add('active');
    
    state.filters.type = filterTag.dataset.type;
    applyFilters();
}

function applyFilters() {
    state.filteredUpdates = state.updates.filter(update => {
        // Search filter
        const matchesSearch = 
            update.plain_text.toLowerCase().includes(state.filters.search) || 
            update.type.toLowerCase().includes(state.filters.search) ||
            update.date.toLowerCase().includes(state.filters.search);
            
        // Type filter
        let matchesType = true;
        if (state.filters.type !== 'all') {
            if (state.filters.type === 'other') {
                const knownTypes = ['feature', 'announcement', 'issue', 'deprecation'];
                matchesType = !knownTypes.includes(update.type.toLowerCase());
            } else {
                matchesType = update.type.toLowerCase() === state.filters.type.toLowerCase();
            }
        }
        
        return matchesSearch && matchesType;
    });
    
    renderUpdates();
    updateStatusSummary();
}

function updateStatusSummary() {
    const showing = state.filteredUpdates.length;
    const total = state.updates.length;
    
    if (state.filters.search || state.filters.type !== 'all') {
        statusSummary.textContent = `Showing ${showing} of ${total} updates matching filters`;
    } else {
        statusSummary.textContent = `Showing all ${total} recent updates`;
    }
}

function updateFilterCounts() {
    const counts = {
        all: state.updates.length,
        feature: 0,
        announcement: 0,
        issue: 0,
        deprecation: 0,
        other: 0
    };
    
    state.updates.forEach(update => {
        const type = update.type.toLowerCase();
        if (type === 'feature') counts.feature++;
        else if (type === 'announcement') counts.announcement++;
        else if (type === 'issue') counts.issue++;
        else if (type === 'deprecation') counts.deprecation++;
        else counts.other++;
    });
    
    document.getElementById('count-all').textContent = counts.all;
    document.getElementById('count-feature').textContent = counts.feature;
    document.getElementById('count-announcement').textContent = counts.announcement;
    document.getElementById('count-issue').textContent = counts.issue;
    document.getElementById('count-deprecation').textContent = counts.deprecation;
    document.getElementById('count-other').textContent = counts.other;
}

// ==========================================================================
// Tweet Composer & Dialog
// ==========================================================================
function openTweetModal(update) {
    state.selectedUpdate = update;
    
    // Set preview details
    previewType.textContent = update.type;
    previewType.className = `preview-type type-${update.type.toLowerCase().replace(/\s+/g, '-')}`;
    previewDate.textContent = update.date;
    previewText.textContent = update.plain_text;
    
    // Generate initial tweet draft
    const initialText = compileInitialTweetText(update);
    tweetTextarea.value = initialText;
    
    // Trigger textarea height auto-fit or adjustments if needed
    updateTweetProgress();
    
    // Show native dialog modal
    tweetDialog.showModal();
}

function compileInitialTweetText(update) {
    // Standard template
    const header = `Google Cloud BigQuery Update [${update.date}] (${update.type}):\n\n`;
    const footer = `\n\nRead more: ${update.link}`;
    
    // Max characters available for description
    const maxDescLength = 280 - header.length - footer.length;
    
    let desc = update.plain_text;
    if (desc.length > maxDescLength) {
        // Truncate description at word boundary
        desc = desc.substring(0, maxDescLength - 3).trim();
        // find last space to truncate cleanly
        const lastSpace = desc.lastIndexOf(' ');
        if (lastSpace > maxDescLength / 2) {
            desc = desc.substring(0, lastSpace);
        }
        desc += '...';
    }
    
    return `${header}${desc}${footer}`;
}

function initProgressRing() {
    progressRingBar.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
    progressRingBar.style.strokeDashoffset = RING_CIRCUMFERENCE;
}

function handleTweetTextareaInput() {
    updateTweetProgress();
}

function updateTweetProgress() {
    const text = tweetTextarea.value;
    const length = text.length;
    
    charCount.textContent = length;
    
    // Calculate progress percentage (max 280)
    const percentage = Math.min((length / 280) * 100, 100);
    const offset = RING_CIRCUMFERENCE - (percentage / 100) * RING_CIRCUMFERENCE;
    progressRingBar.style.strokeDashoffset = offset;
    
    // Coloring classes for character limit feedback
    const parent = charCount.parentElement;
    parent.className = 'char-count-wrapper';
    
    if (length > 280) {
        parent.classList.add('danger');
        progressRingBar.style.stroke = 'var(--accent-red)';
        submitTweetBtn.disabled = true;
        submitTweetBtn.style.opacity = '0.5';
    } else if (length >= 240) {
        parent.classList.add('warning');
        progressRingBar.style.stroke = '#eab308'; // Warning Yellow
        submitTweetBtn.disabled = false;
        submitTweetBtn.style.opacity = '1';
    } else {
        progressRingBar.style.stroke = '#1d9bf0'; // Twitter Blue
        submitTweetBtn.disabled = false;
        submitTweetBtn.style.opacity = '1';
    }
}

async function copyTweetToClipboard() {
    const text = tweetTextarea.value;
    try {
        await navigator.clipboard.writeText(text);
        
        // Show visual feedback on button
        const originalHtml = copyTweetBtn.innerHTML;
        copyTweetBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        copyTweetBtn.disabled = true;
        
        showToast('Tweet copied to clipboard!', 'success');
        
        setTimeout(() => {
            copyTweetBtn.innerHTML = originalHtml;
            copyTweetBtn.disabled = false;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy text: ', err);
        showToast('Failed to copy to clipboard', 'error');
    }
}

function submitTweetToTwitter() {
    const text = tweetTextarea.value;
    if (text.length > 280) {
        showToast('Tweet text is too long! Limit is 280 characters.', 'error');
        return;
    }
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    
    // Close modal
    tweetDialog.close();
}

// ==========================================================================
// Toast Notification Helper
// ==========================================================================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '<i class="fa-solid fa-circle-check" style="color: var(--accent-green)"></i>';
    if (type === 'error') {
        icon = '<i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-red)"></i>';
    }
    
    toast.innerHTML = `
        ${icon}
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Fade out and remove after 3.5 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3500);
}
