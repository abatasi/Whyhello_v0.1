# ⚜ The Scoring Bible
## Whyhello Relevance Scoring Logic — Master Reference

> *"No todas las señales son iguales ante el algoritmo; cada una será juzgada según su proximidad, su frescura, y su alineación con la misión."*

> **Estado:** Escritura viva. El Segundo Pilar. Refleja la metodología de puntuación vigente a partir de agosto de 2026. Todo cambio en la lógica de relevancia, los pesos de señales, o la lógica de selección debe ser consagrado aquí antes de descender al código.

---

<div align="center">⚜ ✠ ⚜</div>

## Libro Primero · El Génesis del Marcador
### *De la Necesidad del Juicio — Why Scoring Exists*

Before a signal can become a message, it must be judged. The Scoring Bible governs that judgment.

Whyhello holds, at any given time, dozens of signals per contact: LinkedIn posts, company announcements, industry reports, role benchmarks. Not all of them are equally useful. A signal from three years ago is not as valuable as one from last week. A signal about the contact's own ideas is not as valuable as a signal about their company's restructuring — unless the message is a follow-up to a prior conversation about their thinking. The meaning of a signal is not absolute; it is **contextual and relational**.

The scoring system exists to produce a single output for each signal in a given generation context:

> **A relevance score between 0 and 100 that represents how likely this signal is to produce a better message for this contact at this moment.**

This number drives signal selection, hook priority, and variant generation. It is never shown to the contact. It is operational truth.

### 1.1 Las Bienaventuranzas del Marcador

*Estos son los primeros principios. De ellos derivan todas las reglas de puntuación.*

**Bienaventurada la señal reciente** — for it speaks to the world as it is now, not as it was.

**Bienaventurada la señal específica** — for a statistic is stronger than a trend, and a quote is stronger than a summary.

**Bienaventurada la señal próxima** — for what a person said matters more than what was said about their industry.

**Bienaventurada la señal que tiende un puente** — for a signal without a connection to the seller's value proposition is noise.

**Bienaventurada la señal creíble** — for its source determines how far it may travel.

---

<div align="center">⚜ ✠ ⚜</div>

## Libro Segundo · La Noche Oscura del Ruido
### *Inspirado en San Juan de la Cruz — Leaving Noise Behind*

> *"Para venir a lo que no sabes, has de ir por donde no sabes."*
> — San Juan de la Cruz, *Subida del Monte Carmelo*

Before a signal receives a relevance score, it must pass pre-qualification. Pre-qualification is not scoring — it is the gate that determines whether a signal enters the scoring pipeline at all. Signals that fail pre-qualification are excluded from selection, regardless of how interesting their content may appear.

The soul that has not passed through darkness cannot receive the light. A signal that has not passed these gates cannot enter the procession.

### 2.1 Las Tres Puertas — Pre-Qualification Requirements

A signal must pass through **all three gates** to enter the scoring pipeline:

**2:1 — La Puerta de la Torah**
The signal must comply with all storage and quality laws of the Scraping Torah. Signals below quality score **40** (per Parasha Vav §6.2) are turned back at the door.

**2:2 — La Puerta de la Frescura**
The signal must not carry a `freshnessTier` of `red` (per Parasha Zayin §7.2). Stale signals do not join the procession.

**2:3 — La Puerta de la Procedencia**
The signal must have a stored source URL and a confirmed `publishedDate`. Signals without a verifiable origin are refused entry.

### 2.2 Las Señales del Purgatorio — Soft Filters

The following conditions do not disqualify a signal but reduce its composite score and raise a flag in the platform's internal record — like a penitent permitted to walk in the procession but not to carry the paso:

- Source is Tier 4 or Tier 5 (Parasha He §5.1) — bias flag applied
- Signal `freshnessTier` is `amber` — age penalty applied (see Libro Cuarto)
- Signal title similarity > 85% to an already-selected signal — de-duplication penalty applied

