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

// A stable pastel background derived from the name. Restricted to a warm hue
// band (reds through amber/gold) so tiles read as an inviting food market
// rather than rolling into a cool blue or green for an arbitrary name.
export function colorFor(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % 48
  return `hsl(${hash} 62% 87%)`
}
