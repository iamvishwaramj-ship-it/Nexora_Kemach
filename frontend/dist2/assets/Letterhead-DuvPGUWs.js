import { j as e } from "./index-Da-Ih398.js"; import { k as s } from "./kemach-PXgjVHv5.js"; import { b as i } from "./bobcat-Bgog_Q0D.js"; import { v as r } from "./indus-logo-BBHEDWcL.js"; const h = "/assets/Indo-r-rvbtxW.png", l = "/assets/isg-DnOYM1nv.png", d = "/assets/qr-BuNhuJWU.png", c = 23, m = 23.2, g = 0, p = m + g, u = "#C1121B", f = "#1A1A1A", b = "4%", x = .5, w = { headerAbove: 1.5, headerBelow: 0, footerAbove: 2, footerBelow: 1.5 }, v = "Reg. Off: B+77, Parsn Palm Legend, Ondipudur, Coimbatore - 641016. CIN : U51900TZ2020PTC033966", E = "KEMACH Equipments Pvt. Ltd.,", k = ["Swalih Plaza, No-15/340 A, Karikode, Okkal", "Post, ERNAKULAM - 683550, Kerala, India"], A = "info@kemach.in", N = "Palakkad, Kozhikode, Kannur, Wayanad", _ = 20, y = 10, j = [{ src: i, alt: "Bobcat", width: 30 }, { src: h, alt: "Indo Farm Equipment Limited", width: 36 }, { src: r, alt: "Indus", width: 17, height: 11 }, { src: l, alt: "ISG International", width: 19 }], T = "http://www.kemachequipments.com/"; function n() { return e.jsxs("div", { className: "lh-rule", children: [e.jsx("span", { className: "lh-rule-red" }), e.jsx("span", { className: "lh-rule-dark" })] }) } function C({ company: t }) { return e.jsxs("div", { className: "lh-band lh-header", children: [e.jsxs("div", { className: "lh-header-row", children: [e.jsx("img", { className: "lh-logo", src: s, alt: "KEMACH" }), e.jsxs("div", { className: "lh-office", children: [e.jsx("div", { className: "lh-office-name", children: E }), t != null && t.address ? e.jsx("div", { className: "lh-office-addr", children: t.address }) : k.map(a => e.jsx("div", { className: "lh-office-addr", children: a }, a))] }), e.jsx("img", { className: "lh-qr", src: d, alt: T })] }), e.jsx(n, {})] }) } function P() { return e.jsx("img", { className: "lh-watermark", src: s, alt: "", "aria-hidden": "true" }) } function D({ company: t }) { return e.jsxs("div", { className: "lh-band lh-footer", children: [e.jsx(n, {}), e.jsx("div", { className: "lh-reg", children: v }), e.jsxs("div", { className: "lh-contact", children: [e.jsxs("span", { children: ["Email : ", (t == null ? void 0 : t.email) || A, ","] }), e.jsxs("span", { className: "lh-branches", children: ["Branches: ", N] })] }), e.jsx("div", { className: "lh-partners", children: j.map(a => e.jsx("img", { src: a.src, alt: a.alt, style: { width: `${a.width}mm`, ...a.height ? { height: `${a.height}mm`, objectFit: "cover" } : null } }, a.alt)) })] }) } function I(t, a) {
   const o = { ...w, ...a }; return `
    /* The bands are positioned against the page box, so the page must
       establish a containing block. Without this they'd anchor to the nearest
       positioned ancestor — in print, usually the whole document — and every
       copy's letterhead would stack on page one. */
    ${t} { position: relative; }

    /* Browsers strip background colours and images when printing unless told
       otherwise. The red rules and the partner logos ARE the letterhead, so
       this is not optional here. */
    .lh-band, .lh-watermark, .lh-rule span, .lh-partners img {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .lh-band {
      position: absolute;
      left: 0; right: 0;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }
    /* An absolutely positioned box is laid out against its ancestor's PADDING
       box, not its content box — so top:0 is the outer edge of the page's
       padding-top, and a band of exactly LETTERHEAD_*_MM covers precisely the
       strip the page reserved for it. No offset correction is needed, and
       adding one would push the band off the sheet. */
    /* Content pinned to the TOP of the band with the slack falling below the
       rule, so the logo sits at the head of the sheet and the gap lands
       between the rule and the document title. Justifying to the end instead
       pushes the whole masthead down and opens a dead strip above it. */
    .lh-header {
      top: 0;
      height: ${c}mm;
      justify-content: flex-start;
      padding-top: 1mm;
    }
    /* No padding-top here any more — the gap above the footer's rule is the
       rule's own padding now (rule.footerAbove), so all four gaps around the
       two rules are set in one place. */
    .lh-footer {
      bottom: 0;
      height: ${p}mm;
      justify-content: flex-start;
    }

    /* Likewise: the gap between the masthead and the header rule belongs to
       the rule (rule.headerAbove), not to this row. */
    .lh-header-row {
      display: flex;
      align-items: center;
      gap: 6mm;
    }
    .lh-logo { width: 52mm; height: auto; flex-shrink: 0; }
    /* The company block is centred on the sheet, not merely placed between the
       logo and the QR — flex:1 on both sides would drift it left as soon as
       the logo and QR differed in width. */
    .lh-office { flex: 1; text-align: center; line-height: 1.35; }
    .lh-office-name { font-weight: 700; font-size: ${_}px; }
    .lh-office-addr { font-size: ${y}px; }
    /* image-rendering: pixelated — a QR is a grid of hard-edged squares, and
       smooth interpolation on the way down to 16mm blurs the module edges into
       each other, which is exactly the failure a scanner cannot recover from.
       Nearest-neighbour keeps them square. */
    .lh-qr {
      width: 16mm; height: 16mm; flex-shrink: 0;
      image-rendering: pixelated;
    }

    /* box-sizing: content-box is deliberate and load-bearing. index.css sets
       border-box on every element, under which the padding added below would
       be taken OUT of the 1.1mm height — at rule.headerAbove: 1.5 the rule
       would compute to a negative content height, clamp to zero, and the line
       would simply disappear from the printed sheet. With content-box the
       height stays the thickness of the line and the padding is clear space
       around it, which is what these variables are supposed to mean. */
    .lh-rule {
      display: flex;
      align-items: stretch;
      box-sizing: content-box;
      height: ${x}mm;
      gap: 1.5mm;
      /* The band is a fixed-height column flexbox, so if its contents ever
         come to more than the band holds — a long company address wrapping to
         a third line, a taller partner logo, or simply generous spacing set
         above — the browser shrinks the flex items to fit. At 1.1mm the rule
         is by far the smallest item, so it is the first thing squashed, and it
         goes to zero: the line disappears from the sheet while everything
         around it still looks right. Pinning it means an overrun pushes the
         band's contents instead, which is visible and diagnosable. */
      flex-shrink: 0;
    }
    .lh-header .lh-rule { padding: ${o.headerAbove}mm 0 ${o.headerBelow}mm; }
    .lh-footer .lh-rule { padding: ${o.footerAbove}mm 0 ${o.footerBelow}mm; }
    .lh-rule-red { flex: 1; background: ${u}; }
    .lh-rule-dark { width: ${b}; background: ${f}; }

    /* Its top gap now comes from the footer rule's padding-bottom above. */
    .lh-reg { text-align: center; font-weight: 700; font-size: 9.5px; }
    .lh-contact {
      display: flex; justify-content: center; gap: 6mm;
      font-size: 9px; padding-top: 0.5mm;
    }
    .lh-partners {
      display: flex; align-items: center; justify-content: center;
      gap: 8mm; padding-top: 1.5mm;
    }
    .lh-partners img { height: auto; object-fit: contain; }

    /* Centred on the page box — the body scrolls past it, it does not move. */
    .lh-watermark {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 60%;
      /* Greyscale first: the mark is a solid red block, and simply
         fading it leaves a pink wash across the figures rather than the
         neutral ghost the stationery shows. */
      filter: grayscale(1);
      opacity: 0.10;
      z-index: 0;
      pointer-events: none;
    }
    /* Everything the page draws sits above the watermark. Without a stacking
       context of their own the ruled tables would be painted under it and the
       grid lines would come out grey.
       The bands are excluded deliberately: this selector is more specific than
       .lh-band, so including them would override their absolute positioning
       with relative and drop both bands back into the page's flex flow. */
    ${t} > *:not(.lh-watermark):not(.lh-band) { position: relative; z-index: 1; }
    .lh-band { z-index: 2; }
  `} export { P as L, C as a, D as b, c, p as d, I as l };
