function normalizeAnswers(data) {
	const letters = new Set(['A','B','C','D']);
	const answersMap = new Map();
	const refsMap = new Map();
	const weightsMap = new Map();
	const multiSet = new Set();
	let maxScore = 0;
	for (const q of (data.preguntas ?? [])) {
		const num = Number(q.numero);
		if (Array.isArray(q.respuesta)) {
			const arr = q.respuesta.map(x => String(x).trim().toUpperCase()).filter(x => letters.has(x));
			answersMap.set(num, arr);
			multiSet.add(num);
		} else {
			const val = String(q.respuesta).trim().toUpperCase();
			answersMap.set(num, val);
		}
		refsMap.set(num, Array.isArray(q.referencias) ? q.referencias : []);
		const w = Number(q.peso);
		const peso = Number.isFinite(w) && w > 0 ? w : 1;
		weightsMap.set(num, peso);
		maxScore += peso;
	}
	return { answersMap, refsMap, weightsMap, multiSet, maxScore };
}

function normalizeUserResponses(userResponses) {
	const letters = new Set(['A','B','C','D']);
	const userMap = new Map();
	for (const [k, v] of Object.entries(userResponses || {})) {
		const n = Number(k);
		if (Array.isArray(v)) {
			const arr = v.map(x => String(x).trim().toUpperCase()).filter(x => letters.has(x));
			userMap.set(n, arr);
		} else {
			userMap.set(n, v ? String(v).trim().toUpperCase() : null);
		}
	}
	return userMap;
}

function evaluateAll({ answersMap, refsMap, weightsMap, multiSet }) {
	return (userMap) => {
		const results = [];
		let correct = 0, incorrect = 0, unanswered = 0, score = 0, maxScore = 0;
		for (const [numero, correctAns] of answersMap.entries()) {
			const userAns = userMap.get(numero) ?? null;
			const isMulti = multiSet.has(numero);
			let isCorrect = false;
			if (isMulti) {
				const ua = Array.isArray(userAns) ? [...userAns].sort((a, b) => String(a).localeCompare(String(b))) : [];
				const ca = Array.isArray(correctAns) ? [...correctAns].sort((a, b) => String(a).localeCompare(String(b))) : [];
				isCorrect = ua.length > 0 && ua.length === ca.length && ua.every((x, i) => x === ca[i]);
			} else {
				let ua = null;
				if (Array.isArray(userAns)) { ua = userAns.length ? String(userAns[0]) : null; }
				else { ua = userAns; }
				const isValidChoice = ua && ['A','B','C','D'].includes(ua);
				isCorrect = !!isValidChoice && String(ua) === String(correctAns);
			}
			const peso = weightsMap.get(numero) ?? 1;
			maxScore += peso;

			if (!userAns || (Array.isArray(userAns) && userAns.length === 0)) unanswered++;
			else if (isCorrect) correct++;
			else incorrect++;
			if (isCorrect) score += peso;

			results.push({
				numero,
				correct: !!isCorrect,
				correctAnswer: correctAns,
				userAnswer: userAns,
				referencias: isCorrect ? [] : (refsMap.get(numero) || [])
			});
		}
		return { results, totals: { correct, incorrect, unanswered, score, maxScore, percentage: maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0 } };
	};
}

function renderResults(root, results) {
	injectValidationStyles();
	for (const r of results) {
		const options = root.querySelectorAll(`[data-question="${r.numero}"][data-option]`);
		options.forEach(el => el.classList.remove('ev-correct', 'ev-incorrect'));
		const isMulti = Array.isArray(r.correctAnswer);
		if (!isMulti) {
			const correctEl = root.querySelector(`[data-question="${r.numero}"][data-option="${r.correctAnswer}"]`);
			if (r.correct && correctEl) correctEl.classList.add('ev-correct');
			if (r.userAnswer && r.userAnswer !== r.correctAnswer) {
				const wrongEl = root.querySelector(`[data-question="${r.numero}"][data-option="${r.userAnswer}"]`);
				if (wrongEl) wrongEl.classList.add('ev-incorrect');
			}
		} else if (r.correct && Array.isArray(r.correctAnswer)) {
			for (const opt of r.correctAnswer) {
				const el = root.querySelector(`[data-question="${r.numero}"][data-option="${opt}"]`);
				if (el) el.classList.add('ev-correct');
			}
		} else if (Array.isArray(r.userAnswer)) {
			for (const opt of r.userAnswer) {
				if (!Array.isArray(r.correctAnswer) || !r.correctAnswer.includes(opt)) {
					const el = root.querySelector(`[data-question="${r.numero}"][data-option="${opt}"]`);
					if (el) el.classList.add('ev-incorrect');
				}
			}
		}
		const fb = root.querySelector(`[data-feedback="${r.numero}"]`);
		if (fb) {
			if (!r.correct) {
				const refs = r.referencias?.length ? r.referencias.map(x => `• ${x}`).join('\n') : 'Revisa los materiales del módulo.';
				const correctText = Array.isArray(r.correctAnswer) ? r.correctAnswer.join(', ') : r.correctAnswer;
				fb.textContent = `Respuesta correcta: ${correctText}. Referencias:\n${refs}`;
				fb.classList.add('ev-feedback-visible');
			} else {
				fb.textContent = '';
				fb.classList.remove('ev-feedback-visible');
			}
		}
	}
}

async function validateEvaluation({ answersUrl, userResponses, root = null }) {
	const res = await fetch(answersUrl);
	if (!res.ok) throw new Error(`No se pudo cargar ${answersUrl}: ${res.status}`);
	const data = await res.json();
	const normalized = normalizeAnswers(data);
	const userMap = normalizeUserResponses(userResponses);
	const exec = evaluateAll(normalized);
	const out = exec(userMap);
	if (root) renderResults(root, out.results);
	return out;
}

function injectValidationStyles() {
	const id = 'evaluation-validation-styles';
	if (document.getElementById(id)) return;
	const style = document.createElement('style');
	style.id = id;
	style.textContent = `
		.ev-correct { color: #1b8a2f; font-weight: 600; }
		.ev-incorrect { color: #c62828; font-weight: 600; }
		[data-feedback] { white-space: pre-line; margin-top: 4px; font-size: 0.9rem; }
		.ev-feedback-visible { color: #c62828; }
	`;
	document.head.appendChild(style);
}
