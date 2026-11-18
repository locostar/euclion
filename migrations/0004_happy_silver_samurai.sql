CREATE TABLE `seat_occupancy` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`room_number` integer NOT NULL,
	`seat_number` integer NOT NULL,
	`student_id` text,
	`student_name` text NOT NULL,
	`school` text,
	`grade` text,
	`entered_at` integer NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`,`organization_id`) REFERENCES `students`(`id`,`organization_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seat_occupancy_org_room_seat_uq` ON `seat_occupancy` (`organization_id`,`room_number`,`seat_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `seat_occupancy_org_student_uq` ON `seat_occupancy` (`organization_id`,`student_id`) WHERE "seat_occupancy"."student_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `seat_occupancy_org_demo_idx` ON `seat_occupancy` (`organization_id`,`is_demo`);--> statement-breakpoint
ALTER TABLE `students` ADD `grade` text;