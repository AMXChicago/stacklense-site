"use client";

import { deleteProject } from "./actions";

export function DeleteProjectButton({
  projectId,
  projectName,
  hasGitHub,
  hasEcr,
}: {
  projectId: string;
  projectName: string;
  hasGitHub: boolean;
  hasEcr: boolean;
}) {
  const cleanup: string[] = [];
  if (hasGitHub) cleanup.push("Remove the GitHub webhook from your repo");
  if (hasEcr)
    cleanup.push("Delete the StackLenseConnect CloudFormation stack in AWS");

  const cleanupNote =
    cleanup.length > 0
      ? `\n\nAfter deleting, you may want to:\n- ${cleanup.join("\n- ")}`
      : "";

  return (
    <form action={deleteProject}>
      <input type="hidden" name="project_id" value={projectId} />
      <button
        type="submit"
        className="dangerous-btn"
        onClick={(e) => {
          if (
            !confirm(
              `Delete project "${projectName}"?\n\nThis removes the project, all deploy history, and the blueprint. Cannot be undone.${cleanupNote}`
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        Delete project
      </button>
    </form>
  );
}