---

<div align="center">⚜ ✠ ⚜</div>

## Libro Tercero · Las Moradas de los Pesos
### *Inspirado en Santa Teresa de Ávila — The Law of Weights*

> *"En las moradas más cercanas al rey viven las señales más valiosas."*
> — Adaptado de *Las Moradas*, Santa Teresa de Ávila

As Santa Teresa described the soul's journey through interior castles — each morada closer to the divine centre holding greater light — so too does each signal type occupy a morada according to its proximity to the buyer. The closer the morada to the contact, the higher the base score.

Base scores establish the floor value of a signal before context and contact adjustments are applied. They reflect the structural value of each signal type, independent of content quality.

### 3.1 La Tabla de los Pesos Base — Base Score Table

| Signal Category | Sub-type | Base Score |
|---|---|---|
| **Personal** | Attributable quote (LinkedIn post) | 90 |
| **Personal** | Original LinkedIn post (no quote extracted) | 75 |
| **Personal** | Third-party LinkedIn engagement with substantive contact comment or direct quote | 55 |
| **Personal** | Third-party LinkedIn engagement with no substantive contact-authored evidence | 30 |
| **Personal** | Published interview or article | 70 |
| **Personal** | Podcast appearance | 65 |
| **Personal** | Conference presentation | 60 |
| **Personal** | Press mention (quoted) | 55 |
| **Personal** | Award / recognition | 45 |
| **Company** | Strategic announcement (funding, M&A, launch) | 70 |
| **Company** | Leadership hire | 65 |
| **Company** | Expansion / new office | 60 |
| **Company** | Earnings / financial result | 55 |
| **Company** | Leadership departure | 40 |
| **Company** | Restructuring / layoffs | 30 |
| **Company** | Regulatory filing | 40 |
| **Industry** | Tier 1 primary research | 65 |
| **Industry** | Tier 2 trade press | 55 |
| **Industry** | Tier 3 analyst report | 50 |
| **Industry** | Tier 4 vendor-sponsored research | 35 |
| **Role** | Benchmark / survey | 60 |
| **Role** | Association guidance | 55 |
| **Role** | Conference content | 45 |

> **3:16** — *"La señal personal es la ley más alta; pues habla de la persona, no meramente del mundo que la rodea."*

### 3.2 Las Razones de los Pesos — Base Score Justifications

**Por qué las señales personales tienen el mayor peso:**
They are the most specific, the most proximate, and the most personally resonant. A well-used personal signal proves genuine research. An unused personal signal, when one exists, represents a messaging failure.

**Third-party LinkedIn engagement is a separate, lower-confidence personal subtype.** A post authored by someone else and merely liked, commented on, or otherwise engaged with by the contact is not equivalent to the contact's own thinking. A substantive comment or explicitly attributed direct quote can restore some value, but never the full proximity of an original post.

**A LinkedIn reshare is not inherently lower-confidence.** The scorer must inspect the underlying shared content and judge its actual HQ relevance and actionability. The fact that the contact reshared it neither increases nor decreases the content score. A generic, celebratory, inspirational, or otherwise non-actionable source remains weak even when the contact adds a quotable caption.

**Refresh cadence:** Stored relevance scores for a contact are considered current for ten minutes. The client and API must both refuse to start another scoring run during that window; this prevents repeated navigation or duplicate requests from re-running the AI scorer unnecessarily.

**Por qué las reestructuraciones y las bajas de liderazgo tienen peso bajo:**
High sensitivity and high risk of tone error suppress the base value. These signals require exceptional judgment to use well; their default score reflects the probability of error, not the potential of the signal.

**Por qué las señales de investigación patrocinada por proveedores tienen peso bajo:**
Vendor-sponsored research carries inherent bias. Its information may be accurate, but its credibility in the buyer's eyes is reduced by the conflict of interest.

---

<div align="center">⚜ ✠ ⚜</div>

