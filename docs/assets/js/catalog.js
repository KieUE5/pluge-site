// PLUGE shop catalogue: edit this file to change products, prices, stock, sizes and delivery.
// Product photos live in assets/img/products as <id>-<colour>-<view>.webp (1000x1200)
// and <id>-<colour>-<view>-sm.webp (500x600). Rebuild them with tools/build-images.cjs.
window.PLUGE = (() => {
  const BRAND = "PLUGE"; // Placeholder brand name. Also change it in index.html (title, logo, footer).

  // Where the site lives, with a trailing slash. Used for share links, product page links and the sitemap.
  // After changing it (for example to your own domain), run: node tools/build-pages.cjs
  const SITE_URL = "https://kieue5.github.io/pluge-site/";

  // Your business details. UK law requires them on any website that sells. They fill in the footer
  // and the terms, returns and privacy pages; anything left empty shows as [square brackets].
  // After changing them, the pages are rebuilt automatically when you push (see README).
  const COMPANY = {
    legalName: "",       // your company's registered name, e.g. "Pluge Clothing Ltd"
    companyNumber: "",   // from Companies House
    office: "",          // registered office address, on one line
    returnsAddress: "",  // where returns go, if it isn't the registered office
    vat: "",             // e.g. "GB 123 4567 89"; leave empty if you aren't VAT registered
    email: "pluge.shop@outlook.com", // customer service email
    phone: "",           // optional
  };

  // Customer accounts: sign in, the same bag and saved pieces on every device, and order history.
  // Set up a free Supabase project (see README, "Customer accounts"), then paste its Project URL and its
  // public "anon" key here. The anon key is meant to be public: the database's own rules keep each
  // customer's data private. While these are empty, the account panel explains that it's a preview.
  const ACCOUNTS = {
    supabaseUrl: "",  // e.g. "https://abcdefghijkl.supabase.co"
    supabaseKey: "",  // Project Settings > API > anon public key
  };

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

  // Delivery. Every piece is made to order by Printful (usually 2–5 working days), then posted (usually
  // 2–5 working days in the UK). "days" is the whole wait in working days, used for the dates the shop
  // shows; "make" is Printful's part of it. Set the same price in Shopify under Settings > Shipping and delivery.
  const SHIP = {
    std: { name: "UK delivery", fee: 4.99, freeOver: 75, make: [2, 5], days: [5, 10] },
  };

  // England and Wales bank holidays, skipped when estimating delivery dates.
  const BANK_HOLIDAYS = [
    "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04", "2026-05-25", "2026-08-31", "2026-12-25", "2026-12-28",
    "2027-01-01", "2027-03-26", "2027-03-29", "2027-05-03", "2027-05-31", "2027-08-30", "2027-12-27", "2027-12-28",
  ];

  // Colours. "name" must match the colour name in Printful exactly, because that's how the site finds
  // each Shopify variant. The keys (ash, olive...) are only used in photo file names.
  const COLOURS = {
    black: { name: "Black", hex: "#151517" },
    white: { name: "White", hex: "#F4F4F1" },
    ash: { name: "Sport Grey", hex: "#9EA0A5" },
    olive: { name: "Military Green", hex: "#545A3E" },
    navy: { name: "Navy", hex: "#1E2435" },
    khaki: { name: "Khaki", hex: "#B4A27E" },
  };

  // Size names must also match Printful's exactly.
  const TOPS = ["S", "M", "L", "XL", "2XL", "3XL"];
  const BOTTOMS = ["S", "M", "L", "XL", "2XL"];
  const ONE = ["One size"];
  const SOCK = ["S", "M", "L"];

  const CATS = [
    { id: "all", label: "All" },
    { id: "fleece", label: "Hoodies & Sweats" },
    { id: "tees", label: "Tees" },
    { id: "bottoms", label: "Bottoms" },
    { id: "acc", label: "Accessories" },
  ];

  const TOP_HOW = "Measured flat: straight across the chest 2.5cm below the armpits, and from the highest point of the shoulder to the hem. These are the garment maker's measurements; allow ±2.5cm.";
  // The garment makers' size charts, converted to cm. Check them against Printful's size guide for each
  // product and update them if Printful's differ.
  const GUIDES = {
    fleece: { note: "Gildan 18500 / 18000 measurements, laid flat.", cols: ["Size", "Chest (pit to pit)", "Length"], finder: true, how: TOP_HOW,
      rows: [["S", 51, 69], ["M", 56, 71], ["L", 61, 74], ["XL", 66, 76], ["2XL", 71, 79], ["3XL", 76, 81]] },
    tee: { note: "Comfort Colors 1717 measurements, laid flat.", cols: ["Size", "Chest (pit to pit)", "Length"], finder: true, how: TOP_HOW,
      rows: [["S", 44.5, 67.5], ["M", 49.5, 71], ["L", 54, 74.5], ["XL", 58.5, 78], ["2XL", 63.5, 80], ["3XL", 68.5, 82.5]] },
  };

  const CARE = {
    cotton: "Care: wash at 30°C inside out with similar colours. No bleach. Tumble dry low or line dry. Don't iron over the print or dry clean.",
    cap: "Care: spot clean only.",
    knit: "Care: hand wash cold and dry flat.",
    sock: "Care: wash at 30°C inside out. Don't tumble dry.",
  };

  // The range, made to order by Printful. "printful" is the Printful product to choose for each one.
  // Nothing sells out with print-on-demand, so soldOut stays empty unless Printful stops a size or colour
  // (once Shopify is connected the site checks that for itself).
  // "short" is the one-word name used in lookbook captions. "tags" are extra words the search box
  // matches, like "trousers" for the joggers.
  const PRODUCTS = [
    { id: "test-card-hoodie", short: "Hoodie", tags: "hoody sweatshirt pullover fleece hood", name: "Test Card Hoodie", cat: "fleece", price: 55, views: ["front", "back"],
      printful: "Unisex Heavy Blend Hoodie (Gildan 18500)",
      colours: ["black", "ash"], sizes: TOPS, soldOut: {}, badge: "New", guide: "fleece", care: "cotton",
      blurb: "Pullover hoodie with a box logo on the chest and full colour bars printed across the back.",
      fabric: "8oz (270gsm) fleece, 50% cotton and 50% polyester, soft on the inside.",
      details: ["Classic relaxed fit", "Double-lined hood with a matching drawcord", "Front pouch pocket", "Rib cuffs and hem"],
      deco: "Chest logo and back print, printed when you order.",
      pairs: ["static-joggers", "broadcast-cap", "signal-socks"] },
    { id: "channel-00-crew", short: "Crew", tags: "sweatshirt jumper sweater crewneck fleece ch00 olive", name: "Channel 00 Crewneck", cat: "fleece", price: 50, views: ["front", "back"],
      printful: "Unisex Crew Neck Sweatshirt (Gildan 18000)",
      colours: ["ash", "olive"], sizes: TOPS, soldOut: {}, badge: null, guide: "fleece", care: "cotton",
      blurb: "Crewneck sweatshirt with an oversized CH 00 across the chest and a strip of colour bars underneath.",
      fabric: "8oz (270gsm) fleece, 50% cotton and 50% polyester, soft on the inside.",
      details: ["Classic relaxed fit", "Rib collar, cuffs and hem"],
      deco: "Front print and a small logo on the back of the neck, printed when you order.",
      pairs: ["static-joggers", "interference-beanie", "colour-bars-tee"] },
    { id: "off-air-tee", short: "Tee", tags: "t-shirt tshirt top logo", name: "Off Air Tee", cat: "tees", price: 30, views: ["front", "back"],
      printful: "Unisex Garment-Dyed Heavyweight T-Shirt (Comfort Colors 1717)",
      colours: ["white", "black"], sizes: TOPS, soldOut: {}, badge: null, guide: "tee", care: "cotton",
      blurb: "Heavyweight garment-dyed tee with a small wordmark on the chest and a big logo box across the back.",
      fabric: "6.1oz (207gsm) 100% ring-spun cotton, garment-dyed for a soft, lived-in feel. The colour of each tee varies a little.",
      details: ["Relaxed fit", "Garment-dyed, so it's soft from the first wear"],
      deco: "Chest and back print, printed when you order.",
      pairs: ["static-joggers", "broadcast-cap", "test-card-hoodie"] },
    { id: "colour-bars-tee", short: "Tee", tags: "t-shirt tshirt top color colours test card", name: "Colour Bars Tee", cat: "tees", price: 32, views: ["front", "back"],
      printful: "Unisex Garment-Dyed Heavyweight T-Shirt (Comfort Colors 1717)",
      colours: ["white", "black"], sizes: TOPS, soldOut: {}, badge: null, guide: "tee", care: "cotton",
      blurb: "The full test card printed across the chest in seven colours.",
      fabric: "6.1oz (207gsm) 100% ring-spun cotton, garment-dyed for a soft, lived-in feel. The colour of each tee varies a little.",
      details: ["Relaxed fit", "Garment-dyed, so it's soft from the first wear"],
      deco: "Seven-colour chest print and a small logo on the back of the neck, printed when you order.",
      pairs: ["static-joggers", "channel-00-crew", "broadcast-cap"] },
    { id: "static-joggers", short: "Joggers", tags: "trousers pants sweatpants tracksuit bottoms", name: "Static Joggers", cat: "bottoms", price: 48, views: ["front", "back"],
      printful: "Unisex Fleece Sweatpants (Cotton Heritage M7580), embroidered",
      colours: ["black"], sizes: BOTTOMS, soldOut: {}, badge: "New", guide: null, care: "cotton",
      blurb: "Fleece joggers with an embroidered colour-bar tab on the left thigh.",
      fabric: "8.5oz (288gsm) fleece, 65% cotton and 35% polyester.",
      details: ["Relaxed, tapered leg", "Elastic waistband with a drawcord", "Side pockets", "Ribbed ankle cuffs", "Take your usual size"],
      deco: "Embroidered colour-bar tab on the left thigh.",
      pairs: ["test-card-hoodie", "off-air-tee", "signal-socks"] },
    { id: "broadcast-cap", short: "Cap", tags: "hat baseball cap dad", name: "Broadcast Cap", cat: "acc", price: 26, views: ["front"],
      printful: "Classic Dad Hat (Yupoong 6245CM), embroidered",
      colours: ["black", "khaki"], sizes: ONE, soldOut: {}, badge: null, guide: null, care: "cap",
      blurb: "Low-profile six-panel dad hat with the logo box embroidered on the front.",
      fabric: "100% cotton twill.",
      details: ["Unstructured, low-profile crown", "Adjustable strap with a metal buckle", "One size"],
      deco: "Embroidered front logo.",
      pairs: ["test-card-hoodie", "off-air-tee", "static-joggers"] },
    { id: "interference-beanie", short: "Beanie", tags: "hat knit beanie", name: "Interference Beanie", cat: "acc", price: 22, views: ["front"],
      printful: "Cuffed Beanie (Yupoong 1501KC), embroidered",
      colours: ["black", "navy"], sizes: ONE, soldOut: {}, badge: null, guide: null, care: "knit",
      blurb: "Cuffed rib-knit beanie with colour bars embroidered on the cuff.",
      fabric: "100% acrylic rib knit.",
      details: ["Fold-over cuff", "One size"],
      deco: "Embroidered colour bars on the cuff.",
      pairs: ["channel-00-crew", "static-joggers", "signal-socks"] },
    { id: "signal-socks", short: "Socks", tags: "sock socks", name: "Signal Socks", cat: "acc", price: 14, views: ["front"],
      printful: "Socks (all-over print)",
      colours: ["black"], sizes: SOCK, soldOut: {}, badge: null, guide: null, care: "sock",
      blurb: "Black crew socks with a colour-bar stripe printed all the way round under the cuff.",
      fabric: "Polyester-blend knit, printed all over so the colours stay bright.",
      details: ["Crew length", "Ribbed cuff", "One pair, in sizes S, M and L"],
      deco: "Printed all over when you order.",
      pairs: ["static-joggers", "test-card-hoodie", "interference-beanie"] },
  ];

  // The hero TV's channels after CH 01 (the colour bars).
  const CHANNELS = [
    { n: "01", kind: "bars" },
    { n: "02", id: "test-card-hoodie", colour: "black", view: "back", set: "#4A4C55", word: "Hoodie" },
    { n: "03", id: "colour-bars-tee", colour: "white", view: "front", set: "#1426E0", word: "Tee" },
    { n: "04", id: "static-joggers", colour: "black", view: "front", set: "#C9B800", word: "Joggers" },
    { n: "05", id: "channel-00-crew", colour: "ash", view: "front", set: "#B0009F", word: "Crew" },
    { n: "06", id: "off-air-tee", colour: "black", view: "back", set: "#00A9AE", word: "Tee" },
  ];

  // "Build the fit": where each piece lands on the flat lay (x/y/w in % of the stage),
  // where it flies in from (fx/fy/fr), and when (start/len as fractions of the scroll).
  const FIT = [
    { id: "test-card-hoodie", colour: "black", k: "Top", x: 34, y: 36, w: 52, r: -4, fx: -78, fy: -28, fr: -42, z: 3, start: 0.02, len: 0.3 },
    { id: "static-joggers", colour: "black", k: "Bottom", x: 67, y: 60, w: 50, r: 3, fx: 80, fy: 34, fr: 36, z: 1, start: 0.2, len: 0.3 },
    { id: "broadcast-cap", colour: "black", k: "Head", x: 80, y: 17, w: 32, r: 10, fx: 50, fy: -80, fr: -60, z: 4, start: 0.38, len: 0.28 },
    { id: "signal-socks", colour: "black", k: "Feet", x: 24, y: 80, w: 34, r: -8, fx: -60, fy: 76, fr: 48, z: 2, start: 0.54, len: 0.28 },
  ];

  const DROP_02_PIECES = [
    ["07", "Interference Zip Hoodie", 60],
    ["08", "Vertical Hold Tee", 32],
    ["09", "Tracking Error Joggers", 50],
    ["10", "Ghosting Long Sleeve", 36],
  ];

  // Lookbook. Photos live in assets/img/lookbook as <img>-<width>.webp at full and half width
  // (tools/build-lookbook.cjs makes them). "pieces" are [product id, colour]. "pos" is the part of a
  // wide photo to keep when it's cropped to portrait. "model" is the model's height and the size they
  // wear in each piece; product pages show it next to the on-model photo. Only pieces we sell are listed;
  // the cargo trousers in some photos are styling.
  // These are AI-generated preview images. Reshoot with real models before launch and use their real
  // heights and sizes.
  const LOOKS = [
    { n: "01", img: "look-01", w: 1536, h: 1024, pos: "51% 50%", title: "Test card wall",
      alt: "Seen from behind, a model in the black Test Card Hoodie faces a wall of old TVs showing colour bars, the same bars printed across the hoodie's back. Olive Static Cargo Pants.",
      pieces: [["test-card-hoodie", "black"]] },
    { n: "02", img: "look-04", w: 960, h: 1280, title: "Off air",
      alt: "Close-up of a model lit by a TV full of static, wearing the black Interference Beanie with its woven colour-bar label.",
      pieces: [["interference-beanie", "black"]] },
    { n: "03", img: "look-02", w: 960, h: 1280, title: "Control room",
      alt: "A model stands in a TV control room in the white Colour Bars Tee, black Static Cargo Pants and the black Broadcast Cap.",
      pieces: [["colour-bars-tee", "white"], ["broadcast-cap", "black"]] },
    { n: "04", img: "look-03", w: 960, h: 1280, title: "After dark",
      alt: "Two friends laughing on a rooftop at night above the London skyline. One wears the Channel 00 Crewneck in Ash, the other the Off Air Tee in Signal Blue, both with black Static Cargo Pants.",
      pieces: [["channel-00-crew", "ash"]] },
    { n: "05", img: "fit-01", w: 960, h: 1280, title: "Fit check: hoodie", fitCheck: true,
      alt: "Studio fit photo of a 185cm model in the black Test Card Hoodie, size L, and olive Static Cargo Pants, size 32.",
      model: { height: 185, wears: { "test-card-hoodie": "L" } },
      pieces: [["test-card-hoodie", "black"]] },
    { n: "06", img: "fit-02", w: 960, h: 1280, title: "Fit check: tee", fitCheck: true,
      alt: "Studio fit photo of a 170cm model in the black Off Air Tee, size S, and black Static Cargo Pants, size 28.",
      model: { height: 170, wears: { "off-air-tee": "S" } },
      pieces: [["off-air-tee", "black"]] },
  ];

  return { BRAND, SITE_URL, COMPANY, ACCOUNTS, CHECKOUT, DROP_02, SHIP, BANK_HOLIDAYS, COLOURS, CATS, GUIDES, CARE, PRODUCTS, CHANNELS, FIT, DROP_02_PIECES, LOOKS };
})();
