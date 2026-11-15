/** Explains how the existing mission simulation follows up a flagged value, without causal claims. */
export function FollowUpCard() {
  return (
    <section className="recovery-card" aria-labelledby="follow-up-heading">
      <h3 id="follow-up-heading" className="section-heading">
        How follow-up works in the mission simulation
      </h3>
      <p>
        In the synthetic mission replay, a value outside a crew member’s personal range is checked again later. If a
        follow-up check finds it back inside the range, the alert is recorded as <strong>Returned to range</strong>. If
        it is still outside after the follow-up checks, it is recorded as <strong>Flagged for human review</strong>.
      </p>
      <p>
        Returning to range does not prove that a break, a breathing practice or any other step caused the change.
        Values also move back on their own, and the simulation does not test what caused it. Decisions stay with
        people, such as the crew medical officer.
      </p>
    </section>
  );
}
