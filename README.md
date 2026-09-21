# Frame Builder

A Figma plugin that generates every deliverable frame for a sermon series in one
click, tags them so duplicates stay traceable, and later exports the whole set as
a zipped delivery package.

It pairs with [PSD Bridge](https://github.com/rhettjthomas/psd-bridge). Bring the
hero art into Figma with PSD Bridge, run Frame Builder to lay out the
deliverables, drag the art into place, and export the set.

## Status

Milestone 2 of 7 (v0.2.2). The build dialog opens, the checklist persists between runs,
and Build creates the frames: correctly sized and named, white filled except
Lower Thirds, safe margins as layout grids, arranged in a titled section.
Tagging and export are not wired up yet.

## Running it

```
npm install
npm run watch
```

Then in Figma: Plugins, Development, Import plugin from manifest, and pick
`manifest.json`.

The manifest carries a placeholder `id`. It needs one even in development,
because `figma.clientStorage` is namespaced by plugin ID and refuses to read or
write without it. Replace it with the real ID before publishing: in Figma, create
the plugin through Plugins, Development, New plugin, and copy the `id` out of the
manifest it generates. Swapping the ID starts the saved checklist from the
defaults once, which is harmless.

Other scripts: `npm run build` for a one-off minified build, `npm run typecheck`,
and `npm test`.

## How it tracks frames

Setting up 8 to 18 correctly sized, correctly named frames for every series is
repetitive, and the export step usually means hand-selecting frames and hoping
none were missed. The hard part is not creating the frames. It is knowing, weeks
later, which frames belong to the series, including ones duplicated after the
build.

Figma copies plugin data when a node is duplicated, so every frame the builder
creates is stamped with its own tags and duplicates inherit them automatically.
The export searches by tag instead of by page, which also means it works the same
whether the frames sit on one page or five.
