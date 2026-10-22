# Components

- **`signature/`** holds the seven components that carry the product idea: ProvenanceTag, EvidenceItem, ConfidenceIndicator, HypothesisCard, RecommendationCard, DecisionBar, AuditEntry. They take plain data props, never dispatch to the store, and get the strongest visual and interaction treatment. Built in phase 2.
- **`supporting/`** holds generic components (shell, tables, timeline, dialogs). They use tokens only and stay visually restrained. Built in phases 3 and 4.

Each component lives in its own folder with `Component.tsx` and `Component.module.css`; signature components also have a test for accessible name and states.