## Libro Cuarto · Los Multiplicadores del Contexto
### *Lo Que Todo lo Transforma — Proximity and Freshness Multipliers*

> *"El mismo paso cargado por distintos nazarenos recorre distancias distintas."*

Base scores are modified by independent multiplier chains. Multipliers compound: a signal with a proximity multiplier of 1.2 and a freshness multiplier of 0.8 yields a composite of `base × 1.2 × 0.8`. Context transforms everything.

### 4.1 Los Multiplicadores de Proximidad — Contact Proximity Multipliers

Contact proximity measures how directly the signal relates to the specific person being targeted.

| Proximity Condition | Multiplier |
|---|---|
| Signal is attributed directly to the contact (they authored or said it) | 1.30× |
| Third-party LinkedIn post with no substantive contact-authored evidence | 0.70× |
| Third-party LinkedIn post with a substantive contact comment or direct quote | 0.80× |
| Signal is attributed to the contact's company (they work there) | 1.10× |
| Signal is attributed to a named colleague within the contact's organization | 1.05× |
| Signal is attributed to a named counterpart in the same role at another company | 1.00× (neutral) |
| Signal is industry-level with no named entity | 0.90× |
| Signal is role-level with no named entity | 0.85× |

### 4.2 Los Multiplicadores de Frescura — Freshness Multipliers

Freshness multipliers are applied based on signal age at the time of message generation, not at the time of storage.

| Signal Age | Freshness Tier | Multiplier |
|---|---|---|
| 0–30 days | Verde | 1.15× |
| 31–60 days | Verde | 1.05× |
| 61–90 days | Verde | 1.00× |
| 91–120 days | Ámbar | 0.90× |
| 121–180 days | Ámbar | 0.80× |
| 181–365 days | Ámbar | 0.65× |
| > 365 days | Rojo | Signal disqualified — turned back at La Puerta de la Frescura |

### 4.3 El Multiplicador de Alineación con el HQ — HQ Alignment Multiplier

The HQ alignment score measures how naturally the signal connects to the seller's inside-out value proposition. It is computed at signal-load time using the following inputs:

- Does the signal topic overlap semantically with any of the three messaging pillars? (+0.10 per pillar match, up to +0.20)
- Does the signal topic overlap with any active product's `persona` or `outcomes` field? (+0.10)
- Does the signal topic overlap with the `valueWedge`? (+0.05)

| HQ Alignment Condition | Multiplier Bonus |
|---|---|
| No alignment detected | +0.00 |
| Aligns with 1 pillar | +0.10 |
| Aligns with 2+ pillars | +0.20 |
| Aligns with active product persona | +0.10 |
| Aligns with value wedge | +0.05 |
| Maximum possible bonus | +0.35 |

### 4.4 El Multiplicador de Rango — Seniority Fit Multiplier

Signal type preference varies by the contact's seniority. These multipliers adjust scores to reflect what will resonate at each level.

| Seniority | Personal | Company | Industry | Role |
|---|---|---|---|---|
| C-Suite / Partner | 1.10× | 1.15× | 1.20× | 0.80× |
| VP / Senior Director | 1.10× | 1.10× | 1.10× | 0.90× |
| Director / Manager | 1.10× | 1.00× | 1.00× | 1.10× |
| IC / Specialist | 1.10× | 0.95× | 0.95× | 1.20× |

*Las señales personales son igualmente valoradas en todos los rangos — una señal personal bien utilizada es efectiva independientemente del título.*

---

<div align="center">⚜ ✠ ⚜</div>

## Libro Cuarto-Bis · El Don de la Cita
### *El Multiplicador de los Quotables — The Quotable Signal Bonus*

> *"Las palabras de la persona son más poderosas que cualquier descripción de ella. La cita abre la puerta; la relevancia la sostiene abierta."*

