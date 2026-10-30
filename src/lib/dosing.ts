import { CONC, FLOW, INJ, MASS, TIME, VOL, fmt, fromBase, toBase, type UnitTable } from "./units";

export type Q = { v: number | null; u: string };
export type Check = { level: "error" | "warn" | "info" | "ok"; msg: string };
export type Row = { label: string; value: string };
export type Step = { label: string; formula: string; substitution: string; result: string };
export type Sheet = {
  module: string;
  title: string;
  inputs: Row[];
  conversions: Row[];
  steps: Step[];
  main?: Row;
  results: Row[];
  forecast: Row[];
  checks: Check[];
  interpretation: string[];
  limits: string[];
  hypotheses: string[];
};

const has = (q?: Q) => !!q && q.v !== null && !Number.isNaN(q.v);
const base = (q: Q, t: UnitTable) => toBase(q.v as number, t, q.u);

function emptySheet(module: string, title: string): Sheet {
  return { module, title, inputs: [], conversions: [], steps: [], results: [], forecast: [], checks: [], interpretation: [], limits: [], hypotheses: [] };
}

function req(sheet: Sheet, q: Q | undefined, name: string, strictPositive = true) {
  if (!q || q.v === null) { sheet.checks.push({ level: "error", msg: `${name} : champ obligatoire manquant.` }); return false; }
  if (Number.isNaN(q.v)) { sheet.checks.push({ level: "error", msg: `${name} : valeur non numérique. Utilisez des chiffres (ex. 3,5).` }); return false; }
  if (strictPositive ? q.v <= 0 : q.v < 0) {
    sheet.checks.push({ level: "error", msg: `${name} : doit être ${strictPositive ? "strictement positif" : "positif ou nul"}. Corrigez la valeur saisie.` });
    return false;
  }
  return true;
}
function opt(sheet: Sheet, q: Q | undefined, name: string) {
  if (!q || q.v === null) return false;
  if (Number.isNaN(q.v) || q.v < 0) { sheet.checks.push({ level: "error", msg: `${name} : valeur invalide (négative ou non numérique).` }); return false; }
  return q.v > 0;
}
const show = (q: Q) => `${fmt(q.v as number)} ${q.u}`;

export type DosingInput = {
  mode: "continu" | "lot";
  Cm: Q; // concentration solution mère
  D: Q; // dose cible
  Qe?: Q; // débit eau
  Ve?: Q; // volume eau (lot)
  stock?: Q; // volume de solution mère disponible
  t?: Q; // durée de fonctionnement
  pump?: Q; // débit réel pompe
  residual?: Q; // chlore résiduel mesuré
  demand?: Q; // demande en chlore estimée
  productMass?: Q; // sulfate : quantité de produit disponible
  purity?: number | null; // sulfate : teneur en produit actif (%)
  tankV?: Q; // sulfate : volume cuve de préparation
  tankC?: Q; // sulfate : concentration souhaitée de la cuve
};

