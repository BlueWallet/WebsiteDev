(function () {
  var REPO_API = 'https://api.github.com/repos/BlueWallet/BlueWallet';
  var STATS_CACHE_KEY = 'bw_repo_stats';
  var STATS_CACHE_TTL = 24 * 60 * 60 * 1000;
  var BASE_URL = 'https://api.github.com/repos/BlueWallet/BlueWallet/issues?state=open&per_page=20&sort=created&direction=desc&labels=';

  function formatStatCount(n) {
    if (n >= 1000000) return Math.floor(n / 1000000) + 'M+';
    if (n >= 1000) return Math.floor(n / 1000) + 'K+';
    return String(n);
  }

  function paginatedCount(path) {
    return fetch(path + '?per_page=1')
      .then(function (res) {
        if (!res.ok) return Promise.reject();
        var link = res.headers.get('Link');
        if (link) {
          var match = link.match(/[?&]page=(\d+)>; rel="last"/);
          if (match) return parseInt(match[1], 10);
        }
        return res.json().then(function (data) { return data.length; });
      });
  }

  function renderRepoStats(stats) {
    var releasesEl = document.getElementById('contribute-stat-releases');
    var starsEl = document.getElementById('contribute-stat-stars');
    var contributorsEl = document.getElementById('contribute-stat-contributors');
    if (!releasesEl && !starsEl && !contributorsEl) return;

    if (releasesEl && stats.releases != null) {
      releasesEl.textContent = formatStatCount(stats.releases);
    }
    if (starsEl && stats.stars != null) {
      starsEl.textContent = formatStatCount(stats.stars);
    }
    if (contributorsEl && stats.contributors != null) {
      contributorsEl.textContent = formatStatCount(stats.contributors);
    }
  }

  function getStatsCache() {
    try {
      var raw = JSON.parse(localStorage.getItem(STATS_CACHE_KEY));
      if (raw && Date.now() - raw.ts < STATS_CACHE_TTL) return raw.data;
    } catch (e) {}
    return null;
  }

  function setStatsCache(data) {
    try {
      localStorage.setItem(STATS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
    } catch (e) {}
  }

  function loadRepoStats() {
    if (!document.getElementById('contribute-stat-stars')) return;

    var cached = getStatsCache();
    if (cached) renderRepoStats(cached);

    Promise.all([
      fetch(REPO_API).then(function (res) { return res.ok ? res.json() : Promise.reject(); }),
      paginatedCount(REPO_API + '/releases'),
      paginatedCount(REPO_API + '/contributors')
    ])
      .then(function (results) {
        var stats = {
          stars: results[0].stargazers_count,
          releases: results[1],
          contributors: results[2]
        };
        setStatsCache(stats);
        renderRepoStats(stats);
      })
      .catch(function () {
        if (!cached) return;
        renderRepoStats(cached);
      });
  }

  loadRepoStats();

  var feeds = [
    {
      id: 'good-first-issues',
      cacheKey: 'bw_good_first_issues',
      labels: 'good+first+issue+%F0%9F%A5%87,help+wanted'
    },
    {
      id: 'bug-issues',
      cacheKey: 'bw_bug_issues',
      labels: 'bug'
    }
  ];

  function isLightColor(hex) {
    var r = parseInt(hex.substr(0, 2), 16);
    var g = parseInt(hex.substr(2, 2), 16);
    var b = parseInt(hex.substr(4, 2), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150;
  }

  function renderLabels(labels) {
    return labels.map(function (label) {
      var textColor = isLightColor(label.color) ? '#333' : '#fff';
      return '<span class="issue-label" style="background:#' + label.color + ';color:' + textColor + '">' + label.name + '</span>';
    }).join(' ');
  }

  function render(container, issues) {
    if (!issues || !issues.length) {
      container.innerHTML = '<p class="uk-text-muted">No issues found right now. Check back soon!</p>';
      return;
    }

    var html = '<div class="uk-grid-small uk-child-width-1-1" data-uk-grid>';
    issues.forEach(function (issue) {
      html +=
        '<div>' +
          '<div class="uk-card uk-card-default uk-box-shadow-medium uk-card-hover uk-card-body uk-inline border-radius-medium border-light">' +
            '<a class="uk-position-cover" href="' + issue.html_url + '" target="_blank"></a>' +
            '<span class="uk-text-muted issue-number">#' + issue.number + '</span>' +
            '<h3 class="uk-card-title uk-margin-small-top uk-margin-small-bottom">' + issue.title + '</h3>' +
            '<div class="issue-labels">' + renderLabels(issue.labels) + '</div>' +
          '</div>' +
        '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  }

  function getCached(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  }

  function setCache(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}
  }

  feeds.forEach(function (feed) {
    var container = document.getElementById(feed.id);
    if (!container) return;

    fetch(BASE_URL + feed.labels)
      .then(function (res) { return res.ok ? res.json() : Promise.reject(); })
      .then(function (data) {
        setCache(feed.cacheKey, data);
        render(container, data);
      })
      .catch(function () {
        var cached = getCached(feed.cacheKey);
        if (cached) {
          render(container, cached);
        } else {
          container.innerHTML = '<p class="uk-text-muted">Could not load issues. <a href="https://github.com/BlueWallet/BlueWallet/issues" target="_blank">View on GitHub</a></p>';
        }
      });
  });

  // --- Translation stats from BlueWallet loc/*.json on GitHub ---

  var RAW_BASE = 'https://cdn.jsdelivr.net/gh/BlueWallet/BlueWallet@master/loc/';
  var TRANSIFEX_URL = 'https://explore.transifex.com/bluewallet/bluewallet/';
  var TRANSLATION_CACHE_KEY = 'bw_translation_stats';
  var CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  var BATCH_SIZE = 10;
  var FETCH_TIMEOUT_MS = 10000;
  var translationsLoaded = false;

  var LANG_FILES = {
    ar: 'ar.json',
    be: 'be@tarask.json',
    bg_bg: 'bg_bg.json',
    bqi: 'bqi.json',
    ca: 'ca.json',
    cs_cz: 'cs_cz.json',
    cy: 'cy.json',
    da_dk: 'da_dk.json',
    de_de: 'de_de.json',
    el: 'el.json',
    es: 'es.json',
    es_419: 'es_419.json',
    et: 'et_EE.json',
    fa: 'fa.json',
    fi_fi: 'fi_fi.json',
    fo: 'fo.json',
    fr_fr: 'fr_fr.json',
    he: 'he.json',
    hr_hr: 'hr_hr.json',
    hu_hu: 'hu_hu.json',
    id_id: 'id_id.json',
    it: 'it.json',
    jp_jp: 'jp_jp.json',
    'kk@Cyrl': 'kk@Cyrl.json',
    kn: 'kn.json',
    ko_kr: 'ko_KR.json',
    lrc: 'lrc.json',
    ms: 'ms.json',
    nb_no: 'nb_no.json',
    ne: 'ne.json',
    nl_nl: 'nl_nl.json',
    pcm: 'pcm.json',
    pl: 'pl.json',
    pt_br: 'pt_br.json',
    pt_pt: 'pt_pt.json',
    ro: 'ro.json',
    ru: 'ru.json',
    si_lk: 'si_LK.json',
    sk_sk: 'sk_sk.json',
    sl_si: 'sl_SI.json',
    sq_AL: 'sq_AL.json',
    sr_rs: 'sr_RS.json',
    sv_se: 'sv_se.json',
    th_th: 'th_th.json',
    tr_tr: 'tr_tr.json',
    ua: 'ua.json',
    vi_vn: 'vi_vn.json',
    zar_afr: 'zar_afr.json',
    zar_xho: 'zar_xho.json',
    zh_cn: 'zh_cn.json',
    zh_tw: 'zh_tw.json'
  };

  var LANG_LABELS = {
    ar: 'العربية (AR)',
    be: 'Беларускі (BE)',
    bg_bg: 'Български (BG)',
    bqi: 'لۊری بختیاری (BQI)',
    ca: 'Català (CA)',
    cs_cz: 'Česky (CZ)',
    cy: 'Cymraeg (CY)',
    da_dk: 'Danish (DK)',
    de_de: 'Deutsch (DE)',
    el: 'Ελληνικά (EL)',
    es: 'Español (Spain) (es_ES)',
    es_419: 'Español (Latin America) (es_419)',
    et: 'Eesti (ET)',
    fa: 'فارسی (FA)',
    fi_fi: 'Suomi (FI)',
    fo: 'Føroyskt (FO)',
    fr_fr: 'Français (FR)',
    he: 'עִברִית (HE)',
    hr_hr: 'Croatian (HR)',
    hu_hu: 'Magyar (HU)',
    id_id: 'Indonesia (ID)',
    it: 'Italiano (IT)',
    jp_jp: '日本語 (JP)',
    'kk@Cyrl': 'Қазақ (KK)',
    kn: 'ಕನ್ನಡ (KN)',
    ko_kr: '한국어 (KO)',
    lrc: 'لٛۏری شومالی (LRC)',
    ms: 'Bahasa Melayu (MS)',
    nb_no: 'Norsk (NB)',
    ne: 'नेपाली (NE)',
    nl_nl: 'Nederlands (NL)',
    pcm: 'Nigerian Pidgin (NG)',
    pl: 'Polski (PL)',
    pt_br: 'Português (BR)',
    pt_pt: 'Português (PT)',
    ro: 'Română (RO)',
    ru: 'Русский (RU)',
    si_lk: 'සිංහල (SI)',
    sk_sk: 'Slovenský (SK)',
    sl_si: 'Slovenščina (SL)',
    sq_AL: 'Shqip (SQ)',
    sr_rs: 'Српски (SR)',
    sv_se: 'Svenska (SE)',
    th_th: 'Thai (TH)',
    tr_tr: 'Türkçe (TR)',
    ua: 'Українська (UA)',
    vi_vn: 'Vietnamese (VN)',
    zar_afr: 'Afrikaans (AFR)',
    zar_xho: 'Xhosa (XHO)',
    zh_cn: 'Chinese (ZH)',
    zh_tw: 'Chinese (TW)'
  };

  function withEnglish(languages) {
    var list = (languages || []).filter(function (lang) {
      return lang.code !== 'en';
    });
    list.push({
      code: 'en',
      name: 'English',
      completion: 100
    });
    return list;
  }

  function langEntry(code, completion) {
    return {
      code: code,
      name: LANG_LABELS[code] || code,
      completion: completion
    };
  }

  function flatten(obj, prefix) {
    var out = {};
    prefix = prefix || '';
    Object.keys(obj).forEach(function (key) {
      var fullKey = prefix ? prefix + '.' + key : key;
      var val = obj[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        Object.assign(out, flatten(val, fullKey));
      } else {
        out[fullKey] = val;
      }
    });
    return out;
  }

  function computeCompletion(enFlat, langFlat) {
    var total = Object.keys(enFlat).length;
    if (!total) return 0;
    var translated = 0;
    Object.keys(enFlat).forEach(function (key) {
      var val = langFlat[key];
      if (val !== undefined && String(val).trim() && val !== enFlat[key]) {
        translated++;
      }
    });
    return Math.round((translated / total) * 100);
  }

  function locUrl(file) {
    return RAW_BASE + file.replace(/@/g, '%40');
  }

  function fetchJson(url) {
    var timeout = new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error('timeout')); }, FETCH_TIMEOUT_MS);
    });
    return Promise.race([
      fetch(url).then(function (res) {
        return res.ok ? res.json() : Promise.reject(new Error('http'));
      }),
      timeout
    ]);
  }

  function renderTranslations(container, languages, statusText) {
    if (!languages || !languages.length) {
      container.innerHTML = '<p class="uk-text-muted">' + (statusText || 'No translation data available.') + '</p>';
      return;
    }

    var sorted = withEnglish(languages).slice().sort(function (a, b) {
      if (a.code === 'en') return -1;
      if (b.code === 'en') return 1;
      return a.completion - b.completion;
    });

    var html = '';
    if (statusText) {
      html += '<p class="uk-text-muted translation-status">' + statusText + '</p>';
    }
    html += '<div class="translation-list">';
    sorted.forEach(function (lang) {
      html +=
        '<a href="' + TRANSIFEX_URL + '" target="_blank" rel="noopener" class="translation-row">' +
          '<span class="translation-name">' + lang.name + '</span>' +
          '<div class="translation-progress-wrap">' +
            '<progress class="translation-progress uk-progress" value="' + lang.completion + '" max="100"></progress>' +
            '<span class="translation-pct">' + lang.completion + '%</span>' +
          '</div>' +
        '</a>';
    });
    html += '</div>';
    container.innerHTML = html;
  }

  function getTranslationCache() {
    try {
      var cached = JSON.parse(localStorage.getItem(TRANSLATION_CACHE_KEY));
      if (cached && cached.timestamp && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.languages;
      }
    } catch (e) {}
    return null;
  }

  function setTranslationCache(languages) {
    try {
      localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        languages: languages
      }));
    } catch (e) {}
  }

  function fetchBatch(entries, enFlat) {
    return Promise.all(entries.map(function (entry) {
      return fetchJson(locUrl(entry.file))
        .then(function (data) {
          return langEntry(entry.code, computeCompletion(enFlat, flatten(data)));
        })
        .catch(function () {
          return langEntry(entry.code, 0);
        });
    }));
  }

  function loadTranslations(force) {
    var container = document.getElementById('translation-languages');
    if (!container || (translationsLoaded && !force)) return;

    var cached = !force ? getTranslationCache() : null;
    if (cached) {
      translationsLoaded = true;
      renderTranslations(container, cached);
      return;
    }

    var entries = Object.keys(LANG_FILES).map(function (code) {
      return { code: code, file: LANG_FILES[code] };
    });
    var total = entries.length;
    var results = [];

    renderTranslations(container, [], 'Loading translations (0/' + total + ')…');

    fetchJson(locUrl('en.json'))
      .then(function (enJson) {
        var enFlat = flatten(enJson);
        var chain = Promise.resolve();

        for (var i = 0; i < entries.length; i += BATCH_SIZE) {
          (function (batch) {
            chain = chain.then(function () {
              return fetchBatch(batch, enFlat).then(function (batchResults) {
                results = results.concat(batchResults);
                var done = results.length;
                if (done < total) {
                  renderTranslations(container, results, 'Loading translations (' + done + '/' + total + ')…');
                }
              });
            });
          })(entries.slice(i, i + BATCH_SIZE));
        }

        return chain.then(function () {
          translationsLoaded = true;
          setTranslationCache(results);
          renderTranslations(container, results);
        });
      })
      .catch(function () {
        if (results.length) {
          translationsLoaded = true;
          renderTranslations(container, results, 'Some languages could not be loaded.');
          return;
        }
        container.innerHTML = '<p class="uk-text-muted">Could not load translation stats. <a href="' + TRANSIFEX_URL + '" target="_blank">Join on Transifex</a></p>';
      });
  }

  loadTranslations();
})();
