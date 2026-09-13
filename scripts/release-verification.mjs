import { receiptMatches } from './release-support.mjs';

export function requireDeploymentIdentity(deployment, commit, projectId) {
  if (deployment.readyState !== 'READY' || deployment.target !== 'production'
    || deployment.meta?.githubCommitSha !== commit || deployment.meta?.githubCommitRef !== 'main'
    || deployment.projectId !== projectId) throw new Error('Deployment identity does not match the exact certified Git commit and project');
  return true;
}

/** A stranded post-push verification may reuse the original receipt only when
 * current main is exactly that certified HEAD and the recorded base is its ancestor. */
export function matchesPublicationReceipt(receipt, inputs, recordedBaseIsAncestor) {
  if (receiptMatches(receipt, inputs)) return true;
  return inputs.main === inputs.commit && recordedBaseIsAncestor && receipt?.inputs?.commit === inputs.commit
    && receiptMatches(receipt, { ...inputs, main: receipt.inputs.main });
}
