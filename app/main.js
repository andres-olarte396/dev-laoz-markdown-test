(function () {
    const app = document.getElementById('app');
    const statusEl = document.getElementById('status');
    const moduleSel = document.getElementById('module');
    const button = document.getElementById('load');
    const yearEl = document.getElementById('year');
    let APP_CFG = null;

    function populateModuleSelect(evals, defModule) {
        moduleSel.innerHTML = '';
        for (const e of evals) {
            const opt = document.createElement('option');
            opt.value = String(e.module);
            opt.textContent = e.label || `Módulo ${e.module}`;
            moduleSel.appendChild(opt);
        }
        const def = defModule != null ? String(defModule) : String(evals[0]?.module ?? '1');
        moduleSel.value = def;
    }

    function getEvalEntry(mod) {
        const evals = Array.isArray(APP_CFG?.evaluations) ? APP_CFG.evaluations : [];
        return evals.find(e => String(e.module) === String(mod)) || null;
    }

    async function loadModule(mod) {
        const e = getEvalEntry(mod);
    const label = e?.label || `Módulo ${mod}`;
        const mdUrl = e?.mdUrl;
        const answersUrl = e?.ansUrl;
    const multiselect = Array.isArray(e?.multiselect) ? e.multiselect : [];
        statusEl.textContent = `Cargando ${label}…`;
        app.classList.add('loading');
        const toolbar = document.getElementById('ev-toolbar');
        if (toolbar) toolbar.innerHTML = '';

        try {
            if (!mdUrl || !answersUrl) { throw new Error(`Configuración faltante para módulo ${mod}`); }
            const res = await fetch(mdUrl);
            if (!res.ok) { throw new Error(`No se pudo cargar ${mdUrl}: ${res.status}`); }
            const md = await res.text();
            const brand = (APP_CFG?.brandName || APP_CFG?.organization || 'Evaluaciones');
            window.EV_CONFIG = { ...(window.EV_CONFIG || {}), answersUrl, evalLabel: label, module: String(mod), course: APP_CFG?.course || '', brand, multiselectQuestions: multiselect };
            app.innerHTML = marked.parse(md);
            app.classList.remove('loading');
            statusEl.textContent = `${label} cargado.`;
            if (APP_CFG?.title) document.getElementById('page-title').textContent = `${APP_CFG.title} – ${label}`;
            if (window.EV_rewire) { window.EV_rewire(); }
        } catch (e) {
            console.error(e);
            statusEl.textContent = 'Error al cargar.';
            app.textContent = 'No se pudo cargar la evaluación.';
        }
    }

    button.addEventListener('click', () => {
        const mod = moduleSel.value;
        loadModule(mod);
    });

    (async function initFromConfig() {
        try {
            const cfgRes = await fetch('./config.json');
            if (cfgRes.ok) {
                const cfg = await cfgRes.json();
                APP_CFG = cfg;
                document.getElementById('page-title').textContent = cfg.title || document.title;
                const brand = cfg.brandName || cfg.organization || 'Evaluaciones';
                document.getElementById('brand-title').textContent = brand;
                const courseEl = document.getElementById('course-name');
                if (courseEl) courseEl.textContent = cfg.course || courseEl.textContent;
                const fbrand = document.getElementById('footer-brand');
                if (fbrand) { fbrand.textContent = (cfg['footer-brand'] || brand); }
                const fcourse = document.getElementById('footer-course');
                if (fcourse) { fcourse.textContent = (cfg['footer-course'] || (cfg.course ? `Curso: ${cfg.course}` : fcourse.textContent)); }
                if (cfg.durationMinutes != null) { window.EV_CONFIG = { ...(window.EV_CONFIG || {}), durationMinutes: cfg.durationMinutes }; }
                const evals = Array.isArray(cfg.evaluations) ? cfg.evaluations : null;
                if (evals && evals.length) {
                    populateModuleSelect(evals, cfg.defaultModule);
                } else {
                    moduleSel.innerHTML = '';
                    for (let i = 1; i <= 5; i++) {
                        const opt = document.createElement('option');
                        opt.value = String(i);
                        opt.textContent = `Módulo ${i}`;
                        moduleSel.appendChild(opt);
                    }
                    moduleSel.value = String(cfg.defaultModule ?? '1');
                }
                await loadModule(moduleSel.value);
            } else {
                await loadModule('1');
            }
        } catch {
            await loadModule('1');
        }
    })();

    if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
