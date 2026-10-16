# Settings and project visibility preview

Open `/examples/settings.html` on a running development server. The preview uses the configured project names and links, while saving only to an independent `yifang-settings-demo-v1:<namespace>` browser record. It does not read or write the production personal state. Links open the independent projects in a new tab.

The proposed workflow keeps Settings at the bottom of the project rail and offers three sections: project visibility, appearance and reading, and data and recovery. Changes preview immediately. Save persists the demo record; Cancel restores the previous saved value. Hidden projects disappear from both the demo desk and navigation. The visibility list always includes hidden entries, even when every project is hidden. All projects can be restored together. Invalid or concurrently changed records pause saving.

Reference patterns reviewed on 2026-10-16:

- [Notion sidebar navigation](https://www.notion.com/help/navigate-with-the-sidebar): customize navigation and hide items without deleting source content.
- [VS Code Settings](https://code.visualstudio.com/docs/configure/settings): place related preferences in a dedicated, labeled settings surface.

This is an approval preview. The production visibility schema, backup migration, task links, search and multi-pane behavior will be integrated after the human approves the interaction. Appearance is inherited from the existing Song Paper theme.

Revision 2 gives Settings a cool neutral canvas and compact sans-serif form layout, separate from the paper desk. Save and Enter are solid accent actions; secondary actions have outlined surfaces; Hide is a text action. The project rail now switches the preview workspace in place, preserving each independent iframe. A solid selected navigation item and a cancellable 420 ms directional reveal acknowledge each actual project change. Repeated selection does not replay motion. Reduced-motion preferences suppress the spatial animation. Mobile uses a labeled page selector instead of hiding access to projects.

Revision 3 replaces the full settings page with a native modal dialog above the existing desk or project. The warm paper palette returns, with a translucent surface and a 26 px backdrop blur. Closing by button, Escape, or outside click preserves the draft and returns focus to the opener; reopening retains the selected category. The project iframe remains mounted below the dialog. Content scrolls inside the dialog while its header and save controls remain visible. Reduced transparency uses an opaque surface, and unsupported backdrop filters fall back to the normal surface.

For connection diagnosis, `node scripts/check-projects.mjs` checks the exact configured URLs and exits unsuccessfully when a project is unavailable. An HTTP success confirms endpoint reachability; inspect embedded page content separately.
