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

// Each relationship is a balance of products. A chosen variable occurs in one
// term only; isolating that term gives its exact inverse (including geometry).
export type EquationVariable = { key: string; label: string; units: UnitTable; zero?: boolean; max?: number; integer?: boolean };
type Term = { coefficient: number; factors: Record<string, number> };
export type Equation = { id: string; module: string; label: string; formula: string; variables: EquationVariable[]; terms: Term[]; example: Record<string, number>; order?: boolean };
const SCALAR = { "—": 1 };
const RATE = { "/h": 24, "/jour": 1, "/semaine": 1 / 7, "/mois": 1 / 30 };
const AREA = { "m²": 1, "cm²": 0.0001 };
const LENGTH = { m: 1, cm: 0.01, mm: 0.001 };
const SPEED = { "m/h": 1, "m/s": 3600 };
const variable = (key: string, label: string, units: UnitTable, extra: Partial<EquationVariable> = {}): EquationVariable => ({ key, label, units, ...extra });
const term = (coefficient: number, factors: Record<string, number>): Term => ({ coefficient, factors });
const equation = (id: string, module: string, label: string, formula: string, variables: EquationVariable[], terms: Term[], example: Record<string, number>, order = false): Equation => ({ id, module, label, formula, variables, terms, example, order });
const cm = variable("Cm", "Concentration de la solution mère (Cm)", CONC);
const dose = variable("D", "Dose appliquée (D)", CONC);
const waterFlow = variable("Qe", "Débit d'eau (Qe)", FLOW);
const injection = variable("Qi", "Débit d'injection (Qi)", INJ);
const waterVolume = variable("Ve", "Volume d'eau (Ve)", VOL);
const injectedVolume = variable("Vi", "Volume de solution injectée (Vi)", VOL);
const duration = variable("t", "Durée (t)", TIME);
const mass = variable("m", "Masse de produit commercial (m)", MASS);
const purityVar = variable("p", "Teneur en produit actif", { "%": 1 }, { max: 100 });
const concentration = variable("C", "Concentration de la cuve (C)", CONC);
const volume = variable("V", "Volume utile / final (V)", VOL);
const sizingFlow = variable("Q", "Débit d'eau (Q)", { "m³/h": 1, "L/s": 3.6, "L/min": 0.06, "L/h": 0.001, "m³/jour": 1 / 24 });
const sizingVolume = variable("V", "Volume utile total (V)", { "m³": 1, L: 0.001 });
const area = variable("S", "Surface totale (S)", AREA);
const height = variable("H", "Hauteur utile (H)", LENGTH);
const speed = variable("v", "Vitesse ascensionnelle / de filtration", SPEED);
const number = variable("n", "Nombre d'unités identiques", { unités: 1 }, { integer: true });
const unitArea = variable("Su", "Surface par unité (Su)", AREA);
const remaining = variable("R", "Stock restant (R)", SCALAR, { zero: true });
const dailyRate = variable("r", "Consommation par période", RATE);
const days = variable("T", "Autonomie", { jours: 1, h: 1 / 24 });
const period = variable("P", "Période de prévision", { jours: 1, semaines: 7, mois: 30 });
const price = variable("prix", "Prix unitaire", { "monnaie / quantité": 1 }, { zero: true });
const cost = variable("coût", "Coût", { "unité monétaire": 1 }, { zero: true });

