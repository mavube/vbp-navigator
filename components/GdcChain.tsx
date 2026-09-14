export function GdcChain() {
  return (
    <svg
      className="chain"
      viewBox="0 0 962 160"
      role="img"
      aria-label="GDC PMP service chain: Demand and Engagement (Marketing) feeds Professional Readiness Assessment, then Candidate Admission (Admissions), PMP Master Class Delivery (Instructor), Post-Training Certification Support, and Certification and Completion Fulfillment, ending in customer value."
    >
      <defs>
        <marker id="arrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
        </marker>
      </defs>

      <rect className="node-box enabling" x="14" y="40" width="100" height="100" rx="2" />
      <text className="node-badge muted" x="64" y="55" textAnchor="middle">ENABLING</text>
      <text className="svc-name" x="64" y="70" textAnchor="middle">Demand &amp;</text>
      <text className="svc-name" x="64" y="83" textAnchor="middle">Engagement</text>
      <text className="svc-provider" x="64" y="100" textAnchor="middle">MARKETING</text>

      <rect className="node-box" x="128" y="40" width="130" height="100" rx="2" />
      <text className="node-badge" x="193" y="55" textAnchor="middle">CVS</text>
      <text className="svc-name" x="193" y="70" textAnchor="middle">Readiness</text>
      <text className="svc-name" x="193" y="83" textAnchor="middle">Assessment</text>
      <text className="svc-provider muted" x="193" y="100" textAnchor="middle">NOT SPECIFIED</text>

      <rect className="node-box" x="272" y="40" width="130" height="100" rx="2" />
      <text className="node-badge" x="337" y="55" textAnchor="middle">CVS</text>
      <text className="svc-name" x="337" y="70" textAnchor="middle">Candidate</text>
      <text className="svc-name" x="337" y="83" textAnchor="middle">Admission</text>
      <text className="svc-provider" x="337" y="100" textAnchor="middle">ADMISSIONS</text>

      <rect className="node-box" x="416" y="40" width="130" height="100" rx="2" />
      <text className="node-badge" x="481" y="55" textAnchor="middle">CVS</text>
      <text className="svc-name" x="481" y="70" textAnchor="middle">Master Class</text>
      <text className="svc-name" x="481" y="83" textAnchor="middle">Delivery</text>
      <text className="svc-provider" x="481" y="100" textAnchor="middle">INSTRUCTOR</text>

      <rect className="node-box" x="560" y="40" width="130" height="100" rx="2" />
      <text className="node-badge" x="625" y="55" textAnchor="middle">CVS</text>
      <text className="svc-name" x="625" y="70" textAnchor="middle">Post-Training</text>
      <text className="svc-name" x="625" y="83" textAnchor="middle">Cert. Support</text>
      <text className="svc-provider" x="625" y="100" textAnchor="middle">SUPPORT TEAM</text>

      <rect className="node-box" x="704" y="40" width="130" height="100" rx="2" />
      <text className="node-badge" x="769" y="55" textAnchor="middle">CVS</text>
      <text className="svc-name" x="769" y="70" textAnchor="middle">Certification</text>
      <text className="svc-name" x="769" y="83" textAnchor="middle">Fulfillment</text>
      <text className="svc-provider" x="769" y="100" textAnchor="middle">FULFILLMENT</text>

      <rect className="node-box terminal" x="848" y="40" width="100" height="100" rx="2" />
      <text className="svc-name on-accent" x="898" y="75" textAnchor="middle">CUSTOMER</text>
      <text className="svc-name on-accent" x="898" y="88" textAnchor="middle">VALUE</text>

      <line className="flow-line" x1="114" y1="90" x2="126" y2="90" markerEnd="url(#arrow2)" />
      <line className="flow-line" x1="258" y1="90" x2="270" y2="90" markerEnd="url(#arrow2)" />
      <line className="flow-line" x1="402" y1="90" x2="414" y2="90" markerEnd="url(#arrow2)" />
      <line className="flow-line" x1="546" y1="90" x2="558" y2="90" markerEnd="url(#arrow2)" />
      <line className="flow-line" x1="690" y1="90" x2="702" y2="90" markerEnd="url(#arrow2)" />
      <line className="flow-line" x1="834" y1="90" x2="846" y2="90" markerEnd="url(#arrow2)" />
    </svg>
  );
}
