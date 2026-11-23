CREATE TABLE student_monthly_snapshots (
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  groups_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  PRIMARY KEY (organization_id, period)
);
--> statement-breakpoint
CREATE TABLE student_admission_results (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  admission_year INTEGER NOT NULL,
  university TEXT NOT NULL,
  department TEXT NOT NULL,
  outcome TEXT NOT NULL,
  cohort TEXT NOT NULL,
  graduated_school TEXT NOT NULL DEFAULT '',
  admission_detail TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  FOREIGN KEY (student_id, organization_id) REFERENCES students(id, organization_id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX student_admission_results_org_year_idx ON student_admission_results(organization_id, admission_year);