export const EQUATIONS: Equation[] = [
  equation("essaiInjection", "essais", "Dose et volume ajouté au bécher", "Vi × Cm = D × Ve (même base de produit)", [injectedVolume, cm, dose, waterVolume], [term(1, { Vi: 1, Cm: 1 }), term(-1, { D: 1, Ve: 1 })], { Vi: 0.002, Cm: 10000, D: 20, Ve: 1 }),
  equation("abattement", "essais", "Abattement de turbidité", "Tf = T0 × (1 − rendement / 100)", [variable("eta", "Abattement de turbidité", { "%": 1 }, { zero: true, max: 100 }), variable("T0", "Turbidité brute", { NTU: 1 }), variable("Tf", "Turbidité après décantation", { NTU: 1 }, { zero: true })], [term(1, { Tf: 1 }), term(-1, { T0: 1 }), term(0.01, { T0: 1, eta: 1 })], { eta: 98, T0: 50, Tf: 1 }),
  equation("ctEssai", "essais", "Exposition CT indicative", "CT = C_libre × 60 × t_effectif (t en h)", [variable("CT", "CT indicatif", { "mg·min/L": 1 }, { zero: true }), variable("Cl", "Chlore libre en fin de contact", CONC, { zero: true }), variable("te", "Temps de contact effectif", TIME)], [term(1, { CT: 1 }), term(-60, { Cl: 1, te: 1 })], { CT: 15, Cl: 0.5, te: 0.5 }),
  equation("continu", "dosage", "Dosage en continu", "Qi × Cm = D × Qe", [injection, cm, dose, waterFlow], [term(1, { Qi: 1, Cm: 1 }), term(-1, { D: 1, Qe: 1 })], { Qi: 0.002625, Cm: 40000, D: 30, Qe: 3.5 }),
  equation("lot", "dosage", "Dosage par lot", "Vi × Cm = D × Ve", [injectedVolume, cm, dose, waterVolume], [term(1, { Vi: 1, Cm: 1 }), term(-1, { D: 1, Ve: 1 })], { Vi: 0.5, Cm: 40000, D: 2, Ve: 10000 }),
  equation("consommation", "dosage", "Consommation / autonomie de solution", "Vi = Qi × 3 600 × t (Qi en L/s, t en h)", [injectedVolume, injection, duration], [term(1, { Vi: 1 }), term(-3600, { Qi: 1, t: 1 })], { Vi: 226.8, Qi: 0.002625, t: 24 }),
  equation("eau", "dosage", "Volume d'eau et durée de traitement", "Ve = Qe × 3 600 × t", [waterVolume, waterFlow, duration], [term(1, { Ve: 1 }), term(-3600, { Qe: 1, t: 1 })], { Ve: 302400, Qe: 3.5, t: 24 }),
  equation("masseActive", "dosage", "Masse de substance active", "m_act = D × Ve", [variable("ma", "Masse de substance active", MASS), dose, waterVolume], [term(1, { ma: 1 }), term(-1, { D: 1, Ve: 1 })], { ma: 40000000, D: 40, Ve: 1000000 }),
  equation("capacite", "dosage", "Produit commercial et eau traitable", "m × teneur / 100 = D × Ve", [mass, purityVar, dose, waterVolume], [term(0.01, { m: 1, p: 1 }), term(-1, { D: 1, Ve: 1 })], { m: 50000000, p: 80, D: 40, Ve: 1000000 }),
  equation("autonomieProduit", "dosage", "Autonomie du produit commercial", "m × teneur / 100 = D × Qe × 3 600 × t", [mass, purityVar, dose, waterFlow, duration], [term(0.01, { m: 1, p: 1 }), term(-3600, { D: 1, Qe: 1, t: 1 })], { m: 12600000, p: 80, D: 10, Qe: 3.5, t: 80 }),
  equation("residuel", "chlore", "Dose, demande et résiduel théorique", "D = demande + résiduel", [dose, variable("dem", "Demande en chlore", CONC, { zero: true }), variable("res", "Chlore résiduel théorique", CONC, { zero: true })], [term(1, { D: 1 }), term(-1, { dem: 1 }), term(-1, { res: 1 })], { D: 2, dem: 1.5, res: 0.5 }),
  equation("preparation", "dilution", "Préparation / cuve de solution mère", "m × teneur / 100 = C × V", [mass, concentration, volume, purityVar], [term(0.01, { m: 1, p: 1 }), term(-1, { C: 1, V: 1 })], { m: 125000000, C: 100000, V: 1000, p: 80 }),
  equation("titre", "dilution", "Masse active et teneur commerciale", "m_act = m × teneur / 100", [variable("ma", "Masse de substance active", MASS), mass, purityVar], [term(1, { ma: 1 }), term(-0.01, { m: 1, p: 1 })], { ma: 100000000, m: 125000000, p: 80 }),
  equation("dilution", "dilution", "Dilution C1V1 = C2V2", "C1 × V1 = C2 × V2", [variable("V1", "Volume prélevé de solution concentrée (V1)", VOL), variable("C1", "Concentration initiale (C1)", CONC), variable("C2", "Concentration finale (C2)", CONC), variable("V2", "Volume final (V2)", VOL)], [term(1, { C1: 1, V1: 1 }), term(-1, { C2: 1, V2: 1 })], { C1: 120000, C2: 10000, V1: 10, V2: 120 }),
  equation("eauAjoutee", "dilution", "Volumes de dilution (approximation)", "V2 = V1 + V_eau", [variable("eau", "Volume d'eau ajouté", VOL), variable("V1", "Volume de concentré (V1)", VOL), variable("V2", "Volume final (V2)", VOL)], [term(1, { V2: 1 }), term(-1, { V1: 1 }), term(-1, { eau: 1 })], { eau: 110, V1: 10, V2: 120 }),
  equation("sejour", "dimensionnement", "Débit, volume et temps de séjour", "V = Q × t (Q en m³/h, t en h)", [sizingVolume, sizingFlow, duration], [term(1, { V: 1 }), term(-1, { Q: 1, t: 1 })], { V: 200, Q: 100, t: 2 }),
  equation("surface", "dimensionnement", "Débit, surface et vitesse", "Q = S × v", [area, sizingFlow, speed], [term(1, { Q: 1 }), term(-1, { S: 1, v: 1 })], { Q: 100, S: 100, v: 1 }),
  equation("hauteur", "dimensionnement", "Volume, surface et hauteur", "V = S × H", [height, sizingVolume, area], [term(1, { V: 1 }), term(-1, { S: 1, H: 1 })], { V: 200, S: 100, H: 2 }),
  equation("unites", "dimensionnement", "Répartition entre ouvrages identiques", "S = n × Su", [unitArea, area, number], [term(1, { S: 1 }), term(-1, { n: 1, Su: 1 })], { S: 100, n: 4, Su: 25 }),
  equation("carre", "dimensionnement", "Ouvrage carré", "Su = côté²", [variable("a", "Côté par unité", LENGTH), unitArea], [term(1, { Su: 1 }), term(-1, { a: 2 })], { Su: 25, a: 5 }),
  equation("cercle", "dimensionnement", "Ouvrage circulaire", "Su = π × diamètre² / 4", [variable("d", "Diamètre par unité", LENGTH), unitArea], [term(1, { Su: 1 }), term(-Math.PI / 4, { d: 2 })], { Su: 25 * Math.PI, d: 10 }),
  equation("lavage", "dimensionnement", "Filtre avec une unité en lavage", "Q = vitesse_lavage × Su × (n − 1)", [variable("vl", "Vitesse avec un filtre en lavage", SPEED), sizingFlow, unitArea, number], [term(1, { Q: 1 }), term(-1, { vl: 1, Su: 1, n: 1 }), term(1, { vl: 1, Su: 1 })], { Q: 100, vl: 2, Su: 25, n: 3 }),
  equation("stockRestant", "stock", "Stock initial, consommé et restant", "R = I − consommé", [remaining, variable("I", "Stock initial", SCALAR, { zero: true }), variable("cons", "Stock déjà consommé", SCALAR, { zero: true })], [term(1, { R: 1 }), term(-1, { I: 1 }), term(1, { cons: 1 })], { R: 400, I: 500, cons: 100 }),
  equation("autonomieStock", "stock", "Autonomie et consommation", "R = consommation_journalière × T", [days, remaining, dailyRate], [term(1, { R: 1 }), term(-1, { r: 1, T: 1 })], { R: 400, r: 25, T: 16 }),
  equation("besoin", "stock", "Besoin de produit sur une période", "Besoin = consommation_journalière × P", [variable("B", "Quantité consommée / besoin", SCALAR, { zero: true }), dailyRate, period], [term(1, { B: 1 }), term(-1, { r: 1, P: 1 })], { B: 750, r: 25, P: 30 }),
  equation("commande", "stock", "Commande et stock de sécurité", "Commande = max(consommation × P + sécurité − R, 0)", [variable("O", "Quantité à commander", SCALAR, { zero: true }), dailyRate, period, variable("securite", "Stock de sécurité", SCALAR, { zero: true }), remaining], [term(1, { O: 1 }), term(-1, { r: 1, P: 1 }), term(-1, { securite: 1 }), term(1, { R: 1 })], { O: 400, r: 25, P: 30, securite: 50, R: 400 }, true),
  equation("cout", "stock", "Coût et prix unitaire", "Coût = quantité × prix", [cost, variable("quantite", "Quantité de produit", SCALAR, { zero: true }), price], [term(1, { coût: 1 }), term(-1, { quantite: 1, prix: 1 })], { coût: 2000, quantite: 400, prix: 5 }),
  equation("coutPeriode", "stock", "Coût de consommation sur une période", "Coût = consommation_journalière × P × prix", [cost, dailyRate, period, price], [term(1, { coût: 1 }), term(-1, { r: 1, P: 1, prix: 1 })], { coût: 3750, r: 25, P: 30, prix: 5 }),
];

