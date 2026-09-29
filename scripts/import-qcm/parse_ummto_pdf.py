#!/usr/bin/env python3
"""
Convert the "QCM UMMTO classés par cours" PDFs (1re année médecine) into the
JSON files read by src/content/imported/.

    pip install pypdf
    python3 scripts/import-qcm/parse_ummto_pdf.py <folder-with-pdfs>
    npm run db:seed:generate

Each PDF is a Word export: a table of contents, then per course a
"QCM with CT" part (questions followed by the corrigé-type key) and a
"QCM without CT" part (older questions, no key). Questions are kept as-is;
anything that cannot be published safely becomes a draft with the reasons in
`issues` (no key, needs an image, ambiguous key, malformed options…).

To add a module, add an entry to SOURCES with the page where each course starts.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

from pypdf import PdfReader

OUT_DIR = Path(__file__).resolve().parents[2] / "src/content/imported/ummto-2023-24"


@dataclass
class Source:
    key: str
    glob: str
    module: str                      # "<major>/<year>/<module code>" as in src/content/curriculum.ts
    title: str
    courses: list[tuple[int, str, str]]  # (first page, course slug, title as printed)


SOURCES = [
    Source("embryologie", "*Embry*.pdf", "medicine/1/embryologie", "Embryologie — QCM UMMTO classés par cours 2023-2024", [
        (2, "gametogenese", "Gamétogenèse"),
        (8, "spermatogenese", "Spermatogenèse"),
        (18, "ovogenese", "Ovogenèse"),
        (28, "fecondation", "Fécondation"),
        (37, "premiere-semaine", "1ère semaine du développement"),
        (45, "deuxieme-semaine", "2ème semaine du développement"),
        (52, "troisieme-semaine", "3ème semaine du développement"),
        (61, "quatrieme-semaine", "4ème semaine du développement"),
        (70, "annexes-embryonnaires", "Les annexes embryonnaires et les grossesses gémellaires"),
    ]),
    Source("anatomie-s2", "*Anatomie_S2*.pdf", "medicine/1/anatomie", "Anatomie du membre inférieur — QCM UMMTO classés par cours 2023-2024", [
        (3, "mi-osteologie", "L'Ostéologie"),
        (10, "mi-arthrologie", "L'Arthrologie"),
        (17, "mi-myologie", "La Myologie"),
        (27, "mi-vascularisation", "La Vascularisation"),
        (34, "mi-innervation", "L'Innervation"),
        (46, "mi-regions-topographiques", "Les Régions Topographiques et Les Schémas"),
    ]),
    Source("histologie", "*Histologie*.pdf", "medicine/1/histologie", "Histologie fondamentale — QCM UMMTO classés par cours 2023-2024", [
        (3, "epithelium-revetement", "L'épithélium de revêtement"),
        (13, "epithelium-glandulaire", "L'épithélium glandulaire"),
        (22, "tissu-conjonctif", "Le tissu conjonctif"),
        (30, "varietes-tissu-conjonctif", "Les variétés de tissu conjonctif"),
        (35, "tissu-cartilagineux", "Le tissu cartilagineux"),
        (43, "tissu-osseux", "Le tissu osseux"),
        (51, "ossification", "L'ossification"),
        (55, "tissu-sanguin", "Le tissu sanguin"),
        (61, "hematopoiese", "L'hématopoïèse"),
        (66, "tissu-nerveux", "Le tissu nerveux"),
        (73, "nevroglie", "La névroglie"),
        (79, "tissu-musculaire", "Le tissu musculaire"),
        (90, "histologie-schemas", "Les Schémas"),
    ]),
    Source("physiologie", "*Physiologie*.pdf", "medicine/1/physiologie", "Physiologie fondamentale — QCM UMMTO classés par cours 2023-2024", [
        (3, "transport-membranaire", "Transport membranaire"),
        (12, "communication-cellulaire", "Communication Cellulaire"),
        (26, "milieu-interieur", "Physiologie du milieu intérieur"),
        (30, "transmission-synaptique", "La Transmission Synaptique"),
        (34, "jonction-neuromusculaire", "La Jonction Neuromusculaire"),
        (37, "potentiel-de-repos", "Potentiel de Repos"),
        (41, "potentiel-d-action", "Potentiel d'Action"),
        (47, "systeme-nerveux-autonome", "Système Nerveux Autonome"),
    ]),
]

# --- line patterns -----------------------------------------------------------
NUM_RE = re.compile(r"^(\d{1,3})\s*[-–.)]\s*(.*)$")
NUM_NO_DASH_RE = re.compile(r"^(\d{1,3})\s+([A-Za-zÀ-ÿ].*)$")
OPT_RE = re.compile(r"^([A-Ea-e])\s*[-.)]\s*(.*)$")
KEY_BODY_RE = re.compile(r"^[A-Ea-e](?:\s*[,/ ]?\s*[A-Ea-e]){0,4}\s*$")
PAGE_NO_RE = re.compile(r"^(?:Page \| )?\d{1,3}$")
# "EMD n°2 2023", "Rattrapage 2022", "Les Autres : 2022 - 2008", "20 Innervation EMD n°2 2023"
LABEL_RE = re.compile(r"^(?:\d{1,3}\s+)?(?:[A-Za-zÀ-ÿ'’]+\s+)?((?:EMD|Rattrapage|Synth[eè]se|Examen|EXAMEN|Partiel|Les Autres)\b.*)$")
# "Dans le schéma suivant : les questions de 08 jusqu'à 14"
CONTEXT_RE = re.compile(r"^(?:dans|d['’]apr[eè]s|soit|voir|observez|sur|le|la|les)\b.*(?:sch[ée]ma|figure|l[ée]gende|image|coupe)|sch[ée]ma suivant|figure suivante|ci-dessous", re.I)
RANGE_RE = re.compile(r"(?:question|questions)\s*(?:de\s*)?(\d{1,3})\s*(?:jusqu[’']?\s*(?:à|a)|à|a|-)\s*(\d{1,3})", re.I)
IMAGE_RE = re.compile(r"sch[ée]ma|l[ée]gende|figure|image|coupe|photo|micrographie|ci-dessous|ci-contre|flèche|graphe|courbe", re.I)
REFERS_RE = re.compile(
    r"^(?:cet|cette|ces|ce)\s"
    # "LA CLASSIFICATION DE CET EPITHELIUM", "LE MODE DE SECRETION DE CETTE GLANDE" → a picture
    r"|\b(?:cet|cette|ce)\s+(?:[ée]pith[ée]lium|glande|tissu|cellule|coupe|organe|structure|pr[ée]paration|type)\b"
    r"|relative (?:à|a) la question|question pr[ée]c[ée]dente"
    # "le numéro 1 comporte", "L'élément B :", "La cellule 3 :" → labels on a diagram
    r"|\bnum[ée]ro\s*\d|\bn°\s*\d"
    r"|\b(?:[ée]l[ée]ment|structure|cellule|zone|chiffre|rep[èe]re)\s+[A-Z0-9]{1,2}\s*[:,.)]?\s*$",
    re.I,
)
TYPE_MARK_RE = re.compile(r"\s*\((?:QCM|QCS)\)\s*", re.I)
NOISE = {"les questions", "ct", "to make it easy :", "qcm", "qcs"}


def fold(s: str) -> str:
    """Lower-case, accent-free, apostrophe-free version for comparisons."""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def short_title(title: str) -> str:
    return fold(re.sub(r"^(?:l['’]|la |le |les )", "", title, flags=re.I))


def clean_label(text: str) -> str:
    """'EMD n°2 2023 + CT' → 'EMD 2 2023'; 'EXAMEN DE TD QCS : de la question 15…' → 'Examen de TD'."""
    text = re.sub(r"\s*\+?\s*CT\s*$", "", text)
    text = re.sub(r"\s*\bQCS\b.*$", "", text)
    text = re.sub(r"n°\s*", "", text).strip(" :")
    return re.sub(r"^EXAMEN DE TD", "Examen de TD", text)


@dataclass
class Question:
    course: str
    section: str          # "ct" or "sans-ct"
    label: str | None     # e.g. "EMD n°2 2023"
    n: int
    page: int
    stem: str
    single_hint: bool
    needs_image: bool = False
    options: list[dict] = field(default_factory=list)
    raw_key: str | None = None


@dataclass
class Block:
    section: str
    questions: list[Question] = field(default_factory=list)
    keys: dict[int, str] = field(default_factory=dict)


def parse_source(src: Source, pdf: Path) -> list[Question]:
    pages = [(i + 1, p.extract_text() or "") for i, p in enumerate(PdfReader(pdf).pages)]
    titles = {short_title(t) for _, _, t in src.courses} | {fold(t) for _, _, t in src.courses}
    blocks: list[Block] = []
    block: Block | None = None
    last_q: Question | None = None
    section, label, label_range, single_mode = "ct", None, None, False
    image_range: tuple[int, int] | None = None
    single_range: tuple[int, int] | None = None
    course_idx = -1

    def start_block(sec: str) -> Block:
        b = Block(sec)
        blocks.append(b)
        return b

    for page_no, text in pages:
        idx = max((i for i, (start, _, _) in enumerate(src.courses) if page_no >= start), default=-1)
        if idx < 0:
            continue
        if idx != course_idx:  # new course: reset state
            course_idx, block, last_q = idx, None, None
            section, label, label_range, single_mode, image_range, single_range = "ct", None, None, False, None, None
        course = src.courses[idx][1]

        for raw in text.splitlines():
            line = re.sub(r"\s+", " ", raw).strip()
            if not line or PAGE_NO_RE.match(line):
                continue
            folded = fold(line)
            if folded in NOISE or folded in titles or short_title(line) in titles:
                continue
            if re.match(r"^\d{1,3} ", line) and short_title(line.split(" ", 1)[1]) in titles:
                continue
            if re.search(r"[؀-ۿ]", line):  # Arabic dedication lines
                continue

            # Section headers
            if "without ct" in folded or folded.startswith("qcs sans ct") or folded == "sans ct":
                section, single_mode = "sans-ct", folded.startswith("qcs")
                block, last_q = start_block(section), None
                continue
            if "with ct" in folded:
                section, single_mode = "ct", False
                block, last_q = start_block(section), None
                continue
            m = LABEL_RE.match(line)
            if (m and len(line) < 90 and not OPT_RE.match(line) and not NUM_RE.match(line)
                    and re.search(r"(19|20)\d\d|\bct\b|question|\btd\b", folded)):
                label = clean_label(m.group(1))
                r = RANGE_RE.search(line)
                label_range = (int(r.group(1)), int(r.group(2))) if r else None
                if r and "qcs" in folded:
                    single_range = label_range
                continue
            # "Dans le schéma suivant : les questions de 08 jusqu'à 14"
            if CONTEXT_RE.search(line) and not NUM_RE.match(line) and not OPT_RE.match(line) and len(line) < 140:
                r = RANGE_RE.search(line)
                nxt = (last_q.n + 1) if last_q else 1
                image_range = (int(r.group(1)), int(r.group(2))) if r else (nxt, nxt)
                continue

            if block is None:
                block = start_block(section)

            m = NUM_RE.match(line)
            if not m and last_q and block.questions and not block.keys:
                m2 = NUM_NO_DASH_RE.match(line)
                if m2 and int(m2.group(1)) == last_q.n + 1:
                    m = m2
            if m:
                n, rest = int(m.group(1)), m.group(2).strip()
                in_keys = bool(block.keys)
                last_key = max(block.keys) if in_keys else 0
                starts_keys = not in_keys and n == 1 and block.questions and (KEY_BODY_RE.match(rest) or not rest)
                if (in_keys and n == last_key + 1) or starts_keys:
                    block.keys[n] = rest
                    last_q = None
                    continue
                if in_keys and n != 1 and KEY_BODY_RE.match(rest):
                    # Numbering typo in the key list ("31-B, 22-ABCE, 33-B"): keep the sequence.
                    block.keys[last_key + 1] = rest
                    continue
                if in_keys and not KEY_BODY_RE.match(block.keys[last_key] or "x") and re.match(r"^\d{1,3}\.\S", line):
                    # "1.Œuf fécondé…": the written answer of a diagram question, not a new question.
                    block.keys[last_key] += " " + line
                    continue
                if in_keys or (last_q and n <= last_q.n and n == 1):
                    block = start_block(section)
                hint = single_mode or bool(single_range and single_range[0] <= n <= single_range[1])
                in_label = label_range is None or label_range[0] <= n <= label_range[1]
                q = Question(course, section, label if in_label else None, n, page_no, rest, hint)
                q.needs_image = bool(image_range and image_range[0] <= n <= image_range[1])
                block.questions.append(q)
                last_q = q
                continue

            m = OPT_RE.match(line)
            if m and last_q is not None and not block.keys:
                last_q.options.append({"label": m.group(1).upper(), "body": m.group(2).strip()})
                continue

            if last_q is not None and not block.keys:
                target = last_q.options[-1] if last_q.options else None
                if target is not None:
                    target["body"] += " " + line
                else:
                    last_q.stem += " " + line
            elif block.keys:  # continuation of a written (open-question) answer
                n = max(block.keys)
                block.keys[n] += " " + line

    questions: list[Question] = []
    for b in blocks:
        for q in b.questions:
            q.raw_key = b.keys.get(q.n)
            questions.append(q)
    return questions


def to_record(q: Question) -> dict:
    stem = TYPE_MARK_RE.sub(" ", q.stem).strip()
    explicit_qcs = bool(re.search(r"\(QCS\)", q.stem, re.I)) or q.single_hint
    labels = [o["label"] for o in q.options]
    raw_key = (q.raw_key or "").strip() or None
    key = None
    issues: list[str] = []

    if raw_key is None:
        issues.append("no_key")
    elif "/" in raw_key or " ou " in raw_key.lower():
        issues.append("ambiguous_key")
    elif not KEY_BODY_RE.match(raw_key):
        issues.append("open_question")
    else:
        key = "".join(sorted(set(re.sub(r"[^A-E]", "", raw_key.upper()))))

    if len(q.options) < 2:
        issues.append("too_few_options")
    elif labels != [chr(65 + i) for i in range(len(labels))]:
        issues.append("bad_option_labels")
    if key and not set(key) <= set(labels):
        issues.append("key_not_in_options")
    if q.needs_image or IMAGE_RE.search(stem) or REFERS_RE.search(stem):
        issues.append("needs_image")

    qtype = "single" if explicit_qcs and (key is None or len(key) == 1) else "multiple"
    years = re.findall(r"(?:19|20)\d\d", q.label or "")  # "Les Autres : 2022 - 2008" is a range, not a year
    return {
        "course": q.course,
        "section": q.section,
        "label": q.label,
        "examYear": int(years[0]) if len(years) == 1 else None,
        "page": q.page,
        "n": q.n,
        "type": qtype,
        "stem": stem,
        "options": q.options,
        "key": key,
        "rawKey": raw_key,
        "status": "draft" if issues else "published",
        "issues": issues,
    }


def dedupe(records: list[dict]) -> tuple[list[dict], int]:
    seen, out, dropped = set(), [], 0
    for r in records:
        sig = (r["course"], fold(r["stem"]), tuple(fold(o["body"]) for o in r["options"]), r["key"])
        if sig in seen:
            dropped += 1
            continue
        seen.add(sig)
        out.append(r)
    return out, dropped


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf_dir", type=Path)
    ap.add_argument("--out", type=Path, default=OUT_DIR)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    for src in SOURCES:
        found = sorted(args.pdf_dir.glob(src.glob))
        if not found:
            print(f"- {src.key}: no PDF matching {src.glob}, skipped")
            continue
        # A number with no text ("31-" above a diagram to label) is not a question.
        # A number with no text ("31-") or no propositions at all (diagram labels) is not a QCM.
        parsed = [q for q in parse_source(src, found[0]) if len(TYPE_MARK_RE.sub(" ", q.stem).strip()) >= 3 and q.options]
        records, dropped = dedupe([to_record(q) for q in parsed])
        payload = {
            "module": src.module,
            "source": src.title,
            "courses": [{"slug": slug, "title": title} for _, slug, title in src.courses],
            "questions": records,
        }
        (args.out / f"{src.key}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n")
        published = sum(r["status"] == "published" for r in records)
        print(f"- {src.key}: {len(records)} questions, {published} published, "
              f"{len(records) - published} drafts, {dropped} duplicates dropped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
