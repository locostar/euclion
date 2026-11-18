CREATE TABLE `seat_pricing` (
	`organization_id` text NOT NULL,
	`room_number` integer NOT NULL,
	`seat_number` integer NOT NULL,
	`monthly_fee` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seat_pricing_org_room_seat_uq` ON `seat_pricing` (`organization_id`,`room_number`,`seat_number`);