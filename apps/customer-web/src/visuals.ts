// Deterministic monogram/emoji tiles for shops and items that have no photo yet.
// Reads as intentional design, not a broken image, and swaps to real photos the
// moment they're uploaded (photo option #1).

const EMOJI_RULES: [RegExp, string][] = [
  [/coffee|brew|latte|cafe|kape/i, '☕'],
  [/bake|bread|pandesal|pastry|ensaymada/i, '🥖'],
  [/sweet|dessert|halo|flan|cake|ube/i, '🍰'],
  [/grill|bbq|sizzle|inasal|sisig|skewer/i, '🍢'],
  [/green|salad|healthy|bowl|vegan|fruit/i, '🥗'],
  [/kitchen|adobo|filipino|rice|ulam|sinigang|kare/i, '🍚'],
]

export function emojiFor(text: string): string {
  for (const [re, emoji] of EMOJI_RULES) if (re.test(text)) return emoji
  return '🍽️'
}

// A stable pastel background derived from the name.
export function colorFor(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % 360
  return `hsl(${hash} 55% 88%)`
}
