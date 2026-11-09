# Bilingual Calcite interface redesign

Work in the existing application; preserve the SDK, authentication, data snapshots, adaptive symbol algorithm, and wheel navigation.

1. [x] Replace the promotional layout with a Calcite application shell, header actions, a collapsible directory panel, and expandable filters.
2. [x] Add English (default) and Spanish, including application labels, statuses, accessibility text, SDK locale, and persistent language selection. Keep original community names, descriptions, and geographic names unchanged.
3. [x] Replace the technical group selector with autonomous-community and dependent province filters. Keep overflow-group inspection as a temporary, dismissible directory scope.
4. [x] Replace modal community details with a nested Calcite Flow item. Reuse that item for further map selections; open the sidebar if collapsed, preserve the directory, and support back navigation.
5. [x] Move grouping/count status into the map footer and map configuration into a header-controlled panel. Preserve the AI disclosure and source credits.
6. [x] Translate repository-authored documentation, comments, and tooling messages to English; preserve external datasets and bilingual application strings.
7. [x] Validate filtering, language switching, nested details, collapse/reopen, keyboard focus, map interaction, responsive layout, regression tests, and both builds.

No new service, account, framework, or authentication requirements. No new commit or publication is implied by this change request.

Completed November 9, 2026. Validation: 34 regression/localization tests, app and library builds, desktop and mobile-emulation workflows. See [validation](validation.md) for observations and remaining browser/device coverage.
