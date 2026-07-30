# Seed photo sources

Demo-only stock photos used to seed shops/items so the discovery demo looks
real instead of using generated placeholder tiles. All from Pexels, whose
license is free for commercial use with no attribution required — kept here
anyway for reference/provenance, not because it's legally required.

Real vendor photos (uploaded via vendor-web) replace these automatically the
moment a shop/item has one — see `ImageAttachable` / `attach_placeholder_photos`
in `db/seeds.rb`. These are not meant to ship as long-term production imagery.

| File | Source URL |
|---|---|
| adobo-candidate.jpg | pexels.com/photo/6525933 |
| oxtail-stew.jpg | pexels.com/photo/27556975 |
| beef-noodle.jpg | pexels.com/photo/34834550 |
| bread-rolls.jpg | pexels.com/photo/1118332 |
| sweet-cheese-roll.jpg | pexels.com/photo/34447187 |
| ube-pandesal.jpg | pexels.com/photo/6896282 |
| iced-latte.jpg | pexels.com/photo/35028555 |
| kapeng-barako.jpg | pexels.com/photo/20359823 |
| matcha-latte.jpg | pexels.com/photo/11009223 |
| grill-skewers.jpg | pexels.com/photo/38602965 |
| chicken-skewer.jpg | pexels.com/photo/38138067 |
| sisig-candidate.jpg | pexels.com/photo/6896281 |
| ube-cake.png | pexels.com/photo/5638555 |
| leche-flan.jpg | pexels.com/photo/34474027 |
| halo-halo.jpg | pexels.com/photo/5870643 |
| buddha-bowl.jpg | pexels.com/photo/19150338 |
| caesar-bowl.jpg | pexels.com/photo/6107789 |
| fruit-cup.jpg | pexels.com/photo/38280506 |
| isaw-manila-skewers.jpg | pexels.com/photo/35924352 |
| street-food-cart.jpg | pexels.com/photo/36869033 |
| milk-tea.jpg | pexels.com/photo/35727299 |
| strawberry-tea.jpg | pexels.com/photo/5668258 |
| pizza-pepperoni.jpg | pexels.com/photo/35017349 |
| four-cheese-pizza.jpg | pexels.com/photo/28272163 |
| hawaiian-pizza.jpg | pexels.com/photo/33592994 |
| tapsilog.jpg | pexels.com/photo/36566222 |
| longsilog.jpg | pexels.com/photo/38712744 |
| bangsilog.jpg | pexels.com/photo/32196851 |
| siomai.jpg | pexels.com/photo/36922120 |
| siopao-candidate.jpg | pexels.com/photo/14942404 |

## Known imperfect matches (accepted, noted for transparency)

Some Filipino dishes have thin coverage in Western stock libraries. These use
the closest reasonable proxy rather than an exact match:
- **Pork Sinigang** → beef-noodle.jpg (a generic soup bowl; no sour-tamarind
  soup photo was found across several search attempts)
- **Kwek-Kwek** → reuses street-food-cart.jpg (shows fried orange snack balls,
  same as Fishball; no distinctly kwek-kwek photo found)
- **Wintermelon Milk Tea** → reuses milk-tea.jpg (no pale-green milk tea photo
  found; boba drinks look broadly similar across flavors anyway)
- **Longsilog** / **Bangsilog** → both are appetizing Filipino breakfast
  plates, but not precisely showing longganisa sausage / fried milkfish
  respectively