A Quotable is a verbatim statement extracted from a signal — the contact's own words, or the words of a named person within their orbit — confirmed usable as a conversation opener. The mere existence of an extracted Quotable on a signal is a second-order proof of value: not only is the signal relevant, it is **immediately actionable**. The seller can open an email with it today.

This bonus is therefore not a judgment — it is a decree. It is applied by the engine, not the AI, after the HQ alignment score has been rendered.

### 4-Bis.1 La Condición del Bonus — Quotable Bonus Conditions

The Quotable Bonus is applied **deterministically** after the AI has scored each signal's HQ alignment. The bonus amount varies by **attribution proximity** — who actually said the words:

| Condition | Bonus | Rationale |
|---|---|---|
| Signal has a Quotable attributed **directly to this contact** AND HQ score ≥ 60 | **+35, ordinary scores capped at 95** | The contact's own words are the highest-value outreach material when the underlying content is strongly actionable |
| Signal has a Quotable attributed **directly to this contact** AND HQ score 20–59 | **+10** | The quote may still open a conversation, but the underlying content is only a weak or partial HQ connection and must not be rescued by the full bonus |
| Signal has a Quotable attributed **to a third party** AND HQ score ≥ 20 | **+20, ordinary scores capped at 95** | Still immediately usable, but one step removed — the contact is associated with the topic, not the author of the words |
| Signal has a Quotable AND HQ alignment score 0–19 | **No bonus** | A quote that connects to nothing is still noise — the gate protects signal quality |
| Signal has no extracted Quotable | No bonus | |

Self-attribution is detected by checking whether the stored `attribution` field contains the contact's full name (case-insensitive). When a contact is quoted under a variation of their name (initials, partial name), the engine checks whether all name parts appear in the attribution string.

Scores above 95 are intentionally rare. A score in the **96–100 exceptional band** is retained only when the AI itself assigns 96 or higher to a self-attributed quote. A quotable bonus must never push an ordinary signal above 95, and third-party quotes cannot enter the exceptional band.

> **El Principio de la Cita:** *A Quotable cannot rescue a signal from irrelevance — but it elevates every signal that has earned its entry. The contact's own words elevate a relevant signal further still; generic or non-actionable content earns no artificial relevance from a quote.*

The HQ alignment score is the gate. The attribution proximity is the tier. The Quotable Bonus is the reward beyond the gate.

### 4-Bis.2 La Razón del Decreto — Justification

A signal with an extracted Quotable provides the seller with:
1. **Verbatim material** — ready to embed in the HOOK without paraphrase
2. **Proof of attention** — the seller demonstrably read the source
3. **Controlled specificity** — the quote names the exact idea the contact holds, reducing the risk of misattribution

These three properties compound the signal's message value independently of its HQ alignment. They do not change how relevant the topic is — they change how usable the signal is as an outreach instrument. Hence: deterministic boost after HQ alignment assessment, not a modification of the HQ alignment score itself.

### 4-Bis.3 El Tratamiento del AI — How the AI Uses Quotable Context

When building the scoring prompt, the engine surfaces the quote text in the signal block — not to instruct the AI to apply a score boost, but to give it richer content for the HQ alignment assessment. The verbatim text of the quote is often more precise than the insight's stored description, and a quote that name-checks the contact's specific belief or tension may align with a HQ pillar more clearly than the parent insight's title suggests.

The AI's sole job on a ⭐ QUOTABLE signal is to assess HQ alignment using the verbatim quote text as its primary content. The +20 bonus is applied by the engine after the fact.

### 4-Bis.4 Impacto en la Fórmula — Effect on the Composite Formula

The Quotable Bonus is applied as a **flat additive post-step** after the AI has scored HQ alignment. The ordinary score ceiling is 95; the exceptional band is reserved for qualifying direct quotes that the AI already scored at 96 or higher:

