// Theme handling
const themeToggle = document.querySelector(".theme-toggle");
const sunIcon = document.querySelector(".sun-icon");
const searchInput = document.querySelector(".search-input");
const suggestionsContainer = document.createElement("div");
suggestionsContainer.className = "suggestions";
document.querySelector(".search-box").appendChild(suggestionsContainer);

function setTheme(isDark) {
document.documentElement.setAttribute(
    "data-theme",
    isDark ? "dark" : "light"
);
try {
    sessionStorage.setItem("theme", isDark ? "dark" : "light");
} catch (e) {
    console.warn("Storage is not available");
}
updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
if (isDark) {
    sunIcon.innerHTML = `
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="none" stroke="currentColor" stroke-width="2"/>
                    `;
} else {
    sunIcon.innerHTML = `
                        <circle cx="12" cy="12" r="5"/>
                        <line x1="12" y1="1" x2="12" y2="3"/>
                        <line x1="12" y1="21" x2="12" y2="23"/>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                        <line x1="1" y1="12" x2="3" y2="12"/>
                        <line x1="21" y1="12" x2="23" y2="12"/>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    `;
}
}

// Initialize theme
let currentTheme = "light";
try {
    currentTheme = sessionStorage.getItem("theme") || "light";
} catch (e) {
    console.warn("Storage is not available, using default theme");
}
setTheme(currentTheme === "dark");

themeToggle.addEventListener("click", () => {
    const isDark =
        document.documentElement.getAttribute("data-theme") === "dark";
    setTheme(!isDark);
});

// Search results handling
function displayResults(results, startIndex, totalResults) {
    const resultsContainer = document.getElementById("search-results");
    resultsContainer.innerHTML = "";

    results.forEach((result) => {
        // دیکد کردن آدرس
        let decodedUrl = decodeURIComponent(result.url);
        const parts = decodedUrl.split("/");
        const formattedUrl = parts.slice(0, 3).join("/") + " > " + parts.slice(3).join(" > ");

        const resultElement = document.createElement("div");
        resultElement.className = "search-result";
        resultElement.innerHTML = `
                            <div class="result-site-info">
                                <img src="${result.favicon}" alt="" class="site-favicon">
                                <a href="${result.url}" class="site-url">${formattedUrl}</a>
                            </div>
                            <a href="${result.url}" class="result-title">${result.title}</a>
                            <div class="result-snippet">${result.snippet}</div>
                        `;
        resultsContainer.appendChild(resultElement);
    });

}

function loadPage(pageNumber) {
    // Simulated API call - replace with actual backend call
    const results = []; // This would come from your backend
    displayResults(results, (pageNumber - 1) * 10, 100);
    displayPagination(pageNumber, 10);
}

function displayPagination(currentPage, totalPages) {
    const pagination = document.getElementById("pagination");
    pagination.innerHTML = "";

    const maxVisible = 7; // تعداد صفحات قابل نمایش

    function addPageButton(page, text = page, additionalClass = "") {
        const button = document.createElement("a");
        button.className = `pagination-item ${additionalClass} ${
        page === currentPage ? "active" : ""
        }`;
        button.textContent = text;

        if (additionalClass.includes("disabled")) {
            button.classList.add("disabled");
        } else {
            button.addEventListener("click", () => {
            const searchInput = document.querySelector(".search-input");
            performSearch(searchInput.value, page);

            // بروزرسانی URL
            const newUrl = new URL(window.location);
            newUrl.searchParams.set("page", page);
            window.history.pushState({}, "", newUrl);

            topFunction()
        });
        }

        pagination.appendChild(button);

    }

    function addDots() {
        const dots = document.createElement("span");
        dots.className = "pagination-dots";
        dots.textContent = "•••";
        pagination.appendChild(dots);
    }

    // دکمه قبلی
    addPageButton(
        currentPage - 1,
        "←",
        `pagination-nav ${currentPage === 1 ? "disabled" : ""}`
    );

    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    // صفحه اول
    if (startPage > 1) {
        addPageButton(1);
        if (startPage > 2) addDots();
    }

    // صفحات میانی
    for (let i = startPage; i <= endPage; i++) {
        addPageButton(i);
    }

    // صفحه آخر
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) addDots();
        addPageButton(totalPages);
    }

    // دکمه بعدی
    addPageButton(
        currentPage + 1,
        "→",
        `pagination-nav ${currentPage === totalPages ? "disabled" : ""}`
    );
}

function showSpellingCorrection(suggestion) {
    const correctionBox = document.getElementById("correction-box");
    const correctionLink = document.getElementById("correction-suggestion");
    correctionLink.textContent = suggestion;

    correctionLink.addEventListener("click", () => {
        const searchInput = document.querySelector(".search-input");
        searchInput.value = suggestion;
        performSearch(suggestion);
        // به‌روزرسانی URL
        const newUrl = new URL(window.location);
        newUrl.searchParams.set("q", suggestion);
        window.history.pushState({}, "", newUrl);
    });

    correctionBox.classList.add("show");
}

function hideSpellingCorrection() {
    const correctionBox = document.getElementById("correction-box");
    correctionBox.classList.remove("show");
}

function displaySuggestions(suggestions) {
    suggestionsContainer.innerHTML = "";
    suggestions.forEach((suggestion) => {
        const div = document.createElement("div");
        div.className = "suggestion-item";
        div.textContent = suggestion;
        div.addEventListener("click", () => {
        searchInput.value = suggestion;
        hideSuggestions();
        performSearch(suggestion);
        });
        suggestionsContainer.appendChild(div);
    });
    suggestionsContainer.classList.add("show-suggestions");
}

function hideSuggestions() {
    suggestionsContainer.classList.remove("show-suggestions");
}

function topFunction() {
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

// Close suggestions on outside click
document.addEventListener("click", function (event) {
    if (!event.target.closest(".search-container")) {
        hideSuggestions();
    }
});
