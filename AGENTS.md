<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- All scientific calculations live in `src/lib/dosing.ts` + `src/lib/units.ts` (pure, unit-converted to mg/L, L/s, L, mg, h); UI only parses input and renders the returned `Sheet`. Why: calculations stay testable in `src/lib/dosing.test.ts`.
- Calculation history is stored in browser localStorage (`src/lib/history.ts`), no backend. Why: works offline on field devices.
- Reversible calculations use a shared equation catalogue and solver in `src/lib/dosing.ts`, rendered by a shared selector-based calculator. Why: every selectable unknown follows the same unit conversions and validation without duplicating scientific logic in pages.
