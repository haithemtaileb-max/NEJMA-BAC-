/**
 * Sample QCM bank used by demo mode and `supabase/seed.sql`.
 *
 * Content is in French, like the UMMTO exams. `single` = QCS (one answer),
 * `multiple` = QCM (one or more answers). IDs are explicit and append-only.
 */
import { CURRICULUM, fixtureId } from '@/content/curriculum';
import { OPTION_LABELS, type OptionLabel, type QcmType } from '@/types/domain';

export interface SampleOption {
  label: OptionLabel;
  body: string;
  isCorrect: boolean;
  explanation: string | null;
}

/** A question of the starter content (hand-written samples or imported banks). */
export interface SampleQcm {
  id: string;
  courseId: string;
  moduleId: string;
  type: QcmType;
  stem: string;
  explanation: string | null;
  difficulty: 1 | 2 | 3 | 4 | 5 | null;
  source: string | null;
  examYear: number | null;
  tags: string[];
  /** Drafts are stored in the database but never shown to students. */
  status: 'published' | 'draft';
  options: SampleOption[];
}

/** [text, isCorrect, optional per-option explanation] — labels are assigned A, B, C… in order. */
type OptionSpec = [body: string, isCorrect: boolean, explanation?: string];

interface QcmSpec {
  type: QcmType;
  stem: string;
  options: OptionSpec[];
  explanation: string;
  difficulty?: 1 | 2 | 3 | 4 | 5;
  source?: string;
  tags?: string[];
}

const moduleOfCourse = new Map<string, string>(
  CURRICULUM.flatMap((m) => m.units.flatMap((u) => u.courses.map((c) => [c.id, m.id] as const))),
);

function q(n: number, courseN: number, spec: QcmSpec): SampleQcm {
  const courseId = fixtureId('course', courseN);
  const moduleId = moduleOfCourse.get(courseId);
  if (!moduleId) throw new Error(`sample QCM #${n}: unknown course #${courseN}`);
  return {
    id: fixtureId('qcm', n),
    courseId,
    moduleId,
    type: spec.type,
    stem: spec.stem,
    explanation: spec.explanation,
    difficulty: spec.difficulty ?? 2,
    source: spec.source ?? null,
    examYear: null,
    tags: spec.tags ?? [],
    status: 'published',
    options: spec.options.map(([body, isCorrect, explanation], i) => ({
      label: OPTION_LABELS[i],
      body,
      isCorrect,
      explanation: explanation ?? null,
    })),
  };
}

