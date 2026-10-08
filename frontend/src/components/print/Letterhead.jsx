import React from 'react';
import kemachLogo from '../../../assets/kemach.png';
import qrCode from '../../../assets/qr.png';
import bobcatLogo from '../../../assets/bobcat.png';
import indoFarmLogo from '../../../assets/Indo.png';
import indusRockToolLogo from '../../../assets/indus-logo.png';
import isgLogo from '../../../assets/isg.png';

// The Kemach letterhead, drawn into the document rather than assumed to be
// pre-printed on the paper.
//
// The print components used to leave the top and bottom bands blank and rely
// on stationery already carrying the branding. That only works when someone
// remembers to load the right paper — email a PDF, or print on plain A4, and
// the invoice arrives with two unexplained empty strips. Rendering the
// letterhead means one artefact is correct everywhere, and the reserved bands
// finally hold what they were reserved for.
//
// Three pieces, all absolutely positioned inside a page that is
// `position: relative`, so they occupy the reserved bands without taking part
// in the page's flex layout and pushing the body around:
//
//   LetterheadHeader     logo, company block, optional QR, red rule
//   LetterheadWatermark  the faint wordmark behind the body
//   LetterheadFooter     red rule, registered-office line, contact line,
//                        partner-logo strip
//
// --- Band heights ----------------------------------------------------------
// Millimetres, matching how paper is specified. A print component reserves
// these as padding on its page so the body is compressed into what's left; the
// bands are then drawn on top. Change them here and every document that uses
// this letterhead follows — but re-check a test print, since shrinking a band
// gives the body more room and can pull a second page back to one.
export const LETTERHEAD_TOP_MM = 23;

// The footer band is sized rather than guessed, so the white space under it
// is a number you can set instead of whatever happened to be left over.
//
// FOOTER_CONTENT_MM is the measured height of everything the footer draws —
// partner-logo strip (with its own padding-top) + rule (with its spacing) +
// registered office + contact — at the sizes set in this file. The partner
// logos (Bobcat/Indo Farm/Indus Rock Tool/ISG) were removed for a time, which
// dropped this to 9.5mm; they are back by request, so this returns to the
// 23.2mm it measured at before (~12.6mm row + 1.5mm padding-top on top of the
// 9.5mm the rule/reg-office/contact take). Re-measure in Chromium if you
// change the rule spacing or a font size — this value is an estimate, not a
// fresh measurement.
const FOOTER_CONTENT_MM = 23.2;

// Height of the partner-logo row itself (the four marks below), in
// millimetres — separate from FOOTER_CONTENT_MM above so the row's own size
// and its clear space above are each one number.
const PARTNER_LOGOS_ROW_MM = 12.6;
// Clear space between the footer's contact line and the partner-logo row.
const PARTNER_LOGOS_PADDING_TOP_MM = 1.5;

// The clear space between the bottom of the footer's contact line and the
// edge of the printed area. This is the one to turn down if the footer
// should sit closer to the foot of the sheet. Note the sheet ALSO carries the
// 8mm @page margin below this, which is real unprintable-edge allowance — so
// the visible white under the footer is this value plus that margin.
export const FOOTER_SPACE_BELOW_LOGOS_MM = 0;

// Band height follows from the two above; nothing else should set it.
//
// This had been hardcoded to 0 instead of actually being derived from the
// two constants above, so .sinv-page reserved zero padding-bottom for the
// footer and .lh-footer's own box was zero-height at the page's bottom edge.
// The footer's real content (~23.2mm) then rendered on top of / below that
// zero-height box with no room reserved for it in the body's layout, so it
// never sat flush at the true bottom of the printed page — this is what
// pushed it out of place in print.
export const LETTERHEAD_BOTTOM_MM = FOOTER_CONTENT_MM + FOOTER_SPACE_BELOW_LOGOS_MM;

// The brand red on the rules, sampled from the logo.
const RULE_RED = '#C1121B';
// The short dark segment that closes each rule at the right edge, as on the
// printed stationery.
const RULE_DARK = '#1A1A1A';
const RULE_DARK_WIDTH = '4%';
// Thickness of the rule itself, independent of the space around it below.
const RULE_THICKNESS_MM = 0.5;

// --- Rule spacing ----------------------------------------------------------
// The clear space above and below the brand rule, in millimetres, set
// separately for the header and the footer. Four independent numbers, because
// the two rules do different jobs: the header's separates the masthead from
// the document title, the footer's separates the body from the registered
// office line, and nudging one should never move the other.
//
// These are the ONLY place that spacing is expressed. It used to be smeared
// across three unrelated rules — .lh-header-row's padding-bottom, .lh-footer's
// padding-top and .lh-reg's padding-top — so moving a rule a millimetre meant
// finding which neighbour happened to own the gap. The values below reproduce
// exactly what those three used to produce.
//
// A print component can override any of them per document by passing them to
// letterheadStyles() — see SalesInvoicePrintable.jsx.
export const RULE_SPACING_MM = {
  headerAbove: 3.5,
  headerBelow: 0,
  footerAbove: 2,
  footerBelow: 1.5,
};

