/* ============================================================================
   HomeService BXL - comportements du site.

   Servi minifié (script.min.js, cf. minify.sh) par index.html, devis.html et
   demande.html : toute modification ici doit être suivie d'un ./minify.sh,
   sinon le site continue de servir l'ancienne version.

   Le même fichier sert les trois pages, or les pages devis autonomes n'ont ni
   en-tête, ni carrousel, ni sections animées : chaque bloc commence donc par
   une vérification de la présence de son élément racine plutôt que de
   supposer le DOM de la page d'accueil (sans quoi une seule ligne manquante
   casserait tout le script, formulaire compris, sur ces pages).
   ========================================================================= */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ── Au chargement, toujours démarrer en haut (sauf ancre explicite dans l'URL) ── */
  if (!location.hash) {
    const toTop = () => scrollTo({ top: 0, behavior: 'instant' });
    toTop();
    addEventListener('load', toTop, { once: true });
  }

  /* ── Découpage en mots (titres animés + texte « À propos ») ── */
  const splitWords = (el, cls, inner) => {
    let i = 0;
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/([ \t\n\r]+)/).forEach(part => {
          if (!part) return;
          if (/^[ \t\n\r]+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span'); w.className = cls;
          if (inner) {
            const wi = document.createElement('span'); wi.className = inner;
            wi.style.setProperty('--i', i); wi.textContent = part; w.append(wi);
          } else w.textContent = part;
          i++; frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName.toLowerCase() !== 'svg') walk(n);
    });
    walk(el);
  };
  $$('[data-split]').forEach(el => splitWords(el, 'w', 'wi'));

  const statements = $$('.statement').map(el => {
    splitWords(el, 'sw');
    return { el, words: $$('.sw', el), accents: $$('.accent', el), lit: -1 };
  });

  /* ── Grand logo du footer, lettre par lettre ── */
  $$('[data-reveal-letters]').forEach(el => {
    let i = 0;
    [...el.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        [...n.textContent].forEach(ch => { const s = document.createElement('span'); s.textContent = ch; s.style.setProperty('--i', i++); frag.append(s); });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) n.style.setProperty('--i', i++);
    });
  });

  /* ── Bandeaux défilants : contenu dupliqué pour une boucle continue ── */
  $$('.marquee__track').forEach(t => {
    const items = [...t.children];
    for (let k = 0; k < 3; k++) items.forEach(n => t.append(n.cloneNode(true)));
  });

  /* ── Apparitions au scroll ── */
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in');
    io.unobserve(en.target);
  }), { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  $$('[data-reveal],[data-split],[data-reveal-letters]').forEach(el => io.observe(el));

  /* ── Effets liés au scroll ── */
  const header = $('#header'), totop = $('#totop');
  const steps = $('#steps'), stepEls = steps ? $$('.step', steps) : [];
  const squig = $('#squig');
  let squigLen = 0;
  if (squig) { squigLen = squig.getTotalLength(); squig.style.strokeDasharray = squigLen; }
  const parallax = $$('[data-parallax]');
  let lastY = scrollY, ticking = false;

  const onScroll = () => {
    const y = scrollY, vh = innerHeight, max = document.documentElement.scrollHeight - vh;
    const p = max > 0 ? y / max : 0;
    if (totop) {
      totop.classList.toggle('show', y > vh);
      totop.style.setProperty('--o', 1 - p);
    }
    if (header) {
      header.classList.toggle('scrolled', y > 40);
      if (!document.documentElement.classList.contains('menu-open')) header.classList.toggle('hide', y > lastY && y > 400);
    }
    lastY = y;

    if (steps) {
      const r = steps.getBoundingClientRect();
      const sp = clamp((vh * 0.7 - r.top) / r.height, 0, 1);
      steps.style.setProperty('--p', sp);
      stepEls.forEach((s, i) => s.classList.toggle('on', sp >= i / stepEls.length + 0.02));
    }

    if (squig) {
      const sr = squig.ownerSVGElement.getBoundingClientRect();
      squig.style.strokeDashoffset = squigLen * (1 - clamp((vh - sr.top) / (vh * 0.9 + sr.height), 0, 1));
    }

    statements.forEach(st => {
      const tr = st.el.getBoundingClientRect();
      const lit = Math.round(clamp((vh * 0.85 - tr.top) / (tr.height + vh * 0.3), 0, 1) * st.words.length);
      if (lit === st.lit) return;
      st.lit = lit;
      st.words.forEach((w, i) => w.classList.toggle('on', i < lit));
      st.accents.forEach(a => a.classList.toggle('on', !!a.querySelector('.sw.on')));
    });

    if (!reduce) parallax.forEach(el => {
      const b = el.parentElement.getBoundingClientRect();
      el.style.transform = `translateY(${(b.top + b.height / 2 - vh / 2) * +el.dataset.parallax}px)`;
    });
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();
  if (totop) totop.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

  /* ── Lien actif dans le menu ── */
  const links = $$('.nav a');
  if (links.length) {
    const navIO = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(a => { const s = $(a.getAttribute('href')); if (s) navIO.observe(s); });
  }

  /* ── Menu mobile ── */
  const burger = $('.burger'), mnav = $('#mnav');
  if (burger && mnav) {
    const setMenu = open => {
      const br = burger.getBoundingClientRect();
      mnav.style.setProperty('--bx', `${br.left + br.width / 2}px`);
      mnav.style.setProperty('--by', `${br.top + br.height / 2}px`);
      document.documentElement.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', open);
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      if (header) header.classList.remove('hide');
    };
    burger.addEventListener('click', () => setMenu(!document.documentElement.classList.contains('menu-open')));
    $$('.mnav a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  }

  /* ── Cartes : remplissage circulaire depuis le pointeur ── */
  $$('.card').forEach(c => c.addEventListener('pointerenter', e => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`);
    c.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));

  /* ── Carrousel des services ──
     « moved » distingue un vrai glissement d'un simple clic : il est lu par
     les boutons [data-pick], qui ne doivent pas présélectionner un service
     quand le pointeur relâché terminait en fait un glissement du carrousel. */
  const slider = $('#slider');
  let moved = false;
  if (slider) {
    const sBar = $('#sliderBar');
    const sPrev = $('#services .prev'), sNext = $('#services .next');
    const stepW = () => (slider.querySelector('.svc')?.offsetWidth || 320) + 20;
    sPrev.addEventListener('click', () => slider.scrollBy({ left: -stepW(), behavior: 'smooth' }));
    sNext.addEventListener('click', () => slider.scrollBy({ left: stepW(), behavior: 'smooth' }));
    const updSlider = () => {
      const max = slider.scrollWidth - slider.clientWidth;
      const p = max > 0 ? slider.scrollLeft / max : 0;
      const vis = slider.clientWidth / slider.scrollWidth;
      sBar.style.width = `${(vis + (1 - vis) * p) * 100}%`;
      sPrev.disabled = slider.scrollLeft < 5;
      sNext.disabled = slider.scrollLeft > max - 5;
    };
    slider.addEventListener('scroll', updSlider, { passive: true });
    addEventListener('resize', updSlider); updSlider();
    let down = false, sx = 0, sl = 0;
    slider.addEventListener('pointerdown', e => {
      moved = false;
      if (e.pointerType !== 'mouse' || e.target.closest('button')) return;
      down = true; sx = e.clientX; sl = slider.scrollLeft;
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 4) { moved = true; slider.classList.add('drag'); }
      slider.scrollLeft = sl - dx;
    });
    addEventListener('pointerup', () => {
      if (!down) return; down = false;
      if (!moved) return;
      const cards = $$('.svc', slider), pad = cards[0].offsetLeft, left = slider.scrollLeft;
      const target = cards.reduce((a, c) => Math.abs(c.offsetLeft - pad - left) < Math.abs(a.offsetLeft - pad - left) ? c : a);
      slider.classList.remove('drag');
      slider.scrollTo({ left: target.offsetLeft - pad, behavior: 'smooth' });
    });
  }

  /* ── FAQ ── */
  $$('#faqList .qa').forEach(qa => $('button', qa).addEventListener('click', () => {
    const open = !qa.classList.contains('open');
    $$('#faqList .qa').forEach(o => { o.classList.remove('open'); $('button', o).setAttribute('aria-expanded', 'false'); });
    if (open) { qa.classList.add('open'); $('button', qa).setAttribute('aria-expanded', 'true'); }
  }));

  /* ── Formulaire de devis ── */
  // Mêmes identifiants EmailJS que l'ancienne version du site : les demandes
  // arrivent dans la même boîte mail, avec le même gabarit (mêmes noms de
  // variables dans templateParams plus bas).
  const EMAILJS_SERVICE_ID  = 'service_j033nwf';
  const EMAILJS_TEMPLATE_ID = 'template_11x7mes';
  const EMAILJS_PUBLIC_KEY  = '78ucBOdPpFs89A31U';

  // Questions propres à chaque service (reprises du quiz de l'ancien site).
  const QUESTIONS = {
    'Lavage voiture': [
      { id: 'vehicule', label: 'Quel type de véhicule ?', options: ['Citadine', 'Berline / Break', 'SUV / 4x4', 'Utilitaire'] },
      { id: 'lieu', label: 'Où souhaitez-vous le lavage ?', options: ['À mon domicile', 'Sur un parking / autre lieu'] }
    ],
    'Entretien extérieur': [
      { id: 'typeExterieur', label: 'Jardin ou terrasse ?', options: ['Jardin', 'Terrasse'] }
    ],
    'Désencombrement': [
      { id: 'volume', label: 'Quel volume à évacuer ?', options: ['Quelques objets', 'Une pièce', 'Un logement complet', 'Un local / garage'] },
      { id: 'typeDechets', label: 'Quel type de déchets ?', options: ['Meubles / encombrants', 'Gravats / matériaux', 'Électroménager', 'Mixte'] }
    ],
    'Livraison à domicile': [
      { id: 'typeCourses', label: 'Quel type de courses ?', options: ['Alimentaire', 'Pharmacie', 'Colis / autre'] }
    ],
    'Nettoyage intérieur': [
      { id: 'logement', label: 'Quel type de logement ?', options: ['Appartement', 'Maison', 'Bureau / commerce'] }
    ],
    'Montage': [
      { id: 'tache', label: 'Quel type de tâche ?', options: ['Montage de meubles', 'Installation (étagères, luminaires…)', 'Autre'] },
      { id: 'urgence', label: "Quel est le degré d'urgence ?", options: ['Dès que possible', 'Cette semaine', 'Pas urgent'] }
    ],
    'Travaux': [
      { id: 'typeTravaux', label: 'Quel type de travaux ?', options: ['Peinture', 'Réparation', 'Plomberie', 'Électricité', 'Maçonnerie', 'Autre'] },
      { id: 'urgenceTravaux', label: "Quel est le degré d'urgence ?", options: ['Dès que possible', 'Cette semaine', 'Pas urgent'] }
    ],
    'Service sur mesure': []
  };
  const EXTERIEUR_FOLLOWUPS = {
    'Terrasse': [
      { id: 'surface', label: 'Quelle est la surface de la terrasse ?', area: true },
      { id: 'materiau', label: 'Quel est le matériau ?', options: ['Carrelage', 'Bois / composite', 'Pierre naturelle', 'Béton'] }
    ],
    'Jardin': [
      { id: 'intervention', label: "Quel type d'intervention ?", options: ['Tonte', 'Taille de haies', 'Désherbage', 'Entretien complet'] },
      { id: 'surfaceJardin', label: 'Quelle est la surface du jardin ?', area: true }
    ]
  };

  const form = $('#devisForm');
  if (form) {
    const select = $('#f-service'), quiz = $('#quiz');
    const btn = $('#formBtn'), btnTxt = $('#formBtnTxt'), errBox = $('#formErr');
    const wrapEl = $('#formWrap'), okEl = $('#formOk');
    const anchor = $('#devis') || form;
    let answers = {};

    const currentQuestions = () => {
      let qs = [...(QUESTIONS[select.value] || [])];
      if (select.value === 'Entretien extérieur' && answers.typeExterieur) qs = qs.concat(EXTERIEUR_FOLLOWUPS[answers.typeExterieur]);
      return qs;
    };

    const buildQuestion = q => {
      const box = document.createElement('div'); box.className = 'qz';
      const lab = document.createElement('span'); lab.className = 'qz__label'; lab.textContent = q.label;
      box.append(lab);
      if (q.area) {
        const f = document.createElement('div'); f.className = 'field';
        const inp = document.createElement('input');
        Object.assign(inp, { type: 'number', min: 1, inputMode: 'numeric', placeholder: ' ', id: 'q-' + q.id, value: answers[q.id] || '' });
        const l = document.createElement('label'); l.htmlFor = inp.id; l.textContent = 'Surface en m²';
        inp.addEventListener('input', () => { answers[q.id] = inp.value.trim(); });
        f.append(inp, l); box.append(f);
      } else {
        const opts = document.createElement('div'); opts.className = 'opts';
        opts.setAttribute('role', 'group'); opts.setAttribute('aria-label', q.label);
        q.options.forEach(o => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'opt'; b.textContent = o;
          b.setAttribute('aria-pressed', answers[q.id] === o);
          b.addEventListener('click', () => {
            answers[q.id] = o;
            $$('.opt', opts).forEach(x => x.setAttribute('aria-pressed', x === b));
            if (q.id === 'typeExterieur') {
              ['surface', 'materiau', 'intervention', 'surfaceJardin'].forEach(k => delete answers[k]);
              renderFollowups();
            }
          });
          opts.append(b);
        });
        box.append(opts);
      }
      return box;
    };

    const renderFollowups = () => {
      let f = $('#quizFollow');
      if (!f) { f = document.createElement('div'); f.id = 'quizFollow'; f.style.cssText = 'display:grid;gap:18px'; quiz.append(f); }
      f.innerHTML = '';
      (EXTERIEUR_FOLLOWUPS[answers.typeExterieur] || []).forEach(q => f.append(buildQuestion(q)));
    };

    const renderQuiz = () => {
      quiz.innerHTML = '';
      const qs = QUESTIONS[select.value] || [];
      quiz.hidden = !qs.length;
      qs.forEach(q => quiz.append(buildQuestion(q)));
    };

    select.addEventListener('change', () => {
      answers = {};
      select.parentElement.classList.remove('err');
      renderQuiz();
    });

    // Boutons « Demander un devis » : présélectionne le service dans le formulaire.
    $$('[data-pick]').forEach(b => b.addEventListener('click', () => {
      if (moved) return;
      select.value = b.dataset.pick;
      select.dispatchEvent(new Event('change'));
      anchor.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      if (b.dataset.pick === 'Service sur mesure') setTimeout(() => $('#f-desc').focus({ preventScroll: true }), 900);
    }));

    // Une arrivée en ?service=<nom> (lien direct envoyé à un client) ouvre le
    // formulaire avec le bon service déjà choisi et son quiz déjà affiché.
    // SLUGS traduit les identifiants de l'ancienne version du site : des
    // liens ?service=nettoyage-exterieur ont circulé par SMS/WhatsApp et
    // continuent d'arriver, il n'y a aucune raison qu'ils tombent sur un
    // formulaire vide.
    const SLUGS = {
      'lavage-voiture':    'Lavage voiture',
      'nettoyage-exterieur': 'Entretien extérieur',
      'decombrements':     'Désencombrement',
      'courses-livraison': 'Livraison à domicile',
      'nettoyage':         'Nettoyage intérieur',
      'montage-bricolage': 'Montage',
      'travaux':           'Travaux',
      'sur-mesure':        'Service sur mesure'
    };
    const asked = new URLSearchParams(location.search).get('service');
    const wanted = asked && (SLUGS[asked] || (QUESTIONS[asked] ? asked : null));
    if (wanted) { select.value = wanted; renderQuiz(); }

    const fields = () => $$('input:not([name="societe"]):not([type="number"]), select, textarea', form);
    fields().forEach(f => f.addEventListener('input', () => f.parentElement.classList.remove('err')));

    const showOk = () => {
      wrapEl.style.display = 'none';
      okEl.hidden = false;
      anchor.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    };

    form.addEventListener('submit', e => {
      e.preventDefault();
      let firstBad = null;
      fields().forEach(f => {
        const bad = !f.checkValidity();
        f.parentElement.classList.toggle('err', bad);
        if (bad && !firstBad) firstBad = f;
      });
      if (firstBad) { firstBad.focus(); return; }

      // Piège à robots : rempli = envoi automatisé, on n'envoie rien.
      if (form.societe.value.trim() !== '') { showOk(); return; }

      const val = n => form[n].value.trim();
      const details = currentQuestions()
        .map(q => answers[q.id] ? `${q.label} : ${q.area ? answers[q.id] + ' m²' : answers[q.id]}` : null)
        .filter(Boolean).join('\n');

      const templateParams = {
        service:      val('service'),
        prenom:       val('prenom'),
        nom:          val('nom'),
        email:        val('email'),
        telephone:    val('telephone') || 'Non renseigné',
        localisation: val('localisation'),
        dates:        val('dates') || 'Non précisée',
        details:      details || '(aucun détail supplémentaire)',
        description:  val('description'),
      };

      errBox.hidden = true;
      btn.disabled = true;
      btnTxt.textContent = 'Envoi en cours…';

      const send = typeof emailjs !== 'undefined'
        ? emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, { publicKey: EMAILJS_PUBLIC_KEY })
        : Promise.reject(new Error('EmailJS non chargé'));

      send.then(() => {
        form.reset(); answers = {}; renderQuiz();
        showOk();
      }).catch(err => {
        console.error('[Devis] Erreur EmailJS →', err);
        errBox.hidden = false;
        errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }).finally(() => {
        btn.disabled = false;
        btnTxt.textContent = 'Envoyer ma demande';
      });
    });

    $('#formAgain').addEventListener('click', () => {
      okEl.hidden = true;
      wrapEl.style.display = 'grid';
    });
  }

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* ── Effets souris : boutons magnétiques + curseur ── */
  if (matchMedia('(pointer: fine)').matches && !reduce) {
    $$('[data-magnetic]').forEach(b => {
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .22}px, ${(e.clientY - r.top - r.height / 2) * .3}px)`;
      });
      b.addEventListener('pointerleave', () => b.style.transform = '');
    });
    const cur = $('.cursor');
    if (cur) {
      let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
      addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; cur.classList.add('on'); });
      document.addEventListener('pointerleave', () => cur.classList.remove('on'));
      document.addEventListener('pointerover', e => cur.classList.toggle('big', !!e.target.closest('a,button,.svc,input,textarea,select')));
      const loop = () => {
        cx += (tx - cx) * .2; cy += (ty - cy) * .2;
        cur.style.transform = `translate(${cx}px, ${cy}px)`;
        requestAnimationFrame(loop);
      };
      loop();
    }
  }
})();