export const SAMPLE_QCMS: readonly SampleQcm[] = [
  // ===========================================================================
  // Médecine — L1
  // ===========================================================================
  q(1, 1, {
    type: 'multiple',
    stem: 'Concernant la scapula (omoplate) :',
    options: [
      ['C’est un os plat de forme triangulaire', true],
      ['Elle s’articule avec la clavicule par l’acromion', true, 'Articulation acromio-claviculaire.'],
      ['Sa cavité glénoïdale s’articule avec la tête de l’humérus', true],
      ['Elle présente une épine sur sa face antérieure', false, 'L’épine de la scapula est sur la face postérieure.'],
      ['Le processus coracoïde naît de son bord médial', false, 'Il naît du bord supérieur, près du col de la scapula.'],
    ],
    explanation:
      'La scapula est un os plat triangulaire de la ceinture scapulaire. Sa face postérieure porte l’épine, qui se prolonge latéralement par l’acromion (articulé avec la clavicule). La cavité glénoïdale reçoit la tête humérale.',
    tags: ['ostéologie', 'membre supérieur'],
  }),
  q(2, 1, {
    type: 'single',
    stem: 'Quel os du carpe s’articule avec le radius et est le plus fréquemment fracturé ?',
    options: [['Le lunatum', false], ['Le scaphoïde', true], ['Le pisiforme', false], ['L’hamatum', false], ['Le trapèze', false]],
    explanation:
      'Le scaphoïde (rangée proximale) s’articule avec le radius. Sa fracture, typique d’une chute sur la paume de la main, poignet en extension, expose au risque de nécrose du pôle proximal.',
    difficulty: 1,
  }),
  q(3, 1, {
    type: 'multiple',
    stem: 'Concernant l’humérus :',
    options: [
      ['Le nerf radial chemine dans le sillon du nerf radial, à la face postérieure de la diaphyse', true],
      ['Le nerf ulnaire passe en arrière de l’épicondyle médial', true],
      ['Le col chirurgical est situé au-dessus des tubercules majeur et mineur', false, 'Il est situé sous les tubercules ; le col anatomique borde la tête.'],
      ['Le tubercule majeur est situé en dedans du tubercule mineur', false, 'Le tubercule majeur est latéral.'],
      ['La trochlée humérale s’articule avec l’incisure trochléaire de l’ulna', true],
    ],
    explanation:
      'Deux rapports nerveux à connaître : nerf radial (sillon postérieur de la diaphyse, exposé dans les fractures diaphysaires) et nerf ulnaire (derrière l’épicondyle médial). Le col chirurgical, sous les tubercules, est le siège fréquent des fractures du sujet âgé.',
    difficulty: 3,
  }),
  q(4, 2, {
    type: 'multiple',
    stem: 'Concernant le glucose :',
    options: [
      ['C’est un aldohexose', true],
      ['Sa formule brute est C6H12O6', true],
      ['C’est un cétose', false, 'Le fructose est un cétose ; le glucose porte une fonction aldéhyde.'],
      ['En solution, il existe majoritairement sous forme cyclique', true, 'Principalement sous forme pyranose (β > α).'],
      ['Le saccharose est formé de deux molécules de glucose', false, 'Saccharose = glucose + fructose ; le maltose = glucose + glucose.'],
    ],
    explanation:
      'Le D-glucose est un aldohexose (C6H12O6). En solution aqueuse, la forme linéaire est minoritaire : la cyclisation hémiacétalique donne surtout le β-D-glucopyranose.',
    difficulty: 1,
  }),
  q(5, 3, {
    type: 'single',
    stem: 'Quel acide aminé ne possède pas de carbone asymétrique ?',
    options: [['Alanine', false], ['Glycine', true], ['Sérine', false], ['Valine', false], ['Leucine', false]],
    explanation: 'La chaîne latérale de la glycine est un atome d’hydrogène : son carbone α porte deux H, il n’est donc pas chiral.',
    difficulty: 1,
  }),
  q(6, 3, {
    type: 'multiple',
    stem: 'La liaison peptidique :',
    options: [
      ['S’établit entre le carboxyle α d’un acide aminé et l’amine α du suivant', true],
      ['Libère une molécule d’eau lors de sa formation', true],
      ['Présente un caractère partiel de double liaison', true],
      ['Permet une libre rotation autour de la liaison C–N', false, 'La mésomérie rend la liaison C–N plane et rigide.'],
      ['Peut être rompue par hydrolyse', true],
    ],
    explanation:
      'Condensation entre COOH α et NH2 α avec départ d’eau. La délocalisation électronique donne à la liaison C–N un caractère partiel de double liaison : le groupement peptidique est plan, sans rotation libre.',
  }),
  q(7, 7, {
    type: 'multiple',
    stem: 'Concernant la membrane plasmique :',
    options: [
      ['Son organisation est décrite par le modèle de la mosaïque fluide (Singer et Nicolson)', true],
      ['Les phospholipides sont des molécules amphiphiles', true],
      ['Le cholestérol module sa fluidité', true],
      ['Les glucides membranaires sont situés sur la face cytosolique', false, 'Ils forment le glycocalyx, sur la face extracellulaire.'],
      ['Les protéines intrinsèques traversent toujours toute la bicouche', false, 'Certaines sont seulement ancrées dans un feuillet.'],
    ],
    explanation:
      'Bicouche de phospholipides amphiphiles dans laquelle diffusent protéines et cholestérol (mosaïque fluide). L’asymétrie membranaire place les glycolipides et glycoprotéines sur la face externe.',
  }),
  q(8, 8, {
    type: 'single',
    stem: 'Quel organite est le siège de la phosphorylation oxydative ?',
    options: [['Réticulum endoplasmique granuleux', false], ['Appareil de Golgi', false], ['Mitochondrie', true], ['Lysosome', false], ['Peroxysome', false]],
    explanation: 'La chaîne respiratoire et l’ATP synthase sont localisées dans la membrane interne mitochondriale (crêtes).',
    difficulty: 1,
  }),
  q(9, 9, {
    type: 'multiple',
    stem: 'Au cours de la mitose :',
    options: [
      ['La prophase est marquée par la condensation des chromosomes', true],
      ['En métaphase, les chromosomes s’alignent sur la plaque équatoriale', true],
      ['L’anaphase correspond à la séparation des chromatides sœurs', true],
      ['Des crossing-over se produisent en prophase', false, 'Les crossing-over sont propres à la prophase I de méiose.'],
      ['Elle aboutit à deux cellules filles haploïdes', false, 'La mitose donne deux cellules diploïdes identiques.'],
    ],
    explanation: 'Prophase → prométaphase → métaphase → anaphase → télophase. La mitose conserve la ploïdie ; la réduction chromosomique est le fait de la méiose.',
  }),
  q(10, 12, {
    type: 'multiple',
    stem: 'Le potentiel de repos d’un neurone :',
    options: [
      ['Est d’environ −70 mV', true],
      ['Dépend principalement de la perméabilité membranaire au K+', true],
      ['Est entretenu par la pompe Na+/K+-ATPase, qui fait sortir 3 Na+ et entrer 2 K+', true],
      ['Correspond à un intérieur cellulaire positif par rapport à l’extérieur', false],
      ['Est aboli par la tétrodotoxine', false, 'La TTX bloque les canaux Na+ voltage-dépendants : elle abolit le potentiel d’action, pas le potentiel de repos.'],
    ],
    explanation:
      'Au repos, la membrane est surtout perméable au K+ : le potentiel de repos est proche du potentiel d’équilibre du potassium. La pompe Na+/K+ (électrogène) maintient les gradients.',
    difficulty: 3,
  }),
  q(11, 13, {
    type: 'single',
    stem: 'Quelle hormone est hypoglycémiante ?',
    options: [['Glucagon', false], ['Insuline', true], ['Cortisol', false], ['Adrénaline', false], ['Hormone de croissance', false]],
    explanation: 'L’insuline (cellules β des îlots de Langerhans) est la seule hormone hypoglycémiante ; les autres citées sont hyperglycémiantes.',
    difficulty: 1,
  }),
  q(12, 4, {
    type: 'single',
    stem: 'L’unité de pression du Système international est :',
    options: [['Le millimètre de mercure', false], ['L’atmosphère', false], ['Le pascal', true], ['Le bar', false], ['Le centimètre d’eau', false]],
    explanation: '1 Pa = 1 N·m⁻². Le mmHg et le cmH2O restent utilisés en médecine mais ne sont pas des unités SI.',
    difficulty: 1,
  }),
  q(13, 5, {
    type: 'multiple',
    stem: 'Concernant l’osmolarité et les solutions :',
    options: [
      ['Une solution de NaCl à 9 g/L est isotonique au plasma', true],
      ['L’osmolarité plasmatique normale est d’environ 290 mOsm/L', true],
      ['Dans une solution hypotonique, les hématies peuvent subir une hémolyse', true],
      ['Dans une solution hypertonique, les hématies gonflent', false, 'Elles perdent de l’eau et se ratatinent (crénelure).'],
      ['L’osmolarité dépend de la masse molaire du soluté et non du nombre de particules', false, 'C’est l’inverse : seule compte la concentration en particules.'],
    ],
    explanation:
      'L’osmolarité est une propriété colligative : elle dépend du nombre de particules en solution. L’eau se déplace vers le compartiment le plus concentré en osmoles efficaces.',
  }),
  q(14, 10, {
    type: 'multiple',
    stem: 'Concernant la fécondation humaine :',
    options: [
      ['Elle a lieu normalement dans l’ampoule de la trompe utérine', true],
      ['La réaction acrosomique permet la traversée de la zone pellucide', true],
      ['La réaction corticale empêche la polyspermie', true],
      ['L’ovocyte achève sa deuxième division méiotique après la pénétration du spermatozoïde', true],
      ['La nidation a lieu au 2e jour après la fécondation', false, 'La nidation débute vers le 6e–7e jour.'],
    ],
    explanation: 'L’ovocyte est bloqué en métaphase II jusqu’à la fécondation. La réaction corticale modifie la zone pellucide et bloque la polyspermie.',
    difficulty: 2,
  }),
  q(15, 11, {
    type: 'single',
    stem: 'L’épiderme est un épithélium :',
    options: [
      ['Pavimenteux simple', false],
      ['Cylindrique simple', false],
      ['Pavimenteux stratifié kératinisé', true],
      ['Pseudostratifié cilié', false],
      ['Polymorphe (urothélium)', false],
    ],
    explanation: 'Épithélium malpighien kératinisé : couches basale, épineuse, granuleuse et cornée.',
    difficulty: 1,
  }),
  q(16, 6, {
    type: 'single',
    stem: 'Pour une variable suivant une loi normale, l’intervalle moyenne ± 1,96 écart-type contient environ :',
    options: [['68 % des valeurs', false], ['90 % des valeurs', false], ['95 % des valeurs', true], ['99 % des valeurs', false], ['99,7 % des valeurs', false]],
    explanation: 'μ ± 1σ ≈ 68 %, μ ± 1,96σ ≈ 95 %, μ ± 2,58σ ≈ 99 %, μ ± 3σ ≈ 99,7 %.',
  }),

  // ===========================================================================
  // Médecine — L2
  // ===========================================================================
  q(17, 14, {
    type: 'multiple',
    stem: 'Concernant le cœur :',
    options: [
      ['La valve mitrale sépare l’atrium gauche du ventricule gauche', true],
      ['La valve tricuspide sépare l’atrium droit du ventricule droit', true],
      ['Le nœud sinusal est situé dans la paroi de l’atrium droit', true],
      ['Les artères coronaires naissent du tronc pulmonaire', false, 'Elles naissent des sinus aortiques, juste au-dessus de la valve aortique.'],
      ['La paroi du ventricule droit est plus épaisse que celle du ventricule gauche', false],
    ],
    explanation: 'Le ventricule gauche, qui éjecte dans la circulation systémique à haute pression, a la paroi la plus épaisse. Le nœud sinusal, près de l’abouchement de la veine cave supérieure, est le pacemaker physiologique.',
  }),
  q(18, 15, {
    type: 'single',
    stem: 'Le débit cardiaque est égal à :',
    options: [
      ['Fréquence cardiaque × volume d’éjection systolique', true],
      ['Pression artérielle ÷ fréquence cardiaque', false],
      ['Volume d’éjection systolique ÷ fréquence cardiaque', false],
      ['Pression artérielle moyenne × résistances vasculaires', false],
      ['Fréquence cardiaque × pression artérielle', false],
    ],
    explanation: 'Qc = FC × VES (≈ 70 × 70 mL ≈ 5 L/min au repos). À noter : PAM = Qc × RVS.',
    difficulty: 1,
  }),
  q(19, 16, {
    type: 'multiple',
    stem: 'Le surfactant pulmonaire :',
    options: [
      ['Est sécrété par les pneumocytes de type II', true],
      ['Diminue la tension superficielle alvéolaire', true],
      ['Son déficit est responsable de la maladie des membranes hyalines du prématuré', true],
      ['Est sécrété par les pneumocytes de type I', false],
      ['Augmente le travail respiratoire', false, 'Il le diminue en augmentant la compliance pulmonaire.'],
    ],
    explanation: 'Mélange de phospholipides (surtout dipalmitoylphosphatidylcholine) et de protéines, il stabilise les alvéoles et prévient leur collapsus en fin d’expiration.',
  }),
  q(20, 17, {
    type: 'single',
    stem: 'La sécrétion d’acide chlorhydrique gastrique est assurée par les :',
    options: [['Cellules principales', false], ['Cellules pariétales (bordantes)', true], ['Cellules G', false], ['Cellules à mucus', false], ['Cellules de Paneth', false]],
    explanation: 'Les cellules pariétales sécrètent HCl (pompe H+/K+-ATPase) et le facteur intrinsèque. Les cellules principales sécrètent le pepsinogène, les cellules G la gastrine.',
    difficulty: 2,
  }),
  q(21, 18, {
    type: 'multiple',
    stem: 'Concernant les immunoglobulines :',
    options: [
      ['Les IgG sont la seule classe à traverser le placenta', true],
      ['Les IgM sériques sont des pentamères', true],
      ['Les IgA sécrétoires prédominent dans les sécrétions muqueuses', true],
      ['Les IgE sont impliquées dans l’hypersensibilité immédiate (type I)', true],
      ['Les IgD sont les immunoglobulines les plus abondantes dans le sérum', false, 'Ce sont les IgG (≈ 75 %).'],
    ],
    explanation: 'Retenir : IgG (placenta, majoritaires), IgM (pentamère, réponse primaire), IgA (muqueuses, dimère sécrétoire), IgE (allergie, parasites), IgD (récepteur du lymphocyte B naïf).',
    difficulty: 2,
  }),
  q(22, 19, {
    type: 'single',
    stem: 'Le caryotype humain normal comporte :',
    options: [['23 chromosomes', false], ['44 chromosomes', false], ['46 chromosomes', true], ['47 chromosomes', false], ['48 chromosomes', false]],
    explanation: '46 chromosomes : 22 paires d’autosomes + 1 paire de gonosomes (46,XX ou 46,XY).',
    difficulty: 1,
  }),

  // ===========================================================================
  // Chirurgie dentaire — L1
  // ===========================================================================
  q(23, 20, {
    type: 'single',
    stem: 'La denture permanente complète comporte :',
    options: [['20 dents', false], ['24 dents', false], ['28 dents', false], ['30 dents', false], ['32 dents', true]],
    explanation: 'Par hémi-arcade : 2 incisives, 1 canine, 2 prémolaires, 3 molaires = 8, soit 32 dents (dents de sagesse comprises).',
    difficulty: 1,
  }),
  q(24, 21, {
    type: 'multiple',
    stem: 'Concernant l’émail dentaire :',
    options: [
      ['C’est le tissu le plus minéralisé de l’organisme', true],
      ['Il est élaboré par les améloblastes', true],
      ['Il est d’origine ectodermique', true],
      ['Il se régénère spontanément après une lésion carieuse', false, 'Les améloblastes disparaissent à l’éruption : l’émail ne se régénère pas.'],
      ['Il est élaboré par les odontoblastes', false, 'Les odontoblastes élaborent la dentine.'],
    ],
    explanation: 'Émail ≈ 96 % de minéral (hydroxyapatite). Il dérive de l’organe de l’émail (ectoderme) ; la dentine et la pulpe dérivent de l’ectomésenchyme.',
  }),
  q(25, 20, {
    type: 'single',
    stem: 'La denture temporaire (lactéale) comporte :',
    options: [['20 dents', true], ['24 dents', false], ['28 dents', false], ['32 dents', false], ['16 dents', false]],
    explanation: 'Par hémi-arcade : 2 incisives, 1 canine, 2 molaires temporaires = 5, soit 20 dents. Il n’y a pas de prémolaires temporaires.',
    difficulty: 1,
  }),
  q(26, 22, {
    type: 'single',
    stem: 'La synthèse des protéines destinées à être sécrétées débute sur les ribosomes et se poursuit dans :',
    options: [
      ['Le réticulum endoplasmique granuleux', true],
      ['Le réticulum endoplasmique lisse', false],
      ['Le lysosome', false],
      ['Le peroxysome', false],
      ['Le noyau', false],
    ],
    explanation: 'Voie de sécrétion : ribosomes liés au REG → appareil de Golgi → vésicules de sécrétion → exocytose.',
  }),

  // ===========================================================================
  // Chirurgie dentaire — L2
  // ===========================================================================
  q(27, 25, {
    type: 'multiple',
    stem: 'Concernant la dentine :',
    options: [
      ['Elle est élaborée par les odontoblastes', true],
      ['Elle est parcourue par des tubules dentinaires', true],
      ['Elle est moins minéralisée que l’émail', true],
      ['Sa formation cesse définitivement à la fin de l’édification radiculaire', false, 'La dentine secondaire se forme toute la vie, la dentine tertiaire en réaction à une agression.'],
      ['Elle recouvre l’émail au niveau de la couronne', false, 'C’est l’émail qui recouvre la dentine coronaire.'],
    ],
    explanation: 'La dentine (≈ 70 % minéral) forme la masse de la dent ; les prolongements odontoblastiques occupent les tubules, ce qui explique la sensibilité dentinaire.',
  }),
  q(28, 23, {
    type: 'single',
    stem: 'Parmi ces muscles, lequel est élévateur de la mandibule ?',
    options: [['Digastrique', false], ['Masséter', true], ['Génio-hyoïdien', false], ['Mylo-hyoïdien', false], ['Platysma', false]],
    explanation: 'Élévateurs : masséter, temporal, ptérygoïdien médial. Le ptérygoïdien latéral est propulseur ; les sus-hyoïdiens (digastrique, mylo- et génio-hyoïdien) sont abaisseurs.',
  }),
  q(29, 24, {
    type: 'single',
    stem: 'La sensibilité des dents mandibulaires est assurée par le nerf :',
    options: [['Alvéolaire inférieur', true], ['Facial', false], ['Lingual', false], ['Hypoglosse', false], ['Glosso-pharyngien', false]],
    explanation: 'Branche du nerf mandibulaire (V3), le nerf alvéolaire inférieur chemine dans le canal mandibulaire ; c’est la cible de l’anesthésie tronculaire à l’épine de Spix.',
  }),

  // ===========================================================================
  // Pharmacie — L1
  // ===========================================================================
  q(30, 26, {
    type: 'single',
    stem: 'Le numéro atomique Z d’un élément représente :',
    options: [
      ['Le nombre de neutrons', false],
      ['Le nombre de protons', true],
      ['Le nombre de nucléons', false],
      ['La masse atomique', false],
      ['Le nombre d’électrons de valence', false],
    ],
    explanation: 'Z = nombre de protons (égal au nombre d’électrons de l’atome neutre). A = nombre de nucléons = Z + N.',
    difficulty: 1,
  }),
  q(31, 27, {
    type: 'multiple',
    stem: 'Concernant le pH :',
    options: [
      ['pH = −log [H3O+]', true],
      ['Une solution neutre à 25 °C a un pH de 7', true],
      ['Une solution de pH 3 est dix fois plus acide qu’une solution de pH 4', true],
      ['Une solution diluée de base forte a un pH inférieur à 7', false],
      ['Le pH plasmatique normal est d’environ 7,40', true],
    ],
    explanation: 'L’échelle de pH est logarithmique : une unité de pH correspond à un facteur 10 de [H3O+]. Le pH artériel normal est de 7,38–7,42.',
  }),
  q(32, 29, {
    type: 'multiple',
    stem: 'La cellule végétale :',
    options: [
      ['Possède une paroi pectocellulosique', true],
      ['Contient des plastes, dont les chloroplastes', true],
      ['Possède généralement une vacuole volumineuse', true],
      ['Est dépourvue de mitochondries', false, 'Elle possède des mitochondries en plus des chloroplastes.'],
      ['Possède des centrioles typiques', false, 'Les végétaux supérieurs n’ont pas de centrioles.'],
    ],
    explanation: 'Trois particularités de la cellule végétale : paroi, plastes, grande vacuole. Elle conserve toutefois des mitochondries.',
  }),
  q(33, 28, {
    type: 'single',
    stem: 'Un atome de carbone hybridé sp3 présente une géométrie :',
    options: [['Linéaire', false], ['Plane trigonale', false], ['Tétraédrique', true], ['Octaédrique', false], ['Pyramidale à base carrée', false]],
    explanation: 'sp3 : 4 orbitales hybrides à 109,5° (tétraèdre, ex. méthane). sp2 : plan trigonal à 120°. sp : linéaire à 180°.',
    difficulty: 1,
  }),

  // ===========================================================================
  // Pharmacie — L2
  // ===========================================================================
  q(34, 30, {
    type: 'single',
    stem: 'Dans le modèle de Michaelis-Menten, la constante Km correspond à :',
    options: [
      ['La vitesse maximale de la réaction', false],
      ['La concentration en substrat pour laquelle v = Vmax/2', true],
      ['La concentration totale en enzyme', false],
      ['La vitesse initiale de la réaction', false],
      ['La constante d’équilibre de la réaction', false],
    ],
    explanation: 'Km s’exprime en concentration ; plus Km est faible, plus l’affinité apparente de l’enzyme pour son substrat est grande.',
  }),
  q(35, 32, {
    type: 'multiple',
    stem: 'Concernant les bactéries à Gram positif :',
    options: [
      ['Leur paroi contient une épaisse couche de peptidoglycane', true],
      ['Elles apparaissent violettes après coloration de Gram', true],
      ['Elles possèdent une membrane externe riche en lipopolysaccharide', false, 'La membrane externe à LPS caractérise les Gram négatif.'],
      ['Staphylococcus aureus est un cocci à Gram positif', true],
      ['Escherichia coli est un bacille à Gram positif', false, 'E. coli est un bacille à Gram négatif.'],
    ],
    explanation: 'Le peptidoglycane épais retient le complexe violet de gentiane–lugol malgré la décoloration à l’alcool : les Gram positif restent violets, les Gram négatif sont recolorés en rose par la fuchsine.',
  }),
  q(36, 31, {
    type: 'single',
    stem: 'Selon la loi de Beer-Lambert, l’absorbance A s’écrit :',
    options: [['A = ε · l · c', true], ['A = ε / (l · c)', false], ['A = l / c', false], ['A = log(I / I0) · c', false], ['A = ε · c / l', false]],
    explanation: 'A = log(I0/I) = ε·l·c, avec ε le coefficient d’absorption molaire, l le trajet optique et c la concentration. Relation linéaire valable pour les solutions diluées.',
    difficulty: 1,
  }),
];
