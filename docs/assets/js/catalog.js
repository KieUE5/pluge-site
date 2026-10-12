// PLUGE shop catalogue: edit this file to change products, prices, stock, sizes and delivery.
// Product photos live in assets/img/products as <id>-<colour>-<view>.webp (1000x1200)
// and <id>-<colour>-<view>-sm.webp (500x600). Rebuild them with tools/build-images.cjs.
window.PLUGE = (() => {
  const BRAND = "PLUGE"; // Placeholder brand name. Also change it in index.html (title, logo, footer).

  // Where the site lives, with a trailing slash. Used for share links, product page links and the sitemap.
  // After changing it (for example to your own domain), run: node tools/build-pages.cjs
  const SITE_URL = "https://kieue5.github.io/pluge-site/";

  // Checkout. While shopDomain is empty the bag shows a "preview, not taking orders" message.
  // To take real payments, set up a Shopify store (see README, "Take real orders with Shopify"),
  // then fill these in. The Storefront token is a public token, so it is safe to publish here.
  const CHECKOUT = {
    shopDomain: "",       // e.g. "pluge-shop.myshopify.com"
    storefrontToken: "",  // Headless channel > Storefront API > Public access token
    apiVersion: "2026-07",
    syncStock: true,      // use Shopify's stock and prices instead of the ones in this file
  };

  const DROP_02 = "2026-10-30T18:00:00Z"; // Fri 30 Oct 2026, 18:00 GMT

  // Delivery: dispatch in 1–2 working days, then the carrier's transit time (working days).
  const SHIP = {
    t48: { name: "Royal Mail Tracked 48", fee: 4.95, freeOver: 75, days: [3, 4] },
    t24: { name: "Royal Mail Tracked 24", fee: 5.95, freeOver: null, days: [2, 3] },
  };

  // England and Wales bank holidays, skipped when estimating delivery dates.
  const BANK_HOLIDAYS = [
    "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04", "2026-05-25", "2026-08-31", "2026-12-25", "2026-12-28",
    "2027-01-01", "2027-03-26", "2027-03-29", "2027-05-03", "2027-05-31", "2027-08-30", "2027-12-27", "2027-12-28",
  ];

  // Swatch colours shown in the shop. "swatch" overrides the plain colour for multi-colour packs.
  const COLOURS = {
    black: { name: "Black", hex: "#151517" },
    white: { name: "White", hex: "#F4F4F1" },
    ash: { name: "Ash", hex: "#A3A5AA" },
    olive: { name: "Olive", hex: "#5A5D44" },
    blue: { name: "Signal Blue", hex: "#2230FF" },
    mixed: { name: "Mixed", hex: "#151517", swatch: "linear-gradient(90deg,#151517 0 33.3%,#F4F4F1 33.3% 66.6%,#A3A5AA 66.6%)" },
  };

  const TOPS = ["XS", "S", "M", "L", "XL", "XXL"];
  const WAIST = ["28", "30", "32", "34", "36"];
  const ONE = ["One size"];
  const SOCK = ["UK 6–8", "UK 9–11"];

  const CATS = [
    { id: "all", label: "All" },
    { id: "fleece", label: "Hoodies & Sweats" },
    { id: "tees", label: "Tees" },
    { id: "bottoms", label: "Bottoms" },
    { id: "acc", label: "Accessories" },
  ];

  const TOP_HOW = "How we measure: chest is measured flat, straight across 2.5cm below the armpits. Length runs from the highest point of the shoulder to the hem. Allow ±2cm.";
  const GUIDES = {
    fleece: { note: "Garment measurements, laid flat.", cols: ["Size", "Chest (pit to pit)", "Length"], finder: true, how: TOP_HOW,
      rows: [["XS", 56, 66], ["S", 59, 68], ["M", 62, 70], ["L", 65, 72], ["XL", 68, 74], ["XXL", 71, 76]] },
    tee: { note: "Garment measurements, laid flat.", cols: ["Size", "Chest (pit to pit)", "Length"], finder: true, how: TOP_HOW,
      rows: [["XS", 54, 67], ["S", 57, 69], ["M", 60, 71], ["L", 63, 73], ["XL", 66, 75], ["XXL", 69, 77]] },
    pant: { note: "Waist is measured all the way round. Everything else is laid flat.", cols: ["Size", "Waist", "Front rise", "Thigh", "Leg opening", "Inseam"],
      how: "Take your usual waist size. Allow ±2cm on every measurement.",
      rows: [["28", 71, 30, 31, 24, 81], ["30", 76, 30.5, 32, 24.5, 81], ["32", 81, 31, 33, 25, 81], ["34", 86, 31.5, 34, 25.5, 81], ["36", 91, 32, 35, 26, 81]] },
    sock: { note: "Sized by shoe size.", cols: ["Size", "UK shoe", "EU shoe"], noUnits: true, how: "",
      rows: [["UK 6–8", "6–8", "39–42"], ["UK 9–11", "9–11", "43–46"]] },
  };

  const CARE = {
    cotton: "Care: wash at 30°C inside out with similar colours. No bleach. Line dry or tumble dry low. Don't iron over the print.",
    cap: "Care: spot clean only.",
    knit: "Care: hand wash cold and dry flat.",
    sock: "Care: wash at 30°C. Don't tumble dry.",
  };

  // soldOut lists the sizes that have sold out in each colour. "views" are the photos that exist.
  // "short" is the one-word name used in lookbook captions. "tags" are extra words the search box
  // matches, like "trousers" for the cargos.
  const PRODUCTS = [
    { id: "test-card-hoodie", short: "Hoodie", tags: "hoody sweatshirt pullover fleece hood", name: "Test Card Hoodie", cat: "fleece", price: 85, views: ["front", "back"],
      colours: ["black", "ash"], sizes: TOPS, soldOut: { ash: ["XS", "XXL"] }, badge: "New", guide: "fleece", care: "cotton",
      blurb: "Heavyweight pullover with a box logo on the chest and full colour bars across the back.",
      fabric: "450gsm brushed-back fleece. Black: 100% cotton. Ash: 90% cotton, 10% polyester.",
      details: ["Boxy fit with a dropped shoulder", "Double-layer hood with flat drawcords", "Rib cuffs and hem", "Preshrunk"],
      deco: "Screen-printed chest logo. Seven-colour screen print on the back.",
      pairs: ["static-cargo", "broadcast-cap", "signal-socks"] },
    { id: "channel-00-crew", short: "Crew", tags: "sweatshirt jumper sweater crewneck fleece ch00", name: "Channel 00 Crewneck", cat: "fleece", price: 75, views: ["front", "back"],
      colours: ["ash", "olive"], sizes: TOPS, soldOut: { olive: ["XS"] }, badge: null, guide: "fleece", care: "cotton",
      blurb: "Brushed fleece crew with an oversized CH 00 across the chest and a strip of colour bars underneath.",
      fabric: "450gsm brushed-back fleece. Olive: 100% cotton. Ash: 90% cotton, 10% polyester.",
      details: ["Boxy fit with a dropped shoulder", "Thick rib collar, cuffs and hem", "Preshrunk"],
      deco: "Puff-printed CH 00 with a screen-printed colour-bar strip. Small logo on the back neck.",
      pairs: ["static-cargo", "interference-beanie", "colour-bars-tee"] },
    { id: "off-air-tee", short: "Tee", tags: "t-shirt tshirt top logo", name: "Off Air Tee", cat: "tees", price: 40, views: ["front", "back"],
      colours: ["white", "black", "blue"], sizes: TOPS, soldOut: { black: ["XS"], blue: ["XXL"] }, badge: null, guide: "tee", care: "cotton",
      blurb: "Boxy heavyweight tee with a small wordmark on the chest and a big logo box across the back.",
      fabric: "280gsm heavyweight jersey, 100% cotton.",
      details: ["Boxy and slightly cropped, with a dropped shoulder", "Thick rib collar", "Preshrunk"],
      deco: "One-colour screen print on the chest and back.",
      pairs: ["static-cargo", "broadcast-cap", "test-card-hoodie"] },
    { id: "colour-bars-tee", short: "Tee", tags: "t-shirt tshirt top color colours test card", name: "Colour Bars Tee", cat: "tees", price: 42, views: ["front", "back"],
      colours: ["white", "black"], sizes: TOPS, soldOut: { white: ["S", "M"] }, badge: "Low stock", guide: "tee", care: "cotton",
      blurb: "The full test card printed edge to edge across the chest in seven colours.",
      fabric: "280gsm heavyweight jersey, 100% cotton.",
      details: ["Boxy and slightly cropped, with a dropped shoulder", "Thick rib collar", "Preshrunk"],
      deco: "Seven-colour screen print on the chest. Small logo on the back neck.",
      pairs: ["static-cargo", "channel-00-crew", "broadcast-cap"] },
    { id: "static-cargo", short: "Cargos", tags: "trousers pants combat cargos bottoms", name: "Static Cargo Pant", cat: "bottoms", price: 95, views: ["front", "back"],
      colours: ["black", "olive"], sizes: WAIST, soldOut: { olive: ["28"] }, badge: "New", guide: "pant", care: "cotton",
      blurb: "Relaxed cotton ripstop cargos with bellows pockets and a woven colour-bar tab.",
      fabric: "100% cotton ripstop.",
      details: ["Relaxed straight leg, 81cm (32in) inseam", "Six pockets, including two bellows cargo pockets", "Drawcord ankles"],
      deco: "Woven colour-bar tab on the left cargo pocket.",
      pairs: ["test-card-hoodie", "off-air-tee", "signal-socks"] },
    { id: "broadcast-cap", short: "Cap", tags: "hat baseball cap", name: "Broadcast Cap", cat: "acc", price: 32, views: ["front"],
      colours: ["black", "ash"], sizes: ONE, soldOut: {}, badge: null, guide: null, care: "cap",
      blurb: "Unstructured six-panel cap with the logo box embroidered on the front.",
      fabric: "100% cotton twill.",
      details: ["Unstructured six-panel crown", "Adjustable self-fabric strap with an antique brass buckle", "One size, adjusts to fit 54–60cm"],
      deco: "Embroidered front logo.",
      pairs: ["test-card-hoodie", "off-air-tee", "static-cargo"] },
    { id: "interference-beanie", short: "Beanie", tags: "hat knit beanie", name: "Interference Beanie", cat: "acc", price: 28, views: ["front"],
      colours: ["black", "blue"], sizes: ONE, soldOut: { blue: ["One size"] }, badge: null, guide: null, care: "knit",
      blurb: "Rib-knit beanie with a deep fold-over cuff and a woven colour-bar label.",
      fabric: "100% acrylic rib knit.",
      details: ["Deep fold-over cuff", "One size"],
      deco: "Woven colour-bar label on the cuff.",
      pairs: ["channel-00-crew", "static-cargo", "signal-socks"] },
    { id: "signal-socks", short: "Socks", tags: "sock socks pack", name: "Signal Sock 3-Pack", cat: "acc", price: 18, views: ["front"],
      colours: ["mixed", "black"], sizes: SOCK, soldOut: {}, badge: null, guide: "sock", care: "sock",
      blurb: "Three pairs of cushioned crew socks with a colour-bar stripe under the cuff.",
      fabric: "80% cotton, 17% polyamide, 3% elastane.",
      details: ["Cushioned sole", "Ribbed cuff", "Mixed pack: one pair each in black, white and ash"],
      deco: "Jacquard-knitted colour-bar stripe.",
      pairs: ["static-cargo", "test-card-hoodie", "interference-beanie"] },
  ];

  // The hero TV's channels after CH 01 (the colour bars).
  const CHANNELS = [
    { n: "01", kind: "bars" },
    { n: "02", id: "test-card-hoodie", colour: "black", view: "back", set: "#4A4C55", word: "Hoodie" },
    { n: "03", id: "colour-bars-tee", colour: "white", view: "front", set: "#1426E0", word: "Tee" },
    { n: "04", id: "static-cargo", colour: "olive", view: "front", set: "#C9B800", word: "Cargo" },
    { n: "05", id: "channel-00-crew", colour: "ash", view: "front", set: "#B0009F", word: "Crew" },
    { n: "06", id: "off-air-tee", colour: "black", view: "back", set: "#00A9AE", word: "Tee" },
  ];

  // "Build the fit": where each piece lands on the flat lay (x/y/w in % of the stage),
  // where it flies in from (fx/fy/fr), and when (start/len as fractions of the scroll).
  const FIT = [
    { id: "test-card-hoodie", colour: "black", k: "Top", x: 34, y: 36, w: 52, r: -4, fx: -78, fy: -28, fr: -42, z: 3, start: 0.02, len: 0.3 },
    { id: "static-cargo", colour: "olive", k: "Bottom", x: 67, y: 60, w: 50, r: 3, fx: 80, fy: 34, fr: 36, z: 1, start: 0.2, len: 0.3 },
    { id: "broadcast-cap", colour: "black", k: "Head", x: 80, y: 17, w: 32, r: 10, fx: 50, fy: -80, fr: -60, z: 4, start: 0.38, len: 0.28 },
    { id: "signal-socks", colour: "mixed", k: "Feet", x: 24, y: 80, w: 34, r: -8, fx: -60, fy: 76, fr: 48, z: 2, start: 0.54, len: 0.28 },
  ];

  const DROP_02_PIECES = [
    ["07", "Interference Zip Hoodie", 95],
    ["08", "Vertical Hold Tee", 42],
    ["09", "Tracking Error Track Pant", 85],
    ["10", "Ghosting Long Sleeve", 48],
  ];

  // Lookbook. Photos live in assets/img/lookbook as <img>-<width>.webp at full and half width
  // (tools/build-lookbook.cjs makes them). "pieces" are [product id, colour]. "pos" is the part of a
  // wide photo to keep when it's cropped to portrait. "model" is the model's height and the size they
  // wear in each piece; product pages show it next to the on-model photo.
  // These are AI-generated preview images. Reshoot with real models before launch and use their real
  // heights and sizes.
  const LOOKS = [
    { n: "01", img: "look-01", w: 1536, h: 1024, pos: "51% 50%", title: "Test card wall",
      alt: "Seen from behind, a model in the black Test Card Hoodie faces a wall of old TVs showing colour bars, the same bars printed across the hoodie's back. Olive Static Cargo Pants.",
      pieces: [["test-card-hoodie", "black"], ["static-cargo", "olive"]] },
    { n: "02", img: "look-04", w: 960, h: 1280, title: "Off air",
      alt: "Close-up of a model lit by a TV full of static, wearing the black Interference Beanie with its woven colour-bar label.",
      pieces: [["interference-beanie", "black"]] },
    { n: "03", img: "look-02", w: 960, h: 1280, title: "Control room",
      alt: "A model stands in a TV control room in the white Colour Bars Tee, black Static Cargo Pants and the black Broadcast Cap.",
      pieces: [["colour-bars-tee", "white"], ["static-cargo", "black"], ["broadcast-cap", "black"]] },
    { n: "04", img: "look-03", w: 960, h: 1280, title: "After dark",
      alt: "Two friends laughing on a rooftop at night above the London skyline. One wears the Channel 00 Crewneck in Ash, the other the Off Air Tee in Signal Blue, both with black Static Cargo Pants.",
      pieces: [["channel-00-crew", "ash"], ["off-air-tee", "blue"], ["static-cargo", "black"]] },
    { n: "05", img: "fit-01", w: 960, h: 1280, title: "Fit check: hoodie", fitCheck: true,
      alt: "Studio fit photo of a 185cm model in the black Test Card Hoodie, size L, and olive Static Cargo Pants, size 32.",
      model: { height: 185, wears: { "test-card-hoodie": "L", "static-cargo": "32" } },
      pieces: [["test-card-hoodie", "black"], ["static-cargo", "olive"]] },
    { n: "06", img: "fit-02", w: 960, h: 1280, title: "Fit check: tee", fitCheck: true,
      alt: "Studio fit photo of a 170cm model in the black Off Air Tee, size S, and black Static Cargo Pants, size 28.",
      model: { height: 170, wears: { "off-air-tee": "S", "static-cargo": "28" } },
      pieces: [["off-air-tee", "black"], ["static-cargo", "black"]] },
  ];

  return { BRAND, SITE_URL, CHECKOUT, DROP_02, SHIP, BANK_HOLIDAYS, COLOURS, CATS, GUIDES, CARE, PRODUCTS, CHANNELS, FIT, DROP_02_PIECES, LOOKS };
})();