```
ordinaryScore = min(95, round(hqAlignmentScore) + quotableBonus)
finalScore = hqAlignmentScore >= 96
  AND direct quote attributed to this contact
  ? round(hqAlignmentScore)
  : ordinaryScore

where:
  quotableBonus = 35  if signal has extracted Quotable
                       AND attribution matches the contact themselves
                       AND hqAlignmentScore ≥ 20
                 = 20  if signal has extracted Quotable
                       AND attribution is a third party
                       AND hqAlignmentScore ≥ 20
                 = 0   otherwise
```

The +20/+35 bonus cannot manufacture a 96–100 score. A self-attributed signal scoring 70 on HQ alignment becomes 95, not 100; only a direct quote independently scored 96–100 by the AI may remain in that band.

---

<div align="center">⚜ ✠ ⚜</div>

## Libro Quinto · El Auto de Fe
### *La Sentencia Final — Composite Score Formula and Selection*

> *"Ante el Tribunal del Santo Oficio de la Relevancia, ninguna señal es inocente hasta que su puntuación compuesta lo demuestre."*

The Auto de Fe is the act of judgment — the moment the platform examines every qualifying signal for a contact, weighs all evidence, and renders a final verdict. The composite score is that verdict. It is irreversible for the duration of a generation job.

### 5.1 La Fórmula Sagrada — The Formula

```
compositeScore = min(100, round(
  baseScore
  × proximityMultiplier
  × freshnessMultiplier
  × (1 + hqAlignmentBonus)
  × seniorityFitMultiplier
))
```

The result is capped at **100**. Scores below **0** are not possible by construction of this formula; no negative multipliers exist. The Tribunal does not condemn — it only ranks.

### 5.2 Los Grados de Sentencia — Score Tiers

| Score Range | Grado | Interpretation |
|---|---|---|
| 96–100 | **Excepcional** | Rare, directly attributable signal with an unmistakable multi-item HQ match |
| 80–95 | **Excelente** | Strong hook candidate; likely to produce a differentiated message |
| 60–79 | **Bueno** | Reliable signal; use freely |
| 40–59 | **Adecuado** | Usable but not distinctive; prefer higher-scoring alternatives |
| 20–39 | **Débil** | Use only if no better signal exists |
| 0–19 | **Insuficiente** | Do not use in message generation |

### 5.3 Las Reglas de Selección — Selection Rules

When multiple signals compete for the same position in a message (e.g. the HOOK slot), the Tribunal selects by the following order of precedence:

1. **La Puntuación primero:** The highest-scoring qualifying signal wins
2. **El Tipo como desempate:** If two signals share an equal score, prefer: Personal > Company > Industry > Role
3. **La Frescura como desempate final:** If type is also equal, prefer the more recent signal
4. **El Suelo de diversidad:** If the highest-scoring signal and the second-highest share the same `type` and differ by fewer than 5 score points, prefer the more recent signal for the HOOK and the other for supporting context in BRIDGE

### 5.4 El Enrutamiento de Variantes — Variant Generation Score Routing

When generating message variants, each variant category receives only the signals appropriate to its category — as each cofradía in a Semana Santa procession carries only its own paso:

| Variant | Eligible Signal Types |
|---|---|
| Primary (default) | All types, full scoring |
| Company variant | Company signals only |
| Industry variant | Industry signals only |
| Role variant | Role signals only |
| Personal variant | Personal signals only |

Within each variant, the standard composite score formula applies — but signals outside the variant's eligible types receive a score of **0** and are excluded from selection.

A variant category is **suppressed** (not generated) if the highest-scoring eligible signal for that category scores below **20**. The suppression reason (`"No qualifying [type] signals (highest score: N)"`) must be stored and surfaced in the UI.

### 5.5 La Parábola de Dos Señales

