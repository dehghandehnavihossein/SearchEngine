const searchInput = document.querySelector(".search-input");
const suggestionsContainer = document.querySelector(".suggestions");
const themeToggle = document.querySelector(".theme-toggle");
const sunIcon = document.querySelector(".sun-icon");
const searchForm = document.querySelector(".search-box");

// Theme handling with fallback
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

// Search handling
searchForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (query) {
    window.location.href = `resultpage.html?q=${encodeURIComponent(
      query
    )}`;
  }
});

function displaySuggestions(suggestions) {
  suggestionsContainer.innerHTML = "";
  suggestions.forEach((suggestion) => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.textContent = suggestion;
    div.addEventListener("click", () => {
      searchInput.value = suggestion;
      hideSuggestions();
      searchForm.submit();
    });
    suggestionsContainer.appendChild(div);
  });
  suggestionsContainer.classList.add("show-suggestions");
}

function hideSuggestions() {
  suggestionsContainer.classList.remove("show-suggestions");
}

document.addEventListener("click", function (event) {
  if (!event.target.closest(".search-box")) {
    hideSuggestions();
  }
});
