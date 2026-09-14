export function InternalChain() {
  return (
    <svg
      className="chain"
      viewBox="0 0 962 160"
      role="img"
      aria-label="VBP service chain: Demand and Engagement, an enabling service run by Edwin, feeds two unowned Customer Value Services — Professional Readiness Assessment and Candidate Admission — followed by Master Class Delivery and Post-Training Certification Support, both run by Anne, then Certification and Completion Fulfillment run by Edwin, ending in customer value."
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
        </marker>
      </defs>

      <rect className="node-box enabling" x="14" y="40" width="100" height="100" rx="2" />
      <text className="node-badge muted" x="64" y="55" textAnchor="middle">ENABLING</text>
      <text className="svc-name" x="64" y="70" textAnchor="middle">Demand &amp;</text>
      <text className="svc-name" x="64" y="83" textAnchor="middle">Engagement</text>
      <text className="svc-provider" x="64" y="98" textAnchor="middle">EDWIN</text>
      <text className="node-dept" x="64" y="114" textAnchor="middle">DEPT · IT</text>

      <rect className="node-box gap" x="128" y="40" width="130" height="100" rx="2" />
      <text className="node-badge gap" x="193" y="55" textAnchor="middle">CVS · GAP</text>
      <text className="svc-name" x="193" y="70" textAnchor="middle">Readiness</text>
      <text className="svc-name" x="193" y="83" textAnchor="middle">Assessment</text>
      <text className="svc-provider muted" x="193" y="98" textAnchor="middle">NO OWNER</text>
      <text className="node-dept" x="193" y="114" textAnchor="middle">DEPT · —</text>

      <rect className="node-box gap" x="272" y="40" width="130" height="100" rx="2" />
      <text className="node-badge gap" x="337" y="55" textAnchor="middle">CVS · GAP</text>
      <text className="svc-name" x="337" y="70" textAnchor="middle">Candidate</text>
      <text className="svc-name" x="337" y="83" textAnchor="middle">Admission</text>
      <text className="svc-provider muted" x="337" y="98" textAnchor="middle">NO OWNER</text>
      <text className="node-dept" x="337" y="114" textAnchor="middle">DEPT · —</text>

      <rect className="node-box" x="416" y="40" width="130" height="100" rx="2" />
      <text className="node-badge" x="481" y="55" textAnchor="middle">CVS</text>
      <text className="svc-name" x="481" y="70" textAnchor="middle">Master Class</text>
      <text className="svc-name" x="481" y="83" textAnchor="middle">Delivery</text>
      <text className="svc-provider" x="481" y="98" textAnchor="middle">ANNE</text>
      <text className="node-dept" x="481" y="114" textAnchor="middle">DEPT · INSTRUCTOR</text>

      <rect className="node-box" x="560" y="40" width="130" height="100" rx="2" />
      <text className="node-badge" x="625" y="55" textAnchor="middle">CVS</text>
      <text className="svc-name" x="625" y="70" textAnchor="middle">Post-Training</text>
      <text className="svc-name" x="625" y="83" textAnchor="middle">Cert. Support</text>
      <text className="svc-provider" x="625" y="98" textAnchor="middle">ANNE</text>
      <text className="node-dept" x="625" y="114" textAnchor="middle">DEPT · INSTRUCTOR</text>

      <rect className="node-box" x="704" y="40" width="130" height="100" rx="2" />
      <text className="node-badge" x="769" y="55" textAnchor="middle">CVS</text>
      <text className="svc-name" x="769" y="70" textAnchor="middle">Certification</text>
      <text className="svc-name" x="769" y="83" textAnchor="middle">Fulfillment</text>
      <text className="svc-provider" x="769" y="98" textAnchor="middle">EDWIN</text>
      <text className="node-dept" x="769" y="114" textAnchor="middle">DEPT · IT</text>

      <rect className="node-box terminal" x="848" y="40" width="100" height="100" rx="2" />
      <text className="svc-name on-accent" x="898" y="75" textAnchor="middle">CUSTOMER</text>
      <text className="svc-name on-accent" x="898" y="88" textAnchor="middle">VALUE</text>

      <line className="flow-line" x1="114" y1="90" x2="126" y2="90" markerEnd="url(#arrow)" />
      <line className="flow-line" x1="258" y1="90" x2="270" y2="90" markerEnd="url(#arrow)" />
      <line className="flow-line" x1="402" y1="90" x2="414" y2="90" markerEnd="url(#arrow)" />
      <line className="flow-line" x1="546" y1="90" x2="558" y2="90" markerEnd="url(#arrow)" />
      <line className="flow-line" x1="690" y1="90" x2="702" y2="90" markerEnd="url(#arrow)" />
      <line className="flow-line" x1="834" y1="90" x2="846" y2="90" markerEnd="url(#arrow)" />
    </svg>
  );
}