/** Calcul du dosage (chlore ou sulfate d'aluminium). Tout est converti en mg/L, L/s, L, mg, h. */
export function computeDosing(kind: "chlore" | "sulfate", inp: DosingInput): Sheet {
  const name = kind === "chlore" ? "chlore" : "sulfate d'aluminium";
  const s = emptySheet(kind, kind === "chlore" ? "Dosage du chlore" : "Dosage du sulfate d'aluminium");
  s.hypotheses.push(
    "Unités internes de référence : mg/L, L/s, L, mg, heure.",
    "% (m/v) : 1 % = 10 g/L = 10 000 mg/L (masse par volume de solution).",
    "Mélange instantané et homogène ; volume de solution injectée négligeable devant le volume d'eau.",
    "Mois = 30 jours ; semaine = 7 jours ; jour = 24 h de fonctionnement continu.",
  );

  let ok = req(s, inp.Cm, "Concentration de la solution mère");
  ok = req(s, inp.D, "Dose cible") && ok;
  if (inp.mode === "continu") ok = req(s, inp.Qe, "Débit d'eau à traiter") && ok;
  else ok = req(s, inp.Ve, "Volume d'eau à traiter") && ok;
  const hasStock = opt(s, inp.stock, "Volume de solution mère disponible");
  const hasT = opt(s, inp.t, "Durée de fonctionnement");
  const hasPump = opt(s, inp.pump, "Débit réel de la pompe");
  const hasRes = inp.residual && inp.residual.v !== null && opt(s, inp.residual, "Chlore résiduel mesuré") || (inp.residual?.v === 0);
  const hasDem = opt(s, inp.demand, "Demande en chlore");
  const hasMass = opt(s, inp.productMass, "Quantité de produit disponible");
  const purity = inp.purity ?? null;
  if (purity !== null && (Number.isNaN(purity) || purity <= 0 || purity > 100)) {
    s.checks.push({ level: "error", msg: "Teneur en produit actif : doit être comprise entre 0 et 100 %." });
    ok = false;
  }
  const hasTank = opt(s, inp.tankV, "Volume de la cuve") && opt(s, inp.tankC, "Concentration souhaitée de la cuve");
  if (!ok) return s;

  const Cm = base(inp.Cm, CONC);
  const D = base(inp.D, CONC);
  s.inputs.push({ label: "Mode", value: inp.mode === "continu" ? "A — Traitement en continu" : "B — Traitement par lot" });
  s.inputs.push({ label: "Concentration solution mère Cm", value: show(inp.Cm) });
  s.inputs.push({ label: "Dose cible D", value: show(inp.D) });
  s.conversions.push({ label: "Cm", value: `${show(inp.Cm)} → ${fmt(Cm)} mg/L` });
  s.conversions.push({ label: "D", value: `${show(inp.D)} → ${fmt(D)} mg/L` });

  if (Cm <= D) {
    s.checks.push({ level: "error", msg: "La concentration de la solution mère doit être supérieure à la dose cible. Vérifiez les unités (ex. % au lieu de mg/L)." });
    return s;
  }
  if (kind === "chlore" && D > 10) s.checks.push({ level: "warn", msg: `Dose de ${fmt(D)} mg/L inhabituellement élevée pour une chloration en continu (sauf désinfection de choc). Vérifiez la saisie.` });
  if (kind === "sulfate" && (D < 1 || D > 200)) s.checks.push({ level: "warn", msg: `Dose de ${fmt(D)} mg/L inhabituelle pour un coagulant. Confirmez par jar-test.` });
  if (kind === "chlore" && Cm > 200000) s.checks.push({ level: "warn", msg: "Concentration de solution mère > 200 g/L : valeur inhabituelle pour une solution chlorée, vérifiez l'unité." });

  const pf = purity !== null ? purity / 100 : 1;

  if (inp.mode === "continu") {
    const Qe = base(inp.Qe!, FLOW);
    s.inputs.push({ label: "Débit d'eau Qe", value: show(inp.Qe!) });
    s.conversions.push({ label: "Qe", value: `${show(inp.Qe!)} → ${fmt(Qe)} L/s` });
    const Qi = (D * Qe) / Cm; // L/s
    s.steps.push({ label: "Débit d'injection", formula: "Qi = D × Qe / Cm", substitution: `Qi = ${fmt(D)} × ${fmt(Qe)} / ${fmt(Cm)}`, result: `${fmt(Qi)} L/s` });
    s.steps.push({ label: "Conversion en mL/s", formula: "Qi(mL/s) = Qi(L/s) × 1000", substitution: `${fmt(Qi)} × 1000`, result: `${fmt(Qi * 1000)} mL/s` });
    const Lh = Qi * 3600;
    s.steps.push({ label: "Conversion en L/h", formula: "Qi(L/h) = Qi(L/s) × 3600", substitution: `${fmt(Qi)} × 3600`, result: `${fmt(Lh)} L/h` });
    s.main = { label: "Débit d'injection requis", value: `${fmt(Qi * 1000)} mL/s  (${fmt(Lh)} L/h)` };
    s.results.push(
      { label: "Dose théorique appliquée", value: `${fmt(D)} mg/L` },
      { label: "Qi en mL/min", value: `${fmt(Qi * 60000)} mL/min` },
      { label: "Qi en L/min", value: `${fmt(Qi * 60)} L/min` },
      { label: "Qi en L/s", value: `${fmt(Qi)} L/s` },
    );
    const massDay = D * Qe * 86400; // mg/j de produit actif
    s.forecast.push(
      { label: "Solution mère / heure", value: `${fmt(Lh)} L` },
      { label: "Solution mère / jour (24 h)", value: `${fmt(Lh * 24)} L` },
      { label: "Solution mère / semaine", value: `${fmt(Lh * 24 * 7)} L` },
      { label: "Solution mère / mois (30 j)", value: `${fmt(Lh * 24 * 30)} L` },
      { label: `${kind === "chlore" ? "Chlore actif" : "Sulfate (pur)"} consommé / jour`, value: `${fmt(massDay / 1e6)} kg` },
      { label: `${kind === "chlore" ? "Chlore actif" : "Sulfate (pur)"} consommé / mois`, value: `${fmt((massDay * 30) / 1e6)} kg` },
    );
    if (purity !== null) s.forecast.push({ label: `Produit commercial (${fmt(purity)} %) / jour`, value: `${fmt(massDay / pf / 1e6)} kg` });
    if (hasT) {
      const th = base(inp.t!, TIME);
      const V = Lh * th;
      s.steps.push({ label: "Consommation sur la durée", formula: "V = Qi × t", substitution: `${fmt(Lh)} L/h × ${fmt(th)} h`, result: `${fmt(V)} L` });
      s.results.push({ label: `Volume consommé sur ${show(inp.t!)}`, value: `${fmt(V)} L` });
      s.results.push({ label: `Eau traitée sur ${show(inp.t!)}`, value: `${fmt((Qe * 3600 * th) / 1000)} m³` });
    }
    if (hasStock) {
      const st = base(inp.stock!, VOL);
      const auto = st / Lh;
      s.steps.push({ label: "Autonomie du stock", formula: "T = V_stock / Qi", substitution: `${fmt(st)} L / ${fmt(Lh)} L/h`, result: `${fmt(auto)} h` });
      s.results.push({ label: "Autonomie du stock", value: `${fmt(auto)} h  (${fmt(auto / 24)} jours)` });
      s.results.push({ label: "Volume d'eau traitable avec le stock", value: `${fmt((st * Cm) / D / 1000)} m³` });
    }
    if (hasPump) {
      const P = base(inp.pump!, INJ);
      const dAbs = P - Qi;
      const dRel = (dAbs / Qi) * 100;
      const Deff = (P * Cm) / Qe;
      s.steps.push({ label: "Dose réellement appliquée par la pompe", formula: "D_réelle = Q_pompe × Cm / Qe", substitution: `${fmt(P)} × ${fmt(Cm)} / ${fmt(Qe)}`, result: `${fmt(Deff)} mg/L` });
      s.results.push(
        { label: "Débit réel pompe", value: `${fmt(P * 1000)} mL/s` },
        { label: "Écart absolu (réel − requis)", value: `${fmt(dAbs * 1000)} mL/s` },
        { label: "Écart relatif", value: `${fmt(dRel, 4)} %` },
        { label: "Dose réelle appliquée (théorique)", value: `${fmt(Deff)} mg/L` },
      );
      if (Math.abs(dRel) > 10) s.checks.push({ level: "warn", msg: `La pompe s'écarte de ${fmt(dRel, 3)} % du débit requis : réglez la pompe à ${fmt(Qi * 1000)} mL/s.` });
      else s.checks.push({ level: "ok", msg: "Débit de la pompe conforme au débit requis (écart ≤ 10 %)." });
    }
    s.interpretation.push(`Pour appliquer ${fmt(D)} mg/L sur un débit de ${fmt(Qe)} L/s avec une solution à ${fmt(Cm)} mg/L, la pompe doseuse doit injecter ${fmt(Qi * 1000)} mL/s, soit ${fmt(Lh)} L/h.`);
  } else {
    const Ve = base(inp.Ve!, VOL);
    s.inputs.push({ label: "Volume d'eau Ve", value: show(inp.Ve!) });
    s.conversions.push({ label: "Ve", value: `${show(inp.Ve!)} → ${fmt(Ve)} L` });
    const Vi = (D * Ve) / Cm;
    s.steps.push({ label: "Volume de solution mère", formula: "Vi = D × Ve / Cm", substitution: `Vi = ${fmt(D)} × ${fmt(Ve)} / ${fmt(Cm)}`, result: `${fmt(Vi)} L` });
    const m = D * Ve; // mg
    s.steps.push({ label: "Masse de produit actif", formula: "m = D × Ve", substitution: `${fmt(D)} mg/L × ${fmt(Ve)} L`, result: `${fmt(m)} mg = ${fmt(m / 1000)} g = ${fmt(m / 1e6)} kg` });
    s.main = { label: "Volume de solution mère à injecter", value: Vi < 1 ? `${fmt(Vi * 1000)} mL` : `${fmt(Vi)} L` };
    s.results.push(
      { label: "Dose théorique appliquée", value: `${fmt(D)} mg/L` },
      { label: "Vi en mL", value: `${fmt(Vi * 1000)} mL` },
      { label: `Masse de ${name} actif`, value: `${fmt(m / 1000)} g (${fmt(m / 1e6)} kg)` },
    );
    if (purity !== null) {
      s.steps.push({ label: "Masse de produit commercial", formula: "m_com = m / (teneur / 100)", substitution: `${fmt(m)} / ${fmt(pf)}`, result: `${fmt(m / pf / 1000)} g` });
      s.results.push({ label: `Produit commercial (${fmt(purity)} %)`, value: `${fmt(m / pf / 1000)} g` });
    }
    if (hasStock) {
      const st = base(inp.stock!, VOL);
      s.results.push({ label: "Nombre de lots possibles avec le stock", value: fmt(st / Vi, 4) });
      s.results.push({ label: "Volume d'eau traitable avec le stock", value: `${fmt((st * Cm) / D / 1000)} m³` });
    }
    if (hasT) {
      const th = base(inp.t!, TIME);
      s.results.push({ label: "Débit d'injection équivalent sur la durée", value: `${fmt((Vi / th))} L/h` });
    }
    s.interpretation.push(`Pour traiter ${fmt(Ve)} L à ${fmt(D)} mg/L avec une solution à ${fmt(Cm)} mg/L, ajouter ${fmt(Vi)} L de solution mère.`);
  }

  if (kind === "sulfate") {
    if (hasMass) {
      const mp = base(inp.productMass!, MASS) * pf;
      s.results.push({ label: `Eau traitable avec ${show(inp.productMass!)} de produit`, value: `${fmt(mp / D / 1000)} m³` });
      s.steps.push({ label: "Volume traitable par la quantité de produit", formula: "Ve = m × teneur / D", substitution: `${fmt(base(inp.productMass!, MASS))} mg × ${fmt(pf)} / ${fmt(D)}`, result: `${fmt(mp / D)} L` });
      if (inp.mode === "continu") {
        const Qe = base(inp.Qe!, FLOW);
        const days = mp / (D * Qe * 86400);
        s.results.push({ label: "Autonomie de la quantité de produit", value: `${fmt(days, 4)} jours` });
      }
    }
    if (hasTank) {
      const Vt = base(inp.tankV!, VOL);
      const Ct = base(inp.tankC!, CONC);
      const mt = (Ct * Vt) / pf;
      s.steps.push({ label: "Masse pour préparer la cuve", formula: "m = C_cuve × V_cuve / teneur", substitution: `${fmt(Ct)} × ${fmt(Vt)} / ${fmt(pf)}`, result: `${fmt(mt / 1e6)} kg` });
      s.results.push({ label: `Produit pour une cuve de ${show(inp.tankV!)} à ${show(inp.tankC!)}`, value: `${fmt(mt / 1e6)} kg` });
    }
    s.limits.push("La dose optimale de sulfate d'aluminium dépend de la qualité de l'eau brute (turbidité, pH, alcalinité, température) : elle doit être déterminée ou confirmée par jar-test.");
  }

  if (kind === "chlore") {
    s.limits.push("Ne pas confondre : dose appliquée (injectée), demande en chlore (consommée par l'eau), chlore résiduel libre (restant) et concentration de la solution mère.");
    s.limits.push("La dose à appliquer pour obtenir un résiduel visé = demande en chlore + résiduel visé ; elle ne peut pas être déduite du seul résiduel sans connaître la demande.");
    if (hasDem) {
      const dem = base(inp.demand!, CONC);
      const expected = D - dem;
      s.results.push({ label: "Résiduel théorique attendu (D − demande)", value: `${fmt(Math.max(expected, 0))} mg/L` });
      if (expected <= 0) s.checks.push({ level: "warn", msg: "La dose est inférieure ou égale à la demande estimée : aucun chlore résiduel n'est attendu." });
    }
    if (hasRes) {
      const r = base(inp.residual!, CONC);
      s.results.push({ label: "Chlore résiduel mesuré (terrain)", value: `${fmt(r)} mg/L` });
      s.results.push({ label: "Demande apparente (D − résiduel mesuré)", value: `${fmt(Math.max(D - r, 0))} mg/L` });
      if (r > D) s.checks.push({ level: "warn", msg: "Résiduel mesuré supérieur à la dose appliquée : incohérent, vérifiez la mesure ou le réglage." });
    }
  }

  s.limits.push("Résultats théoriques : ils doivent être confrontés aux mesures de terrain, aux essais de traitement et aux exigences sanitaires applicables. Une dose calculée ne garantit pas la potabilité.");
  s.limits.push("Vérifier régulièrement la concentration réelle de la solution mère (dégradation du chlore dans le temps, erreurs de préparation).");
  if (!s.checks.some((c) => c.level === "error" || c.level === "warn")) s.checks.push({ level: "ok", msg: "Données cohérentes, unités converties et compatibles." });
  return s;
}

