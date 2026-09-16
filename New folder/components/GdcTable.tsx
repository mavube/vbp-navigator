export function GdcTable() {
  return (
    <table className="compare-table">
      <thead>
        <tr>
          <th>Department</th>
          <th></th>
          <th>Service</th>
          <th>Type</th>
          <th>Recipient</th>
          <th>Outcome</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="dept">Marketing</td>
          <td className="arrow-cell">→</td>
          <td>Demand &amp; Engagement</td>
          <td><span className="mini-badge enabling">Enabling</span></td>
          <td>Prospective candidate</td>
          <td>Can make an informed decision</td>
        </tr>
        <tr>
          <td className="dept">Admissions</td>
          <td className="arrow-cell">→</td>
          <td>Candidate Admission</td>
          <td><span className="mini-badge">CVS</span></td>
          <td>Prospective/confirmed candidate</td>
          <td>Right candidate enrolled and ready</td>
        </tr>
        <tr>
          <td className="dept">Finance</td>
          <td className="arrow-cell">→</td>
          <td>Financial &amp; Commercial Administration</td>
          <td><span className="mini-badge enabling">Enabling</span></td>
          <td>GDC and the candidate</td>
          <td>Transactions accurate and visible</td>
        </tr>
        <tr>
          <td className="dept">Administration</td>
          <td className="arrow-cell">→</td>
          <td>Operational Support</td>
          <td><span className="mini-badge enabling">Enabling</span></td>
          <td>Instructor and candidates</td>
          <td>Environment ready and functional</td>
        </tr>
        <tr>
          <td className="dept">IT</td>
          <td className="arrow-cell">→</td>
          <td>Digital &amp; Information Enablement</td>
          <td><span className="mini-badge enabling">Enabling</span></td>
          <td>Instructor and candidates</td>
          <td>Technology enables, doesn&apos;t interrupt</td>
        </tr>
        <tr>
          <td className="dept">Instructor</td>
          <td className="arrow-cell">→</td>
          <td>PMP Master Class Delivery</td>
          <td><span className="mini-badge">CVS</span></td>
          <td>Candidate</td>
          <td>Capability improves</td>
        </tr>
        <tr>
          <td className="dept">Post-training support</td>
          <td className="arrow-cell">→</td>
          <td>Post-Training Certification Support</td>
          <td><span className="mini-badge">CVS</span></td>
          <td>Candidate</td>
          <td>Practice, coaching, readiness continue</td>
        </tr>
        <tr>
          <td className="dept">Fulfillment</td>
          <td className="arrow-cell">→</td>
          <td>Certification / Completion Fulfillment</td>
          <td><span className="mini-badge">CVS</span></td>
          <td>Candidate</td>
          <td>Appropriate proof reaches candidate</td>
        </tr>
      </tbody>
    </table>
  );
}
