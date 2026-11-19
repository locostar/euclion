CREATE TABLE academy_number (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id TEXT NOT NULL UNIQUE REFERENCES organization(id) ON DELETE CASCADE,
  issued_month TEXT NOT NULL
);
--> statement-breakpoint
INSERT INTO academy_number (organization_id, issued_month)
SELECT id, strftime('%Y%m', created_at / 1000, 'unixepoch', '+9 hours')
FROM organization ORDER BY created_at, id;
--> statement-breakpoint
CREATE TRIGGER academy_number_on_create AFTER INSERT ON organization
BEGIN
  INSERT INTO academy_number (organization_id, issued_month)
  VALUES (NEW.id, strftime('%Y%m', NEW.created_at / 1000, 'unixepoch', '+9 hours'));
END;
--> statement-breakpoint
CREATE TABLE academy_join_code (
  organization_id TEXT PRIMARY KEY REFERENCES organization(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at INTEGER
);
--> statement-breakpoint
CREATE TABLE academy_join_redemption (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER academy_join_redemption_on_create AFTER INSERT ON academy_join_redemption
BEGIN
  INSERT INTO member (id, organization_id, user_id, role, created_at)
  VALUES (NEW.id, NEW.organization_id, NEW.user_id, 'member', NEW.created_at);
  UPDATE academy_join_code SET consumed_at = NEW.created_at
  WHERE organization_id = NEW.organization_id;
END;
