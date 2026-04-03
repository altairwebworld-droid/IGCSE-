import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, writeBatch, doc, limit } from 'firebase/firestore';

export const IGCSE_FLASHCARDS = [
  // Biology
  { subject: 'Biology – 0610', term: 'Osmosis', definition: 'The net movement of water molecules from a region of higher water potential to a region of lower water potential, through a partially permeable membrane.' },
  { subject: 'Biology – 0610', term: 'Active Transport', definition: 'The movement of particles through a cell membrane from a region of lower concentration to a region of higher concentration using energy from respiration.' },
  { subject: 'Biology – 0610', term: 'Enzyme', definition: 'A protein that functions as a biological catalyst.' },
  { subject: 'Biology – 0610', term: 'Photosynthesis', definition: 'The process by which plants manufacture carbohydrates from raw materials using energy from light.' },
  { subject: 'Biology – 0610', term: 'Transpiration', definition: 'The loss of water vapour from plant leaves by evaporation of water at the surfaces of the mesophyll cells followed by diffusion of water vapour through the stomata.' },
  { subject: 'Biology – 0610', term: 'Hormone', definition: 'A chemical substance, produced by a gland and carried by the blood, which alters the activity of one or more specific target organs.' },
  { subject: 'Biology – 0610', term: 'Sense Organ', definition: 'A group of receptor cells responding to specific stimuli: light, sound, touch, temperature and chemicals.' },
  { subject: 'Biology – 0610', term: 'Inheritance', definition: 'The transmission of genetic information from generation to generation.' },
  { subject: 'Biology – 0610', term: 'Gene', definition: 'A length of DNA that codes for a protein.' },
  { subject: 'Biology – 0610', term: 'Allele', definition: 'Any of two or more alternative forms of a gene.' },
  
  // Chemistry
  { subject: 'Chemistry – 0620', term: 'Isotopes', definition: 'Atoms of the same element which have the same number of protons but different numbers of neutrons.' },
  { subject: 'Chemistry – 0620', term: 'Element', definition: 'A substance that cannot be split into anything simpler by chemical means.' },
  { subject: 'Chemistry – 0620', term: 'Compound', definition: 'A substance that consists of two or more elements chemically combined together.' },
  { subject: 'Chemistry – 0620', term: 'Mixture', definition: 'A substance that consists of two or more elements or compounds not chemically combined together.' },
  { subject: 'Chemistry – 0620', term: 'Catalyst', definition: 'A substance that increases the rate of a chemical reaction and is unchanged at the end of the reaction.' },
  { subject: 'Chemistry – 0620', term: 'Oxidation', definition: 'The gain of oxygen or the loss of electrons.' },
  { subject: 'Chemistry – 0620', term: 'Reduction', definition: 'The loss of oxygen or the gain of electrons.' },
  { subject: 'Chemistry – 0620', term: 'Electrolysis', definition: 'The breakdown of an ionic compound, molten or in aqueous solution, by the passage of electricity.' },
  { subject: 'Chemistry – 0620', term: 'Saturated Solution', definition: 'A solution that contains as much dissolved solute as possible at a particular temperature.' },
  { subject: 'Chemistry – 0620', term: 'Exothermic Reaction', definition: 'A reaction that releases energy to the surroundings, usually in the form of heat.' },

  // Physics
  { subject: 'Physics – 0625', term: 'Acceleration', definition: 'The rate of change of velocity.' },
  { subject: 'Physics – 0625', term: 'Velocity', definition: 'The speed of an object in a particular direction.' },
  { subject: 'Physics – 0625', term: 'Weight', definition: 'The force of gravity on an object.' },
  { subject: 'Physics – 0625', term: 'Mass', definition: 'The amount of matter in an object.' },
  { subject: 'Physics – 0625', term: 'Density', definition: 'Mass per unit volume.' },
  { subject: 'Physics – 0625', term: 'Work Done', definition: 'The product of force and the distance moved in the direction of the force.' },
  { subject: 'Physics – 0625', term: 'Power', definition: 'The rate at which work is done or energy is transferred.' },
  { subject: 'Physics – 0625', term: 'Refraction', definition: 'The change in direction of a wave as it passes from one medium to another of different optical density, causing a change in speed.' },
  { subject: 'Physics – 0625', term: 'Specific Heat Capacity', definition: 'The energy required per unit mass per unit temperature increase.' },
  { subject: 'Physics – 0625', term: 'Current', definition: 'The rate of flow of charge.' },

  // Economics
  { subject: 'Economics – 0455', term: 'Opportunity Cost', definition: 'The cost of the next best alternative foregone.' },
  { subject: 'Economics – 0455', term: 'Scarcity', definition: 'The basic economic problem that arises because resources are finite but wants are infinite.' },
  { subject: 'Economics – 0455', term: 'Price Elasticity of Demand', definition: 'A measure of the responsiveness of quantity demanded to a change in price.' },
  { subject: 'Economics – 0455', term: 'Inflation', definition: 'A sustained increase in the general price level in an economy over a period of time.' },
  { subject: 'Economics – 0455', term: 'Gross Domestic Product (GDP)', definition: 'The total value of all goods and services produced in an economy in a year.' },

  // Mathematics
  { subject: 'Mathematics – 0580 (Core/Extended)', term: 'Prime Number', definition: 'A number that has exactly two factors: 1 and itself.' },
  { subject: 'Mathematics – 0580 (Core/Extended)', term: 'Rational Number', definition: 'A number that can be written in the form a/b where a and b are integers and b is not zero.' },
  { subject: 'Mathematics – 0580 (Core/Extended)', term: 'Irrational Number', definition: 'A number that cannot be written as a simple fraction.' },
  { subject: 'Mathematics – 0580 (Core/Extended)', term: 'Standard Form', definition: 'A way of writing very large or very small numbers in the form a × 10^n, where 1 ≤ a < 10 and n is an integer.' },
  { subject: 'Mathematics – 0580 (Core/Extended)', term: 'Pythagoras\' Theorem', definition: 'In a right-angled triangle, the square of the hypotenuse is equal to the sum of the squares of the other two sides (a² + b² = c²).' },

  // Business Studies
  { subject: 'Business Studies – 0450', term: 'Business Objective', definition: 'The aims or targets that a business works towards.' },
  { subject: 'Business Studies – 0450', term: 'Market Segment', definition: 'A subgroup of a whole market in which the consumers have similar characteristics.' },
  { subject: 'Business Studies – 0450', term: 'Working Capital', definition: 'The capital of a business which is used in its day-to-day trading operations, calculated as current assets minus current liabilities.' },

  // Accounting
  { subject: 'Accounting – 0452', term: 'Assets', definition: 'Resources owned by a business.' },
  { subject: 'Accounting – 0452', term: 'Liabilities', definition: 'Amounts owed by a business to external parties.' },
  { subject: 'Accounting – 0452', term: 'Accounting Equation', definition: 'Assets = Capital + Liabilities.' },

  // Computer Science
  { subject: 'Computer Science – 0478', term: 'Algorithm', definition: 'A step-by-step procedure for solving a problem or accomplishing a task.' },
  { subject: 'Computer Science – 0478', term: 'Operating System', definition: 'Software that manages computer hardware and software resources and provides common services for computer programs.' },
  { subject: 'Computer Science – 0478', term: 'Data Bus', definition: 'A system within a computer or device, consisting of a connector or set of wires, that provides transportation for data.' },

  // Geography
  { subject: 'Geography – 0460', term: 'Urbanization', definition: 'The process by which an increasing percentage of a country\'s population comes to live in towns and cities.' },
  { subject: 'Geography – 0460', term: 'Drainage Basin', definition: 'The area of land drained by a river and its tributaries.' },
  { subject: 'Geography – 0460', term: 'Sustainability', definition: 'Development that meets the needs of the present without compromising the ability of future generations to meet their own needs.' }
];

