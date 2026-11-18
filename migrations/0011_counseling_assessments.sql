CREATE TABLE `consultation_records` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`student_id` text NOT NULL,
	`consultation_date` text NOT NULL,
	`category` text NOT NULL,
	`summary` text NOT NULL,
	`next_action` text,
	`recorded_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recorded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`student_id`,`organization_id`) REFERENCES `students`(`id`,`organization_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `consultation_records_org_student_date_idx` ON `consultation_records` (`organization_id`,`student_id`,`consultation_date`);--> statement-breakpoint
CREATE TABLE `student_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`student_id` text NOT NULL,
	`assessment_type` text NOT NULL,
	`assessment_date` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`grade` integer,
	`score` integer,
	`max_score` integer,
	`note` text,
	`recorded_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recorded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`student_id`,`organization_id`) REFERENCES `students`(`id`,`organization_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_assessments_org_student_series_uq` ON `student_assessments` (`organization_id`,`student_id`,`assessment_type`,`assessment_date`,`title`,`subject`);--> statement-breakpoint
CREATE INDEX `student_assessments_org_student_date_idx` ON `student_assessments` (`organization_id`,`student_id`,`assessment_date`);