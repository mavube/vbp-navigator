export function ServiceCardsByService() {
  return (
    <>
      <h3 className="group-heading">
        Customer Value Services <span className="count">(5)</span>
      </h3>
      <div className="card-grid">
        <div className="svc-card is-gap">
          <div className="card-head">
            <h3>Professional Readiness Assessment</h3>
            <span className="type-badge gap">CVS · Gap</span>
          </div>
          <div className="meta-row">
            <span className="provider unassigned">Not evidenced</span>
            <span className="dept-tag">Dept: —</span>
          </div>
          <dl>
            <dt>Recipient</dt>
            <dd>Prospective candidate.</dd>
            <dt>Outcome</dt>
            <dd>Eligibility and readiness are actually established before someone commits to the class.</dd>
            <dt>Depends on</dt>
            <dd className="chip-row"><span className="dep-chip">Demand &amp; Engagement</span></dd>
            <dt>Feeds</dt>
            <dd className="chip-row"><span className="dep-chip">Candidate Admission</span></dd>
            <dt>Owner</dt>
            <dd className="gap-text">Not assigned</dd>
            <dt>Backup</dt>
            <dd className="gap-text">None</dd>
          </dl>
        </div>

        <div className="svc-card is-gap">
          <div className="card-head">
            <h3>Candidate Admission</h3>
            <span className="type-badge gap">CVS · Gap</span>
          </div>
          <div className="meta-row">
            <span className="provider unassigned">No single owner</span>
            <span className="dept-tag">Dept: —</span>
          </div>
          <dl>
            <dt>Recipient</dt>
            <dd>Prospective / confirmed candidate.</dd>
            <dt>Outcome</dt>
            <dd>The right candidate is admitted and ready — someone can say with certainty who is enrolled.</dd>
            <dt>Depends on</dt>
            <dd className="chip-row">
              <span className="dep-chip">Demand &amp; Engagement</span>
              <span className="dep-chip">Readiness Assessment</span>
            </dd>
            <dt>Feeds</dt>
            <dd className="chip-row"><span className="dep-chip">Master Class Delivery</span></dd>
            <dt>Owner</dt>
            <dd className="gap-text">Not assigned — Finding 4</dd>
            <dt>Backup</dt>
            <dd className="gap-text">None</dd>
          </dl>
        </div>

        <div className="svc-card">
          <div className="card-head">
            <h3>Master Class Delivery</h3>
            <span className="type-badge cvs">CVS</span>
          </div>
          <div className="meta-row">
            <span className="provider">Anne</span>
            <span className="dept-tag">Dept: Instructor</span>
          </div>
          <dl>
            <dt>Recipient</dt>
            <dd>Candidate.</dd>
            <dt>Outcome</dt>
            <dd>Candidate receives the intended learning and capability development.</dd>
            <dt>Depends on</dt>
            <dd className="chip-row">
              <span className="dep-chip">Service Delivery Mgmt</span>
              <span className="dep-chip">Operational Support</span>
              <span className="dep-chip">Financial Admin</span>
            </dd>
            <dt>Feeds</dt>
            <dd className="chip-row"><span className="dep-chip">Post-Training Support</span></dd>
            <dt>Owner</dt>
            <dd>Anne</dd>
            <dt>Backup</dt>
            <dd className="gap-text">Not assigned — Finding 3</dd>
          </dl>
        </div>

        <div className="svc-card">
          <div className="card-head">
            <h3>Post-Training Certification Support</h3>
            <span className="type-badge cvs">CVS</span>
          </div>
          <div className="meta-row">
            <span className="provider">Anne</span>
            <span className="dept-tag">Dept: Instructor</span>
          </div>
          <dl>
            <dt>Recipient</dt>
            <dd>Candidate.</dd>
            <dt>Outcome</dt>
            <dd>Candidate continues from completed training toward certification readiness — coaching, practice, guidance.</dd>
            <dt>Depends on</dt>
            <dd className="chip-row"><span className="dep-chip">Service Delivery Mgmt</span></dd>
            <dt>Feeds</dt>
            <dd className="chip-row"><span className="dep-chip">Certification Fulfillment</span></dd>
            <dt>Owner</dt>
            <dd>Anne</dd>
            <dt>Backup</dt>
            <dd className="gap-text">Not assigned</dd>
          </dl>
        </div>

        <div className="svc-card">
          <div className="card-head">
            <h3>Certification / Completion Fulfillment</h3>
            <span className="type-badge cvs">CVS</span>
          </div>
          <div className="meta-row">
            <span className="provider">Edwin</span>
            <span className="dept-tag">Dept: IT</span>
          </div>
          <dl>
            <dt>Recipient</dt>
            <dd>Candidate who completed the class.</dd>
            <dt>Outcome</dt>
            <dd>Proof of completion exists and reaches the person who earned it.</dd>
            <dt>Depends on</dt>
            <dd className="chip-row"><span className="dep-chip">Service Delivery Mgmt</span></dd>
            <dt>Feeds</dt>
            <dd className="chip-row"><span className="dep-chip">Customer value</span></dd>
            <dt>Owner</dt>
            <dd>Edwin</dd>
            <dt>Backup</dt>
            <dd className="gap-text">Not assigned</dd>
          </dl>
        </div>
      </div>

      <h3 className="group-heading">
        Enabling Services <span className="count">(4 — kept deliberately few)</span>
      </h3>
      <div className="card-grid">
        <div className="svc-card is-enabling">
          <div className="card-head">
            <h3>Demand &amp; Engagement</h3>
            <span className="type-badge enabling">Enabling</span>
          </div>
          <div className="meta-row">
            <span className="provider">Edwin</span>
            <span className="dept-tag">Dept: IT</span>
          </div>
          <dl>
            <dt>Supports</dt>
            <dd>Creates and moves legitimate candidate interest into the value chain — ads and campaigns.</dd>
            <dt>Enables</dt>
            <dd className="chip-row">
              <span className="dep-chip">Readiness Assessment</span>
              <span className="dep-chip">Candidate Admission</span>
            </dd>
            <dt>Owner</dt>
            <dd>Edwin</dd>
            <dt>Backup</dt>
            <dd className="gap-text">Not assigned</dd>
          </dl>
        </div>

        <div className="svc-card is-enabling">
          <div className="card-head">
            <h3>Service Delivery Management</h3>
            <span className="type-badge enabling">Enabling</span>
          </div>
          <div className="meta-row">
            <span className="provider">Jennifer</span>
            <span className="dept-tag">Dept: SDM</span>
          </div>
          <dl>
            <dt>Supports</dt>
            <dd>Coordination and readiness required to actually deliver — cross-workstream tracking, class readiness tracking.</dd>
            <dt>Enables</dt>
            <dd className="chip-row">
              <span className="dep-chip">Candidate Admission</span>
              <span className="dep-chip">Master Class Delivery</span>
              <span className="dep-chip">Post-Training Support</span>
              <span className="dep-chip">Certification Fulfillment</span>
            </dd>
            <dt>Owner</dt>
            <dd>Jennifer</dd>
            <dt>Backup</dt>
            <dd className="gap-text">Not assigned — Finding 2</dd>
          </dl>
        </div>

        <div className="svc-card is-enabling">
          <div className="card-head">
            <h3>Financial &amp; Commercial Administration</h3>
            <span className="type-badge enabling">Enabling</span>
          </div>
          <div className="meta-row">
            <span className="provider">Jennifer · Anne</span>
            <span className="dept-tag">Dept: SDM / Instructor</span>
          </div>
          <dl>
            <dt>Supports</dt>
            <dd>Commercial/financial conditions required for delivery — office and kitchen budgets; bills (water, electric, internet, phone, security, garbage).</dd>
            <dt>Enables</dt>
            <dd className="chip-row"><span className="dep-chip">Master Class Delivery</span></dd>
            <dt>Owner</dt>
            <dd>Jennifer tracks · Anne approves</dd>
            <dt>Backup</dt>
            <dd className="gap-text">Not assigned</dd>
          </dl>
        </div>

        <div className="svc-card is-enabling">
          <div className="card-head">
            <h3>Operational Support</h3>
            <span className="type-badge enabling">Enabling</span>
          </div>
          <div className="meta-row">
            <span className="provider">Twesa</span>
            <span className="dept-tag">Dept: Kitchen</span>
          </div>
          <dl>
            <dt>Supports</dt>
            <dd>Practical operating conditions for delivery — food quality, breakfast/lunch timing, kitchen stock.</dd>
            <dt>Enables</dt>
            <dd className="chip-row"><span className="dep-chip">Master Class Delivery</span></dd>
            <dt>Owner</dt>
            <dd>Twesa</dd>
            <dt>Backup</dt>
            <dd className="gap-text">Not assigned</dd>
          </dl>
        </div>
      </div>
    </>
  );
}

