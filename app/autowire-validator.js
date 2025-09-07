// Auto-wire evaluation pages generated from Markdown into the validator
// - Detects headings like "## Pregunta N"
// - Maps the following list of options (A–D)
// - Enforces single selection per question
// - Adds feedback containers
// - Provides a Validate button with a timer

(function () {
	let timerInterval = null;
	// Track timing across the session to include in the report
	const timing = { mode: 'stopwatch', startAt: null, totalMs: null, elapsedMs: 0, remainingMs: null };
	function text(node) { return (node?.textContent || '').trim(); }
	function findNextList(start) {
		let el = start;
		while (el && (el = el.nextElementSibling)) {
			const tag = el.tagName?.toLowerCase();
			if (tag === 'ul' || tag === 'ol') return el;
			if (/^h[1-6]$/.test(tag || '')) return null;
		}
		return null;
	}
	function extractLetterFromLi(li) {
		const t = text(li).replace(/\s+/g, ' ').trim();
		const m = t.match(/^([A-Da-d])\s*[). -]/);
		if (m) return m[1].toUpperCase();
		const input = li.querySelector('input[type="checkbox"],input[type="radio"]');
		if (input?.value && /^[A-D]$/i.test(input.value)) return input.value.toUpperCase();
		return null;
	}
	function ensureFeedback(listEl, qNum) {
		const next = listEl.nextElementSibling;
		if (next?.hasAttribute?.('data-feedback')) return next;
		const fb = document.createElement('div');
		fb.setAttribute('data-feedback', String(qNum));
		listEl.parentNode.insertBefore(fb, listEl.nextSibling);
		return fb;
	}
	function isMulti(qNum) {
		const ms = (window.EV_CONFIG && Array.isArray(window.EV_CONFIG.multiselectQuestions)) ? window.EV_CONFIG.multiselectQuestions : [];
		return ms.map(String).includes(String(qNum));
	}
	function setupQuestionInputs(listEl, qNum) {
		const items = Array.from(listEl.querySelectorAll('li'));
		const multi = isMulti(qNum);
		for (const li of items) {
			let input = li.querySelector('input[type="checkbox"],input[type="radio"]');
			if (!input) {
				input = document.createElement('input');
				input.type = multi ? 'checkbox' : 'radio';
				input.name = `q_${qNum}`;
				input.style.marginRight = '6px';
				li.insertBefore(input, li.firstChild);
			} else {
				input.type = multi ? 'checkbox' : 'radio';
				input.name = `q_${qNum}`;
				input.disabled = false;
				input.removeAttribute('disabled');
				input.removeAttribute('aria-disabled');
				input.style.pointerEvents = 'auto';
				input.tabIndex = 0;
			}
			const letter = extractLetterFromLi(li);
			if (!letter) continue;
			li.setAttribute('data-question', String(qNum));
			li.setAttribute('data-option', letter);
			if (!li.dataset.evWired) {
				li.dataset.evWired = '1';
				li.style.cursor = 'pointer';
				li.addEventListener('click', (e) => {
					if (e.target && (e.target.tagName?.toLowerCase() === 'input' || e.target.closest('input'))) return;
					if (multi) {
						input.checked = !input.checked;
					} else {
						input.checked = true;
					}
				});
			}
		}
	}
	function collectUserResponses() {
		const responses = {};
		const optionNodes = Array.from(document.querySelectorAll('[data-question][data-option]'));
		const qGroups = new Map();
		for (const node of optionNodes) {
			const q = Number(node.getAttribute('data-question'));
			if (!qGroups.has(q)) qGroups.set(q, []);
			qGroups.get(q).push(node);
		}
		for (const [q, nodes] of qGroups.entries()) {
			const multi = isMulti(q);
			const chosenNodes = nodes.filter((n) => n.querySelector('input:checked'));
			if (multi) {
				if (chosenNodes.length) responses[q] = chosenNodes.map(n => n.getAttribute('data-option'));
			} else {
				const chosen = chosenNodes[0];
				if (chosen) responses[q] = chosen.getAttribute('data-option');
			}
		}
		return responses;
	}
	function addValidateUI(container) {
		if (container.querySelector('[data-ev-validate]')) return;
		const bar = document.createElement('div');
		bar.style.margin = '24px 0';
		bar.style.display = 'flex';
		bar.style.alignItems = 'center';
		bar.style.gap = '12px';

		const timer = document.createElement('span');
		timer.id = 'ev-timer';
		timer.style.marginRight = 'auto';
		timer.style.fontVariantNumeric = 'tabular-nums';
		timer.textContent = 'Tiempo: 00:00';

		console.log('Adding validate UI');
		// Validate button
		const btn = document.createElement('button');
		btn.textContent = 'Validar';
		btn.style.padding = '8px 14px';
		btn.style.fontSize = '1rem';
		btn.style.cursor = 'pointer';
		btn.setAttribute('data-ev-validate', '');

		const clearBtn = document.createElement('button');
		clearBtn.textContent = 'Limpiar';
		clearBtn.style.marginLeft = '12px';
		clearBtn.style.padding = '8px 14px';
		clearBtn.style.cursor = 'pointer';

		const res = document.createElement('div');
		res.id = 'ev-results';
		res.style.marginTop = '8px';

		// Download report anchor
		const download = document.createElement('a');
		download.textContent = 'Descargar informe';
		download.style.marginLeft = '12px';
		download.style.padding = '8px 14px';
		download.style.cursor = 'pointer';
		download.style.display = 'none';
		download.setAttribute('download', 'informe-evaluacion.json');
		let lastUrl = null;

		async function doValidate() {
			try {
				const cfg = window.EV_CONFIG || {};
				if (!cfg.answersUrl) throw new Error('Falta EV_CONFIG.answersUrl');
				const userResponses = collectUserResponses();
				const out = await window.validateEvaluation({
					answersUrl: cfg.answersUrl,
					userResponses,
					root: document
				});
				const { correct, incorrect, unanswered, score, maxScore, percentage } = out.totals || {};
				const pct = (typeof percentage === 'number') ? `${percentage.toFixed(1)}%` : '';
				res.textContent = `Correctas: ${correct} · Incorrectas: ${incorrect} · Sin responder: ${unanswered} · Puntaje: ${score}/${maxScore} (${pct})`;

				// Compute time used
				const now = Date.now();
				let usedMs = null;
				if (timing.mode === 'countdown' && Number.isFinite(timing.totalMs)) {
					const rem = Math.max(0, Number(timing.remainingMs || 0));
					usedMs = Math.min(timing.totalMs, timing.totalMs - rem);
				} else {
					usedMs = Number(timing.elapsedMs || 0);
				}
				function fmt(ms) {
					const totalSec = Math.max(0, Math.floor(Number(ms || 0) / 1000));
					const h = Math.floor(totalSec / 3600);
					const m = Math.floor((totalSec % 3600) / 60);
					const s = totalSec % 60;
					const hh = h > 0 ? String(h).padStart(2, '0') + ':' : '';
					return `${hh}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
				}
				const report = {
					generatedAt: new Date(now).toISOString(),
					course: cfg.course || null,
					brand: cfg.brand || null,
					evaluation: cfg.evalLabel || null,
					module: cfg.module || null,
					timing: {
						mode: timing.mode,
						startedAt: timing.startAt ? new Date(timing.startAt).toISOString() : null,
						endedAt: new Date(now).toISOString(),
						usedMs,
						usedText: fmt(usedMs),
						configuredMinutes: (Number.isFinite(Number(cfg.durationMinutes)) ? Number(cfg.durationMinutes) : null)
					},
					summary: {
						correct, incorrect, unanswered, score, maxScore, percentage
					},
					summaryText: res.textContent,
					userResponses,
					results: out.results || []
				};

				// Prepare downloadable JSON
				try { if (lastUrl) URL.revokeObjectURL(lastUrl); } catch { }
				const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				lastUrl = url;
				const safeModule = String(cfg.module || 'eval');
				const filename = `informe-${safeModule}-${new Date(now).toISOString().replace(/[:.]/g, '-')}.json`;
				download.href = url;
				download.download = filename;
				download.style.display = 'inline-block';
				// Also log it for programmatic captures
				console.log('Reporte de evaluación:', report);
			} catch (err) {
				console.error(err);
				alert('No se pudo validar. Revisa la consola.');
			}
		}

		btn.addEventListener('click', doValidate);
		clearBtn.addEventListener('click', () => {
			document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(i => { i.checked = false; i.disabled = false; });
			document.querySelectorAll('[data-feedback]').forEach(fb => { fb.textContent = ''; fb.classList.remove('ev-feedback-visible'); });
			document.querySelectorAll('[data-question][data-option]').forEach(n => { n.classList.remove('ev-correct', 'ev-incorrect'); });
			res.textContent = '';
			download.style.display = 'none';
		});

		bar.appendChild(timer);
		bar.appendChild(btn);
		bar.appendChild(clearBtn);
		bar.appendChild(download);
		bar.appendChild(res);
		container.appendChild(bar);

		if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
		const cfg = window.EV_CONFIG || {};
		const mins = Number(cfg.durationMinutes);
		if (Number.isFinite(mins) && mins > 0) {
			let remainingMs = Math.round(mins * 60 * 1000);
			timing.mode = 'countdown';
			timing.startAt = Date.now();
			timing.totalMs = remainingMs;
			timing.remainingMs = remainingMs;
			function fmt(ms) {
				const totalSec = Math.max(0, Math.floor(ms / 1000));
				const h = Math.floor(totalSec / 3600);
				const m = Math.floor((totalSec % 3600) / 60);
				const s = totalSec % 60;
				const hh = h > 0 ? String(h).padStart(2, '0') + ':' : '';
				return `${hh}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
			}
			timer.textContent = `Tiempo restante: ${fmt(remainingMs)}`;
			timerInterval = setInterval(async () => {
				remainingMs -= 1000;
				timing.remainingMs = remainingMs;
				timer.textContent = `Tiempo restante: ${fmt(remainingMs)}`;
				if (remainingMs <= 0) {
					clearInterval(timerInterval); timerInterval = null;
					await doValidate();
					document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(i => { i.disabled = true; });
					alert('Tiempo finalizado. Se ha validado automáticamente.');
				}
			}, 1000);
		} else {
			let elapsedMs = 0;
			timing.mode = 'stopwatch';
			timing.startAt = Date.now();
			timing.elapsedMs = 0;
			function fmt(ms) {
				const totalSec = Math.floor(ms / 1000);
				const h = Math.floor(totalSec / 3600);
				const m = Math.floor((totalSec % 3600) / 60);
				const s = totalSec % 60;
				const hh = h > 0 ? String(h).padStart(2, '0') + ':' : '';
				return `${hh}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
			}
			timer.textContent = `Tiempo: ${fmt(elapsedMs)}`;
			timerInterval = setInterval(() => {
				elapsedMs += 1000;
				timing.elapsedMs = elapsedMs;
				timer.textContent = `Tiempo: ${fmt(elapsedMs)}`;
			}, 1000);
		}
	}
	function wireIfReady() {
		const headings = Array.from(document.querySelectorAll('h2, h3'))
			.filter(h => /pregunta\s+\d+/i.test(text(h)));

			console.log(`Found ${headings.length} question headings`);
			
		if (!headings.length) return false;
		for (const h of headings) {
			const m = text(h).match(/pregunta\s+(\d+)/i);
			if (!m) continue;
			const qNum = Number(m[1]);
			const listEl = findNextList(h);
			if (!listEl) continue;
			// Add badge for multi-select questions
			if (isMulti(qNum) && !h.querySelector('.ev-multi-badge')) {
				const badge = document.createElement('small');
				badge.className = 'ev-multi-badge';
				badge.textContent = ' (selección múltiple)';
				badge.style.fontWeight = 'normal';
				badge.style.fontSize = '0.8em';
				h.appendChild(badge);
			}
			listEl.querySelectorAll('input[type="checkbox"],input[type="radio"]').forEach(inp => {
				inp.disabled = false; inp.removeAttribute('disabled'); inp.removeAttribute('aria-disabled'); inp.style.pointerEvents = 'auto'; inp.tabIndex = 0;
			});
			setupQuestionInputs(listEl, qNum);
			ensureFeedback(listEl, qNum);
		}
		const toolbar = document.getElementById('ev-toolbar') || document.body;
		console.log('Autowire validator initialized');
		addValidateUI(toolbar);
		return true;
	}
	function init() {
		if (wireIfReady()) return;
		const obs = new MutationObserver(() => { if (wireIfReady()) { obs.disconnect(); } });
		obs.observe(document.body, { childList: true, subtree: true });
	}
	window.EV_rewire = () => { try { return wireIfReady(); } catch (e) { console.error(e); return false; } };
	if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