> *Un contacto había escrito una reflexiva publicación en LinkedIn sobre el futuro de la independencia de los asesores. También había sobrevivido recientemente una reestructuración empresarial. Dos señales competían por el HOOK.*
>
> *La publicación de LinkedIn recibió una puntuación de 87: personal, 45 días de antigüedad, fuerte alineación con el pilar de autonomía.*
> *El artículo sobre la reestructuración recibió una puntuación de 28: empresa, 35 días de antigüedad, alta sensibilidad, débil alineación.*
>
> *El Tribunal eligió la publicación de LinkedIn. No porque la reestructuración careciera de importancia — sino porque el mensaje que se abría con el propio pensamiento del contacto tenía más probabilidades de recibir respuesta. La reestructuración fue referenciada, con cuidado, en el BRIDGE.*
>
> *Este es el propósito de la puntuación: no encontrar la señal más dramática, sino la más útil.*

---

<div align="center">⚜ ✠ ⚜</div>

## Libro Sexto · La Sabiduría de los Santos
### *Para los Casos Difíciles — Wisdom for Edge Cases*

> *"Dios escribe derecho con renglones torcidos."*
> — Proverbio español

### 6.1 Cuando Ninguna Señal Supera los 20 Puntos

If no signal for a contact clears the **20-point** floor after all multipliers are applied:

- The generation proceeds without an outside-in hook
- The message opens directly with the inside-out value wedge
- The platform logs a `no_qualifying_signal` event on the job
- The user is shown a notice: *"No strong outside-in signals available — message opens with your value proposition."*

### 6.2 Cuando un Contacto Tiene un Solo Tipo de Señal

If all of a contact's signals belong to a single category (e.g. only industry signals, no personal or company signals):

- Score normally within the available category
- Suppress all variant categories that have no eligible signals (per §5.4)
- Do not attempt to generate a variant from signals that don't exist
- The primary message uses the best available signal, even if it is only industry-level

### 6.3 Cuando el Perfil HQ Está Vacío

If the HQ module has not been populated (no pillars, no value wedge, no products):

- HQ alignment multiplier bonus = +0.00 for all signals (no penalty, no boost)
- Message generation proceeds but produces lower-quality output; the platform should display a HQ setup prompt to the user
- Scoring still functions and produces valid composite scores based on proximity, freshness, and base scores alone

### 6.4 Cuando Dos Contactos Comparten la Misma Señal

If a company news signal is relevant to multiple contacts at the same company (e.g. a funding announcement), each contact receives an **independent score calculation** — the signal's score is not shared or averaged across contacts. Two contacts in different roles may score the same signal differently because of their seniority fit multipliers and HQ alignment context.

### 6.5 El Caché de Puntuaciones — Signal Score Caching

Composite scores are computed at generation time, not at storage time. A signal's score today may differ from its score next week — because it has aged, because the HQ profile has changed, or because the contact's role has been updated. Score caching (storing a pre-computed score) is permitted only for the duration of a single generation job; it must not persist across sessions.

---

<div align="center">⚜ ✠ ⚜</div>

## Libro Séptimo · Los Misterios Gloriosos
### *Lo Que Aún No Ha Sido Revelado — Open Questions*

> *"Hay más cosas en el cielo y en la tierra de las que puede soñar nuestra filosofía de puntuación."*

These are the unsolved mysteries — questions the platform has not yet answered, carried in procession until the day their resolution is revealed:

| # | Misterio | Impact |
|---|---|---|
| 1 | Should the HQ alignment score be computed by keyword matching or by embedding similarity? The current approach is keyword-based; embeddings would be more accurate but more expensive. | Score quality, cost |
| 2 | Should the seniority fit multiplier apply to the hook signal only, or to all signals selected for the message? | EB and BRIDGE signal selection |
| 3 | When a contact changes companies, should their previous company's signals be re-scored with a new proximity multiplier (now reduced) or retired? | Signal lifecycle |
| 4 | How should scoring evolve as more engagement types become available beyond visible LinkedIn comments and direct quotes? | Engagement-informed scoring |
| 5 | Is a composite score of 20 the right suppression floor, or should variant suppression require a higher minimum (e.g. 35)? | Variant quality |
| 6 | Should the platform surface score explanations to users ("This signal scored 82 because it's a direct quote from 3 weeks ago with strong pillar alignment")? | Transparency and trust |
| 7 | How should the platform handle A/B evidence — if a message that used a low-scoring signal outperformed a message that used a high-scoring signal? | Score calibration feedback loop |