export function ProviderTable() {
  return (
    <table className="compare-table provider-table">
      <thead>
        <tr>
          <th>Provider</th>
          <th>Department</th>
          <th>Services provided</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Edwin</td>
          <td className="dept">IT</td>
          <td className="svc-list">
            <span className="mini-badge enabling">Enabling</span>Demand &amp; Engagement
            <br />
            <span className="mini-badge">CVS</span>Certification / Completion Fulfillment
          </td>
        </tr>
        <tr>
          <td>Jennifer</td>
          <td className="dept">SDM</td>
          <td className="svc-list">
            <span className="mini-badge enabling">Enabling</span>Service Delivery Management
            <br />
            <span className="mini-badge enabling">Enabling</span>Financial &amp; Commercial Administration (tracks)
            <br />
            <span className="note-line">Also touches Candidate Admission informally — no formal ownership</span>
          </td>
        </tr>
        <tr>
          <td>Anne</td>
          <td className="dept">Instructor</td>
          <td className="svc-list">
            <span className="mini-badge">CVS</span>Master Class Delivery
            <br />
            <span className="mini-badge">CVS</span>Post-Training Certification Support
            <br />
            <span className="mini-badge enabling">Enabling</span>Financial &amp; Commercial Administration (approves)
          </td>
        </tr>
        <tr>
          <td>Twesa</td>
          <td className="dept">Kitchen</td>
          <td className="svc-list">
            <span className="mini-badge enabling">Enabling</span>Operational Support
          </td>
        </tr>
        <tr>
          <td>
            <em>Unassigned</em>
          </td>
          <td className="dept">—</td>
          <td className="svc-list">
            <span className="mini-badge">CVS</span>Professional Readiness Assessment
            <br />
            <span className="mini-badge">CVS</span>Candidate Admission
          </td>
        </tr>
      </tbody>
    </table>
  );
}