// Fixed furniture. These belong to the STATIONERY, not to whichever company
// record happens to be loaded — the registered office and CIN are Kemach's
// regardless of which branch raised the document — so they're constants with
// company-master overrides only where a document could legitimately differ.
const REG_OFFICE = 'Reg. Off: B+77, Parsn Palm Legend, Ondipudur, Coimbatore - 641016. CIN : U51900TZ2020PTC033966';
const HEAD_OFFICE_NAME = 'KEMACH Equipments Pvt. Ltd.,';
const HEAD_OFFICE_ADDRESS = [
  'Swalih Plaza, No-15/340 A, Karikode, Okkal',
  'Post, ERNAKULAM - 683550, Kerala, India',
];
const CONTACT_EMAIL = 'info@kemach.in';
const BRANCHES = 'Palakkad, Kozhikode, Kannur, Wayanad';

// --- Masthead type ---------------------------------------------------------
// Pixels, because these are type sizes and the rest of the print CSS states
// font sizes in px; everything structural in this file is in mm.
//
// The company name sits in the middle column between the logo and the QR, and
// what limits it is WIDTH, not height — measured in Chromium across 14-44px:
//
//   28px is the hard ceiling. Up to there the masthead row stays exactly 16mm
//   (the QR is the tallest item, not the text) and the band uses 19.0mm of its
//   23mm whatever the name size, so height is never the binding constraint.
//   At 29px the name no longer fits the ~114mm column, wraps to a second line,
//   and the row jumps to 24.3mm — which puts the rule at 27.3mm, out of the
//   23mm band and over the document body.
//
// So anything up to 28 is safe and 29 breaks abruptly. 20 is a deliberate step
// back from that edge: it leaves room for a longer company name from the
// company master, which would wrap at a smaller size than this one does.
const COMPANY_NAME_FONT_PX = 20;
const COMPANY_ADDRESS_FONT_PX = 10;

// The website the header QR resolves to. Recorded here next to the mark so the
// two can be checked against each other — a QR is unreadable to a reviewer, so
// the only way anyone can tell what it points at is if the source says.
//
// The image itself is a pre-rendered PNG in the assets folder rather than
// something generated at runtime: the URL is fixed stationery, so encoding it
// on every render would pull in a QR library and spend work each print to
// produce a byte-identical result. Regenerate assets/qr.png if the address
// changes — the value is not read from this constant.
export const QR_TARGET_URL = 'http://www.kemachequipments.com/';

/** The rule under the header and above the footer: red across, dark at the end. */
function BrandRule() {
  return (
    <div className="lh-rule">
      <span className="lh-rule-red" />
      <span className="lh-rule-dark" />
    </div>
  );
}

export function LetterheadHeader({ company }) {
  return (
    <div className="lh-band lh-header">
      <div className="lh-header-row">
        <img className="lh-logo" src={kemachLogo} alt="KEMACH" />
        <div className="lh-office">
          <div className="lh-office-name">{HEAD_OFFICE_NAME}</div>
          {/* The company master wins when it carries an address, so a branch
              document prints its own. Falls back to the head office otherwise
              rather than printing a blank band. */}
          {company?.address
            ? <div className="lh-office-addr">{company.address}</div>
            : HEAD_OFFICE_ADDRESS.map((line) => (
              <div className="lh-office-addr" key={line}>{line}</div>
            ))}
        </div>
        <img className="lh-qr" src={qrCode} alt={QR_TARGET_URL} />
      </div>
      <BrandRule />
    </div>
  );
}

/**
 * The wordmark behind the body. Uses the logo itself at very low opacity
 * rather than a separate greyscale file, so it can never drift out of step
 * with the brand mark in the header.
 *
 * pointer-events: none and a z-index below the content — a watermark that
 * intercepts clicks or sits over the figures is worse than no watermark.
 */
export function LetterheadWatermark() {
  return <img className="lh-watermark" src={kemachLogo} alt="" aria-hidden="true" />;
}

export function LetterheadFooter({ company }) {
  return (
    <div className="lh-band lh-footer">
      <BrandRule />
      <div className="lh-reg">{REG_OFFICE}</div>
      <div className="lh-contact">
        <span>Email : {company?.email || CONTACT_EMAIL},</span>
        <span className="lh-branches">Branches: {BRANCHES}</span>
      </div>
      {/* Partner/dealership marks carried at the very foot of the sheet,
          below the contact line — Bobcat, Indo Farm Equipment, Indus Rock
          Tool, ISG InfraServe Global, in that fixed order. */}
      <div className="lh-partner-logos">
        <img className="lh-partner-logo" src={bobcatLogo} alt="Bobcat" />
        <img className="lh-partner-logo" src={indoFarmLogo} alt="Indo Farm Equipment Limited" />
        <img className="lh-partner-logo" src={indusRockToolLogo} alt="Indus Rock Tool" />
        <img className="lh-partner-logo" src={isgLogo} alt="ISG InfraServe Global" />
      </div>
    </div>
  );
}