export type ReversibleSheet = Sheet & { solved?: { key: string; value: number; unit: string } };
export function computeReversible(id: string, target: string, inputs: Record<string, Q>, outputUnit: string, quantityUnit = "kg"): ReversibleSheet {
  const eq = EQUATIONS.find((e) => e.id === id);
  const s: ReversibleSheet = emptySheet(eq?.module ?? "calcul", eq?.label ?? "Calcul réversible");
  const unknown = eq?.variables.find((v) => v.key === target);
  if (!eq || !unknown) { s.checks.push({ level: "error", msg: "Relation ou paramètre inconnu." }); return s; }
  const values: Record<string, number> = {};
  const displayUnit = (u: string) => u === "—" ? quantityUnit : eq.module === "stock" && u.startsWith("/") ? `${quantityUnit}${u}` : u;
  for (const v of eq.variables) {
    if (v.key === target) continue;
    const q = inputs[v.key];
    if (!req(s, q, v.label, !v.zero) || !q) continue;
    try {
      const b = base(q, v.units);
      if (!Number.isFinite(b)) throw new Error("Valeur non finie.");
      if (v.max !== undefined && b > v.max) throw new Error(`${v.label} : maximum ${v.max}.`);
      if (v.integer && !Number.isInteger(b)) throw new Error("Le nombre d'unités doit être entier.");
      values[v.key] = b;
      s.inputs.push({ label: v.label, value: `${fmt(q.v as number)} ${displayUnit(q.u)}` });
      const baseUnit = Object.keys(v.units).find((u) => v.units[u] === 1) ?? "—";
      s.conversions.push({ label: v.label, value: `${fmt(q.v as number)} ${displayUnit(q.u)} → ${fmt(b)} ${displayUnit(baseUnit)}` });
    } catch (e) { s.checks.push({ level: "error", msg: e instanceof Error ? e.message : "Unité invalide." }); }
  }
  if (s.checks.some((c) => c.level === "error")) return s;
  if (eq.order && target !== "O" && values["O"] === 0) {
    s.checks.push({ level: "error", msg: "Une commande nulle donne seulement une inégalité : ce paramètre ne peut pas être déterminé de façon unique." }); return s;
  }
  let coefficient = 0, constant = 0, power = 1;
  for (const t of eq.terms) {
    let product = t.coefficient;
    for (const [key, exponent] of Object.entries(t.factors)) {
      if (key !== target) product *= Math.pow(values[key] ?? NaN, exponent);
    }
    if (target in t.factors) { coefficient += product; power = t.factors[target] ?? 1; }
    else constant += product;
  }
  if (!Number.isFinite(coefficient) || !Number.isFinite(constant) || coefficient === 0) {
    s.checks.push({ level: "error", msg: "Les valeurs connues ne permettent pas de déterminer une valeur unique (division par zéro ou relation indéterminée)." }); return s;
  }
  let answer = -constant / coefficient;
  if (power === 2) answer = answer >= 0 ? Math.sqrt(answer) : NaN;
  if (eq.order && target === "O") answer = Math.max(answer, 0);
  if (!Number.isFinite(answer) || (unknown.zero ? answer < 0 : answer <= 0) || (unknown.max !== undefined && answer > unknown.max)) {
    s.checks.push({ level: "error", msg: "Le résultat est hors du domaine physique : vérifiez les valeurs connues (valeur négative, nulle ou teneur supérieure à 100 %)." }); return s;
  }
  if (unknown.integer) {
    if (Math.abs(answer - Math.round(answer)) > 1e-8) { s.checks.push({ level: "error", msg: "Les surfaces saisies ne correspondent pas à un nombre entier d'unités identiques." }); return s; }
    answer = Math.round(answer);
  }
  values[target] = answer;
  if ((id === "continu" || id === "lot") && (values["Cm"] ?? 0) <= (values["D"] ?? 0)) s.checks.push({ level: "error", msg: "La solution mère doit être plus concentrée que la dose appliquée." });
  if (id === "dilution" && ((values["C2"] ?? 0) >= (values["C1"] ?? 0) || (values["V1"] ?? 0) >= (values["V2"] ?? 0))) s.checks.push({ level: "error", msg: "Une dilution exige C2 < C1 et V1 < V2." });
  if (id === "lavage" && (values["n"] ?? 0) <= 1) s.checks.push({ level: "error", msg: "Au moins deux filtres sont nécessaires avec une unité en lavage." });
  if (id === "abattement" && (values["Tf"] ?? 0) > (values["T0"] ?? 0)) s.checks.push({ level: "error", msg: "Un abattement positif exige une turbidité finale au plus égale à la turbidité initiale." });
  if (s.checks.some((c) => c.level === "error")) return s;
  try {
    const converted = fromBase(answer, unknown.units, outputUnit);
    const unit = displayUnit(outputUnit);
    s.solved = { key: target, value: converted, unit };
    s.main = { label: unknown.label, value: `${fmt(converted)} ${unit}` };
    s.steps.push({ label: `Recherche : ${unknown.label}`, formula: eq.formula, substitution: `${fmt(coefficient)} × ${target}${power === 2 ? "²" : ""} + (${fmt(constant)}) = 0`, result: s.main.value });
    for (const u of Object.keys(unknown.units)) s.results.push({ label: displayUnit(u), value: `${fmt(fromBase(answer, unknown.units, u))} ${displayUnit(u)}` });
    s.interpretation.push(`${unknown.label} : ${s.main.value}, selon les valeurs connues et la relation ${eq.formula}.`);
    s.checks.push({ level: "ok", msg: "Paramètre déterminé, unités converties et données cohérentes." });
  } catch { s.checks.push({ level: "error", msg: "Unité de résultat inconnue." }); return s; }
  s.hypotheses.push("Les autres paramètres sont connus et constants. Concentrations exprimées sur la même base de substance active.");
  if (eq.module === "stock") s.hypotheses.push(`Quantités dans la même unité (${quantityUnit}) ; prix par cette unité ; mois = 30 jours, semaine = 7 jours.`);
  if (id === "eauAjoutee" || id === "dilution") s.hypotheses.push("Volumes additifs approximativement : compléter au volume final et vérifier la concentration.");
  if (id === "residuel") s.limits.push("Bilan théorique après satisfaction de la demande. Un résiduel mesuré nul ne permet pas de déduire une demande unique : mesurer la demande séparément.");
  if (id === "ctEssai") s.limits.push("CT indicatif uniquement : le temps effectif n'est pas le temps nominal V/Q. Valider l'hydraulique, la température et les exigences propres aux microorganismes ; aucun taux d'inactivation n'est déduit.");
  if (eq.module === "dimensionnement") s.limits.push("Dimensions utiles hors revanche et boues ; valider les vitesses, le temps de contact et la réserve de lavage par conception et essais.");
  s.limits.push("Résultats théoriques : confirmer par mesures de terrain et jar-test pour le coagulant. Le calcul ne garantit pas la potabilité.");
  return s;
}