/** Préparation d'une solution mère à partir d'un produit solide. */
export function computePreparation(inp: { C: Q; V: Q; purity: number | null }): Sheet {
  const s = emptySheet("dilution", "Préparation d'une solution mère");
  let ok = req(s, inp.C, "Concentration cible");
  ok = req(s, inp.V, "Volume final de solution") && ok;
  const p = inp.purity ?? 100;
  if (Number.isNaN(p) || p <= 0 || p > 100) { s.checks.push({ level: "error", msg: "Teneur en produit actif entre 0 et 100 %." }); ok = false; }
  if (!ok) return s;
  const C = base(inp.C, CONC), V = base(inp.V, VOL);
  const mAct = C * V;
  const mCom = mAct / (p / 100);
  s.inputs.push({ label: "Concentration cible", value: show(inp.C) }, { label: "Volume final", value: show(inp.V) }, { label: "Teneur en produit actif", value: `${fmt(p)} %` });
  s.conversions.push({ label: "C", value: `${show(inp.C)} → ${fmt(C)} mg/L` }, { label: "V", value: `${show(inp.V)} → ${fmt(V)} L` });
  s.steps.push({ label: "Masse de substance active", formula: "m_act = C × V", substitution: `${fmt(C)} × ${fmt(V)}`, result: `${fmt(mAct / 1e6)} kg` });
  s.steps.push({ label: "Masse de produit commercial", formula: "m_com = m_act / (teneur/100)", substitution: `${fmt(mAct / 1e6)} / ${fmt(p / 100)}`, result: `${fmt(mCom / 1e6)} kg` });
  s.main = { label: "Produit commercial à peser", value: `${fmt(mCom / 1e6)} kg (${fmt(mCom / 1000)} g)` };
  s.results.push({ label: "Substance active", value: `${fmt(mAct / 1000)} g` }, { label: "Concentration obtenue", value: `${fmt(C)} mg/L = ${fmt(C / 10000)} % (m/v)` });
  s.hypotheses.push("Dissoudre le produit puis compléter jusqu'au volume final : le volume d'eau ajouté n'est pas égal au volume final.");
  s.interpretation.push(`Peser ${fmt(mCom / 1000)} g de produit commercial, dissoudre et compléter à ${fmt(V)} L.`);
  s.limits.push("La teneur réelle du produit commercial peut varier selon le lot : se référer à la fiche technique.");
  s.checks.push({ level: "ok", msg: "Données cohérentes." });
  return s;
}

