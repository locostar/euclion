CREATE TABLE `academy_preferences` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`guardian_reminder_message` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_seat_occupancy` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`room_number` integer NOT NULL,
	`seat_number` integer NOT NULL,
	`student_id` text,
	`student_name` text NOT NULL,
	`school` text,
	`grade` text,
	`status` text DEFAULT 'absent' NOT NULL,
	`total_duration_ms` integer DEFAULT 0 NOT NULL,
	`entered_at` integer NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`,`organization_id`) REFERENCES `students`(`id`,`organization_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_seat_occupancy`("id", "organization_id", "room_number", "seat_number", "student_id", "student_name", "school", "grade", "status", "total_duration_ms", "entered_at", "is_demo") SELECT "id", "organization_id", "room_number", "seat_number", "student_id", "student_name", "school", "grade", "status", "total_duration_ms", "entered_at", "is_demo" FROM `seat_occupancy`;--> statement-breakpoint
DROP TABLE `seat_occupancy`;--> statement-breakpoint
ALTER TABLE `__new_seat_occupancy` RENAME TO `seat_occupancy`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `seat_occupancy_org_room_seat_uq` ON `seat_occupancy` (`organization_id`,`room_number`,`seat_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `seat_occupancy_org_student_uq` ON `seat_occupancy` (`organization_id`,`student_id`) WHERE "seat_occupancy"."student_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `seat_occupancy_org_demo_idx` ON `seat_occupancy` (`organization_id`,`is_demo`);--> statement-breakpoint
UPDATE `seat_occupancy` SET `status` = 'present' WHERE `status` = 'in_use';