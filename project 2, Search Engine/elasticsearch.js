const ELASTICSEARCH_URL = "http://localhost:9200/persian_engine";
const API_KEY =
  "ApiKey STVJcXJaTUJzalRFcUxmRFpyemg6SGFQano4d1VRaUNxbHVIQ1pfQVNSQQ==";

async function sendElasticsearchRequest(query) {
  try {
    const response = await fetch(`${ELASTICSEARCH_URL}/_search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: API_KEY,
      },
      body: JSON.stringify(query),
    });
    return await response.json();
  } catch (error) {
    console.error("Elasticsearch error:", error);
    return null;
  }
}

function buildSuggestionQuery(searchTerm) {
  return {
    "query": {
      "bool": {
        "should": [
          {
            "match_phrase_prefix": {
              "title": {
                "query": searchTerm,
                "boost": 2
              }
            }
          },
          {
            "match_phrase_prefix": {
              "body": {
                "query": searchTerm,
                "boost": 1
              }
            }
          }
        ]
      }
    },
    "highlight": {
      "fields": {
        "title": {
          "pre_tags": "<em>",
          "post_tags": "</em>",
          "number_of_fragments": 1,
          "fragment_size": 50
        },
        "body": {
          "pre_tags": "<em>",
          "post_tags": "</em>",
          "number_of_fragments": 1,
          "fragment_size": 50
        }
      }
    },
    "_source": false,
    "size": 10,
  };
}

function buildSearchQuery(searchTerm, from = 0, size = 10) {
  return {
    "query": {
      "bool": {
        "should": [
          {
            "multi_match": {
              "query": searchTerm,
              "fields": [
                "title^4",
                "body^2"
              ],
              "type": "phrase",
              "slop": 3,
              "operator": "and",
              "boost": 2
            }
          },
          {
            "multi_match": {
              "query": searchTerm,
              "fields": [
                "title^2",
                "body"
              ],
              "fuzziness": 1,
              "operator": "and",  
              "boost": 1
            }
          }
        ]
      }
    },
    "highlight": {
      "fields": {
        "title": {
          "pre_tags": "<em>",
          "post_tags": "</em>",
          "fragment_size": 50,
          "number_of_fragments": 10
        },
        "body": {
          "pre_tags": "<em>",
          "post_tags": "</em>",
          "fragment_size": 150,
          "number_of_fragments": 10,
        },
      },
    },
    "from": from,
    "size": size
  };
}

async function handleSuggestions(searchTerm) {
  if (!searchTerm || searchTerm.length < 2) {
    hideSuggestions();
    return;
  }

  const query = buildSuggestionQuery(searchTerm);
  const result = await sendElasticsearchRequest(query);

  if (result && result.hits && result.hits.hits.length > 0) {
    const suggestions = [];


    for (const hit of result.hits.hits) {
        if (hit.highlight && Array.isArray(hit.highlight.title)) {
            hit.highlight.title.forEach((titlePart) => {
                const matches = titlePart.match(/<em>(.*?)<\/em>/g);
                if (matches) {
                    matches.forEach((match) => {
                        const extractedText = match.replace(/<\/?em>/g, ""); // حذف تگ‌های <em> و </em>
                        suggestions.push(extractedText);
                    });
                }
            });
        }
    
        if (hit.highlight && Array.isArray(hit.highlight.body)) {
            hit.highlight.body.forEach((bodyPart) => {
                const matches = bodyPart.match(/<em>(.*?)<\/em>/g);
                if (matches) {
                    matches.forEach((match) => {
                        const extractedText = match.replace(/<\/?em>/g, "");
                        suggestions.push(extractedText);
                    });
                }
            });
        }
    }
    
    const uniqueSuggestions = [...new Set(suggestions)];

    if(uniqueSuggestions.length > 0){
      displaySuggestions(uniqueSuggestions);
    }else{
      hideSuggestions();
    }

    
  }else {
    hideSuggestions();
  }
}

async function performSearch(searchTerm, page = 1) {
  const startTime = performance.now();
  const size = 10;
  const from = (page - 1) * size;
  const query = buildSearchQuery(searchTerm, from, size);
  const result = await sendElasticsearchRequest(query);

  if (result && result.hits) {
    const total = result.hits.total.value;

    // // استخراج title و body از highlight
    // let first_result = new Set();
    // if (result.hits.hits[0].highlight) {
    //   const firstHighlight = result.hits.hits[0].highlight;
    //   if (firstHighlight.title) {
    //     const emRegex = /<em>(.*?)<\/em>/g;
    //     const matches = firstHighlight.body[0].match(emRegex);

    //     // اضافه کردن کلمات به Set
    //     matches.forEach(match => {
    //         // حذف تگ‌های em و اضافه کردن کلمه به Set
    //         const word = match.replace(/<\/?em>/g, '');
    //         first_result.add(word);
    //     });
    //   }
    //   if (firstHighlight.body) {
    //     const emRegex = /<em>(.*?)<\/em>/g;
    //     const matches = firstHighlight.body[0].match(emRegex);

    //     // اضافه کردن کلمات به Set
    //     matches.forEach(match => {
    //         // حذف تگ‌های em و اضافه کردن کلمه به Set
    //         const word = match.replace(/<\/?em>/g, '');
    //         first_result.add(word);
    //     });
    //   }
    // }

    // // بررسی شرط برای پیشنهاد اصلاح
    // if (page == 1 && !first_result.has(searchTerm)) {
    //   showSpellingCorrection(Array.from(first_result)[0]); // نمایش اولین پیشنهاد در صورت عدم تطابق
    // }else{
    //   hideSpellingCorrection()
    // }

    // ایجاد hits با مقادیر مشخص شده
    
    
    const analysis = analyzeSearchResults(result, searchTerm, page);
    
    if (analysis.shouldShowCorrection) {
        showSpellingCorrection(analysis.correctedQuery);
    } else {
        hideSpellingCorrection();
    }
    
    const hits = result.hits.hits.map((hit) => {
      const snippet = hit.highlight?.body?.[0] || hit._source.body.substring(0, 150);
      return {
        title: hit._source.title,
        snippet: snippet,
        url: hit._source.url,
        favicon: `https://${getDomainFromUrl(hit._source.url)}/favicon.ico`,
      };
    });

    // Calculate actual search time
    const endTime = performance.now();
    const searchTime = ((endTime - startTime) / 1000).toFixed(2);

    // Update search stats with real values
    document.getElementById("result-count").textContent = total.toLocaleString();
    document.getElementById("search-time").textContent = searchTime;

    displayResults(hits, from, total);
    displayPagination(page, Math.ceil(total / size));
  }
}

