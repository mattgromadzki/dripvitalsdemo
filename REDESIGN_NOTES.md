# Drip Vitals EMR redesign notes

This package includes a softer, calmer visual redesign applied through the shared layout and global UI system so the look updates across the EMR rather than only on one screen.

## Updated

- `app/globals.css`
  - New softer Drip Vitals EMR color system.
  - Softer cards, buttons, pills, tables, forms, modals, sidebars, and page backgrounds.
  - Global restyling applies across the module pages.

- `tailwind.config.ts`
  - Updated brand and semantic colors to a softer blue/teal/sage/lavender palette.
  - Softer shadows and rounded corners.

- `components/layout/Topbar.tsx`
  - Cleaner top navigation.
  - Softer user menu.
  - Simplified operational breadcrumb.
  - Direct order queue shortcut.

- `components/layout/Sidebar.tsx`
  - Reorganized navigation around daily EMR workflows.
  - Daily Work, Clinical, Business, and Admin grouping.
  - Softer navigation state and badges.

- `components/ui/Kpi.tsx`
  - Softer KPI cards.
  - Responsive KPI layout.
  - Cleaner typography and calmer icons.

- `components/modules/chart/ChartTabs.tsx`
  - Softer pill-style patient chart tabs.
  - More compact patient-chart navigation.

- `app/(modules)/dashboard/page.tsx`
  - Redesigned dashboard into an operations command center.
  - Added daily action queues: provider review, needs Rx, pharmacy, shipping issues, refills, messages.
  - Cleaner recent intake and attention sections.

## Design direction

The EMR now follows a calmer design language:

- Off-white background instead of stark gray/blue.
- Muted blue as the main brand color.
- Sage/teal for positive and wellness states.
- Sand instead of loud yellow for warnings.
- Muted rose instead of aggressive red for issues.
- Fewer hard contrasts and fewer dark blocks.
- More consistent cards and spacing.

## Notes

I did not remove existing modules or features. The redesign is mostly applied through the global shell and design system so existing pages inherit the new look while keeping their functionality.

After opening the project locally, run:

```bash
npm install
npm run dev
```

Then review the main pages:

- `/dashboard`
- `/orders`
- `/patients`
- `/patients/[id]`
- `/intake-review`
- `/shipments`
- `/billing`
- `/messages` or `/patient-chat`
