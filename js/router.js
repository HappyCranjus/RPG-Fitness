const Router = (() => {
  const routes = {};

  function getHash() {
    return window.location.hash.slice(1) || 'dashboard';
  }

  // Splits 'log?routine=rt_x&foo=1' into { route: 'log', params: {...} }
  function parseHash(hash) {
    const [route, qs] = hash.split('?');
    const params = {};
    if (qs) {
      for (const pair of qs.split('&')) {
        const [k, v] = pair.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
    }
    return { route: route || 'dashboard', params };
  }

  function updateNav(route) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.route === route);
    });
  }

  function render() {
    const { route, params } = parseHash(getHash());
    const container = document.getElementById('screen-container');
    updateNav(route);
    if (routes[route]) {
      container.innerHTML = '';
      routes[route](container, params);
      container.scrollTop = 0;
    } else {
      container.innerHTML = `<p style="padding:20px;color:var(--text-muted)">Screen not found: ${route}</p>`;
    }
    if (typeof updateStatHeader === 'function') updateStatHeader();
  }

  return {
    register(hash, fn) { routes[hash] = fn; },

    navigate(hash) {
      window.location.hash = hash;
    },

    refresh() { render(); },

    init() {
      window.addEventListener('hashchange', render);

      document.getElementById('bottom-nav').addEventListener('click', e => {
        const btn = e.target.closest('.nav-btn');
        if (btn) Router.navigate(btn.dataset.route);
      });

      render();
    },
  };
})();
