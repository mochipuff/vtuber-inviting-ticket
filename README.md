# vtuber-inviting-ticket
Create a inviting ticket for vtuber community.

## Ticket themes
- **Pop collage**: the original sticker-style ticket (QR code, stamp, ticket number).
- **Celestial night**: pastel night-sky debut ticket with a 75% main ticket and a 25% date/time stub. Sky colors: Sky, Lavender, Mint. The component is `CelestialTicket` in `src/celestial.tsx` (props: `title`, `subtitle`, `channelName`, `streamDate`, `streamTime`, `timezone`, `characterImageUrl`, `backgroundTheme`).

The dark space background in the Celestial preview is only the preview stage. Saved PNG/WebP files stay transparent outside the ticket shape.

## Timezone
The timezone field is a popup list (`src/tzpicker.tsx`) with common zones (WIB, WITA, WIT, JST, KST, EST, PST, CET...). Choose "Custom…" to type your own.

## Incremental patch (existing checkouts)
No database. Run `npm install` once to add the new bundled fonts: `@fontsource/fredoka` and `@fontsource/caveat`.
