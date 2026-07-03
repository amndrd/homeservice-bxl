/* =============================================
   HOMESERVICE – script.js
   ============================================= */

// Toujours repartir du haut (hero) au chargement/rafraîchissement, même si
// l'URL contient une ancre (#services...) ou si le navigateur a mémorisé
// une position de scroll précédente.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
// Retire l'ancre de l'URL avant que le navigateur n'ait la chance d'y sauter :
// sans ça, Chrome relance un scroll natif vers la cible une fois la mise en
// page finale connue (après le chargement des images), bien après le scrollTo
// ci-dessous, et l'annule.
if (window.location.hash) {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}
window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

// ─────────────────────────────────────────────
// Page Devis
// openDevis()/closeDevis() sont les points d'entrée appelés depuis le HTML
// (boutons "Devis gratuit", croix de fermeture). Ils délèguent à la
// transition animée (sortie du hero ou fondu de la page courante, puis
// vague blanche — cf. initHeroPageTransition plus bas) quand elle est
// disponible ; sinon (prefers-reduced-motion, où cette transition ne
// s'initialise jamais) ils retombent sur un simple affichage/masquage
// instantané de #devisPage.
// ─────────────────────────────────────────────
// Position de scroll au moment de l'ouverture (fallback sans HSDevis
// uniquement, cf. openDevisFallbackOpen) : .devis-page est alors un bloc
// normal du flux, ajouté après #services plutôt qu'un calque plein écran —
// on y saute à l'ouverture et on y revient à la fermeture pour conserver le
// comportement d'un panneau qui s'ouvre/se ferme par-dessus la page.
let devisScrollYBeforeOpen = 0;

function openDevisFallbackOpen() {
  const page = document.getElementById('devisPage');
  devisScrollYBeforeOpen = window.scrollY;
  page.classList.add('is-open');
  document.querySelector('.nav')?.classList.add('nav-devis');
  window.scrollTo({ top: page.offsetTop, behavior: 'auto' });
  triggerDevisProgressGrowIn();
}

// Sur mobile, le devis n'est plus un calque superposé à index.html (cf.
// #services : même raison, il fallait un vrai document pour que Safari
// mobile rétracte sa barre d'adresse) — c'est une page à part, devis.html.
// On rejoue ici la même vague blanche que sur ordinateur (mêmes constantes/
// allure que renderDevisWave dans initHeroPageTransition ci-dessous, qui ne
// s'initialise jamais sur mobile), en une seule fois et sans lien avec le
// scroll cette fois (contrairement à la tentative précédente, qui buggait),
// puis on navigue réellement une fois l'écran entièrement recouvert.
function navigateToDevisMobile(serviceKey) {
  const target = 'devis.html' + (serviceKey ? ('?service=' + encodeURIComponent(serviceKey)) : '');

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.location.href = target;
    return;
  }

  const waveInner = document.getElementById('devisWaveFallInner');
  const wavePath = document.getElementById('devisWavePath');
  if (!waveInner || !wavePath) {
    window.location.href = target;
    return;
  }

  const BASE_Y_START = 1000 - 90;
  const PEAK_Y_START = 1000 - 65;
  const PEAK_X_START = 660;
  const PEAK_X_END = 820;
  // Volontairement très court : deux tours d'essai plus lents (1000ms puis
  // 550ms) ont tous les deux été perçus comme un bouton qui "met du temps à
  // réagir". Un simple flash blanc quasi instantané, plutôt qu'une vraie
  // transition posée, reste un retour visuel suffisant avant de naviguer.
  const DURATION_MS = 120;
  const HOLD_MS = 0;
  // Fraction (temps réel, PAS eased) de DURATION_MS à laquelle l'aplat doit
  // être totalement opaque : volontairement tôt, pour un retour visuel
  // immédiat au clic plutôt que de dépendre de l'easing ralenti en début de
  // course (easeInOutCubic) de la forme SVG.
  const BACKDROP_FULL_AT = 0.4;
  const riseHeightPx = waveInner.clientHeight;

  function buildPath(peakX, baseY, peakY) {
    return `M0,${baseY} Q${peakX},${peakY} 1440,${baseY} L1440,1000 L0,1000 Z`;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // La forme SVG donne le joli bord courbe pendant le balayage, mais son
  // propre remplissage se referme à zéro pile au moment où elle arrive en
  // place (cf. renderDevisWave, plus bas : ça fonctionne là-bas parce que la
  // page qu'elle découvre — le panneau superposé — est déjà blanche
  // elle-même). Ici la destination est une VRAIE navigation, donc rien ne
  // prend automatiquement le relais : on superpose un aplat blanc uni,
  // créé au vol, dont l'opacité monte plus vite que le balayage et reste à 1
  // jusqu'à la navigation — l'écran est garanti entièrement blanc quand on
  // quitte la page, plutôt que de laisser voir le contenu réapparaître
  // dessous pendant que la vague se referme.
  let backdrop = document.getElementById('devisWaveFallBackdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'devisWaveFallBackdrop';
    backdrop.style.position = 'fixed';
    backdrop.style.inset = '0';
    backdrop.style.background = '#fff';
    backdrop.style.zIndex = '51';
    backdrop.style.pointerEvents = 'none';
    document.body.appendChild(backdrop);
  }
  backdrop.style.opacity = '0';

  function render(p) {
    waveInner.style.transform = `translateY(${-(1 - p) * riseHeightPx}px)`;
    const peakX = PEAK_X_START + (PEAK_X_END - PEAK_X_START) * p;
    const baseY = 1000 - (1000 - BASE_Y_START) * (1 - p);
    const peakY = 1000 - (1000 - PEAK_Y_START) * (1 - p);
    wavePath.setAttribute('d', buildPath(peakX, baseY, peakY));
  }

  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / DURATION_MS, 1);
    render(easeInOutCubic(t));
    // Sur le temps réel écoulé (t), pas sur la version eased : easeInOutCubic
    // avance très lentement dans les tout premiers instants, ce qui donnait
    // l'impression que rien ne se passait juste après le clic.
    backdrop.style.opacity = String(Math.min(t / BACKDROP_FULL_AT, 1));
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      setTimeout(() => { window.location.href = target; }, HOLD_MS);
    }
  }
  requestAnimationFrame(step);
}

function openDevis() {
  if (window.matchMedia('(max-width: 768px)').matches) {
    navigateToDevisMobile();
    return;
  }
  document.getElementById('formStep1').style.display = 'block';
  document.getElementById('formSuccess').style.display = 'none';
  document.getElementById('devisPage').classList.remove('is-closing');
  document.getElementById('devisAmbientLight').classList.remove('is-hiding');
  resetDevisQuiz();
  if (window.HSDevis) {
    window.HSDevis.open();
  } else {
    openDevisFallbackOpen();
  }
}

function closeDevis() {
  const page = document.getElementById('devisPage');
  if (page.classList.contains('is-closing')) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doClose = () => {
    page.classList.remove('is-closing');
    if (window.HSDevis) {
      window.HSDevis.close();
    } else {
      page.classList.remove('is-open');
      document.querySelector('.nav')?.classList.remove('nav-devis');
      window.scrollTo({ top: devisScrollYBeforeOpen, behavior: 'auto' });
    }
  };

  if (reduceMotion) {
    doClose();
    return;
  }

  // Séquence de fermeture : les cartes s'envolent et les lumières d'ambiance
  // s'estompent en même temps (cf. .devis-page.is-closing et .is-hiding,
  // styles.css), puis la fermeture réelle démarre (vague blanche qui monte).
  page.classList.add('is-closing');
  document.getElementById('devisAmbientLight').classList.add('is-hiding');
  setTimeout(doClose, 350);
}

// Ouvre le devis avec un service pré-sélectionné (depuis le carrousel).
// Saute la question "Quel service ?" et pose directement les questions
// spécifiques au service choisi.
function openDevisWithService(serviceKey) {
  if (window.matchMedia('(max-width: 768px)').matches) {
    navigateToDevisMobile(serviceKey);
    return;
  }
  document.getElementById('formStep1').style.display = 'block';
  document.getElementById('formSuccess').style.display = 'none';
  document.getElementById('devisPage').classList.remove('is-closing');
  document.getElementById('devisAmbientLight').classList.remove('is-hiding');

  // Pré-sélectionner le service et sauter à l'étape 1
  const svcPresel = SERVICES.find(s => s.key === serviceKey);
  devisAnswers = { serviceKey, service: svcPresel ? svcPresel.label : serviceKey };
  devisSteps = buildSteps(serviceKey);
  devisStepIndex = 1;
  renderInitialDevisStep();

  if (window.HSDevis) {
    window.HSDevis.open();
  } else {
    openDevisFallbackOpen();
  }
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeDevis();
});

// ─────────────────────────────────────────────
// Quiz Devis
// Le formulaire est présenté comme une suite de cartes (une question/étape
// par carte) plutôt qu'un long formulaire. La première carte fait choisir un
// service ; les cartes de configuration qui suivent sont reconstruites
// (buildSteps) en fonction de ce choix, avant les étapes communes (adresse,
// description, coordonnées + envoi). Les réponses vivent dans `answers`,
// rempli au clic (service/choix) ou en live au clavier (inputs/textarea).
// ─────────────────────────────────────────────
const SERVICES = [
  {
    key: 'lavage-voiture', label: 'Lavage voiture', icon: 'ph-car',
    questions: [
      { id: 'vehicule', label: 'Quel type de véhicule ?', options: ['Citadine', 'Berline / Break', 'SUV / 4x4', 'Utilitaire'] },
      { id: 'lieu', label: 'Où souhaitez-vous le lavage ?', options: ['À mon domicile', 'Sur un parking / autre lieu'] }
    ]
  },
  {
    key: 'nettoyage-exterieur', label: 'Entretien extérieur', icon: 'ph-tree',
    questions: [
      { id: 'typeExterieur', label: 'Jardin ou terrasse ?', options: ['Jardin', 'Terrasse'] }
    ]
  },
  {
    key: 'decombrements', label: 'Désencombrement', icon: 'ph-trash',
    questions: [
      { id: 'volume', label: 'Quel volume à évacuer ?', options: ['Quelques objets', 'Une pièce', 'Un logement complet', 'Un local / garage'] },
      { id: 'typeDechets', label: 'Quel type de déchets ?', options: ['Meubles / encombrants', 'Gravats / matériaux', 'Électroménager', 'Mixte'] }
    ]
  },
  {
    key: 'courses-livraison', label: 'Livraison à domicile', icon: 'ph-shopping-cart',
    questions: [
      { id: 'typeCourses', label: 'Quel type de courses ?', options: ['Alimentaire', 'Pharmacie', 'Colis / autre'] }
    ]
  },
  {
    key: 'nettoyage', label: 'Nettoyage intérieur', icon: 'ph-broom',
    questions: [
      { id: 'logement', label: 'Quel type de logement ?', options: ['Appartement', 'Maison', 'Bureau / commerce'] }
    ]
  },
  {
    key: 'montage-bricolage', label: 'Montage', icon: 'ph-wrench',
    questions: [
      { id: 'tache', label: 'Quel type de tâche ?', options: ['Montage de meubles', 'Installation (étagères, luminaires…)', 'Autre'] },
      { id: 'urgence', label: "Quel est le degré d'urgence ?", options: ['Dès que possible', 'Cette semaine', 'Pas urgent'] }
    ]
  },
  {
    key: 'travaux', label: 'Travaux', icon: 'ph-paint-roller',
    questions: [
      { id: 'typeTravaux', label: 'Quel type de travaux ?', options: ['Peinture', 'Réparation', 'Plomberie', 'Électricité', 'Maçonnerie', 'Autre'] },
      { id: 'urgenceTravaux', label: "Quel est le degré d'urgence ?", options: ['Dès que possible', 'Cette semaine', 'Pas urgent'] }
    ]
  }
];

// Suivi conditionnel de la question "Jardin ou terrasse ?" (service
// nettoyage-exterieur) : les questions affichées dépendent de la réponse,
// donc elles ne peuvent pas être listées statiquement dans SERVICES comme
// pour les autres services (cf. injection dans selectChoice ci-dessous).
const NETTOYAGE_EXTERIEUR_FOLLOWUPS = {
  'Terrasse': [
    { id: 'surface', label: 'Quelle est la surface de la terrasse ?', inputType: 'area', serviceContext: 'terrasse' },
    { id: 'materiau', label: 'Quel est le matériau ?', options: ['Carrelage', 'Bois / composite', 'Pierre naturelle', 'Béton'] }
  ],
  'Jardin': [
    { id: 'intervention', label: "Quel type d'intervention ?", options: ['Tonte', 'Taille de haies', 'Désherbage', 'Entretien complet'] },
    { id: 'surfaceJardin', label: 'Quelle est la surface du jardin ?', inputType: 'area', serviceContext: 'jardin' }
  ]
};

let devisSteps = buildSteps(null);
let devisStepIndex = 0;
let devisAnswers = {};

