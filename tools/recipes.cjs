// What to render: each product's blank photo, colourways and prints.
// Print positions are fractions of the garment's outline: cx/cy = centre, w = width.
const BRAND = "PLUGE";

const COLOURS = { black: "#151517", white: "#F4F4F1", ash: "#A3A5AA", olive: "#5A5D44", blue: "#2230FF" };
// Ink that reads on each garment colour.
const INK = { black: "#F2F2F0", white: "#111114", ash: "#111114", olive: "#EDEDE6", blue: "#F4F4F1" };

const PRODUCTS = [
  { id: "test-card-hoodie", blank: "hoodie", colours: ["black", "ash"], views: {
    front: c => [{ kind: "osd", cx: 0.5, cy: 0.47, w: 0.22, box: INK[c], ink: COLOURS[c] }],
    back: () => [{ kind: "barsOsd", cx: 0.5, cy: 0.52, w: 0.44 }] } },
  { id: "channel-00-crew", blank: "crew", colours: ["ash", "olive"], views: {
    front: c => [{ kind: "ch00", cx: 0.5, cy: 0.33, w: 0.36, ink: INK[c], finish: "puff" }],
    back: c => [{ kind: "wordmark", cx: 0.5, cy: 0.1, w: 0.13, ink: INK[c] }] } },
  { id: "off-air-tee", blank: "tee", colours: ["white", "black", "blue"], views: {
    front: c => [{ kind: "wordmark", cx: 0.5, cy: 0.25, w: 0.2, ink: INK[c] }],
    back: c => [{ kind: "osd", cx: 0.5, cy: 0.3, w: 0.42, box: INK[c], ink: COLOURS[c] }] } },
  { id: "colour-bars-tee", blank: "tee", colours: ["white", "black"], views: {
    front: () => [{ kind: "bars", cx: 0.5, cy: 0.37, w: 0.34 }],
    back: c => [{ kind: "wordmark", cx: 0.5, cy: 0.12, w: 0.13, ink: INK[c] }] } },
  { id: "static-cargo", blank: "cargo", colours: ["black", "olive"], views: {
    front: () => [{ kind: "tab", cx: 0.905, cy: 0.4, w: 0.085, finish: "woven" }],
    back: () => [] } },
  { id: "broadcast-cap", blank: "cap", colours: ["black", "ash"], views: {
    front: c => [{ kind: "osd", cx: 0.47, cy: 0.4, w: 0.22, box: INK[c], ink: COLOURS[c], finish: "embroidery", rot: -2 }] } },
  { id: "interference-beanie", blank: "beanie", colours: ["black", "blue"], views: {
    front: () => [{ kind: "tab", cx: 0.5, cy: 0.74, w: 0.17, finish: "woven" }] } },
  { id: "signal-socks", blank: "socks", colours: ["mixed", "black"], sockBand: [0.3, 0.355], views: {
    front: () => [] } },
];

const SIZES = [{ suffix: "", w: 1000, h: 1200 }, { suffix: "-sm", w: 500, h: 600 }];

function recipes() {
  const list = [];
  for (const p of PRODUCTS) for (const c of p.colours) for (const [view, prints] of Object.entries(p.views)) {
    const colours = c === "mixed" ? [COLOURS.black, COLOURS.white, COLOURS.ash] : [COLOURS[c]];
    list.push({ name: `${p.id}-${c}-${view}`, blank: `${p.blank}-${view}`, brand: BRAND, colours, prints: prints(c), sockBand: p.sockBand, sizes: SIZES });
  }
  return list;
}
module.exports = { recipes };
