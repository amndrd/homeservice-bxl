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
  if (e.key !== 'Escape') return;
  closeDevis();
  if (document.querySelector('.nav-links.open')) closeMobileMenu();
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
  },
  // Pas de questions dédiées : ouvert via openDevisWithService('sur-mesure')
  // depuis la carte "service sur mesure" (index.html), buildSteps() saute
  // donc directement aux étapes communes - la carte "description" (déjà
  // présente sur tous les parcours) sert alors à détailler la demande.
  {
    key: 'sur-mesure', label: 'Service sur mesure', icon: 'ph-sparkle',
    questions: []
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
// Position mémorisée le temps que le menu plein écran est ouvert (cf.
// lockBodyScroll/unlockBodyScroll ci-dessous). navScrollLocked évite tout
// appel redondant : closeMobileMenu() est aussi câblé au clic sur les liens
// de .nav-links côté ordinateur (où ils sont toujours visibles, sans notion
// d'ouverture) - sans ce garde-fou, unlockBodyScroll() y ramènerait la page
// en haut (scrollTo(0,0)) à chaque clic sur un lien de nav.
let navScrollLocked = false;
let navScrollLockY = 0;

// overflow:hidden seul sur le body ne suffit pas à bloquer le scroll tactile
// sur mobile Safari (le rebond en bord de page continue de faire défiler le
// contenu sous le menu, malgré son fond blanc plein écran) : on fige le body
// en position:fixed à sa position de scroll actuelle, la seule méthode
// fiable sur iOS, puis on restaure la position exacte à la fermeture.
function lockBodyScroll() {
  if (navScrollLocked) return;
  navScrollLocked = true;
  navScrollLockY = window.scrollY || window.pageYOffset || 0;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${navScrollLockY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}

function unlockBodyScroll() {
  if (!navScrollLocked) return;
  navScrollLocked = false;
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, navScrollLockY);
}

// Durée de l'animation de fermeture "rideau" (cf. .nav-flip.closing,
// styles.css) : à garder synchronisée avec sa transition CSS - c'est ce
// délai qui détermine quand on retire .open/.closing et qu'on remet les
// lattes à plat, prêtes pour la prochaine ouverture en cascade.
const NAV_FLIP_CLOSE_MS = 550;

function openMobileMenu() {
  const flip = document.querySelector('.nav-flip');
  const links = document.querySelector('.nav-links');
  const burger = document.querySelector('.nav-burger');
  // Au cas où le menu était en train de se refermer (rideau qui remonte) :
  // on annule cette fermeture avant de rouvrir, pour repartir d'un état net.
  flip.classList.remove('closing');
  flip.classList.add('open');
  links.classList.add('open');
  burger.classList.add('open');
  burger.setAttribute('aria-expanded', 'true');
  // Le menu occupe désormais tout l'écran (effet "trivision" à lattes) : on
  // bloque le scroll de la page derrière tant qu'il est ouvert.
  lockBodyScroll();
}

function closeMobileMenu() {
  const flip = document.querySelector('.nav-flip');
  const links = document.querySelector('.nav-links');
  const burger = document.querySelector('.nav-burger');
  if (flip.classList.contains('closing')) return;
  links.classList.remove('open');
  burger.classList.remove('open');
  burger.setAttribute('aria-expanded', 'false');
  unlockBodyScroll();
  // Contrairement à l'ouverture (cascade de lattes), la fermeture glisse
  // l'écran blanc déjà retourné d'un bloc vers le haut, en "rideau" (cf.
  // .nav-flip.closing, styles.css) - .open reste posé le temps de
  // l'animation (les lattes doivent rester figées, retournées) et n'est
  // retiré qu'une fois le rideau remonté.
  flip.classList.add('closing');
  window.setTimeout(() => {
    flip.classList.remove('open', 'closing');
  }, NAV_FLIP_CLOSE_MS);
}

function toggleMenu() {
  const isOpen = document.querySelector('.nav-links').classList.contains('open');
  if (isOpen) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
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
// Titre + description des cartes d'info : découpés mot par mot (même
// wrapWordsForReveal que le hero/l'intro services, cf. plus haut) pour
// l'effet "écriture" une fois la carte retournée (cf. .info-card.is-visible
// .info-card-title/.info-card-sub .hero-reveal-word, styles.css). L'apparition
// elle-même reste pilotée en CSS par le même .is-visible que la carte
// (initScrollReveal, ci-dessous) : contrairement à l'intro services, cette
// page n'est jamais retraversée en arrière jusqu'ici, donc pas besoin de
// rejouer/réinitialiser - poser les spans une fois au chargement suffit.
// ─────────────────────────────────────────────
function initInfoCardWordReveal() {
  document.querySelectorAll('.info-card-title, .info-card-sub').forEach(wrapWordsForReveal);
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

  // IntersectionObserver passe sa propre instance en 2ᵉ argument au
  // callback : la même fonction sert donc aux deux observateurs ci-dessous,
  // chacun avec ses propres seuils.
  const reveal = (entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  };

  const observer = new IntersectionObserver(reveal, { threshold: 0.2, rootMargin: '0px 0px -60px 0px' });

  // Cartes d'info (retournement 3D, cf. styles.css) : seuil dédié, plus
  // strict que le reste du site (50% de la carte visible, sans marge
  // négative en bas) - avec le seuil générique ci-dessus, ces cartes
  // pouvaient déjà satisfaire "20% visible à 60px près du bas d'écran" dès
  // l'arrivée en haut de la section services sur un viewport assez haut,
  // et donc apparaître avant tout geste de scroll de la part du visiteur.
  // Révélées en 2 temps, rangée du haut (cartes 1-2) PUIS rangée du bas
  // (cartes 3-4) une fois qu'on scrolle plus loin : même seuil (50% de la
  // carte visible) pour les deux, mais la rangée du bas utilise en plus un
  // rootMargin négatif en bas (rétrécit la zone de détection aux 95% hauts
  // de l'écran) - sans lui, les deux rangées entrent dans l'écran presque
  // ensemble (elles se suivent de près verticalement) et se révéleraient
  // quasi simultanément plutôt que l'une après l'autre. Marge minime (-5%,
  // réduite depuis -15% puis -35%) : juste assez pour garder un ordre
  // haut-puis-bas, la rangée du bas doit se révéler très tôt dans le scroll.
  // Même avec les seuils ci-dessus, un viewport assez haut peut encore
  // satisfaire "50% de la carte visible" dès l'arrivée en haut de #services
  // (juste après la transition hero → services, avant tout geste de scroll
  // du visiteur dans le contenu lui-même) : les cartes se révélaient donc
  // parfois sans qu'aucun scroll n'ait eu lieu. On bloque donc leur
  // révélation tant qu'aucun scroll réel n'a été détecté - sur #services
  // (son overflow-y:auto interne, desktop) ou sur window (repli mobile/
  // reduced-motion, où #services redevient une section en flux normal,
  // cf. media queries dans styles.css) - puis on révèle immédiatement les
  // cartes déjà intersectantes dès ce premier scroll, sans attendre un
  // nouveau changement d'intersection.
  let hasScrolledIntoContent = false;
  const pendingInfoCards = new Set();

  // Bloque le survol (.info-card:hover et tout ce qui en dépend - horloge,
  // dossier, ticket...) tant que la carte n'a pas ENTIÈREMENT terminé son
  // retournement 3D (cf. pointer-events:none sur .info-cards .reveal,
  // styles.css) : sans ça, survoler une carte encore sur la tranche ou en
  // plein retournement pouvait déclencher le soulèvement au survol en
  // pleine bascule, un mouvement qui entre en concurrence avec l'animation
  // d'entrée plutôt que de la laisser se terminer proprement. .is-settled
  // (posée ici, jamais en CSS) lève ce blocage une fois le retournement
  // réellement fini - transitionend sur `transform` plutôt qu'un délai fixe
  // dupliqué en JS, pour rester juste même si les durées/délais CSS
  // (transition-delay par carte, cf. styles.css) changent un jour.
  // pointer-events n'est volontairement pas mis dans la liste `transition`
  // CSS elle-même (essayé d'abord) : ce n'est pas une propriété
  // interpolable, un navigateur sans `transition-behavior: allow-discrete`
  // (encore récent) l'aurait basculée instantanément en ignorant tout délai
  // - d'où ce passage par transitionend, fiable partout.
  function armInfoCardSettle(el) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-settled');
      return;
    }
    let settled = false;
    function settle() {
      if (settled) return;
      settled = true;
      el.classList.add('is-settled');
      el.removeEventListener('transitionend', onTransitionEnd);
      window.clearTimeout(fallbackId);
    }
    function onTransitionEnd(e) {
      if (e.target === el && e.propertyName === 'transform') settle();
    }
    el.addEventListener('transitionend', onTransitionEnd);
    // Filet de sécurité : au cas où transitionend ne se déclencherait pas
    // (ex. élément retiré du DOM, transition coupée ailleurs) - 1000ms
    // couvre largement le pire cas réel (délai carte 0.24s + durée 0.7s =
    // 0.94s, cf. styles.css).
    const fallbackId = window.setTimeout(settle, 1000);
  }

  const revealInfoCards = (entries, observer) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      if (hasScrolledIntoContent) {
        entry.target.classList.add('is-visible');
        armInfoCardSettle(entry.target);
        observer.unobserve(entry.target);
      } else {
        pendingInfoCards.add(entry.target);
      }
    });
  };

  function onFirstContentScroll() {
    if (hasScrolledIntoContent) return;
    hasScrolledIntoContent = true;
    pendingInfoCards.forEach(el => {
      el.classList.add('is-visible');
      armInfoCardSettle(el);
    });
    pendingInfoCards.clear();
  }
  const servicesEl = document.getElementById('services');
  if (servicesEl) servicesEl.addEventListener('scroll', onFirstContentScroll, { passive: true, once: true });
  window.addEventListener('scroll', onFirstContentScroll, { passive: true, once: true });

  const infoCardTopObserver = new IntersectionObserver(revealInfoCards, { threshold: 0.5 });
  const infoCardBottomObserver = new IntersectionObserver(revealInfoCards, { threshold: 0.5, rootMargin: '0px 0px -5% 0px' });

  targets.forEach(el => {
    const infoCards = el.closest('.info-cards');
    if (!infoCards) { observer.observe(el); return; }
    const isBottomRow = Array.from(infoCards.children).indexOf(el) >= 2;
    (isBottomRow ? infoCardBottomObserver : infoCardTopObserver).observe(el);
  });
}

// ─────────────────────────────────────────────
// Carte 4 (Estimation du prix) : le nombre défile aléatoirement en continu
// (cf. .odometer-wheel/-strip/-digit, styles.css), comme un compteur qui
// n'affiche jamais deux fois la même estimation - purement décoratif
// (parent déjà aria-hidden), donc pas besoin de retomber sur une valeur
// "propre" à un moment donné. Tourne dès le chargement (la carte reste
// invisible tant que .is-visible n'est pas posée par initScrollReveal, donc
// aucun flash avant révélation) plutôt que d'attendre le reveal.
//
// Chaque chiffre est une roue façon odomètre mécanique (une bande de 0 à 9
// répétée 3 fois, cf. buildWheel) plutôt qu'un simple changement de texte :
// on ne tourne jamais que vers l'avant (jamais en arrière, comme un vrai
// compteur), même pour atteindre un chiffre "plus petit" (ex. 8 → 2 tourne
// en avant à travers 9, 0, 1 plutôt que de reculer) - la bande étant
// répétée 3 fois, `position` peut donc grossir au fil des tirages ; une
// fois un tour complet dépassé (position >= 10), on le retranche
// silencieusement (transition coupée le temps d'un frame) une fois la
// transition en cours terminée, ce qui retombe pile sur le même chiffre
// affiché - aucun saut visible, et `position` reste borné.
function initInfoCardPriceTicker() {
  const valueEl = document.querySelector('.info-card-price-value');
  if (!valueEl) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const MIN = 105;
  const MAX = 195;
  const DIGIT_COUNT = String(MAX).length;
  const STRIP_LAPS = 3;

  function buildWheel() {
    const wheel = document.createElement('span');
    wheel.className = 'odometer-wheel';
    const strip = document.createElement('span');
    strip.className = 'odometer-strip';
    for (let lap = 0; lap < STRIP_LAPS; lap++) {
      for (let n = 0; n <= 9; n++) {
        const digit = document.createElement('span');
        digit.className = 'odometer-digit';
        digit.textContent = String(n);
        strip.appendChild(digit);
      }
    }
    wheel.appendChild(strip);
    return { wheel, strip, position: 0 };
  }

  valueEl.innerHTML = '';
  const wheels = Array.from({ length: DIGIT_COUNT }, buildWheel);
  wheels.forEach(({ wheel }) => valueEl.appendChild(wheel));

  function setValue(value, animate) {
    const digits = String(value).padStart(DIGIT_COUNT, '0');
    wheels.forEach((w, i) => {
      const target = Number(digits[i]);
      const delta = (target - (w.position % 10) + 10) % 10;
      if (delta === 0) return;
      w.position += delta;
      w.strip.style.transition = animate ? '' : 'none';
      w.strip.style.transform = `translateY(-${w.position}em)`;
      if (w.position >= 10) {
        w.strip.addEventListener('transitionend', function onEnd() {
          w.strip.removeEventListener('transitionend', onEnd);
          w.position -= 10;
          w.strip.style.transition = 'none';
          w.strip.style.transform = `translateY(-${w.position}em)`;
        }, { once: true });
      }
    });
  }

  setValue(MIN, false);

  function tick() {
    setValue(Math.floor(MIN + Math.random() * (MAX - MIN + 1)), true);
    setTimeout(tick, 700 + Math.random() * 500);
  }
  setTimeout(tick, 600);
}

