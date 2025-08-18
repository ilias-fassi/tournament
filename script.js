let dataTournois = {};

// Charger les données JSON au démarrage
fetch("tournois.json")
  .then((res) => res.json())
  .then((data) => {
    dataTournois = data;
  });

function updateTournoiParams({ paf, marge, prixUnitaireProduit, minJoueurs, minLots }) {
  const tcg = tcgSelect.value;
  const typeIndex = typeSelect.value;

  if (!tcg || !dataTournois[tcg] || !dataTournois[tcg][typeIndex]) return;

  if (paf !== undefined) dataTournois[tcg][typeIndex].paf = parseFloat(paf);
  if (marge !== undefined) dataTournois[tcg][typeIndex].marge = parseFloat(marge);
  if (prixUnitaireProduit !== undefined) dataTournois[tcg][typeIndex].prixUnitaireProduit = parseFloat(prixUnitaireProduit);
  if (minJoueurs !== undefined) dataTournois[tcg][typeIndex].minJoueurs = parseInt(minJoueurs, 10);
  if (minLots !== undefined) dataTournois[tcg][typeIndex].minLots = parseInt(minLots, 10);
  if (coutLot1er !== undefined) dataTournois[tcg][typeIndex].coutLot1er = parseFloat(coutLot1er);
}


const tcgSelect = document.getElementById("tcg");
const typeSelect = document.getElementById("tournoiType");
const form = document.getElementById("tournoiForm");
const messageErreur = document.getElementById("messageErreur");
const tableLots = document.getElementById("tableLots");
const tableBody = document.getElementById("tableBody");
const paramsTournoi = document.getElementById("paramsTournoi");
const inputPAF = document.getElementById("paf");
const inputMarge = document.getElementById("marge");
const inputPrixProduit = document.getElementById("prixProduit");
const totalLotsAffiche = document.getElementById("totalLotsAffiche");
const coutLot1erInput = document.getElementById("coutLot1er");
const champLot1er = document.getElementById("champLot1er");



// Maj types selon le TCG choisi
tcgSelect.addEventListener("change", () => {
  const tcg = tcgSelect.value;
  typeSelect.innerHTML = `<option value="" disabled selected>Choisir un type</option>`;
  paramsTournoi.style.display = "none";
  tableLots.style.display = "none";
  messageErreur.textContent = "";

  if (!dataTournois[tcg]) return;

  dataTournois[tcg].forEach((type, index) => {
    const opt = document.createElement("option");
    opt.value = index;
    opt.textContent = type.nom;
    typeSelect.appendChild(opt);
  });
});

// Affiche les paramètres du tournoi sélectionné (paf, marge, prix produit)
typeSelect.addEventListener("change", () => {
  const tcg = tcgSelect.value;
  const type = dataTournois[tcg]?.[typeSelect.value];
  const coutLot1erInput = document.getElementById("coutLot1er");
  const champLot1er = document.getElementById("champLot1er");

  if (type) {
    inputPAF.value = type.paf;
    inputMarge.value = type.marge;
    inputPrixProduit.value = type.prixUnitaireProduit;
    paramsTournoi.style.display = "block";
    tableLots.style.display = "none";
    messageErreur.textContent = "";

    // Initialisation du minuteur
    timerDuration = (type.timerMinutes || 45) * 60;
    overtimeDuration = (type.overtimeMinutes || 0) * 60;
    currentTime = timerDuration;
    timerDisplay.textContent = formatTime(currentTime);
    alarmPlayedAtZero = false;
    alarmPlayedAtOvertime = false;
    btnStart.disabled = false;
    btnPause.disabled = true;
  } else {
    paramsTournoi.style.display = "none";
    tableLots.style.display = "none";
  }

  if (type.lot1er) {
    champLot1er.style.display = "block";
    coutLot1erInput.value = type.coutLot1er || 0;
    } else {
    champLot1er.style.display = "none";
    coutLot1erInput.value = "";
  }
});

