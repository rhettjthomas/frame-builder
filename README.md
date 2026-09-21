# Frame Builder

A Figma plugin that generates every deliverable frame for a sermon series in one
click, tags them so duplicates stay traceable, and later exports the whole set as
a zipped delivery package.

It pairs with [PSD Bridge](https://github.com/rhettjthomas/psd-bridge). Bring the
hero art into Figma with PSD Bridge, run Frame Builder to lay out the
deliverables, drag the art into place, and export the set.

## Status

Pre-scaffold. No plugin code yet.

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