// ─────────────────────────────────────────────
// Carte 2 (RDV -24h) : horloge animée - les 3 aiguilles (cf.
// .info-card-clock-hand-hour/-minute/-second, styles.css) tournent en
// continu à une vitesse volontairement accélérée et purement décorative
// (PERIOD_MS ci-dessous, propre à chaque aiguille - plus aucun rapport avec
// l'heure réelle), pour un visuel plus vivant qu'un cadran qui semble figé.
// Boucle rAF sur le temps écoulé (performance.now() - start) plutôt qu'un
// compteur incrémental : reste juste même si l'onglet est mis en arrière-
// plan puis reactivé (pas de rattrapage brutal). Rotation posée frame par
// frame, jamais par une transition CSS sur le transform des aiguilles,
// sinon le passage de 359° à 0° à chaque tour se rejouerait comme un tour
// complet à l'envers au lieu d'un saut instantané.
// Sous prefers-reduced-motion : repli sur l'heure réelle, mise à jour une
// fois par minute seulement (pas de balayage continu, qui est lui
// purement décoratif) - une horloge qui indique l'heure plutôt qu'un
// spinner qui tourne vite reste plus approprié pour ce préférence.
function initInfoCardClock() {
  const hourHand = document.querySelector('.info-card-clock-hand-hour');
  const minuteHand = document.querySelector('.info-card-clock-hand-minute');
  const secondHand = document.querySelector('.info-card-clock-hand-second');
  if (!hourHand || !minuteHand || !secondHand) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    function renderRealTime() {
      const now = new Date();
      const minutes = now.getMinutes();
      const hours = (now.getHours() % 12) + minutes / 60;
      hourHand.style.transform = `rotate(${hours * 30}deg)`;
      minuteHand.style.transform = `rotate(${minutes * 6}deg)`;
      secondHand.style.transform = `rotate(${now.getSeconds() * 6}deg)`;
    }
    renderRealTime();
    setInterval(renderRealTime, 60000);
    return;
  }

  const HOUR_PERIOD_MS = 48000;
  const MINUTE_PERIOD_MS = 12000;
  const SECOND_PERIOD_MS = 2000;
  const start = performance.now();

  function loop(now) {
    const elapsed = now - start;
    hourHand.style.transform = `rotate(${(elapsed % HOUR_PERIOD_MS) / HOUR_PERIOD_MS * 360}deg)`;
    minuteHand.style.transform = `rotate(${(elapsed % MINUTE_PERIOD_MS) / MINUTE_PERIOD_MS * 360}deg)`;
    secondHand.style.transform = `rotate(${(elapsed % SECOND_PERIOD_MS) / SECOND_PERIOD_MS * 360}deg)`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
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

// Vrai tant que l'atterrissage de la carte centrale et/ou des 6 cartes
// flottantes (playHeroCardEntrance/playHeroFloatCardsEntrance ci-dessous)
// est en cours - posé au premier chargement et à chaque retour vers
// l'accueil (goBackward/replayHomeEntrance, initHeroPageTransition). Lu par
// goForward (initHeroPageTransition) pour ignorer un geste de scroll vers
// l'avant tant que l'atterrissage n'est pas terminé : sans cette garde, un
// scroll trop rapide coupe l'atterrissage en plein vol (renderHeroExit/
// renderFloatCardsExit posent `animation:none` puis un `transform` calculé
// depuis la position de repos), ce qui fait "téléporter" la carte/les
// cartes flottantes à cette position avant de repartir vers services - un
// décroché bien visible plutôt qu'un enchaînement fluide.
let heroEntranceCount = 0;
function isHeroEntranceActive() {
  return heroEntranceCount > 0;
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
// extraDelayMs (retour services → accueil uniquement, cf. animateTo dans
// initHeroPageTransition) décale l'atterrissage entier, pour que la carte ne
// commence à apparaître qu'une fois la rangée de contenu (.services-intro-
// row) bien avancée dans sa dispersion, plutôt qu'en même temps qu'elle.
// ─────────────────────────────────────────────
function playHeroCardEntrance(card, extraDelayMs = 0) {
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
  card.style.animationDelay = extraDelayMs > 0 ? `${extraDelayMs / 1000}s` : '';

  card.classList.add('is-entering');
  heroEntranceCount++;
  card.addEventListener('animationend', function onEnd(e) {
    if (e.animationName !== 'heroCardDrop') return;
    card.classList.remove('is-entering');
    card.style.animationDelay = '';
    card.removeEventListener('animationend', onEnd);
    heroEntranceCount--;
  });
}

// Même principe que playHeroCardEntrance ci-dessus, mais pour les 6 cartes
// flottantes (icônes de service) : chacune survole depuis le haut de son
// propre point de départ (--hfc-entrance-rise, remesurée à chaque rejeu),
// avec un décalage croissant par carte (--entrance-delay, posé en HTML) pour
// qu'elles n'arrivent jamais toutes en même temps. Rejouable comme
// playHeroCardEntrance (premier chargement + retour arrière services →
// accueil, cf. animateTo dans initHeroPageTransition).
// extraDelayMs (retour services → accueil uniquement, cf. animateTo) décale
// l'atterrissage tout entier après --entrance-delay, pour que les 6 cartes ne
// commencent à apparaître qu'une fois la rangée de contenu (.services-intro-
// row) entièrement effacée, plutôt qu'en même temps que sa sortie.
function playHeroFloatCardsEntrance(extraDelayMs = 0) {
  const cards = document.querySelectorAll('.hero-float-card');
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  cards.forEach((card) => {
    const prevTransform = card.style.transform;
    const prevAnimation = card.style.animation;
    card.style.animation = 'none';
    card.style.transform = 'none';
    const rect = card.getBoundingClientRect();
    card.style.transform = prevTransform;
    card.style.animation = prevAnimation;
    card.style.setProperty('--hfc-entrance-rise', `${-(rect.top + rect.height + 80)}px`);
    // Variante mobile (cf. heroFloatCardDropSide, styles.css) : distance
    // jusqu'au coin d'écran le plus proche (gauche/droite ET haut/bas)
    // plutôt que jusqu'en haut de l'écran, pour une carte qui glisse en
    // diagonale depuis son coin. Calculée dans tous les cas (coût
    // négligeable) même si seul le palier téléphone l'utilise réellement.
    const entersFromLeft = rect.left + rect.width / 2 < viewportWidth / 2;
    const riseX = entersFromLeft ? -(rect.right + 80) : (viewportWidth - rect.left + 80);
    card.style.setProperty('--hfc-entrance-rise-x', `${riseX}px`);
    const entersFromTop = rect.top + rect.height / 2 < viewportHeight / 2;
    const riseY = entersFromTop ? -(rect.top + rect.height + 80) : (viewportHeight - rect.top + 80);
    card.style.setProperty('--hfc-entrance-rise-y', `${riseY}px`);

    if (extraDelayMs > 0) {
      const baseDelay = parseFloat(getComputedStyle(card).getPropertyValue('--entrance-delay')) || 0;
      card.style.animationDelay = `${baseDelay + extraDelayMs / 1000}s`;
    }

    card.classList.add('is-entering');
    heroEntranceCount++;
    card.addEventListener('animationend', function onEnd(e) {
      if (e.animationName !== 'heroFloatCardDrop' && e.animationName !== 'heroFloatCardDropSide') return;
      card.classList.remove('is-entering');
      card.removeEventListener('animationend', onEnd);
      heroEntranceCount--;
    });
  });
}

// ─────────────────────────────────────────────
// Repositionnement des 4 cartes flottantes visibles sur mobile (hfc-1..4,
// cf. palier téléphone <=768px dans styles.css). Les offsets fixes posés en
// CSS (top/bottom en px) supposent une hauteur d'écran "courante" ; sur les
// téléphones plus courts, ou dès que le texte du hero prend plus de place
// que prévu, la carte de contenu (#heroContent) peut grandir jusqu'à
// chevaucher ces offsets fixes. Cette fonction mesure la position réelle du
// contenu et replace chaque carte dans l'espace qui reste effectivement
// libre au-dessus (hfc-1/2) ou en dessous (hfc-3/4), en la rétrécissant si
// cet espace est trop court plutôt que de la laisser chevaucher le texte —
// et la masque si vraiment aucune place utile ne reste (écrans très bas).
// Rejouée au chargement, avant playHeroFloatCardsEntrance (pour que la
// distance de survol d'entrée se mesure déjà sur la bonne position finale),
// puis à chaque redimensionnement/rotation/chargement de police (cf. appels
// plus bas), aucun de ces événements ne devant laisser une ancienne position
// invalide en place.
function layoutMobileHeroFloatCards() {
  if (!window.matchMedia('(max-width: 768px)').matches) return;

  const hero = document.querySelector('.hero');
  const content = document.getElementById('heroContent');
  const topCards = [document.querySelector('.hfc-1'), document.querySelector('.hfc-2')];
  const bottomCards = [document.querySelector('.hfc-3'), document.querySelector('.hfc-4')];
  if (!hero || !content || topCards.some((c) => !c) || bottomCards.some((c) => !c)) return;

  const heroRect = hero.getBoundingClientRect();
  const contentRect = content.getBoundingClientRect();
  const contentTop = contentRect.top - heroRect.top;
  const contentBottom = contentRect.bottom - heroRect.top;

  const margin = 18; // marge mini garantie entre une carte et le contenu central
  // .hero a overflow:hidden (cf. styles.css) : l'ombre de .hfc-glass (box-shadow
  // 0 12px 26px) déborde d'environ 38px sous la carte. Une marge de bord trop
  // courte la fait couper net pile à la frontière avec #services, dessinant une
  // ligne parasite à la jonction des deux sections - cette marge doit donc
  // couvrir ce débordement, pas juste "coller" la carte au bord de l'écran.
  const edgeMargin = 44;
  const navClearance = 70; // dégagement mini sous la nav fixe (haut)
  const maxSize = 78; // taille par défaut du palier téléphone (cf. --hfc-size, styles.css)
  const minSize = 44; // en dessous, une carte n'apporte plus rien visuellement : on la masque

  // ratios : position de chaque carte dans l'espace dispo (0 = collée au
  // bord loin du contenu, 1 = collée au bord proche du contenu), pour
  // garder un léger décalage entre les deux cartes d'une même paire plutôt
  // qu'un empilement parfaitement symétrique (même esprit que les offsets
  // distincts 200/254 et 100/90 du CSS d'origine).
  function layoutPair(cards, spaceAvailable, from, edgeStart, ratios) {
    const size = Math.min(maxSize, spaceAvailable);
    if (size < minSize) {
      cards.forEach((c) => { c.style.display = 'none'; });
      return;
    }
    cards.forEach((c) => { c.style.display = ''; });
    const slack = Math.max(0, spaceAvailable - size);
    cards.forEach((card, i) => {
      card.style.setProperty('--hfc-size', `${size}px`);
      const offset = edgeStart + slack * ratios[i];
      if (from === 'top') {
        card.style.top = `${offset}px`;
        card.style.bottom = 'auto';
      } else {
        card.style.bottom = `${offset}px`;
        card.style.top = 'auto';
      }
    });
  }

  const topSpace = contentTop - navClearance - margin;
  layoutPair(topCards, topSpace, 'top', navClearance, [0.2, 0.7]);

  const bottomSpace = heroRect.height - contentBottom - margin - edgeMargin;
  layoutPair(bottomCards, bottomSpace, 'bottom', edgeMargin, [0.7, 0.2]);
}

let mobileHfcResizeTimer = null;
function scheduleLayoutMobileHeroFloatCards() {
  clearTimeout(mobileHfcResizeTimer);
  mobileHfcResizeTimer = setTimeout(layoutMobileHeroFloatCards, 120);
}
window.addEventListener('resize', scheduleLayoutMobileHeroFloatCards, { passive: true });
window.addEventListener('orientationchange', scheduleLayoutMobileHeroFloatCards);
// Le swap de police web (display:swap, cf. index.html) peut changer la
// hauteur du texte après la première mesure : on rejoue une fois les polices
// prêtes pour rattraper un éventuel décalage.
if (window.document.fonts && window.document.fonts.ready) {
  window.document.fonts.ready.then(layoutMobileHeroFloatCards);
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

  // Repositionne d'abord les 4 cartes flottantes mobiles (no-op au-dessus de
  // 768px) : playHeroFloatCardsEntrance, plus bas, mesure leur position pour
  // calculer la distance de survol d'entrée — elle doit donc déjà être
  // correcte à ce stade.
  layoutMobileHeroFloatCards();

  const title = card.querySelector('h1');
  const desc = card.querySelector('p');
  if (title) wrapWordsForReveal(title);
  if (desc) wrapWordsForReveal(desc);

  // .is-entering est déjà posé en HTML : playHeroCardEntrance se contente
  // ici de mesurer la distance et d'armer le nettoyage de fin d'animation.
  playHeroCardEntrance(card);
  // Idem pour les 6 cartes flottantes (.is-entering déjà posé en HTML aussi).
  playHeroFloatCardsEntrance();
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
  const heroFloatCards = Array.from(document.querySelectorAll('.hero-float-card'));
  const nav = document.querySelector('.nav');
  const services = document.getElementById('services');
  const servicesIntroHeading = document.getElementById('servicesIntroHeading');
  const servicesIntroRow = document.getElementById('servicesIntroRow');
  const servicesBlobs = Array.from(document.querySelectorAll('.services-ambient-blob'));
  const devisWaveFall = document.getElementById('devisWaveFall');
  const devisWaveFallInner = document.getElementById('devisWaveFallInner');
  const devisWavePath = document.getElementById('devisWavePath');
  const devisPage = document.getElementById('devisPage');
  if (!stage || !heroContent || !heroWarmLight || !services || servicesBlobs.length !== 4) return;
  if (!devisWaveFall || !devisWaveFallInner || !devisWavePath || !devisPage) return;

  document.documentElement.classList.add('is-paged');

  // Titre + description de l'intro services : découpés mot par mot (même
  // wrapWordsForReveal que le titre du hero, cf. plus haut) pour une
  // animation d'écriture (cf. playIntroHeadingReveal plus bas), au lieu
  // d'un simple fondu du bloc entier. Fait uniquement ici (jamais sur
  // mobile/reduced-motion, cf. gardes en tout début de fonction) : ce texte
  // y reste du texte brut, immédiatement lisible, sans étape de révélation.
  // Les mots sont posés "animation:none" + "opacity:0" juste après le
  // découpage - "animation:none" seul ne suffit PAS à les cacher : sans
  // animation active, .hero-reveal-word retombe sur son opacité de base
  // (1, aucune règle non-animée ne la fixe à 0), donc le texte resterait
  // visible en permanence dès le chargement sans ce style inline explicite.
  // playIntroHeadingReveal (plus bas) retire ce blocage au bon moment.
  let introWordEls = [];
  if (servicesIntroHeading) {
    const introTitle = servicesIntroHeading.querySelector('h2');
    const introDesc = servicesIntroHeading.querySelector('p');
    if (introTitle) wrapWordsForReveal(introTitle);
    if (introDesc) wrapWordsForReveal(introDesc);
    introWordEls = Array.from(servicesIntroHeading.querySelectorAll('.hero-reveal-word'));
    introWordEls.forEach((el) => { el.style.animation = 'none'; el.style.opacity = '0'; });
  }
  let introWordsRevealed = false;
  // Déclenche l'écriture mot par mot : retire d'abord le blocage d'opacité
  // (l'animation, elle, reprendra la main sur l'opacité dès qu'elle
  // redémarre - la retirer avant évite un flash à l'opacité de base entre
  // les deux) puis force un reflow avant de relâcher `animation` - même
  // technique que replayHeroContentWords pour le hero, seule façon fiable
  // de faire redémarrer une animation CSS déjà "armée".
  function playIntroHeadingReveal() {
    introWordEls.forEach((el) => { el.style.animation = 'none'; el.style.opacity = ''; });
    if (servicesIntroHeading) void servicesIntroHeading.offsetWidth;
    introWordEls.forEach((el) => { el.style.animation = ''; });
  }
  // Symétrique : remet le blocage (animation ET opacité), pour que
  // l'écriture puisse rejouer proprement si l'utilisateur revient en
  // arrière avant ce seuil puis rescroll à nouveau vers services.
  function resetIntroHeadingReveal() {
    introWordEls.forEach((el) => { el.style.animation = 'none'; el.style.opacity = '0'; });
  }

  const DURATION_MS = 900;
  // Durée de la course accueil <-> services uniquement (cf. animateTo plus
  // bas) : sert surtout au déclenchement de .lights-active (reste de la
  // page) à la fin. Ni la carte centrale (HERO_CARD_EXIT_DURATION_MS), ni
  // les 6 cartes flottantes (FLOAT_CARDS_DURATION_MS), ni le fondu croisé
  // (CROSSFADE_DELAY_MS/FADE_MS, plus bas) ne dépendent plus de cette durée
  // - chacun a sa propre échelle de temps réelle et linéaire, pour que
  // leurs décalages/délais respectifs (FLOAT_CARDS_EXIT_DELAY...)
  // correspondent à un temps réel prévisible plutôt qu'à une fraction d'une
  // courbe globale déjà adoucie (ce qui rendait un "léger décalage" bien
  // plus long que prévu en pratique).
  const PAGE_TRANSITION_DURATION_MS = 3300;
  // Durée de la sortie de LA CARTE CENTRALE elle-même (heroContent) :
  // volontairement identique à DURATION_MS (900ms, son rythme d'origine,
  // inchangé) plutôt que PAGE_TRANSITION_DURATION_MS ci-dessus. cf.
  // animateTo plus bas, qui calcule sa propre progression (heroCardProgress)
  // sur cette durée courte, indépendamment de `progress`.
  const HERO_CARD_EXIT_DURATION_MS = DURATION_MS;
  // Durée totale (réelle, linéaire) de la chorégraphie des 6 cartes
  // flottantes (assemblage + descente, cf. FLOAT_CARDS_EXIT_DELAY et suite
  // plus bas) : indépendante de PAGE_TRANSITION_DURATION_MS, pour que
  // FLOAT_CARDS_EXIT_DELAY (le délai avant que les cartes ne bougent,
  // volontairement léger) corresponde à un vrai temps court plutôt qu'à une
  // fraction d'une courbe globale beaucoup plus lente au démarrage. cf.
  // animateTo plus bas, qui calcule sa propre progression LINÉAIRE
  // (floatCardsProgress, jamais pré-adoucie) sur cette durée.
  // L'assemblage se termine à floatCardsP=0.69 (cf. FLOAT_CARDS_EXIT_DELAY +
  // 4*STAGGER + ASSEMBLE_WINDOW plus bas), soit ~1277ms - le reste jusqu'à
  // 1850ms n'est qu'un temps mort, ligne immobile : gardé assez long pour ne
  // jamais couper l'assemblage (cf. CROSSFADE_DELAY_MS ci-dessous, qui elle
  // démarre bien avant la fin de cette durée) sans pour autant ralentir
  // l'assemblage lui-même, qui reste cadencé sur cette même durée.
  const FLOAT_CARDS_DURATION_MS = 1850;
  // Fondu croisé de #services (cf. crossfadeProgress dans animateTo plus
  // bas, calculée à partir de ces deux constantes) : ne doit commencer
  // qu'une fois les 6 cartes flottantes ENTIÈREMENT immobiles à leur
  // position finale (~1387ms, cf. FLOAT_CARDS_DURATION_MS ci-dessus), jamais
  // avant, sous peine de voir la rangée réelle apparaître dessous pendant
  // que la carte flottante est encore en train de descendre les derniers
  // pixels (cf. renderFloatCardsExit) - un simple découpage de `p` (adoucie
  // sur toute la course, donc extrêmement compressée dans son dernier
  // centième) s'est avéré trop imprécis pour garantir ce délai de façon
  // fiable. Temps réel et linéaire, comme HERO_CARD_EXIT_DURATION_MS/
  // FLOAT_CARDS_DURATION_MS ci-dessus : le fondu démarre pile
  // CROSSFADE_DELAY_MS après le début de la course et dure CROSSFADE_FADE_MS.
  // Volontairement plus proche de la fin de l'assemblage qu'avant (~112ms
  // d'écart au lieu de ~522ms) : la pause avant que la rangée ne s'abaisse
  // (cf. ROW_DESCEND_DELAY_MS plus bas, qui en dépend) se voulait plus courte
  // une fois les cartes alignées.
  const CROSSFADE_DELAY_MS = 1500;
  const CROSSFADE_FADE_MS = 400;
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

  // Sortie des 6 cartes flottantes — UN SEUL temps, l'ASSEMBLAGE : chaque
  // carte rejoint, via une courbe (jamais une ligne droite), une ligne
  // horizontale centrée au milieu de l'écran (là où se trouvait la carte
  // centrale du hero) — cf. measureFloatCardsExitTargets pour la cible
  // (assembleDx/Dy) et renderFloatCardsExit pour la courbe elle-même.
  // Décalage croissant par carte (FLOAT_CARD_STAGGER) pour qu'elles
  // n'arrivent jamais toutes en même temps, comme 6 éléments qui flottent et
  // se posent l'un après l'autre plutôt qu'en bloc. Une fois assemblées, les
  // cartes restent immobiles : la DESCENTE proprement dite n'est plus jouée
  // par ces cartes flottantes mais par .services-intro-row elle-même (la
  // vraie rangée de la page), qui prend le relais après le fondu croisé -
  // cf. rowDescendProgress dans animateTo plus bas, et son usage dans
  // render().
  //
  // Association par icône, pas par simple ordre du DOM : la Nème
  // .hero-float-card (tableau ci-dessus, ordre hfc-1..hfc-6) rejoint le slot
  // FLOAT_CARD_SLOT_ORDER[N] dans .services-intro-row (index.html) - cette
  // rangée a un ordre volontairement différent (peinture puis panier en
  // tête), donc l'ancienne correspondance "Nème carte -> Nème slot du DOM"
  // ne suffit plus : ce tableau fait toujours atterrir chaque carte dans le
  // slot portant SA PROPRE icône, quelle que soit sa position dans la
  // rangée. hfc-1 (brouette) -> slot d'index 2, hfc-2 (fleur) -> 3, hfc-3
  // (peinture) -> 0, hfc-4 (panier) -> 1, hfc-5 (poubelle) -> 4 (inchangé),
  // hfc-6 (clé) -> 5 (inchangé). Les cibles sont mesurées en coordonnées
  // viewport (measureFloatCardsExitTargets), comme measureHeroExitRise
  // ci-dessus — #services est position:fixed (opacity 0 au repos mais bien
  // mis en page), donc sa rangée d'icônes est mesurable même avant le fondu
  // croisé.
  const introSlots = Array.from(document.querySelectorAll('.services-intro-slot'));
  const FLOAT_CARD_SLOT_ORDER = [2, 3, 0, 1, 4, 5];
  // Toutes les fractions ci-dessous (FLOAT_CARDS_EXIT_DELAY, STAGGER,
  // ASSEMBLE_WINDOW, DESCEND_START/END) s'appliquent à floatCardsProgress
  // (cf. animateTo plus bas) : une progression LINÉAIRE en temps réel sur
  // FLOAT_CARDS_DURATION_MS (2300ms), jamais pré-adoucie par une courbe
  // globale - une fraction de 0.05 correspond donc bien à 5% de 2300ms
  // (~115ms), de façon prévisible, contrairement à l'ancienne version qui se
  // basait sur `p` (adoucie sur toute la course accueil→services) : un délai
  // "léger" y correspondait en réalité à un temps réel bien plus long,
  // puisque cette courbe démarre très lentement.
  //
  // Décalage avant que les 6 cartes ne commencent elles-mêmes à bouger :
  // volontairement léger - la carte centrale du hero (cf. renderHeroExit,
  // sur sa propre durée courte HERO_CARD_EXIT_DURATION_MS) entame sa sortie
  // une fraction de seconde avant les cartes flottantes, sans que les deux
  // animations ne paraissent totalement dissociées.
  const FLOAT_CARDS_EXIT_DELAY = 0.05;
  // Décalage entre chaque carte pendant l'assemblage : combiné à
  // FLOAT_CARD_ASSEMBLE_WINDOW ci-dessous, la carte suivante ne démarre son
  // propre trajet qu'après que la précédente ait bien entamé le sien, pour
  // un effet de cascade bien lisible plutôt que 6 cartes qui bougent
  // quasiment en même temps.
  const FLOAT_CARD_STAGGER = 0.06;
  // Durée (large) du trajet courbé d'UNE carte vers la ligne centrale :
  // chaque carte dispose d'un temps confortable (~40% de
  // FLOAT_CARDS_DURATION_MS, soit un peu plus de 900ms) pour un mouvement
  // bien smooth plutôt qu'expédié.
  const FLOAT_CARD_ASSEMBLE_WINDOW = 0.4;
  // Intensité de la courbure (proportion de la distance à parcourir) :
  // le point de contrôle de la Bézier est décalé perpendiculairement à la
  // ligne départ→arrivée d'autant, ce qui garantit une vraie courbe (jamais
  // une ligne droite, quels que soient les points) plutôt qu'un simple arc
  // approximatif.
  const FLOAT_CARD_BULGE_RATIO = 0.32;
  // Dernière carte (data-exit-order max = 4, peinture) assemblée à
  // FLOAT_CARDS_EXIT_DELAY + 4 * FLOAT_CARD_STAGGER + FLOAT_CARD_ASSEMBLE_WINDOW
  // = 0.69. Les 6 cartes flottantes s'arrêtent là : au lieu de continuer leur propre
  // descente jusqu'à la rangée, elles restent immobiles (le reste de
  // floatCardsProgress, jusqu'à 1, sert de temps mort) pendant que
  // .services-intro-row (la VRAIE rangée de la page, cf. plus bas) se
  // superpose exactement à leur position via le fondu croisé, puis prend le
  // relais pour sa propre descente (cf. rowDescendProgress dans animateTo,
  // et son usage dans render()) - une seule ligne réelle anime la descente,
  // jamais les cartes flottantes elles-mêmes.
  // Easing dédié au déplacement des 6 cartes (assemblage) :
  // plus doux qu'easeInOutCubic (utilisée ailleurs, ex. sortie de la carte
  // centrale) - accélération/décélération plus progressives aux deux
  // extrémités, pour un mouvement bien fluide, jamais brusque, qui démarre
  // et se termine tout en douceur.
  function easeInOutSoft(t) {
    return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
  }
  // Inclinaison 3D statique de chaque .hfc-inner (cf. .hfc-N .hfc-inner,
  // styles.css) : redressée à 0 en JS au fil de l'assemblage, pour que la
  // carte arrive bien à plat sur la ligne plutôt que penchée.
  const HFC_TILT = [
    { ry: 18, rx: -6 },
    { ry: -18, rx: -6 },
    { ry: 18, rx: 6 },
    { ry: -18, rx: 6 },
    { ry: 20, rx: 0 },
    { ry: -20, rx: 0 },
  ];
  // Position le long d'une courbe départ(0,0) → arrivée (dx,dy) à l'instant
  // t (0..1) : la composante (dx*t, dy*t) avance en ligne droite (garantit
  // une progression toujours nette vers la cible, jamais un mouvement qui
  // recule ou piétine), à laquelle s'ajoute un arc perpendiculaire
  // (perpX/perpY * bulge * sin(π·t)) qui vaut exactement 0 en t=0 ET t=1
  // (la carte part bien de sa position réelle et arrive bien pile sur sa
  // cible) et culmine à mi-parcours - d'où une vraie courbe, jamais une
  // ligne droite dès que bulge != 0, sans jamais de "faux départ" à
  // rebours ni de virage brusque (le sinus est lisse par nature).
  function floatCardCurvedOffset(t, dx, dy, perpX, perpY, bulge) {
    const arc = Math.sin(Math.PI * t) * bulge;
    return {
      x: dx * t + perpX * arc,
      y: dy * t + perpY * arc,
    };
  }
  function measureFloatCardsExitTargets() {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    heroFloatCards.forEach((card, i) => {
      const slot = introSlots[FLOAT_CARD_SLOT_ORDER[i]];
      if (!slot) return;
      // offsetTop/offsetLeft/offsetWidth/offsetHeight (contrairement à
      // getBoundingClientRect) ignorent tout `transform` en cours - qu'il
      // vienne de l'atterrissage d'entrée (.is-entering, heroFloatCardDrop),
      // de la dérive continue au repos (heroFloatCardDrift) ou d'un
      // transform JS inline (assemblage en cours) - et donnent donc
      // directement la position de repos CSS pure de la carte, déjà
      // viewport-relative puisque .hero-float-card est position:fixed sans
      // ancêtre transformé (cf. plus haut). Utilisées ici À LA PLACE de
      // l'ancien couple transform:none/animation:none + getBoundingClientRect
      // (qui neutralisait temporairement `animation` avant de la restaurer) :
      // ce couple forçait un reflow (getBoundingClientRect) pendant que
      // `animation` valait "none", ce qui - si la carte avait encore sa
      // classe .is-entering à cet instant, l'atterrissage n'étant piloté par
      // AUCUN `animation` inline mais par la règle CSS de cette classe -
      // relançait l'atterrissage depuis son tout début (délai d'entrée
      // compris) au lieu de le laisser continuer : perçu comme les cartes
      // qui remontent brutalement hors de l'écran avant de rejouer leur
      // arrivée. Se produisait de façon certaine à CHAQUE chargement (cet
      // appel a lieu juste après le déclenchement de l'entrée, cf.
      // initHeroCardEntrance avant initHeroPageTransition) et pouvait se
      // reproduire à chaque resize survenant encore pendant l'atterrissage
      // (cf. garde isHeroEntranceActive() sur onResize, plus bas - qui ne
      // protégeait que CET appel-là, jamais celui-ci, le tout premier,
      // inconditionnel). Mesurer via offsetTop/Left/Width/Height élimine le
      // problème à la racine, quel que soit le moment de l'appel.
      const startCx = card.offsetLeft + card.offsetWidth / 2;
      const startCy = card.offsetTop + card.offsetHeight / 2;

      // Pas de mise à l'échelle : .services-intro-slot partage le même
      // --hfc-size que .hero-float-card à chaque palier (cf. styles.css),
      // donc la carte garde son design et ses dimensions d'origine du hero
      // jusqu'à la rangée - seule sa position change.
      const slotRect = slot.getBoundingClientRect();
      const slotCx = slotRect.left + slotRect.width / 2;
      const slotCy = slotRect.top + slotRect.height / 2;

      // Cible d'assemblage : directement le slot réel de la rangée finale
      // (même x ET même y), pas une ligne intermédiaire au centre du
      // viewport - les cartes atterrissent donc pile là où elles doivent
      // rester, sans étape de "descente" supplémentaire ensuite (cf.
      // floatCardsDescendDy, retiré : toujours 0 maintenant que la cible EST
      // la position finale). Ancien comportement : assembleDy visait le
      // centre du viewport, puis .services-intro-row (la vraie rangée)
      // s'abaissait depuis cette ligne jusqu'à sa position réelle une fois
      // le fondu croisé lancé (cf. render()) - un mouvement additionnel
      // demandé à retirer : la rangée doit désormais rester immobile une
      // fois alignée, seuls le titre/la description au-dessus et le reste
      // de la page se révèlent ensuite.
      card.dataset.assembleDx = String(slotCx - startCx);
      card.dataset.assembleDy = String(slotCy - startCy);

      // Direction "vers l'extérieur" (du centre du viewport vers la
      // position de départ de la carte), normalisée : sert uniquement à
      // choisir de quel côté la courbe bulge (cf. renderFloatCardsExit),
      // jamais directement comme déplacement - reste basée sur le centre du
      // viewport (pas le slot) : ce n'est qu'un repère de direction pour la
      // courbure, indépendant de la cible réelle de la carte.
      const outX = startCx - centerX;
      const outY = startCy - centerY;
      const outMag = Math.hypot(outX, outY) || 1;
      card.dataset.outX = String(outX / outMag);
      card.dataset.outY = String(outY / outMag);
    });
  }
  measureFloatCardsExitTargets();

  // Distance de montée jusqu'à disparition, propre à chaque carte (même
  // principe que measureHeroExitRise pour la carte centrale, mais une valeur
  // par carte puisque leur position de départ dans le hero diffère) — sert à
  // renderFloatCardsExitUp ci-dessous, la variante "montée + fondu" jouée
  // uniquement à l'ouverture de Devis depuis l'accueil (jamais pendant la
  // transition vers services, qui garde l'assemblage existant ; cf.
  // floatCardsExitMode).
  let floatCardsRiseExitPx = [];
  function measureFloatCardsRiseExit() {
    // offsetTop/offsetHeight plutôt que transform:none/animation:none +
    // getBoundingClientRect : même raison qu'au-dessus, dans
    // measureFloatCardsExitTargets (relance sinon l'atterrissage d'entrée en
    // cours si la carte a encore sa classe .is-entering à cet instant).
    floatCardsRiseExitPx = heroFloatCards.map((card) => card.offsetTop + card.offsetHeight + 80);
  }
  measureFloatCardsRiseExit();

  // Bascule entre les deux animations de sortie des 6 cartes flottantes :
  // 'assemble' (existante, cf. renderFloatCardsExit) pendant la transition
  // accueil ↔ services, 'rise' (cf. renderFloatCardsExitUp) à l'ouverture de
  // Devis depuis l'accueil. Choisie par render()/renderDevisFromHome à chaque
  // appel (donc toujours à jour à la frame suivante) ; onResize (plus bas) ne
  // la modifie jamais, pour réappliquer la bonne animation quelle que soit
  // celle en cours au moment du redimensionnement.
  let floatCardsExitMode = 'assemble';

  // Sens de sortie de LA VRAIE RANGÉE (.services-intro-row) : 'settle' (vers
  // services, comportement d'origine, cf. render()) ou 'fade-down' (retour
  // vers l'accueil : les 6 cartes se dispersent en tombant vers le bas de
  // l'écran, chacune avec sa propre trajectoire CSS, cf. ROW_CARD_FALL et
  // playServicesIntroRowExit plus bas) — posé par animateTo() selon la
  // cible, lu par render() à chaque frame.
  let rowExitDirection = 'settle';
  // Trajectoire de sortie propre à chacune des 6 .services-intro-slot
  // (retour vers l'accueil, cf. playServicesIntroRowExit) : dx/dy
  // (translation, px) + rot (rotation, deg), un jeu de valeurs par carte pour
  // qu'elles se dispersent plutôt que de tomber toutes selon la même ligne
  // verticale - même esprit que HFC_TILT plus haut (un tableau de variations
  // fixes, indexé comme les 6 .services-intro-slot du DOM). dx croît de
  // façon strictement monotone de gauche (le plus négatif) à droite (le plus
  // positif) : chaque carte s'écarte donc TOUJOURS de sa voisine (jamais vers
  // elle), quelle que soit la paire considérée - condition suffisante pour
  // qu'aucune ne recouvre sa voisine pendant la chute, l'écart entre deux
  // cartes adjacentes ne pouvant que grandir avec le temps. L'ancien jeu de
  // valeurs (signes alternés, pas liés à la position dans la rangée)
  // pouvait au contraire rapprocher deux cartes voisines l'une de l'autre,
  // d'où la superposition observée. Le fondu de sortie, lui, est posé
  // directement dans le keyframe CSS (.is-falling, cf. styles.css) : la
  // carte tombe et se disperse d'abord, nettement visible, puis s'estompe
  // sur la fin de son propre trajet.
  const ROW_CARD_FALL = [
    { dx: -30, dy: 225, rot: -7 },
    { dx: -18, dy: 205, rot: -4 },
    { dx: -7,  dy: 235, rot: -2 },
    { dx: 7,   dy: 210, rot: 2 },
    { dx: 18,  dy: 230, rot: 4 },
    { dx: 30,  dy: 215, rot: 7 },
  ];
  // Décalage croissant par carte (fraction de ROW_DESCEND_DURATION_MS, cf.
  // playServicesIntroRowExit) : la carte d'index 0 commence à tomber dès le
  // début de la course, les suivantes un peu après - un vrai effet de
  // dispersion plutôt que 6 cartes qui tombent en un seul bloc rigide.
  // Combiné à ROW_CARD_FALL_WINDOW ci-dessous, la dernière carte (index 5)
  // termine sa chute pile à la fin de la course (5 * 0.07 + 0.65 = 1).
  const ROW_CARD_STAGGER = 0.07;
  const ROW_CARD_FALL_WINDOW = 0.65;

  // delayedP<=0 (donc p <= FLOAT_CARDS_EXIT_DELAY) : rien à faire, la dérive
  // continue (heroFloatCardDrift, CSS) garde la main sur `transform` — ne
  // jamais désactiver l'animation pour une valeur de repos, sinon la dérive
  // resterait figée en dehors de toute transition. Au-delà, `animation:none`
  // inline (prioritaire sur la classe) laisse ce rendu piloter `transform`
  // frame par frame ; resetHeroFloatCardsToIdle (plus bas) rend la main à la
  // dérive une fois revenu à l'accueil. L'ordre d'assemblage (data-exit-order,
  // posé en HTML) part du haut vers le bas — l'inverse de l'ordre d'arrivée
  // (--entrance-delay, bas → centre → haut), plutôt que le simple ordre du
  // DOM. Les cartes restent nettes et opaques (pas de fondu/flou : ce n'est
  // pas une disparition) — c'est le fondu croisé de #services
  // (crossfadeProgress, cf. render() plus bas) qui les recouvre
  // progressivement une fois la ligne posée dans la rangée.
  function renderFloatCardsExit(p) {
    const delayedP = Math.max(p - FLOAT_CARDS_EXIT_DELAY, 0);
    if (delayedP <= 0) return;

    heroFloatCards.forEach((card, i) => {
      const offset = Number(card.dataset.exitOrder || 0) * FLOAT_CARD_STAGGER;
      const assembleT = Math.min(Math.max((delayedP - offset) / FLOAT_CARD_ASSEMBLE_WINDOW, 0), 1);
      const easedAssembleT = easeInOutSoft(assembleT);

      const adx = Number(card.dataset.assembleDx) || 0;
      const ady = Number(card.dataset.assembleDy) || 0;
      const outX = Number(card.dataset.outX) || 0;
      const outY = Number(card.dataset.outY) || 0;

      // Arc PERPENDICULAIRE à la ligne départ→arrivée (jamais le long de
      // cette ligne, ce qui garantit une vraie courbe même quand la carte
      // part déjà presque alignée avec sa cible) ; le sens de cet arc
      // (lequel des deux côtés perpendiculaires) est choisi pour qu'il
      // bulge vers l'extérieur de l'écran, comme une carte qui flotterait
      // naturellement avant de venir se ranger, plutôt que de couper à
      // travers le centre.
      const dist = Math.hypot(adx, ady) || 1;
      const dirX = adx / dist;
      const dirY = ady / dist;
      const perpX = -dirY;
      const perpY = dirX;
      const side = (outX * perpX + outY * perpY) >= 0 ? 1 : -1;
      const bulge = dist * FLOAT_CARD_BULGE_RATIO * side;

      const assembled = floatCardCurvedOffset(easedAssembleT, adx, ady, perpX, perpY, bulge);

      card.style.animation = 'none';
      card.style.transform = `translate(${assembled.x}px, ${assembled.y}px)`;

      const tilt = HFC_TILT[i];
      const inner = card.querySelector('.hfc-inner');
      if (inner && tilt) {
        inner.style.transform = `perspective(900px) rotateY(${tilt.ry * (1 - easedAssembleT)}deg) rotateX(${tilt.rx * (1 - easedAssembleT)}deg)`;
      }
    });
  }

  // Deuxième animation de sortie des 6 cartes flottantes, jouée à l'ouverture
  // de Devis depuis l'accueil (cf. floatCardsExitMode/renderDevisFromHome) :
  // au lieu de rejoindre la rangée de services, chaque carte suit la carte
  // centrale du hero et s'envole vers le haut de l'écran en s'estompant —
  // même trajectoire (translateY + scale), même fondu/flou que heroContent
  // (cf. renderHeroExit), pour ne faire qu'un seul mouvement d'ensemble.
  // FLOAT_CARD_RISE_LAG (en fraction de p, cf. p===heroCardP===floatCardsP
  // dans ce cas précis, tous trois égaux à la même progression de
  // DURATION_MS) retarde légèrement chaque carte selon data-exit-order
  // (haut → bas, déjà posé en HTML pour l'assemblage) : un effet de cortège
  // qui suit la carte centrale plutôt que 6 cartes qui décollent toutes en
  // même temps qu'elle.
  const FLOAT_CARD_RISE_LAG = 0.045;
  function renderFloatCardsExitUp(p) {
    heroFloatCards.forEach((card, i) => {
      const lag = Number(card.dataset.exitOrder || 0) * FLOAT_CARD_RISE_LAG;
      const cardP = Math.min(Math.max((p - lag) / (1 - lag), 0), 1);
      const contentT = Math.min(cardP / CONTENT_FADE_END, 1);
      const flightT = Math.pow(contentT, 1.3);
      const risePx = floatCardsRiseExitPx[i] || 0;

      card.style.animation = 'none';
      card.style.opacity = String(1 - contentT);
      card.style.filter = `blur(${7 * contentT}px)`;
      card.style.transform = `translateY(${-risePx * flightT}px) scale(${1 - CONTENT_SHRINK * flightT})`;
    });
  }

  // Remet les cartes flottantes dans leur état de repos (dérive CSS reprend
  // la main) : appelé au retour complet vers l'accueil, avant de rejouer
  // leur arrivée (playHeroFloatCardsEntrance) — jamais pendant une sortie en
  // cours, sinon la dérive reprendrait au milieu du fondu.
  function resetHeroFloatCardsToIdle() {
    heroFloatCards.forEach((card) => {
      card.style.animation = '';
      card.style.animationDelay = '';
      card.style.opacity = '';
      card.style.filter = '';
      card.style.transform = '';
      const inner = card.querySelector('.hfc-inner');
      if (inner) inner.style.transform = '';
    });
  }

  // Déclenche la dispersion des 6 .services-intro-slot (retour vers
  // l'accueil) : posée une seule fois, au moment où rowExitDirection bascule
  // sur 'fade-down' (cf. animateTo) — PAS à chaque frame comme l'ancienne
  // version (qui recalculait/reposait transform+opacity sur les 6 cartes à
  // chaque frame de la course, un coût inutile puisque la trajectoire de
  // chaque carte est connue d'avance). Chaque carte reçoit sa trajectoire
  // (--fall-dx/--fall-dy/--fall-rot, cf. ROW_CARD_FALL) et son délai
  // (--fall-delay, cf. ROW_CARD_STAGGER) en custom properties, puis
  // .is-falling (styles.css) prend le relais : une seule animation CSS par
  // carte, tourne sur le compositeur plutôt que d'être recalculée en JS à
  // chaque frame - nettement plus fluide.
  function playServicesIntroRowExit() {
    const fallDurationMs = ROW_CARD_FALL_WINDOW * ROW_DESCEND_DURATION_MS;
    introSlots.forEach((slot, i) => {
      const fall = ROW_CARD_FALL[i] || ROW_CARD_FALL[0];
      slot.style.setProperty('--fall-dx', `${fall.dx}px`);
      slot.style.setProperty('--fall-dy', `${fall.dy}px`);
      slot.style.setProperty('--fall-rot', `${fall.rot}deg`);
      slot.style.animationDuration = `${fallDurationMs}ms`;
      slot.style.animationDelay = `${i * ROW_CARD_STAGGER * ROW_DESCEND_DURATION_MS}ms`;
      slot.classList.add('is-falling');
    });
  }

  // Symétrique : retire .is-falling et les styles inline posés ci-dessus,
  // pour rendre la main à l'apparence de repos (opacité 1, sans transform) -
  // appelé dès le premier frame d'un retour vers services (cf. render()),
  // avant que la rangée ne rejoue son propre atterrissage (comportement
  // inchangé, cf. rowExitDirection==='settle').
  function resetServicesIntroRowToIdle() {
    introSlots.forEach((slot) => {
      slot.classList.remove('is-falling');
      slot.style.opacity = '';
      slot.style.transform = '';
    });
  }
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
  // disparaissent. Piloté par crossfadeP (cf. animateTo plus bas), PAS `p` -
  // #services est au-dessus du hero (z-index), donc ce fondu couvre aussi
  // progressivement les 6 cartes flottantes assemblées (immobiles, cf.
  // renderFloatCardsExit) PENDANT que .services-intro-row (la VRAIE rangée
  // de la page, cf. index.html), positionnée par JS exactement à la même
  // altitude qu'elles (cf. rowDescendProgress plus bas), apparaît par ce
  // même fondu, pile à cette position : la carte flottante et la rangée
  // réelle se superposent donc parfaitement pendant tout le fondu, sans
  // jamais faire cohabiter deux lignes visibles à des hauteurs différentes.
  // crossfadeP (temps réel, cf. CROSSFADE_DELAY_MS/FADE_MS plus haut) ne
  // démarre qu'une fois les cartes ENTIÈREMENT assemblées, contrairement à un
  // simple découpage de `p` (essayé puis abandonné : sa courbe eased est si
  // compressée dans son dernier centième qu'elle rendait ce délai imprécis).
  // Opacité cible de chaque tache (cf. #services.lights-active .services-
  // ambient-blob-N, styles.css) : reprise ici pour piloter le fondu croisé
  // en JS, en overrideant ces valeurs via inline style (plus prioritaire).
  const SERVICES_BLOB_OPACITY = [0.38, 0.30, 0.34, 0.26];
  // Descente de LA VRAIE RANGÉE (.services-intro-row), qui prend le relais
  // des cartes flottantes une fois le fondu croisé bien entamé (cf.
  // rowDescendProgress dans animateTo) : démarre un peu AVANT la fin du
  // fondu (recouvrement volontaire, pour enchaîner sans rupture visible),
  // et dure ROW_DESCEND_DURATION_MS - généreuse et adoucie (cf.
  // easeInOutSoft), pour une descente bien douce plutôt qu'expédiée.
  // easeInOutSoft étant une quintique, la majorité du trajet est déjà
  // parcourue tôt (~95% dès 70% du temps) - sur une durée courte, ce dernier
  // ralenti tient donc en une poignée de frames et se lit comme un arrêt net
  // plutôt qu'un vrai ralenti. Allonger cette seule durée (sans toucher à
  // easeInOutSoft ni à l'assemblage des cartes flottantes, cf. plus haut)
  // étire ce ralenti final sur davantage de frames bien réelles, pour une
  // arrivée en ligne sensiblement plus douce - le reste de la course
  // (assemblage, fondu) garde exactement le même rythme qu'avant.
  const ROW_DESCEND_DELAY_MS = CROSSFADE_DELAY_MS + CROSSFADE_FADE_MS - 100;
  const ROW_DESCEND_DURATION_MS = 1150;
  // Retour vers l'accueil (cf. animateTo) : la carte centrale et les 6
  // cartes flottantes du hero ne commencent à apparaître qu'après ce délai -
  // ROW_DESCEND_DURATION_MS (le temps que la rangée de contenu ait
  // entièrement fini de se disperser) plus une courte pause supplémentaire,
  // pour un enchaînement net plutôt qu'un atterrissage qui démarre pile au
  // même instant que la dernière carte de contenu ne finisse de s'effacer.
  const HOME_ENTRANCE_DELAY_MS = ROW_DESCEND_DURATION_MS + 150;
  // Écriture du titre + description (#servicesIntroHeading, cf.
  // playIntroHeadingReveal plus haut) : quasiment 0, pour démarrer PILE
  // quand la VRAIE rangée commence à s'abaisser (pas avant - le texte ne
  // doit jamais être visible tant que la ligne n'a pas commencé à bouger,
  // ni les cartes flottantes) - c'est ce tout premier mouvement de descente
  // qui "découvre" le titre posé juste au-dessus, jamais après coup.
  const INTRO_HEADING_WRITE_THRESHOLD = 0.02;

  let page = 0; // 0 = accueil, 1 = services
  let animating = false;
  let progress = 0;
  // Identifiant du "geste" d'entrée en cours (molette, tactile OU clavier -
  // cf. markGestureInput plus bas, appelée en tout premier dans les TROIS
  // gestionnaires wheel/touchstart+touchmove/keydown) : incrémenté dès
  // qu'une entrée arrive après un silence d'au moins GESTURE_GAP_MS - un
  // vrai geste n'envoie JAMAIS ses événements avec un tel trou, même dans sa
  // traîne d'inertie la plus longue (l'inertie décélère en continu, elle ne
  // "s'arrête puis repart" pas). activeTransitionGestureId retient QUEL
  // geste a déclenché la course accueil<->services actuellement en cours ou
  // tout juste terminée (posé dans goForward/goBackward ci-dessous, jamais
  // réinitialisé ailleurs) - y compris un déclenchement par CLIC (liens
  // #services, cf. plus bas), qui capture simplement la valeur courante,
  // sans jamais la faire progresser lui-même.
  //
  // Pourquoi : un vrai geste de molette/trackpad ne s'arrête jamais net -
  // l'inertie envoie encore des événements (parfois avec un signe de deltaY
  // inversé le temps que la vitesse retombe à zéro puis légèrement au-delà)
  // pendant une bonne fraction de seconde après que les doigts ont quitté le
  // pavé, et PAGE_TRANSITION_DURATION_MS (3300ms) suffit largement à ce que
  // cette traîne soit encore active au moment même où la course se termine.
  // Sans cette garde, le tout premier événement résiduel de signe opposé
  // (deltaY/delta négatif) qui arrive juste après l'atterrissage sur
  // services, alors que `services.scrollTop` vaut encore 0, déclenchait
  // aussitôt goBackward() - qui réinitialise ET REJOUE l'atterrissage des 6
  // cartes flottantes depuis leur position de départ hors écran
  // (resetHeroFloatCardsToIdle + playHeroFloatCardsEntrance, cf. animateTo
  // ci-dessous) : perçu comme les cartes qui repartent brutalement vers le
  // haut de la page au lieu de rester rangées en ligne - alors même que
  // l'assemblage venait tout juste de se terminer correctement. Un simple
  // délai fixe après l'arrivée (essayé d'abord) reste un pari sur la durée
  // de cette traîne, qui varie avec la force du geste - trop court pour un
  // flick vigoureux, il laisse le rebond passer. Comparer les IDENTIFIANTS
  // de geste au lieu d'un chrono élimine ce pari : quelle que soit sa durée
  // réelle, la traîne d'un même geste ne peut jamais, par construction,
  // déclencher le sens inverse de celui qui l'a lancée. Suivre les TROIS
  // canaux d'entrée (pas seulement wheel) est nécessaire : sinon,
  // activeTransitionGestureId, une fois posé par un geste tactile/clavier,
  // ne serait plus jamais dépassé par currentGestureId tant qu'aucun wheel
  // ne survient - bloquant alors pour de bon tout nouveau geste
  // tactile/clavier ultérieur (y compris un simple retour en arrière
  // parfaitement légitime).
  let currentGestureId = 0;
  let lastGestureInputTime = -Infinity;
  let activeTransitionGestureId = -1;
  const GESTURE_GAP_MS = 180;
  function markGestureInput() {
    const now = performance.now();
    if (now - lastGestureInputTime > GESTURE_GAP_MS) currentGestureId += 1;
    lastGestureInputTime = now;
  }
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
  // Depuis services (pas de contenu de hero à animer) : la vague blanche
  // démarre avec un léger décalage (15 %) pour un chevauchement plus
  // prononcé - cf. renderDevisFromServices, où le contenu s'efface sur ce
  // même rythme (waveP) plutôt que sur un minutage indépendant.
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
  //
  // heroCardP est la progression PROPRE à la carte centrale (heroContent) ;
  // floatCardsP celle des 6 cartes flottantes (assemblage + descente) ;
  // crossfadeP celle du fondu croisé vers #services (cf. render() plus bas).
  // Les trois sont indépendantes de `p` et entre elles (cf. animateTo plus
  // bas, qui les calcule chacune sur sa propre durée réelle et linéaire :
  // HERO_CARD_EXIT_DURATION_MS, FLOAT_CARDS_DURATION_MS,
  // CROSSFADE_DELAY_MS/FADE_MS) - jamais des fractions de la courbe globale
  // `p`, dont l'amorce/la fin très compressées rendaient délais et
  // enchaînements imprécis en pratique. Par défaut = p (comportement
  // d'origine) pour les autres appelants (ouverture Devis depuis l'accueil,
  // resize) qui n'ont qu'une seule progression à fournir.
  function renderHeroExit(p, heroCardP = p, floatCardsP = p, crossfadeP = p) {
    scatterAmount = p;

    if (!suppressHeroContentExit) {
      const contentT = Math.min(heroCardP / CONTENT_FADE_END, 1);
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
      heroContent.style.pointerEvents = heroCardP > 0.5 ? 'none' : '';

      if (floatCardsExitMode === 'rise') {
        renderFloatCardsExitUp(floatCardsP);
      } else {
        renderFloatCardsExit(floatCardsP);
      }
    }

    const warmT = Math.min(p / WARM_INTENSIFY_END, 1);
    // Fondu de sortie, sur la même progression que le fondu croisé de
    // #services (crossfadeP, cf. render() plus bas) : les lumières du hero
    // s'effacent pile pendant que celles de services prennent le relais,
    // jamais avant ni après.
    heroWarmLight.style.transform = `translate(${WARM_DRIFT_PX * 0.3 * warmT}px, ${-WARM_DRIFT_PX * warmT}px) scale(${1 + (WARM_SCALE_MAX - 1) * warmT})`;
    heroWarmLight.style.filter = `saturate(${1 + 0.6 * warmT}) brightness(${1 + 0.15 * warmT})`;
    heroWarmLight.style.opacity = String(1 - crossfadeP);
  }

  function render(p, heroCardP = p, floatCardsP = p, crossfadeP = p, rowDescendP = p) {
    floatCardsExitMode = 'assemble';
    renderHeroExit(p, heroCardP, floatCardsP, crossfadeP);

    // Fondu croisé de #services (panneau + ses propres taches chaudes) :
    // crossfadeP déjà entièrement calculée (temps réel, gated après
    // l'atterrissage des cartes flottantes, cf. animateTo plus bas) - utilisée
    // telle quelle, sans remapping supplémentaire.
    services.style.opacity = String(crossfadeP);
    servicesBlobs.forEach((blob, i) => {
      blob.style.opacity = String(SERVICES_BLOB_OPACITY[i] * crossfadeP);
    });

    // VRAIE rangée (vers services, rowExitDirection==='settle') : n'a plus
    // aucun mouvement propre à jouer - les 6 cartes flottantes atterrissent
    // désormais directement sur leur slot final (cf. measureFloatCardsExitTargets,
    // assembleDx/Dy = cible du slot lui-même, plus une ligne intermédiaire au
    // centre du viewport), donc la rangée réelle est déjà exactement là où
    // elle doit être dès que le fondu croisé la révèle - aucune "descente"
    // à part jouer. rowDescendP (cf. animateTo) continue néanmoins de servir
    // de minuterie pour l'écriture du titre/description ci-dessous et pour
    // le seuil "settled" plus bas, même si elle ne pilote plus aucun
    // transform ici.
    // Retour vers l'accueil (rowExitDirection==='fade-down') : la dispersion
    // des 6 .services-intro-slot reste entièrement pilotée par CSS
    // (.is-falling, cf. playServicesIntroRowExit et styles.css), déclenchée
    // une seule fois dans animateTo plutôt que recalculée ici à chaque frame
    // - render() n'a donc rien à faire tant que cette direction est active,
    // si ce n'est laisser l'animation CSS suivre son cours.
    if (servicesIntroRow) {
      if (rowExitDirection !== 'fade-down') {
        resetServicesIntroRowToIdle();
        servicesIntroRow.style.opacity = '';
        servicesIntroRow.style.transform = '';
      }
      // .is-row-animating (cf. styles.css) désactive temporairement le
      // backdrop-filter des 6 icônes (et la transition CSS de survol des
      // .services-intro-slot) le temps de la dispersion CSS au retour vers
      // l'accueil (rowExitDirection==='fade-down') : ce flou devrait sinon se
      // ré-échantillonner à chaque frame tant que la rangée bouge. N'a plus
      // d'effet utile dans l'autre sens (settle) puisque la rangée n'y bouge
      // plus du tout, mais reste inoffensif à y activer/désactiver.
      servicesIntroRow.classList.toggle('is-row-animating', rowDescendP > 0 && rowDescendP < 1);
    }

    // Titre + description : déclenchement à seuil (une seule fois, cf.
    // INTRO_HEADING_WRITE_THRESHOLD plus haut), pas un fondu continu -
    // l'écriture mot par mot suit ensuite son propre rythme (cf.
    // .services-intro-heading .hero-reveal-word, styles.css), indépendante
    // de rowDescendP une fois lancée. Symétrique : repasse sous le seuil
    // (retour en arrière) réarme le déclenchement pour la prochaine fois.
    if (introWordEls.length) {
      if (rowDescendP >= INTRO_HEADING_WRITE_THRESHOLD && !introWordsRevealed) {
        introWordsRevealed = true;
        playIntroHeadingReveal();
      } else if (rowDescendP < INTRO_HEADING_WRITE_THRESHOLD && introWordsRevealed) {
        introWordsRevealed = false;
        resetIntroHeadingReveal();
      }
    }

    // Interactif seulement une fois la VRAIE rangée posée à sa place ; le
    // hero, symétriquement, cesse d'intercepter les clics à ce même seuil.
    const settled = rowDescendP >= 1;
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
    floatCardsExitMode = 'rise';
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
    // Même atterrissage 3D que le retour services → accueil (cf. target===0
    // dans animateTo) : la carte centrale et les 6 cartes flottantes
    // rejouent leur survol/pose depuis le haut de l'écran, plutôt que de
    // simplement réapparaître sans mouvement.
    const card = document.getElementById('heroCard');
    if (card) playHeroCardEntrance(card);
    resetHeroFloatCardsToIdle();
    playHeroFloatCardsEntrance();
    replayHeroContentWords(heroContent);
  }

  function renderDevisFromServices(p) {
    const waveP = Math.min(Math.max((p - DEVIS_WAVE_START_SERVICES) / (1 - DEVIS_WAVE_START_SERVICES), 0), 1);
    devisProgress = waveP;
    // Le contenu de #services s'efface au même rythme que la progression de
    // LA VAGUE elle-même (waveP), plutôt que sur son propre minutage
    // indépendant et bien plus court (ancien SERVICES_FADE_END = 0.3) : ce
    // dernier faisait disparaître le contenu bien avant que la vague n'ait
    // parcouru le quart de l'écran, laissant le reste de sa descente balayer
    // du vide plutôt que du contenu visible - perceptible comme "tout
    // blanchit d'un coup" plutôt qu'une vraie vague qui recouvre au fur et à
    // mesure. Avec waveP, le contenu reste net jusqu'à ce que le bord de la
    // vague l'atteigne réellement.
    services.style.opacity = String(1 - waveP);
    // Bascule le texte de nav dès que le fond bleu de services devient plus
    // transparent que visible — fonctionne dans les deux sens (ouverture ET
    // fermeture), puisque waveP est une pure fonction de p.
    if (nav) nav.classList.toggle('nav-on-dark', 1 - waveP > 0.5);
    // Les 6 cartes flottantes du hero (cf. plus haut) restent figées, nettes
    // et opaques, à la ligne d'assemblage d'origine (mi-hauteur de l'ex-carte
    // centrale) depuis l'atterrissage sur services (cf. renderFloatCardsExit)
    // - un point DIFFÉRENT de la position au repos de la vraie rangée
    // (.services-intro-row, déjà descendue plus bas). Seule l'opacité de
    // #services (par-dessus) les masque d'ordinaire : les faire fondre au
    // même rythme que lui laisserait donc voir un second rang fantôme,
    // décalé au-dessus du vrai, tant que le fondu n'est pas terminé. On les
    // masque plutôt d'un coup dès le tout début de la transition, jamais
    // censées être visibles ici de toute façon.
    heroFloatCards.forEach((card) => { card.style.opacity = '0'; });

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

  // Depuis l'accueil, clic sur "Nos services" (hero) ou "Services" (nav) :
  // rejoue EXACTEMENT la même sortie que l'ouverture de Devis (cartes qui
  // s'envolent vers le haut + vague blanche descendante, cf.
  // renderDevisFromHome) au lieu de l'assemblage habituel vers la rangée
  // d'icônes (cf. goForward/animateTo) - seule la destination change une
  // fois l'écran entièrement recouvert : au lieu de révéler #devisPage, on
  // pose d'un coup l'état "arrivé sur services" (via render(1), le même
  // calcul que la fin de animateTo(1), donc rigoureusement identique à une
  // arrivée classique) pendant que tout reste invisible sous la vague, on
  // pré-scrolle #services jusqu'au carrousel, puis la vague remonte pour
  // révéler la page déjà installée, carrousel centré à l'écran.
  async function openServicesWave() {
    if (animating || devisOpen || page === 1 || isHeroEntranceActive()) return;
    animating = true;

    // Jamais de fondu du logo ici (contrairement à Devis) : la nav entière
    // (logo compris) reste affichée normalement tout du long, puisqu'elle
    // reste pleinement fonctionnelle une fois sur #services - une valeur
    // périmée laissée par une précédente ouverture de Devis fausserait sinon
    // ce fondu (cf. renderDevisWave, qui ne l'applique que si non-null).
    devisLogoCrossP = null;
    rowExitDirection = 'settle';
    await tween(DURATION_MS, 0, 1, renderDevisFromHome);

    // Pose de l'état d'arrivée d'un coup (masqué sous la vague, pleinement
    // descendue à cet instant) - identique à ce que produirait la fin de
    // animateTo(1), cf. cette fonction plus bas.
    progress = 1;
    render(1);
    page = 1;
    services.classList.add('lights-active');
    if (window.HSServicesReveal) window.HSServicesReveal.update();

    // Pré-scroll instantané (toujours masqué) vers le carrousel, centré
    // verticalement dans #services - calculé à partir des rects actuels
    // plutôt que offsetTop (fiable quelle que soit la chaîne d'offsetParent
    // entre le carrousel et #services).
    const carouselSection = document.getElementById('servicesCarouselSection');
    if (carouselSection) {
      const rect = carouselSection.getBoundingClientRect();
      const containerRect = services.getBoundingClientRect();
      const centeredDelta = (rect.top - containerRect.top) - Math.max((services.clientHeight - rect.height) / 2, 0);
      services.scrollTop = Math.max(services.scrollTop + centeredDelta, 0);
    }

    await tween(DURATION_MS, 1, 0, (p) => { devisProgress = p; renderDevisWave(p); });

    animating = false;
  }

  function animateTo(target) {
    animating = true;
    // L'opacité de #services (panneau + lumières) est désormais pilotée en
    // continu par render() (fondu croisé sur crossfadeProgress, calculée
    // plus bas) — il n'y a donc plus de snap à poser ici, dans un sens comme
    // dans l'autre. Seul .lights-active (qui pilote .svc-flip-reveal, indépendant
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
      // Décalées après la sortie de .services-intro-row (cf.
      // HOME_ENTRANCE_DELAY_MS plus haut) : la carte centrale et les 6 cartes
      // flottantes du hero ne commencent à apparaître qu'une fois la rangée
      // de contenu entièrement dispersée, jamais en même temps que sa chute -
      // un enchaînement net plutôt que deux animations superposées.
      if (card) playHeroCardEntrance(card, HOME_ENTRANCE_DELAY_MS);
      resetHeroFloatCardsToIdle();
      playHeroFloatCardsEntrance(HOME_ENTRANCE_DELAY_MS);
      replayHeroContentWords(heroContent);
    } else {
      suppressHeroContentExit = false;
    }
    // Sens de sortie de LA VRAIE RANGÉE (.services-intro-row, cf. render()
    // plus bas) : vers services (target=1), elle s'installe depuis la ligne
    // d'assemblage des cartes flottantes (comportement inchangé). Vers
    // l'accueil (target=0), elle ne rejoue plus l'inverse de cet assemblage
    // (les cartes flottantes rejouent désormais leur propre entrée ci-dessus,
    // indépendamment) — chacune de ses 6 cartes se disperse en tombant à la
    // place (cf. playServicesIntroRowExit, rowExitDirection dans render()).
    rowExitDirection = target === 0 ? 'fade-down' : 'settle';
    if (rowExitDirection === 'fade-down') playServicesIntroRowExit();

    const start = progress;
    const delta = target - start;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / PAGE_TRANSITION_DURATION_MS, 1);
      progress = start + delta * easeInOutCubic(t);
      // Progression indépendante et courte pour la carte centrale (cf.
      // HERO_CARD_EXIT_DURATION_MS plus haut) : atteint sa cible bien avant
      // que `progress` (et donc les cartes flottantes/le titre) n'ait
      // terminé sa propre course, bien plus longue.
      const heroT = Math.min(elapsed / HERO_CARD_EXIT_DURATION_MS, 1);
      const heroCardProgress = start + delta * easeInOutCubic(heroT);
      // Progression LINÉAIRE (jamais eased ici) pour les 6 cartes flottantes
      // (cf. FLOAT_CARDS_DURATION_MS plus haut) : renderFloatCardsExit
      // applique déjà son propre easing (easeInOutSoft) par carte/par phase -
      // lui fournir une entrée déjà adoucie par easeInOutCubic ferait perdre
      // toute correspondance prévisible entre FLOAT_CARDS_EXIT_DELAY (ou les
      // autres fractions) et un temps réel court.
      const floatCardsT = Math.min(elapsed / FLOAT_CARDS_DURATION_MS, 1);
      const floatCardsProgress = start + delta * floatCardsT;
      // Progression du fondu croisé (cf. CROSSFADE_DELAY_MS/FADE_MS plus
      // haut) : à l'aller (target 1), attend que les cartes flottantes
      // soient posées avant de démarrer ; au retour (target 0), pas de
      // raison d'attendre (les cartes rejouent une tout autre animation
      // d'entrée, cf. animateTo plus haut), le fondu inverse démarre donc
      // immédiatement.
      const crossfadeDelayMs = target === 1 ? CROSSFADE_DELAY_MS : 0;
      const crossfadeT = Math.min(Math.max((elapsed - crossfadeDelayMs) / CROSSFADE_FADE_MS, 0), 1);
      const crossfadeProgress = start + delta * crossfadeT;
      // Progression de la descente de la VRAIE rangée (cf. ROW_DESCEND_
      // DELAY_MS/DURATION_MS plus haut) : même logique de délai directionnel
      // que crossfadeProgress - au retour, la rangée remonte aussitôt
      // (l'entrée du hero est de toute façon rejouée par un tout autre
      // mécanisme, cf. plus haut), pas de raison d'attendre.
      const rowDescendDelayMs = target === 1 ? ROW_DESCEND_DELAY_MS : 0;
      const rowDescendT = Math.min(Math.max((elapsed - rowDescendDelayMs) / ROW_DESCEND_DURATION_MS, 0), 1);
      const rowDescendProgress = start + delta * rowDescendT;
      render(progress, heroCardProgress, floatCardsProgress, crossfadeProgress, rowDescendProgress);
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
    // Ignore un geste de scroll déclenché pendant que la carte centrale et/ou
    // les 6 cartes flottantes sont encore en train d'atterrir (cf.
    // isHeroEntranceActive, plus haut dans le fichier) - au tout premier
    // chargement notamment, rien n'empêchait sinon un scroll trop rapide de
    // couper cet atterrissage en plein vol et de faire "téléporter" les
    // cartes à leur position de repos avant de repartir vers services.
    if (animating || devisOpen || page === 1 || isHeroEntranceActive()) return;
    // cf. déclaration de currentGestureId/activeTransitionGestureId plus
    // haut : un geste dont la traîne d'inertie a déjà servi à ARRIVER sur
    // l'accueil (retour depuis services) ne peut pas, par la même traîne,
    // relancer aussitôt la course inverse.
    if (currentGestureId === activeTransitionGestureId) return;
    activeTransitionGestureId = currentGestureId;
    // Remesure fraîche, ICI et MAINTENANT, juste avant de lancer la course -
    // plutôt que de faire confiance aux mesures d'origine (posées une seule
    // fois à l'initialisation, cf. measureHeroExitRise()/
    // measureFloatCardsExitTargets() plus haut) ou à un `resize` hypothétique
    // pour les garder à jour (cf. onResize, plus bas : ne se déclenche que
    // si le navigateur émet réellement un `resize`, à un instant qui peut ne
    // jamais tomber au bon moment - DevTools qui s'ouvre/se redimensionne,
    // écran externe (dé)connecté, fenêtre déplacée entre deux écrans à
    // résolutions différentes... autant d'événements qui ne redéclenchent
    // pas toujours un `resize` de façon fiable ou synchrone). Une mesure
    // devenue périmée n'était jusqu'ici JAMAIS rattrapée avant la prochaine
    // transition, qui repartait alors avec des cibles (assembleDx/Dy)
    // calculées pour une tout autre taille de fenêtre - les 6 cartes
    // flottantes visaient alors un point sans aucun rapport avec l'écran
    // réel, parfois bien au-dessus de son bord supérieur : perçu comme les
    // cartes qui s'envolent au lieu de s'aligner. Remesurer systématiquement
    // ici, à chaque déclenchement, élimine ce risque de péremption une fois
    // pour toutes, quelle que soit sa cause exacte.
    measureHeroExitRise();
    measureFloatCardsExitTargets();
    animateTo(1);
  }

  function goBackward() {
    if (animating || devisOpen || page === 0) return;
    // cf. déclaration de currentGestureId/activeTransitionGestureId plus
    // haut : bloque précisément la traîne d'inertie du geste qui vient de
    // nous faire arriver sur services, tant qu'aucune vraie pause (
    // GESTURE_GAP_MS) n'a séparé cette traîne d'un nouveau geste.
    if (currentGestureId === activeTransitionGestureId) return;
    activeTransitionGestureId = currentGestureId;
    // Déclenché uniquement à la limite haute de #services (cf. gestes
    // molette/tactile/clavier plus bas, seuls appelants de goBackward) :
    // scrollTop vaut donc déjà 0 ici, ce reset est sans effet visible.
    services.scrollTop = 0;
    animateTo(0);
  }

  // Retour accueil via le logo (cf. plus bas) : contrairement aux gestes
  // molette/tactile/clavier ci-dessus, peut se déclencher depuis n'importe
  // quelle position de défilement dans #services. Plutôt qu'un simple fondu
  // croisé en place, on rejoue ici la même vague blanche que la transition
  // vers Devis (cf. logoReloadWave, index.html), puis - une fois l'écran
  // entièrement recouvert - on affiche le même écran de chargement que le
  // préchargeur initial et on déclenche un vrai rechargement de la page :
  // l'accueil se retrouve ainsi présenté exactement comme lors d'un
  // rafraîchissement (hero rejoué depuis le tout début, scroll remis à zéro),
  // plutôt qu'un simple retour en place de l'état déjà en mémoire.
  function goHomeFromLogo() {
    if (animating || devisOpen || page === 0) return;

    const loader = document.getElementById('logoReloadLoader');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !loader) {
      window.location.reload();
      return;
    }

    // Le temps que le spinner reste visible avant le rechargement, pour que
    // l'écran de chargement ne soit pas qu'un flash imperceptible.
    const HOLD_MS = 280;

    animating = true;
    devisLogoCrossP = computeDevisLogoCrossP();
    services.style.pointerEvents = 'none';

    // PAS de nav-devis ici (contrairement à openDevisPage/closeDevisPage) :
    // cette classe déclenche son propre fondu CSS indépendant (0.35s, cf.
    // .nav-links/.nav>.btn-primary/.nav-burger/.nav-logo dans styles.css),
    // pensé pour la page Devis où seul le logo doit rester synchronisé avec
    // la vague pendant que le reste de la nav s'efface à son propre rythme,
    // plus rapide. Ici, tout doit disparaître ENSEMBLE, au même rythme que
    // le reste du contenu et de la vague elle-même : liens, bouton "Devis
    // gratuit", burger ET logo rejoignent donc tous la même valeur
    // d'opacité ci-dessous plutôt que de partir chacun à son rythme.
    // `transition: none` désactive le fondu CSS de 0.35s posé sur chacun
    // (pensé pour un simple bascule de classe, jamais pour un pilotage
    // continu image par image) : sans ça, chaque élément lisserait sa
    // propre course vers l'opacité qu'on lui repose à chaque frame,
    // prenant perpétuellement du retard sur la vraie progression de la
    // vague plutôt que de la suivre au pixel près.
    const navFadeEls = [
      logoLink,
      nav ? nav.querySelector('.nav-links') : null,
      nav ? nav.querySelector(':scope > .btn-primary') : null,
      nav ? nav.querySelector('.nav-burger') : null,
    ].filter(Boolean);
    navFadeEls.forEach((el) => {
      el.style.transition = 'none';
      el.style.pointerEvents = 'none';
    });

    // Rejoue EXACTEMENT la même vague blanche (durée, easing, fondu de
    // #services) que l'ouverture de la page Devis depuis #services (cf.
    // openDevisPage/renderDevisFromServices plus haut) - seule la suite
    // diffère : au lieu de révéler #devisPage une fois la vague en place, on
    // affiche l'écran de chargement (mêmes classes que le préchargeur
    // initial) puis on recharge réellement la page, qui se retrouve donc
    // affichée exactement comme lors d'un rafraîchissement.
    tween(DURATION_MS, 0, 1, (p) => {
      renderDevisFromServices(p);
      // renderDevisFromServices vient de recalculer l'opacité du logo (cf.
      // renderDevisWave, synchronisée au passage réel du bord de la vague à
      // sa hauteur) : on la réutilise telle quelle pour le reste de la nav,
      // plutôt que de la recalculer, pour une disparition rigoureusement
      // identique - même valeur, même frame - entre logo, liens, bouton et
      // burger.
      const navOpacity = logoLink.style.opacity;
      navFadeEls.forEach((el) => { el.style.opacity = navOpacity; });
    }).then(() => {
      loader.classList.add('is-visible');
      window.setTimeout(() => { window.location.reload(); }, HOLD_MS);
    });
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
    // cf. déclaration de markGestureInput plus haut : tenue à jour pour
    // CHAQUE wheelevent, avant tout autre traitement/sortie anticipée - la
    // continuité d'un geste (et donc de sa traîne d'inertie) ne dépend que
    // du silence ou non entre deux événements consécutifs, jamais de l'état
    // de la page (devisOpen, animating...) à cet instant.
    markGestureInput();

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
    markGestureInput();
    if (devisOpen) return;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    markGestureInput();
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
    markGestureInput();

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

  // Liens d'ancre vers #services (nav + CTA du hero) : déclenchent une
  // transition animée plutôt qu'un saut natif vers un élément position:fixed.
  // Depuis l'accueil, la vague blanche de Devis (openServicesWave, cf.
  // plus haut) mène directement au carrousel ; depuis #services déjà
  // atteint, rien à faire (goForward() y est de toute façon un no-op, cf.
  // sa propre garde page === 1).
  document.querySelectorAll('a[href="#services"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (page === 0) {
        openServicesWave();
        return;
      }
      // cf. markGestureInput/currentGestureId plus haut : un clic est par
      // nature un geste neuf et délibéré, jamais la traîne d'un geste
      // molette/tactile précédent - sans cet appel, goForward() pourrait se
      // retrouver bloqué à tort si ce clic suit de près une transition
      // déclenchée par molette/tactile (currentGestureId n'aurait alors
      // jamais progressé depuis, faute d'un nouvel événement molette/
      // tactile/clavier entre-temps).
      markGestureInput();
      goForward();
    });
  });

  // Logo : un cran en arrière. Si la page Devis est ouverte, la referme
  // (retour vers la page d'où elle a été ouverte) ; sinon, retour vers
  // l'accueil - via goHomeFromLogo (vague blanche + rechargement réel de la
  // page, cf. plus haut) plutôt que goBackward (réservée aux gestes molette/
  // tactile/clavier, qui n'agissent qu'à la limite haute) : le logo, lui,
  // peut être cliqué depuis n'importe quelle position de défilement dans
  // #services.
  const logoLink = document.querySelector('.nav-logo');
  if (logoLink) {
    logoLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (devisOpen) {
        closeDevisPage();
      } else {
        goHomeFromLogo();
      }
    });
  }

  function onResize() {
    // Si une transition (accueil<->services, ou ouverture/fermeture Devis)
    // est en cours, sa propre boucle rAF (animateTo/tween) continue de
    // tourner et rappelle déjà render()/renderHeroExit() à chaque frame avec
    // la progression correcte et spécifique à chaque axe (carte centrale,
    // 6 cartes flottantes, fondu croisé, descente de la rangée - cf.
    // animateTo, chacun sur son propre timing réel). Ni ce `render(progress)`
    // global, NI les mesures ci-dessous ne doivent s'appliquer pendant cette
    // course : measureFloatCardsExitTargets (et measureHeroExitRise/
    // measureFloatCardsRiseExit) recalculent des cibles absolues
    // (data-assembleDx/Dy) que renderFloatCardsExit/renderFloatCardsExitUp
    // reconsomment ENTIÈREMENT à chaque frame (curvedOffset(t, dx, dy, ...))
    // - jamais de façon incrémentale. Les rafraîchir en cours de route change
    // donc dx/dy alors que `t` a déjà avancé, ce qui fait sauter la carte sur
    // un point totalement différent de la NOUVELLE courbe plutôt que de
    // continuer la sienne - perçu comme les cartes "remontant" hors de
    // l'écran au lieu de s'aligner. Un redimensionnement (fenêtre, zoom
    // navigateur, pincement sur trackpad...) survenant pile pendant un
    // scroll suffit à le déclencher. On reporte donc TOUTE remesure à la fin
    // de la transition en cours plutôt que de risquer cette discontinuité -
    // la course en cours garde ses cibles d'origine (valables au moment où
    // elle a démarré), et un redimensionnement réel sera de toute façon
    // capturé par un prochain resize une fois `animating` retombé à false.
    //
    // Même chose, pour une raison différente mais tout aussi destructive,
    // tant que l'ENTRÉE (atterrissage 3D de la carte centrale + des 6 cartes
    // flottantes, cf. isHeroEntranceActive/heroEntranceCount) est encore en
    // cours : measureHeroExitRise/measureFloatCardsExitTargets/
    // measureFloatCardsRiseExit neutralisent chacune temporairement
    // `card.style.animation` ("none" puis restauration de la valeur
    // précédente) pour mesurer la position AU REPOS de la carte, hors de
    // toute transformation en cours. Si la carte a encore sa classe
    // .is-entering à cet instant (son animation `heroCardDrop`/
    // `heroFloatCardDrop` est donc en réalité pilotée par la RÈGLE CSS de
    // cette classe, jamais par un `animation` inline), cette bascule
    // "none" -> valeur précédente (qui vaut simplement "", cf. cascade)
    // relance l'animation CSS depuis son tout début - délai d'entrée
    // (--entrance-delay) inclus - plutôt que de la laisser simplement
    // continuer. La carte, déjà posée ou en train de descendre, saute donc
    // brutalement en arrière à sa position de départ (hors écran, au-dessus
    // du viewport) avant de rejouer l'atterrissage depuis zéro - perçu
    // comme les cartes qui "remontent" en haut de la page. Un resize
    // survenant tôt après le chargement (quasi garanti : l'ajout de
    // .is-paged juste après, cf. plus haut dans ce fichier, masque la
    // scrollbar verticale de la page et élargit donc le viewport de sa
    // largeur - Chrome/Firefox émettent bien un `resize` pour ce seul
    // changement) tombe presque toujours PILE pendant cette entrée
    // (~0.95-1.35s), qui n'a même pas besoin d'un vrai redimensionnement de
    // fenêtre par l'utilisateur pour se reproduire à quasi CHAQUE
    // chargement de page. On reporte donc, ici aussi, toute remesure
    // jusqu'à la fin de l'entrée.
    if (animating || isHeroEntranceActive()) return;
    devisRiseHeightPx = devisWaveFallInner.clientHeight;
    measureHeroExitRise();
    measureFloatCardsExitTargets();
    measureFloatCardsRiseExit();
    render(progress);
    renderDevisWave(devisProgress);
    // Ré-applique le bon état de sortie en dernier : render() vient de le
    // recalculer via `progress` (axe accueil ↔ services), ce qui serait
    // erroné si c'est en réalité l'ouverture de Devis qui l'a positionné —
    // render() vient aussi de remettre floatCardsExitMode à 'assemble', donc
    // on la restaure à 'rise' dans ce cas avant de rejouer la sortie.
    floatCardsExitMode = (devisOpen && devisCameFromPage === 0) ? 'rise' : 'assemble';
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
// Les 4 cartes d'info de #services (.info-card) portent directement la
// classe .reveal : leur apparition au scroll est gérée par le mécanisme
// générique initScrollReveal() (fondu + montée), pas par un système dédié —
// il n'y a plus de décor par carte (photo, compteur...) à révéler en 3
// temps comme dans l'ancienne version 3 cartes.
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

// ─────────────────────────────────────────────
// SORTIE AU SCROLL DE LA RANGÉE D'ICÔNES (#servicesIntroRow)
// Une fois les 6 cartes alignées (donc #services au repos, tout en haut de
// son propre scroll interne - cf. #services, overflow-y:auto, styles.css),
// continuer à scroller fait s'envoler ces 6 cartes vers le haut de l'écran
// en se dispersant, en passant par-dessus le titre + la description
// (#servicesIntroHeading, peints après elle dans le flux - cf. index.html -
// donc déjà au-dessus par défaut, sans z-index à poser), qui eux ne font que
// s'estomper. Purement scroll-scrubbé : chaque frame de scroll repose
// directement transform/opacity d'après services.scrollTop, sans easing ni
// transition CSS (désactivée le temps du geste), pour rester visuellement
// collé au scroll de l'utilisateur plutôt que de jouer une transition figée
// une fois déclenchée - même esprit que renderFloatCardsExit
// (initHeroPageTransition, plus haut), mais sur le scroll natif de #services
// plutôt que sur la molette hijackée. Desktop uniquement (comme
// initHeroPageTransition) : sur mobile/reduced-motion, #services repasse en
// flux normal (overflow-y:visible, cf. styles.css) et n'a donc plus de
// scroll interne propre à écouter ici.
function initServicesIntroExitOnScroll() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(max-width: 768px)').matches) return;

  const services = document.getElementById('services');
  const heading = document.getElementById('servicesIntroHeading');
  const slots = Array.from(document.querySelectorAll('.services-intro-slot'));
  if (!services || !heading || !slots.length) return;

  // Distance de scroll (px, dans #services) sur laquelle toute la
  // dispersion se joue : au-delà, les cartes restent hors écran et le titre
  // masqué, jusqu'à ce qu'un retour tout en haut (scrollTop=0) ne les fasse
  // réapparaître - purement fonction de scrollTop, aucun état à
  // réinitialiser séparément.
  const EXIT_RANGE_PX = 380;

  // Trajectoire propre à chaque carte (dx/dy/rot, indexée comme les 6
  // .services-intro-slot du DOM) : dx croît de façon strictement monotone de
  // gauche (le plus négatif) à droite (le plus positif) - même logique que
  // ROW_CARD_FALL (initHeroPageTransition, retour vers l'accueil) mais vers
  // le HAUT plutôt que vers le bas - garantit que deux cartes voisines
  // s'écartent toujours l'une de l'autre plutôt que de se chevaucher pendant
  // l'envol. Les cartes restent nettes et opaques pendant tout le trajet
  // (jamais de fondu, contrairement au titre/description ci-dessous) - seul
  // leur déplacement hors de l'écran les fait disparaître.
  const CARD_FLIGHT = [
    { dx: -70, dy: -260, rot: -12 },
    { dx: -42, dy: -300, rot: -7 },
    { dx: -16, dy: -340, rot: -3 },
    { dx: 16, dy: -340, rot: 3 },
    { dx: 42, dy: -300, rot: 7 },
    { dx: 70, dy: -260, rot: 12 },
  ];
  // Décalage croissant par carte (fraction de EXIT_RANGE_PX) : la carte
  // d'index 0 commence à s'envoler dès le premier pixel de scroll, les
  // suivantes un peu après - un vrai effet de dispersion progressive plutôt
  // que 6 cartes qui décollent toutes en même temps.
  const CARD_STAGGER = 0.05;

  let ticking = false;

  function render() {
    ticking = false;
    const p = Math.min(Math.max(services.scrollTop / EXIT_RANGE_PX, 0), 1);

    heading.style.opacity = String(1 - p);
    heading.style.pointerEvents = p > 0.05 ? 'none' : '';

    slots.forEach((slot, i) => {
      if (p <= 0) {
        slot.style.transition = '';
        slot.style.transform = '';
        return;
      }
      const offset = i * CARD_STAGGER;
      const cardT = Math.min(Math.max((p - offset) / (1 - offset), 0), 1);
      const flight = CARD_FLIGHT[i] || CARD_FLIGHT[0];
      slot.style.transition = 'none';
      slot.style.transform = `translate(${flight.dx * cardT}px, ${flight.dy * cardT}px) rotate(${flight.rot * cardT}deg)`;
    });
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(render);
  }

  services.addEventListener('scroll', onScroll, { passive: true });
}