function buildSteps(serviceKey) {
  const steps = [{ type: 'service' }];
  const svc = SERVICES.find(s => s.key === serviceKey);
  if (svc) {
    svc.questions.forEach(q => steps.push({ type: 'choice', question: q }));
  }
  steps.push({ type: 'contact' });
  steps.push({ type: 'address' });
  steps.push({ type: 'date' });
  steps.push({ type: 'description' });
  return steps;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ─────────────────────────────────────────────
// Calendrier de dates (carte "date" du quiz)
// Affiche 4 semaines à la fois (devisCalendarWeekStart = lundi de la
// 1ère semaine visible). Aujourd'hui et les 3 jours suivants sont verrouillés
// (délai d'intervention minimum). Plusieurs dates peuvent être sélectionnées.
// ─────────────────────────────────────────────
const FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const FR_WEEKDAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
const DEVIS_TODAY = startOfDay(new Date());
const DEVIS_LEAD_LIMIT = addDays(DEVIS_TODAY, 3);

let devisCalendarWeekStart = mondayOf(DEVIS_TODAY);
// 'weeks' = grille des 4 semaines à choisir ; 'days' = grille des 7 jours de
// la semaine choisie (devisCalWeekIndex). Le passage de l'une à l'autre est
// animé en glissement (cf. transitionCalendarView), comme entre deux cartes
// du quiz principal.
let devisCalView = 'weeks';
let devisCalWeekIndex = null;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function mondayOf(d) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 = dimanche
  return addDays(x, day === 0 ? -6 : 1 - day);
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoToDate(iso) {
  return new Date(iso + 'T00:00:00');
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDayShort(d) {
  return `${d.getDate()} ${FR_MONTHS[d.getMonth()]}`;
}

function fmtDayChip(d) {
  return `${FR_WEEKDAYS[(d.getDay() + 6) % 7]}. ${d.getDate()} ${FR_MONTHS[d.getMonth()]}`;
}

function getDevisCalendarWeeks() {
  const weeks = [];
  for (let w = 0; w < 4; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(addDays(devisCalendarWeekStart, w * 7 + d));
    }
    weeks.push(week);
  }
  return weeks;
}

function getDevisCalendarLabel(weeks) {
  const first = weeks[0][0];
  const last = weeks[3][6];
  const firstLabel = capitalize(`${FR_MONTHS[first.getMonth()]} ${first.getFullYear()}`);
  const lastLabel = capitalize(`${FR_MONTHS[last.getMonth()]} ${last.getFullYear()}`);
  return firstLabel === lastLabel ? firstLabel : `${firstLabel} – ${lastLabel}`;
}

function renderDateChipsMarkup(dates) {
  if (!dates.length) {
    return '<p class="devis-quiz-hint">Aucune date sélectionnée pour le moment.</p>';
  }
  return `<div class="devis-date-chips">${dates.slice().sort().map(iso => `
    <span class="devis-date-chip">${fmtDayChip(isoToDate(iso))}<button type="button" data-remove-date="${iso}" aria-label="Retirer cette date">✕</button></span>
  `).join('')}</div>`;
}

// Sous-étape "semaines" : une carte par semaine, simple liste à choisir.
function renderCalWeeksPanel(weeks, dates) {
  const cards = weeks.map((week, wIndex) => {
    const countInWeek = week.filter(d => dates.includes(toISODate(d))).length;
    return `
      <button type="button" class="devis-week-card" data-week-index="${wIndex}">
        <span class="devis-week-card-range">Semaine du ${fmtDayShort(week[0])} au ${fmtDayShort(week[6])}</span>
        <span class="devis-week-card-meta">
          ${countInWeek > 0 ? `<span class="devis-week-count">${countInWeek}</span>` : ''}
          <span class="devis-week-card-arrow">→</span>
        </span>
      </button>`;
  }).join('');
  return `<div class="devis-week-list">${cards}</div>`;
}

// Sous-étape "jours" : les 7 jours de la semaine choisie, avec retour.
function renderCalDaysPanel(week, dates) {
  const daysHtml = week.map(d => {
    const iso = toISODate(d);
    const locked = d < DEVIS_TODAY || d <= DEVIS_LEAD_LIMIT;
    const selected = dates.includes(iso);
    let cls = 'devis-day';
    if (locked) cls += ' is-locked';
    if (selected) cls += ' is-selected';
    return `<button type="button" class="${cls}" data-date="${iso}" ${locked ? 'disabled' : ''}>
      <span class="devis-day-weekday">${FR_WEEKDAYS[(d.getDay() + 6) % 7]}</span>
      <span class="devis-day-num">${d.getDate()}</span>
    </button>`;
  }).join('');

  return `
    <div class="devis-cal-days-head">
      <button type="button" class="devis-cal-back" data-cal-back="1">← Semaines</button>
      <span class="devis-cal-days-range">Semaine du ${fmtDayShort(week[0])} au ${fmtDayShort(week[6])}</span>
    </div>
    <div class="devis-week-days-grid">${daysHtml}</div>`;
}

function renderCalSubstageMarkup(weeks, dates) {
  return devisCalView === 'days' && devisCalWeekIndex !== null
    ? renderCalDaysPanel(weeks[devisCalWeekIndex], dates)
    : renderCalWeeksPanel(weeks, dates);
}

// Délai d'animation d'entrée croissant par index : crée l'effet de cascade
// des boutons après l'apparition de la question (cf. .devis-stagger-item,
// styles.css). STAGGER_BASE laisse le temps à l'en-tête de s'afficher avant
// que le premier bouton ne démarre sa propre animation.
const STAGGER_BASE = 0.12;
const STAGGER_STEP = 0.05;

function staggerDelay(i) {
  return (STAGGER_BASE + i * STAGGER_STEP).toFixed(2);
}

// ─────────────────────────────────────────────
// Lumières d'arrière-plan (cf. .devis-ambient-light, styles.css)
// La teinte tourne en douceur (transition CSS sur --devis-hue), et la
// disposition change par fondu croisé entre deux jeux de taches (scene a/b,
// cf. .devis-ambient-scene) : le jeu inactif est repositionné pendant qu'il
// est invisible, puis bascule en actif tandis que l'autre disparaît — donc
// pas de glissement visible, juste une apparition/disparition simultanées.
// Déclenché depuis transitionDevisStep, en même temps que la nouvelle carte
// est construite : la transition (lente) se joue donc pendant l'animation
// d'apparition de la carte plutôt qu'au moment brut du clic.
// ─────────────────────────────────────────────
const DEVIS_HUE_STEP = 47; // pas arbitraire (premier avec 360) pour éviter des teintes qui se répètent trop vite

// Une position par tache (1 à 4), répétées en boucle selon l'étape — chaque
// tache garde toujours la même paire de propriétés (ex. blob 2 = top/right).
const DEVIS_AMBIENT_LAYOUTS = [
  { 1: { top: '6%',  left: '-6%' }, 2: { top: '36%', right: '-10%' }, 3: { bottom: '2%',  left: '16%' }, 4: { top: '40%', left: '34%' } },
  { 1: { top: '42%', left: '30%' }, 2: { top: '4%',  right: '20%'  }, 3: { bottom: '30%', left: '-8%' }, 4: { top: '68%', left: '46%' } },
  { 1: { top: '60%', left: '4%'  }, 2: { top: '58%', right: '-4%'  }, 3: { bottom: '-6%', left: '40%' }, 4: { top: '10%', left: '20%' } },
  { 1: { top: '18%', left: '42%' }, 2: { top: '48%', right: '4%'   }, 3: { bottom: '14%', left: '-4%' }, 4: { top: '52%', left: '8%'  } }
];

let devisAmbientActiveScene = 'a';

function shiftDevisAmbientHue(stepIndex) {
  // Posée sur #devisPage (et non #devisAmbientLight) pour être héritée
  // aussi par les cartes de réponse (cf. .devis-choice:hover, styles.css).
  const page = document.getElementById('devisPage');
  if (!page) return;
  page.style.setProperty('--devis-hue', ((stepIndex * DEVIS_HUE_STEP) % 360) + 'deg');
}

function applyDevisAmbientLayout(sceneEl, layout) {
  Object.keys(layout).forEach(n => {
    const blob = sceneEl.querySelector('.devis-ambient-blob-' + n);
    if (blob) Object.assign(blob.style, layout[n]);
  });
}

// Repositionne le jeu de taches inactif (invisible) puis le bascule en
// actif : son fondu en apparition et le fondu en disparition de l'ancien
// jeu actif sont déclenchés dans le même tick, donc joués en même temps.
function shiftDevisAmbientPosition(stepIndex) {
  const ambient = document.getElementById('devisAmbientLight');
  if (!ambient) return;
  const nextScene = devisAmbientActiveScene === 'a' ? 'b' : 'a';
  const activeEl = ambient.querySelector(`.devis-ambient-scene[data-scene="${devisAmbientActiveScene}"]`);
  const nextEl = ambient.querySelector(`.devis-ambient-scene[data-scene="${nextScene}"]`);
  if (!activeEl || !nextEl) return;
  applyDevisAmbientLayout(nextEl, DEVIS_AMBIENT_LAYOUTS[stepIndex % DEVIS_AMBIENT_LAYOUTS.length]);
  nextEl.classList.add('is-active');
  activeEl.classList.remove('is-active');
  devisAmbientActiveScene = nextScene;
}

// Repart de la scene "a" sans fondu (utilisé à l'ouverture/réinitialisation
// du formulaire, où le fade-in global de .devis-page s'en charge déjà).
function resetDevisAmbientScene() {
  const ambient = document.getElementById('devisAmbientLight');
  if (!ambient) return;
  const sceneA = ambient.querySelector('.devis-ambient-scene[data-scene="a"]');
  const sceneB = ambient.querySelector('.devis-ambient-scene[data-scene="b"]');
  if (sceneA) {
    applyDevisAmbientLayout(sceneA, DEVIS_AMBIENT_LAYOUTS[0]);
    sceneA.classList.add('is-active');
  }
  if (sceneB) sceneB.classList.remove('is-active');
  devisAmbientActiveScene = 'a';
}

function renderStepInner(step) {
  if (step.type === 'service') {
    const options = SERVICES.map((s, i) => `
      <button type="button" class="devis-choice devis-stagger-item" data-service="${s.key}" style="animation-delay:${staggerDelay(i)}s"><i class="ph ${s.icon}" aria-hidden="true"></i>${escapeHtml(s.label)}</button>
    `).join('');
    return `
      <div class="devis-quiz-card-head devis-question-card">
        <span class="devis-quiz-eyebrow">Pour commencer</span>
        <h3>Quel service vous intéresse ?</h3>
        <p class="devis-quiz-hint">Les questions suivantes s'adapteront à votre choix.</p>
      </div>
      <div class="devis-service-list">${options}</div>`;
  }

  if (step.type === 'choice') {
    const q = step.question;
    if (q.inputType === 'area') return renderAreaInputStep(q);
    const options = q.options.map((opt, i) => `
      <button type="button" class="devis-choice devis-stagger-item" data-question="${q.id}" data-value="${escapeHtml(opt)}" style="animation-delay:${staggerDelay(i)}s">${escapeHtml(opt)}</button>
    `).join('');
    return `
      <div class="devis-quiz-card-head devis-question-card">
        <span class="devis-quiz-eyebrow">Configuration</span>
        <h3>${escapeHtml(q.label)}</h3>
      </div>
      <div class="devis-choice-grid">${options}</div>`;
  }

  if (step.type === 'address') {
    const isBelgiumMode = devisAnswers.locationMode === 'belgium';
    return `
      <div class="devis-quiz-card-head">
        <span class="devis-quiz-eyebrow">Localisation</span>
        <h3>Où intervenir ?</h3>
      </div>
      <div class="form-group" id="devisAddressGroupBxl" ${isBelgiumMode ? 'hidden' : ''}>
        <label>Adresse (code postal)</label>
        <input type="text" name="codepostal" placeholder="1030 Bruxelles" value="${escapeHtml(devisAnswers.codepostal || '')}" />
      </div>
      <div class="form-group" id="devisAddressGroupBe" ${isBelgiumMode ? '' : 'hidden'}>
        <label>Votre adresse</label>
        <input type="text" name="adresseLibre" placeholder="Ville, rue, commune…" value="${escapeHtml(devisAnswers.adresseLibre || '')}" />
      </div>
      <button type="button" class="devis-location-toggle" id="devisLocationToggle">${isBelgiumMode ? '← Revenir à la carte de Bruxelles' : "Je ne suis pas à Bruxelles"}</button>

      <div class="devis-map-card">
        <div class="devis-map" id="devisMap"></div>
      </div>

      <div class="devis-distance-note" id="devisDistanceNote" ${isBelgiumMode ? '' : 'hidden'}>
        <i class="ph ph-info" aria-hidden="true"></i>
        <span id="devisDistanceNoteText"></span>
      </div>`;
  }

  if (step.type === 'date') {
    const weeks = getDevisCalendarWeeks();
    const dates = devisAnswers.dates || [];
    const prevDisabled = devisCalendarWeekStart.getTime() <= mondayOf(DEVIS_TODAY).getTime();
    const navHidden = devisCalView === 'days';

    return `
      <div class="devis-quiz-card-head">
        <span class="devis-quiz-eyebrow">Planification</span>
        <h3>Quand souhaitez-vous l'intervention ?</h3>
        <p class="devis-quiz-hint">Choisissez d'abord une semaine, puis les dates qui vous conviennent.</p>
      </div>

      <div class="devis-calendar">
        <div class="devis-calendar-nav" id="devisCalNav" ${navHidden ? 'hidden' : ''}>
          <button type="button" class="devis-calendar-arrow" data-cal-nav="prev" ${prevDisabled ? 'disabled' : ''} aria-label="Semaines précédentes">‹</button>
          <span class="devis-calendar-label">${getDevisCalendarLabel(weeks)}</span>
          <button type="button" class="devis-calendar-arrow" data-cal-nav="next" aria-label="Semaines suivantes">›</button>
        </div>
        <div class="devis-quiz-stage" id="devisCalSubstage"><div class="devis-quiz-card is-active">${renderCalSubstageMarkup(weeks, dates)}</div></div>
      </div>

      <div class="devis-selected-dates">${renderDateChipsMarkup(dates)}</div>`;
  }

  if (step.type === 'description') {
    return `
      <div class="devis-quiz-card-head">
        <span class="devis-quiz-eyebrow">Votre projet</span>
        <h3>Décrivez votre besoin</h3>
        <p class="devis-quiz-hint">Surface, étage, matériel disponible, accès…</p>
      </div>
      <div class="form-group">
        <textarea name="description" rows="6" placeholder="Décrivez votre besoin en quelques lignes…" required>${escapeHtml(devisAnswers.description || '')}</textarea>
      </div>`;
  }

  // step.type === 'contact'
  return `
    <div class="devis-quiz-card-head">
      <span class="devis-quiz-eyebrow">Pour vous recontacter</span>
      <h3>Vos coordonnées</h3>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Prénom</label>
        <input type="text" name="prenom" placeholder="Jean" value="${escapeHtml(devisAnswers.prenom || '')}" required />
      </div>
      <div class="form-group">
        <label>Nom</label>
        <input type="text" name="nom" placeholder="Dupont" value="${escapeHtml(devisAnswers.nom || '')}" required />
      </div>
    </div>
    <div class="form-group">
      <label>Email</label>
      <input type="email" name="email" placeholder="jean@exemple.com" value="${escapeHtml(devisAnswers.email || '')}" required />
    </div>
    <div class="form-group">
      <label>Téléphone</label>
      <input type="tel" name="telephone" placeholder="+32 4xx xx xx xx" value="${escapeHtml(devisAnswers.telephone || '')}" />
    </div>`;
}

function renderAreaInputStep(q) {
  const isJardin = q.serviceContext === 'jardin';
  const uid = q.id;

  const svgBg       = isJardin ? '#e6ebe2' : '#eeecea';
  const fillColor   = isJardin ? '#7aaa6a' : '#aa9678';
  const gridColor   = isJardin ? 'rgba(40,80,30,0.12)' : 'rgba(65,62,55,0.16)';
  const borderColor = isJardin ? 'rgba(60,110,50,0.5)'  : 'rgba(100,82,58,0.55)';
  const tileSize    = isJardin ? 14 : 20;

  const saved = escapeHtml(devisAnswers[uid] || '');

  const refLines = [];
  for (let x = 40; x < 280; x += 40)
    refLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="160" stroke="#666" stroke-width="0.5"/>`);
  for (let y = 40; y < 160; y += 40)
    refLines.push(`<line x1="0" y1="${y}" x2="280" y2="${y}" stroke="#666" stroke-width="0.5"/>`);


  return `
    <div class="devis-quiz-card-head devis-question-card">
      <span class="devis-quiz-eyebrow">Configuration</span>
      <h3>${escapeHtml(q.label)}</h3>
    </div>
    <div class="devis-area-wrap">
      <div class="devis-area-viz devis-stagger-item" style="animation-delay:0.06s">
        <svg class="devis-area-svg" viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <pattern id="areaFill_${uid}" width="${tileSize}" height="${tileSize}" patternUnits="userSpaceOnUse">
              <rect width="${tileSize}" height="${tileSize}" fill="${fillColor}"/>
              <line x1="${tileSize}" y1="0" x2="${tileSize}" y2="${tileSize}" stroke="${gridColor}" stroke-width="1"/>
              <line x1="0" y1="${tileSize}" x2="${tileSize}" y2="${tileSize}" stroke="${gridColor}" stroke-width="1"/>
            </pattern>
            <filter id="areaShadow_${uid}" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="rgba(0,0,0,0.18)"/>
            </filter>
          </defs>
          <rect width="280" height="160" fill="${svgBg}"/>
          <g opacity="0.06">${refLines.join('')}</g>

          <g class="devis-area-scaled-group" filter="url(#areaShadow_${uid})">
            <rect x="20" y="15" width="240" height="130" rx="5" fill="url(#areaFill_${uid})"/>
            <rect x="20" y="15" width="240" height="130" rx="5" fill="none" stroke="${borderColor}" stroke-width="1.8"/>
            <g class="devis-area-flowers"></g>
          </g>

          <text class="devis-area-svg-label" x="140" y="77"
                text-anchor="middle" dominant-baseline="middle"
                font-family="var(--font-body)" font-size="13" font-weight="700"
                fill="rgba(0,0,0,0.5)">Entrez une surface</text>
          <text class="devis-area-svg-dim" x="140" y="95"
                text-anchor="middle" dominant-baseline="middle"
                font-family="var(--font-body)" font-size="10" font-weight="500"
                fill="rgba(0,0,0,0.38)" opacity="0"></text>
        </svg>
      </div>
      <div class="devis-area-field devis-stagger-item" style="animation-delay:0.12s">
        <div class="devis-area-input-row">
          <input type="number" class="devis-area-input" name="${uid}"
                 placeholder="0" min="1" max="99999" inputmode="numeric"
                 value="${saved}" autocomplete="off">
          <span class="devis-area-unit">m²</span>
        </div>
      </div>
    </div>`;
}

function buildStepCard(index) {
  const step = devisSteps[index];
  const isOptionsStep = step.type === 'service' || step.type === 'choice';
  const card = document.createElement('div');
  card.className = (isOptionsStep ? 'devis-quiz-card-split' : 'devis-card-group') + ' devis-quiz-card';
  card.innerHTML = renderStepInner(step);

  if (step.type === 'service') {
    card.querySelectorAll('[data-service]').forEach(btn => {
      btn.addEventListener('click', () => selectService(btn.dataset.service));
    });
  } else if (step.type === 'choice' && step.question.inputType === 'area') {
    const input = card.querySelector('.devis-area-input');
    if (input) {
      requestAnimationFrame(() => {
        updateAreaVisualization(card, parseFloat(devisAnswers[step.question.id] || '0'), step.question.serviceContext);
      });
      input.addEventListener('input', () => {
        devisAnswers[step.question.id] = input.value;
        updateDevisNav();
        updateAreaVisualization(card, parseFloat(input.value), step.question.serviceContext);
      });
    }
  } else if (step.type === 'choice') {
    card.querySelectorAll('.devis-choice').forEach(btn => {
      btn.addEventListener('click', () => selectChoice(step.question.id, btn.dataset.value, card));
    });
  } else if (step.type === 'date') {
    bindDateCardEvents(card);
  } else if (step.type === 'address') {
    const codeInput = card.querySelector('input[name="codepostal"]');
    const addrInput = card.querySelector('input[name="adresseLibre"]');
    codeInput.addEventListener('input', () => {
      devisAnswers.codepostal = codeInput.value;
      updateDevisNav();
      updateDevisMapZone(card, codeInput.value);
    });
    addrInput.addEventListener('input', () => {
      devisAnswers.adresseLibre = addrInput.value;
      devisAnswers.adresseLatLon = null;
      updateDevisNav();
      scheduleDevisGeocode(card, addrInput.value);
    });
    card.querySelector('#devisLocationToggle').addEventListener('click', () => {
      setDevisLocationMode(card, devisAnswers.locationMode === 'belgium' ? 'brussels' : 'belgium');
    });
    // Différé : à cet instant `card` n'est encore qu'un noeud en mémoire (pas
    // encore inséré par transitionDevisStep), donc sa taille est nulle et
    // Leaflet calculerait des bornes invalides s'il s'initialisait tout de
    // suite. Le rAF laisse le temps à l'appendChild de se produire.
    requestAnimationFrame(() => {
      initDevisMap(card);
      setDevisLocationMode(card, devisAnswers.locationMode || 'brussels');
    });
  } else {
    card.querySelectorAll('input, textarea').forEach(field => {
      field.addEventListener('input', () => {
        devisAnswers[field.name] = field.value;
        updateDevisNav();
      });
    });
  }

  return card;
}

// Carte Bruxelles (étape "address") : au repos, seule la silhouette globale
// de la région est visible (BRUSSELS_REGION_OUTLINE_GEOJSON). La saisie d'un
// code postal fait apparaître par-dessus la commune correspondante en rouge
// (BRUSSELS_COMMUNES_GEOJSON / BRUSSELS_POSTAL_TO_NIS, cf. brussels-map-data.js),
// avec son nom en blanc ancré à son centre, et la carte zoome dessus en
// douceur ; vider le champ dézoome et fait disparaître nom + zone en fondu.
// Carte non interactive (zoom/drag désactivés) : repère visuel, pas un widget
// à explorer.
const DEVIS_MAP_OUTLINE_STYLE = {
  color: '#2D6A2D',
  weight: 1.75,
  fillColor: '#5A9A3A',
  fillOpacity: 0.07,
  interactive: false,
};
// Vue Belgique entière : Bruxelles n'occupe plus qu'une toute petite portion
// de la carte, le remplissage discret utilisé en vue rapprochée (0.07) y
// deviendrait quasi invisible. On renforce donc le contraste pour que la
// zone reste clairement identifiable au milieu du pays (cf. setDevisLocationMode).
const DEVIS_MAP_OUTLINE_STYLE_BELGIUM = {
  color: '#2D6A2D',
  weight: 2,
  fillColor: '#5A9A3A',
  fillOpacity: 0.45,
  interactive: false,
};
const DEVIS_MAP_ACTIVE_STYLE = {
  color: '#B3211E',
  weight: 2.5,
  fillColor: '#E5484D',
  fillOpacity: 0.55,
  interactive: false,
};

function initDevisMap(card) {
  const container = card.querySelector('#devisMap');
  if (!container || typeof L === 'undefined') return;

  const map = L.map(container, {
    zoomControl: false,
    attributionControl: true,
    scrollWheelZoom: false,
    dragging: false,
    doubleClickZoom: false,
    boxZoom: false,
    touchZoom: false,
    keyboard: false,
  });
  card.__devisMap = map;

  const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '© OpenStreetMap, © CARTO',
  }).addTo(map);

  const outlineLayer = L.geoJSON(BRUSSELS_REGION_OUTLINE_GEOJSON, {
    style: DEVIS_MAP_OUTLINE_STYLE,
  }).addTo(map);
  card.__devisOutlineLayer = outlineLayer;

  map.fitBounds(outlineLayer.getBounds(), { padding: [8, 8] });
  requestAnimationFrame(() => map.invalidateSize());

  // Le fond ne s'affiche qu'une fois les tuiles chargées, pour éviter de
  // montrer la carte à moitié peinte ("que tout soit bien chargé").
  const reveal = () => card.querySelector('.devis-map-card').classList.add('is-ready');
  tiles.once('load', reveal);
  setTimeout(reveal, 2500); // garde-fou si l'évènement 'load' ne se déclenche pas
}

// Leaflet positionne le marqueur en posant lui-même un `transform:
// translate3d(...)` inline sur l'élément racine du divIcon — un transform CSS
// posé sur ce même élément via une classe serait silencieusement écrasé (les
// deux ne peuvent pas coexister sur la même propriété). Le centrage doit donc
// se faire sur un enfant interne, jamais touché par Leaflet.
function devisLabelIconHtml(name) {
  return `<span class="devis-map-label-inner">${escapeHtml(name)}</span>`;
}

function showDevisMapLabel(card, name, latlng, opts = {}) {
  const map = card.__devisMap;
  // Vue Belgique entière (opts.offset) : la zone visée (Bruxelles ou la
  // commune/ville trouvée) est minuscule à cette échelle, un nom centré
  // dessus la recouvrirait complètement. On le décale donc au-dessus, pour
  // que la zone colorée reste visible en dessous (cf. .devis-map-label-icon--offset).
  const className = `devis-map-label-icon${opts.offset ? ' devis-map-label-icon--offset' : ''}`;
  const applyAndFadeIn = () => {
    const icon = L.divIcon({ className, html: devisLabelIconHtml(name), iconSize: [0, 0], iconAnchor: [0, 0] });
    if (!card.__devisLabelMarker) {
      card.__devisLabelMarker = L.marker(latlng, { icon, interactive: false, keyboard: false }).addTo(map);
    } else {
      card.__devisLabelMarker.setLatLng(latlng);
      card.__devisLabelMarker.setIcon(icon);
    }
    requestAnimationFrame(() => {
      const el = card.__devisLabelMarker.getElement();
      const inner = el && el.querySelector('.devis-map-label-inner');
      if (inner) inner.classList.add('is-visible');
    });
  };

  const el = card.__devisLabelMarker && card.__devisLabelMarker.getElement();
  const currentInner = el && el.querySelector('.devis-map-label-inner');
  if (currentInner && currentInner.classList.contains('is-visible')) {
    // Une commune était déjà affichée : on la fait disparaître avant de
    // repositionner/renommer le label, pour éviter qu'il ne traverse la carte.
    currentInner.classList.remove('is-visible');
    setTimeout(applyAndFadeIn, 220);
  } else {
    applyAndFadeIn();
  }
}

function hideDevisMapLabel(card) {
  const el = card.__devisLabelMarker && card.__devisLabelMarker.getElement();
  const inner = el && el.querySelector('.devis-map-label-inner');
  if (inner) inner.classList.remove('is-visible');
}

function updateDevisMapZone(card, rawValue) {
  const map = card.__devisMap;
  const outlineLayer = card.__devisOutlineLayer;
  if (!map || !outlineLayer) return;

  const match = (rawValue || '').match(/\d{4}/);
  const code = match ? match[0] : '';
  const nis = code ? BRUSSELS_POSTAL_TO_NIS[code] : null;
  const feature = nis ? BRUSSELS_COMMUNES_GEOJSON.features.find(f => f.properties.nis === nis) : null;

  if (feature) {
    if (card.__devisActiveNis !== nis) {
      if (card.__devisActiveLayer) map.removeLayer(card.__devisActiveLayer);
      const zoneLayer = L.geoJSON(feature, { style: DEVIS_MAP_ACTIVE_STYLE }).addTo(map);
      zoneLayer.eachLayer(lyr => { if (lyr._path) lyr._path.classList.add('devis-map-zone-active'); });
      card.__devisActiveLayer = zoneLayer;
      card.__devisActiveNis = nis;

      map.flyToBounds(zoneLayer.getBounds(), { padding: [28, 28], maxZoom: 13, duration: 0.75 });
      showDevisMapLabel(card, feature.properties.name_fr, [feature.properties.label_lat, feature.properties.label_lon]);
    }
  } else if (card.__devisActiveNis) {
    map.removeLayer(card.__devisActiveLayer);
    card.__devisActiveLayer = null;
    card.__devisActiveNis = null;
    hideDevisMapLabel(card);
    map.flyToBounds(outlineLayer.getBounds(), { padding: [10, 10], duration: 0.75 });
  }
}

// ─────────────────────────────────────────────
// Mode "hors Bruxelles" (bouton devisLocationToggle) : la même carte Leaflet
// est réutilisée (juste recadrée) plutôt que d'en recréer une. Le passage
// d'une vue à l'autre se fait en deux temps (cf. setDevisMapExpanded) :
// d'abord la carte s'agrandit (transition CSS sur sa hauteur), puis une fois
// la nouvelle taille connue de Leaflet, la vue zoome/dézoome vers son nouveau
// cadrage. L'adresse libre est géocodée via Nominatim (OpenStreetMap, gratuit
// mais à usage modéré : 1 req/s max, donc debounce de 700 ms côté champ), en
// demandant aussi le contour (polygon_geojson) : si le résultat est une
// ville/commune, sa zone réelle est affichée en rouge (comme pour les
// communes de Bruxelles) plutôt qu'un simple point.
// ─────────────────────────────────────────────
const BRUSSELS_CENTER = [50.8466, 4.3528]; // Grand-Place, repère fixe pour le calcul de distance
const BELGIUM_BOUNDS = [[49.49, 2.51], [51.51, 6.41]];
const DEVIS_GEOCODE_DEBOUNCE_MS = 700;
const DEVIS_MAP_EXPAND_MS = 600;
const DEVIS_ZONE_ADDRESS_TYPES = ['city', 'town', 'village', 'municipality', 'suburb', 'administrative', 'county', 'state', 'hamlet'];

let devisGeocodeTimer = null;
let devisGeocodeAbort = null;

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Géométrie utilitaire : pour que le tracé "rejoigne" une zone plutôt que
// de partir d'un point en son centre, on cherche où le segment centre→cible
// sort du polygone, et on dessine la ligne entre ces points de sortie plutôt
// qu'entre les centres. Tout est fait en lat/lng traités comme plan : à
// l'échelle de la Belgique l'approximation est invisible et largement
// suffisante pour un tracé illustratif.
function devisSegmentIntersection(p1, p2, p3, p4) {
  const [x1, y1] = p1, [x2, y2] = p2, [x3, y3] = p3, [x4, y4] = p4;
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(d) < 1e-12) return null;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

function devisPolygonRingsLatLng(geom) {
  const rings = [];
  const collect = poly => poly.forEach(ring => rings.push(ring.map(([lon, lat]) => [lat, lon])));
  if (geom.type === 'Polygon') collect(geom.coordinates);
  else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(collect);
  return rings;
}

function devisFindExitPoint(rings, fromInside, toward) {
  let closest = null;
  let closestDist = Infinity;
  rings.forEach(ring => {
    for (let i = 0; i < ring.length - 1; i++) {
      const inter = devisSegmentIntersection(fromInside, toward, ring[i], ring[i + 1]);
      if (inter) {
        const dist = Math.hypot(inter[0] - fromInside[0], inter[1] - fromInside[1]);
        if (dist < closestDist) { closestDist = dist; closest = inter; }
      }
    }
  });
  return closest || fromInside;
}

function devisPointInRing(point, ring) {
  let inside = false;
  const [x, y] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function devisIsInsideBrussels(latlng) {
  const rings = devisPolygonRingsLatLng(BRUSSELS_REGION_OUTLINE_GEOJSON.features[0].geometry);
  return rings.some(ring => devisPointInRing(latlng, ring));
}

function devisPinIcon(label, modifierClass) {
  return L.divIcon({
    className: `devis-map-pin ${modifierClass}`,
    // cf. devisLabelIconHtml plus haut : le centrage doit se faire sur un
    // enfant interne (.devis-map-pin-inner), jamais sur la racine du divIcon.
    html: `<span class="devis-map-pin-inner"><span class="devis-map-pin-label">${escapeHtml(label)}</span><span class="devis-map-pin-dot"></span></span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function showDevisBrusselsMarker(card) {
  const map = card.__devisMap;
  if (card.__devisBxlMarker) return;
  // Même style que les noms de commune (texte blanc, sans repère/point) plutôt
  // qu'un pin avec pastille, pour rester cohérent avec les autres noms de
  // ville affichés sur la carte (cf. devisLabelIconHtml plus haut). Décalé
  // au-dessus (--offset) : à l'échelle de la Belgique entière, la zone de
  // Bruxelles est trop petite pour qu'un nom centré dessus ne la recouvre pas.
  card.__devisBxlMarker = L.marker(BRUSSELS_CENTER, {
    icon: L.divIcon({ className: 'devis-map-label-icon devis-map-label-icon--offset', html: devisLabelIconHtml('Bruxelles'), iconSize: [0, 0], iconAnchor: [0, 0] }),
    interactive: false,
    keyboard: false,
  }).addTo(map);
  requestAnimationFrame(() => {
    const el = card.__devisBxlMarker.getElement();
    const inner = el && el.querySelector('.devis-map-label-inner');
    if (inner) inner.classList.add('is-visible');
  });
}

function hideDevisBrusselsMarker(card) {
  if (!card.__devisBxlMarker) return;
  card.__devisMap.removeLayer(card.__devisBxlMarker);
  card.__devisBxlMarker = null;
}

// Notification sous la carte : n'existe que pour annoncer le résultat d'une
// recherche (distance ou "c'est déjà Bruxelles"), jamais affichée par défaut.
function showDevisNotice(card, html) {
  const note = card.querySelector('#devisDistanceNote');
  if (!note) return;
  clearTimeout(card.__devisNoticeHideTimer);
  note.querySelector('#devisDistanceNoteText').innerHTML = html;
  note.hidden = false;
  requestAnimationFrame(() => note.classList.add('is-visible'));
}

function hideDevisNotice(card) {
  const note = card.querySelector('#devisDistanceNote');
  if (!note) return;
  note.classList.remove('is-visible');
  clearTimeout(card.__devisNoticeHideTimer);
  card.__devisNoticeHideTimer = setTimeout(() => { note.hidden = true; }, 400);
}

function showDevisDistanceNotice(card, km) {
  showDevisNotice(card, `Nous intervenons principalement à Bruxelles. Votre adresse se trouve à environ <strong>${km} km</strong> de Bruxelles : un supplément de déplacement sera ajouté à votre devis en fonction de cette distance.`);
}

function showDevisInBrusselsNotice(card) {
  showDevisNotice(card, `Cette adresse se trouve à Bruxelles ! Vous pouvez <button type="button" class="devis-notice-action" id="devisNoticeBackBtn">revenir à la carte de Bruxelles</button> pour plus de précision.`);
  const btn = card.querySelector('#devisNoticeBackBtn');
  if (btn) btn.addEventListener('click', () => setDevisLocationMode(card, 'brussels'));
}

// Retire marqueur/zone/ligne de la recherche libre, sans toucher à la vue
// (utilisé aussi bien avant de redessiner un nouveau résultat qu'en sortant
// du mode Belgique).
function clearDevisFreeMarkersOnly(card) {
  const map = card.__devisMap;
  if (card.__devisFreeMarker) { map.removeLayer(card.__devisFreeMarker); card.__devisFreeMarker = null; }
  if (card.__devisFreeZoneLayer) { map.removeLayer(card.__devisFreeZoneLayer); card.__devisFreeZoneLayer = null; }
  if (card.__devisDistanceLine) { map.removeLayer(card.__devisDistanceLine); card.__devisDistanceLine = null; }
  hideDevisMapLabel(card);
}

function showDevisFreeLocation(card, lat, lon, result) {
  const map = card.__devisMap;
  if (!map) return;
  clearDevisFreeMarkersOnly(card);

  const label = (result.display_name || '').split(',')[0];
  const isZone = result.geojson
    && (result.geojson.type === 'Polygon' || result.geojson.type === 'MultiPolygon')
    && DEVIS_ZONE_ADDRESS_TYPES.includes(result.addresstype || result.type);

  let destRef;
  let destRings = null;
  let destBounds;

  if (isZone) {
    const zoneLayer = L.geoJSON(result.geojson, { style: DEVIS_MAP_ACTIVE_STYLE }).addTo(map);
    zoneLayer.eachLayer(lyr => { if (lyr._path) lyr._path.classList.add('devis-map-zone-active'); });
    card.__devisFreeZoneLayer = zoneLayer;
    const center = zoneLayer.getBounds().getCenter();
    destRef = [center.lat, center.lng];
    destRings = devisPolygonRingsLatLng(result.geojson);
    destBounds = zoneLayer.getBounds();
    showDevisMapLabel(card, label, destRef, { offset: true });
  } else {
    destRef = [lat, lon];
    destBounds = L.latLngBounds([destRef, destRef]);
    card.__devisFreeMarker = L.marker(destRef, {
      icon: devisPinIcon(label, 'devis-map-pin--dest'),
      interactive: false,
      keyboard: false,
    }).addTo(map);
    requestAnimationFrame(() => {
      const el = card.__devisFreeMarker.getElement();
      const inner = el && el.querySelector('.devis-map-pin-inner');
      if (inner) inner.classList.add('is-visible');
    });
  }

  if (devisIsInsideBrussels(destRef)) {
    devisAnswers.distanceKm = null;
    showDevisInBrusselsNotice(card);
    map.flyToBounds(destBounds.pad(0.3), { padding: [40, 40], maxZoom: 14, duration: 0.9 });
    return;
  }

  const bxlRings = devisPolygonRingsLatLng(BRUSSELS_REGION_OUTLINE_GEOJSON.features[0].geometry);
  const bxlExit = devisFindExitPoint(bxlRings, BRUSSELS_CENTER, destRef);
  const destExit = destRings ? devisFindExitPoint(destRings, destRef, BRUSSELS_CENTER) : destRef;

  card.__devisDistanceLine = L.polyline([bxlExit, destExit], {
    className: 'devis-distance-line',
    color: '#4274D9',
    weight: 2.5,
    opacity: 0.85,
    interactive: false,
  }).addTo(map);

  const km = Math.round(haversineKm(BRUSSELS_CENTER[0], BRUSSELS_CENTER[1], destRef[0], destRef[1]));
  devisAnswers.distanceKm = km;
  showDevisDistanceNotice(card, km);

  map.flyToBounds(destBounds.extend(BRUSSELS_CENTER), { padding: [48, 48], maxZoom: 12, duration: 0.9 });
}

function clearDevisFreeLocation(card) {
  clearDevisFreeMarkersOnly(card);
  devisAnswers.distanceKm = null;
  hideDevisNotice(card);
  const map = card.__devisMap;
  if (map && devisAnswers.locationMode === 'belgium') {
    map.flyToBounds(BELGIUM_BOUNDS, { padding: [10, 10], duration: 0.9 });
  }
}

async function geocodeDevisAddress(card, query) {
  if (devisGeocodeAbort) devisGeocodeAbort.abort();
  devisGeocodeAbort = new AbortController();
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=be&addressdetails=1&polygon_geojson=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: devisGeocodeAbort.signal, headers: { 'Accept-Language': 'fr' } });
    const results = await res.json();
    if (!results.length || devisAnswers.adresseLibre !== query) return;
    const r = results[0];
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    devisAnswers.adresseLatLon = [lat, lon];
    devisAnswers.adresseLabel = r.display_name;
    devisAnswers.adresseResult = {
      lat, lon,
      display_name: r.display_name,
      geojson: r.geojson || null,
      addresstype: r.addresstype || r.type || null,
    };
    showDevisFreeLocation(card, lat, lon, devisAnswers.adresseResult);
  } catch (err) {
    if (err.name !== 'AbortError') console.error('Géocodage impossible :', err);
  }
}

function scheduleDevisGeocode(card, query) {
  clearTimeout(devisGeocodeTimer);
  const trimmed = query.trim();
  if (trimmed.length < 4) {
    devisAnswers.adresseResult = null;
    clearDevisFreeLocation(card);
    return;
  }
  devisGeocodeTimer = setTimeout(() => geocodeDevisAddress(card, trimmed), DEVIS_GEOCODE_DEBOUNCE_MS);
}

// Agrandit/réduit le conteneur de la carte (transition CSS sur sa hauteur),
// puis ne déclenche `onDone` (typiquement un flyToBounds) qu'une fois
// Leaflet informé de sa nouvelle taille — sinon le zoom/pan calculé porterait
// sur l'ancien cadrage. Si la taille cible est déjà la taille courante (ex.
// premier rendu de la carte), on saute directement à `onDone` sans attendre
// une transition qui ne se déclenchera pas.
function setDevisMapExpanded(card, expanded, onDone) {
  const mapCard = card.querySelector('.devis-map-card');
  const alreadyThere = mapCard.classList.contains('is-belgium') === expanded;
  mapCard.classList.toggle('is-belgium', expanded);

  const finish = () => {
    card.__devisMap.invalidateSize({ pan: false });
    if (onDone) onDone();
  };

  if (alreadyThere) { finish(); return; }

  let done = false;
  const guardedFinish = () => { if (done) return; done = true; finish(); };
  card.querySelector('.devis-map').addEventListener('transitionend', guardedFinish, { once: true });
  setTimeout(guardedFinish, DEVIS_MAP_EXPAND_MS + 80);
}

function setDevisLocationMode(card, mode) {
  devisAnswers.locationMode = mode;
  const map = card.__devisMap;
  const bxlGroup = card.querySelector('#devisAddressGroupBxl');
  const beGroup = card.querySelector('#devisAddressGroupBe');
  const toggleBtn = card.querySelector('#devisLocationToggle');
  if (!map) return;

  hideDevisNotice(card);

  if (mode === 'belgium') {
    bxlGroup.hidden = true;
    beGroup.hidden = false;
    toggleBtn.textContent = '← Revenir à la carte de Bruxelles';

    if (card.__devisActiveLayer) { map.removeLayer(card.__devisActiveLayer); card.__devisActiveLayer = null; card.__devisActiveNis = null; }
    hideDevisMapLabel(card);
    showDevisBrusselsMarker(card);
    card.__devisOutlineLayer.setStyle(DEVIS_MAP_OUTLINE_STYLE_BELGIUM);

    setDevisMapExpanded(card, true, () => {
      if (devisAnswers.adresseResult) {
        showDevisFreeLocation(card, devisAnswers.adresseResult.lat, devisAnswers.adresseResult.lon, devisAnswers.adresseResult);
      } else {
        map.flyToBounds(BELGIUM_BOUNDS, { padding: [10, 10], duration: 0.9 });
      }
    });
  } else {
    bxlGroup.hidden = false;
    beGroup.hidden = true;
    toggleBtn.textContent = 'Je ne suis pas à Bruxelles';

    hideDevisBrusselsMarker(card);
    clearDevisFreeMarkersOnly(card);
    card.__devisOutlineLayer.setStyle(DEVIS_MAP_OUTLINE_STYLE);

    setDevisMapExpanded(card, false, () => {
      map.flyToBounds(card.__devisOutlineLayer.getBounds(), { padding: [8, 8], duration: 0.9 });
      updateDevisMapZone(card, devisAnswers.codepostal || '');
    });
  }
}

// La carte "date" contient elle-même un mini-stage (#devisCalSubstage) qui
// glisse entre deux sous-étapes : choix de la semaine, puis choix des jours
// de cette semaine (même mécanique d'animation que transitionDevisStep, mais
// imbriquée et sans toucher à la progression du quiz). La navigation
// calendrier régénère toute la carte (l'ensemble des jours affichés
// change) ; le choix d'une semaine, le retour, et la sélection d'un jour ne
// touchent que le sous-stage ou les chips.
function bindDateCardEvents(card) {
  card.querySelectorAll('[data-cal-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      devisCalendarWeekStart = addDays(devisCalendarWeekStart, btn.dataset.calNav === 'next' ? 28 : -28);
      refreshDateCard();
    });
  });

  bindDateChipEvents(card);

  const substage = card.querySelector('#devisCalSubstage');
  const currentPanel = substage && substage.querySelector('.devis-quiz-card');
  if (currentPanel) bindCalPanelEvents(card, currentPanel);
}

function bindCalPanelEvents(card, panel) {
  panel.querySelectorAll('.devis-week-card').forEach(btn => {
    btn.addEventListener('click', () => {
      devisCalWeekIndex = Number(btn.dataset.weekIndex);
      devisCalView = 'days';
      const nav = card.querySelector('#devisCalNav');
      if (nav) nav.hidden = true;
      transitionCalendarView(card, 'forward');
    });
  });

  panel.querySelectorAll('[data-cal-back]').forEach(btn => {
    btn.addEventListener('click', () => {
      devisCalView = 'weeks';
      const nav = card.querySelector('#devisCalNav');
      if (nav) nav.hidden = false;
      transitionCalendarView(card, 'back');
    });
  });

  panel.querySelectorAll('.devis-day').forEach(btn => {
    btn.addEventListener('click', () => {
      const iso = btn.dataset.date;
      const dates = devisAnswers.dates || (devisAnswers.dates = []);
      const pos = dates.indexOf(iso);
      if (pos === -1) dates.push(iso); else dates.splice(pos, 1);
      btn.classList.toggle('is-selected', pos === -1);
      card.querySelector('.devis-selected-dates').innerHTML = renderDateChipsMarkup(dates);
      bindDateChipEvents(card);
    });
  });
}

// Anime le passage semaines ↔ jours à l'intérieur de la carte "date", sur le
// même principe que transitionDevisStep (sortie/entrée superposées + hauteur
// du sous-stage tweenée), mais sans avancer dans le quiz.
function transitionCalendarView(card, direction) {
  const substage = card.querySelector('#devisCalSubstage');
  const oldPanel = substage.querySelector('.devis-quiz-card');
  const weeks = getDevisCalendarWeeks();
  const dates = devisAnswers.dates || [];
  const newPanel = document.createElement('div');
  newPanel.className = 'devis-quiz-card';
  newPanel.innerHTML = renderCalSubstageMarkup(weeks, dates);

  if (oldPanel) {
    substage.classList.add('is-transitioning');
    substage.style.height = oldPanel.offsetHeight + 'px';
    oldPanel.classList.add('is-animating');
    newPanel.classList.add('is-animating');
    if (direction === 'back') newPanel.classList.add('from-left');
    substage.appendChild(newPanel);
    const newHeight = newPanel.offsetHeight;

    requestAnimationFrame(() => {
      substage.style.height = newHeight + 'px';
      newPanel.classList.remove('from-left');
      newPanel.classList.add('is-active');
      oldPanel.classList.remove('is-active');
      oldPanel.classList.add(direction === 'back' ? 'exit-right' : 'exit-left');
    });

    setTimeout(() => {
      oldPanel.remove();
      newPanel.classList.remove('is-animating');
      substage.style.height = '';
      substage.classList.remove('is-transitioning');
    }, 440);
  } else {
    substage.appendChild(newPanel);
    requestAnimationFrame(() => newPanel.classList.add('is-active'));
  }

  bindCalPanelEvents(card, newPanel);
}

function bindDateChipEvents(card) {
  card.querySelectorAll('[data-remove-date]').forEach(btn => {
    btn.addEventListener('click', () => {
      const iso = btn.dataset.removeDate;
      devisAnswers.dates = (devisAnswers.dates || []).filter(d => d !== iso);

      const dayBtn = card.querySelector(`.devis-day[data-date="${iso}"]`);
      if (dayBtn) dayBtn.classList.remove('is-selected');

      card.querySelector('.devis-selected-dates').innerHTML = renderDateChipsMarkup(devisAnswers.dates);
      bindDateChipEvents(card);
    });
  });
}

// Regénère entièrement la carte "date" (navigation calendrier, bascule
// urgence) : contrairement au clic sur un jour ou sur une semaine, l'ensemble
// des jours affichés/verrouillés change, une simple mutation ciblée du DOM
// ne suffit plus.
function refreshDateCard() {
  const stage = document.getElementById('devisQuizStage');
  const card = stage.querySelector('.devis-quiz-card.is-active');
  if (!card) return;
  card.innerHTML = renderStepInner(devisSteps[devisStepIndex]);
  bindDateCardEvents(card);
}

function selectService(key) {
  const stage = document.getElementById('devisQuizStage');
  stage.querySelectorAll('[data-service]').forEach(b => {
    b.classList.toggle('is-selected', b.dataset.service === key);
  });
  setTimeout(() => {
    devisAnswers.serviceKey = key;
    devisAnswers.service = SERVICES.find(s => s.key === key).label;
    devisSteps = buildSteps(key);
    goDevisNext();
  }, 240);
}

function selectChoice(questionId, value, card) {
  devisAnswers[questionId] = value;
  card.querySelectorAll('.devis-choice').forEach(b => {
    b.classList.toggle('is-selected', b.dataset.value === value);
  });
  if (questionId === 'typeExterieur') {
    devisSteps = devisSteps.filter(s => !s.isExterieurFollowup);
    const followups = NETTOYAGE_EXTERIEUR_FOLLOWUPS[value] || [];
    const newSteps = followups.map(q => ({ type: 'choice', question: q, isExterieurFollowup: true }));
    devisSteps.splice(devisStepIndex + 1, 0, ...newSteps);
  }
  setTimeout(() => goDevisNext(), 240);
}

const FLOWER_PALETTES = [
  {p:'#ff9dc2',c:'#ffd54f'}, {p:'#f8f8f8',c:'#ffe082'},
  {p:'#ce93d8',c:'#fff176'}, {p:'#ffcc80',c:'#ef5350'},
  {p:'#b2f5a0',c:'#ffd740'}, {p:'#f48fb1',c:'#fff59d'},
  {p:'#80cbc4',c:'#ffcc02'}, {p:'#ffe082',c:'#ef9a9a'},
];
const FLOWER_BASE_R = 10;

function _lcgFloat(seed) {
  const s = (Math.imul(seed, 1664525) + 1013904223) | 0;
  return (s >>> 0) / 4294967295;
}

function getFlowerPos(idx) {
  const rx = _lcgFloat(idx * 7919 + 1337);
  const ry = _lcgFloat(idx * 3571 + 9999);
  const margin = 18;
  return {
    x: 20 + margin + rx * (240 - 2 * margin),
    y: 15 + margin + ry * (130 - 2 * margin)
  };
}

function getFlowerParams(area) {
  if (!area || area <= 0) return { count: 0, radius: FLOWER_BASE_R };
  const count = Math.min(18, Math.max(2, Math.round(3 + Math.sqrt(area / 8))));
  const radius = Math.max(3.5, Math.min(11, 12 - Math.log10(area + 1) * 2.8));
  return { count, radius };
}

function _buildFlowerContents(g, pal) {
  const ns = 'http://www.w3.org/2000/svg';
  const r = FLOWER_BASE_R, pd = r * 0.40;
  const stem = document.createElementNS(ns, 'line');
  stem.setAttribute('x1','0'); stem.setAttribute('y1','0');
  stem.setAttribute('x2','0'); stem.setAttribute('y2', (r * 0.65).toFixed(1));
  stem.setAttribute('stroke','#3d7828'); stem.setAttribute('stroke-width','1'); stem.setAttribute('opacity','0.7');
  g.appendChild(stem);
  for (let j = 0; j < 5; j++) {
    const a = (j * 72 - 90) * Math.PI / 180;
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', (Math.cos(a)*pd).toFixed(1));
    c.setAttribute('cy', (Math.sin(a)*pd).toFixed(1));
    c.setAttribute('r', (r * 0.32).toFixed(1));
    c.setAttribute('fill', pal.p); c.setAttribute('opacity','0.88');
    g.appendChild(c);
  }
  const center = document.createElementNS(ns, 'circle');
  center.setAttribute('cx','0'); center.setAttribute('cy','0');
  center.setAttribute('r', (r * 0.20).toFixed(1)); center.setAttribute('fill', pal.c);
  g.appendChild(center);
}

function updateGardenFlowers(group, targetCount, targetRadius) {
  const ns = 'http://www.w3.org/2000/svg';
  let fc = group.querySelector('.devis-area-flowers');
  if (!fc) { fc = document.createElementNS(ns, 'g'); fc.setAttribute('class','devis-area-flowers'); group.appendChild(fc); }

  const active = Array.from(fc.querySelectorAll('.devis-flower:not(.removing)'));

  for (let i = targetCount; i < active.length; i++) {
    const el = active[i];
    el.classList.add('removing');
    const inner = el.querySelector('.devis-flower-inner');
    if (inner) inner.style.transform = 'scale(0)';
    el.style.opacity = '0';
    setTimeout(() => { if (el.parentNode) el.remove(); }, 520);
  }

  for (let i = 0; i < Math.min(active.length, targetCount); i++) {
    const inner = active[i].querySelector('.devis-flower-inner');
    if (inner) inner.style.transform = `scale(${(targetRadius / FLOWER_BASE_R).toFixed(3)})`;
    active[i].style.opacity = '1';
  }

  for (let i = active.length; i < targetCount; i++) {
    const pos = getFlowerPos(i);
    const pal = FLOWER_PALETTES[i % FLOWER_PALETTES.length];
    const outerG = document.createElementNS(ns, 'g');
    outerG.setAttribute('class', 'devis-flower');
    outerG.style.cssText = `transform: translate(${pos.x.toFixed(1)}px,${pos.y.toFixed(1)}px); opacity: 0; transition: opacity 0.35s ease;`;
    const innerG = document.createElementNS(ns, 'g');
    innerG.setAttribute('class', 'devis-flower-inner');
    innerG.style.cssText = `transform: scale(0); transform-origin: 0px 0px; transition: transform 0.48s cubic-bezier(0.34,1.56,0.64,1);`;
    _buildFlowerContents(innerG, pal);
    outerG.appendChild(innerG);
    fc.appendChild(outerG);
    const scale = (targetRadius / FLOWER_BASE_R).toFixed(3);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      outerG.style.opacity = '1';
      innerG.style.transform = `scale(${scale})`;
    }));
  }
}

function updateAreaVisualization(card, value, serviceContext) {
  const svg = card.querySelector('.devis-area-svg');
  if (!svg) return;
  const group  = svg.querySelector('.devis-area-scaled-group');
  const label  = svg.querySelector('.devis-area-svg-label');
  const dimTxt = svg.querySelector('.devis-area-svg-dim');
  if (!group) return;

  const isJardin = serviceContext === 'jardin';
  const MAX_AREA  = isJardin ? 500 : 120;
  const hasValue  = value && !isNaN(value) && value > 0;

  if (!hasValue) {
    group.style.transform = 'scale(0.18)';
    group.style.opacity   = '0.28';
    if (label)  { label.textContent = 'Entrez une surface'; label.style.opacity = '0.55'; }
    if (dimTxt) dimTxt.setAttribute('opacity', '0');
    if (isJardin) updateGardenFlowers(group, 0, 0);
    return;
  }

  const scale = Math.max(0.35, Math.min(1, Math.cbrt(value / MAX_AREA)));
  group.style.transform = `scale(${scale})`;
  group.style.opacity   = '1';

  if (label) {
    label.textContent = value + ' m²';
    label.style.opacity = '1';
  }

  if (dimTxt) {
    const w = Math.round(Math.sqrt(value * Math.SQRT2));
    const h = Math.round(Math.sqrt(value / Math.SQRT2));
    dimTxt.textContent = `≈ ${w}×${h} m`;
    dimTxt.setAttribute('opacity', '1');
  }

  if (isJardin) {
    const { count, radius } = getFlowerParams(value);
    updateGardenFlowers(group, count, radius);
  }
}

// Anime la sortie de la carte courante et l'entrée de la suivante depuis le
// côté opposé au sens de déplacement, tout en tweenant la hauteur du stage
// vers celle de la nouvelle carte (évite un saut brut entre cartes de
// contenu très différent, ex. grille de services vs. simple textarea).
function transitionDevisStep(newIndex, direction) {
  const stage = document.getElementById('devisQuizStage');
  const oldCard = stage.querySelector('.devis-quiz-card');
  const newCard = buildStepCard(newIndex);

  if (oldCard) {
    // Clip horizontal uniquement pendant le glissement (cf. .is-transitioning,
    // styles.css) : le garder en permanence forcerait aussi le clip vertical
    // (quirk navigateur) et rognerait l'ombre des cartes au repos.
    stage.classList.add('is-transitioning');
    stage.style.height = oldCard.offsetHeight + 'px';
    // Sort les deux cartes du flux pour la durée de l'animation : sinon,
    // tant qu'elles coexistent dans le DOM, elles s'empilent verticalement
    // au lieu de se superposer (cf. .devis-quiz-card.is-animating, styles.css).
    oldCard.classList.add('is-animating');
    newCard.classList.add('is-animating');
    if (direction === 'back') newCard.classList.add('from-left');
    stage.appendChild(newCard);
    const newHeight = newCard.offsetHeight;

    requestAnimationFrame(() => {
      stage.style.height = newHeight + 'px';
      newCard.classList.remove('from-left');
      newCard.classList.add('is-active');
      oldCard.classList.remove('is-active');
      oldCard.classList.add(direction === 'back' ? 'exit-right' : 'exit-left');
    });

    setTimeout(() => {
      if (oldCard.__devisMap) oldCard.__devisMap.remove();
      oldCard.remove();
      newCard.classList.remove('is-animating');
      stage.style.height = '';
      stage.classList.remove('is-transitioning');
    }, 440);
  } else {
    stage.appendChild(newCard);
    requestAnimationFrame(() => newCard.classList.add('is-active'));
  }

  devisStepIndex = newIndex;
  shiftDevisAmbientHue(newIndex);
  shiftDevisAmbientPosition(newIndex);
  updateDevisProgress();
  updateDevisNav();
}

function goDevisNext() {
  if (devisStepIndex >= devisSteps.length - 1) return;
  transitionDevisStep(devisStepIndex + 1, 'forward');
}

function goDevisBack() {
  if (devisStepIndex <= 0) return;
  transitionDevisStep(devisStepIndex - 1, 'back');
}

function updateDevisProgress() {
  const fill = document.getElementById('devisProgressFill');
  const label = document.getElementById('devisProgressLabel');
  fill.style.width = (((devisStepIndex + 1) / devisSteps.length) * 100) + '%';
  label.textContent = `Carte ${devisStepIndex + 1} / ${devisSteps.length}`;
  // N'apparaît qu'une fois le service choisi (cf. .devis-progress-label,
  // styles.css) : avant ça (étape 0), le total de cartes n'est pas encore connu.
  label.classList.toggle('is-visible', devisStepIndex > 0);
}

function updateDevisNav() {
  const step = devisSteps[devisStepIndex];
  const backBtn = document.getElementById('devisBackBtn');
  const nextBtn = document.getElementById('devisNextBtn');

  backBtn.style.display = devisStepIndex === 0 ? 'none' : 'inline-flex';

  if (step.type === 'service' || (step.type === 'choice' && !step.question.inputType)) {
    nextBtn.style.display = 'none';
    return;
  }

  const isLastStep = devisStepIndex === devisSteps.length - 1;
  nextBtn.style.display = 'inline-flex';
  nextBtn.type = isLastStep ? 'submit' : 'button';
  nextBtn.innerHTML = isLastStep
    ? 'Envoyer le devis <span class="btn-arrow">→</span>'
    : 'Suivant <span class="btn-arrow">→</span>';

  if (step.type === 'choice' && step.question.inputType === 'area') {
    const val = parseFloat(devisAnswers[step.question.id]);
    nextBtn.disabled = !(val > 0);
  } else if (step.type === 'description') {
    nextBtn.disabled = !(devisAnswers.description && devisAnswers.description.trim().length > 0);
  } else if (step.type === 'contact') {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(devisAnswers.email || '');
    nextBtn.disabled = !(devisAnswers.prenom && devisAnswers.nom && emailOk);
  } else {
    nextBtn.disabled = false;
  }
}

// Construit et affiche la carte du step courant (devisStepIndex) sans
// transition depuis une carte précédente — le premier rendu d'un quiz, que
// ce soit resetDevisQuiz() (démarre à l'étape 0) ou un devis qui saute
// directement à une étape donnée (service pré-sélectionné depuis le
// carrousel, cf. openDevisWithService et l'init inline de devis.html).
function renderInitialDevisStep() {
  const stage = document.getElementById('devisQuizStage');
  stage.style.height = '';
  stage.innerHTML = '';
  const card = buildStepCard(devisStepIndex);
  card.classList.add('is-active');
  stage.appendChild(card);
  shiftDevisAmbientHue(devisStepIndex);
  resetDevisAmbientScene();
  // Repart de 0% : la mise à la taille réelle (avec son effet de
  // croissance) n'est déclenchée qu'une fois la page Devis bien affichée
  // (cf. triggerDevisProgressGrowIn, appelé après l'ajout de .is-open) —
  // sinon l'animation se jouait et finissait pendant la transition de vague
  // (~1s) qui précède l'apparition de la carte, donc jamais visible.
  document.getElementById('devisProgressFill').style.width = '0%';
  updateDevisNav();
}

function resetDevisQuiz() {
  devisSteps = buildSteps(null);
  devisStepIndex = 0;
  devisAnswers = { dates: [] };
  devisCalendarWeekStart = mondayOf(DEVIS_TODAY);
  devisCalView = 'weeks';
  devisCalWeekIndex = null;
  renderInitialDevisStep();
}

// Démarre la croissance 0% → taille réelle de la barre de progression, une
// fois la carte de progression bien visible (cf. .devis-reveal.devis-delay-1
// dans styles.css : visible à 0.08s + 0.55s = ~0.63s après .is-open). Le
// double rAF garantit en plus que le 0% est bien peint avant qu'on fixe la
// largeur cible, sans quoi le navigateur appliquerait les deux largeurs
// dans le même tick et la transition ne jouerait pas.
function triggerDevisProgressGrowIn() {
  setTimeout(() => {
    requestAnimationFrame(() => requestAnimationFrame(updateDevisProgress));
  }, 650);
}

document.getElementById('devisBackBtn').addEventListener('click', goDevisBack);
document.getElementById('devisNextBtn').addEventListener('click', () => {
  if (document.getElementById('devisNextBtn').type !== 'submit') goDevisNext();
});

// ─────────────────────────────────────────────
// Form submission
// ─────────────────────────────────────────────
const VOTRE_EMAIL = "votre@email.com"; // ← REMPLACER

// ── Config EmailJS ─────────────────────────────────────────────────────────
// Remplace ces trois valeurs après avoir créé ton compte sur emailjs.com
const EMAILJS_SERVICE_ID  = 'service_j033nwf';
const EMAILJS_TEMPLATE_ID = 'template_11x7mes';
const EMAILJS_PUBLIC_KEY  = '78ucBOdPpFs89A31U';

emailjs.init(EMAILJS_PUBLIC_KEY);

function submitDevis(event) {
  event.preventDefault();

  // ── Champs fixes ──────────────────────────────────────────────────────────
  const prenom     = devisAnswers.prenom     || '';
  const nom        = devisAnswers.nom        || '';
  const email      = devisAnswers.email      || '';
  const telephone  = devisAnswers.telephone  || 'Non renseigné';
  const service    = devisAnswers.service    || 'Non précisé';
  const serviceKey = devisAnswers.serviceKey || '';

  const isHorsBxl   = devisAnswers.locationMode === 'belgium';
  const adresseLine = isHorsBxl
    ? `${devisAnswers.adresseLibre || 'Non renseignée'} — hors Bruxelles (~${devisAnswers.distanceKm != null ? devisAnswers.distanceKm + ' km du centre' : 'distance non calculée'})`
    : `${devisAnswers.codepostal || 'Non renseigné'} (Bruxelles)`;

  const dates      = (devisAnswers.dates || []).slice().sort();
  const datesLabel = dates.length ? dates.map(iso => fmtDayChip(isoToDate(iso))).join(', ') : 'Non précisée';
  const description = devisAnswers.description || '';

  // ── Détails du quiz ───────────────────────────────────────────────────────
  const svc = SERVICES.find(s => s.key === serviceKey);
  let questions = svc ? [...svc.questions] : [];

  if (serviceKey === 'nettoyage-exterieur') {
    const followups = NETTOYAGE_EXTERIEUR_FOLLOWUPS[devisAnswers.typeExterieur] || [];
    questions = questions.concat(followups);
  }

  const details = questions
    .map(q => {
      const raw = devisAnswers[q.id];
      if (!raw) return null;
      const val = q.inputType === 'area' ? `${raw} m²` : raw;
      return `${q.label} : ${val}`;
    })
    .filter(Boolean)
    .join('\n');

  // ── Envoi EmailJS ─────────────────────────────────────────────────────────
  const templateParams = {
    service,
    prenom,
    nom,
    email,
    telephone,
    localisation: adresseLine,
    dates:        datesLabel,
    details:      details || '(aucun détail supplémentaire)',
    description,
  };

  const btnNext = document.getElementById('devisNextBtn');
  if (btnNext) btnNext.disabled = true;

  emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
    .then(() => {
      document.getElementById('formStep1').style.display = 'none';
      document.getElementById('formSuccess').style.display = 'flex';
    })
    .catch((err) => {
      console.error('[Devis] Erreur EmailJS →', err);
      document.getElementById('formStep1').style.display = 'none';
      document.getElementById('formSuccess').style.display = 'flex';
    })
    .finally(() => {
      if (btnNext) btnNext.disabled = false;
    });
}

// ─────────────────────────────────────────────
// Mobile nav
// ─────────────────────────────────────────────
function toggleMenu() {
  const links = document.querySelector('.nav-links');
  const burger = document.querySelector('.nav-burger');
  const isOpen = links.classList.toggle('open');
  burger.classList.toggle('open', isOpen);
  burger.setAttribute('aria-expanded', String(isOpen));
}

function closeMobileMenu() {
  document.querySelector('.nav-links').classList.remove('open');
  document.querySelector('.nav-burger').classList.remove('open');
  document.querySelector('.nav-burger').setAttribute('aria-expanded', 'false');
}

// Ferme la carte du menu (avec sa sortie animée vers le haut, cf. .nav-links
// dans styles.css) au clic sur n'importe lequel de ses éléments — liens
// "Accueil"/"Services" comme le bouton "Devis gratuit" ajouté dans la carte.
document.querySelectorAll('.nav-links a, .nav-links button').forEach(el => {
  el.addEventListener('click', closeMobileMenu);
});

// Fondu du logo au scroll (mobile uniquement, géré par CSS) : la nav reste
// fixe et visible, seul le logo s'efface en descendant et réapparaît en haut.
function initNavLogoFade() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const THRESHOLD = 24;

  const sentinel = document.getElementById('navScrollSentinel');
  if (sentinel && 'IntersectionObserver' in window) {
    // Le repère est posé à THRESHOLD px du haut du hero : tant qu'il est
    // visible, on est encore tout en haut de la page (logo visible) : dès
    // qu'il sort de l'écran (scroll vers le bas), on a dépassé le seuil.
    const io = new IntersectionObserver(([entry]) => {
      nav.classList.toggle('nav-scrolled', !entry.isIntersecting);
    });
    io.observe(sentinel);
    return;
  }

  // Repli scroll+rAF si IntersectionObserver n'est pas disponible.
  let ticking = false;

  function update() {
    nav.classList.toggle('nav-scrolled', window.scrollY > THRESHOLD);
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });

  update();
}

// Scroll fluide vers les ancres internes (#home, #services) sur mobile
// uniquement : scroll-behavior:smooth (CSS, html) a un support historiquement
// peu fiable sur Safari iOS pour les sauts déclenchés par un clic sur un
// lien d'ancre — on force ici un scrollIntoView() explicite, mieux supporté.
// Sur ordinateur, ces liens n'ont pas cours de la même façon (#services y
// est atteint via le pin scroll-hijacké, cf. initHeroPageTransition), donc
// on ne touche à rien là-bas.
function initSmoothAnchorScroll() {
  if (!window.matchMedia('(max-width: 768px)').matches) return;
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const id = link.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// ─────────────────────────────────────────────
// Apparition au scroll (.reveal → .reveal.is-visible)
// ─────────────────────────────────────────────
function initScrollReveal() {
  const targets = document.querySelectorAll('.reveal');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -60px 0px' });

  targets.forEach(el => observer.observe(el));
}

// ─────────────────────────────────────────────
// Ripple effect sur les boutons primaires
// ─────────────────────────────────────────────
function initRipples() {
  document.querySelectorAll('.btn-primary').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const rect   = btn.getBoundingClientRect();
      const size   = Math.max(rect.width, rect.height) * 2;
      const ripple = document.createElement('span');
      ripple.className    = 'btn-ripple';
      ripple.style.width  = ripple.style.height = size + 'px';
      ripple.style.left   = (e.clientX - rect.left  - size / 2) + 'px';
      ripple.style.top    = (e.clientY - rect.top   - size / 2) + 'px';
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  });
}

// ─────────────────────────────────────────────
// Découpe un titre/paragraphe en mots individuels (chacun dans son propre
// <span class="hero-reveal-word">), pour une animation d'apparition "mot
// par mot" au chargement (cf. .hero-reveal-word, styles.css) — donne
// l'impression que le texte s'écrit plutôt qu'un simple fondu d'un seul
// bloc. Nom volontairement différent de .reveal-word (déjà utilisé par le
// texte de la section services, cf. plus bas dans ce fichier) pour éviter
// toute collision de classe entre les deux systèmes. Seuls les noeuds texte
// directs sont découpés ; les éléments enfants (ex. <br>, ou .sr-only pour
// le h1) sont préservés tels quels et sautés — le contenu .sr-only en
// particulier ne doit surtout pas être fragmenté, il reste le texte de
// repli lu intégralement par les lecteurs d'écran.
// ─────────────────────────────────────────────
function wrapWordsForReveal(el) {
  const nodes = Array.from(el.childNodes);
  const frag = document.createDocumentFragment();
  let i = 0;
  nodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Découpe sur l'espace normal uniquement : une espace insécable
      // (ex. "main&nbsp;?") reste collée au mot précédent, pas isolée seule.
      node.textContent.split(/( )/).forEach((part) => {
        if (part === '') return;
        if (part === ' ') {
          frag.appendChild(document.createTextNode(' '));
          return;
        }
        const span = document.createElement('span');
        span.className = 'hero-reveal-word';
        span.style.setProperty('--reveal-i', String(i));
        span.textContent = part;
        frag.appendChild(span);
        i++;
      });
    } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('hero-highlight-phrase')) {
      // Locution à surbrillance cyclique (ex. "à votre rythme", cf.
      // .hero-highlight-phrase/.hero-highlight-glow, styles.css) : traitée
      // comme un mot unique dans la cascade d'apparition (même
      // --reveal-i, même animation heroContentRise), mais son contenu
      // interne n'est PAS redécoupé mot par mot — il porte sa propre
      // superposition dégradée, qui doit rester un seul bloc.
      const clone = node.cloneNode(true);
      clone.classList.add('hero-reveal-word');
      clone.style.setProperty('--reveal-i', String(i));
      frag.appendChild(clone);
      i++;
    } else {
      frag.appendChild(node.cloneNode(true));
    }
  });
  el.replaceChildren(frag);
}

// ─────────────────────────────────────────────
// Entrée de la carte du hero (.hero-card)
// .is-entering porte l'animation d'atterrissage 3D depuis le haut de
// l'écran (heroCardDrop, cf. styles.css) ; une fois celle-ci terminée, on
// retire la classe pour rendre la main à .hero-card elle-même, qui porte le
// flottement continu (heroCardFloat) — sans ce retrait, .is-entering
// resterait pour toujours plus spécifique et empêcherait le flottement de
// jamais démarrer. playHeroCardEntrance est rejouable : posée une première
// fois au chargement (cf. initHeroCardEntrance) et rejouée à chaque retour
// en arrière depuis services vers l'accueil (cf. goBackward,
// initHeroPageTransition), pour la même animation d'arrivée dans les deux
// cas plutôt qu'un simple fondu différent au retour.
// ─────────────────────────────────────────────
function playHeroCardEntrance(card) {
  // Distance de survol dynamique (même logique que measureHeroExitRise pour
  // la sortie au scroll, cf. initHeroPageTransition) : la carte doit
  // visiblement venir d'au-dessus de l'écran, pas d'une distance fixe qui
  // peut être plus courte que la carte elle-même sur certains écrans. Se
  // remesure à chaque rejeu, au cas où la mise en page aurait changé
  // (redimensionnement pendant qu'on était sur services, par exemple).
  const prevTransform = card.style.transform;
  const prevAnimation = card.style.animation;
  card.style.animation = 'none';
  card.style.transform = 'none';
  const rect = card.getBoundingClientRect();
  card.style.transform = prevTransform;
  card.style.animation = prevAnimation;
  card.style.setProperty('--hero-entrance-rise', `${-(rect.top + rect.height + 80)}px`);

  card.classList.add('is-entering');
  card.addEventListener('animationend', function onEnd(e) {
    if (e.animationName !== 'heroCardDrop') return;
    card.classList.remove('is-entering');
    card.removeEventListener('animationend', onEnd);
  });
}

// Rejoue l'apparition du titre/description (mot par mot) et des deux
// boutons (cf. .hero-reveal-word / .hero-actions .btn-primary/.btn-outline,
// styles.css), en forçant un reflow entre le retrait et la repose de
// `animation` — sinon le navigateur ne détecte pas le changement et
// l'animation ne redémarre pas.
function replayHeroContentWords(heroContent) {
  const entranceEls = heroContent.querySelectorAll('.hero-reveal-word, .hero-actions .btn-primary, .hero-actions .btn-outline');
  entranceEls.forEach((el) => { el.style.animation = 'none'; });
  void heroContent.offsetWidth;
  entranceEls.forEach((el) => { el.style.animation = ''; });
}

function initHeroCardEntrance() {
  const card = document.getElementById('heroCard');
  if (!card) return;

  const title = card.querySelector('h1');
  const desc = card.querySelector('p');
  if (title) wrapWordsForReveal(title);
  if (desc) wrapWordsForReveal(desc);

  // .is-entering est déjà posé en HTML : playHeroCardEntrance se contente
  // ici de mesurer la distance et d'armer le nettoyage de fin d'animation.
  playHeroCardEntrance(card);
}

// ─────────────────────────────────────────────
// Transition accueil ↔ services (page à page)
// Ce ne sont plus deux sections d'une même page que l'on scrolle en continu :
// le hero et #services sont chacun un écran plein viewport, et le passage de
// l'un à l'autre est une animation de transition qui se rejoue intégralement
// entre les deux — on ne peut plus s'arrêter à mi-course. Un geste vers le
// bas (molette, swipe, flèche/PageDown) sur l'accueil lance la sortie du
// hero ; un geste vers le haut sur la page services la rejoue à l'envers (le
// titre/texte/boutons du hero réapparaissent comme à l'arrivée sur le site).
// Désactivé si l'utilisateur préfère moins d'animations, ainsi que sur mobile
// (cf. media query prefers-reduced-motion / max-width:768px en CSS, qui
// repassent alors #services et .devis-page en page normale scrollable — sans
// ça le scroll reste interne à ces panneaux position:fixed et la barre
// d'adresse de Safari mobile ne peut jamais se rétracter).
function initHeroPageTransition() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(max-width: 768px)').matches) return;

  const stage = document.getElementById('heroScrollStage');
  const heroContent = document.getElementById('heroContent');
  const heroWarmLight = document.getElementById('heroWarmLight');
  const nav = document.querySelector('.nav');
  const services = document.getElementById('services');
  const servicesBlobs = Array.from(document.querySelectorAll('.services-ambient-blob'));
  const devisWaveFall = document.getElementById('devisWaveFall');
  const devisWaveFallInner = document.getElementById('devisWaveFallInner');
  const devisWavePath = document.getElementById('devisWavePath');
  const devisPage = document.getElementById('devisPage');
  if (!stage || !heroContent || !heroWarmLight || !services || servicesBlobs.length !== 4) return;
  if (!devisWaveFall || !devisWaveFallInner || !devisWavePath || !devisPage) return;

  document.documentElement.classList.add('is-paged');

  const DURATION_MS = 900;
  // Sortie de la carte : s'envole vers le haut de l'écran en se réduisant et
  // en s'estompant, comme aspirée vers le ciel — la grille reste immobile,
  // seule la carte s'en va. flightT (cf. renderHeroExit) applique une légère
  // accélération à la montée/réduction/fondu (lente au décollage, un peu
  // plus rapide ensuite), mais bien plus douce qu'avant : la course occupe
  // presque toute la durée du scroll (CONTENT_FADE_END proche de 1), pour
  // une vitesse de sortie proche de celle de l'entrée (heroCardDrop, 0.95s)
  // plutôt qu'une disparition expédiée en un quart de la course.
  const CONTENT_FADE_END = 0.85;
  // Distance de montée : calculée dynamiquement (cf. measureHeroExitRise)
  // pour que la carte quitte entièrement le haut de l'écran avant de
  // disparaître, quels que soient sa hauteur et la taille de la fenêtre —
  // une valeur fixe en pixels ne suffisait pas sur les écrans où la carte
  // est plus haute que la marge au-dessus d'elle.
  let heroExitRisePx = 190;
  const CONTENT_SHRINK = 0.24;

  // Distance depuis le haut actuel de la carte jusqu'à un point nettement
  // au-dessus du viewport (marge de sécurité incluse) : garantit qu'au pic
  // de la sortie, la carte a réellement quitté l'écran plutôt que de
  // s'estomper alors qu'elle est encore visible au milieu de la page.
  function measureHeroExitRise() {
    const prevTransform = heroContent.style.transform;
    heroContent.style.transform = 'none';
    const rect = heroContent.getBoundingClientRect();
    heroContent.style.transform = prevTransform;
    heroExitRisePx = rect.top + rect.height + 80;
  }
  measureHeroExitRise();
  // Lumières chaudes du hero : s'intensifient et dérivent (échelle +
  // déplacement + saturation/luminosité) pendant la première moitié de la
  // course, puis s'effacent en fondu pendant la seconde (cf. CROSSFADE_*
  // plus bas) — jamais un arrêt net. La transition CSS posée sur
  // .hero-warm-light (cf. styles.css) lisse ces valeurs, réévaluées à
  // chaque frame de scroll, en un mouvement continu plutôt que saccadé.
  const WARM_INTENSIFY_END = 0.6;
  const WARM_SCALE_MAX = 1.35;
  const WARM_DRIFT_PX = 70;
  // Fondu croisé : #services (et ses propres taches chaudes, cf.
  // servicesBlobs) apparaît en fondu pendant que celles du hero
  // disparaissent, sur la même fenêtre de progression — puisque c'est une
  // fonction continue de `p`, l'aller (accueil → services) et le retour
  // (services → accueil) sont automatiquement symétriques, sans code séparé.
  const CROSSFADE_START = 0.45;
  const CROSSFADE_END = 0.92;
  // Opacité cible de chaque tache (cf. #services.lights-active .services-
  // ambient-blob-N, styles.css) : reprise ici pour piloter le fondu croisé
  // en JS, en overrideant ces valeurs via inline style (plus prioritaire).
  const SERVICES_BLOB_OPACITY = [0.38, 0.30, 0.34, 0.26];

  let page = 0; // 0 = accueil, 1 = services
  let animating = false;
  let progress = 0;
  // Dernière valeur appliquée à la sortie du hero (contenu), qu'elle vienne
  // de render() (transition accueil → services) ou de renderDevisFromHome()
  // (ouverture Devis) : sert à la ré-appliquer correctement au resize, quel
  // que soit l'axe de transition actif.
  let scatterAmount = 0;
  // Le retour accueil ← services ne doit PAS rejouer le fondu/glissement
  // JS de #heroContent (celui utilisé pour la sortie) : il rejoue plutôt
  // l'atterrissage 3D de la carte + l'écriture mot par mot (cf.
  // playHeroCardEntrance/replayHeroContentWords, même animation qu'au
  // premier chargement). Ce drapeau, posé le temps de la course retour dans
  // animateTo(0), fait sauter les lignes correspondantes de
  // renderHeroExit() pour laisser la place à ce rejeu.
  let suppressHeroContentExit = false;

  // ── Page Devis : sortie du hero (depuis l'accueil) puis vague blanche
  // descendante. ─────────────────────────────────────────────────────────
  // DEVIS_BASE/PEAK_Y_START sont la distance par rapport au bord INFÉRIEUR
  // du viewBox (au lieu du supérieur pour l'ancienne vague du hero) : la
  // crête s'aplatit de la même façon en fin de course, mais contre le bas.
  const DEVIS_BASE_Y_START = 1000 - 90;
  const DEVIS_PEAK_Y_START = 1000 - 65;
  const DEVIS_PEAK_X_START = 660;
  const DEVIS_PEAK_X_END   = 820;
  // Toute la séquence Devis tient dans UNE seule course de DURATION_MS — la
  // même durée que la plongée accueil ↔ services, pour une vitesse
  // identique.
  // Depuis services (pas de contenu de hero à animer) : fondu rapide de la
  // page courante (30 premiers %), vague blanche démarrant avec un léger
  // décalage (15 %) pour un chevauchement plus prononcé.
  const SERVICES_FADE_END = 0.3;
  const DEVIS_WAVE_START_SERVICES = 0.15;
  // Doit rester synchro avec calc(100% + 160px) en CSS (.devis-wave-fall-inner).
  const DEVIS_WAVE_EXTRA_PX = 160;
  const DEVIS_LOGO_FADE_WIDTH = 0.1;

  let devisRiseHeightPx = devisWaveFallInner.clientHeight;
  let devisOpen = false;
  let devisProgress = 0; // vague blanche : 0 = masquée au-dessus, 1 = couvre tout
  let devisCameFromPage = 0; // page sous-jacente (accueil ou services) au moment de l'ouverture
  // Progression (0..1) de la vague blanche au moment où son bord recouvre le
  // logo, recalculée à chaque ouverture/fermeture (cf. computeDevisLogoCrossP).
  let devisLogoCrossP = null;

  // Le bord gauche de la vague (x=0 dans le viewBox) suit exactement `baseY`
  // (cf. buildDevisPath : M0,baseY ...) — le sommet de la courbe, lui, se
  // trouve plus loin sur la droite (PEAK_X) et n'influence donc pas la
  // position de ce bord. Comme le logo est près du bord gauche de l'écran,
  // seul `baseY` (et la translation verticale de l'ensemble) déterminent le
  // moment où la vague passe sa hauteur — on peut donc résoudre p sans
  // inverser la courbe de Bézier.
  function computeDevisLogoCrossP() {
    if (!logoLink) return null;
    const rect = logoLink.getBoundingClientRect();
    const logoY = rect.top + rect.height / 2;
    const H = devisRiseHeightPx;
    const k = (2000 - DEVIS_BASE_Y_START) / 1000;
    const p = 1 - (H - DEVIS_WAVE_EXTRA_PX - logoY) / (H * k);
    return Math.min(Math.max(p, 0), 1);
  }

  // Sortie "de base" du hero : la carte s'estompe en remontant vers le haut
  // de l'écran, pendant que les lumières chaudes s'intensifient (la grille,
  // elle, ne bouge jamais — cf. #heroGrid, non touché ici). Utilisée à
  // l'identique par la transition accueil → services ET par l'ouverture de
  // la page Devis depuis l'accueil — ces deux transitions ne se distinguent
  // que par leur vague, jamais par cette animation de sortie.
  function renderHeroExit(p) {
    scatterAmount = p;

    if (!suppressHeroContentExit) {
      const contentT = Math.min(p / CONTENT_FADE_END, 1);
      // Fondu bien visible et régulier sur toute la course (contentT tout
      // seul) ; la position/l'échelle gardent une légère accélération
      // (flightT, puissance plus douce qu'avant) pour rester un envol
      // plutôt qu'un simple glissement linéaire — deux courbes distinctes
      // pour que le fondu ne reste plus caché jusqu'aux tout derniers
      // instants comme avec l'ancienne courbe partagée.
      const flightT = Math.pow(contentT, 1.3);
      heroContent.style.opacity = String(1 - contentT);
      // Léger flou croissant en plus de l'opacité : rend le fondu net et
      // sans équivoque (un "dissout" plutôt qu'un simple envol qui, seul,
      // peut se lire davantage comme un déplacement qu'une disparition en
      // fondu) — miroir du flou net→flou inversé de l'entrée (heroCardDrop).
      heroContent.style.filter = `blur(${7 * contentT}px)`;
      heroContent.style.transform = `translateY(${-heroExitRisePx * flightT}px) scale(${1 - CONTENT_SHRINK * flightT})`;
      heroContent.style.pointerEvents = p > 0.5 ? 'none' : '';
    }

    const warmT = Math.min(p / WARM_INTENSIFY_END, 1);
    // Fondu de sortie, sur la même fenêtre que le fondu croisé de #services
    // (cf. render() plus bas) : les lumières du hero s'effacent pile pendant
    // que celles de services prennent le relais, jamais avant ni après.
    const warmFadeT = Math.min(Math.max((p - CROSSFADE_START) / (CROSSFADE_END - CROSSFADE_START), 0), 1);
    heroWarmLight.style.transform = `translate(${WARM_DRIFT_PX * 0.3 * warmT}px, ${-WARM_DRIFT_PX * warmT}px) scale(${1 + (WARM_SCALE_MAX - 1) * warmT})`;
    heroWarmLight.style.filter = `saturate(${1 + 0.6 * warmT}) brightness(${1 + 0.15 * warmT})`;
    heroWarmLight.style.opacity = String(1 - warmFadeT);
  }

  function render(p) {
    renderHeroExit(p);

    // Fondu croisé de #services (panneau + ses propres taches chaudes) sur
    // la même fenêtre que le fondu de sortie des lumières du hero
    // (CROSSFADE_START/END) : fonction continue de `p`, donc automatiquement
    // symétrique à l'aller comme au retour.
    const crossT = Math.min(Math.max((p - CROSSFADE_START) / (CROSSFADE_END - CROSSFADE_START), 0), 1);
    services.style.opacity = String(crossT);
    servicesBlobs.forEach((blob, i) => {
      blob.style.opacity = String(SERVICES_BLOB_OPACITY[i] * crossT);
    });

    // Interactif seulement une fois la bascule quasi terminée ; le hero,
    // symétriquement, cesse d'intercepter les clics à ce même seuil.
    const settled = p >= CROSSFADE_END;
    services.style.pointerEvents = settled ? 'auto' : 'none';
    stage.style.pointerEvents = settled ? 'none' : '';
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Tween générique 0→1 (ou 1→0), réutilisé par les séquences Devis : sortie
  // du hero, vague blanche, fondu de la page courante. Retourne une Promise
  // résolue une fois la durée écoulée, pour pouvoir enchaîner plusieurs
  // étapes avec await.
  function tween(durationMs, from, to, onUpdate) {
    return new Promise((resolve) => {
      const start = performance.now();
      function step(now) {
        const t = Math.min((now - start) / durationMs, 1);
        onUpdate(from + (to - from) * easeInOutCubic(t));
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          onUpdate(to);
          resolve();
        }
      }
      requestAnimationFrame(step);
    });
  }

  function buildDevisPath(peakX, baseY, peakY) {
    return (
      `M0,0 L0,${baseY} ` +
      `Q${peakX},${peakY} 1440,${baseY} ` +
      `L1440,0 Z`
    );
  }

  // Vague blanche descendante (p: 0 = masquée au-dessus de l'écran, 1 =
  // couvre tout l'écran). Miroir exact de render() pour la vague bleue :
  // même aplatissement progressif de la crête contre le bord (ici inférieur)
  // pour ne jamais laisser d'écart visible une fois la descente terminée.
  // Reçoit directement sa propre fenêtre de progression (déjà remappée par
  // l'appelant), pas la progression globale de la séquence.
  function renderDevisWave(p) {
    const translatePx = -(1 - p) * devisRiseHeightPx;
    devisWaveFallInner.style.transform = `translateY(${translatePx}px)`;

    const peakX = DEVIS_PEAK_X_START + (DEVIS_PEAK_X_END - DEVIS_PEAK_X_START) * p;
    const baseY = 1000 - (1000 - DEVIS_BASE_Y_START) * (1 - p);
    const peakY = 1000 - (1000 - DEVIS_PEAK_Y_START) * (1 - p);
    devisWavePath.setAttribute('d', buildDevisPath(peakX, baseY, peakY));

    // Fondu du logo synchronisé sur le passage réel du bord de la vague à sa
    // hauteur (devisLogoCrossP, calculé au début de la transition) plutôt
    // qu'un minutage arbitraire — fonctionne dans les deux sens puisque p
    // diminue à la fermeture (closeDevisPage) exactement comme il augmente à
    // l'ouverture.
    if (logoLink && devisLogoCrossP != null) {
      const t = (p - (devisLogoCrossP - DEVIS_LOGO_FADE_WIDTH / 2)) / DEVIS_LOGO_FADE_WIDTH;
      logoLink.style.opacity = String(1 - Math.min(Math.max(t, 0), 1));
    }
  }

  // Depuis l'accueil, l'ouverture de Devis réutilise exactement la même
  // sortie de hero (renderHeroExit), au même rythme que la vague blanche :
  // seule la vague diffère, jamais l'animation de sortie du contenu.
  function renderDevisFromHome(p) {
    renderHeroExit(p);
    devisProgress = p;
    renderDevisWave(p);
  }

  // Au retour vers l'accueil depuis Devis, on ne rejoue pas la sortie à
  // l'envers : on relance directement l'animation d'arrivée d'origine
  // (heroContentRise), celle de l'arrivée sur le site au premier chargement
  // — c'est l'effet demandé, pas une nouvelle animation.
  function replayHomeEntrance() {
    scatterAmount = 0;
    heroContent.style.opacity = '';
    heroContent.style.filter = '';
    heroContent.style.transform = '';
    heroContent.style.pointerEvents = '';
    heroWarmLight.style.transform = '';
    heroWarmLight.style.filter = '';
    heroWarmLight.style.opacity = '';
    replayHeroContentWords(heroContent);
  }

  function renderDevisFromServices(p) {
    const fadeT = Math.min(Math.max(p / SERVICES_FADE_END, 0), 1);
    services.style.opacity = String(1 - fadeT);
    // Bascule le texte de nav dès que le fond bleu de services devient plus
    // transparent que visible — fonctionne dans les deux sens (ouverture ET
    // fermeture), puisque fadeT est une pure fonction de p.
    if (nav) nav.classList.toggle('nav-on-dark', 1 - fadeT > 0.5);

    const waveP = Math.min(Math.max((p - DEVIS_WAVE_START_SERVICES) / (1 - DEVIS_WAVE_START_SERVICES), 0), 1);
    devisProgress = waveP;
    renderDevisWave(waveP);
  }

  async function openDevisPage() {
    if (animating || devisOpen) return;
    animating = true;
    devisCameFromPage = page;
    // Les liens/bouton "Devis gratuit" n'ont pas leur place sur la page Devis
    // elle-même : fondu dès le départ de la transition. Le logo, lui, suit le
    // passage de la vague blanche (cf. computeDevisLogoCrossP/renderDevisWave) :
    // il s'efface une fois recouvert, plutôt que de rester affiché par-dessus.
    if (nav) nav.classList.add('nav-devis');
    devisLogoCrossP = computeDevisLogoCrossP();

    if (page === 0) {
      // Toujours blanc depuis l'accueil : pas besoin de logique dynamique.
      if (nav) nav.classList.remove('nav-on-dark');
      await tween(DURATION_MS, 0, 1, renderDevisFromHome);
    } else {
      services.style.pointerEvents = 'none';
      await tween(DURATION_MS, 0, 1, renderDevisFromServices);
    }

    devisPage.classList.add('is-open');
    devisPage.style.opacity = '1';
    devisPage.style.pointerEvents = 'auto';
    devisOpen = true;
    animating = false;
    triggerDevisProgressGrowIn();
  }

  async function closeDevisPage() {
    if (animating || !devisOpen) return;
    animating = true;
    devisPage.style.opacity = '0';
    devisPage.style.pointerEvents = 'none';
    devisPage.classList.remove('is-open');
    // Refondu dès qu'on quitte la page Devis, pendant que la vague redescend/
    // remonte — pas seulement une fois revenu sur l'accueil ou services.
    if (nav) nav.classList.remove('nav-devis');
    devisLogoCrossP = computeDevisLogoCrossP();

    if (devisCameFromPage === 0) {
      // Vague blanche seule : l'arrivée du contenu du hero rejoue son
      // animation d'origine, indépendamment du rythme de la vague.
      replayHomeEntrance();
      await tween(DURATION_MS, 1, 0, (p) => { devisProgress = p; renderDevisWave(p); });
    } else {
      await tween(DURATION_MS, 1, 0, renderDevisFromServices);
      services.style.pointerEvents = 'auto';
      // Resynchronise les mots après le retour depuis devis.
      if (window.HSServicesReveal) window.HSServicesReveal.update();
    }

    devisOpen = false;
    animating = false;
    // Rend la main au CSS (ex. fondu du logo au scroll sur mobile, cf.
    // .nav.nav-scrolled .nav-logo) : sans ça, l'opacité inline posée pendant
    // la transition (toujours = 1 ici, p étant revenu à 0) primerait pour de
    // bon sur cette règle après le retour à l'accueil.
    if (logoLink) logoLink.style.opacity = '';
  }

  // Point d'entrée appelé par openDevis()/closeDevis() (top du fichier),
  // tant que cette transition animée est active (motion non réduite).
  window.HSDevis = { open: openDevisPage, close: closeDevisPage };

  function animateTo(target) {
    animating = true;
    // L'opacité de #services (panneau + lumières) est désormais pilotée en
    // continu par render() (fondu croisé sur CROSSFADE_START/END, cf. plus
    // haut) — il n'y a donc plus de snap à poser ici, dans un sens comme
    // dans l'autre. Seul .lights-active (qui pilote .svc-reveal, indépendant
    // du fondu croisé des lumières) reste géré au début/à la fin de la
    // course : repart de zéro dès qu'on quitte services...
    if (target === 0) services.classList.remove('lights-active');

    // Retour vers l'accueil : au lieu du fondu/glissement JS habituel de
    // #heroContent (utilisé pour la sortie), on rejoue la même arrivée
    // qu'au premier chargement — atterrissage 3D de la carte + écriture mot
    // par mot. #heroContent lui-même est neutralisé immédiatement (déjà
    // visible), pour laisser toute la place à ce rejeu. Sens inverse (vers
    // services) : on s'assure que le fondu/glissement JS reprend bien la
    // main, au cas où il aurait été suspendu par un retour précédent.
    if (target === 0) {
      suppressHeroContentExit = true;
      heroContent.style.opacity = '';
      heroContent.style.filter = '';
      heroContent.style.transform = '';
      heroContent.style.pointerEvents = '';
      const card = document.getElementById('heroCard');
      if (card) playHeroCardEntrance(card);
      replayHeroContentWords(heroContent);
    } else {
      suppressHeroContentExit = false;
    }

    const start = progress;
    const delta = target - start;
    const startTime = performance.now();

    function step(now) {
      const t = Math.min((now - startTime) / DURATION_MS, 1);
      progress = start + delta * easeInOutCubic(t);
      render(progress);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        progress = target;
        render(progress);
        page = target;
        animating = false;
        if (target === 1) {
          // ...et se déclenche une fois l'arrivée sur services terminée.
          services.classList.add('lights-active');
          // Synchronise l'état des mots (scroll peut être non-nul).
          if (window.HSServicesReveal) window.HSServicesReveal.update();
        } else {
          // La course retour est terminée : suppressHeroContentExit ne doit
          // plus vivre au-delà, sinon une ouverture de Devis depuis
          // l'accueil juste après (qui partage renderHeroExit) se
          // retrouverait avec une sortie de contenu bloquée.
          suppressHeroContentExit = false;
        }
      }
    }
    requestAnimationFrame(step);
  }

  function goForward() {
    if (animating || devisOpen || page === 1) return;
    animateTo(1);
  }

  function goBackward() {
    if (animating || devisOpen || page === 0) return;
    // Repart du haut de la page services, quel que soit l'endroit où on
    // l'avait laissée défilée : au retour, son contenu doit réapparaître
    // depuis le début plutôt que mi-scroll.
    services.scrollTop = 0;
    animateTo(0);
  }

  // Tant qu'on est sur l'accueil (page 0), il n'y a rien à défiler : tout
  // geste vers le bas déclenche la transition. Une fois sur la page services
  // (page 1), le scroll natif reprend la main pour défiler son contenu — on
  // ne reprend le contrôle qu'à sa limite haute (scrollTop <= 0), où un
  // geste vers le haut renvoie à l'accueil. Tout ceci est suspendu tant que
  // la page Devis est ouverte ou en transition (son propre scroll interne
  // reprend la main à la place).
  const WHEEL_THRESHOLD = 10;
  window.addEventListener('wheel', (e) => {
    if (devisOpen) return;
    if (animating) {
      e.preventDefault();
      return;
    }
    if (page === 0) {
      e.preventDefault();
      if (e.deltaY > WHEEL_THRESHOLD) goForward();
      return;
    }
    if (e.deltaY < -WHEEL_THRESHOLD && services.scrollTop <= 0) {
      e.preventDefault();
      goBackward();
    }
  }, { passive: false });

  let touchStartY = null;
  const TOUCH_THRESHOLD = 40;
  window.addEventListener('touchstart', (e) => {
    if (devisOpen) return;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (devisOpen || touchStartY === null) return;
    if (animating) {
      e.preventDefault();
      return;
    }
    const delta = touchStartY - e.touches[0].clientY;
    if (page === 0) {
      e.preventDefault();
      if (delta > TOUCH_THRESHOLD) {
        touchStartY = null;
        goForward();
      }
      return;
    }
    if (delta < -TOUCH_THRESHOLD && services.scrollTop <= 0) {
      e.preventDefault();
      touchStartY = null;
      goBackward();
    }
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (devisOpen || animating) return;
    const isDown = e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ';
    const isUp = e.key === 'ArrowUp' || e.key === 'PageUp';
    if (!isDown && !isUp) return;

    if (page === 0) {
      if (isDown) {
        e.preventDefault();
        goForward();
      }
      return;
    }
    if (isUp && services.scrollTop <= 0) {
      e.preventDefault();
      goBackward();
    }
  });

  // Liens d'ancre vers #services (nav + CTA du hero) : déclenchent la même
  // transition animée plutôt qu'un saut natif vers un élément position:fixed.
  document.querySelectorAll('a[href="#services"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      goForward();
    });
  });

  // Logo : un cran en arrière. Si la page Devis est ouverte, la referme
  // (retour vers la page d'où elle a été ouverte) ; sinon, retour classique
  // accueil ↔ services. goBackward()/closeDevisPage() ignorent déjà la
  // position de scroll, contrairement aux gestes molette/tactile/clavier qui
  // n'agissent qu'à la limite haute.
  const logoLink = document.querySelector('.nav-logo');
  if (logoLink) {
    logoLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (devisOpen) {
        closeDevisPage();
      } else {
        goBackward();
      }
    });
  }

  function onResize() {
    devisRiseHeightPx = devisWaveFallInner.clientHeight;
    measureHeroExitRise();
    render(progress);
    renderDevisWave(devisProgress);
    // Ré-applique le bon état de sortie en dernier : render() vient de le
    // recalculer via `progress` (axe accueil ↔ services), ce qui serait
    // erroné si c'est en réalité l'ouverture de Devis qui l'a positionné.
    renderHeroExit(scatterAmount);
  }
  window.addEventListener('resize', onResize, { passive: true });

  render(0);
  renderDevisWave(0);
}

// ─────────────────────────────────────────────
// Préchargeur
// Masque le site derrière un écran blanc (logo + spinner) tant que le logo
// n'est pas prêt (le ciel/la brume du hero sont peints en CSS, rien à
// précharger). Sécurité par délai max pour ne jamais bloquer l'affichage si
// une ressource tarde ou échoue.
// ─────────────────────────────────────────────
function initPreloader() {
  const preloader = document.getElementById('preloader');
  if (!preloader) return;

  // Posé par closeDevisStandalone (devis.html) juste avant de revenir ici :
  // les images/polices ont déjà été chargées lors de la visite en cours, pas
  // besoin de remontrer l'écran de chargement pour un simple retour à
  // l'accueil. sessionStorage (pas localStorage) : ne doit valoir que pour
  // cette navigation précise, pas pour une prochaine visite du site.
  if (sessionStorage.getItem('hs_skip_preloader')) {
    sessionStorage.removeItem('hs_skip_preloader');
    document.body.classList.remove('is-loading');
    preloader.remove();
    return;
  }

  // Durée d'affichage minimale : sur un chargement local/rapide (cache,
  // fichier en local), les images sont prêtes en quelques ms et le
  // préchargeur disparaîtrait avant le premier rendu écran, le rendant
  // invisible. Ce plancher garantit qu'il reste visible un court instant.
  const MIN_DISPLAY_MS = 150;
  const shownAt = performance.now();

  const imagesToWaitFor = [document.querySelector('.preloader-logo')].filter(Boolean);

  // `img.complete` ne garantit que la fin du téléchargement, pas du décodage
  // pixel par pixel : `decode()` ne résout qu'une fois l'image entièrement
  // décodée et prête à être peinte sans à-coup.
  const whenImageReady = (img) => {
    if (typeof img.decode === 'function') {
      return img.decode().catch(() => {});
    }
    return new Promise((resolve) => {
      if (img.complete && img.naturalWidth > 0) {
        resolve();
      } else {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      }
    });
  };

  const allReady = Promise.all(imagesToWaitFor.map(whenImageReady));
  const safetyTimeout = new Promise((resolve) => setTimeout(resolve, 3000));

  const hide = () => {
    preloader.classList.add('preloader--hidden');
    // `is-loading` n'est retiré qu'une fois le fondu terminé (pas au moment
    // où il démarre) : les animations d'arrivée du contenu du hero sont
    // mises en pause par CSS tant que cette classe est présente (cf.
    // styles.css), pour ne jamais tourner cachées derrière le préchargeur
    // encore visible pendant ses ~0.3s de fondu.
    const reveal = () => {
      document.body.classList.remove('is-loading');
      preloader.remove();
    };
    preloader.addEventListener('transitionend', reveal, { once: true });
    // Garde-fou seulement (transitionend ne se déclenche pas si l'onglet est
    // en arrière-plan, etc.) : calé juste après les 0.3s CSS ci-dessus (cf.
    // styles.css, .preloader), jamais avant, pour ne jamais couper le fondu.
    setTimeout(reveal, 450);
  };

  Promise.race([allReady, safetyTimeout]).then(() => {
    const remaining = MIN_DISPLAY_MS - (performance.now() - shownAt);
    remaining > 0 ? setTimeout(hide, remaining) : hide();
  });
}

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
// Accordéon automatique des 3 cartes "Nos services"
// Une seule carte est "élargie" (.is-expanded) à la fois et affiche son
// contenu ; les deux autres restent réduites et vides. Indépendant du
// système .lights-active (piloté par la vague scroll-hijackée d'
// initHeroPageTransition) : ce dernier ne se déclenche de façon fiable que
// via l'interaction précise attendue par cette transition, ce qui rendait
// l'accordéon silencieux dans certains cas d'usage réels. On se base donc
// directement sur la visibilité réelle de la section (IntersectionObserver),
// qui fonctionne quel que soit le mécanisme de scroll/transition en jeu.
// ─────────────────────────────────────────────
function initServicesAccordion() {
  const services = document.getElementById('services');
  const cards = Array.from(document.querySelectorAll('.service-card'));
  if (!services || !cards.length) return;

  function setImmediate(i) {
    cards.forEach((card, idx) => {
      const active = idx === i;
      card.classList.toggle('is-expanded', active);
      card.classList.toggle('content-visible', active);
    });
  }

  // La 1ère carte est déjà élargie, avec son contenu déjà visible, dès le
  // tout premier rendu, avant la moindre peinture : aucune transition ne
  // peut jouer sur un état initial, donc les 3 cartes n'apparaissent jamais
  // à la même taille — quand .svc-reveal les fait apparaître (fondu + léger
  // slide), la 1ère est déjà dans sa forme finale élargie.
  setImmediate(0);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const STEP_MS = 3200;
  // Durées des 2 étapes qui s'enchaînent (cf. styles.css) : le fade out du
  // contenu actif doit être terminé avant que la largeur ne commence à
  // bouger, et le fade in du nouveau contenu ne démarre qu'une fois la
  // largeur stabilisée — 3 phases successives, jamais superposées.
  const FADE_MS = 200;
  const WIDTH_MS = 850;

  let index = 0;
  let timer = null;

  function goTo(next) {
    cards[index].classList.remove('content-visible');
    setTimeout(() => {
      index = next;
      cards.forEach((card, idx) => card.classList.toggle('is-expanded', idx === index));
      setTimeout(() => {
        cards[index].classList.add('content-visible');
      }, WIDTH_MS);
    }, FADE_MS);
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => {
      goTo((index + 1) % cards.length);
    }, STEP_MS);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  // Déclenché par #services.lights-active — PAS par un IntersectionObserver
  // brut sur #services : cette section occupe le même rectangle d'écran que
  // le hero dès le chargement de la page (mise en page "paged" pilotée par
  // initHeroPageTransition, cf. plus haut), donc elle serait considérée
  // "visible" immédiatement, bien avant que l'utilisateur n'y accède
  // réellement. .lights-active, elle, n'est posée qu'une fois la section
  // effectivement affichée (opacité amenée à 1) — c'est le signal déjà
  // utilisé par les lumières d'ambiance et l'apparition en cascade.
  if (services.classList.contains('lights-active')) start();

  const mo = new MutationObserver(() => {
    if (services.classList.contains('lights-active')) start();
    else stop();
  });
  mo.observe(services, { attributes: true, attributeFilter: ['class'] });
}

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Texte scroll-reveal dans la section Services
// Chaque mot devient un <span class="reveal-word">.
// Un seuil vertical (65 % du viewport) sépare les
// mots allumés (au-dessus) des mots éteints (en-dessous).
// Fonctionne dans les deux sens : scroll vers le bas
// allume, scroll vers le haut éteint.
// ─────────────────────────────────────────────
function initServicesRevealText() {
  const services  = document.getElementById('services');
  const container = document.getElementById('servicesAboutText');
  if (!services || !container) return;

  // Injection des <span> mot par mot (préserve les &nbsp; du HTML)
  const raw = container.innerHTML.trim();
  // Découpe sur les espaces en préservant les balises (aucune balise ici)
  container.innerHTML = raw
    .split(/(\s+)/)
    .map(token => /^\s+$/.test(token) ? token : `<span class="reveal-word">${token}</span>`)
    .join('');

  const words = Array.from(container.querySelectorAll('.reveal-word'));

  function update() {
    const threshold = window.innerHeight * 0.65;
    const rect = container.getBoundingClientRect();

    // Bloc de texte entièrement en dessous du seuil → tout éteint
    if (rect.top >= threshold) {
      for (const w of words) w.classList.remove('is-lit');
      return;
    }
    // Bloc de texte entièrement au-dessus du seuil → tout allumé
    if (rect.bottom <= threshold) {
      for (const w of words) w.classList.add('is-lit');
      return;
    }

    // Progression du seuil à travers le bloc (0 → 1)
    // → convertie en nombre de mots à allumer.
    // Tous les mots d'une même ligne ont le même .top, mais en indexant
    // par ordre d'apparition dans le DOM on obtient un reveal mot-à-mot.
    const progress = (threshold - rect.top) / rect.height;
    const count    = Math.round(progress * words.length);

    for (let i = 0; i < words.length; i++) {
      words[i].classList.toggle('is-lit', i < count);
    }
  }

  // Scroll dans la section (overflow-y:auto sur #services en desktop) et/ou
  // scroll du document (mobile ou reduced-motion, où #services repasse en
  // flux normal, cf. media queries CSS) — l'un des deux ne se déclenchera
  // jamais selon le mode, sans effet indésirable dans l'autre cas.
  services.addEventListener('scroll', update, { passive: true });
  window.addEventListener('scroll', update, { passive: true });
  // Resize : les positions changent
  window.addEventListener('resize', update, { passive: true });

  // Exposé pour que initHeroPageTransition() puisse forcer une mise
  // à jour quand services redevient visible (retour devis → services).
  window.HSServicesReveal = { update };
}

document.addEventListener('DOMContentLoaded', () => {
  initPreloader();
  initRipples();
  initHeroCardEntrance();
  initNavLogoFade();
  initSmoothAnchorScroll();
  initScrollReveal();
  initHeroPageTransition();
  initServicesAccordion();
  initServicesRevealText();

  // initHeroPageTransition() ne s'initialise pas sur mobile ni si l'utilisateur
  // préfère moins d'animations (cf. plus haut) : #services n'est alors jamais
  // "atteinte" via la transition de page qui pose normalement .lights-active
  // (cf. animateTo, plus haut), donc son contenu (.svc-reveal) resterait
  // invisible pour de bon sans ce repli.
  if (!window.HSDevis) {
    const services = document.getElementById('services');
    if (services) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        services.classList.add('lights-active');
      } else {
        // Sur mobile, #services est déjà visible en permanence dans le flux
        // (cf. media query CSS) : à défaut de la plongée pilotée par le
        // scroll (désactivée pour laisser le document défiler nativement —
        // seul moyen pour Safari mobile de rétracter sa barre d'adresse), on
        // rejoue ici le fondu + léger slide de .svc-reveal (déjà utilisé par
        // la transition sur desktop) une seule fois, dès que la section
        // entre réellement dans l'écran au scroll naturel. Déclenché une
        // seule fois (pas lié en continu au scroll, contrairement à une
        // précédente tentative qui avait buggué).
        const servicesIntro = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              services.classList.add('lights-active');
              servicesIntro.disconnect();
            }
          }
        }, { threshold: 0.15 });
        servicesIntro.observe(services);
      }
    }
  }
});

/*
══════════════════════════════════════════════
  INTÉGRATION EMAILJS (ENVOI D'EMAIL SANS SERVEUR)

  1. Créer un compte sur https://www.emailjs.com (gratuit = 200 emails/mois)
  2. Créer un "Email Service" (ex: Gmail)
  3. Créer un "Email Template"
  4. Ajouter dans index.html avant </head> :
     <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>
     <script>emailjs.init("VOTRE_PUBLIC_KEY");</script>

  5. Remplacer window.location.href = `mailto:...` par :

     emailjs.send("VOTRE_SERVICE_ID", "VOTRE_TEMPLATE_ID", {
       from_name: `${prenom} ${nom}`,
       from_email: email,
       telephone, service, codepostal, date,
       message: description,
     }).then(() => {
       document.getElementById('formStep1').style.display = 'none';
       document.getElementById('formSuccess').style.display = 'flex';
     }).catch(err => {
       alert("Erreur lors de l'envoi. Veuillez réessayer.");
     });

══════════════════════════════════════════════
*/
