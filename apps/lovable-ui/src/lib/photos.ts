// Curated Unsplash imagery — stable photo IDs, vivid travel photography.
const u = (id: string, w = 900, h = 700) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export const photos = {
  lisbon: u("1555881400-74d7acaacd8b"),
  porto: u("1555990793-da11153b2473"),
  sanSebastian: u("1558642084-fd07fae5282e"),
  mallorca: u("1530841377377-3ff06c0ca713"),
  sicily: u("1523906834658-6e24ef2386f9"),
  amalfi: u("1533104816931-20fa691ff6ca"),
  crete: u("1602143407151-7111542de6e8"),
  santorini: u("1559682468-a6a29e7d9517"),
  costaBrava: u("1507525428034-b723cf961d3e"),
  algarve: u("1519046904884-53103b34b206"),
  barcelona: u("1583422409516-2895a77efded"),
  roadtrip: u("1469854523086-cc02fe5d8800"),
};