// --- Nouvelle fonction binomiale ---
function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
}
function binomialCoef(n, k) {
  return factorial(n) / (factorial(k) * factorial(n - k));
}
function binomialPMF(k, n, p) {
  return binomialCoef(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

// Calcule la répartition des joueurs selon une loi binomiale (rondes suisses modélisées)
function calcDistribution(nbJoueurs) {
  const rounds = Math.ceil(Math.log2(nbJoueurs));
  let distribution = [];
  let totalDistribue = 0;

  for (let k = 0; k <= rounds; k++) {
    let proportion = binomialPMF(k, rounds, 0.5);
    let joueurs = Math.round(proportion * nbJoueurs);
    distribution.push({ score: `X-${k}`, joueurs });
    totalDistribue += joueurs;
  }

  // Ajustement pour que la somme soit exactement nbJoueurs
  let diff = nbJoueurs - totalDistribue;
  if (diff !== 0) {
    distribution[distribution.length - 1].joueurs += diff;
  }

  return distribution;
}

// Calcule les lots en fonction de la distribution et paramètres
function updateLots(distribution, paf, marge, prixProduit, minLots) {
  const nbJoueurs = distribution.reduce((acc, cur) => acc + cur.joueurs, 0);
  const cagnotte = nbJoueurs * paf * (1 - marge);
  const totalLots = Math.floor(cagnotte / prixProduit);

  // mode classique
  if (!lot1er){
    // Étape 1 : Distribution minimale
    let lotsDistrib = distribution.map(row => ({
        ...row,
        lots: minLots * row.joueurs
    }));

    const lotsMinTotal = lotsDistrib.reduce((acc, cur) => acc + cur.lots, 0);
    let lotsRestants = totalLots - lotsMinTotal;

    // Étape 2 : Cible X-0 et X-1
    const x0 = lotsDistrib[0]; // X-0 : joueur unique invaincu
    const x1 = lotsDistrib[1] || { joueurs: 0, lots: 0 }; // X-1 : potentiellement plusieurs joueurs

    let partX1 = 0.7; // Pourcentage initial de répartition des lots restants vers les X-1

    let lotsX1 = 0;
    let lotsX0 = 0;

    // Étape 3 : Ajustement du pourcentage jusqu'à ce que X-1 ait moins que X-0 (en ratio par joueur)
    while (partX1 >= 0) {
        lotsX1 = x1.joueurs > 0 ? Math.floor((lotsRestants * partX1) / x1.joueurs) * x1.joueurs : 0;
        lotsX0 = lotsRestants - lotsX1;

        const ratioX1 = x1.joueurs > 0 ? Math.floor(lotsX1 / x1.joueurs) : 0;
        const ratioX0 = Math.floor(lotsX0); // x0.joueurs === 1

        if (ratioX1 < ratioX0) break;
        partX1 -= 0.005;
    }

    x1.lots += lotsX1;
    x0.lots += lotsX0;

    // Étape 4 : Vérifie les restes non distribués
    const totalAttribue = lotsDistrib.reduce((acc, cur) => acc + cur.lots, 0);
    const reste = totalLots - totalAttribue;

    if (reste > 0) {
        x0.lots += reste;
    }

    return lotsDistrib;
  }

  // mode lot1er : true
  const cagnotteRestante = cagnotte - coutLot1er;
  let lotsDispo = Math.floor(cagnotteRestante / prixProduit);

  let nbX1 = 0;
  let nbX2Plus = 0;

  distribution.forEach(row => {
    if (row.score === "X-1") {
      nbX1 += row.joueurs;
    } else if (row.score !== "X-0") {
      nbX2Plus += row.joueurs;
    }
  });

  const lotsX2PlusTotal = nbX2Plus * minLots;
  const reste = Math.max(lotsDispo - lotsX2PlusTotal, 0);
  const lotsParX1 = nbX1 > 0 ? Math.floor(reste / nbX1) : 0;

  // Construction de la nouvelle distribution
  return distribution.map(row => {
    let lots = 0;
    if (row.score === "X-0") {
      lots = 0; // il a le lot spécial
    } else if (row.score === "X-1") {
      lots = lotsParX1;
    } else {
      lots = minLots;
    }

    return {
      ...row,
      lots
    };
  });
  
}

function estRentable(nbJoueurs, paf, marge, prixProduit, minLots) {
    const recettes = nbJoueurs * paf * (1 - marge);
    const coutMin = nbJoueurs * minLots * prixProduit;
    return recettes >= coutMin;
}

function estRentableCustom(nbJoueurs, paf, marge, prixProduit, minLots, lot1er, coutLot1er) {
    const recettes = nbJoueurs * paf * (1 - marge);
    const coutMin = ((nbJoueurs - 1) * minLots * prixProduit) + coutLot1er;
    return recettes >= coutMin;
}

// Affiche le tableau avec inputs modifiables pour nombre de joueurs et recalcul dynamique des lots
function afficherTable(distribution, paf, marge, prixProduit, minLots) {
  tableBody.innerHTML = "";

  let currentDist = distribution.map((d) => ({ ...d }));

  function render() {
    tableBody.innerHTML = "";

    const lotsDistrib = updateLots(
      currentDist,
      paf,
      marge,
      prixProduit,
      minLots
    );

    const totalLotsDistribues = lotsDistrib.reduce((acc, row) => acc + row.lots, 0);
    
    const totalLotsRepartis = lotsDistrib.reduce((acc, row) => acc + (row.joueurs * Math.floor(row.lots / row.joueurs)), 0);
    const reliquat = totalLotsDistribues - totalLotsRepartis;

    let texte = `${totalLotsDistribues} lots à distribuer`;
    if (reliquat > 0) {
      texte += ` (${reliquat} lots non distribués)`;
    }

    totalLotsAffiche.textContent = texte;


    lotsDistrib.forEach((row, i) => {
      const tr = document.createElement("tr");

      // Score
      const tdScore = document.createElement("td");
      tdScore.textContent = row.score;

      // Joueurs (modifiables)
      const tdJoueurs = document.createElement("td");
      const inputNb = document.createElement("input");
      inputNb.type = "number";
      inputNb.min = 0;
      inputNb.value = currentDist[i].joueurs;
      inputNb.style.width = "60px";

      inputNb.addEventListener("input", () => {
        let val = parseInt(inputNb.value);
        if (isNaN(val) || val < 0) val = 0;
        currentDist[i].joueurs = val;

        const somme = currentDist.reduce((acc, cur) => acc + cur.joueurs, 0);
        const totalInitial = distribution.reduce((acc, cur) => acc + cur.joueurs, 0);
        if (somme !== totalInitial) {
          messageErreur.textContent =
            "Attention : la somme des joueurs modifiés ne correspond pas au total initial.";
        } else {
          messageErreur.textContent = "";
        }
        render(); // update display
      });

      tdJoueurs.appendChild(inputNb);

      // Lots par joueur (entiers)
      const tdLotsParJoueur = document.createElement("td");
      tdLotsParJoueur.textContent = row.joueurs > 0 ? Math.floor(row.lots / row.joueurs) : "-";

      tr.appendChild(tdScore);
      tr.appendChild(tdJoueurs);
      tr.appendChild(tdLotsParJoueur);

      tableBody.appendChild(tr);
    });
  }

  render();
  tableLots.style.display = "table";
}

// Gestion du submit formulaire
form.addEventListener("submit", (e) => {
  totalLotsAffiche.textContent = "";
  e.preventDefault();
  messageErreur.textContent = "";
  tableBody.innerHTML = "";
  tableLots.style.display = "none";

  const tcg = tcgSelect.value;
  if (!tcg) {
    messageErreur.textContent = "Veuillez choisir un TCG.";
    return;
  }
  const tournoiType = dataTournois[tcg]?.[typeSelect.value];
  if (!tournoiType) {
    messageErreur.textContent = "Veuillez choisir un type de tournoi.";
    return;
  }

  const nbJoueurs = parseInt(document.getElementById("nbJoueurs").value, 10);
  const paf = parseFloat(inputPAF.value);
  const marge = parseFloat(inputMarge.value);
  const prixProduit = parseFloat(inputPrixProduit.value);
  const minLots = tournoiType.lot1er ? tournoiType.lotsMinParJoueur : Math.floor(paf / 5);
  const coutLot1er = parseFloat(coutLot1erInput?.value || "0");

  updateTournoiParams({
    paf,
    marge,
    prixUnitaireProduit: prixProduit,
    minJoueurs: nbJoueurs, // à ajuster selon ta logique métier
    minLots,
    coutLot1er
  });

  if (isNaN(nbJoueurs) || nbJoueurs < tournoiType.minJoueurs) {
    messageErreur.textContent = `⚠️ Nombre de joueurs insuffisant (minimum requis: ${tournoiType.minJoueurs})`;
    return;
  }

  if (!tournoiType.lot1er && !estRentable(nbJoueurs, paf, marge, prixProduit, minLots)) {
  messageErreur.textContent = "⚠️ Le tournoi n'est pas rentable avec ces paramètres.";
  return;
  }

  if (!estRentableCustom(nbJoueurs, paf, marge, prixProduit, minLots, tournoiType.lot1er, coutLot1er)) {
    messageErreur.textContent = "⚠️ Ce tournoi n'est pas rentable avec ces paramètres.";
    return;
  }



  // Calcule la distribution initiale (loi binomiale)
  const distribution = calcDistribution(nbJoueurs);

  // Affiche le tableau interactif
  afficherTable(distribution, paf, marge, prixProduit, minLots);
});


// Minuteur personnalisable
const timerDisplay = document.getElementById("timerDisplay");
const btnStart = document.getElementById("timerStart");
const btnPause = document.getElementById("timerPause");
const btnReset = document.getElementById("timerReset");
const alarmSound = document.getElementById("alarmSound");
let timerDuration = 15; // 2700sec 45 minutes en secondes (par défaut)
let overtimeDuration = 300; // 5 minutes en secondes (par défaut)
let currentTime = timerDuration;
let timerInterval = null;
let alarmPlayedAtZero = false;
let alarmPlayedAtOvertime = false;

function formatTime(seconds) {
  const absSeconds = Math.abs(seconds);
  const m = Math.floor(absSeconds / 60);
  const s = absSeconds % 60;
  return `${seconds < 0 ? "-" : ""}${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;
}
function playAlarm() {
  const alarm = document.getElementById("alarmSound");
  if (!alarm) return;

  alarm.pause(); // Stop any ongoing playback
  const startAt = 0.5;        // secondes
  const segmentDuration = 1.5; // secondes
  const endAt = startAt + segmentDuration;
  const desiredLoops = 2;

  let loopCount = 0;

  function loopPlayback() {
    alarm.currentTime = startAt;
    alarm.play().catch((e) => console.warn("Lecture échouée :", e));

    const interval = setInterval(() => {
      if (alarm.currentTime >= endAt) {
        alarm.pause();
        loopCount++;
        if (loopCount < desiredLoops) {
          alarm.currentTime = startAt;
          alarm.play().catch((e) => console.warn("Lecture échouée :", e));
        } else {
          clearInterval(interval);
        }
      }
    }, 50);
  }

  loopPlayback();
}
function updateTimer() {
  currentTime--;
  timerDisplay.textContent = formatTime(currentTime);

  if (currentTime === 0 && !alarmPlayedAtZero) {
    playAlarm();
    alarmPlayedAtZero = true;
  }

  if (overtimeDuration > 0 && currentTime === -overtimeDuration && !alarmPlayedAtOvertime) {
    playAlarm();
    alarmPlayedAtOvertime = true;
  }


  if (currentTime <= -overtimeDuration) {
    clearInterval(timerInterval);
    timerInterval = null;
    btnStart.disabled = true;
    btnPause.disabled = true;
  }
}

btnStart.addEventListener("click", () => {
  alarmSound.play().then(() => {
    alarmSound.pause(); // On l'arrête aussitôt
    alarmSound.currentTime = 0;
  }).catch((e) => {
    console.warn("Pré-chargement de l'audio échoué :", e);
  });

  if (!timerInterval) {
    timerInterval = setInterval(updateTimer, 1000);
    btnStart.disabled = true;
    btnPause.disabled = false;
  }
});
btnPause.addEventListener("click", () => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    btnStart.disabled = false;
    btnPause.disabled = true;
  }
});
btnReset.addEventListener("click", () => {
  clearInterval(timerInterval);
  timerInterval = null;
  currentTime = timerDuration;
  timerDisplay.textContent = formatTime(currentTime);
  btnStart.disabled = false;
  btnPause.disabled = true;
  alarmPlayedAtZero = false;
  alarmPlayedAtOvertime = false;
});