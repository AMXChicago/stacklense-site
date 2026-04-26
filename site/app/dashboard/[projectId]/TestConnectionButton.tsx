"use client";

/**
 * Test-connection button with inline pending state. Wraps the
 * testAwsConnection server action in a form that, while submitting,
 * shows "Testing connection…" with a spinner — so the customer gets
 * feedback right inside the AWS connection panel instead of waiting
 * for the redirect to surface a status change up at the top.
 *
 * useFormStatus() must be called from a child component of the form;
 * that's why SubmitInner exists as a separate component.
 */

import { useFormStatus } from "react-dom";
import { testAwsConnection } from "./actions";

export function TestConnectionButton({ projectId }: { projectId: string }) {
  return (
    <form action={testAwsConnection}>
      <input type="hidden" name="project_id" value={projectId} />
      <SubmitInner />
    </form>
  );
}

function SubmitInner() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="aws-action-btn aws-test-conn-btn"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <span className="aws-test-conn-spinner" aria-hidden="true" />
          Testing connection…
        </>
      ) : (
        "Test connection"
      )}
    </button>
  );
}
