# Design system

The default world is a personal paper desk interpreted as working UI. Do not turn it into a commercial dashboard or a historical artifact simulation.

Customization controls stay near the project list and use optional dialogs. The default desk remains readable; comfortable/compact density is a personal preference. Theme preview is temporary until confirmation, and cancellation restores the persisted appearance.

## Tokens

song-paper.css defines ground #f4efdf, surface #fbf7ed, text #25221d, muted #574f43, accent #a43226 and matching dark values. Layout references semantic tokens rather than hardcoded theme colors.

## Typography

Body: Microsoft YaHei UI / Microsoft YaHei / PingFang SC, default18px reading, 16px project descriptions and 17px notes. Headings: SimSun / STSong serif, 21–36px with clear weight. UI controls use sans-serif. Reading size is user-adjustable16–22px. No external font requests.

## Layout

The visual desk uses three optional views: project map, task continuation and layout previews. Flat columns and paper divisions preserve the default world. Connection evidence opens inline with text states. Task lanes become a single reading flow on narrow screens. Two-pane separators support direct dragging and keyboard adjustment; narrow screens retain a single column without a drag handle.

180px project rail, generous content gutter, asymmetrical two-column reading area with a narrow margin, flat project rows and side notes. Mobile becomes a linear reading flow; the decorative margin disappears. Avoid nested cards and decorative metric tiles.

## Motion

Moving tab track260ms, local paper reveal320ms, fast exit140ms. Native View Transitions are interruptible and latest-request-wins. Reduced motion removes spatial transitions. No entrance choreography, autoplay or infinite animation.

## States

Readable light/dark, hover, keyboard focus, disabled boundary controls, empty project/recent views, storage failure, unreadable backup, conflict warning and restore preview. Embedding is not a health check.
