import { uniqueNamesGenerator, adjectives, animals } from 'unique-names-generator';

export const COLOURS: string[] = [
  '#144272', '#232D3F', '#2D3250', '#30475E', '#46C2CB', '#A2678A', '#BE3144',
  'black', 'blueviolet', 'brown', 'cadetblue', 'chocolate', 'coral', 'crimson',
  'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgreen', 'darkkhaki', 'darkmagenta',
  'darkolivegreen', 'darkorange', 'darkorchid', 'darkseagreen', 'darkslateblue',
  'darkslategrey', 'darkviolet', 'deeppink', 'dodgerblue', 'firebrick', 'forestgreen',
  'goldenrod', 'green', 'hotpink', 'indianred', 'indigo', 'lightsalmon', 'lightseagreen',
  'magenta', 'maroon', 'mediumblue', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
  'mediumvioletred', 'midnightblue', 'navy', 'olive', 'olivedrab', 'orangered',
  'palevioletred', 'peru', 'purple', 'rebeccapurple', 'red', 'royalblue', 'saddlebrown',
  'salmon', 'steelblue', 'teal',
];

// Curated personality content — re-keyed, not imported.
export const JOKE_NAMES: string[] = [
  'ai', 'android', 'automobile', 'avenger', 'beyonce', 'bindelstick', 'blue eyes white dragon',
  'boba fett', 'bulbasaur', 'captain janeway', 'captain picard', 'card picker', 'charizard',
  'charmander', 'chocobo', 'cleon', 'commander sisko', 'deana troi', 'digimon', 'director',
  'dobby', 'droid', 'emmissary', 'engineer', 'exodia', 'frieren', 'geordi laforge', 'han solo',
  'hari seldon', 'hypersphere', 'iron man', 'jedi', 'knitter', 'lwaxana troi',
  'Lwaxana Troi, daughter of the Fifth House, holder of the Sacred Chalice of Rixx, heir to the Holy Rings of Betazed',
  'mandalorian', 'millenium puzzle', 'mojito', 'moonbase', 'nephilim', 'oddish', 'one punch man',
  'orbital', 'peppa pig', 'pikachu', 'pingu', 'plant pot', 'poet', 'Q', 'raichu', 'rhombus',
  'riker', 'scrum disciple', 'scrum master', 'servitor', 'shredder', 'shrike', 'sith', 'skywalker',
  'slime', 'snowstorm', 'spock', 'star destroyer', 'tarkin', 'television', 'tellytubby', 'tesseract',
  'trackpad', 'transporter', 'transporter clone', 'triangle', 'unicron', 'voltron', 'voter',
  'womble', 'xanadu', 'xenu', 'yugi', 'zod',
];

export const FORBIDDEN: string[] = [
  'attractive', 'available', 'christian', 'chubby', 'creepy', 'desirable', 'dirty', 'ethnic',
  'explicit', 'fat', 'filthy', 'gay', 'gorgeous', 'hard', 'hot', 'married', 'moaning', 'naughty',
  'oral', 'protestant', 'racial', 'rude', 'sexual', 'straight', 'yeasty', 'beaver', 'booby',
  'cow', 'dog', 'kite', 'rat', 'snake', 'thrush',
];

const safeAdjectives = adjectives.filter((w) => !FORBIDDEN.includes(w));
const safeNouns = animals.concat(JOKE_NAMES).filter((w) => !FORBIDDEN.includes(w));

export function generateColor(): string {
  return uniqueNamesGenerator({ dictionaries: [COLOURS], length: 1 });
}

export function generateName(): string {
  return uniqueNamesGenerator({ dictionaries: [safeAdjectives, safeNouns], separator: ' ', length: 2 });
}

export function generateSlug(): string {
  return uniqueNamesGenerator({ dictionaries: [adjectives, animals], separator: '-', length: 2 });
}

/** Pure: returns `name` if not in `taken` (case-insensitive), else prepends a safe adjective. */
export function uniquifyName(name: string, taken: Set<string>): string {
  const lower = (s: string) => s.toLowerCase();
  const isTaken = (candidate: string) => [...taken].some((t) => lower(t) === lower(candidate));
  if (!isTaken(name)) return name;
  for (let i = 0; i < 10; i++) {
    const adj = uniqueNamesGenerator({ dictionaries: [safeAdjectives], length: 1 });
    const candidate = `${adj} ${name}`;
    if (!isTaken(candidate)) return candidate;
  }
  return name;
}