/** Dilution C1V1 = C2V2. Calcule V1 (volume concentré) à partir de C1, C2, V2. */
export function computeDilution(inp: { C1: Q; C2: Q; V2: Q }): Sheet {
  const s = emptySheet("dilution", "Dilution d'une solution (C1V1 = C2V2)");
  let ok = req(s, inp.C1, "Concentration initiale C1");
  ok = req(s, inp.C2, "Concentration finale C2") && ok;
  ok = req(s, inp.V2, "Volume final V2") && ok;
  if (!ok) return s;
  const C1 = base(inp.C1, CONC), C2 = base(inp.C2, CONC), V2 = base(inp.V2, VOL);
  s.inputs.push({ label: "C1", value: show(inp.C1) }, { label: "C2", value: show(inp.C2) }, { label: "V2", value: show(inp.V2) });
  s.conversions.push({ label: "C1", value: `${fmt(C1)} mg/L` }, { label: "C2", value: `${fmt(C2)} mg/L` }, { label: "V2", value: `${fmt(V2)} L` });
  if (C2 >= C1) { s.checks.push({ level: "error", msg: "C2 doit être inférieure à C1 pour une dilution." }); return s; }
  const V1 = (C2 * V2) / C1;
  s.steps.push({ label: "Volume de solution concentrée", formula: "V1 = C2 × V2 / C1", substitution: `${fmt(C2)} × ${fmt(V2)} / ${fmt(C1)}`, result: `${fmt(V1)} L` });
  s.steps.push({ label: "Eau à ajouter (approx.)", formula: "V_eau ≈ V2 − V1", substitution: `${fmt(V2)} − ${fmt(V1)}`, result: `${fmt(V2 - V1)} L` });
  s.main = { label: "Volume de solution concentrée V1", value: `${fmt(V1)} L` };
  s.results.push({ label: "Eau à ajouter (compléter au trait de jauge)", value: `${fmt(V2 - V1)} L` }, { label: "Facteur de dilution", value: fmt(C1 / C2, 4) });
  s.hypotheses.push("C1 et C2 exprimées sur la même base (mg/L de substance active).", "Volumes additifs (approximation valable pour les solutions diluées) : compléter au volume final plutôt que d'ajouter un volume d'eau fixe.");
  s.interpretation.push(`Prélever ${fmt(V1)} L de solution à ${fmt(C1)} mg/L et compléter à ${fmt(V2)} L.`);
  s.limits.push("Les solutions chlorées se dégradent : mesurer la concentration réelle après préparation.");
  s.checks.push({ level: "ok", msg: "Données cohérentes." });
  return s;
}