// ─────────────────────────────────────────────
// CARROUSEL DES SERVICES (#servicesCarouselStage)
// Carrousel "à carte centrale" EN BOUCLE : un seul état, currentIndex (0..6,
// jamais borné - cf. goTo ci-dessous, qui le fait toujours passer par un
// modulo), pilote tout. render() n'a qu'un rôle : pour chacune des 7 cartes,
// calculer sa distance circulaire à currentIndex (toujours ramenée entre -3
// et +3 - cf. normalizedDiff) et lui poser la classe de rôle correspondante
// (.is-main/.is-prev/.is-next/.is-offstage-left/.is-offstage-right, cf.
// styles.css) - AUCUN transform/opacity calculé ici en JS : c'est la
// transition CSS déclenchée par ce changement de classe qui anime le
// passage d'un rôle à l'autre, à chaque fois (avance, recul, ou saut direct
// via une puce) exactement de la même façon.
// ─────────────────────────────────────────────
function initServicesCarousel() {
  const stage = document.getElementById('servicesCarouselStage');
  const track = document.getElementById('servicesCarouselTrack');
  const prevBtn = document.getElementById('servicesCarouselPrev');
  const nextBtn = document.getElementById('servicesCarouselNext');
  const dotsContainer = document.getElementById('servicesCarouselDots');
  if (!stage || !track || !prevBtn || !nextBtn || !dotsContainer) return;

  const cards = Array.from(track.children);
  const N = cards.length;
  if (!N) return;

  // Apparition au scroll : déclenchée quand le TITRE atteint (à une fine
  // bande près, cf. rootMargin ci-dessous) le centre vertical de l'écran
  // (pas une simple entrée dans le viewport) - à cet instant, .is-revealed
  // est posée sur la section, ce qui fait "s'écrire" le titre mot par mot
  // (cf. .services-carousel-head h2 .hero-reveal-word, styles.css), PUIS
  // .is-cards-revealed (cf. CARDS_REVEAL_DELAY_MS plus bas), qui fait
  // apparaître (fondu + montée "depuis le bas") les 3 cartes AFFICHÉES du
  // carrousel (.is-main/.is-prev/.is-next, cf. styles.css - jamais les 4
  // hors-champ, déjà invisibles), puis enfin la rangée flèches+puces. Un
  // seul déclenchement, jamais rejoué.
  //
  // Le carrousel lui-même ne devient interactif (goTo, donc tout ce qui en
  // dépend - flèches, puces, clic sur une carte voisine, swipe, molette,
  // clavier) qu'UNE FOIS ces 3 cartes réellement arrivées à leur place -
  // carouselReady, vérifié en tout début de goTo plus bas. "Réellement
  // arrivées" = transitionend sur la carte centrale, pas un minutage
  // approximatif dupliqué en JS (même principe que armInfoCardSettle,
  // initScrollReveal plus haut dans ce fichier, pour les cartes d'info).
  let carouselReady = false;
  const section = stage.closest('.services-carousel');
  const titleEl = section ? section.querySelector('.services-carousel-head h2') : null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Découpe le titre mot par mot (même wrapWordsForReveal/.hero-reveal-word
  // que le hero/l'intro services/les cartes d'info, cf. plus haut dans ce
  // fichier) pour l'effet "écriture" au moment de la révélation - cf.
  // animation-play-state paused/running sur .is-revealed, styles.css.
  if (titleEl) wrapWordsForReveal(titleEl);

  function armCarouselReadyOnSettle() {
    // La carte centrale (le <li>) - transitionend sur `translate`, la
    // propriété dédiée à cette apparition (cf. styles.css, jamais retouchée
    // par la navigation ensuite - contrairement à `transform`, partagée
    // avec .is-main/.is-prev/.is-next et donc déclenchée à chaque
    // changement de carte, pas seulement à l'apparition initiale).
    const mainCard = section.querySelector('.services-carousel-card.is-main');
    if (!mainCard) { carouselReady = true; return; }
    let settled = false;
    function onEnd(e) {
      if (e.target !== mainCard || e.propertyName !== 'translate') return;
      settle();
    }
    function settle() {
      if (settled) return;
      settled = true;
      carouselReady = true;
      mainCard.removeEventListener('transitionend', onEnd);
      window.clearTimeout(fallbackId);
    }
    mainCard.addEventListener('transitionend', onEnd);
    // Filet de sécurité (transitionend qui ne se déclencherait pas pour une
    // raison ou une autre) : 1200ms couvre largement le pire cas réel
    // (sans délai, durée 0.5s, cf. styles.css).
    const fallbackId = window.setTimeout(settle, 1200);
  }

  // Les cartes apparaissent APRÈS le titre (pas en même temps) : .is-revealed
  // (déclenche le titre, cf. styles.css) et .is-cards-revealed (déclenche les
  // 3 cartes affichées, cf. .services-carousel:not(.is-cards-revealed)
  // .is-main/.is-prev/.is-next, styles.css) sont deux classes distinctes
  // posées à des instants différents plutôt qu'une seule - contrairement au
  // titre (animation dédiée, delay/cascade posés une fois pour toutes en
  // CSS), les cartes partagent leurs propriétés transform/opacity avec la
  // navigation ultérieure (flèches/puces/swipe, cf. goTo/render plus bas) :
  // leur donner un transition-delay CSS aurait aussi ralenti CE changement
  // de carte, pas seulement l'apparition initiale. Décaler l'ajout de la
  // classe elle-même (ce setTimeout) évite le problème sans toucher à cette
  // transition partagée.
  const CARDS_REVEAL_DELAY_MS = 300;

  if (!section) {
    carouselReady = true;
  } else if (reduceMotion) {
    section.classList.add('is-revealed', 'is-cards-revealed');
    carouselReady = true;
  } else if (!titleEl) {
    section.classList.add('is-revealed', 'is-cards-revealed');
    armCarouselReadyOnSettle();
  } else {
    // threshold:0 + rootMargin qui rogne les 30% du bas du viewport (aucune
    // marge en haut) : isIntersecting passe à true dès que le TITRE entre
    // dans les 70% hauts de l'écran, pas besoin d'atteindre le centre (50%)
    // - se déclenche donc plus tôt dans le scroll, dès que le titre est
    // "confortablement visible" plutôt qu'une fois pile au milieu. -50%/-50%
    // (bande de hauteur EXACTEMENT 0, testé au tout début) ne fonctionne pas
    // du tout : un rectangle d'intersection de hauteur nulle a une aire
    // nulle, donc un ratio et un isIntersecting TOUJOURS faux, quelle que
    // soit la position du titre - la révélation ne se déclenchait alors
    // jamais.
    const revealObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        section.classList.add('is-revealed');
        revealObserver.disconnect();
        armCarouselReadyOnSettle();
        window.setTimeout(() => section.classList.add('is-cards-revealed'), CARDS_REVEAL_DELAY_MS);
      }
    }, { threshold: 0, rootMargin: '0px 0px -30% 0px' });
    revealObserver.observe(titleEl);
  }

  // Puces : une par carte, générées plutôt que codées en dur en HTML - la
  // liste reste juste si le nombre de services change plus tard. Chaque
  // puce saute DIRECTEMENT à sa carte (pas forcément un pas de 1), cf. goTo.
  const dots = cards.map((card, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'services-carousel-dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Aller au service ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dotsContainer.appendChild(dot);
    return dot;
  });

  // Distance circulaire de la carte i à currentIndex, toujours ramenée dans
  // (-N/2, N/2] (pour N=7 : -3..3, une valeur distincte par carte - 7 est
  // impair, aucune égalité possible) : c'est ce qui fait qu'avancer depuis
  // la dernière carte ramène bien à la 1ʳᵉ (et inversement) sans jamais un
  // grand saut visuel - la carte "suivante" de la 7ᵉ a toujours diff=+1,
  // exactement comme n'importe quelle autre paire de voisines.
  function normalizedDiff(i, current) {
    let diff = (i - current) % N;
    if (diff > N / 2) diff -= N;
    if (diff < -N / 2) diff += N;
    return diff;
  }

  function roleForDiff(diff) {
    if (diff === 0) return 'is-main';
    if (diff === -1) return 'is-prev';
    if (diff === 1) return 'is-next';
    return diff < 0 ? 'is-offstage-left' : 'is-offstage-right';
  }

  const ROLE_CLASSES = ['is-main', 'is-prev', 'is-next', 'is-offstage-left', 'is-offstage-right'];
  let currentIndex = 0;

  function render() {
    cards.forEach((card, i) => {
      const role = roleForDiff(normalizedDiff(i, currentIndex));
      card.classList.remove(...ROLE_CLASSES);
      card.classList.add(role);
      // Seules les cartes réellement invisibles (opacity:0, cf. .is-
      // offstage-* dans styles.css) sont masquées aux lecteurs d'écran - la
      // centrale ET ses 2 voisines (visibles, juste réduites/estompées)
      // restent annoncées, leur titre étant du vrai contenu (nom du
      // service), pas un simple décor.
      card.setAttribute('aria-hidden', role.startsWith('is-offstage') ? 'true' : 'false');
    });
    dots.forEach((dot, i) => {
      const isActive = i === currentIndex;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-selected', String(isActive));
    });
  }

  // Modulo qui reste positif quel que soit le signe de i (contrairement à
  // l'opérateur % natif de JS, négatif pour un dividende négatif) : goPrev
  // depuis l'index 0 doit atterrir sur N-1 (la dernière carte), pas sur une
  // valeur négative - c'est précisément ce qui fait boucler le carrousel.
  function goTo(i) {
    // Aucune navigation tant que les 3 cartes affichées n'ont pas fini leur
    // propre apparition (cf. carouselReady, plus haut) - couvre tous les
    // chemins d'entrée (flèches, puces, clic sur une carte voisine, swipe,
    // molette, clavier), qui passent tous par goTo/goNext/goPrev.
    if (!carouselReady) return;
    currentIndex = ((i % N) + N) % N;
    render();
  }
  function goNext() { goTo(currentIndex + 1); }
  function goPrev() { goTo(currentIndex - 1); }

  prevBtn.addEventListener('click', goPrev);
  nextBtn.addEventListener('click', goNext);

  // Clic direct sur une carte voisine (.is-prev/.is-next, cf. styles.css -
  // les cartes .is-offstage-* ont pointer-events:none, jamais cliquables) :
  // l'amène au centre, comme si on avait cliqué la flèche correspondante.
  // suppressClick (posé après un swipe commis, cf. plus bas) évite qu'un
  // relâchement de glissement ne déclenche EN PLUS ce clic sur la carte
  // qui se trouve alors sous le doigt/curseur.
  let suppressClick = false;
  track.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; return; }
    const card = e.target.closest('.services-carousel-card');
    if (!card) return;
    if (card.classList.contains('is-prev')) goPrev();
    else if (card.classList.contains('is-next')) goNext();
  });

  // Clavier flèches gauche/droite quand la scène a le focus (tabindex="0"
  // posé en HTML) - même pas "une carte" que les boutons/le swipe, pour une
  // navigation cohérente quel que soit le moyen utilisé.
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
  });

  // Swipe/glisser (souris ET tactile, unifiées via Pointer Events - plus de
  // scroll natif à laisser respirer ici, contrairement à l'ancienne version
  // en scroll-snap) : geste discret plutôt qu'un suivi du doigt image par
  // image - dès que le déplacement horizontal dépasse SWIPE_THRESHOLD, on
  // déclenche IMMÉDIATEMENT goNext()/goPrev() (un seul cran, jamais plus,
  // même pour un flick rapide - cf. "au swipe, la prochaine carte... est
  // mise en avant" : un pas à la fois, pas un défilement libre) et on
  // ignore le reste du geste en cours (committed) jusqu'au relâchement -
  // évite qu'un unique glissement un peu long ne fasse avancer de 2 crans.
  const SWIPE_THRESHOLD = 40;
  let pointerDownX = null;
  let pointerCommitted = false;

  stage.addEventListener('pointerdown', (e) => {
    pointerDownX = e.clientX;
    pointerCommitted = false;
  });

  stage.addEventListener('pointermove', (e) => {
    if (pointerDownX == null || pointerCommitted) return;
    const dx = e.clientX - pointerDownX;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    pointerCommitted = true;
    suppressClick = true;
    if (dx < 0) goNext(); else goPrev();
  });

  function endPointer() {
    pointerDownX = null;
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  stage.addEventListener('pointerleave', endPointer);

  // Molette/trackpad horizontal (desktop, où le geste "swipe" se traduit
  // par un deltaX plutôt qu'un pointerdown/move/up) : même logique de pas
  // unique + cooldown (au lieu d'un SWIPE_THRESHOLD sur une position, la
  // molette envoie une rafale de petits deltaX pour un seul vrai geste -
  // sans cooldown, un seul coup de trackpad ferait avancer de 5-6 cartes
  // d'un coup). Ignore le deltaY dominant (scroll vertical normal de la
  // page) : seul un mouvement principalement horizontal déclenche le
  // carrousel.
  const WHEEL_COOLDOWN_MS = 450;
  let lastWheelAt = 0;
  stage.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastWheelAt < WHEEL_COOLDOWN_MS) return;
    lastWheelAt = now;
    if (e.deltaX > 0) goNext(); else goPrev();
  }, { passive: false });

  render();
}

