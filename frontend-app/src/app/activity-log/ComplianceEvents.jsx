import { PageHeader, PlaceholderNotice, EmptyState } from "../shared/ui";

// No confirmed backend contract for this page. api.js has
// leadsApiCalls.compliance() — but that's a POST action that runs a
// compliance sweep, not a GET endpoint that returns a history/log of past
// compliance events (suppressions, opt-outs, flagged leads, etc). Rather
// than invent a shape for that log, this page is left as an honest empty
// state until a real endpoint exists — see Section 8 of the discovery
// report / flag list in the build report for this task.
export default function ComplianceEvents() {
  return (
    <div>
      <PageHeader title="Compliance Events" description="A log of compliance actions taken on leads — suppressions, opt-outs, and flags." />
      <PlaceholderNotice>
        No backend endpoint returns a compliance event history yet. <code style={{ margin: "0 4px" }}>leadsApiCalls.compliance()</code>{" "}
        only triggers the sweep; it doesn't return a log of what happened. This page is a stub until
        that contract exists — don't wire fake data into it.
      </PlaceholderNotice>
      <EmptyState
        title="Not available yet"
        body="A compliance event log endpoint hasn't been confirmed on the backend. Once one exists, this page can list suppressions, opt-outs, and flags here."
      />
    </div>
  );
}