/** Concentration finale après dilution : C2 = C1 × V1 / V2. */
export function finalConcentration(C1: number, V1: number, V2: number) {
  if (V2 <= 0) throw new Error("V2 doit être > 0");
  return (C1 * V1) / V2;
}

/** Consommation et stock. Valeurs dans une même unité de quantité (kg ou L). */
export function computeStock(inp: { product: string; unit: string; rate: Q; initial: number | null; consumed: number | null; price: number | null; period: number | null; safety: number | null }): Sheet {
  const s = emptySheet("stock", `Consommation et stock — ${inp.product || "produit"}`);
  const u = inp.unit || "kg";
  let ok = req(s, inp.rate, "Consommation");
  if (inp.initial === null || Number.isNaN(inp.initial) || inp.initial < 0) { s.checks.push({ level: "error", msg: "Stock initial obligatoire et positif." }); ok = false; }
  for (const [k, v] of [["Stock consommé", inp.consumed], ["Prix unitaire", inp.price], ["Période de prévision", inp.period], ["Stock de sécurité", inp.safety]] as const) {
    if (v !== null && (Number.isNaN(v) || v < 0)) { s.checks.push({ level: "error", msg: `${k} : valeur invalide.` }); ok = false; }
  }
  if (!ok) return s;
  const perDay = toBase(inp.rate.v as number, { "/h": 24, "/jour": 1, "/semaine": 1 / 7, "/mois": 1 / 30 }, inp.rate.u);
  const consumed = inp.consumed ?? 0;
  const remaining = inp.initial! - consumed;
  if (remaining < 0) { s.checks.push({ level: "error", msg: "Le stock consommé dépasse le stock initial." }); return s; }
  const auto = remaining / perDay;
  s.inputs.push({ label: "Produit", value: inp.product || "—" }, { label: "Consommation", value: `${fmt(inp.rate.v as number)} ${u}${inp.rate.u}` }, { label: "Stock initial", value: `${fmt(inp.initial!)} ${u}` });
  s.conversions.push({ label: "Consommation journalière", value: `${fmt(perDay)} ${u}/jour` });
  s.steps.push({ label: "Stock restant", formula: "S_rest = S_init − S_cons", substitution: `${fmt(inp.initial!)} − ${fmt(consumed)}`, result: `${fmt(remaining)} ${u}` });
  s.steps.push({ label: "Autonomie", formula: "T = S_rest / C_jour", substitution: `${fmt(remaining)} / ${fmt(perDay)}`, result: `${fmt(auto, 4)} jours` });
  s.main = { label: "Autonomie du stock", value: `${fmt(auto, 4)} jours` };
  s.forecast.push(
    { label: "Par heure", value: `${fmt(perDay / 24)} ${u}` },
    { label: "Par jour", value: `${fmt(perDay)} ${u}` },
    { label: "Par semaine", value: `${fmt(perDay * 7)} ${u}` },
    { label: "Par mois (30 j)", value: `${fmt(perDay * 30)} ${u}` },
  );
  s.results.push({ label: "Stock restant", value: `${fmt(remaining)} ${u}` });
  if (inp.period) {
    const need = perDay * inp.period + (inp.safety ?? 0);
    const order = Math.max(need - remaining, 0);
    s.steps.push({ label: "Quantité à commander", formula: "Cmd = C_jour × période + sécurité − S_rest", substitution: `${fmt(perDay)} × ${fmt(inp.period)} + ${fmt(inp.safety ?? 0)} − ${fmt(remaining)}`, result: `${fmt(order)} ${u}` });
    s.results.push({ label: `Besoin sur ${fmt(inp.period)} jours`, value: `${fmt(perDay * inp.period)} ${u}` }, { label: "Quantité à commander", value: `${fmt(order)} ${u}` });
    if (inp.price) s.results.push({ label: "Coût de la commande", value: fmt(order * inp.price) });
  }
  if (inp.price) s.results.push({ label: "Coût de consommation / mois", value: fmt(perDay * 30 * inp.price) }, { label: "Coût de consommation / jour", value: fmt(perDay * inp.price) });
  if (auto < 7) s.checks.push({ level: "warn", msg: "Autonomie inférieure à 7 jours : prévoir un réapprovisionnement." });
  else s.checks.push({ level: "ok", msg: "Données cohérentes." });
  s.hypotheses.push("Consommation supposée constante ; mois = 30 jours.");
  s.limits.push("Ajuster la consommation selon les variations de débit et de qualité de l'eau.");
  return s;
}