document.addEventListener('DOMContentLoaded', () => {
  initPreloader();
  initRipples();
  initHeroCardEntrance();
  initNavLogoFade();
  initSmoothAnchorScroll();
  initInfoCardWordReveal();
  initScrollReveal();
  initInfoCardPriceTicker();
  initInfoCardClock();
  initHeroPageTransition();
  initServicesRevealText();
  initServicesIntroExitOnScroll();
  initServicesCarousel();

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
        // rejoue ici le retournement de .svc-flip-reveal (déjà utilisé par
        // la transition sur desktop) une seule fois, dès que la section
        // entre réellement dans l'écran au scroll naturel. Déclenché une
        // seule fois (pas lié en continu au scroll, contrairement à une
        // précédente tentative qui avait buggué).
        // threshold à 0 + rootMargin étendue vers le bas : #services étant
        // beaucoup plus haute qu'un écran, un threshold basé sur sa propre
        // hauteur (ex. 0.15) ne se déclenchait qu'après un long scroll dans
        // la section, bien après que la frontière hero/#services soit déjà
        // passée à l'écran - le fondu des taches de lumière arrivait alors
        // en retard, avec un bref aplat blanc bien visible à la jonction.
        // La rootMargin déclenche le fondu dès que #services est encore à
        // 600px sous l'écran (donc quasiment au chargement, vu qu'elle
        // commence pile au bas du hero), pour qu'il ait terminé bien avant
        // que l'utilisateur n'atteigne réellement cette frontière.
        const servicesIntro = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              services.classList.add('lights-active');
              servicesIntro.disconnect();
            }
          }
        }, { threshold: 0, rootMargin: '0px 0px 600px 0px' });
        servicesIntro.observe(services);
      }
    }
  }

  // Même repli que ci-dessus, pour le titre/description de l'intro services
  // (#servicesIntroHeading) et sa rangée d'icônes (#servicesIntroRow) : sur
  // mobile, initHeroPageTransition() ne tourne jamais, donc leur révélation
  // normalement pilotée par le scroll-hijack (playIntroHeadingReveal, plus
  // haut) ne se déclenche jamais — ils restaient affichés en permanence sans
  // aucune apparition. .is-visible n'a d'effet qu'en dessous de 768px (cf.
  // styles.css) : sur desktop, où ces éléments sont réellement gérés par
  // initHeroPageTransition, la poser ici est un no-op silencieux. threshold
  // 0.2 + rootMargin -60px : même réglage qu'initScrollReveal, pour rester
  // cohérent avec le reste des apparitions au scroll de la page.
  [document.getElementById('servicesIntroHeading'), document.getElementById('servicesIntroRow')]
    .filter(Boolean)
    .forEach((el) => {
      const io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          io.disconnect();
        }
      }, { threshold: 0.2, rootMargin: '0px 0px -60px 0px' });
      io.observe(el);
    });
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