/**
 * The letterhead's CSS, returned as a string so each print component can drop
 * it into its own <style> block alongside its own rules. Shipping it this way
 * rather than as a stylesheet import keeps the whole printable self-contained,
 * which is what the existing print components already do.
 *
 * `pageSelector` is the caller's page class (e.g. '.sinv-page') — each
 * printable names its pages differently, and the letterhead has to anchor to
 * whichever one it's inside.
 *
 * `ruleSpacing` overrides any of RULE_SPACING_MM for this document only. Pass
 * just the keys you want to change; the rest keep the shared defaults.
 */
export function letterheadStyles(pageSelector, ruleSpacing) {
  const rule = { ...RULE_SPACING_MM, ...ruleSpacing };
  return `
    /* The bands are positioned against the page box, so the page must
       establish a containing block. Without this they'd anchor to the nearest
       positioned ancestor — in print, usually the whole document — and every
       copy's letterhead would stack on page one. */
    ${pageSelector} { position: relative; }

    /* Browsers strip background colours and images when printing unless told
       otherwise. The red rules ARE the letterhead, so this is not optional
       here. */
    .lh-band, .lh-watermark, .lh-rule span {
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
      height: ${LETTERHEAD_TOP_MM}mm;
      justify-content: flex-start;
      padding-top: 1mm;
    }
    /* No padding-top here any more — the gap above the footer's rule is the
       rule's own padding now (rule.footerAbove), so all four gaps around the
       two rules are set in one place. */
    .lh-footer {
      bottom: 0;
      height: ${LETTERHEAD_BOTTOM_MM}mm;
      justify-content: flex-start;
    }

    /* Likewise: the gap between the masthead and the header rule belongs to
       the rule (rule.headerAbove), not to this row. */
    .lh-header-row {
      display: flex;
      align-items: center;
      gap: 6mm;
    }
    /* image-rendering: sharpen on the way down to print size instead of the
       browser's default soft/blurred smoothing — the source asset is
       high-resolution (2962x812), so this is what keeps the masthead crisp. */
    .lh-logo { width: 52mm; height: auto; flex-shrink: 0; image-rendering: -webkit-optimize-contrast; }
    /* The company block is centred on the sheet, not merely placed between the
       logo and the QR — flex:1 on both sides would drift it left as soon as
       the logo and QR differed in width. */
    .lh-office { flex: 1; text-align: center; line-height: 1.35; }
    .lh-office-name { font-weight: 700; font-size: ${COMPANY_NAME_FONT_PX}px; }
    .lh-office-addr { font-size: ${COMPANY_ADDRESS_FONT_PX}px; }
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
      height: ${RULE_THICKNESS_MM}mm;
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
    .lh-header .lh-rule { padding: ${rule.headerAbove}mm 0 ${rule.headerBelow}mm; }
    .lh-footer .lh-rule { padding: ${rule.footerAbove}mm 0 ${rule.footerBelow}mm; }
    .lh-rule-red { flex: 1; background: ${RULE_RED}; }
    .lh-rule-dark { width: ${RULE_DARK_WIDTH}; background: ${RULE_DARK}; }

    /* Its top gap now comes from the footer rule's padding-bottom above. */
    .lh-reg { text-align: center; font-weight: 700; font-size: 9.5px; }
    .lh-contact {
      display: flex; justify-content: center; gap: 6mm;
      font-size: 9px; padding-top: 0.5mm;
    }
    /* The partner-logo strip: four marks in a single centred row below the
       contact line. Height is fixed (not "auto") so the row's contribution
       to the footer band is exactly what FOOTER_CONTENT_MM/PARTNER_LOGOS_ROW_MM
       above assume — an unconstrained row would size itself from the tallest
       source image instead. */
    .lh-partner-logos {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8mm;
      height: ${PARTNER_LOGOS_ROW_MM}mm;
      padding-top: ${PARTNER_LOGOS_PADDING_TOP_MM}mm;
      flex-shrink: 0;
    }
    /* width: auto + a height cap, not the other way round — the four source
       marks are different aspect ratios, and constraining width instead would
       make some of them taller than the row and force a clip. */
    .lh-partner-logo {
      height: 100%;
      width: auto;
      max-width: 32mm;
      object-fit: contain;
    }
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
    ${pageSelector} > *:not(.lh-watermark):not(.lh-band) { position: relative; z-index: 1; }
    .lh-band { z-index: 2; }
  `;
}