export const FACTORS = { CONC, FLOW, INJ, VOL, MASS, TIME, fromBase };

/** Dimensionnement décanteur / filtre / bassin de contact.
 *  V = Q × t ; S = Q / Vh (charge superficielle) ; H = V / S. Q en m³/h, t en h, Vh en m/h. */
export function computeSizing(inp: { type: "decanteur" | "filtre" | "contact"; Q: Q; t?: Q; V?: Q; vh?: number | null; n?: number | null }): Sheet {
  const label = { decanteur: "décanteur", filtre: "filtre", contact: "bassin de contact" }[inp.type];
  const s = emptySheet("dimensionnement", `Dimensionnement — ${label}`);
  let ok = req(s, inp.Q, "Débit d'eau");
  const hasT = opt(s, inp.t, "Temps de contact / séjour");
  const hasV = opt(s, inp.V, "Volume existant");
  if (!hasT && !hasV) { s.checks.push({ level: "error", msg: "Renseignez le temps de contact (pour calculer le volume) ou un volume existant (pour calculer le temps de séjour)." }); ok = false; }
  const vh = inp.vh ?? null;
  if (inp.type !== "contact" && (vh === null || Number.isNaN(vh) || vh <= 0)) { s.checks.push({ level: "error", msg: `Vitesse ${inp.type === "filtre" ? "de filtration" : "ascensionnelle (charge superficielle)"} obligatoire et > 0, en m/h.` }); ok = false; }
  const n = inp.n && inp.n > 0 ? Math.round(inp.n) : 1;
  if (!ok) return s;
  const Qm3h = base(inp.Q, FLOW) * 3.6;
  s.inputs.push({ label: "Ouvrage", value: label }, { label: "Débit Q", value: show(inp.Q) });
  s.conversions.push({ label: "Q", value: `${show(inp.Q)} → ${fmt(Qm3h)} m³/h` });
  let V: number;
  if (hasT) {
    const th = base(inp.t!, TIME);
    s.inputs.push({ label: "Temps de séjour t", value: show(inp.t!) });
    s.conversions.push({ label: "t", value: `${fmt(th)} h` });
    V = Qm3h * th;
    s.steps.push({ label: "Volume utile", formula: "V = Q × t", substitution: `${fmt(Qm3h)} m³/h × ${fmt(th)} h`, result: `${fmt(V)} m³` });
    if (hasV) {
      const Vex = base(inp.V!, VOL) / 1000;
      const tex = Vex / Qm3h;
      s.results.push({ label: "Temps de séjour de l'ouvrage existant", value: `${fmt(tex)} h (${fmt(tex * 60)} min)` });
      if (Vex < V) s.checks.push({ level: "warn", msg: `L'ouvrage existant (${fmt(Vex)} m³) est inférieur au volume requis (${fmt(V)} m³).` });
    }
  } else {
    V = base(inp.V!, VOL) / 1000;
    s.inputs.push({ label: "Volume existant", value: show(inp.V!) });
    const th = V / Qm3h;
    s.steps.push({ label: "Temps de séjour", formula: "t = V / Q", substitution: `${fmt(V)} m³ / ${fmt(Qm3h)} m³/h`, result: `${fmt(th)} h = ${fmt(th * 60)} min` });
  }
  s.main = { label: hasT ? "Volume utile requis" : "Temps de séjour", value: hasT ? `${fmt(V)} m³` : `${fmt((V / Qm3h) * 60)} min` };
  s.results.push({ label: "Volume utile total", value: `${fmt(V)} m³` });
  if (inp.type !== "contact") {
    const S = Qm3h / vh!;
    s.steps.push({ label: "Surface totale", formula: inp.type === "filtre" ? "S = Q / v_f" : "S = Q / V_h", substitution: `${fmt(Qm3h)} / ${fmt(vh!)}`, result: `${fmt(S)} m²` });
    const H = V / S;
    s.steps.push({ label: "Hauteur utile", formula: "H = V / S", substitution: `${fmt(V)} / ${fmt(S)}`, result: `${fmt(H)} m` });
    s.results.push({ label: "Surface totale", value: `${fmt(S)} m²` }, { label: "Hauteur utile", value: `${fmt(H)} m` });
    if (n > 1) s.results.push({ label: `Surface par unité (${n} unités)`, value: `${fmt(S / n)} m²` });
    const Su = S / n;
    s.results.push({ label: "Côté si carré (par unité)", value: `${fmt(Math.sqrt(Su), 4)} m` }, { label: "Diamètre si circulaire (par unité)", value: `${fmt(Math.sqrt((4 * Su) / Math.PI), 4)} m` });
    if (inp.type === "filtre") {
      s.limits.push("Pour un filtre, la vitesse de filtration fixe la surface ; le temps de contact concerne le lit filtrant. Prévoir une unité de réserve pour le lavage (calcul à N−1 unités).");
      if (n > 1) s.results.push({ label: `Vitesse avec 1 filtre en lavage`, value: `${fmt(Qm3h / (Su * (n - 1)))} m/h` });
    } else s.limits.push("La vitesse ascensionnelle dépend du type de décanteur (statique, lamellaire, à lit de boues) et de la qualité de la floculation : à valider par essais.");
    s.hypotheses.push("Charge superficielle exprimée en m³/m²/h = m/h.");
  } else s.limits.push("Pour la désinfection, vérifier le produit C × t (résiduel × temps de contact) et l'efficacité hydraulique du bassin (chicanes).");
  s.hypotheses.push("Débit constant ; volume utile hors revanche et zone de boues.");
  s.interpretation.push(`Pour ${fmt(Qm3h)} m³/h, le ${label} doit offrir un volume utile de ${fmt(V)} m³.`);
  s.limits.push("Valeurs de conception théoriques ; ne pas présenter comme une valeur réglementaire. Confronter aux normes et retours d'exploitation.");
  s.checks.push({ level: "ok", msg: "Données cohérentes, unités converties." });
  return s;
}
