/**
 * Empty-state inspector — shown when nothing is selected.
 *
 * Per spec "Onboarding / empty state": should be a project overview
 * paragraph (LLM-generated, regenerated when the project shape
 * changes meaningfully), not a "click anything to inspect"
 * placeholder (anti-pattern v4).
 *
 * Step 2 ships a static stand-in paragraph. The LLM-generated
 * version arrives in spec build step 17 — at that point this file
 * keeps its layout and just swaps its content source. Nothing else
 * in the inspector needs to change.
 *
 * No tabs in the empty state per spec ("Empty state: project
 * overview as a generated paragraph, no tabs.").
 */

export default function InspectorEmpty({
  projectName,
}: {
  projectName: string;
}) {
  return (
    <div className="flex h-full flex-col gap-3 px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink3">
        Project overview · placeholder
      </p>
      <p className="text-sm leading-relaxed text-ink2">
        <span className="font-medium text-ink">{projectName}</span> is
        the project currently loaded in the workspace. Click any node
        in the canvas above to inspect it — the strip, tabs, and tab
        body will populate with that service&rsquo;s details. Click
        the canvas background or the clear button on the strip to
        return to this overview.
      </p>
      <p className="text-xs leading-relaxed text-ink3">
        A live, LLM-generated description of the project (what it
        does, the shape of its stack, the parts worth looking at
        first) lands in step 17. Until then this copy stands in so
        the panel never reads as &ldquo;click anything to inspect.&rdquo;
      </p>
    </div>
  );
}
