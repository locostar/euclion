CREATE TABLE `tuition_charges` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`student_id` text NOT NULL,
	`billing_period` text NOT NULL,
	`amount` integer NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'unpaid' NOT NULL,
	`paid_at` integer,
	`memo` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`,`organization_id`) REFERENCES `students`(`id`,`organization_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tuition_charges_org_student_period_uq` ON `tuition_charges` (`organization_id`,`student_id`,`billing_period`);--> statement-breakpoint
CREATE INDEX `tuition_charges_org_period_status_idx` ON `tuition_charges` (`organization_id`,`billing_period`,`status`);