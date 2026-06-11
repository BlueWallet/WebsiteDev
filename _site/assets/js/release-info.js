(function () {
  var CACHE_KEY = 'bw_latest_release';
  var API_URL = 'https://api.github.com/repos/BlueWallet/BlueWallet/releases/latest';

  function formatDate(isoString) {
    var d = new Date(isoString);
    var months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function render(data) {
    var versionEl = document.getElementById('hero-version');
    var donateEl = document.getElementById('hero-donate');
    if (!data.tag_name) return;

    if (versionEl) {
      versionEl.style.display = 'inline-block';
      versionEl.innerHTML =
        '<a href="' + data.html_url + '" target="_blank" style="color:#fff;text-decoration:none">Latest version ' +
        data.tag_name + ' · ' + formatDate(data.published_at) + '</a>';
    }

    if (donateEl) {
      donateEl.innerHTML =
        'Free & Open Source Software · ' +
        '<a href="https://donate.bluewallet.io" target="_blank">Donate to development</a>';
    }
  }

  function getCached() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY));
    } catch (e) {
      return null;
    }
  }

  function setCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  fetch(API_URL)
    .then(function (res) { return res.ok ? res.json() : Promise.reject(); })
    .then(function (data) {
      setCache(data);
      render(data);
    })
    .catch(function () {
      var cached = getCached();
      if (cached) render(cached);
    });
})();