export type TrialPoint = { dose: number; response: number; ph: number; total?: number };
export type TrialInput = {
  kind: "chlore" | "sulfate"; points: TrialPoint[]; rawTurbidity: number;
  contactMinutes: number; temperature: number; target: number; maxResidual: number;
  phMin: number; phMax: number; stockConcentration: Q; beakerVolume: Q;
  breakpoint: number | null; metadata: Row[]; demonstration: boolean;
};
export type TrialResult = Sheet & {
  series: (TrialPoint & { removal: number; combined?: number; demand?: number; injectionMl: number })[];
  selectedDose?: number;
};

/** Analyse de mesures, sans interpolation ni identification automatique du breakpoint. */
export function computeTrials(inp: TrialInput): TrialResult {
  const chlorine = inp.kind === "chlore";
  const s: TrialResult = { ...emptySheet("essais", chlorine ? "Essai de chloration — dose / résiduel" : "Jar-test — sulfate d'aluminium"), series: [] };
  const error = (msg: string) => s.checks.push({ level: "error", msg });
  for (const [name, value, positive] of [
    ["Turbidité brute", inp.rawTurbidity, !chlorine], ["Temps de contact / décantation", inp.contactMinutes, true],
    ["Objectif opérationnel", inp.target, true], ["Température", inp.temperature, false],
  ] as const) if (!Number.isFinite(value) || (positive ? value <= 0 : value < 0)) error(`${name} : valeur finie ${positive ? "strictement positive" : "positive ou nulle"} requise.`);
  if (chlorine && (!Number.isFinite(inp.maxResidual) || inp.maxResidual < inp.target)) error("La limite opérationnelle de chlore doit être au moins égale à l'objectif.");
  if (!chlorine && (!Number.isFinite(inp.phMin) || !Number.isFinite(inp.phMax) || inp.phMin < 0 || inp.phMax > 14 || inp.phMin > inp.phMax)) error("Plage de pH opérationnelle invalide (0 à 14).");
  if (inp.breakpoint !== null && (!Number.isFinite(inp.breakpoint) || inp.breakpoint < 0)) error("Dose repère du breakpoint invalide.");
  if (inp.points.length < 3) error("Au moins trois mesures sont nécessaires pour comparer les doses.");
  let stock = NaN, beaker = NaN;
  try {
    stock = toBase(inp.stockConcentration.v ?? NaN, CONC, inp.stockConcentration.u);
    beaker = toBase(inp.beakerVolume.v ?? NaN, VOL, inp.beakerVolume.u);
  } catch { error("Unité de solution mère ou de volume inconnue."); }
  if (!Number.isFinite(stock) || stock <= 0 || !Number.isFinite(beaker) || beaker <= 0) error("Concentration de solution mère et volume du bécher strictement positifs requis.");
  const doses = new Set<number>();
  inp.points.forEach((p, i) => {
    if (![p.dose, p.response, p.ph].every(Number.isFinite) || p.dose < 0 || p.response < 0 || p.ph < 0 || p.ph > 14) error(`Essai ${i + 1} : dose, mesure ou pH invalide.`);
    if (doses.has(p.dose)) error(`Dose ${fmt(p.dose)} mg/L répétée : regrouper les réplicats après contrôle analytique.`);
    doses.add(p.dose);
    if (chlorine && (p.total === undefined || !Number.isFinite(p.total) || p.total < p.response || p.total > p.dose)) error(`Essai ${i + 1} : exiger 0 ≤ chlore libre ≤ chlore total ≤ dose, sans chlore initial.`);
    if (p.dose >= stock) error(`Essai ${i + 1} : solution mère insuffisamment concentrée.`);
  });
  if (s.checks.some((c) => c.level === "error")) return s;
  s.inputs.push(...inp.metadata, { label: "Origine des données", value: inp.demonstration ? "Exemple fictif — non utilisable pour le réglage" : "Mesures saisies par l'opérateur" },
    { label: "Turbidité brute", value: `${fmt(inp.rawTurbidity)} NTU` }, { label: "Température", value: `${fmt(inp.temperature)} °C` },
    { label: chlorine ? "Contact effectif de l'essai" : "Décantation", value: `${fmt(inp.contactMinutes)} min` },
    { label: "Objectif opérationnel", value: `${fmt(inp.target)} ${chlorine ? "mg/L de chlore libre" : "NTU après décantation"}` },
    { label: "Critère complémentaire", value: chlorine ? `Chlore libre ≤ ${fmt(inp.maxResidual)} mg/L ; pH < 8` : `pH ${fmt(inp.phMin)} à ${fmt(inp.phMax)}` });
  if (chlorine) s.inputs.push({ label: "Breakpoint repéré par l'opérateur", value: inp.breakpoint === null ? "Non renseigné — aucune détection automatique" : `${fmt(inp.breakpoint)} mg/L` });
  s.conversions.push({ label: "Solution mère (même base que la dose)", value: `${show(inp.stockConcentration)} → ${fmt(stock)} mg/L` }, { label: "Bécher", value: `${show(inp.beakerVolume)} → ${fmt(beaker)} L` });
  s.series = [...inp.points].sort((a, b) => a.dose - b.dose).map((p) => ({ ...p, removal: inp.rawTurbidity > 0 ? 100 * (inp.rawTurbidity - p.response) / inp.rawTurbidity : 0,
    injectionMl: p.dose * beaker / stock * 1000,
    ...(chlorine && p.total !== undefined ? { combined: p.total - p.response, demand: p.dose - p.total } : {}) }));
  s.series.forEach((p) => {
    s.inputs.push({ label: `Dose ${fmt(p.dose)} mg/L`, value: chlorine ? `Libre ${fmt(p.response)} ; total ${fmt(p.total ?? 0)} mg/L ; pH ${fmt(p.ph)}` : `Turbidité ${fmt(p.response)} NTU ; pH ${fmt(p.ph)}` });
    s.results.push({ label: `Dose ${fmt(p.dose)} mg/L — ajout au bécher`, value: `${fmt(p.injectionMl)} mL` },
      { label: `Dose ${fmt(p.dose)} mg/L — ${chlorine ? "combiné / consommé apparent" : "abattement"}`, value: chlorine ? `${fmt(p.combined ?? 0)} / ${fmt(p.demand ?? 0)} mg/L` : `${fmt(p.removal)} %` });
    if (!chlorine && p.response > inp.rawTurbidity) s.checks.push({ level: "warn", msg: `À ${fmt(p.dose)} mg/L, turbidité supérieure à l'eau brute : abattement négatif, vérifier l'essai.` });
  });
  const eligible = s.series.filter((p) => chlorine
    ? p.response >= inp.target && p.response <= inp.maxResidual && p.ph < 8 && inp.contactMinutes >= 30 && (inp.breakpoint === null || p.dose >= inp.breakpoint)
    : p.response <= inp.target && p.ph >= inp.phMin && p.ph <= inp.phMax);
  const selected = eligible[0];
  if (selected) {
    s.selectedDose = selected.dose;
    s.main = { label: "Plus petite dose testée satisfaisant les critères saisis", value: `${fmt(selected.dose)} mg/L` };
    s.steps.push({ label: "Ajout pour la dose retenue", formula: "Vi (mL) = D (mg/L) × Ve (L) / Cm (mg/L) × 1 000", substitution: `${fmt(selected.dose)} × ${fmt(beaker)} / ${fmt(stock)} × 1 000`, result: `${fmt(selected.injectionMl)} mL` });
    if (chlorine) s.steps.push({ label: "CT indicatif de l'essai", formula: "CT = chlore libre final × temps effectif", substitution: `${fmt(selected.response)} × ${fmt(inp.contactMinutes)}`, result: `${fmt(selected.response * inp.contactMinutes)} mg·min/L` });
    else s.steps.push({ label: "Abattement de turbidité", formula: "η = (T0 − Tf) / T0 × 100", substitution: `(${fmt(inp.rawTurbidity)} − ${fmt(selected.response)}) / ${fmt(inp.rawTurbidity)} × 100`, result: `${fmt(selected.removal)} %` });
    s.interpretation.push("Dose candidate d'exploitation, non un optimum universel : confirmer par répétitions, essais affinés autour de cette dose et validation sur la station.");
  } else { s.main = { label: "Sélection", value: "Aucune dose testée admissible" }; s.checks.push({ level: "warn", msg: "Aucun essai ne satisfait tous les critères : ajuster le protocole et refaire les mesures, sans extrapoler." }); }
  if (inp.demonstration) s.checks.push({ level: "warn", msg: "Données fictives de démonstration : aucune décision de traitement ne doit reposer sur ces valeurs." });
  if (chlorine) {
    s.checks.push({ level: inp.target >= 0.5 && inp.contactMinutes >= 30 ? "info" : "warn", msg: "Repère OMS : chlore libre ≥ 0,5 mg/L après au moins 30 min, à pH < 8. Ce repère n'est pas une certification de désinfection." });
    s.checks.push({ level: inp.rawTurbidity < 1 ? "info" : "warn", msg: "Avant désinfection, viser une turbidité < 1 NTU ; la turbidité peut protéger les microorganismes." });
    s.steps.push({ label: "Bilans mesurés", formula: "Combiné = total − libre ; consommé apparent = dose − total", substitution: "Même instant de mesure et même base en Cl₂", result: "Voir les résultats par dose" });
    s.limits.push("Aucun breakpoint n'est automatiquement déduit. Une baisse du résiduel total puis une remontée du libre peut suggérer une zone de rupture : densifier les essais et vérifier ammonium, pH et méthode analytique.", "CT calculé à partir du résiduel final : indicatif, sans pourcentage d'inactivation. En station utiliser un temps effectif validé (T10), pas seulement V/Q ; valider organisme cible, température et hydraulique.", "Le chlore n'est pas efficace contre tous les agents (notamment Cryptosporidium). Contrôler E. coli, sous-produits de désinfection et résiduel dans le réseau.");
  } else {
    s.interpretation.push("Le sulfate d'aluminium est un coagulant, pas un désinfectant. L'abattement de turbidité ne mesure pas une élimination microbiologique.");
    s.limits.push("ASTM D2035 décrit l'essai coagulation–floculation en béchers ; aucun dosage optimal ni pH unique n'est imposé pour toutes les eaux.", "Objectif après décantation choisi par l'opérateur, distinct de la turbidité après filtration. Vérifier alcalinité, aluminium résiduel, flocs, boues et aptitude à la filtration.");
  }
  s.hypotheses.push(chlorine ? "Doses et résiduels exprimés en mg/L équivalent Cl₂ ; eau initialement sans chlore, même contact, température et méthode DPD pour tous les béchers." : "Dose et solution mère sur la même base : mg de sulfate commercial sec par litre, pas mg d'Al ni mg d'Al₂O₃. Même mélange, décantation et point de prélèvement pour tous les béchers.", "Volume ajouté négligeable devant le bécher ; sinon corriger le volume final. Une agitation en tr/min n'est pas un gradient G sans étalonnage de l'appareil.");
  s.limits.push("Références : OMS, Guidelines for drinking-water quality (2022), https://www.who.int/publications/i/item/9789240045064 ; ASTM D2035, https://www.astm.org/d2035-19.html. Appliquer également les exigences nationales en vigueur ; aucune conformité réglementaire locale n'est certifiée.");
  return s;
}