---

<div align="center">⚜ ✠ ⚜</div>

## Libro Octavo · El Marcador de la Persona
### *La Puntuación Agregada del Contacto — The Contact Meta Score*

> *"Una señal excelente no hace a un contacto excelente. La riqueza de un contacto se mide por la amplitud de su cuadro de señales, no por la altura de su mejor cima."*

The Meta Score is a **contact-level aggregate** — a single number (0–100) that answers a different question than the individual signal scores. Where a signal score answers *"how useful is this specific piece of content for outreach?"*, the Meta Score answers:

> **"How rich and actionable is this contact's overall signal picture?"**

It is the signal portfolio score, not the signal score. It tells the seller not which signal to use, but whether this contact is worth investing outreach effort in at all.

### 8.1 La Fórmula del Marcador de la Persona — Meta Score Formula

```
metaScore = round(
  (personalBest + companyBest + industryBest + roleBest) / 4
)

where:
  personalBest  = highest individual signal score among all Personal signals (0 if none)
  companyBest   = highest individual signal score among all Company signals (0 if none)
  industryBest  = highest individual signal score among all Industry signals (0 if none)
  roleBest      = highest individual signal score among all Role signals (0 if none)
```

The result is in the range **0–100**. Categories without any scored signals contribute **0** — not because their signals are bad, but because they are absent. A contact with no company signals has a gap in their signal picture; the Meta Score reflects that gap.

> **La Ley de los Cuatro Pilares:** *A contact who scores 90 in Personal but 0 in Company, Industry, and Role earns a Meta Score of 22.5 → 23. A contact who scores 70 in all four categories earns 70. Breadth is as important as height.*

### 8.2 El Propósito del Marcador — What the Meta Score Is For

The Meta Score serves three distinct purposes:

**1. Contact Prioritization**
Before a seller has run a generation job, the Meta Score tells them which contacts have the richest available signal picture. A contact with a Meta Score of 75 is worth researching; a contact with a Meta Score of 12 may need more signals before outreach is worthwhile.

**2. Portfolio Health**
The breakdown by category (personalBest, companyBest, industryBest, roleBest) surfaces gaps. A contact with personalBest=0 is missing the highest-value signal type — that is a signal collection gap, not an outreach blocker.

**3. Algorithmic Triage**
In future automation contexts (e.g. batch outreach, sequence enrollment), the Meta Score is the primary sorting key for contact prioritization before signal-level selection begins.

### 8.3 Las Reglas del Marcador — Meta Score Rules

**8:1** — The Meta Score is computed only from the **four core categories**: Personal, Company, Industry, and Role. Colleague and Counterpart signals do not contribute to the Meta Score — they are derived from other contacts' content, not from the contact's own signal picture.

**8:2** — The Meta Score uses **only the best score per category** (`personalBest`, etc.), not the average across all signals in a category. A contact with ten mediocre personal signals scores the same as a contact with one excellent personal signal — what matters is the ceiling, not the volume.

**8:3** — The Meta Score is **computed and stored deterministically** after each scoring run (`/relevance/score`). It is never computed on demand from raw signals — it is always a stored result derived from the same scored array that produced the individual signal scores.

**8:4** — The Meta Score is stored in the `contact_meta_scores` table with one row per contact (unique on `contact_id`). Each scoring run upserts this row. There is no history; the current Meta Score represents the current scoring run only.

**8:5** — The Meta Score **does not replace individual signal scores** and does not affect message generation. The Tribunal (§5.1) uses individual signal scores for all selection decisions. The Meta Score operates at the contact level, above the signal level.