function getDomainFromUrl(url) {
  const regex = /^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i;
  const match = url.match(regex);
  return match ? match[1] : null; // Return the domain if found
}


function analyzeSearchResults(result, searchTerm, page = 1) {
  const highlightedTerms = new Set();

  function levenshteinDistance(str1, str2) {
      const matrix = Array(str2.length + 1).fill().map(() =>
          Array(str1.length + 1).fill(0)
      );

      for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
      for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

      for (let j = 1; j <= str2.length; j++) {
          for (let i = 1; i <= str1.length; i++) {
              const cost = str1[i - 1] === str2[j - 1] ? 0 :
                  (Math.min(str1.length, str2.length) <= 3 ? 1.5 : 1);

              matrix[j][i] = Math.min(
                  matrix[j - 1][i] + cost,
                  matrix[j][i - 1] + cost,
                  matrix[j - 1][i - 1] + cost
              );
          }
      }

      return matrix[str2.length][str1.length];
  }

  function areSimilar(word1, word2) {
      if (word1 === word2) return { similar: true, similarity: 1 };

      const maxLength = Math.max(word1.length, word2.length);
      const minLength = Math.min(word1.length, word2.length);
      const distance = levenshteinDistance(word1, word2);
      let similarity = 1 - (distance / maxLength);

      let threshold;
      if (minLength <= 3) {
          threshold = 0.9;
          const commonChars = [...word1].filter(char => word2.includes(char));
          const charSimilarity = commonChars.length / maxLength;
          similarity = Math.min(similarity, charSimilarity);

      } else if (minLength <= 5) {
          threshold = 0.8;
      } else {
          threshold = 0.7;
      }

      return {
          similar: similarity >= threshold,
          similarity: similarity
      };
  }

  const extractHighlightedWords = (text) => {
      const emRegex = /<em>(.*?)<\/em>/g;
      const matches = text.match(emRegex);
      if (!matches) return [];
      return matches.map(match => match.replace(/<\/?em>/g, ''));
  };

  result.hits.hits.forEach(hit => {
      if (hit.highlight) {
          ['title', 'body'].forEach(field => {
              if (hit.highlight[field]) {
                  hit.highlight[field].forEach(text => {
                      extractHighlightedWords(text).forEach(word =>
                          highlightedTerms.add(word)
                      );
                  });
              }
          });
      }
  });

  const searchTerms = searchTerm.split(/\s+/).filter(term => term.length > 0);
  const matchAnalysis = {
      matches: new Set(),
      mismatches: new Set(),
      suggestions: new Map()
  };

  searchTerms.forEach(term => {
      let bestMatch = {
          word: null,
          similarity: 0
      };

      highlightedTerms.forEach(highlight => {
          const { similarity } = areSimilar(term, highlight);
          if (similarity > bestMatch.similarity) {
              bestMatch = {
                  word: highlight,
                  similarity: similarity
              };
          }
      });

      const { similar } = areSimilar(term, bestMatch.word || '');
      if (similar) {
          matchAnalysis.matches.add(term);
          if (bestMatch.word !== term) {
              matchAnalysis.suggestions.set(term, bestMatch.word);
          }
      } else {
          matchAnalysis.mismatches.add(term);
      }
  });

  const analysisResult = {
      shouldShowCorrection: false,
      suggestions: Object.fromEntries(matchAnalysis.suggestions),
      matchedTerms: Array.from(matchAnalysis.matches),
      mismatchedTerms: Array.from(matchAnalysis.mismatches),
      highlightedTerms: Array.from(highlightedTerms),
      correctedQuery: searchTerms.map(term =>
          matchAnalysis.suggestions.get(term) || 
          (matchAnalysis.mismatches.has(term) && [...highlightedTerms].sort((a, b) => levenshteinDistance(term, a) - levenshteinDistance(term, b))[0]) ||
          term
      ).join(' ')
  };

  if (matchAnalysis.suggestions.size > 0 || matchAnalysis.mismatches.size > 0) {
      analysisResult.shouldShowCorrection = true;
  }

  return analysisResult;
}


document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.querySelector(".search-input");
  const searchForm = document.querySelector("form.search-box");

  // لیسنر برای پیشنهادات
  let debounceTimer;
  searchInput?.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      handleSuggestions(e.target.value);
    }, 300);
  });

  // لیسنر برای جستجو
  searchForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const searchTerm = searchInput.value.trim();
    if (searchTerm) {
      if (window.location.pathname.includes("resultpage.html")) {
        performSearch(searchTerm);
        // به‌روزرسانی URL
        const newUrl = new URL(window.location);
        newUrl.searchParams.set("q", searchTerm);
        window.history.pushState({}, "", newUrl);
      } else {
        window.location.href = `resultpage.html?q=${encodeURIComponent(
          searchTerm
        )}`;
      }
    }
  });

  // اجرای جستجوی اولیه در صفحه نتایج
  if (window.location.pathname.includes("resultpage.html")) {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get("q");
    if (query) {
      searchInput.value = query;
      performSearch(query);
    }
  }
});
