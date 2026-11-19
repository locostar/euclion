ALTER TABLE tuition_charges ADD COLUMN payment_method TEXT CHECK (payment_method IN ('card', 'cash', 'pay', 'transfer', 'other') OR payment_method IS NULL);
--> statement-breakpoint
CREATE INDEX tuition_charges_org_paid_at_idx ON tuition_charges (organization_id, status, paid_at);
--> statement-breakpoint
CREATE TABLE dashboard_layout (
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  layout TEXT NOT NULL,
  PRIMARY KEY (organization_id, user_id)
);
