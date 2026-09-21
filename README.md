# Frame Builder

A Figma plugin that builds every deliverable frame for a sermon series in one
click, correctly sized, correctly named, and set up so Figma's own export
delivers them in organized folders.

It pairs with [PSD Bridge](https://github.com/rhettjthomas/psd-bridge). Bring the
hero art into Figma with PSD Bridge, run Frame Builder to lay out the
deliverables, drag the art into place, and export the set.

## What it does

Setting up 8 to 20 correctly sized, correctly named frames for every series is
repetitive work, and the export step usually means hand-selecting frames and
hoping none were missed. Frame Builder does the setup and keeps track of the
frames afterwards.

**Building.** Check the deliverables you want, name the series, and it creates
them: white filled, safe margins marked, arranged in a titled section, each
carrying the right export format at full size. A deliverable with several frames
gets its own row in the layout, because a carousel split across two rows reads as
a mistake rather than a set.

**Safe margins** are Figma layout grids rather than drawn rectangles. They mark
the unsafe edges and leave the safe area clear, they render above whatever art
you drag in, and they never rasterize into an export, so there is nothing to hide
or delete before delivery.

**Delivery folders.** A setting, on by default, prefixes each frame name with its
delivery path:

```
HOPE HAS A NAME/SCREENS/Hope Has a Name_Hero 4K 01
```

Figma nests a folder per slash when several layers are exported at once, so
selecting the section and exporting produces the whole package: the series in its
own folder, with SCREENS, SOCIAL MEDIA and WEB inside it. Frame Builder does not
export anything itself. A plugin cannot write to a folder you choose and Figma
can, so the plugin's job is to make Figma's export correct rather than to
reinvent it.

**Custom sizes and presets.** Add a size of your own, optionally in a group of
its own, and a group names its own delivery folder. Save a checklist as a preset,
and share presets as JSON between machines or with a church's team. A preset
carries the custom sizes it uses, so it arrives complete rather than referring to
sizes the other person doesn't have.

## Keeping track of frames

The hard part is not creating frames. It is knowing, weeks later, which frames
belong to the series, including ones duplicated after the build.

A saved list of node ids would be a guest list at the door: anyone who arrives
later isn't on it. Figma copies plugin data when a node is duplicated, so every
frame carries its own tag instead, and a duplicate inherits it. Frames are named
`SeriesName_Deliverable 01`, with a space before the number, so Figma's own
increment continues the sequence when you duplicate one by hand. Nothing ever
renames your layers behind your back.

## Selection commands

**Select frames in this series** has a button under the Build button. Select one
frame of the series and it selects the rest on that page, and says how many are
on other pages, since Figma's selection cannot span pages.

The rest are in the settings menu:

- **Add or remove delivery folders** on a series that already exists, so deciding
  about folders after the fact doesn't mean rebuilding.
- **Add selection to this series** adopts hand-built frames. The series comes
  from the section they sit in, or from a tagged frame selected alongside them.
- **Remove series tags from selection** for art repurposed out of a series.

## Development

```
npm install
npm run watch
```

Then in Figma: Plugins, Development, Import plugin from manifest, and pick
`manifest.json`. Re-import rather than re-run whenever the manifest itself
changes.

The manifest carries a placeholder `id`. It needs one even in development,
because `figma.clientStorage` is namespaced by plugin ID and refuses to read or
write without it. Replace it with the real ID before publishing: in Figma, create
the plugin through Plugins, Development, New plugin, and copy the `id` out of the
manifest it generates. Swapping the ID starts the saved checklist from the
defaults once, which is harmless.

Other scripts: `npm run build` for a one-off minified build, `npm run typecheck`,
and `npm test`.

The plugin declares no network access and never sends anything anywhere. Presets
and settings are stored with `figma.clientStorage`, which is local to your
machine.

---

By [Midwood Road LLC](https://midwoodroad.com). Free to use.