export const IGCSE_QUESTIONS = [
  {
    subject: 'Biology – 0610',
    type: 'open',
    text: '[0610/41/M/J/19] Explain how the structure of a leaf is adapted for photosynthesis.',
    correctAnswer: 'Leaves are broad and flat to provide a large surface area for light absorption. They are thin for short diffusion distances of gases. The upper epidermis is transparent to let light through. The palisade mesophyll cells are packed with chloroplasts and arranged vertically to maximize light capture. Spongy mesophyll has air spaces for gas exchange. Stomata allow CO2 to enter and O2 to exit.',
    maxMarks: 6,
    id: 'b1'
  },
  {
    subject: 'Chemistry – 0620',
    type: 'multiple-choice',
    text: '[0620/21/O/N/20] Which statement about isotopes is correct?',
    options: [
      'They have the same number of neutrons.',
      'They have different numbers of protons.',
      'They have the same chemical properties.',
      'They have different numbers of electrons.'
    ],
    correctAnswer: 'They have the same chemical properties.',
    maxMarks: 1,
    id: 'c1'
  },
  {
    subject: 'Physics – 0625',
    type: 'fill-in-the-blanks',
    text: '[0625/31/M/J/21] Acceleration is defined as the rate of change of ___. The unit of acceleration is ___ per second squared.',
    correctAnswer: 'velocity, meters',
    maxMarks: 2,
    id: 'p1'
  }
];

export const seedData = async () => {
  const flashcardsRef = collection(db, 'flashcards');
  const questionBankRef = collection(db, 'questionBank');
  
  // Check if already seeded to avoid duplicates
  const flashSnap = await getDocs(query(flashcardsRef, limit(1)));
  const questionSnap = await getDocs(query(questionBankRef, limit(1)));

  if (flashSnap.empty) {
    const batch = writeBatch(db);
    IGCSE_FLASHCARDS.forEach((card) => {
      const newDocRef = doc(flashcardsRef);
      batch.set(newDocRef, { ...card, createdAt: new Date().toISOString() });
    });
    await batch.commit();
    console.log('Flashcards seeded');
  }

  if (questionSnap.empty) {
    const batch = writeBatch(db);
    IGCSE_QUESTIONS.forEach((q) => {
      const newDocRef = doc(questionBankRef);
      batch.set(newDocRef, { ...q, createdAt: new Date().toISOString() });
    });
    await batch.commit();
    console.log('Question bank seeded');
  }
};