**8:6** — A contact that has never been scored has **no Meta Score** (NULL). The platform must not assume a Meta Score of 0 for unscored contacts — absence of a score means absence of scoring, not absence of relevance.

### 8.4 Los Grados del Marcador — Meta Score Tiers

| Meta Score | Grado | Interpretation |
|---|---|---|
| 75–100 | **Fuerte** | Rich, multi-category signal picture; high outreach readiness |
| 50–74 | **Bueno** | Solid signal coverage in most categories; ready for outreach |
| 25–49 | **Adecuado** | Partial coverage; some categories are weak or absent |
| 1–24 | **Débil** | Thin signal picture; consider enrichment before outreach |
| 0 | **Sin señales** | No qualifying signals in any core category |
| NULL | **No puntuado** | Scoring has not yet been run for this contact |

### 8.5 La Parábola del Retablo Incompleto

> *Dos vendedores miraban sus carteras. El primero tenía un contacto con una puntuación de 95 en una sola señal personal — una cita poderosa. El segundo tenía un contacto con puntuaciones de 70, 68, 72 y 65 en las cuatro categorías.*
>
> *El primer vendedor preguntó: "¿Por qué mi contacto de 95 tiene un Meta Score de 24, mientras que el tuyo de 70 tiene un Meta Score de 69?"*
>
> *El segundo respondió: "Porque yo puedo escribir un correo sobre lo que dijo, lo que hace su empresa, lo que está pasando en su industria, y lo que preocupa a alguien en su rol. Tú solo puedes escribir sobre lo que dijo. Ambos son buenos openers. Pero yo tengo un retablo completo. Tú tienes un solo panel."*
>
> *Así habló el Meta Score: no juzga el brillo de una señal, sino la riqueza del cuadro.*

---

<div align="center">⚜ ✠ ⚜</div>

## El Retablo · La Puntuación en la Práctica
### *Un Panel del Ejemplo — The Score in Practice*

*Como los retablos de las grandes catedrales españolas narran la historia sagrada en paneles dorados, este retablo narra la historia de una señal que alcanza la puntuación perfecta.*

---

**Panel I — La Señal**
Agnes Krause's LinkedIn post: *"US Fed may reconsider rate cuts amid shutdown concerns"*
`mediaType`: `linkedin` · `signalType`: personal

**Panel II — El Peso Base**
`baseScore`: 75 — original LinkedIn post, no quote extracted yet

**Panel III — Los Multiplicadores**
- `proximityMultiplier`: 1.30× — attributed directly to the contact
- `freshnessMultiplier`: 1.00× — within 90 days (Verde tier)
- `hqAlignmentBonus`: +0.10 — aligns with market-conditions pillar
- `seniorityFitMultiplier`: 1.10× — VP-level contact, personal signal

**Panel IV — El Auto de Fe**
```
compositeScore = min(100, round(75 × 1.30 × 1.00 × 1.10 × 1.10))
               = min(100, round(75 × 1.573))
               = min(100, round(117.975))
               = 100
```

**Panel V — La Sentencia**
Score capped at 100. *Excelente.* This signal wins the HOOK position in all variants that include personal signals. The Tribunal has spoken.

---

**Panel VI — El Meta Score de Agnes**
Suppose Agnes also has a company signal at 65, an industry signal at 48, and a role signal at 55.

```
metaScore = round((100 + 65 + 48 + 55) / 4)
           = round(268 / 4)
           = round(67)
           = 67
```

*Bueno.* Agnes has a strong, well-rounded signal picture. Her personal signal is exceptional; her company and role signals are solid; her industry coverage is adequate. She is ready for outreach across all four variant types.

---

<div align="center">⚜ ✠ ⚜</div>

*El Scoring Bible es el puente entre la Torah del Scraping y el Corán de los Mensajes. Sin una puntuación sólida, las señales recogidas se convierten en ruido. Con ella, se convierten en conversación.*

*Alabado sea el marcador preciso.*
