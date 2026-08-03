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
| banner-kare-kare-oke.jpg | pexels.com/photo/588776 |
| banner-bread-pitt.jpg | pexels.com/photo/3341067 |
| banner-brewhaha.jpg | pexels.com/photo/4906424 |
| banner-lord-of-the-grills.jpg | pexels.com/photo/604660 |
| banner-ube-or-not-ube.jpg | pexels.com/photo/32972512 |
| banner-lettuce-eat-healthy.jpg | pexels.com/photo/1640773 |
| banner-i-saw-my-chance.jpg | pexels.com/photo/30563089 |
| banner-milky-way-tea.jpg | pexels.com/photo/1484678 |
| banner-pizza-my-heart.jpg | pexels.com/photo/29605927 |
| banner-sunny-side-diner.jpg | pexels.com/photo/37478618 |
| banner-wok-this-way.jpg | pexels.com/photo/4913345 |

The `banner-*.jpg` files are wide shop-cover photos, distinct from the
square-ish photo reused for the profile thumbnail (the `cover_photo:` key in
`seeds.rb`'s `DEMO_SHOPS`, despite the name, only ever fed the profile photo
and the old shared cover — see the `banner_photo:` key for the real cover).

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
- **banner-i-saw-my-chance.jpg** → a generic vibrant East Asian street-food
  stall (skewers, noodles), not specifically Filipino fishball/kwek-kwek/isaw
- **banner-milky-way-tea.jpg** → an iced tea cocktail shot; no clean,
  unbranded milk-tea/boba photo was found (several candidates had a real
  café's logo printed on the cup, or looked more like a cocktail bar)
- **banner-wok-this-way.jpg** → dumplings in bamboo steamers, though the
  same shot includes champagne flutes (upscale brunch styling) in the
  background
